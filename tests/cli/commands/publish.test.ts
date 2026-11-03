import fs from 'fs-extra';
import os from 'node:os';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishSelectedContent } from '../../../src/cli/commands/publish.js';

const temporaryDirectories: string[] = [];

async function createWorkspace(): Promise<{ root: string; vault: string; outputParent: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-publish-'));
  temporaryDirectories.push(root);
  const vault = path.join(root, 'vault');
  const outputParent = path.join(root, 'exports');
  await fs.ensureDir(vault);
  await fs.ensureDir(outputParent);
  return { root, vault, outputParent };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('publishSelectedContent', () => {
  it('previews explicit selections, exclusions, and sanitized output without writing', async () => {
    const { vault, outputParent } = await createWorkspace();
    const project = path.join(vault, '200_Projects', 'Selected');
    await fs.ensureDir(path.join(project, 'private'));
    await fs.ensureDir(path.join(project, '999_Templates'));
    await fs.ensureDir(path.join(project, '.obsidian'));
    const original =
      '---\ntype: project\nstatus: active\ncustom: remove me\n---\n\n# Selected\n\nReview this note.';
    await fs.writeFile(path.join(project, 'Project.md'), original);
    await fs.writeFile(
      path.join(project, 'private', 'Personal.md'),
      '---\nprivate: true\n---\nPrivate content.',
    );
    await fs.writeFile(path.join(project, '999_Templates', 'Template.md'), '# Template');
    await fs.writeFile(path.join(project, '.obsidian', 'Settings.md'), '# Settings');
    const output = path.join(outputParent, 'review');

    const result = await publishSelectedContent(vault, ['200_Projects/Selected'], {
      outputPath: output,
      exclude: ['200_Projects/Selected/private'],
      dryRun: true,
    });

    expect(result).toMatchObject({
      included: ['200_Projects/Selected/Project.md'],
      excluded: [
        '200_Projects/Selected/.obsidian',
        '200_Projects/Selected/999_Templates',
        '200_Projects/Selected/private',
      ],
      published: false,
      dryRun: true,
    });
    expect(await fs.pathExists(output)).toBe(false);
    expect(await fs.readFile(path.join(project, 'Project.md'), 'utf8')).toBe(original);
  });

  it('writes selected notes only after approval and removes all frontmatter', async () => {
    const { vault, outputParent } = await createWorkspace();
    const project = path.join(vault, '200_Projects', 'Selected');
    await fs.ensureDir(path.join(project, 'Phase_01'));
    await fs.writeFile(
      path.join(project, 'Project.md'),
      '---\ntype: project\ntags: [public]\n---\n\n# Project\n',
    );
    await fs.writeFile(path.join(project, 'Phase_01', 'Task.md'), '# Task\n');
    const confirmPublish = vi.fn().mockResolvedValue(true);

    const result = await publishSelectedContent(vault, ['200_Projects/Selected'], {
      outputPath: path.join(outputParent, 'review'),
      confirmPublish,
    });

    expect(result.published).toBe(true);
    expect(confirmPublish).toHaveBeenCalledOnce();
    expect(
      await fs.readFile(path.join(result.outputPath, '200_Projects/Selected/Project.md'), 'utf8'),
    ).toBe('# Project\n');
    expect(
      await fs.readFile(
        path.join(result.outputPath, '200_Projects/Selected/Phase_01/Task.md'),
        'utf8',
      ),
    ).toBe('# Task\n');
    expect(await fs.readFile(path.join(project, 'Project.md'), 'utf8')).toContain('tags: [public]');
  });

  it('leaves the output absent when the user declines', async () => {
    const { vault, outputParent } = await createWorkspace();
    await fs.writeFile(path.join(vault, 'note.md'), '# Note\n');
    const output = path.join(outputParent, 'review');

    const result = await publishSelectedContent(vault, ['note.md'], {
      outputPath: output,
      confirmPublish: vi.fn().mockResolvedValue(false),
    });

    expect(result.cancelled).toBe(true);
    expect(await fs.pathExists(output)).toBe(false);
  });

  it.each([
    ['private: true', 'private or sensitive'],
    ['publish: false', 'publish: false'],
    ['visibility: maybe', 'Ambiguous privacy metadata'],
    ['tags: [public, confidential]', 'privacy-sensitive tag'],
    ['private: "unknown"', 'Ambiguous privacy metadata'],
  ])('fails closed for privacy metadata (%s)', async (metadata, expectedError) => {
    const { vault, outputParent } = await createWorkspace();
    await fs.writeFile(path.join(vault, 'note.md'), `---\n${metadata}\n---\n\n# Note`);

    await expect(
      publishSelectedContent(vault, ['note.md'], {
        outputPath: path.join(outputParent, 'review'),
        dryRun: true,
      }),
    ).rejects.toThrow(expectedError);
  });

  it('rejects malformed frontmatter rather than exporting an ambiguous note', async () => {
    const { vault, outputParent } = await createWorkspace();
    await fs.writeFile(path.join(vault, 'note.md'), '---\nprivate: true\n\n# Note');

    await expect(
      publishSelectedContent(vault, ['note.md'], {
        outputPath: path.join(outputParent, 'review'),
        dryRun: true,
      }),
    ).rejects.toThrow('missing closing delimiter');
  });

  it('rejects unsafe selections and output locations before writing', async () => {
    const { vault, outputParent } = await createWorkspace();
    await fs.writeFile(path.join(vault, 'note.md'), '# Note');
    await fs.symlink(path.join(vault, 'note.md'), path.join(vault, 'linked.md'));
    const existing = path.join(outputParent, 'existing');
    await fs.ensureDir(existing);

    await expect(
      publishSelectedContent(vault, ['../note.md'], {
        outputPath: path.join(outputParent, 'traversal'),
        dryRun: true,
      }),
    ).rejects.toThrow('unsafe path');
    await expect(
      publishSelectedContent(vault, ['linked.md'], {
        outputPath: path.join(outputParent, 'symlink'),
        dryRun: true,
      }),
    ).rejects.toThrow('Symlinks are not allowed');
    await expect(
      publishSelectedContent(vault, ['note.md'], {
        outputPath: path.join(vault, 'inside'),
        dryRun: true,
      }),
    ).rejects.toThrow('outside the source vault');
    await expect(
      publishSelectedContent(vault, ['note.md'], { outputPath: existing, dryRun: true }),
    ).rejects.toThrow('refusing to overwrite');
  });

  it('rolls back files created in the output if a later write fails', async () => {
    const { vault, outputParent } = await createWorkspace();
    await fs.ensureDir(path.join(vault, 'collection'));
    await fs.writeFile(path.join(vault, 'collection', 'a.md'), '# A');
    await fs.writeFile(path.join(vault, 'collection', 'b.md'), '# B');
    const output = path.join(outputParent, 'review');
    const originalOpen = fsPromises.open.bind(fsPromises);
    vi.spyOn(fsPromises, 'open').mockImplementation(async (filePath, ...args) => {
      if (String(filePath).endsWith(`${path.sep}b.md`)) {
        throw new Error('simulated output failure');
      }
      return originalOpen(filePath, ...args);
    });

    await expect(
      publishSelectedContent(vault, ['collection'], {
        outputPath: output,
        yes: true,
      }),
    ).rejects.toThrow('simulated output failure');
    expect(await fs.pathExists(output)).toBe(false);
  });
});
