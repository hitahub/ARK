import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveProject } from '../../../src/cli/commands/archive.js';

const temporaryDirectories: string[] = [];

async function createVault(): Promise<string> {
  const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-archive-'));
  temporaryDirectories.push(vault);
  const project = path.join(vault, '200_Projects', 'My Project');
  await fs.ensureDir(path.join(project, 'Phase_01'));
  await fs.writeFile(
    path.join(project, 'Project.md'),
    '---\ntype: project\nstatus: done # completed\ncustom: keep\n---\n\nSee [[Phase_01/]].\n',
  );
  await fs.writeFile(path.join(project, 'Phase_01', 'Task.md'), '---\ntype: task\n---\n');
  return vault;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

describe('archiveProject', () => {
  it('moves a completed project and changes only its index status', async () => {
    const vault = await createVault();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await archiveProject('My Project', vault, { yes: true });

    expect(result.archived).toBe(true);
    expect(await fs.pathExists(result.source)).toBe(false);
    expect(await fs.readFile(path.join(result.destination, 'Project.md'), 'utf8')).toBe(
      '---\ntype: project\nstatus: archived # completed\ncustom: keep\n---\n\nSee [[Phase_01/]].\n',
    );
    expect(await fs.pathExists(path.join(result.destination, 'Phase_01', 'Task.md'))).toBe(true);
  });

  it('previews without writing and leaves a declined project unchanged', async () => {
    const vault = await createVault();
    const confirmArchive = vi.fn().mockResolvedValue(false);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const preview = await archiveProject('My Project', vault, { dryRun: true });
    const cancelled = await archiveProject('My Project', vault, { confirmArchive });

    expect(preview.dryRun).toBe(true);
    expect(preview.archived).toBe(false);
    expect(confirmArchive).toHaveBeenCalledOnce();
    expect(cancelled.cancelled).toBe(true);
    expect(await fs.pathExists(preview.source)).toBe(true);
    expect(await fs.pathExists(path.join(vault, '900_Archive'))).toBe(false);
  });

  it('rejects destination collisions without changing either directory', async () => {
    const vault = await createVault();
    const destination = path.join(vault, '900_Archive', 'Projects', 'My Project');
    await fs.ensureDir(destination);
    await fs.writeFile(path.join(destination, 'keep.txt'), 'existing');

    await expect(archiveProject('My Project', vault, { yes: true })).rejects.toThrow(
      'Archive destination already exists',
    );

    expect(await fs.pathExists(path.join(vault, '200_Projects', 'My Project'))).toBe(true);
    expect(await fs.readFile(path.join(destination, 'keep.txt'), 'utf8')).toBe('existing');
  });

  it('requires a project index marked done', async () => {
    const vault = await createVault();
    const index = path.join(vault, '200_Projects', 'My Project', 'Project.md');
    await fs.writeFile(index, '---\ntype: project\nstatus: active\n---\n');

    await expect(archiveProject('My Project', vault, { yes: true })).rejects.toThrow(
      'status: done',
    );
    expect(await fs.pathExists(path.join(vault, '200_Projects', 'My Project'))).toBe(true);
  });

  it('updates project metadata with Windows line endings', async () => {
    const vault = await createVault();
    const index = path.join(vault, '200_Projects', 'My Project', 'Project.md');
    await fs.writeFile(index, '---\r\ntype: project\r\nstatus: done\r\n---\r\n');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await archiveProject('My Project', vault, { yes: true });

    expect(await fs.readFile(path.join(result.destination, 'Project.md'), 'utf8')).toBe(
      '---\r\ntype: project\r\nstatus: archived\r\n---\r\n',
    );
  });

  it('rejects invalid names and missing projects', async () => {
    const vault = await createVault();

    await expect(archiveProject('../My Project', vault, { yes: true })).rejects.toThrow(
      'Invalid project name',
    );
    await expect(archiveProject('Missing', vault, { yes: true })).rejects.toThrow(
      'Project directory does not exist',
    );
  });

  it('rejects symlinks inside the project tree', async () => {
    const vault = await createVault();
    const project = path.join(vault, '200_Projects', 'My Project');
    await fs.symlink(path.join(vault, 'outside'), path.join(project, 'linked'));

    await expect(archiveProject('My Project', vault, { yes: true })).rejects.toThrow(
      'containing a symlink',
    );
    expect(await fs.pathExists(project)).toBe(true);
  });

  it('restores the original project if updating its metadata fails', async () => {
    const vault = await createVault();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('simulated metadata write failure'));

    await expect(archiveProject('My Project', vault, { yes: true })).rejects.toThrow(
      'simulated metadata write failure',
    );

    const originalIndex = path.join(vault, '200_Projects', 'My Project', 'Project.md');
    expect(await fs.readFile(originalIndex, 'utf8')).toContain('status: done');
    expect(await fs.pathExists(path.join(vault, '900_Archive'))).toBe(false);
  });
});
