import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeVault } from '../../../src/cli/commands/init.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-init-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('initializeVault', () => {
  it('prompts before initializing the current directory', async () => {
    const cwd = await createTemporaryDirectory();
    const confirmCurrentDirectory = vi.fn().mockResolvedValue(false);

    const result = await initializeVault(undefined, {
      cwd,
      confirmCurrentDirectory,
      now: () => new Date(2032, 0, 1),
    });

    expect(confirmCurrentDirectory).toHaveBeenCalledOnce();
    expect(result.created).toEqual([]);
    expect(await fs.pathExists(path.join(cwd, '000_Atlas'))).toBe(false);
  });

  it('creates the baseline, current-year folder, and starter files', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const confirmCurrentDirectory = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await initializeVault('./vault', {
      cwd: parent,
      confirmCurrentDirectory,
      now: () => new Date(2032, 0, 1),
    });

    expect(confirmCurrentDirectory).not.toHaveBeenCalled();
    expect(await fs.pathExists(path.join(target, '400_Journal/2032'))).toBe(true);
    expect(await fs.pathExists(path.join(target, '000_Atlas/Dashboard.md'))).toBe(true);
    expect(result.created).toContain('999_Templates/TPL_Project_Task.md');
  });

  it('is repeatable and preserves existing generated files', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const options = { cwd: parent, now: () => new Date(2032, 0, 1) };
    await initializeVault('./vault', options);
    const dashboardPath = path.join(target, '000_Atlas/Dashboard.md');
    await fs.writeFile(dashboardPath, 'user content');

    const result = await initializeVault('./vault', options);

    expect(result.skipped).toContain('000_Atlas/Dashboard.md');
    expect(await fs.readFile(dashboardPath, 'utf8')).toBe('user content');
  });

  it('surfaces filesystem errors', async () => {
    const parent = await createTemporaryDirectory();
    await fs.writeFile(path.join(parent, 'blocked'), 'not a directory');

    await expect(
      initializeVault('./blocked/vault', {
        cwd: parent,
        now: () => new Date(2032, 0, 1),
      }),
    ).rejects.toHaveProperty('code');
  });

  it('shows a dry-run preview without creating directories or files', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'preview');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await initializeVault('./preview', {
      cwd: parent,
      dryRun: true,
      now: () => new Date(2032, 0, 1),
    });

    expect(result.dryRun).toBe(true);
    expect(result.created).toContain('000_Atlas/Dashboard.md');
    expect(await fs.pathExists(target)).toBe(false);
  });

  it('rolls back files and empty directories created before an initialization error', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    await fs.ensureDir(path.join(target, '200_Projects/.gitkeep'));

    await expect(
      initializeVault('./vault', {
        cwd: parent,
        now: () => new Date(2032, 0, 1),
      }),
    ).rejects.toThrow();

    expect(await fs.pathExists(path.join(target, '000_Atlas/Dashboard.md'))).toBe(false);
    expect(await fs.pathExists(path.join(target, '999_Templates'))).toBe(false);
    expect(await fs.pathExists(path.join(target, '200_Projects/.gitkeep'))).toBe(true);
  });
});
