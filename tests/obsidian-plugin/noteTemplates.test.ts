import { describe, expect, it } from 'vitest';
import {
  createNoteContent,
  getAvailableNotePath,
  getNoteFolder,
  sanitizeNoteTitle,
} from '../../src/obsidian-plugin/noteTemplates.js';

describe('ARC note templates', () => {
  const now = new Date(2026, 9, 29, 16, 10, 41);

  it('creates concept notes using the ARC Slipbox metadata', () => {
    expect(createNoteContent('Atomic note', 'concept', now)).toContain(
      'id: 20261029161041\ntype: concept\ntags: []\ncreated: 2026-10-29',
    );
  });

  it('creates project and task notes with dashboard-compatible metadata', () => {
    expect(createNoteContent('Project note', 'project', now)).toContain(
      'type: project\nstatus: active',
    );
    expect(createNoteContent('Task note', 'task', now)).toContain(
      'type: task\nproject: ""\nphase: ""\nstatus: todo',
    );
  });

  it('routes note types to their ARC content layers', () => {
    expect(getNoteFolder('concept')).toBe('300_Slipbox');
    expect(getNoteFolder('project')).toBe('200_Projects');
    expect(getNoteFolder('task')).toBe('200_Projects');
  });

  it('sanitizes path separators and empty titles', () => {
    expect(sanitizeNoteTitle('  Plan/One: draft  ')).toBe('Plan-One- draft');
    expect(sanitizeNoteTitle('   ')).toBe('');
  });

  it('chooses a free filename instead of overwriting an existing note', () => {
    const existing = new Set(['200_Projects/Plan.md', '200_Projects/Plan 2.md']);

    expect(getAvailableNotePath('200_Projects', 'Plan', (path) => existing.has(path))).toBe(
      '200_Projects/Plan 3.md',
    );
  });
});
