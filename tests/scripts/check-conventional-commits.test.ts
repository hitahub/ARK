import { describe, expect, it } from 'vitest';
import {
  findInvalidCommitSubjects,
  findInvalidMessages,
  getCommitSubjects,
} from '../../scripts/check-conventional-commits.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

describe('Conventional Commit validation', () => {
  it('accepts supported types, scopes, and breaking change markers', () => {
    expect(
      findInvalidMessages([
        'feat(cli): add archive command',
        'fix!: reject unsafe archive paths',
        'docs(plans.lifecycle): define archive behavior',
      ]),
    ).toEqual([]);
  });

  it('reports commit subjects and PR titles that do not match the ruleset', () => {
    expect(findInvalidMessages(['Add archive command', 'feature: add archive command'])).toEqual([
      'Add archive command',
      'feature: add archive command',
    ]);
  });

  it('keeps generated Agent Host subjects exempt only for commit validation', () => {
    expect(findInvalidMessages(['Agent Host changes for feat/git-hook-integration'])).toEqual([
      'Agent Host changes for feat/git-hook-integration',
    ]);
    expect(
      findInvalidCommitSubjects([
        'Agent Host changes for feat/git-hook-integration',
        'Agent Host changes for an invalid branch!',
        'Add archive command',
      ]),
    ).toEqual(['Agent Host changes for an invalid branch!', 'Add archive command']);
  });

  it('limits a new-branch push to commits after the default-branch merge base', async () => {
    const repository = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-commit-check-'));
    try {
      execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: repository });
      execFileSync('git', ['config', 'user.name', 'ARC Test'], { cwd: repository });
      execFileSync('git', ['config', 'user.email', 'arc-test@example.invalid'], {
        cwd: repository,
      });
      await fs.writeFile(path.join(repository, 'base.txt'), 'base');
      execFileSync('git', ['add', 'base.txt'], { cwd: repository });
      execFileSync('git', ['commit', '--quiet', '-m', 'chore: create base'], { cwd: repository });
      execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'main'], {
        cwd: repository,
      });
      execFileSync('git', ['checkout', '--quiet', '-b', 'feature/test'], { cwd: repository });
      await fs.writeFile(path.join(repository, 'feature.txt'), 'feature');
      execFileSync('git', ['add', 'feature.txt'], { cwd: repository });
      execFileSync('git', ['commit', '--quiet', '-m', 'feat: add feature'], { cwd: repository });

      expect(
        getCommitSubjects('0000000000000000000000000000000000000000', 'HEAD', 'main', repository),
      ).toEqual(['feat: add feature']);
    } finally {
      await fs.remove(repository);
    }
  });
});
