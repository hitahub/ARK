import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMissingError } from '../utils/fileSystem.js';
import { logger } from '../utils/logger.js';

const hookFileName = 'pre-commit';
const hookMarker = '# Managed by ARC CLI; remove with "arc hook uninstall".';

export interface GitHookOptions {
  repoPath?: string;
  dryRun?: boolean;
}

export interface GitHookResult {
  action: 'install' | 'uninstall';
  hookPath: string;
  changed: boolean;
  dryRun: boolean;
  vaultPath?: string;
}

interface GitRepository {
  root: string;
  gitDirectory: string;
  commonDirectory: string;
  hooksDirectory: string;
}

/**
 * Preview or install ARC's report-only health check as a pre-commit hook.
 *
 * @param targetPath Explicit vault directory to inspect before commits.
 * @param options Repository selection and preview settings.
 * @throws If the vault, repository, hook configuration, or hook location is unsafe.
 */
export async function installGitHook(
  targetPath: string,
  options: GitHookOptions = {},
): Promise<GitHookResult> {
  const vaultPath = await resolveVaultPath(targetPath);
  const repository = await resolveGitRepository(options.repoPath ?? process.cwd());
  const hookPath = path.join(repository.hooksDirectory, hookFileName);
  const allowedRoot = findContainingGitDirectory(repository, repository.hooksDirectory);
  await inspectHookDirectory(repository.hooksDirectory, allowedRoot, false);
  const cliEntryPoint = await resolveCliEntryPoint();
  const contents = createHookContents(vaultPath, process.execPath, cliEntryPoint);
  const existing = await readHookIfPresent(hookPath);

  if (existing !== undefined) {
    if (!isManagedHook(existing)) {
      throw new Error(`A pre-commit hook already exists and was left untouched: ${hookPath}`);
    }
    if (existing !== contents) {
      throw new Error(
        `An ARC pre-commit hook is already configured differently; remove it before reinstalling: ${hookPath}`,
      );
    }
    logger.info(`ARC pre-commit hook is already installed: ${hookPath}`);
    return {
      action: 'install',
      hookPath,
      vaultPath,
      changed: false,
      dryRun: options.dryRun ?? false,
    };
  }

  logger.info(`ARC pre-commit hook preview: ${hookPath}`);
  logger.info(`Vault health checks will run for: ${vaultPath}`);
  logger.warning('Health findings and operational errors will block commits.');
  if (options.dryRun) {
    logger.info('Dry run: no Git hook files were changed.');
    return { action: 'install', hookPath, vaultPath, changed: false, dryRun: true };
  }

  await inspectHookDirectory(repository.hooksDirectory, allowedRoot, true);
  try {
    await fs.writeFile(hookPath, contents, { encoding: 'utf8', mode: 0o755, flag: 'wx' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(
        `A pre-commit hook appeared during installation and was left untouched: ${hookPath}`,
      );
    }
    throw error;
  }

  logger.success(`Installed ARC pre-commit hook: ${hookPath}`);
  return { action: 'install', hookPath, vaultPath, changed: true, dryRun: false };
}

/**
 * Preview or remove only an intact pre-commit hook created by ARC.
 *
 * @param options Repository selection and preview settings.
 * @throws If the repository or hook location is unsafe, or another hook is present.
 */
export async function uninstallGitHook(options: GitHookOptions = {}): Promise<GitHookResult> {
  const repository = await resolveGitRepository(options.repoPath ?? process.cwd());
  const hookPath = path.join(repository.hooksDirectory, hookFileName);
  const allowedRoot = findContainingGitDirectory(repository, repository.hooksDirectory);
  await inspectHookDirectory(repository.hooksDirectory, allowedRoot, false);
  const existing = await readHookIfPresent(hookPath);

  if (existing === undefined) {
    logger.info(`No pre-commit hook is installed: ${hookPath}`);
    return { action: 'uninstall', hookPath, changed: false, dryRun: options.dryRun ?? false };
  }
  if (!isManagedHook(existing)) {
    throw new Error(
      `The pre-commit hook is not an intact ARC-managed hook and was left untouched: ${hookPath}`,
    );
  }

  logger.info(`ARC pre-commit hook removal preview: ${hookPath}`);
  if (options.dryRun) {
    logger.info('Dry run: no Git hook files were changed.');
    return { action: 'uninstall', hookPath, changed: false, dryRun: true };
  }

  await fs.unlink(hookPath);
  logger.success(`Removed ARC pre-commit hook: ${hookPath}`);
  return { action: 'uninstall', hookPath, changed: true, dryRun: false };
}

async function resolveVaultPath(targetPath: string): Promise<string> {
  if (!targetPath) {
    throw new Error('A vault path is required when installing the ARC Git hook.');
  }
  const vaultPath = await fs.realpath(path.resolve(targetPath));
  const stats = await fs.stat(vaultPath);
  if (!stats.isDirectory()) {
    throw new Error(`Vault path is not a directory: ${vaultPath}`);
  }
  return vaultPath;
}

async function resolveGitRepository(targetPath: string): Promise<GitRepository> {
  const absolutePath = path.resolve(targetPath);
  const stats = await fs.stat(absolutePath).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (!stats?.isDirectory()) {
    throw new Error(`Git repository path is not a directory: ${absolutePath}`);
  }
  const workingDirectory = await fs.realpath(absolutePath);
  const root = await runGit(['rev-parse', '--show-toplevel'], workingDirectory);
  const gitDirectory = await fs.realpath(
    await runGit(['rev-parse', '--absolute-git-dir'], workingDirectory),
  );
  const commonDirectoryOutput = await runGit(['rev-parse', '--git-common-dir'], workingDirectory);
  const commonDirectory = await fs.realpath(path.resolve(root, commonDirectoryOutput));
  const hooksDirectoryOutput = await runGit(
    ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
    workingDirectory,
  );
  const hooksDirectory = path.resolve(hooksDirectoryOutput);

  const hooksPathSetting = runGitForConfig(workingDirectory, 'core.hooksPath');
  if (hooksPathSetting !== undefined) {
    throw new Error(
      `Git core.hooksPath is configured (${hooksPathSetting}); ARC will not change or use custom hook locations.`,
    );
  }

  const repository = { root, gitDirectory, commonDirectory, hooksDirectory };
  findContainingGitDirectory(repository, hooksDirectory);
  return repository;
}

function runGit(arguments_: string[], cwd: string): string {
  const result = runGitProcess(arguments_, cwd);
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.status}`;
    throw new Error(`Git command failed (${arguments_.join(' ')}): ${detail}`);
  }
  return result.stdout.trim();
}

function runGitForConfig(cwd: string, key: string): string | undefined {
  const result = runGitProcess(['config', '--get', key], cwd);
  if (result.status === 1) return undefined;
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.status}`;
    throw new Error(`Unable to read Git ${key} configuration: ${detail}`);
  }
  return result.stdout.trim();
}

function runGitProcess(arguments_: string[], cwd: string) {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_COMMON_DIR;
  const result = spawnSync('git', arguments_, { cwd, encoding: 'utf8', env });
  if (result.error) {
    throw new Error(`Unable to run Git: ${result.error.message}`, { cause: result.error });
  }
  return result;
}

function findContainingGitDirectory(repository: GitRepository, target: string): string {
  for (const root of [repository.commonDirectory, repository.gitDirectory]) {
    if (isPathWithin(root, target)) return root;
  }
  throw new Error(`Git hook path is outside the repository's Git directories: ${target}`);
}

function isPathWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

async function inspectHookDirectory(
  directory: string,
  allowedRoot: string,
  createMissing: boolean,
): Promise<void> {
  const relative = path.relative(allowedRoot, directory);
  let current = allowedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stats = await fs.lstat(current).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (!stats) {
      if (createMissing) await fs.mkdir(current);
      continue;
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Git hook directory is not a safe directory: ${current}`);
    }
  }
}

async function readHookIfPresent(hookPath: string): Promise<string | undefined> {
  const stats = await fs.lstat(hookPath).catch((error: unknown) => {
    if (isMissingError(error)) return undefined;
    throw error;
  });
  if (!stats) return undefined;
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(
      `Pre-commit hook path is not a regular file and was left untouched: ${hookPath}`,
    );
  }
  return fs.readFile(hookPath, 'utf8');
}

function createHookContents(vaultPath: string, nodePath: string, cliEntryPoint: string): string {
  const body = `exec ${shellQuote(nodePath)} ${shellQuote(cliEntryPoint)} health ${shellQuote(vaultPath)}\n`;
  const digest = createHash('sha256').update(body).digest('hex');
  return `#!/bin/sh\n${hookMarker}\n# ARC-SHA256: ${digest}\n${body}`;
}

function isManagedHook(contents: string): boolean {
  const match = contents.match(
    /^#!\/bin\/sh\n# Managed by ARC CLI; remove with "arc hook uninstall"\.\n# ARC-SHA256: ([a-f\d]{64})\n([\s\S]*)$/,
  );
  return match !== null && createHash('sha256').update(match[2]).digest('hex') === match[1];
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function resolveCliEntryPoint(): Promise<string> {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const entryPoint = path.join(directory, 'bin', 'cli.mjs');
    const stats = await fs.stat(entryPoint).catch((error: unknown) => {
      if (isMissingError(error)) return undefined;
      throw error;
    });
    if (stats?.isFile()) return entryPoint;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error('Unable to locate the ARC CLI entry point for the Git hook.');
}
