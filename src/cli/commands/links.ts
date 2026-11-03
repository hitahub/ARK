import { constants } from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import fs, { type FileHandle } from 'node:fs/promises';
import path from 'node:path';

const SLIPBOX_DIRECTORY = '300_Slipbox';
const MAX_SCAN_ENTRIES = 2_000;
const MAX_NOTES = 500;
const MAX_NOTE_BYTES = 64 * 1024;
const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_UNIQUE_TERMS = 100_000;
const MAX_TERM_COMPARISONS = 1_000_000;
const MAX_SUGGESTIONS = 20;
const MIN_SHARED_TERMS = 2;
const MIN_SIMILARITY = 0.12;
const MAX_DISPLAY_TERMS = 5;

const STOP_WORDS = new Set(
  `a about after all also am an and any are as at be because been before being between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves`.split(
    ' ',
  ),
);

interface Note {
  path: string;
  terms: Map<string, number>;
}

class LinkSuggestionError extends Error {}

interface Candidate {
  leftPath: string;
  rightPath: string;
  similarity: number;
  sharedTerms: string[];
}

interface CandidateScore {
  dotProduct: number;
  sharedTermCount: number;
  displayedTerms: Array<{ term: string; inverseDocumentFrequency: number }>;
}

export interface LinkSuggestions {
  vaultPath: string;
  noteCount: number;
  candidates: Candidate[];
}

/**
 * Find a bounded set of lexical suggestions between direct Slipbox notes.
 *
 * @param vaultPath Explicitly selected ARC vault directory.
 * @returns Ranked suggestions; the vault and source notes are never modified.
 * @throws If the selected content is unsafe, unreadable, invalid, or exceeds scan limits.
 */
export async function suggestRelatedNotes(vaultPath: string): Promise<LinkSuggestions> {
  const vaultRoot = await resolveVaultRoot(vaultPath);
  const slipboxPath = path.join(vaultRoot, SLIPBOX_DIRECTORY);
  const slipboxStats = await lstat(slipboxPath, SLIPBOX_DIRECTORY);
  if (slipboxStats.isSymbolicLink() || !slipboxStats.isDirectory()) {
    throw new LinkSuggestionError(`The ${SLIPBOX_DIRECTORY} path must be a non-symlink directory.`);
  }
  await assertCanonicalPath(vaultRoot, slipboxPath, SLIPBOX_DIRECTORY);

  const entries = await readDirectory(slipboxPath, slipboxStats);
  if (entries.length > MAX_SCAN_ENTRIES) {
    throw new LinkSuggestionError(`Slipbox scan exceeds the ${MAX_SCAN_ENTRIES}-entry limit.`);
  }

  const notes: Note[] = [];
  let scannedBytes = 0;
  let uniqueTermCount = 0;
  for (const entry of entries) {
    if (/[\u0000-\u001f\u007f-\u009f]/.test(entry.name)) {
      throw new LinkSuggestionError('Slipbox note paths cannot contain control characters.');
    }
    if (entry.isSymbolicLink()) {
      throw new LinkSuggestionError(`Symlinks are not allowed in the Slipbox: "${entry.name}".`);
    }
    if (
      entry.name.startsWith('.') ||
      !entry.isFile() ||
      !entry.name.toLowerCase().endsWith('.md')
    ) {
      continue;
    }
    if (notes.length >= MAX_NOTES) {
      throw new LinkSuggestionError(`Slipbox scan exceeds the ${MAX_NOTES}-note limit.`);
    }

    const relativePath = `${SLIPBOX_DIRECTORY}/${entry.name}`;
    const contents = await readNote(vaultRoot, slipboxPath, entry.name, relativePath);
    scannedBytes += Buffer.byteLength(contents);
    if (scannedBytes > MAX_SCAN_BYTES) {
      throw new LinkSuggestionError(
        `Slipbox scan exceeds the ${MAX_SCAN_BYTES}-byte content limit.`,
      );
    }
    const terms = tokenize(contents);
    uniqueTermCount += terms.size;
    if (uniqueTermCount > MAX_UNIQUE_TERMS) {
      throw new LinkSuggestionError(
        `Slipbox scan exceeds the ${MAX_UNIQUE_TERMS}-unique-term limit.`,
      );
    }
    notes.push({ path: relativePath, terms });
  }

  notes.sort((left, right) => compareText(left.path, right.path));
  const candidates = rankCandidates(notes);
  return { vaultPath: vaultRoot, noteCount: notes.length, candidates };
}

/**
 * Print bounded link suggestions for manual review.
 *
 * @param result Result returned by {@link suggestRelatedNotes}.
 */
export function reportLinkSuggestions(result: LinkSuggestions): void {
  console.log(`ARC Slipbox link suggestions (${result.noteCount} notes): ${result.vaultPath}`);
  if (result.candidates.length === 0) {
    console.log('No candidates met the minimum similarity and shared-term requirements.');
    return;
  }

  console.log('Heuristic lexical matches only; review each candidate. No notes were changed.');
  for (const [index, candidate] of result.candidates.entries()) {
    console.log(
      `${index + 1}. ${(candidate.similarity * 100).toFixed(1)}% ` +
        `${candidate.leftPath} <-> ${candidate.rightPath} ` +
        `(shared terms: ${candidate.sharedTerms.join(', ')})`,
    );
  }
}

async function resolveVaultRoot(vaultPath: string): Promise<string> {
  if (!vaultPath.trim()) {
    throw new LinkSuggestionError('Provide an explicit vault directory to suggest related notes.');
  }
  const absolutePath = path.resolve(vaultPath);
  const rootStats = await lstat(absolutePath, 'selected vault');
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new LinkSuggestionError(
      'The selected vault path must be an existing, non-symlink directory.',
    );
  }

  let canonicalPath: string;
  let finalStats: Stats;
  try {
    canonicalPath = await fs.realpath(absolutePath);
    finalStats = await fs.lstat(absolutePath);
  } catch (error) {
    throw pathOperationError('validate', 'selected vault', error);
  }
  if (
    finalStats.isSymbolicLink() ||
    !finalStats.isDirectory() ||
    finalStats.dev !== rootStats.dev ||
    finalStats.ino !== rootStats.ino
  ) {
    throw new LinkSuggestionError('The selected vault path changed during validation.');
  }
  return canonicalPath;
}

async function readDirectory(directoryPath: string, initialStats: Stats): Promise<Dirent[]> {
  let directory;
  try {
    directory = await fs.opendir(directoryPath);
  } catch (error) {
    throw pathOperationError('list', SLIPBOX_DIRECTORY, error);
  }

  const entries: Dirent[] = [];
  try {
    for await (const entry of directory) {
      entries.push(entry);
      if (entries.length > MAX_SCAN_ENTRIES) break;
    }
  } catch (error) {
    if (error instanceof LinkSuggestionError) throw error;
    throw pathOperationError('list', SLIPBOX_DIRECTORY, error);
  }

  const stats = await lstat(directoryPath, SLIPBOX_DIRECTORY);
  if (
    stats.isSymbolicLink() ||
    !stats.isDirectory() ||
    stats.dev !== initialStats.dev ||
    stats.ino !== initialStats.ino
  ) {
    throw new LinkSuggestionError(`The ${SLIPBOX_DIRECTORY} path changed during scanning.`);
  }
  return entries.sort((left, right) => compareText(left.name, right.name));
}

async function readNote(
  vaultRoot: string,
  slipboxPath: string,
  filename: string,
  relativePath: string,
): Promise<string> {
  const absolutePath = path.join(slipboxPath, filename);
  const initialStats = await lstat(absolutePath, relativePath);
  if (initialStats.isSymbolicLink() || !initialStats.isFile()) {
    throw new LinkSuggestionError(
      `Unsupported Slipbox content at "${relativePath}": expected a regular file.`,
    );
  }
  if (initialStats.size > MAX_NOTE_BYTES) {
    throw new LinkSuggestionError(
      `Note "${relativePath}" exceeds the ${MAX_NOTE_BYTES}-byte content limit.`,
    );
  }
  await assertCanonicalPath(vaultRoot, absolutePath, relativePath);

  let handle: FileHandle | undefined;
  try {
    handle = await fs.open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedStats = await handle.stat();
    if (
      !openedStats.isFile() ||
      openedStats.dev !== initialStats.dev ||
      openedStats.ino !== initialStats.ino
    ) {
      throw new LinkSuggestionError(`Note "${relativePath}" changed during scanning.`);
    }

    const bytes = Buffer.alloc(MAX_NOTE_BYTES + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_NOTE_BYTES) {
      throw new LinkSuggestionError(
        `Note "${relativePath}" exceeds the ${MAX_NOTE_BYTES}-byte content limit.`,
      );
    }
    const finalStats = await fs.lstat(absolutePath);
    if (
      finalStats.isSymbolicLink() ||
      finalStats.dev !== openedStats.dev ||
      finalStats.ino !== openedStats.ino
    ) {
      throw new LinkSuggestionError(`Note "${relativePath}" changed during scanning.`);
    }
    await assertCanonicalPath(vaultRoot, absolutePath, relativePath);

    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset));
    } catch {
      throw new LinkSuggestionError(`Note "${relativePath}" is not valid UTF-8 Markdown.`);
    }
  } catch (error) {
    if (error instanceof LinkSuggestionError) throw error;
    throw pathOperationError('read', relativePath, error);
  } finally {
    await handle?.close();
  }
}

async function lstat(targetPath: string, displayPath: string): Promise<Stats> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    throw pathOperationError('access', displayPath, error);
  }
}

async function assertCanonicalPath(
  vaultRoot: string,
  targetPath: string,
  displayPath: string,
): Promise<void> {
  let canonicalPath: string;
  try {
    canonicalPath = await fs.realpath(targetPath);
  } catch (error) {
    throw pathOperationError('access', displayPath, error);
  }
  if (canonicalPath !== path.resolve(targetPath)) {
    throw new LinkSuggestionError(`Symlink paths are not allowed: "${displayPath}".`);
  }
  const relativePath = path.relative(vaultRoot, canonicalPath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new LinkSuggestionError(`Path is outside the selected vault: "${displayPath}".`);
  }
}

function pathOperationError(
  operation: string,
  displayPath: string,
  error: unknown,
): LinkSuggestionError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return new LinkSuggestionError(`Path not found in the selected vault: "${displayPath}".`);
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return new LinkSuggestionError(
      `Permission denied while attempting to ${operation} "${displayPath}".`,
    );
  }
  if (code === 'ELOOP') {
    return new LinkSuggestionError(`Symlink paths are not allowed: "${displayPath}".`);
  }
  return new LinkSuggestionError(
    `Unable to ${operation} "${displayPath}"${code ? ` (${code})` : ''}.`,
  );
}

function tokenize(contents: string): Map<string, number> {
  const body = contents
    .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, '$2 $1')
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFKC')
    .toLocaleLowerCase();
  const terms = new Map<string, number>();
  for (const match of body.matchAll(/[\p{L}\p{N}]{2,}/gu)) {
    const term = match[0];
    if (STOP_WORDS.has(term)) continue;
    terms.set(term, (terms.get(term) ?? 0) + 1);
  }
  return terms;
}

function rankCandidates(notes: Note[]): Candidate[] {
  const postingsByTerm = new Map<string, number[]>();
  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    for (const term of notes[noteIndex].terms.keys()) {
      const postings = postingsByTerm.get(term);
      if (postings) {
        postings.push(noteIndex);
      } else {
        postingsByTerm.set(term, [noteIndex]);
      }
    }
  }

  const vectors = notes.map((note) => {
    const weights = new Map<string, number>();
    let squaredNorm = 0;
    for (const [term, count] of note.terms) {
      const inverseDocumentFrequency =
        1 + Math.log((notes.length + 1) / ((postingsByTerm.get(term)?.length ?? 0) + 1));
      const weight = (1 + Math.log(count)) * inverseDocumentFrequency;
      weights.set(term, weight);
      squaredNorm += weight * weight;
    }
    return { weights, norm: Math.sqrt(squaredNorm) };
  });

  const scores = new Map<number, CandidateScore>();
  let comparisons = 0;
  for (const [term, postings] of postingsByTerm) {
    const documentFrequency = postings.length;
    comparisons += (postings.length * (postings.length - 1)) / 2;
    if (comparisons > MAX_TERM_COMPARISONS) {
      throw new LinkSuggestionError(
        `Slipbox matching exceeds the ${MAX_TERM_COMPARISONS}-comparison work limit.`,
      );
    }

    const inverseDocumentFrequency = 1 + Math.log((notes.length + 1) / (documentFrequency + 1));
    for (let left = 0; left < postings.length; left += 1) {
      const leftIndex = postings[left];
      for (let right = left + 1; right < postings.length; right += 1) {
        const rightIndex = postings[right];
        const key = leftIndex * notes.length + rightIndex;
        const score = scores.get(key) ?? {
          dotProduct: 0,
          sharedTermCount: 0,
          displayedTerms: [],
        };
        const leftWeight = vectors[leftIndex].weights.get(term);
        const rightWeight = vectors[rightIndex].weights.get(term);
        if (leftWeight === undefined || rightWeight === undefined) {
          throw new LinkSuggestionError(`Unable to score shared term "${term}".`);
        }
        score.dotProduct += leftWeight * rightWeight;
        score.sharedTermCount += 1;
        score.displayedTerms.push({ term, inverseDocumentFrequency });
        scores.set(key, score);
      }
    }
  }

  const candidates: Candidate[] = [];
  for (const [key, score] of scores) {
    if (score.sharedTermCount < MIN_SHARED_TERMS) continue;
    const leftIndex = Math.floor(key / notes.length);
    const rightIndex = key % notes.length;
    const similarity = score.dotProduct / (vectors[leftIndex].norm * vectors[rightIndex].norm);
    if (similarity < MIN_SIMILARITY) continue;

    const sharedTerms = score.displayedTerms
      .sort(
        (left, right) =>
          right.inverseDocumentFrequency - left.inverseDocumentFrequency ||
          compareText(left.term, right.term),
      )
      .slice(0, MAX_DISPLAY_TERMS)
      .map(({ term }) => term);
    candidates.push({
      leftPath: notes[leftIndex].path,
      rightPath: notes[rightIndex].path,
      similarity,
      sharedTerms,
    });
  }

  return candidates
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        compareText(left.leftPath, right.leftPath) ||
        compareText(left.rightPath, right.rightPath),
    )
    .slice(0, MAX_SUGGESTIONS);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
