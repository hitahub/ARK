import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectVaultHealth } from '../../src/commands/health.js';
import { initializeVault } from '../../src/commands/init.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-health-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('inspectVaultHealth', () => {
  it('reports unresolved internal links, orphan notes, and structure issues', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', { cwd: parent, now: () => new Date(2032, 0, 1) });
    await fs.writeFile(
      path.join(target, '300_Slipbox/Source.md'),
      '[[Target Note|the target]] and [[Missing Note]]',
    );
    await fs.writeFile(path.join(target, '300_Slipbox/Target Note.md'), 'A referenced concept.');
    await fs.writeFile(path.join(target, '400_Journal/2032/Orphan.md'), 'No incoming links.');
    await fs.remove(path.join(target, '000_Atlas/Dashboard.md'));

    const result = await inspectVaultHealth(target);

    expect(result.healthy).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: 'broken-link',
        path: '300_Slipbox/Source.md',
        message: 'Unresolved internal link: Missing Note',
      }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({ type: 'orphan-note', path: '400_Journal/2032/Orphan.md' }),
    );
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: 'structure',
        message: 'Missing required file: 000_Atlas/Dashboard.md',
      }),
    );
    expect(
      result.findings.some(
        (finding) =>
          finding.type === 'orphan-note' && finding.path === '300_Slipbox/Target Note.md',
      ),
    ).toBe(false);
  });

  it('ignores external links, code examples, templates, and linked notes', async () => {
    const parent = await createTemporaryDirectory();
    const target = path.join(parent, 'vault');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await initializeVault('./vault', { cwd: parent, now: () => new Date(2032, 0, 1) });
    await fs.writeFile(
      path.join(target, '300_Slipbox/Source.md'),
      '[external](https://example.com) `[[not a link]]` [[Nested Note]]',
    );
    await fs.ensureDir(path.join(target, '300_Slipbox'));
    await fs.writeFile(path.join(target, '300_Slipbox/Nested Note.md'), 'Referenced.');

    const result = await inspectVaultHealth(target);

    expect(result.findings.filter((finding) => finding.type === 'broken-link')).toEqual([]);
    expect(
      result.findings.some(
        (finding) =>
          finding.type === 'orphan-note' && finding.path === '300_Slipbox/Nested Note.md',
      ),
    ).toBe(false);
  });
});
