import { confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import {
  ensureDirectoryTracked,
  hasErrorCode,
  isMissingError,
  writeFileAtomically,
  writeFileIfMissing,
} from '../utils/fileSystem.js';
import { logger } from '../utils/logger.js';
import { scaffoldFiles } from '../templates/index.js';

const baseDirectories = [
  '000_Atlas',
  '100_Spaces/110_Career_Business',
  '100_Spaces/120_Creative_SideHustle',
  '100_Spaces/130_Personal',
  '200_Projects',
  '200_Projects/210_Project_Alpha/Past_Phases_Archive',
  '200_Projects/210_Project_Alpha/Phase_03_Active',
  '200_Projects/220_Project_B',
  '300_Slipbox',
  '400_Journal',
  '999_Templates',
];

export interface InitOptions {
  cwd?: string;
  confirmCurrentDirectory?: () => Promise<boolean>;
  confirmPluginUpdate?: (installedVersion: string, bundledVersion: string) => Promise<boolean>;
  now?: () => Date;
  dryRun?: boolean;
  installPlugin?: boolean;
  pluginAssetsDirectory?: string;
}

const pluginAssetNames = ['manifest.json', 'main.js', 'styles.css'];
const pluginDirectory = '.obsidian/plugins/arc-obsidian-plugin';

/**
 * Create the ARC scaffold without replacing existing files.
 *
 * When `targetPath` is omitted, the current directory is used only after confirmation.
 * The ARC Obsidian plugin is installed by default unless disabled in options.
 * A dry run validates target path types and reports the files that would be created or kept.
 *
 * @param targetPath Vault directory, resolved relative to `options.cwd` or the process cwd.
 * @param options Prompts, clock, working directory, and dry-run configuration.
 * @returns Paths created, preserved, or updated; accepted updates include their backup directory.
 * A declined plugin update sets `cancelled`; `dryRun` is present for preview results.
 * @throws If filesystem access or scaffold creation fails. A failed write is rolled back
 * where safe; incomplete rollback is reported as an `AggregateError`.
 */
export async function initializeVault(
  targetPath: string | undefined,
  options: InitOptions = {},
): Promise<{
  created: string[];
  skipped: string[];
  updated?: string[];
  dryRun?: boolean;
  cancelled?: boolean;
  backupDirectory?: string;
}> {
  const cwd = options.cwd ?? process.cwd();
  const target = path.resolve(cwd, targetPath ?? '.');
  // An explicit path is an affirmative target; only the implicit cwd needs confirmation.
  const currentDirectoryTarget = targetPath === undefined;

  if (currentDirectoryTarget) {
    const confirmed = await (
      options.confirmCurrentDirectory ??
      (() =>
        confirm({
          message: `Initialize ARC structure in ${path.basename(target) || target}?`,
          default: true,
        }))
    )();
    if (!confirmed) {
      logger.info('Initialization cancelled.');
      return { created: [], skipped: [] };
    }
  }

  // Resolve the journal year once so the whole scaffold uses one consistent local date.
  const now = (options.now ?? (() => new Date()))();
  const year = String(now.getFullYear());
  const directories = [...baseDirectories, path.posix.join('400_Journal', year)];
  const filesToWrite: Record<string, string> = { ...scaffoldFiles };
  const pluginUpdates = new Map<
    string,
    { contents: string; previousContent: string; mode: number }
  >();
  let preservePlugin = false;
  let pluginUpdateCancelled = false;
  if (options.installPlugin !== false) {
    const pluginAssetsDirectory =
      options.pluginAssetsDirectory ?? (await resolvePluginAssetsDirectory());
    for (const assetName of pluginAssetNames) {
      const sourcePath = path.join(pluginAssetsDirectory, assetName);
      const stats = await fs.lstat(sourcePath).catch((error: unknown) => {
        if (isMissingError(error)) {
          throw new Error(
            `ARC plugin asset is missing: ${sourcePath}. Run "pnpm build" and try again.`,
          );
        }
        throw error;
      });
      if (!stats.isFile()) {
        throw new Error(`ARC plugin asset is not a regular file: ${sourcePath}`);
      }
      filesToWrite[path.posix.join(pluginDirectory, assetName)] = await fs.readFile(
        sourcePath,
        'utf8',
      );
    }

    const manifestRelativePath = path.posix.join(pluginDirectory, 'manifest.json');
    const bundledManifest = parsePluginManifest(
      filesToWrite[manifestRelativePath],
      'bundled ARC plugin',
    );
    if (bundledManifest.id !== 'arc-obsidian-plugin') {
      throw new Error('Bundled plugin manifest does not identify ARC Vault Companion.');
    }

    await assertNoSymlinkParents(target, manifestRelativePath);
    const installedManifestPath = path.join(target, manifestRelativePath);
    const installedManifestStats = await fs.lstat(installedManifestPath).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (installedManifestStats?.isSymbolicLink()) {
      preservePlugin = true;
      logger.warning('Preserved ARC plugin assets because the installed manifest is a symlink.');
    } else if (installedManifestStats && !installedManifestStats.isFile()) {
      throw new Error(
        `Cannot inspect ARC plugin manifest; path is not a file: ${manifestRelativePath}`,
      );
    } else if (installedManifestStats) {
      const installedManifest = parsePluginManifest(
        await fs.readFile(installedManifestPath, 'utf8'),
        manifestRelativePath,
      );
      if (installedManifest.id !== bundledManifest.id) {
        throw new Error(
          `Cannot update ARC plugin; installed manifest has unexpected id "${String(installedManifest.id)}".`,
        );
      }
      if (installedManifest.version !== bundledManifest.version) {
        for (const assetName of pluginAssetNames) {
          const relativePath = path.posix.join(pluginDirectory, assetName);
          const absolutePath = path.join(target, relativePath);
          const stats = await fs.lstat(absolutePath).catch((error: unknown) => {
            if (isMissingError(error)) return undefined;
            throw error;
          });
          if (!stats) continue;
          if (!stats.isFile()) {
            throw new Error(
              `Cannot safely update ARC plugin; path is not a regular file: ${relativePath}`,
            );
          }
          const contents = filesToWrite[relativePath];
          const previousContent = await fs.readFile(absolutePath, 'utf8');
          if (previousContent !== contents) {
            pluginUpdates.set(relativePath, { contents, previousContent, mode: stats.mode });
          }
        }

        if (pluginUpdates.size > 0 && !options.dryRun) {
          const accepted = await (
            options.confirmPluginUpdate ??
            (() =>
              confirm({
                message: `Update ARC Obsidian plugin from ${installedManifest.version} to ${bundledManifest.version}? Existing plugin files will be backed up.`,
                default: false,
              }))
          )(installedManifest.version, bundledManifest.version);
          if (!accepted) {
            preservePlugin = true;
            pluginUpdateCancelled = true;
            pluginUpdates.clear();
            logger.info('ARC plugin update cancelled; existing plugin files were preserved.');
          }
        }
      }
    }
    if (preservePlugin) {
      for (const assetName of pluginAssetNames) {
        delete filesToWrite[path.posix.join(pluginDirectory, assetName)];
      }
    }
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const updated: string[] = [];
  let backupDirectory: string | undefined;
  const pluginDirectories =
    options.installPlugin === false
      ? []
      : [
          path.join(target, '.obsidian'),
          path.join(target, '.obsidian/plugins'),
          path.join(target, pluginDirectory),
        ];
  const plannedDirectories = [
    target,
    ...directories.map((directory) => path.join(target, directory)),
    ...pluginDirectories,
  ];
  if (options.installPlugin !== false && !options.dryRun) {
    await assertNoSymlinkParents(target, path.posix.join(pluginDirectory, pluginAssetNames[0]));
  }
  if (options.dryRun) {
    for (const directory of plannedDirectories) {
      if (directory !== target) {
        await assertNoSymlinkParents(
          target,
          path.relative(target, directory).split(path.sep).join('/'),
          true,
        );
      }
      const stats = await (directory === target ? fs.stat(directory) : fs.lstat(directory)).catch(
        (error: unknown) => {
          if (isMissingError(error)) return undefined;
          throw error;
        },
      );
      if (stats && !stats.isDirectory()) {
        throw new Error(`Not a directory: ${directory}`);
      }
    }
    for (const relativePath of Object.keys(filesToWrite)) {
      await assertNoSymlinkParents(target, relativePath);
      const absolutePath = path.join(target, relativePath);
      const stats = await fs.lstat(absolutePath).catch((error: unknown) => {
        if (isMissingError(error)) return undefined;
        throw error;
      });
      if (stats && !stats.isFile() && !stats.isSymbolicLink()) {
        throw new Error(`Not a file: ${absolutePath}`);
      }
      if (pluginUpdates.has(relativePath) && stats?.isFile()) {
        updated.push(relativePath);
      } else {
        (stats ? skipped : created).push(relativePath);
      }
    }
    logger.info(`Dry run for ${target}`);
    for (const relativePath of created) logger.info(`Would create ${relativePath}`);
    for (const relativePath of updated) logger.info(`Would update (backup) ${relativePath}`);
    for (const relativePath of skipped) logger.info(`Would preserve ${relativePath}`);
    return { created, skipped, ...(updated.length > 0 ? { updated } : {}), dryRun: true };
  }

  const createdDirectories: string[] = [];
  const createdFiles: Array<{ path: string; contents: string }> = [];
  const updatedFiles: Array<{
    path: string;
    previousContent: string;
    contents: string;
    mode: number;
  }> = [];
  try {
    for (const directory of plannedDirectories) {
      if (directory !== target) {
        await assertNoSymlinkParents(
          target,
          path.relative(target, directory).split(path.sep).join('/'),
          true,
        );
      }
      await ensureDirectoryTracked(directory, createdDirectories);
    }

    for (const [relativePath, contents] of Object.entries(filesToWrite)) {
      await assertNoSymlinkParents(target, relativePath);
      const pluginUpdate = pluginUpdates.get(relativePath);
      if (pluginUpdate) {
        const absolutePath = path.join(target, relativePath);
        const stats = await fs.lstat(absolutePath);
        if (
          !stats.isFile() ||
          (await fs.readFile(absolutePath, 'utf8')) !== pluginUpdate.previousContent
        ) {
          throw new Error(
            `ARC plugin file changed during update; no replacement made: ${relativePath}`,
          );
        }

        if (!backupDirectory) {
          const timestamp = now.toISOString().replace(/[:.]/g, '-');
          backupDirectory = path.join(target, '.arc-backups', timestamp);
          const backupRoot = path.join(target, '.arc-backups');
          const backupRootStats = await fs.lstat(backupRoot).catch((error: unknown) => {
            if (isMissingError(error)) return undefined;
            throw error;
          });
          if (
            backupRootStats &&
            (backupRootStats.isSymbolicLink() || !backupRootStats.isDirectory())
          ) {
            throw new Error(`Cannot safely create ARC plugin backups: ${backupRoot}`);
          }
        }
        const backupPath = path.join(backupDirectory, relativePath);
        await assertNoSymlinkParents(target, path.relative(target, backupPath));
        await ensureDirectoryTracked(path.dirname(backupPath), createdDirectories);
        await fs.writeFile(backupPath, pluginUpdate.previousContent, {
          encoding: 'utf8',
          flag: 'wx',
          mode: pluginUpdate.mode,
        });
        await writeFileAtomically(absolutePath, pluginUpdate.contents, pluginUpdate.mode);
        updated.push(relativePath);
        updatedFiles.push({ path: relativePath, ...pluginUpdate });
        continue;
      }
      const result = await writeFileIfMissing(target, relativePath, contents);
      (result.written ? created : skipped).push(result.path);
      if (result.written) createdFiles.push({ path: result.path, contents });
    }
    if (backupDirectory) {
      logger.info(`ARC plugin backups saved under ${path.relative(target, backupDirectory)}`);
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const file of updatedFiles.reverse()) {
      try {
        const absolutePath = path.join(target, file.path);
        const stats = await fs.lstat(absolutePath);
        if (stats.isFile() && (await fs.readFile(absolutePath, 'utf8')) === file.contents) {
          await writeFileAtomically(absolutePath, file.previousContent, file.mode);
        } else {
          rollbackErrors.push(new Error(`File changed during rollback; preserved: ${file.path}`));
        }
      } catch (rollbackError) {
        if (!isMissingError(rollbackError)) rollbackErrors.push(rollbackError);
      }
    }
    for (const file of createdFiles.reverse()) {
      try {
        const absolutePath = path.join(target, file.path);
        const stats = await fs.lstat(absolutePath);
        if (stats.isFile() && (await fs.readFile(absolutePath, 'utf8')) === file.contents) {
          await fs.unlink(absolutePath);
        }
      } catch (rollbackError) {
        if (!isMissingError(rollbackError)) rollbackErrors.push(rollbackError);
      }
    }
    for (const directory of createdDirectories.reverse()) {
      try {
        await fs.rmdir(directory);
      } catch (rollbackError) {
        if (
          !isMissingError(rollbackError) &&
          !hasErrorCode(rollbackError, 'ENOTEMPTY') &&
          !hasErrorCode(rollbackError, 'EEXIST')
        ) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Initialization failed and rollback was incomplete',
      );
    }
    throw error;
  }

  for (const relativePath of created) {
    logger.success(`Created ${relativePath}`);
  }
  for (const relativePath of updated) {
    logger.success(`Updated ${relativePath}`);
  }
  for (const relativePath of skipped) {
    logger.warning(`Preserved existing ${relativePath}`);
  }
  logger.success(`ARC structure initialized in ${target}`);
  return {
    created,
    skipped,
    ...(updated.length > 0 ? { updated } : {}),
    ...(pluginUpdateCancelled ? { cancelled: true } : {}),
    ...(backupDirectory ? { backupDirectory: path.relative(target, backupDirectory) } : {}),
  };
}

function parsePluginManifest(
  contents: string,
  description: string,
): { id: unknown; version: string } {
  let manifest: unknown;
  try {
    manifest = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Cannot parse ${description} manifest.`, { cause: error });
  }
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('id' in manifest) ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string' ||
    manifest.version.length === 0
  ) {
    throw new Error(`${description} manifest must include a plugin id and non-empty version.`);
  }
  return { id: manifest.id, version: manifest.version };
}

async function resolvePluginAssetsDirectory(): Promise<string> {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    throw new Error('Unable to locate the ARC CLI package to install its Obsidian plugin.');
  }

  let realEntrypoint: string;
  try {
    realEntrypoint = await fs.realpath(entrypoint);
  } catch (error) {
    throw new Error(`Unable to locate the ARC CLI entrypoint: ${entrypoint}`, { cause: error });
  }
  return path.resolve(path.dirname(realEntrypoint), '..', 'dist/obsidian-plugin');
}

async function assertNoSymlinkParents(
  root: string,
  relativePath: string,
  includeTarget = false,
): Promise<void> {
  const parentParts = (includeTarget ? relativePath : path.posix.dirname(relativePath))
    .split('/')
    .filter((part) => part && part !== '.');
  let currentPath = root;
  for (const part of parentParts) {
    currentPath = path.join(currentPath, part);
    const stats = await fs.lstat(currentPath).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (!stats) return;
    if (stats.isSymbolicLink()) {
      throw new Error(`Cannot create scaffold path through symlink: ${currentPath}`);
    }
    if (!stats.isDirectory()) {
      throw new Error(`Cannot create scaffold path; parent is not a directory: ${currentPath}`);
    }
  }
}
