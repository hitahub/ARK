import { describe, expect, it } from 'vitest';
import { findInvalidMessages } from '../../scripts/check-conventional-commits.mjs';

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
});
