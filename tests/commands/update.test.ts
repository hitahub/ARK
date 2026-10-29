import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateVault } from '../../src/commands/update.js';
import { scaffoldFiles } from '../../src/templates/index.js';
import { initializeVault } from '../../src/commands/init.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-update-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('updateVault', () => {
  it('backs up changed files and writes the current scaffold after confirmation', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', { cwd: parent, now: () => new Date(2032, 0, 1) });
    const dashboard = path.join(target, '000_Atlas/Dashboard.md');
    await fs.writeFile(dashboard, 'user-edited content');
    await fs.remove(path.join(target, '999_Templates/TPL_Weekly_Review.md'));

    const result = await updateVault(target, {
      now: () => new Date('2032-03-04T05:06:07.000Z'),
      confirmChanges: vi.fn().mockResolvedValue(true),
    });

    expect(result.updated).toContain('000_Atlas/Dashboard.md');
    expect(result.created).toContain('999_Templates/TPL_Weekly_Review.md');
    expect(await fs.readFile(dashboard, 'utf8')).toBe(scaffoldFiles['000_Atlas/Dashboard.md']);
    expect(await fs.readFile(path.join(target, '999_Templates/TPL_Weekly_Review.md'), 'utf8')).toBe(
      scaffoldFiles['999_Templates/TPL_Weekly_Review.md'],
    );
    expect(
      await fs.readFile(
        path.join(target, '.arc-backups/2032-03-04T05-06-07-000Z/000_Atlas/Dashboard.md'),
        'utf8',
      ),
    ).toBe('user-edited content');
  });

  it('cancels without modifying files when confirmation is declined', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', { cwd: parent, now: () => new Date(2032, 0, 1) });
    const dashboard = path.join(target, '000_Atlas/Dashboard.md');
    await fs.writeFile(dashboard, 'custom content');

    const result = await updateVault(target, {
      confirmChanges: vi.fn().mockResolvedValue(false),
    });

    expect(result.cancelled).toBe(true);
    expect(await fs.readFile(dashboard, 'utf8')).toBe('custom content');
    expect(await fs.pathExists(path.join(target, '.arc-backups'))).toBe(false);
  });

  it('preserves symlinked scaffold files', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', { cwd: parent, now: () => new Date(2032, 0, 1) });
    const dashboard = path.join(target, '000_Atlas/Dashboard.md');
    const linked = path.join(parent, 'linked.md');
    await fs.writeFile(linked, 'user content');
    await fs.remove(dashboard);
    await fs.symlink(linked, dashboard);

    const result = await updateVault(target, { yes: true });

    expect(result.unchanged).toContain('000_Atlas/Dashboard.md');
    expect(await fs.readFile(linked, 'utf8')).toBe('user content');
  });

  it('does not follow symlinked scaffold directories', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const outside = path.join(parent, 'outside');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', { cwd: parent, now: () => new Date(2032, 0, 1) });
    await fs.ensureDir(outside);
    await fs.writeFile(path.join(outside, 'Dashboard.md'), 'user content');
    await fs.remove(path.join(target, '000_Atlas'));
    await fs.symlink(outside, path.join(target, '000_Atlas'), 'dir');

    const result = await updateVault(target, { yes: true });

    expect(result.unchanged).toContain('000_Atlas/Dashboard.md');
    expect(await fs.readFile(path.join(outside, 'Dashboard.md'), 'utf8')).toBe('user content');
  });
});
