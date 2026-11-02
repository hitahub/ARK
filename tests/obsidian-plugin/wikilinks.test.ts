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

  it('ignores wikilinks inside fenced code and preserves offsets around them', () => {
    const text = [
      '[[Before]]',
      '```markdown',
      '[[Backtick fenced]]',
      '```',
      '   ~~~~ts',
      '![[Tilde fenced|embed]]',
      '   ~~~~',
      '[[After]]',
    ].join('\n');

    expect(findUnresolvedWikilinks(text, () => false)).toEqual([
      { target: 'Before', start: text.indexOf('[[Before]]'), end: text.indexOf('[[Before]]') + 10 },
      { target: 'After', start: text.indexOf('[[After]]'), end: text.indexOf('[[After]]') + 9 },
    ]);
  });

  it('ignores inline code spans with matching backtick delimiters', () => {
    const text = 'Use `[[inline]]` and ``code `[[nested]]` `` before [[real]].';

    expect(findUnresolvedWikilinks(text, () => false)).toEqual([
      { target: 'real', start: text.indexOf('[[real]]'), end: text.indexOf('[[real]]') + 8 },
    ]);
  });

  it('does not mask unmatched or escaped backtick delimiters', () => {
    const unmatched = 'Unmatched ` delimiter [[visible]]';
    const escaped = 'Escaped \\`[[also visible]]';

    expect(findUnresolvedWikilinks(unmatched, () => false)).toEqual([
      {
        target: 'visible',
        start: unmatched.indexOf('[[visible]]'),
        end: unmatched.indexOf('[[visible]]') + 11,
      },
    ]);
    expect(findUnresolvedWikilinks(escaped, () => false)).toEqual([
      {
        target: 'also visible',
        start: escaped.indexOf('[[also visible]]'),
        end: escaped.indexOf('[[also visible]]') + 16,
      },
    ]);
  });

  it('preserves UTF-16 source offsets for links following masked code', () => {
    const text = '😀 `[[ignored]]` then ![[real#Heading|embed]].';

    expect(findUnresolvedWikilinks(text, () => false)).toEqual([
      {
        target: 'real',
        start: text.indexOf('![[real'),
        end: text.indexOf('![[real') + '![[real#Heading|embed]]'.length,
      },
    ]);
  });
});
