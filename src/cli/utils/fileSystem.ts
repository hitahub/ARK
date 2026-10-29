import fs from 'fs-extra';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface WriteResult {
  path: string;
  written: boolean;
}

/**
 * Ensure each requested directory path joined to a root directory exists.
 *
 * @param root Base directory for relative directory paths.
 * @param directories Directory paths joined to `root`.
 */
export async function ensureDirectories(root: string, directories: string[]): Promise<void> {
  for (const directory of directories) {
    await fs.ensureDir(path.join(root, directory));
  }
}

/**
 * Create a directory and its missing parents while recording only directories created here.
 *
 * Existing directories are left intact; a non-directory at any required path is an error.
 *
 * @param directory Absolute or relative path to ensure.
 * @param createdDirectories Array that receives the absolute paths created by this call.
 */
export async function ensureDirectoryTracked(
  directory: string,
  createdDirectories: string[],
): Promise<void> {
  const absolutePath = path.resolve(directory);
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${absolutePath}`);
    }
    return;
  } catch (error) {
    if (!isMissingError(error)) {
      throw error;
    }
  }

  const parent = path.dirname(absolutePath);
  if (parent === absolutePath) {
    throw new Error(`Unable to create directory: ${absolutePath}`);
  }
  await ensureDirectoryTracked(parent, createdDirectories);
  try {
    await fs.mkdir(absolutePath);
    createdDirectories.push(absolutePath);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${absolutePath}`);
    }
  }
}

/**
 * Write a file only if its path does not already exist.
 *
 * Existing files and symlinks are preserved; an existing directory at the file path is an error.
 *
 * @param root Base directory joined with the file path.
 * @param relativePath File path joined with `root`.
 * @param contents UTF-8 content to write.
 * @returns The relative path and whether this call created the file.
 * @throws If the write fails for a reason other than an existing file or symlink.
 */
export async function writeFileIfMissing(
  root: string,
  relativePath: string,
  contents: string,
): Promise<WriteResult> {
  const absolutePath = path.join(root, relativePath);
  await fs.ensureDir(path.dirname(absolutePath));

  try {
    // Exclusive creation prevents a concurrent run from overwriting a user's file.
    await fs.writeFile(absolutePath, contents, { encoding: 'utf8', flag: 'wx' });
    return { path: relativePath, written: true };
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      const existing = await fs.lstat(absolutePath);
      // Only a file or symlink is a preserved collision; a directory at this path is an error.
      if (existing.isFile() || existing.isSymbolicLink()) {
        return { path: relativePath, written: false };
      }
    }
    throw error;
  }
}

/**
 * Replace a file atomically by writing a unique sibling temporary file and renaming it.
 *
 * @param filePath File to replace.
 * @param contents UTF-8 replacement content.
 * @param mode Optional filesystem mode for the temporary file.
 * @throws If writing, renaming, or temporary-file cleanup fails.
 */
export async function writeFileAtomically(
  filePath: string,
  contents: string,
  mode?: number,
): Promise<void> {
  const temporaryPath = `${filePath}.arc-tmp-${randomUUID()}`;
  try {
    await fs.writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx', mode });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(temporaryPath);
    } catch (cleanupError) {
      if (!isMissingError(cleanupError)) {
        throw new AggregateError([error, cleanupError], `Unable to clean up ${temporaryPath}`);
      }
    }
    throw error;
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}

/**
 * Check whether an error represents a missing filesystem path (`ENOENT`).
 *
 * @param error Value to inspect.
 * @returns `true` when the error has the `ENOENT` code.
 */
export function isMissingError(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT');
}

/**
 * Check whether an error carries a specific filesystem error code.
 *
 * @param error Value to inspect.
 * @param code Expected error code.
 * @returns `true` when the error has the requested code.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
