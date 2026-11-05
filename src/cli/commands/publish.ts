import { confirm } from '@inquirer/prompts';
import { constants } from 'node:fs';
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { logger } from '../utils/logger.js';

const MAX_EXPORT_FILES = 500;
const MAX_NOTE_BYTES = 64 * 1024;
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
const MAX_SCAN_ENTRIES = 2_000;
const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.arc-backups',
  '.git',
  '.obsidian',
  '900_Archive',
  '999_Templates',
  'Past_Phases_Archive',
]);

export interface PublishOptions {
  cwd?: string;
  outputPath: string;
  exclude?: string[];
  yes?: boolean;
  dryRun?: boolean;
  confirmPublish?: (noteCount: number, outputPath: string) => Promise<boolean>;
}

export interface PublishResult {
  vaultPath: string;
  outputPath: string;
  included: string[];
  excluded: string[];
  published: boolean;
  cancelled?: boolean;
  dryRun?: boolean;
}

interface ExportNote {
  path: string;
  content: string;
  sizeBytes: number;
}

interface ExportPlan {
  notes: ExportNote[];
  excluded: string[];
}

/**
 * Export explicitly selected Markdown files to a new, local review directory.
 *
 * @param vaultPath Explicit source vault directory.
 * @param selections Vault-relative Markdown files or directories to include.
 * @param options Output, exclusion, preview, and confirmation settings.
 * @returns The deterministic export plan and whether files were written.
 * @throws If any selected content or output path is invalid or unsafe.
 */
export async function publishSelectedContent(
  vaultPath: string,
  selections: string[],
  options: PublishOptions,
): Promise<PublishResult> {
  const vaultRoot = await resolveVaultRoot(vaultPath);
  const selectedPaths = selections.map((selection) => validateRelativePath(selection, 'selection'));
  if (selectedPaths.length === 0) {
    throw new Error('Select at least one vault-relative Markdown file or directory.');
  }
  const exclusions = (options.exclude ?? []).map((exclude) =>
    validateRelativePath(exclude, 'exclusion'),
  );
  await validatePaths(vaultRoot, [...new Set([...selectedPaths, ...exclusions])]);

  const { outputPath, outputParent } = await resolveOutputPath(
    options.outputPath,
    vaultRoot,
    options.cwd ?? process.cwd(),
  );
  const plan = await createExportPlan(vaultRoot, selectedPaths, exclusions);
  if (plan.notes.length === 0) {
    throw new Error('No publishable Markdown notes remain after applying exclusions.');
  }

  reportPublishPreview(plan, outputPath);
  if (options.dryRun) {
    return {
      vaultPath: vaultRoot,
      outputPath,
      included: plan.notes.map((note) => note.path),
      excluded: plan.excluded,
      published: false,
      dryRun: true,
    };
  }

  if (!options.yes && !options.confirmPublish && !process.stdin.isTTY) {
    throw new Error('Publishing requires confirmation; use --yes in non-interactive mode.');
  }
  const accepted =
    options.yes ??
    (await (
      options.confirmPublish ??
      (() =>
        confirm({
          message: `Export ${plan.notes.length} Markdown note(s) to "${outputPath}"?`,
          default: false,
        }))
    )(plan.notes.length, outputPath));
  if (!accepted) {
    logger.info('Publishing cancelled; no output was written.');
    return {
      vaultPath: vaultRoot,
      outputPath,
      included: plan.notes.map((note) => note.path),
      excluded: plan.excluded,
      published: false,
      cancelled: true,
    };
  }

  await writeExport(plan.notes, outputPath, outputParent, vaultRoot);
  logger.success(`Exported ${plan.notes.length} Markdown note(s) to ${outputPath}`);
  return {
    vaultPath: vaultRoot,
    outputPath,
    included: plan.notes.map((note) => note.path),
    excluded: plan.excluded,
    published: true,
  };
}

async function resolveVaultRoot(vaultPath: string): Promise<string> {
  if (!vaultPath.trim()) {
    throw new Error('Provide an explicit vault directory to publish from.');
  }
  const absolutePath = path.resolve(vaultPath);
  const initialStats = await lstat(absolutePath, 'selected vault');
  if (initialStats.isSymbolicLink() || !initialStats.isDirectory()) {
    throw new Error('The selected vault path must be an existing, non-symlink directory.');
  }

  const canonicalPath = await fs.realpath(absolutePath);
  const finalStats = await lstat(absolutePath, 'selected vault');
  if (!sameEntry(initialStats, finalStats) || finalStats.isSymbolicLink()) {
    throw new Error('The selected vault path changed during validation.');
  }
  return canonicalPath;
}

async function resolveOutputPath(
  requestedPath: string,
  vaultRoot: string,
  cwd: string,
): Promise<{ outputPath: string; outputParent: string }> {
  if (!requestedPath.trim()) {
    throw new Error('Provide an explicit output directory with --output.');
  }
  const requestedAbsolutePath = path.resolve(cwd, requestedPath);
  const outputParent = path.dirname(requestedAbsolutePath);
  const parentStats = await fs.stat(outputParent).catch((error: unknown) => {
    throw new Error(`Unable to access output parent "${outputParent}": ${errorMessage(error)}`);
  });
  if (!parentStats.isDirectory()) {
    throw new Error(`Output parent is not a directory: ${outputParent}`);
  }
  const canonicalParent = await fs.realpath(outputParent);
  const outputPath = path.join(canonicalParent, path.basename(requestedAbsolutePath));
  const outputStats = await fs.lstat(outputPath).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (outputStats) {
    throw new Error(`Output directory already exists; refusing to overwrite: ${outputPath}`);
  }
  if (pathsOverlap(vaultRoot, outputPath)) {
    throw new Error('The output directory must be separate from and outside the source vault.');
  }
  return { outputPath, outputParent: canonicalParent };
}

async function validatePaths(vaultRoot: string, relativePaths: string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    let current = vaultRoot;
    const segments = relativePath.split('/');
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stats = await lstat(current, relativePath);
      if (stats.isSymbolicLink()) {
        throw new Error(`Symlinks are not allowed in publish paths: "${relativePath}".`);
      }
      if (index < segments.length - 1 && !stats.isDirectory()) {
        throw new Error(`Publish path parent is not a directory: "${relativePath}".`);
      }
    }
    const canonicalPath = await fs.realpath(current);
    if (!isWithin(vaultRoot, canonicalPath)) {
      throw new Error(`Publish path escapes the selected vault: "${relativePath}".`);
    }
  }
}

async function createExportPlan(
  vaultRoot: string,
  selections: string[],
  exclusions: string[],
): Promise<ExportPlan> {
  const notesByPath = new Map<string, ExportNote>();
  const excludedPaths = new Set<string>();
  let entriesVisited = 0;
  let totalBytes = 0;

  const isExcluded = (relativePath: string): boolean =>
    exclusions.some(
      (exclude) => relativePath === exclude || relativePath.startsWith(`${exclude}/`),
    );

  const visit = async (relativePath: string): Promise<void> => {
    if (isExcluded(relativePath) || isDefaultExcluded(relativePath)) {
      excludedPaths.add(relativePath);
      return;
    }

    const absolutePath = absoluteVaultPath(vaultRoot, relativePath);
    const stats = await lstat(absolutePath, relativePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed in publish selections: "${relativePath}".`);
    }
    if (stats.isDirectory()) {
      const canonicalDirectory = await fs.realpath(absolutePath);
      if (!isWithin(vaultRoot, canonicalDirectory)) {
        throw new Error(`Publish directory escapes the selected vault: "${relativePath}".`);
      }
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      for (const entry of entries) {
        entriesVisited += 1;
        if (entriesVisited > MAX_SCAN_ENTRIES) {
          throw new Error(`Publish scan exceeds the ${MAX_SCAN_ENTRIES}-entry limit.`);
        }
        const childPath = `${relativePath}/${entry.name}`;
        if (isExcluded(childPath) || isDefaultExcluded(childPath)) {
          excludedPaths.add(childPath);
          continue;
        }
        if (/[\u0000-\u001f\u007f-\u009f]/.test(entry.name)) {
          throw new Error('Publish paths cannot contain control characters.');
        }
        if (entry.isSymbolicLink()) {
          throw new Error(`Symlinks are not allowed in publish selections: "${childPath}".`);
        }
        if (entry.isDirectory()) {
          await visit(childPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          await addNote(childPath);
        } else if (!entry.isFile()) {
          throw new Error(`Unsupported filesystem entry in publish selection: "${childPath}".`);
        }
      }
      return;
    }
    if (!stats.isFile() || !relativePath.toLowerCase().endsWith('.md')) {
      throw new Error(`Publish selection must be a Markdown file or directory: "${relativePath}".`);
    }
    await addNote(relativePath);
  };

  const addNote = async (relativePath: string): Promise<void> => {
    if (notesByPath.has(relativePath)) return;
    if (notesByPath.size >= MAX_EXPORT_FILES) {
      throw new Error(`Publish selection exceeds the ${MAX_EXPORT_FILES}-note limit.`);
    }
    const note = await readExportNote(vaultRoot, relativePath);
    totalBytes += note.sizeBytes;
    if (totalBytes > MAX_EXPORT_BYTES) {
      throw new Error(`Publish selection exceeds the ${MAX_EXPORT_BYTES}-byte content limit.`);
    }
    notesByPath.set(relativePath, note);
  };

  for (const selection of selections) {
    await visit(selection);
  }
  return {
    notes: [...notesByPath.values()].sort((left, right) => compareText(left.path, right.path)),
    excluded: [...excludedPaths].sort(compareText),
  };
}

async function readExportNote(vaultRoot: string, relativePath: string): Promise<ExportNote> {
  const absolutePath = absoluteVaultPath(vaultRoot, relativePath);
  const initialStats = await lstat(absolutePath, relativePath);
  if (initialStats.isSymbolicLink() || !initialStats.isFile()) {
    throw new Error(`Publish note is not a regular file: "${relativePath}".`);
  }
  if (initialStats.size > MAX_NOTE_BYTES) {
    throw new Error(`Note "${relativePath}" exceeds the ${MAX_NOTE_BYTES}-byte content limit.`);
  }

  let handle;
  try {
    handle = await fs.open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedStats = await handle.stat();
    if (!openedStats.isFile() || !sameEntry(initialStats, openedStats)) {
      throw new Error(`Note "${relativePath}" changed during publishing.`);
    }
    const canonicalPath = await fs.realpath(absolutePath);
    if (!isWithin(vaultRoot, canonicalPath)) {
      throw new Error(`Publish note escapes the selected vault: "${relativePath}".`);
    }
    const bytes = Buffer.alloc(MAX_NOTE_BYTES + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_NOTE_BYTES) {
      throw new Error(`Note "${relativePath}" exceeds the ${MAX_NOTE_BYTES}-byte content limit.`);
    }
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset));
    } catch {
      throw new Error(`Note "${relativePath}" is not valid UTF-8 Markdown.`);
    }
    const finalStats = await handle.stat();
    const pathStats = await lstat(absolutePath, relativePath);
    if (
      !sameEntry(openedStats, finalStats) ||
      openedStats.size !== finalStats.size ||
      openedStats.mtimeMs !== finalStats.mtimeMs ||
      pathStats.isSymbolicLink() ||
      !sameEntry(finalStats, pathStats)
    ) {
      throw new Error(`Note "${relativePath}" changed during publishing.`);
    }
    return {
      path: relativePath,
      content: stripFrontmatter(content, relativePath),
      sizeBytes: offset,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Note "')) throw error;
    throw new Error(`Unable to read publish note "${relativePath}": ${errorMessage(error)}`);
  } finally {
    await handle?.close();
  }
}

function stripFrontmatter(content: string, relativePath: string): string {
  const normalized = content.startsWith('\uFEFF') ? content.slice(1) : content;
  if (!/^---[ \t]*\r?\n/.test(normalized)) return normalized;
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(normalized);
  if (!match) {
    throw new Error(`Malformed YAML front-matter in "${relativePath}": missing closing delimiter.`);
  }

  let metadata: unknown;
  try {
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length > 0) throw new Error('Invalid YAML');
    metadata = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new Error(`Malformed YAML front-matter in "${relativePath}".`);
  }
  if (metadata === null) {
    return normalized.slice(match[0].length).replace(/^(?:\r?\n)/, '');
  }
  if (
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    (Object.getPrototypeOf(metadata) !== Object.prototype &&
      Object.getPrototypeOf(metadata) !== null)
  ) {
    throw new Error(`Malformed YAML front-matter in "${relativePath}": expected a mapping.`);
  }
  assertNotPrivateMetadata(metadata, relativePath);
  return normalized.slice(match[0].length).replace(/^(?:\r?\n)/, '');
}

function assertNotPrivateMetadata(value: unknown, relativePath: string): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNotPrivateMetadata(item, relativePath);
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  for (const [key, fieldValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (['private', 'sensitive', 'confidential', 'secret'].includes(normalizedKey)) {
      if (fieldValue === true) {
        throw new Error(`Refusing to export private or sensitive note "${relativePath}".`);
      }
      if (fieldValue !== false) {
        throw new Error(
          `Ambiguous privacy metadata "${key}" in "${relativePath}"; refusing to export.`,
        );
      }
    } else if (normalizedKey === 'publish') {
      if (fieldValue === false) {
        throw new Error(`Refusing to export note marked publish: false: "${relativePath}".`);
      }
      if (fieldValue !== true) {
        throw new Error(
          `Ambiguous privacy metadata "${key}" in "${relativePath}"; refusing to export.`,
        );
      }
    } else if (['visibility', 'classification', 'privacy'].includes(normalizedKey)) {
      const label = typeof fieldValue === 'string' ? fieldValue.trim().toLowerCase() : '';
      if (['private', 'confidential', 'restricted', 'internal', 'unlisted'].includes(label)) {
        throw new Error(`Refusing to export note marked ${key}: ${label}: "${relativePath}".`);
      }
      if (label !== 'public') {
        throw new Error(
          `Ambiguous privacy metadata "${key}" in "${relativePath}"; refusing to export.`,
        );
      }
    } else if (normalizedKey === 'tags') {
      const tags = Array.isArray(fieldValue)
        ? fieldValue.filter((tag): tag is string => typeof tag === 'string')
        : typeof fieldValue === 'string'
          ? fieldValue.split(/[,\s]+/)
          : [];
      if (
        tags.some((tag) =>
          ['private', 'sensitive', 'confidential', 'secret'].includes(
            tag.replace(/^#/, '').toLowerCase(),
          ),
        )
      ) {
        throw new Error(`Refusing to export note with a privacy-sensitive tag: "${relativePath}".`);
      }
    }
    assertNotPrivateMetadata(fieldValue, relativePath);
  }
}

function reportPublishPreview(plan: ExportPlan, outputPath: string): void {
  logger.info(`Publish preview: ${plan.notes.length} Markdown note(s) -> ${outputPath}`);
  for (const note of plan.notes) logger.info(`  include ${note.path}`);
  for (const excluded of plan.excluded) logger.warning(`  exclude ${excluded}`);
  logger.info('All YAML front-matter will be removed; review note bodies before publishing.');
}

async function writeExport(
  notes: ExportNote[],
  outputPath: string,
  outputParent: string,
  vaultRoot: string,
): Promise<void> {
  const createdDirectories: string[] = [];
  const createdFiles: string[] = [];
  try {
    const currentParent = await fs.realpath(path.dirname(outputPath));
    if (
      currentParent !== outputParent ||
      pathsOverlap(vaultRoot, path.join(currentParent, path.basename(outputPath)))
    ) {
      throw new Error('Output location changed during publishing; no files were written.');
    }
    await fs.mkdir(outputPath);
    createdDirectories.push(outputPath);

    for (const note of notes) {
      const outputFile = path.join(outputPath, ...note.path.split('/'));
      await ensureOutputDirectory(path.dirname(outputFile), outputPath, createdDirectories);
      const handle = await fs.open(
        outputFile,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
        0o666,
      );
      createdFiles.push(outputFile);
      try {
        await handle.writeFile(note.content, 'utf8');
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const file of createdFiles.reverse()) {
      try {
        await fs.unlink(file);
      } catch (rollbackError) {
        if (!isMissingError(rollbackError)) rollbackErrors.push(rollbackError);
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
        `Unable to write the publish output and completely roll it back: ${outputPath}`,
      );
    }
    throw error;
  }
}

async function ensureOutputDirectory(
  directory: string,
  outputRoot: string,
  createdDirectories: string[],
): Promise<void> {
  if (directory === outputRoot) return;
  const parent = path.dirname(directory);
  if (parent !== outputRoot) {
    await ensureOutputDirectory(parent, outputRoot, createdDirectories);
  }
  try {
    await fs.mkdir(directory);
    createdDirectories.push(directory);
  } catch (error) {
    if (!hasErrorCode(error, 'EEXIST')) throw error;
    const stats = await fs.lstat(directory);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Unsafe publish output directory: ${directory}`);
    }
  }
}

function validateRelativePath(value: string, label: string): string {
  if (!value.trim() || path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error(`Publish ${label} must be a non-empty vault-relative path: "${value}".`);
  }
  const segments = value.replaceAll('\\', '/').split('/');
  if (
    segments.some((segment) => segment === '..' || /[\u0000-\u001f\u007f-\u009f]/.test(segment))
  ) {
    throw new Error(`Publish ${label} contains an unsafe path: "${value}".`);
  }
  const normalizedSegments = segments.filter((segment) => segment && segment !== '.');
  if (normalizedSegments.length === 0) {
    throw new Error(`Publish ${label} must not select the entire vault.`);
  }
  return normalizedSegments.join('/');
}

function isDefaultExcluded(relativePath: string): boolean {
  return relativePath.split('/').some((segment) => {
    return segment.startsWith('.') || EXCLUDED_DIRECTORY_NAMES.has(segment);
  });
}

function absoluteVaultPath(vaultRoot: string, relativePath: string): string {
  return path.join(vaultRoot, ...relativePath.split('/'));
}

function pathsOverlap(vaultRoot: string, outputPath: string): boolean {
  return isWithin(vaultRoot, outputPath) || isWithin(outputPath, vaultRoot);
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

async function lstat(target: string, label: string): Promise<Stats> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    throw new Error(`Unable to access publish ${label} "${target}": ${errorMessage(error)}`);
  }
}

function sameEntry(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isMissingError(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT');
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
