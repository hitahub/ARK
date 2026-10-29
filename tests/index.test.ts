import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/index.js';

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

  it('registers a version option', () => {
    const program = createProgram();

    expect(program.options.some((option) => option.long === '--version')).toBe(true);
  });
});
