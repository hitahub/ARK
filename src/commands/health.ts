import fs from 'fs-extra';
import path from 'node:path';
import { verifyVault } from './verify.js';

export interface HealthFinding {
  type: 'broken-link' | 'orphan-note' | 'structure';
  path: string;
  message: string;
}

export interface HealthResult {
  healthy: boolean;
  findings: HealthFinding[];
}

interface Link {
  target: string;
  wikiLink: boolean;
}

export async function inspectVaultHealth(targetPath = process.cwd()): Promise<HealthResult> {
  const root = path.resolve(targetPath);
  const stats = await fs.stat(root);
  if (!stats.isDirectory()) {
    throw new Error(`Vault path is not a directory: ${root}`);
  }

  const files = await listMarkdownFiles(root);
  const paths = new Set(files.map((file) => normalize(file)));
  const folders = new Set((await listDirectories(root)).map(normalize));
  const byName = new Map<string, string[]>();
  for (const file of files) {
    const name = path.posix.basename(file).replace(/\.md$/i, '').toLocaleLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }

  const inbound = new Set<string>();
  const findings: HealthFinding[] = [];
  for (const source of files) {
    if (source.startsWith('999_Templates/')) continue;
    const contents = stripCode(await fs.readFile(path.join(root, source), 'utf8'));
    for (const link of extractLinks(contents)) {
      const resolved = resolveLink(source, link, paths, folders, byName);
      if (resolved === null) continue;
      if (resolved === undefined) {
        findings.push({
          type: 'broken-link',
          path: source,
          message: `Unresolved internal link: ${link.target}`,
        });
      } else if (resolved !== normalize(source)) {
        inbound.add(resolved);
      }
    }
  }

  const coreNotes = new Set(['000_atlas/dashboard.md', '000_atlas/moc_idea_matrix.md']);
  for (const file of files) {
    const normalized = normalize(file);
    if (isOrphanCandidate(file) && !coreNotes.has(normalized) && !inbound.has(normalized)) {
      findings.push({
        type: 'orphan-note',
        path: file,
        message: 'No inbound Markdown or wikilink references this note.',
      });
    }
  }

  const verification = await verifyVault(root);
  for (const issue of verification.issues) {
    findings.push({ type: 'structure', path: root, message: issue });
  }
  return { healthy: findings.length === 0, findings };
}

async function listMarkdownFiles(root: string, relative = ''): Promise<string[]> {
  const directory = path.join(root, relative);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || (relative === '' && entry.name === '.arc-backups')) continue;
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(root, child)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(child);
    }
  }
  return files;
}

async function listDirectories(root: string, relative = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const directories: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || (relative === '' && entry.name === '.arc-backups')) continue;
    const child = path.posix.join(relative, entry.name);
    directories.push(child, ...(await listDirectories(root, child)));
  }
  return directories;
}

function extractLinks(contents: string): Link[] {
  const links: Link[] = [];
  for (const match of contents.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = match[1].split('|', 1)[0].trim();
    if (target) links.push({ target, wikiLink: true });
  }
  for (const match of contents.matchAll(/!?\[([^\]]*)\]\(([^)]+)\)/g)) {
    const target = match[2].trim().replace(/^<|>$/g, '').split(/\s+/, 1)[0];
    if (target) links.push({ target, wikiLink: false });
  }
  return links;
}

function resolveLink(
  source: string,
  link: Link,
  knownPaths: Set<string>,
  knownFolders: Set<string>,
  byName: Map<string, string[]>,
): string | undefined | null {
  let target = link.target.trim();
  if (
    !target ||
    target.startsWith('#') ||
    /^[a-z][a-z\d+.-]*:/i.test(target) ||
    target.startsWith('//')
  ) {
    return null;
  }
  target = target.split(/[?#]/, 1)[0];
  try {
    target = decodeURIComponent(target);
  } catch {
    return undefined;
  }
  if (!target || (!link.wikiLink && path.posix.extname(target) && !/\.md$/i.test(target))) {
    return null;
  }

  if (link.wikiLink) {
    const notePath = normalize(
      target.startsWith('/')
        ? target.replace(/^\/+/, '')
        : path.posix.join(path.posix.dirname(source), target),
    );
    const rootPath = normalize(target.replace(/^\/+/, ''));
    const candidates = [notePath, rootPath];
    for (const candidate of candidates) {
      if (knownFolders.has(candidate)) return null;
      const markdownPath = /\.md$/i.test(candidate) ? candidate : `${candidate}.md`;
      if (knownPaths.has(markdownPath)) return markdownPath;
    }
    const basename = path.posix.basename(target).replace(/\.md$/i, '').toLocaleLowerCase();
    const matches = byName.get(basename);
    return matches?.length === 1 ? normalize(matches[0]) : undefined;
  }

  const relativeTarget = normalize(
    target.startsWith('/')
      ? target.replace(/^\/+/, '')
      : path.posix.join(path.posix.dirname(source), target),
  );
  const markdownPath = /\.md$/i.test(relativeTarget) ? relativeTarget : `${relativeTarget}.md`;
  return knownPaths.has(markdownPath) ? markdownPath : undefined;
}

function isOrphanCandidate(file: string): boolean {
  return /^(000_Atlas|100_Spaces|200_Projects|300_Slipbox|400_Journal)\//.test(file);
}

function normalize(value: string): string {
  return path.posix.normalize(value).replace(/^\.\//, '').replace(/\/+$/, '').toLocaleLowerCase();
}

function stripCode(contents: string): string {
  return contents.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '').replace(/`[^`]*`/g, '');
}

export function reportHealth(result: HealthResult, targetPath: string): void {
  if (result.healthy) {
    console.log(`ARC vault health check passed: ${path.resolve(targetPath)}`);
    return;
  }
  console.error(
    `ARC vault health check found ${result.findings.length} issue(s): ${path.resolve(targetPath)}`,
  );
  for (const finding of result.findings) {
    console.error(`- [${finding.type}] ${finding.path}: ${finding.message}`);
  }
}
