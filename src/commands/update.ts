import { confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import {
  ensureDirectoryTracked,
  isMissingError,
  writeFileAtomically,
} from '../utils/fileSystem.js';
import { logger } from '../utils/logger.js';
import { scaffoldFiles } from '../templates/index.js';

export interface UpdateOptions {
  cwd?: string;
  now?: () => Date;
  confirmChanges?: (replacements: string[], additions: string[]) => Promise<boolean>;
  yes?: boolean;
  dryRun?: boolean;
}

interface Change {
  path: string;
  kind: 'replace' | 'create';
  previousContent?: string;
  mode?: number;
}

export interface UpdateResult {
  updated: string[];
  created: string[];
  unchanged: string[];
  cancelled?: boolean;
  dryRun?: boolean;
  backupDirectory?: string;
}

export async function updateVault(
  targetPath: string | undefined,
  options: UpdateOptions = {},
): Promise<UpdateResult> {
  const target = path.resolve(options.cwd ?? process.cwd(), targetPath ?? '.');
  const targetStats = await fs.stat(target).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (!targetStats?.isDirectory()) {
    throw new Error(`Vault directory does not exist: ${target}`);
  }

  const changes: Change[] = [];
  const unchanged: string[] = [];
  for (const [relativePath, contents] of Object.entries(scaffoldFiles)) {
    const symlinkParent = await findSymlinkParent(target, relativePath);
    if (symlinkParent) {
      unchanged.push(relativePath);
      logger.warning(`Preserved scaffold path under symlink ${symlinkParent}`);
      continue;
    }
    const absolutePath = path.join(target, relativePath);
    const stats = await fs.lstat(absolutePath).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (!stats) {
      changes.push({ path: relativePath, kind: 'create' });
    } else if (stats.isSymbolicLink()) {
      unchanged.push(relativePath);
      logger.warning(`Preserved symlink ${relativePath}`);
    } else if (!stats.isFile()) {
      throw new Error(`Cannot update scaffold; path is not a file: ${relativePath}`);
    } else {
      const previousContent = await fs.readFile(absolutePath, 'utf8');
      if (previousContent === contents) {
        unchanged.push(relativePath);
      } else {
        changes.push({ path: relativePath, kind: 'replace', previousContent, mode: stats.mode });
      }
    }
  }

  const replacements = changes
    .filter((change) => change.kind === 'replace')
    .map(({ path }) => path);
  const additions = changes.filter((change) => change.kind === 'create').map(({ path }) => path);
  if (replacements.length > 0) {
    const backupRoot = path.join(target, '.arc-backups');
    const backupStats = await fs.lstat(backupRoot).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (backupStats && (backupStats.isSymbolicLink() || !backupStats.isDirectory())) {
      throw new Error(`Cannot safely create scaffold backups: ${backupRoot}`);
    }
  }
  logger.info(`Scaffold update preview for ${target}`);
  for (const change of changes) {
    logger.info(
      `${change.kind === 'replace' ? 'Would replace (backup)' : 'Would create'} ${change.path}`,
    );
  }
  if (changes.length === 0) {
    logger.success('Scaffold is already up to date.');
    return { updated: [], created: [], unchanged };
  }
  if (options.dryRun) {
    return { updated: [], created: [], unchanged, dryRun: true };
  }

  const accepted =
    options.yes ??
    (await (
      options.confirmChanges ??
      (() =>
        confirm({
          message: `Apply ${replacements.length} replacement(s) and ${additions.length} addition(s)? Existing files will be backed up.`,
          default: false,
        }))
    )(replacements, additions));
  if (!accepted) {
    logger.info('Scaffold update cancelled.');
    return { updated: [], created: [], unchanged, cancelled: true };
  }

  const timestamp = (options.now ?? (() => new Date()))().toISOString().replace(/[:.]/g, '-');
  const backupDirectory = path.join(target, '.arc-backups', timestamp);
  const updated: string[] = [];
  const created: string[] = [];
  const createdDirectories: string[] = [];
  try {
    for (const change of changes) {
      const absolutePath = path.join(target, change.path);
      await ensureDirectoryTracked(path.dirname(absolutePath), createdDirectories);
      if (change.kind === 'replace') {
        const currentContent = await fs.readFile(absolutePath, 'utf8');
        if (currentContent !== change.previousContent) {
          throw new Error(`File changed during update; no replacement made: ${change.path}`);
        }
        const backupPath = path.join(backupDirectory, change.path);
        const symlinkParent = await findSymlinkParent(target, path.relative(target, backupPath));
        if (symlinkParent) {
          throw new Error(`Cannot safely create scaffold backup under symlink ${symlinkParent}`);
        }
        await ensureDirectoryTracked(path.dirname(backupPath), createdDirectories);
        await fs.writeFile(backupPath, change.previousContent ?? '', {
          encoding: 'utf8',
          flag: 'wx',
        });
        await writeFileAtomically(absolutePath, scaffoldFiles[change.path], change.mode);
        updated.push(change.path);
      } else {
        const result = await fs
          .writeFile(absolutePath, scaffoldFiles[change.path], {
            encoding: 'utf8',
            flag: 'wx',
          })
          .then(() => true)
          .catch((error: unknown) => {
            if (
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              error.code === 'EEXIST'
            ) {
              return false;
            }
            throw error;
          });
        if (!result) {
          throw new Error(`File appeared during update; no replacement made: ${change.path}`);
        }
        created.push(change.path);
      }
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const relativePath of created.reverse()) {
      try {
        const absolutePath = path.join(target, relativePath);
        const stats = await fs.lstat(absolutePath);
        if (
          stats.isFile() &&
          (await fs.readFile(absolutePath, 'utf8')) === scaffoldFiles[relativePath]
        ) {
          await fs.unlink(absolutePath);
        }
      } catch (rollbackError) {
        if (!isMissingError(rollbackError)) rollbackErrors.push(rollbackError);
      }
    }
    for (const relativePath of updated.reverse()) {
      try {
        const change = changes.find((entry) => entry.path === relativePath);
        if (change?.previousContent !== undefined) {
          const absolutePath = path.join(target, relativePath);
          const stats = await fs.lstat(absolutePath);
          if (
            stats.isFile() &&
            (await fs.readFile(absolutePath, 'utf8')) === scaffoldFiles[relativePath]
          ) {
            await writeFileAtomically(absolutePath, change.previousContent, change.mode);
          } else {
            rollbackErrors.push(
              new Error(`File changed during rollback; preserved: ${relativePath}`),
            );
          }
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const directory of createdDirectories.reverse()) {
      try {
        await fs.rmdir(directory);
      } catch (rollbackError) {
        if (
          !isMissingError(rollbackError) &&
          typeof rollbackError === 'object' &&
          rollbackError !== null &&
          'code' in rollbackError &&
          rollbackError.code !== 'ENOTEMPTY' &&
          rollbackError.code !== 'EEXIST'
        ) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Scaffold update failed and rollback was incomplete',
      );
    }
    throw error;
  }

  logger.success(`Scaffold updated in ${target}`);
  if (replacements.length > 0) {
    logger.info(`Backups saved under ${path.relative(target, backupDirectory)}`);
  }
  return {
    updated,
    created,
    unchanged,
    ...(replacements.length > 0 ? { backupDirectory } : {}),
  };
}

async function findSymlinkParent(root: string, relativePath: string): Promise<string | undefined> {
  const parts = path.posix.dirname(relativePath).split('/').filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const stats = await fs.lstat(current).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (!stats) return undefined;
    if (stats.isSymbolicLink()) return path.relative(root, current);
    if (!stats.isDirectory()) {
      throw new Error(`Scaffold parent is not a directory: ${current}`);
    }
  }
  return undefined;
}
