import { confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import {
  ensureDirectoryTracked,
  hasErrorCode,
  isMissingError,
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
 * @returns Paths created and preserved; `dryRun` is present for preview results.
 * @throws If filesystem access or scaffold creation fails. A failed write is rolled back
 * where safe; incomplete rollback is reported as an `AggregateError`.
 */
export async function initializeVault(
  targetPath: string | undefined,
  options: InitOptions = {},
): Promise<{ created: string[]; skipped: string[]; dryRun?: boolean }> {
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
  const year = String((options.now ?? (() => new Date()))().getFullYear());
  const directories = [...baseDirectories, path.posix.join('400_Journal', year)];
  const filesToWrite: Record<string, string> = { ...scaffoldFiles };
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
  }

  const created: string[] = [];
  const skipped: string[] = [];
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
      const stats = await fs.stat(directory).catch((error: unknown) => {
        if (isMissingError(error)) return undefined;
        throw error;
      });
      if (stats && !stats.isDirectory()) {
        throw new Error(`Not a directory: ${directory}`);
      }
    }
    for (const relativePath of Object.keys(filesToWrite)) {
      if (relativePath.startsWith(`${pluginDirectory}/`)) {
        await assertNoSymlinkParents(target, relativePath);
      }
      const absolutePath = path.join(target, relativePath);
      const stats = await fs.lstat(absolutePath).catch((error: unknown) => {
        if (isMissingError(error)) return undefined;
        throw error;
      });
      if (stats && !stats.isFile() && !stats.isSymbolicLink()) {
        throw new Error(`Not a file: ${absolutePath}`);
      }
      (stats ? skipped : created).push(relativePath);
    }
    logger.info(`Dry run for ${target}`);
    for (const relativePath of created) logger.info(`Would create ${relativePath}`);
    for (const relativePath of skipped) logger.info(`Would preserve ${relativePath}`);
    return { created, skipped, dryRun: true };
  }

  const createdDirectories: string[] = [];
  const createdFiles: Array<{ path: string; contents: string }> = [];
  try {
    for (const directory of plannedDirectories) {
      await ensureDirectoryTracked(directory, createdDirectories);
    }

    for (const [relativePath, contents] of Object.entries(filesToWrite)) {
      const result = await writeFileIfMissing(target, relativePath, contents);
      (result.written ? created : skipped).push(result.path);
      if (result.written) createdFiles.push({ path: result.path, contents });
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
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
  for (const relativePath of skipped) {
    logger.warning(`Preserved existing ${relativePath}`);
  }
  logger.success(`ARC structure initialized in ${target}`);
  return { created, skipped };
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

async function assertNoSymlinkParents(root: string, relativePath: string): Promise<void> {
  const parentParts = path.posix.dirname(relativePath).split('/');
  let currentPath = root;
  for (const part of parentParts) {
    currentPath = path.join(currentPath, part);
    const stats = await fs.lstat(currentPath).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (!stats) return;
    if (stats.isSymbolicLink()) {
      throw new Error(`Cannot install ARC plugin through symlink: ${currentPath}`);
    }
    if (!stats.isDirectory()) {
      throw new Error(`Cannot install ARC plugin; path is not a directory: ${currentPath}`);
    }
  }
}
