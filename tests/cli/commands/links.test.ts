import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportLinkSuggestions, suggestRelatedNotes } from '../../../src/cli/commands/links.js';

const temporaryDirectories: string[] = [];

async function createVault(): Promise<string> {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-links-'));
  temporaryDirectories.push(vault);
  await fs.mkdir(path.join(vault, '300_Slipbox'));
  return vault;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })),
  );
});

describe('suggestRelatedNotes', () => {
  it('ranks related direct Slipbox notes deterministically without changing source notes', async () => {
    const vault = await createVault();
    const slipbox = path.join(vault, '300_Slipbox');
    const source =
      '# Graph Theory\n\nGraph theory studies networks, nodes, and edges. Graphs model networks.';
    const related =
      '# Network Graphs\n\nGraph theory uses nodes and edges to describe network structures.';
    await fs.writeFile(path.join(slipbox, '01-graph.md'), source);
    await fs.writeFile(path.join(slipbox, '02-networks.md'), related);
    await fs.writeFile(
      path.join(slipbox, '03-baking.md'),
      '# Baking\n\nSourdough bread fermentation uses flour and yeast.',
    );
    await fs.writeFile(
      path.join(slipbox, '04-metadata.md'),
      '---\ntags: [graph, networks, nodes, edges]\n---\n\n# Cooking\n\nRecipes and ingredients.',
    );
    await fs.mkdir(path.join(slipbox, 'nested'));
    await fs.writeFile(path.join(slipbox, 'nested', 'ignored.md'), source);
    await fs.writeFile(path.join(slipbox, '.hidden.md'), source);

    const result = await suggestRelatedNotes(vault);

    expect(result.noteCount).toBe(4);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      leftPath: '300_Slipbox/01-graph.md',
      rightPath: '300_Slipbox/02-networks.md',
    });
    expect(result.candidates[0].sharedTerms).toEqual(
      expect.arrayContaining(['graph', 'theory', 'nodes', 'edges']),
    );
    expect(await fs.readFile(path.join(slipbox, '01-graph.md'), 'utf8')).toBe(source);
    expect(await fs.readFile(path.join(slipbox, '02-networks.md'), 'utf8')).toBe(related);

    const repeated = await suggestRelatedNotes(vault);
    expect(repeated.candidates).toEqual(result.candidates);
  });

  it('rejects symlinks in the selected Slipbox', async () => {
    const vault = await createVault();
    const outside = path.join(vault, 'outside.md');
    await fs.writeFile(outside, '# Outside\n');
    await fs.symlink(outside, path.join(vault, '300_Slipbox', 'linked.md'));

    await expect(suggestRelatedNotes(vault)).rejects.toThrow('Symlinks are not allowed');
  });

  it('requires an explicitly selected non-symlink vault directory', async () => {
    const vault = await createVault();
    const alias = `${vault}-alias`;
    await fs.symlink(vault, alias);
    temporaryDirectories.push(alias);

    await expect(suggestRelatedNotes('')).rejects.toThrow('Provide an explicit vault directory');
    await expect(suggestRelatedNotes(alias)).rejects.toThrow('non-symlink directory');
  });

  it('rejects notes over the per-note size limit', async () => {
    const vault = await createVault();
    await fs.writeFile(path.join(vault, '300_Slipbox', 'oversized.md'), 'x'.repeat(65_537));

    await expect(suggestRelatedNotes(vault)).rejects.toThrow('content limit');
  });

  it('rejects Slipboxes beyond the note scan limit instead of silently truncating', async () => {
    const vault = await createVault();
    const slipbox = path.join(vault, '300_Slipbox');
    await Promise.all(
      Array.from({ length: 501 }, (_, index) =>
        fs.writeFile(path.join(slipbox, `note-${index}.md`), 'A short note.'),
      ),
    );

    await expect(suggestRelatedNotes(vault)).rejects.toThrow('500-note limit');
  });

  it('rejects corpora beyond the unique-term limit', async () => {
    const vault = await createVault();
    const slipbox = path.join(vault, '300_Slipbox');
    await Promise.all(
      Array.from({ length: 11 }, (_, noteIndex) => {
        const terms = Array.from(
          { length: 10_000 },
          (_, termIndex) => `x${noteIndex.toString(36)}${termIndex.toString(36)}`,
        ).join(' ');
        return fs.writeFile(path.join(slipbox, `note-${noteIndex}.md`), terms);
      }),
    );

    await expect(suggestRelatedNotes(vault)).rejects.toThrow('100000-unique-term limit');
  });

  it('rejects corpora beyond the term-pair comparison limit', async () => {
    const vault = await createVault();
    const slipbox = path.join(vault, '300_Slipbox');
    const sharedTerms = 'alpha beta gamma delta epsilon zeta eta theta iota';
    await Promise.all(
      Array.from({ length: 500 }, (_, index) =>
        fs.writeFile(path.join(slipbox, `note-${index}.md`), sharedTerms),
      ),
    );

    await expect(suggestRelatedNotes(vault)).rejects.toThrow('1000000-comparison work limit');
  });

  it('prints at most 20 ranked candidate pairs', async () => {
    const vault = await createVault();
    const slipbox = path.join(vault, '300_Slipbox');
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        fs.writeFile(
          path.join(slipbox, `note-${index + 1}.md`),
          '# Shared Topic\n\nShared concepts connect related topics.',
        ),
      ),
    );

    const result = await suggestRelatedNotes(vault);
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    reportLinkSuggestions(result);

    expect(result.candidates).toHaveLength(20);
    expect(result.candidates[0]).toMatchObject({
      leftPath: '300_Slipbox/note-1.md',
      rightPath: '300_Slipbox/note-2.md',
    });
    expect(output).toHaveBeenCalledTimes(22);
    expect(output).toHaveBeenCalledWith(
      expect.stringMatching(/^1\. \d+\.\d% 300_Slipbox\/note-1\.md <-> 300_Slipbox\/note-2\.md/),
    );
    expect(output).toHaveBeenCalledWith(
      'Heuristic lexical matches only; review each candidate. No notes were changed.',
    );
  });

  it('prints the review reminder and handles an empty candidate set', async () => {
    const vault = await createVault();
    await fs.writeFile(path.join(vault, '300_Slipbox', 'note.md'), '# One note');
    const result = await suggestRelatedNotes(vault);
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    reportLinkSuggestions(result);

    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('No candidates met the minimum similarity'),
    );
  });
});
