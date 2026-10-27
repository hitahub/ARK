import fs from 'fs-extra';
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

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}
