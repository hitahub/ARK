import { execFileSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installGitHook, uninstallGitHook } from '../../../src/cli/commands/hook.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-hook-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function createRepository(directory: string): Promise<string> {
  const repository = path.join(directory, 'repo');
  await fs.ensureDir(repository);
  execFileSync('git', ['init', '--quiet'], { cwd: repository });
  return repository;
}

function hookPath(repository: string): string {
  return path.join(repository, '.git', 'hooks', 'pre-commit');
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('ARC Git hook integration', () => {
  it('previews without writing, installs idempotently, and stores the explicit vault path', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'vault');
    await fs.ensureDir(vault);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await installGitHook(vault, { repoPath: repository, dryRun: true });

    expect(preview.dryRun).toBe(true);
    expect(await fs.pathExists(hookPath(repository))).toBe(false);

    const installed = await installGitHook(vault, { repoPath: repository });
    const contents = await fs.readFile(installed.hookPath, 'utf8');
    const repeated = await installGitHook(vault, { repoPath: repository });

    expect(installed.changed).toBe(true);
    expect(contents).toContain(`health '${await fs.realpath(vault)}'`);
    expect((await fs.stat(installed.hookPath)).mode & 0o111).not.toBe(0);
    expect(repeated.changed).toBe(false);
    expect(repeated.hookPath).toBe(installed.hookPath);
  });

  it('supports a repository and vault in separate locations', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'separate-vault');
    await fs.ensureDir(vault);

    const result = await installGitHook(vault, { repoPath: repository, dryRun: true });

    expect(result.vaultPath).toBe(await fs.realpath(vault));
    expect(result.hookPath).toBe(
      path.join(await fs.realpath(repository), '.git', 'hooks', 'pre-commit'),
    );
  });

  it('previews and removes only an intact ARC hook, idempotently', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'vault');
    await fs.ensureDir(vault);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const installed = await installGitHook(vault, { repoPath: repository });

    const preview = await uninstallGitHook({ repoPath: repository, dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(await fs.pathExists(installed.hookPath)).toBe(true);

    const removed = await uninstallGitHook({ repoPath: repository });
    const repeated = await uninstallGitHook({ repoPath: repository });

    expect(removed.changed).toBe(true);
    expect(repeated.changed).toBe(false);
    expect(await fs.pathExists(installed.hookPath)).toBe(false);
  });

  it('rejects existing user hooks without changing them', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'vault');
    await fs.ensureDir(vault);
    await fs.writeFile(hookPath(repository), '#!/bin/sh\necho keep\n', { mode: 0o755 });

    await expect(installGitHook(vault, { repoPath: repository })).rejects.toThrow(
      'already exists and was left untouched',
    );
    await expect(uninstallGitHook({ repoPath: repository })).rejects.toThrow(
      'not an intact ARC-managed hook',
    );
    expect(await fs.readFile(hookPath(repository), 'utf8')).toBe('#!/bin/sh\necho keep\n');
  });

  it('rejects an ARC hook configured for a different vault rather than replacing it', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const firstVault = path.join(directory, 'first-vault');
    const secondVault = path.join(directory, 'second-vault');
    await fs.ensureDir(firstVault);
    await fs.ensureDir(secondVault);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const installed = await installGitHook(firstVault, { repoPath: repository });

    await expect(installGitHook(secondVault, { repoPath: repository })).rejects.toThrow(
      'already configured differently',
    );
    expect(await fs.readFile(installed.hookPath, 'utf8')).toContain(
      `health '${await fs.realpath(firstVault)}'`,
    );
  });

  it('preserves a modified ARC hook instead of removing it', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'vault');
    await fs.ensureDir(vault);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const installed = await installGitHook(vault, { repoPath: repository });
    await fs.appendFile(installed.hookPath, 'echo user-change\n');

    await expect(uninstallGitHook({ repoPath: repository })).rejects.toThrow(
      'not an intact ARC-managed hook',
    );
    expect(await fs.pathExists(installed.hookPath)).toBe(true);
  });

  it('rejects non-Git directories and custom Git hook locations', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'vault');
    const nonRepository = path.join(directory, 'not-a-repository');
    await fs.ensureDir(vault);
    await fs.ensureDir(nonRepository);
    await execFileSync('git', ['config', 'core.hooksPath', '.custom-hooks'], { cwd: repository });

    await expect(installGitHook(vault, { repoPath: nonRepository })).rejects.toThrow(
      'Git command failed',
    );
    await expect(installGitHook(vault, { repoPath: repository })).rejects.toThrow(
      'core.hooksPath is configured',
    );
    expect(await fs.pathExists(path.join(repository, '.custom-hooks', 'pre-commit'))).toBe(false);
  });

  it('rejects symlinked hook directories and hook files', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    const vault = path.join(directory, 'vault');
    const hooksDirectory = path.dirname(hookPath(repository));
    await fs.ensureDir(vault);
    const outsideHooks = path.join(directory, 'outside-hooks');
    await fs.ensureDir(outsideHooks);
    await fs.remove(hooksDirectory);
    await fs.symlink(outsideHooks, hooksDirectory);

    await expect(installGitHook(vault, { repoPath: repository })).rejects.toThrow(
      'Git hook path is outside the repository',
    );
    expect(await fs.readdir(outsideHooks)).toEqual([]);

    await fs.remove(hooksDirectory);
    await fs.mkdir(hooksDirectory);
    await fs.symlink(path.join(outsideHooks, 'user-hook'), hookPath(repository));
    await expect(uninstallGitHook({ repoPath: repository })).rejects.toThrow('not a regular file');
    expect(await fs.readdir(outsideHooks)).toEqual([]);
  });

  it('uses the Git-reported hook path for linked worktrees', async () => {
    const directory = await createTemporaryDirectory();
    const repository = await createRepository(directory);
    execFileSync(
      'git',
      [
        '-c',
        'user.name=ARC Test',
        '-c',
        'user.email=arc-test@example.invalid',
        'commit',
        '--allow-empty',
        '--quiet',
        '-m',
        'test: initialize hook integration repository',
      ],
      { cwd: repository },
    );
    const worktree = path.join(directory, 'worktree');
    execFileSync('git', ['worktree', 'add', '--detach', '--quiet', worktree, 'HEAD'], {
      cwd: repository,
    });
    const vault = path.join(directory, 'vault');
    await fs.ensureDir(vault);

    const expectedHookPath = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
      { cwd: worktree, encoding: 'utf8' },
    ).trim();
    const result = await installGitHook(vault, { repoPath: worktree, dryRun: true });

    expect(result.hookPath).toBe(path.join(expectedHookPath, 'pre-commit'));
  });
});
