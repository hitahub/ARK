import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureDirectories, writeFileIfMissing } from '../../src/utils/fileSystem.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-filesystem-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('fileSystem utilities', () => {
  it('creates nested directories under the requested root', async () => {
    const root = await createTemporaryDirectory();

    await ensureDirectories(root, ['one/two', 'three']);

    expect(await fs.stat(path.join(root, 'one/two')).then((stat) => stat.isDirectory())).toBe(true);
    expect(await fs.stat(path.join(root, 'three')).then((stat) => stat.isDirectory())).toBe(true);
  });

  it('writes missing files and preserves existing content', async () => {
    const root = await createTemporaryDirectory();
    const first = await writeFileIfMissing(root, 'nested/note.md', 'generated');
    const second = await writeFileIfMissing(root, 'nested/note.md', 'replacement');

    expect(first.written).toBe(true);
    expect(second.written).toBe(false);
    expect(await fs.readFile(path.join(root, 'nested/note.md'), 'utf8')).toBe('generated');
  });

  it('surfaces a directory colliding with a generated file path', async () => {
    const root = await createTemporaryDirectory();
    await fs.ensureDir(path.join(root, 'note.md'));

    await expect(writeFileIfMissing(root, 'note.md', 'content')).rejects.toMatchObject({
      code: 'EEXIST',
    });
  });
});
