export interface Wikilink {
  target: string;
  start: number;
  end: number;
}

const WIKILINK_PATTERN = /!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

export function findUnresolvedWikilinks(
  content: string,
  isResolved: (target: string) => boolean,
): Wikilink[] {
  const unresolved: Wikilink[] = [];

  for (const match of content.matchAll(WIKILINK_PATTERN)) {
    const target = match[1]?.trim();
    const start = match.index;
    if (!target || start === undefined || isResolved(target)) continue;

    unresolved.push({ target, start, end: start + match[0].length });
  }

  return unresolved;
}
