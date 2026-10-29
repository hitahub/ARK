import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeVault } from '../../../src/cli/commands/init.js';
import { verifyVault } from '../../../src/cli/commands/verify.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-verify-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('verifyVault', () => {
  it('accepts a scaffold with user-added content', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
    });
    await fs.writeFile(path.join(target, '300_Slipbox/My Note.md'), 'custom note');
    await fs.ensureDir(path.join(target, '200_Projects/My Project/Phase_01'));

    const result = await verifyVault(target);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects directories directly inside the Slipbox', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
    });
    await fs.ensureDir(path.join(target, '300_Slipbox/Subfolder'));

    const result = await verifyVault(target);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Slipbox must remain flat; found directory: 300_Slipbox/Subfolder',
    );
  });

  it('rejects symlinks to directories directly inside the Slipbox', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
    });
    await fs.ensureDir(path.join(parent, 'linked-directory'));
    await fs.symlink(
      path.join(parent, 'linked-directory'),
      path.join(target, '300_Slipbox/linked-directory'),
      'dir',
    );

    const result = await verifyVault(target);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Slipbox must remain flat; found directory: 300_Slipbox/linked-directory',
    );
  });

  it('reports absent baseline items', async () => {
    const target = await createTemporaryDirectory();

    const result = await verifyVault(target);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Missing required directory: 000_Atlas');
    expect(result.issues).toContain('Missing required file: .claudeignore');
  });
});
