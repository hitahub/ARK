import { describe, expect, it } from 'vitest';
import { findUnresolvedWikilinks } from '../../src/obsidian-plugin/wikilinks.js';

describe('unresolved wikilink diagnostics', () => {
  it('reports unresolved links and preserves their source offsets', () => {
    const text = 'See [[Existing]] and ![[Missing#Heading|label]].';

    expect(findUnresolvedWikilinks(text, (target) => target === 'Existing')).toEqual([
      {
        target: 'Missing',
        start: text.indexOf('![[Missing'),
        end: text.indexOf(']].', text.indexOf('![[Missing')) + 2,
      },
    ]);
  });

  it('ignores empty targets and fully resolved links', () => {
    expect(findUnresolvedWikilinks('[[]] [[Resolved]]', (target) => target === 'Resolved')).toEqual(
      [],
    );
  });
});
