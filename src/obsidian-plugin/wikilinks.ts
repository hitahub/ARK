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
  const searchableContent = maskCode(content);

  for (const match of searchableContent.matchAll(WIKILINK_PATTERN)) {
    const target = match[1]?.trim();
    const start = match.index;
    if (!target || start === undefined || isResolved(target)) continue;

    unresolved.push({ target, start, end: start + match[0].length });
  }

  return unresolved;
}

function maskCode(content: string): string {
  const characters = content.split('');
  maskFencedCode(content, characters);
  maskInlineCode(characters);
  return characters.join('');
}

function maskFencedCode(content: string, characters: string[]): void {
  let lineStart = 0;
  while (lineStart < content.length) {
    const lineEnd = content.indexOf('\n', lineStart);
    const nextLineStart = lineEnd === -1 ? content.length : lineEnd + 1;
    const line = content
      .slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
      .replace(/\r$/, '');
    const openingFence = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);

    if (openingFence) {
      const fence = openingFence[2];
      const info = openingFence[3];
      if (!(fence[0] === '`' && info.includes('`'))) {
        const closingPattern = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
        let closingLineEnd = -1;
        let closingNextLineStart = content.length;
        let candidateStart = nextLineStart;

        while (candidateStart < content.length) {
          const candidateEnd = content.indexOf('\n', candidateStart);
          const candidateNextLineStart = candidateEnd === -1 ? content.length : candidateEnd + 1;
          const candidateLine = content
            .slice(candidateStart, candidateEnd === -1 ? content.length : candidateEnd)
            .replace(/\r$/, '');
          if (closingPattern.test(candidateLine)) {
            closingLineEnd = candidateEnd === -1 ? content.length : candidateEnd;
            closingNextLineStart = candidateNextLineStart;
            break;
          }
          candidateStart = candidateNextLineStart;
        }

        maskRange(characters, lineStart, closingLineEnd === -1 ? content.length : closingLineEnd);
        lineStart = closingLineEnd === -1 ? content.length : closingNextLineStart;
        continue;
      }
    }

    lineStart = nextLineStart;
  }
}

function maskInlineCode(characters: string[]): void {
  let index = 0;
  while (index < characters.length) {
    if (characters[index] !== '`') {
      index += 1;
      continue;
    }

    const openingEnd = getBacktickRunEnd(characters, index);
    if (isEscaped(characters, index)) {
      index = openingEnd;
      continue;
    }

    const runLength = openingEnd - index;
    const closingStart = findMatchingBacktickRun(characters, openingEnd, runLength);
    if (closingStart === -1) {
      index = openingEnd;
      continue;
    }

    const closingEnd = getBacktickRunEnd(characters, closingStart);
    maskRange(characters, index, closingEnd);
    index = closingEnd;
  }
}

function findMatchingBacktickRun(characters: string[], start: number, runLength: number): number {
  let index = start;
  while (index < characters.length) {
    if (characters[index] !== '`') {
      index += 1;
      continue;
    }

    const runEnd = getBacktickRunEnd(characters, index);
    if (runEnd - index === runLength) return index;
    index = runEnd;
  }
  return -1;
}

function getBacktickRunEnd(characters: string[], start: number): number {
  let end = start;
  while (characters[end] === '`') end += 1;
  return end;
}

function isEscaped(characters: string[], index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && characters[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function maskRange(characters: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== '\n' && characters[index] !== '\r') {
      characters[index] = ' ';
    }
  }
}
