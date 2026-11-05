import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../src/cli/index.js';

describe('CLI routing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('routes init with a target path', async () => {
    const initialize = vi.fn().mockResolvedValue({ created: [], skipped: [] });
    const program = createProgram({ initialize }).exitOverride();

    await program.parseAsync(['node', 'arc', 'init', './vault']);

    expect(initialize).toHaveBeenCalledWith('./vault', undefined);
  });

  it('routes init dry-run without overriding injected options', async () => {
    const initialize = vi.fn().mockResolvedValue({ created: [], skipped: [], dryRun: true });
    const program = createProgram({
      initialize,
      initOptions: { cwd: '/vault-parent' },
    }).exitOverride();

    await program.parseAsync(['node', 'arc', 'init', './vault', '--dry-run']);

    expect(initialize).toHaveBeenCalledWith('./vault', { cwd: '/vault-parent', dryRun: true });
  });

  it('routes init with plugin installation disabled', async () => {
    const initialize = vi.fn().mockResolvedValue({ created: [], skipped: [] });
    const program = createProgram({ initialize }).exitOverride();

    await program.parseAsync(['node', 'arc', 'init', './vault', '--no-plugin']);

    expect(initialize).toHaveBeenCalledWith('./vault', { installPlugin: false });
  });

  it('routes verify and sets failure status for invalid vaults', async () => {
    const verify = vi.fn().mockResolvedValue({
      valid: false,
      issues: ['Missing required directory: 000_Atlas'],
    });
    const program = createProgram({ verify }).exitOverride();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await program.parseAsync(['node', 'arc', 'verify', './vault']);

    expect(verify).toHaveBeenCalledWith('./vault');
    expect(process.exitCode).toBe(1);
  });

  it('routes health and sets failure status when findings exist', async () => {
    const health = vi.fn().mockResolvedValue({
      healthy: false,
      findings: [{ type: 'orphan-note', path: 'note.md', message: 'No inbound links.' }],
    });
    const program = createProgram({ health }).exitOverride();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await program.parseAsync(['node', 'arc', 'health', './vault']);

    expect(health).toHaveBeenCalledWith('./vault');
    expect(process.exitCode).toBe(1);
  });

  it('routes the explicitly selected vault to the MCP server', async () => {
    const mcp = vi.fn().mockResolvedValue(undefined);
    const program = createProgram({ mcp }).exitOverride();

    await program.parseAsync(['node', 'arc', 'mcp', '/vault']);

    expect(mcp).toHaveBeenCalledWith('/vault');
  });

  it('routes link suggestions for the explicitly selected vault', async () => {
    const suggestLinks = vi.fn().mockResolvedValue({
      vaultPath: '/vault',
      noteCount: 0,
      candidates: [],
    });
    const saveLinks = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const program = createProgram({ suggestLinks, saveLinks }).exitOverride();

    await program.parseAsync(['node', 'arc', 'links', 'suggest', '/vault']);

    expect(suggestLinks).toHaveBeenCalledWith('/vault');
    expect(saveLinks).not.toHaveBeenCalled();
  });

  it('saves link suggestions when an output file is requested', async () => {
    const result = {
      vaultPath: '/vault',
      noteCount: 0,
      candidates: [],
    };
    const suggestLinks = vi.fn().mockResolvedValue(result);
    const saveLinks = vi.fn().mockResolvedValue(undefined);
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const program = createProgram({ suggestLinks, saveLinks }).exitOverride();

    await program.parseAsync([
      'node',
      'arc',
      'links',
      'suggest',
      '/vault',
      '--output',
      '/reports/suggestions.md',
    ]);

    expect(suggestLinks).toHaveBeenCalledWith('/vault');
    expect(saveLinks).toHaveBeenCalledWith(result, '/reports/suggestions.md');
    expect(stdout).toHaveBeenCalledWith('ARC Slipbox link suggestions (0 notes): /vault');
    expect(stderr).toHaveBeenCalledWith('Saved link suggestion report to /reports/suggestions.md');
  });

  it('reports the stdout results but does not hide a requested save failure', async () => {
    const suggestLinks = vi.fn().mockResolvedValue({
      vaultPath: '/vault',
      noteCount: 0,
      candidates: [],
    });
    const saveLinks = vi.fn().mockRejectedValue(new Error('destination exists'));
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const program = createProgram({ suggestLinks, saveLinks }).exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'arc',
        'links',
        'suggest',
        '/vault',
        '--output',
        '/reports/suggestions.md',
      ]),
    ).rejects.toThrow('destination exists');

    expect(stdout).toHaveBeenCalledWith('ARC Slipbox link suggestions (0 notes): /vault');
    expect(stderr).not.toHaveBeenCalledWith(
      'Saved link suggestion report to /reports/suggestions.md',
    );
  });

  it('routes publish selections, output, exclusions, and preview options', async () => {
    const publish = vi.fn().mockResolvedValue({
      vaultPath: '/vault',
      outputPath: '/exports/review',
      included: ['200_Projects/Project.md'],
      excluded: [],
      published: false,
      dryRun: true,
    });
    const program = createProgram({ publish }).exitOverride();

    await program.parseAsync([
      'node',
      'arc',
      'publish',
      '/vault',
      '200_Projects/Project.md',
      '--output',
      '/exports/review',
      '--exclude',
      '200_Projects/private',
      '--dry-run',
    ]);

    expect(publish).toHaveBeenCalledWith('/vault', ['200_Projects/Project.md'], {
      outputPath: '/exports/review',
      exclude: ['200_Projects/private'],
      dryRun: true,
    });
  });

  it('routes update with explicit non-interactive confirmation', async () => {
    const update = vi.fn().mockResolvedValue({
      updated: [],
      created: [],
      unchanged: [],
    });
    const program = createProgram({ update }).exitOverride();

    await program.parseAsync(['node', 'arc', 'update', './vault', '--yes']);

    expect(update).toHaveBeenCalledWith('./vault', { yes: true });
  });

  it('routes archive with preview and confirmation options', async () => {
    const archive = vi.fn().mockResolvedValue({
      source: '/vault/200_Projects/Project',
      destination: '/vault/900_Archive/Projects/Project',
      archived: false,
      dryRun: true,
    });
    const program = createProgram({ archive }).exitOverride();

    await program.parseAsync(['node', 'arc', 'archive', 'Project', './vault', '--dry-run']);

    expect(archive).toHaveBeenCalledWith('Project', './vault', { dryRun: true });
  });

  it('routes hook installation with the selected vault and repository', async () => {
    const installHook = vi.fn().mockResolvedValue({
      action: 'install',
      hookPath: '/repo/.git/hooks/pre-commit',
      vaultPath: '/vault',
      changed: false,
      dryRun: true,
    });
    const program = createProgram({ installHook }).exitOverride();

    await program.parseAsync([
      'node',
      'arc',
      'hook',
      'install',
      '/vault',
      '--repo',
      '/repo',
      '--dry-run',
    ]);

    expect(installHook).toHaveBeenCalledWith('/vault', {
      repoPath: '/repo',
      dryRun: true,
    });
  });

  it('routes hook removal with preview options', async () => {
    const uninstallHook = vi.fn().mockResolvedValue({
      action: 'uninstall',
      hookPath: '/repo/.git/hooks/pre-commit',
      changed: false,
      dryRun: true,
    });
    const program = createProgram({ uninstallHook }).exitOverride();

    await program.parseAsync(['node', 'arc', 'hook', 'uninstall', '--repo', '/repo', '--dry-run']);

    expect(uninstallHook).toHaveBeenCalledWith({ repoPath: '/repo', dryRun: true });
  });

  it('registers a version option', () => {
    const program = createProgram();

    expect(program.options.some((option) => option.long === '--version')).toBe(true);
  });
});
