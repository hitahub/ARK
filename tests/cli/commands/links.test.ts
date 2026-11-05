import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  reportLinkSuggestions,
  saveLinkSuggestionReport,
  suggestRelatedNotes,
} from '../../../src/cli/commands/links.js';

const temporaryDirectories: string[] = [];

async function createVault(): Promise<string> {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-links-'));
  temporaryDirectories.push(vault);
  await fs.mkdir(path.join(vault, '300_Slipbox'));
  return fs.realpath(vault);
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

describe('saveLinkSuggestionReport', () => {
  async function createOutputDirectory(): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-links-report-'));
    temporaryDirectories.push(directory);
    return fs.realpath(directory);
  }

  it('writes an exact deterministic Markdown report without machine-specific vault paths', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const result = {
      vaultPath: vault,
      noteCount: 2,
      candidates: [
        {
          leftPath: '300_Slipbox/01-graph.md',
          rightPath: '300_Slipbox/02-networks.md',
          similarity: 0.875,
          sharedTerms: ['graph', 'theory', 'nodes'],
        },
      ],
    };
    const firstOutput = path.join(outputDirectory, 'first.md');
    const secondOutput = path.join(outputDirectory, 'second.md');

    await saveLinkSuggestionReport(result, firstOutput);
    await saveLinkSuggestionReport(result, secondOutput);

    const report = [
      '# ARC Slipbox link suggestions',
      '',
      'Notes analyzed: 2',
      '',
      'Heuristic lexical matches only. These suggestions require manual review and do not establish that notes are meaningfully related. No notes or links were changed.',
      '',
      '## Candidates',
      '',
      '1. **87.5%** `300_Slipbox/01-graph.md` <-> `300_Slipbox/02-networks.md`',
      '   - Shared terms: graph, theory, nodes',
      '',
    ].join('\n');
    expect(await fs.readFile(firstOutput, 'utf8')).toBe(report);
    expect(await fs.readFile(secondOutput, 'utf8')).toBe(report);
    expect(report).not.toContain(vault);
    expect(await fs.readdir(vault)).toEqual(['300_Slipbox']);
  });

  it('writes a clear report when there are no candidates', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const outputPath = path.join(outputDirectory, 'empty.md');

    await saveLinkSuggestionReport({ vaultPath: vault, noteCount: 0, candidates: [] }, outputPath);

    expect(await fs.readFile(outputPath, 'utf8')).toBe(
      [
        '# ARC Slipbox link suggestions',
        '',
        'Notes analyzed: 0',
        '',
        'Heuristic lexical matches only. These suggestions require manual review and do not establish that notes are meaningfully related. No notes or links were changed.',
        '',
        '## Candidates',
        '',
        'No candidates met the minimum similarity and shared-term requirements.',
        '',
      ].join('\n'),
    );
  });

  it('rejects destinations inside the vault, missing parents, and symlinked parents', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const linkedDirectory = path.join(outputDirectory, 'linked');
    await fs.symlink(outputDirectory, linkedDirectory);
    const result = { vaultPath: vault, noteCount: 0, candidates: [] };

    await expect(saveLinkSuggestionReport(result, path.join(vault, 'report.md'))).rejects.toThrow(
      'outside the selected vault',
    );
    await expect(
      saveLinkSuggestionReport(result, path.join(outputDirectory, 'missing', 'report.md')),
    ).rejects.toThrow('must already exist');
    await expect(
      saveLinkSuggestionReport(result, path.join(linkedDirectory, 'report.md')),
    ).rejects.toThrow('non-symlink directory');
  });

  it('rejects existing files, directories, and symlinks without replacing their targets', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const existingFile = path.join(outputDirectory, 'existing.md');
    const existingDirectory = path.join(outputDirectory, 'directory');
    const linkPath = path.join(outputDirectory, 'link.md');
    await fs.writeFile(existingFile, 'keep this');
    await fs.mkdir(existingDirectory);
    await fs.symlink(existingFile, linkPath);
    const result = { vaultPath: vault, noteCount: 0, candidates: [] };

    await expect(saveLinkSuggestionReport(result, existingFile)).rejects.toThrow('already exists');
    await expect(saveLinkSuggestionReport(result, existingDirectory)).rejects.toThrow(
      'already exists',
    );
    await expect(saveLinkSuggestionReport(result, linkPath)).rejects.toThrow('already exists');

    expect(await fs.readFile(existingFile, 'utf8')).toBe('keep this');
    expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);
  });

  it('cleans up temporary output and reports write failures', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const outputPath = path.join(outputDirectory, 'report.md');
    vi.spyOn(fs, 'link').mockRejectedValue(Object.assign(new Error('disk error'), { code: 'EIO' }));

    await expect(
      saveLinkSuggestionReport({ vaultPath: vault, noteCount: 0, candidates: [] }, outputPath),
    ).rejects.toThrow('Unable to write the report (EIO): disk error');

    expect(await fs.readdir(outputDirectory)).toEqual([]);
  });

  it('does not replace a destination that appears before atomic publication', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const outputPath = path.join(outputDirectory, 'report.md');
    const link = fs.link.bind(fs);
    vi.spyOn(fs, 'link').mockImplementation(async (temporaryPath, destinationPath) => {
      await fs.writeFile(outputPath, 'created concurrently');
      return link(temporaryPath, destinationPath);
    });

    await expect(
      saveLinkSuggestionReport({ vaultPath: vault, noteCount: 0, candidates: [] }, outputPath),
    ).rejects.toThrow('already exists');

    expect(await fs.readFile(outputPath, 'utf8')).toBe('created concurrently');
    expect(await fs.readdir(outputDirectory)).toEqual(['report.md']);
  });

  it('surfaces temporary-file cleanup failures', async () => {
    const vault = await createVault();
    const outputDirectory = await createOutputDirectory();
    const outputPath = path.join(outputDirectory, 'report.md');
    vi.spyOn(fs, 'unlink').mockRejectedValue(
      Object.assign(new Error('cleanup error'), { code: 'EIO' }),
    );

    await expect(
      saveLinkSuggestionReport({ vaultPath: vault, noteCount: 0, candidates: [] }, outputPath),
    ).rejects.toThrow('Cleanup failed: Unable to remove the temporary report (EIO): cleanup error');
  });
});
