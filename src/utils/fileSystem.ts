import fs from 'fs-extra';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface WriteResult {
  path: string;
  written: boolean;
}

export async function ensureDirectories(root: string, directories: string[]): Promise<void> {
  for (const directory of directories) {
    await fs.ensureDir(path.join(root, directory));
  }
}

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

export function isMissingError(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT');
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
