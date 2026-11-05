import { confirm } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import {
  ensureDirectoryTracked,
  isMissingError,
  writeFileAtomically,
} from '../utils/fileSystem.js';
import { logger } from '../utils/logger.js';

export interface ArchiveOptions {
  cwd?: string;
  confirmArchive?: (source: string, destination: string) => Promise<boolean>;
  yes?: boolean;
  dryRun?: boolean;
}

export interface ArchiveResult {
  source: string;
  destination: string;
  archived: boolean;
  cancelled?: boolean;
  dryRun?: boolean;
}

interface ProjectIndex {
  relativePath: string;
  content: string;
  mode: number;
  archivedContent: string;
}

/**
 * Move a completed project to cold storage and mark its project index archived.
 *
 * @param projectName Direct child folder name under `200_Projects`.
 * @param targetPath Vault directory, resolved relative to `options.cwd` or the process cwd.
 * @param options Confirmation and preview settings.
 * @returns The source and destination paths and whether the project was moved.
 * @throws If the project is unsafe, incomplete, colliding, or cannot be moved safely.
 */
export async function archiveProject(
  projectName: string,
  targetPath: string | undefined = undefined,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  validateProjectName(projectName);
  const vault = path.resolve(options.cwd ?? process.cwd(), targetPath ?? '.');
  const projectsDirectory = path.join(vault, '200_Projects');
  const source = path.join(projectsDirectory, projectName);
  const destination = path.join(vault, '900_Archive', 'Projects', projectName);

  const vaultStats = await fs.stat(vault).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (!vaultStats?.isDirectory()) {
    throw new Error(`Vault directory does not exist: ${vault}`);
  }

  const projectsStats = await fs.lstat(projectsDirectory).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (!projectsStats?.isDirectory() || projectsStats.isSymbolicLink()) {
    throw new Error(`Projects directory does not exist or is unsafe: ${projectsDirectory}`);
  }

  const sourceStats = await fs.lstat(source).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (!sourceStats) {
    throw new Error(`Project directory does not exist: ${source}`);
  }
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    throw new Error(`Project path is not a regular directory: ${source}`);
  }

  await inspectProjectTree(source);
  await inspectArchiveParents(vault);
  await assertPathDoesNotExist(destination);
  const projectIndex = await findProjectIndex(source);
  logger.info(`Archive preview: ${source} -> ${destination}`);
  logger.warning('Path-qualified links to the old project location are not rewritten.');

  if (options.dryRun) {
    return { source, destination, archived: false, dryRun: true };
  }

  if (!options.yes && !options.confirmArchive && !process.stdin.isTTY) {
    throw new Error('Archiving requires confirmation; use --yes in non-interactive mode.');
  }

  const accepted =
    options.yes ??
    (await (
      options.confirmArchive ??
      (() =>
        confirm({
          message: `Archive completed project "${projectName}"? Its status will become archived.`,
          default: false,
        }))
    )(source, destination));
  if (!accepted) {
    logger.info('Project archiving cancelled.');
    return { source, destination, archived: false, cancelled: true };
  }

  const createdDirectories: string[] = [];
  let moved = false;
  try {
    await ensureDirectoryTracked(path.dirname(destination), createdDirectories);
    await inspectArchiveParents(vault);
    await assertPathDoesNotExist(destination);
    await fs.rename(source, destination);
    moved = true;
    const destinationIndex = path.join(destination, projectIndex.relativePath);
    if ((await fs.readFile(destinationIndex, 'utf8')) !== projectIndex.content) {
      throw new Error(
        `Project index changed during archive; no status update made: ${destinationIndex}`,
      );
    }
    await writeFileAtomically(destinationIndex, projectIndex.archivedContent, projectIndex.mode);
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    if (moved) {
      try {
        await fs.rename(destination, source);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const directory of createdDirectories.reverse()) {
      try {
        await fs.rmdir(directory);
      } catch (rollbackError) {
        if (!isMissingError(rollbackError)) rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Unable to archive ${projectName} and completely roll back the operation`,
      );
    }
    throw error;
  }

  logger.success(`Archived project "${projectName}" at ${destination}`);
  return { source, destination, archived: true };
}

function validateProjectName(projectName: string): void {
  if (
    !projectName ||
    projectName === '.' ||
    projectName === '..' ||
    projectName.includes('/') ||
    projectName.includes('\\') ||
    projectName.includes('\0')
  ) {
    throw new Error(`Invalid project name: ${projectName}`);
  }
}

async function inspectProjectTree(directory: string, relative = ''): Promise<void> {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Cannot archive a project containing a symlink: ${path.join(directory, child)}`,
      );
    }
    if (entry.isDirectory()) {
      await inspectProjectTree(directory, child);
    } else if (!entry.isFile()) {
      throw new Error(
        `Cannot archive a project containing a special file: ${path.join(directory, child)}`,
      );
    }
  }
}

async function inspectArchiveParents(vault: string): Promise<void> {
  let current = vault;
  for (const segment of ['900_Archive', 'Projects']) {
    current = path.join(current, segment);
    const stats = await fs.lstat(current).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (stats && (stats.isSymbolicLink() || !stats.isDirectory())) {
      throw new Error(`Archive path is not a safe directory: ${current}`);
    }
  }
}

async function assertPathDoesNotExist(target: string): Promise<void> {
  const stats = await fs.lstat(target).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (stats) {
    throw new Error(`Archive destination already exists: ${target}`);
  }
}

async function findProjectIndex(projectDirectory: string): Promise<ProjectIndex> {
  const files = await listMarkdownFiles(projectDirectory);
  const indexes: ProjectIndex[] = [];
  for (const relativePath of files) {
    const absolutePath = path.join(projectDirectory, relativePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    const frontmatter = readFrontmatter(content);
    if (!frontmatter || !hasScalar(frontmatter, 'type', 'project')) continue;
    const statusPattern = /^(status:[ \t]*)(?:"done"|'done'|done)([ \t]*(?:#.*)?\r?)$/m;
    if (!statusPattern.test(frontmatter)) {
      throw new Error(`Project index must have status: done before archiving: ${absolutePath}`);
    }
    const stats = await fs.lstat(absolutePath);
    indexes.push({
      relativePath,
      content,
      mode: stats.mode,
      archivedContent: replaceProjectStatus(content, statusPattern),
    });
  }

  if (indexes.length === 0) {
    throw new Error(`No project index with type: project found in ${projectDirectory}`);
  }
  if (indexes.length > 1) {
    throw new Error(`Multiple project indexes found in ${projectDirectory}`);
  }
  return indexes[0];
}

async function listMarkdownFiles(directory: string, relative = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(directory, child)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(child);
    }
  }
  return files;
}

function readFrontmatter(content: string): string | undefined {
  return content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
}

function hasScalar(frontmatter: string, key: string, value: string): boolean {
  const pattern = new RegExp(
    `^${key}:[ \\t]*(?:"${value}"|'${value}'|${value})[ \\t]*(?:#.*)?\\r?$`,
    'm',
  );
  return pattern.test(frontmatter);
}

function replaceProjectStatus(content: string, statusPattern: RegExp): string {
  const frontmatter = readFrontmatter(content);
  if (!frontmatter) {
    throw new Error('Project index front-matter disappeared while preparing archive.');
  }
  const updatedFrontmatter = frontmatter.replace(statusPattern, '$1archived$2');
  return content.replace(frontmatter, updatedFrontmatter);
}
