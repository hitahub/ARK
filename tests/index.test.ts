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

  it('registers a version option', () => {
    const program = createProgram();

    expect(program.options.some((option) => option.long === '--version')).toBe(true);
  });
});
