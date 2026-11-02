import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeVault } from '../../../src/cli/commands/init.js';

const temporaryDirectories: string[] = [];
const pluginAssets = {
  'manifest.json': '{"id":"arc-obsidian-plugin","version":"1.0.0"}',
  'main.js': 'plugin bundle',
  'styles.css': 'plugin styles',
};

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-init-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function createPluginAssets(parent: string): Promise<string> {
  const directory = path.join(parent, 'plugin-assets');
  await fs.ensureDir(directory);
  await Promise.all(
    Object.entries(pluginAssets).map(([name, contents]) =>
      fs.writeFile(path.join(directory, name), contents),
    ),
  );
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
      installPlugin: false,
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
      installPlugin: false,
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
    const options = { cwd: parent, now: () => new Date(2032, 0, 1), installPlugin: false };
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
        installPlugin: false,
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
      installPlugin: false,
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
        installPlugin: false,
      }),
    ).rejects.toThrow();

    expect(await fs.pathExists(path.join(target, '000_Atlas/Dashboard.md'))).toBe(false);
    expect(await fs.pathExists(path.join(target, '999_Templates'))).toBe(false);
    expect(await fs.pathExists(path.join(target, '200_Projects/.gitkeep'))).toBe(true);
  });

  it('installs the bundled plugin by default and preserves existing plugin files', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    const existingBundle = path.join(target, '.obsidian/plugins/arc-obsidian-plugin/main.js');
    await fs.ensureDir(path.dirname(existingBundle));
    await fs.writeFile(existingBundle, 'user-managed plugin bundle');

    const result = await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
      pluginAssetsDirectory,
    });

    expect(await fs.readFile(existingBundle, 'utf8')).toBe('user-managed plugin bundle');
    expect(result.skipped).toContain('.obsidian/plugins/arc-obsidian-plugin/main.js');
    expect(result.created).toContain('.obsidian/plugins/arc-obsidian-plugin/manifest.json');
    expect(result.created).toContain('.obsidian/plugins/arc-obsidian-plugin/styles.css');
    expect(
      await fs.readFile(
        path.join(target, '.obsidian/plugins/arc-obsidian-plugin/manifest.json'),
        'utf8',
      ),
    ).toBe(pluginAssets['manifest.json']);
  });

  it('backs up and updates existing plugin assets after confirmation on version mismatch', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    const pluginDirectory = path.join(target, '.obsidian/plugins/arc-obsidian-plugin');
    await fs.ensureDir(pluginDirectory);
    await fs.writeFile(
      path.join(pluginDirectory, 'manifest.json'),
      '{"id":"arc-obsidian-plugin","version":"0.1.0"}',
    );
    await fs.writeFile(path.join(pluginDirectory, 'main.js'), 'old plugin bundle');
    await fs.writeFile(path.join(pluginDirectory, 'styles.css'), 'old plugin styles');
    const confirmPluginUpdate = vi.fn().mockResolvedValue(true);

    const result = await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date('2032-01-01T00:00:00.000Z'),
      pluginAssetsDirectory,
      confirmPluginUpdate,
    });

    expect(confirmPluginUpdate).toHaveBeenCalledWith('0.1.0', '1.0.0');
    expect(result.updated).toEqual([
      '.obsidian/plugins/arc-obsidian-plugin/manifest.json',
      '.obsidian/plugins/arc-obsidian-plugin/main.js',
      '.obsidian/plugins/arc-obsidian-plugin/styles.css',
    ]);
    expect(result.backupDirectory).toBe('.arc-backups/2032-01-01T00-00-00-000Z');
    expect(
      await fs.readFile(
        path.join(target, result.backupDirectory!, '.obsidian/plugins/arc-obsidian-plugin/main.js'),
        'utf8',
      ),
    ).toBe('old plugin bundle');
    expect(await fs.readFile(path.join(pluginDirectory, 'main.js'), 'utf8')).toBe(
      pluginAssets['main.js'],
    );
    expect(await fs.readFile(path.join(pluginDirectory, 'manifest.json'), 'utf8')).toBe(
      pluginAssets['manifest.json'],
    );
  });

  it('preserves existing plugin files when the installed version matches', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    const pluginDirectory = path.join(target, '.obsidian/plugins/arc-obsidian-plugin');
    await fs.ensureDir(pluginDirectory);
    await fs.writeFile(path.join(pluginDirectory, 'manifest.json'), pluginAssets['manifest.json']);
    await fs.writeFile(path.join(pluginDirectory, 'main.js'), 'locally customized plugin bundle');
    await fs.writeFile(path.join(pluginDirectory, 'styles.css'), pluginAssets['styles.css']);
    const confirmPluginUpdate = vi.fn();

    const result = await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
      pluginAssetsDirectory,
      confirmPluginUpdate,
    });

    expect(confirmPluginUpdate).not.toHaveBeenCalled();
    expect(result.updated).toBeUndefined();
    expect(await fs.readFile(path.join(pluginDirectory, 'main.js'), 'utf8')).toBe(
      'locally customized plugin bundle',
    );
    expect(await fs.pathExists(path.join(target, '.arc-backups'))).toBe(false);
  });

  it('preserves the installed plugin when a version update is declined', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    const pluginDirectory = path.join(target, '.obsidian/plugins/arc-obsidian-plugin');
    await fs.ensureDir(pluginDirectory);
    await fs.writeFile(
      path.join(pluginDirectory, 'manifest.json'),
      '{"id":"arc-obsidian-plugin","version":"0.1.0"}',
    );
    await fs.writeFile(path.join(pluginDirectory, 'main.js'), 'old plugin bundle');
    await fs.writeFile(path.join(pluginDirectory, 'styles.css'), 'old plugin styles');
    const confirmPluginUpdate = vi.fn().mockResolvedValue(false);

    const result = await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
      pluginAssetsDirectory,
      confirmPluginUpdate,
    });

    expect(result.cancelled).toBe(true);
    expect(result.updated).toBeUndefined();
    expect(confirmPluginUpdate).toHaveBeenCalledOnce();
    expect(await fs.readFile(path.join(pluginDirectory, 'main.js'), 'utf8')).toBe(
      'old plugin bundle',
    );
    expect(await fs.readFile(path.join(pluginDirectory, 'manifest.json'), 'utf8')).toContain(
      '"version":"0.1.0"',
    );
    expect(await fs.pathExists(path.join(target, '.arc-backups'))).toBe(false);
  });

  it('previews plugin version updates without prompting or writing', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    const pluginDirectory = path.join(target, '.obsidian/plugins/arc-obsidian-plugin');
    await fs.ensureDir(pluginDirectory);
    await fs.writeFile(
      path.join(pluginDirectory, 'manifest.json'),
      '{"id":"arc-obsidian-plugin","version":"0.1.0"}',
    );
    await fs.writeFile(path.join(pluginDirectory, 'main.js'), 'old plugin bundle');
    await fs.writeFile(path.join(pluginDirectory, 'styles.css'), 'old plugin styles');
    const confirmPluginUpdate = vi.fn();

    const result = await initializeVault('./vault', {
      cwd: parent,
      dryRun: true,
      now: () => new Date(2032, 0, 1),
      pluginAssetsDirectory,
      confirmPluginUpdate,
    });

    expect(result.dryRun).toBe(true);
    expect(result.updated).toContain('.obsidian/plugins/arc-obsidian-plugin/manifest.json');
    expect(confirmPluginUpdate).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(pluginDirectory, 'main.js'), 'utf8')).toBe(
      'old plugin bundle',
    );
    expect(await fs.pathExists(path.join(target, '.arc-backups'))).toBe(false);
  });

  it('includes plugin files in dry-run without writing them', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'preview');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await initializeVault('./preview', {
      cwd: parent,
      dryRun: true,
      now: () => new Date(2032, 0, 1),
      pluginAssetsDirectory,
    });

    expect(result.created).toContain('.obsidian/plugins/arc-obsidian-plugin/main.js');
    expect(await fs.pathExists(target)).toBe(false);
  });

  it('skips plugin installation when requested', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');

    await initializeVault('./vault', {
      cwd: parent,
      now: () => new Date(2032, 0, 1),
      installPlugin: false,
    });

    expect(await fs.pathExists(path.join(target, '.obsidian'))).toBe(false);
  });

  it('refuses to install the plugin through a symlinked Obsidian directory', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const outside = path.join(parent, 'outside');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    await fs.ensureDir(target);
    await fs.ensureDir(outside);
    await fs.symlink(outside, path.join(target, '.obsidian'), 'dir');

    await expect(
      initializeVault('./vault', {
        cwd: parent,
        now: () => new Date(2032, 0, 1),
        pluginAssetsDirectory,
      }),
    ).rejects.toThrow('Cannot install ARC plugin through symlink');

    expect(await fs.pathExists(path.join(outside, 'plugins'))).toBe(false);
    expect(await fs.pathExists(path.join(target, '000_Atlas'))).toBe(false);
  });

  it('rolls back plugin and scaffold files if plugin installation fails', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    const pluginAssetsDirectory = await createPluginAssets(parent);
    await fs.ensureDir(path.join(target, '.obsidian/plugins/arc-obsidian-plugin/styles.css'));

    await expect(
      initializeVault('./vault', {
        cwd: parent,
        now: () => new Date(2032, 0, 1),
        pluginAssetsDirectory,
      }),
    ).rejects.toThrow();

    expect(await fs.pathExists(path.join(target, '000_Atlas/Dashboard.md'))).toBe(false);
    expect(
      await fs.pathExists(path.join(target, '.obsidian/plugins/arc-obsidian-plugin/manifest.json')),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(target, '.obsidian/plugins/arc-obsidian-plugin/main.js')),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(target, '.obsidian/plugins/arc-obsidian-plugin/styles.css')),
    ).toBe(true);
  });

  it('reports a missing plugin build artifact instead of silently omitting the plugin', async () => {
    const parent = await createTemporaryDirectory();

    await expect(
      initializeVault('./vault', {
        cwd: parent,
        now: () => new Date(2032, 0, 1),
        pluginAssetsDirectory: path.join(parent, 'missing-plugin'),
      }),
    ).rejects.toThrow('Run "pnpm build" and try again.');
  });
});
