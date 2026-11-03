import { constants } from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import fs, { type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import packageInfo from '../../../package.json' with { type: 'json' };
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { parseDocument } from 'yaml';
import { z } from 'zod';

const MAX_NOTE_BYTES = 64 * 1024;
const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_SCAN_FILES = 2_000;
const MAX_RESULTS = 50;
const MAX_TAG_LENGTH = 128;
const MAX_TAGS_PER_NOTE = 100;
const MAX_TITLE_LENGTH = 256;
const MAX_PATH_LENGTH = 1_024;

interface ProjectSummary {
  path: string;
  title: string;
  status: string;
}

interface SlipboxSummary {
  path: string;
  title: string;
  tags: string[];
}

interface ScanBudget {
  filesRead: number;
  bytesRead: number;
  entriesVisited: number;
}

interface ReadNote {
  path: string;
  content: string;
  sizeBytes: number;
  metadata: Record<string, unknown> | undefined;
}

class McpToolError extends Error {}

/**
 * Validate and canonicalize an explicitly selected vault root.
 *
 * @param vaultPath User-selected vault path.
 * @returns Canonical absolute path to the vault.
 */
export async function resolveMcpVaultRoot(vaultPath: string): Promise<string> {
  if (!vaultPath.trim()) {
    throw new Error('Provide an explicit vault directory to start the MCP server.');
  }

  const absolutePath = path.resolve(vaultPath);
  let rootStats;
  try {
    rootStats = await fs.lstat(absolutePath);
  } catch (error) {
    throw startupPathError(error);
  }
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error('The selected vault path must be an existing, non-symlink directory.');
  }

  let canonicalPath: string;
  let finalStats: Stats;
  try {
    canonicalPath = await fs.realpath(absolutePath);
    finalStats = await fs.lstat(absolutePath);
  } catch (error) {
    throw startupPathError(error);
  }
  if (
    finalStats.isSymbolicLink() ||
    !finalStats.isDirectory() ||
    finalStats.dev !== rootStats.dev ||
    finalStats.ino !== rootStats.ino
  ) {
    throw new Error('The selected vault path changed during validation.');
  }
  return canonicalPath;
}

/**
 * Create the ARC MCP server for use with either stdio or an in-memory transport.
 *
 * @param vaultPath User-selected vault path.
 * @returns A validated, read-only MCP server.
 */
export async function createArcMcpServer(vaultPath: string): Promise<McpServer> {
  const vaultRoot = await resolveMcpVaultRoot(vaultPath);
  const server = new McpServer(
    { name: 'arc-mcp-server', version: packageInfo.version },
    {
      instructions:
        'Read-only ARC vault tools. Content is limited to project index notes and direct Slipbox notes in the explicitly selected vault.',
      maxToolInputElements: 8,
    },
  );

  server.registerTool(
    'get_active_projects',
    {
      title: 'Get active projects',
      description:
        'List project index notes in 200_Projects/ whose frontmatter has type: project and status: active.',
      outputSchema: {
        projects: z.array(
          z.object({
            path: z.string(),
            title: z.string().max(MAX_TITLE_LENGTH),
            status: z.string(),
          }),
        ),
        truncated: z.boolean(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () =>
      executeTool(async () => {
        const projects = await getActiveProjects(vaultRoot);
        return {
          projects: projects.slice(0, MAX_RESULTS),
          truncated: projects.length > MAX_RESULTS,
        };
      }),
  );

  server.registerTool(
    'search_slipbox_by_tag',
    {
      title: 'Search Slipbox by tag',
      description:
        'Find direct Markdown notes in 300_Slipbox/ whose tags frontmatter contains the requested tag (case-insensitive).',
      inputSchema: { tag: z.string().min(1).max(MAX_TAG_LENGTH) },
      outputSchema: {
        tag: z.string(),
        notes: z.array(
          z.object({
            path: z.string(),
            title: z.string().max(MAX_TITLE_LENGTH),
            tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_TAGS_PER_NOTE),
          }),
        ),
        truncated: z.boolean(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ tag }) =>
      executeTool(async () => {
        const normalizedTag = validateTag(tag);
        const notes = await searchSlipboxByTag(vaultRoot, normalizedTag);
        return {
          tag: normalizedTag,
          notes: notes.slice(0, MAX_RESULTS),
          truncated: notes.length > MAX_RESULTS,
        };
      }),
  );

  server.registerTool(
    'get_note',
    {
      title: 'Get ARC note',
      description:
        'Read a project index note or a direct Markdown note in 300_Slipbox/. Supply a vault-relative path.',
      inputSchema: { path: z.string().min(1).max(MAX_PATH_LENGTH) },
      outputSchema: {
        path: z.string(),
        content: z.string(),
        sizeBytes: z.number().int().nonnegative(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ path: notePath }) =>
      executeTool(async () => {
        const note = await readAllowedNote(vaultRoot, notePath);
        return {
          path: note.path,
          content: note.content,
          sizeBytes: note.sizeBytes,
        };
      }),
  );

  return server;
}

/**
 * Start the opt-in stdio MCP server against an explicit vault.
 *
 * @param vaultPath User-selected vault path.
 */
export async function startMcpServer(vaultPath: string): Promise<void> {
  const server = await createArcMcpServer(vaultPath);
  await server.connect(
    new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 256 * 1024 }),
  );
}

async function getActiveProjects(vaultRoot: string): Promise<ProjectSummary[]> {
  const budget: ScanBudget = { filesRead: 0, bytesRead: 0, entriesVisited: 0 };
  const projectFiles = await findMarkdownFiles(vaultRoot, '200_Projects', budget);
  const projects: ProjectSummary[] = [];

  for (const relativePath of projectFiles) {
    const note = await readNote(vaultRoot, relativePath, budget);
    if (!note.metadata) continue;

    const type = readOptionalString(note.metadata, 'type', relativePath);
    if (type !== 'project') continue;

    const status = readRequiredString(note.metadata, 'status', relativePath);
    if (status === 'active') {
      projects.push({ path: note.path, title: getTitle(note.content, note.path), status });
    }
  }

  return projects.sort((left, right) => compareText(left.path, right.path));
}

async function searchSlipboxByTag(vaultRoot: string, tag: string): Promise<SlipboxSummary[]> {
  const budget: ScanBudget = { filesRead: 0, bytesRead: 0, entriesVisited: 0 };
  const slipboxFiles = await findMarkdownFiles(vaultRoot, '300_Slipbox', budget, false);
  const normalizedTag = tag.toLowerCase();
  const notes: SlipboxSummary[] = [];

  for (const relativePath of slipboxFiles) {
    const note = await readNote(vaultRoot, relativePath, budget);
    if (!note.metadata) continue;

    const tags = readTags(note.metadata, relativePath);
    if (tags.some((candidate) => candidate.toLowerCase() === normalizedTag)) {
      notes.push({ path: note.path, title: getTitle(note.content, note.path), tags });
    }
  }

  return notes.sort((left, right) => compareText(left.path, right.path));
}

async function findMarkdownFiles(
  vaultRoot: string,
  area: '200_Projects' | '300_Slipbox',
  budget: ScanBudget,
  recursive = true,
): Promise<string[]> {
  const rootRelative = area;
  await assertSafeDirectory(vaultRoot, rootRelative);

  const files: string[] = [];
  const visit = async (relativeDirectory: string): Promise<void> => {
    await assertSafeDirectory(vaultRoot, relativeDirectory);
    const entries = await readDirectory(
      vaultRoot,
      relativeDirectory,
      MAX_SCAN_FILES - budget.entriesVisited,
    );
    await assertSafeDirectory(vaultRoot, relativeDirectory);
    for (const entry of entries) {
      budget.entriesVisited += 1;
      if (budget.entriesVisited > MAX_SCAN_FILES) {
        throw new McpToolError(`Search exceeded the ${MAX_SCAN_FILES}-entry scan limit.`);
      }
      if (entry.name.startsWith('.')) continue;
      const entryPath = `${relativeDirectory}/${entry.name}`;
      if (entryPath.length > MAX_PATH_LENGTH) {
        throw new McpToolError(
          `Search encountered a path longer than the ${MAX_PATH_LENGTH}-character limit.`,
        );
      }

      if (entry.isSymbolicLink()) {
        throw new McpToolError(
          `Symlinks are not allowed in the permitted content scope: "${entryPath}".`,
        );
      }
      if (entry.isDirectory()) {
        if (recursive) await visit(entryPath);
        continue;
      }
      if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith('.md') &&
        (area === '300_Slipbox' || relativeDirectory !== area)
      ) {
        validateNotePath(entryPath);
        files.push(entryPath);
      }
    }
  };

  await visit(rootRelative);
  return files;
}

async function readAllowedNote(vaultRoot: string, requestedPath: string): Promise<ReadNote> {
  const relativePath = validateNotePath(requestedPath);
  const inProjects = relativePath.startsWith('200_Projects/');
  const note = await readNote(vaultRoot, relativePath);

  if (inProjects) {
    if (!note.metadata || readOptionalString(note.metadata, 'type', relativePath) !== 'project') {
      throw new McpToolError(
        `Unsupported content at "${relativePath}": expected a project index note.`,
      );
    }
    readRequiredString(note.metadata, 'status', relativePath);
  } else if (note.metadata) {
    readTags(note.metadata, relativePath);
  }

  return note;
}

async function readNote(
  vaultRoot: string,
  relativePath: string,
  budget?: ScanBudget,
): Promise<ReadNote> {
  relativePath = validateNotePath(relativePath);
  if (budget) {
    budget.filesRead += 1;
    if (budget.filesRead > MAX_SCAN_FILES) {
      throw new McpToolError(`Search exceeded the ${MAX_SCAN_FILES}-file scan limit.`);
    }
  }

  const absolutePath = await assertSafeFile(vaultRoot, relativePath);
  let handle: FileHandle | undefined;
  try {
    handle = await fs.open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new McpToolError(`Unsupported content at "${relativePath}": expected a regular file.`);
    }
    await assertSafeFile(vaultRoot, relativePath);
    const pathStats = await fs.lstat(absolutePath);
    if (pathStats.isSymbolicLink() || pathStats.dev !== stats.dev || pathStats.ino !== stats.ino) {
      throw new McpToolError(`Symlink paths are not allowed: "${relativePath}".`);
    }
    await assertCanonicalPath(vaultRoot, absolutePath, relativePath);
    if (stats.size > MAX_NOTE_BYTES) {
      throw new McpToolError(
        `Note "${relativePath}" exceeds the ${MAX_NOTE_BYTES}-byte content limit.`,
      );
    }
    if (budget && budget.bytesRead + stats.size > MAX_SCAN_BYTES) {
      throw new McpToolError(`Search exceeded the ${MAX_SCAN_BYTES}-byte scan limit.`);
    }

    const bytes = Buffer.alloc(MAX_NOTE_BYTES + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_NOTE_BYTES) {
      throw new McpToolError(
        `Note "${relativePath}" exceeds the ${MAX_NOTE_BYTES}-byte content limit.`,
      );
    }
    if (budget && budget.bytesRead + offset > MAX_SCAN_BYTES) {
      throw new McpToolError(`Search exceeded the ${MAX_SCAN_BYTES}-byte scan limit.`);
    }

    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset));
    } catch {
      throw new McpToolError(`Note "${relativePath}" is not valid UTF-8 Markdown.`);
    }
    if (budget) budget.bytesRead += offset;
    return {
      path: relativePath,
      content,
      sizeBytes: offset,
      metadata: parseFrontmatter(content, relativePath),
    };
  } catch (error) {
    if (error instanceof McpToolError) throw error;
    throw fileOperationError('read', relativePath, error);
  } finally {
    await handle?.close();
  }
}

function parseFrontmatter(
  content: string,
  relativePath: string,
): Record<string, unknown> | undefined {
  if (!/^---[ \t]*\r?\n/.test(content)) return undefined;
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  if (!match) {
    throw new McpToolError(
      `Malformed YAML frontmatter in "${relativePath}": missing closing delimiter.`,
    );
  }

  try {
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length > 0) {
      throw new Error('Invalid YAML');
    }
    const metadata: unknown = document.toJS({ maxAliasCount: 0 });
    if (
      typeof metadata !== 'object' ||
      metadata === null ||
      Array.isArray(metadata) ||
      (Object.getPrototypeOf(metadata) !== Object.prototype &&
        Object.getPrototypeOf(metadata) !== null)
    ) {
      throw new Error('Frontmatter must be a mapping');
    }
    return Object.fromEntries(Object.entries(metadata));
  } catch {
    throw new McpToolError(`Malformed YAML frontmatter in "${relativePath}".`);
  }
}

function readOptionalString(
  metadata: Record<string, unknown>,
  key: string,
  relativePath: string,
): string | undefined {
  const value = metadata[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new McpToolError(
      `Invalid "${key}" metadata in "${relativePath}": expected a non-empty string.`,
    );
  }
  return value;
}

function readRequiredString(
  metadata: Record<string, unknown>,
  key: string,
  relativePath: string,
): string {
  const value = readOptionalString(metadata, key, relativePath);
  if (value === undefined) {
    throw new McpToolError(`Invalid "${key}" metadata in "${relativePath}": field is required.`);
  }
  return value;
}

function readTags(metadata: Record<string, unknown>, relativePath: string): string[] {
  const value = metadata.tags;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_TAGS_PER_NOTE) {
    throw new McpToolError(
      `Invalid "tags" metadata in "${relativePath}": expected a list of strings.`,
    );
  }

  const tags: string[] = [];
  for (const tag of value) {
    if (
      typeof tag !== 'string' ||
      tag.trim() === '' ||
      tag.trim().length > MAX_TAG_LENGTH ||
      /[\u0000-\u001f\u007f-\u009f]/.test(tag)
    ) {
      throw new McpToolError(
        `Invalid "tags" metadata in "${relativePath}": expected a list of strings.`,
      );
    }
    tags.push(tag.trim());
  }
  return tags;
}

function getTitle(content: string, relativePath: string): string {
  const frontmatter = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content)?.[0] ?? '';
  const body = content.slice(frontmatter.length);
  const heading = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(body);
  const title =
    heading?.[1]?.trim() || path.posix.basename(relativePath, path.posix.extname(relativePath));
  if (title.length > MAX_TITLE_LENGTH || /[\u0000-\u001f\u007f-\u009f]/.test(title)) {
    throw new McpToolError(
      `Invalid note title in "${relativePath}": expected at most ${MAX_TITLE_LENGTH} printable characters.`,
    );
  }
  return title;
}

function validateTag(tag: string): string {
  const normalizedTag = tag.trim();
  if (
    !normalizedTag ||
    normalizedTag.length > MAX_TAG_LENGTH ||
    /[\u0000-\u001f\u007f-\u009f]/.test(normalizedTag)
  ) {
    throw new McpToolError(`Tag must contain 1-${MAX_TAG_LENGTH} printable characters.`);
  }
  return normalizedTag;
}

function validateNotePath(requestedPath: string): string {
  if (
    requestedPath.length > MAX_PATH_LENGTH ||
    requestedPath.startsWith('/') ||
    requestedPath.includes('\\') ||
    /[\u0000-\u001f\u007f-\u009f]/.test(requestedPath)
  ) {
    throw new McpToolError(
      'Note path must be a vault-relative Markdown path in an allowed content area.',
    );
  }

  const segments = requestedPath.split('/');
  if (
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'),
    ) ||
    !requestedPath.toLowerCase().endsWith('.md')
  ) {
    throw new McpToolError(
      'Note path must be a vault-relative Markdown path in an allowed content area.',
    );
  }

  const inProjects = segments[0] === '200_Projects' && segments.length >= 3;
  const inSlipbox = segments[0] === '300_Slipbox' && segments.length === 2;
  if (!inProjects && !inSlipbox) {
    throw new McpToolError(
      'Note path is outside the permitted project-index and Slipbox content areas.',
    );
  }

  return segments.join('/');
}

async function assertSafeDirectory(vaultRoot: string, relativePath: string): Promise<void> {
  await assertSelectedVault(vaultRoot);
  let currentPath = vaultRoot;
  for (const segment of relativePath.split('/')) {
    currentPath = path.join(currentPath, segment);
    let stats;
    try {
      stats = await fs.lstat(currentPath);
    } catch (error) {
      throw fileOperationError('access', relativePath, error);
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new McpToolError(
        `Permitted content directory is unsafe or unavailable: "${relativePath}".`,
      );
    }
  }
  await assertCanonicalPath(vaultRoot, currentPath, relativePath);
}

async function assertSafeFile(vaultRoot: string, relativePath: string): Promise<string> {
  await assertSelectedVault(vaultRoot);
  const absolutePath = path.join(vaultRoot, ...relativePath.split('/'));
  let currentPath = vaultRoot;
  const segments = relativePath.split('/');

  for (let index = 0; index < segments.length; index += 1) {
    currentPath = path.join(currentPath, segments[index]);
    let stats;
    try {
      stats = await fs.lstat(currentPath);
    } catch (error) {
      throw fileOperationError('access', relativePath, error);
    }
    if (stats.isSymbolicLink()) {
      throw new McpToolError(`Symlink paths are not allowed: "${relativePath}".`);
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new McpToolError(`Unsafe or unavailable note path: "${relativePath}".`);
    }
    if (index === segments.length - 1 && !stats.isFile()) {
      throw new McpToolError(`Unsupported content at "${relativePath}": expected a regular file.`);
    }
  }

  await assertCanonicalPath(vaultRoot, absolutePath, relativePath);
  return absolutePath;
}

async function assertSelectedVault(vaultRoot: string): Promise<void> {
  let stats;
  try {
    stats = await fs.lstat(vaultRoot);
  } catch (error) {
    throw fileOperationError('access', 'selected vault', error);
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new McpToolError('The selected vault directory is no longer available or is unsafe.');
  }
  await assertCanonicalPath(vaultRoot, vaultRoot, 'selected vault');
}

async function assertCanonicalPath(
  vaultRoot: string,
  absolutePath: string,
  relativePath: string,
): Promise<void> {
  let canonicalPath;
  try {
    canonicalPath = await fs.realpath(absolutePath);
  } catch (error) {
    throw fileOperationError('access', relativePath, error);
  }
  const fromRoot = path.relative(vaultRoot, canonicalPath);
  if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
    throw new McpToolError(`Path is outside the selected vault: "${relativePath}".`);
  }
}

async function readDirectory(
  vaultRoot: string,
  relativePath: string,
  maxEntries: number,
): Promise<Dirent[]> {
  const absolutePath = path.join(vaultRoot, ...relativePath.split('/'));
  const entries: Dirent[] = [];
  try {
    const directory = await fs.opendir(absolutePath);
    for await (const entry of directory) {
      if (entries.length >= maxEntries) {
        throw new McpToolError(`Search exceeded the ${MAX_SCAN_FILES}-entry scan limit.`);
      }
      entries.push(entry);
    }
  } catch (error) {
    if (error instanceof McpToolError) throw error;
    throw fileOperationError('list', relativePath, error);
  }
  await assertSafeDirectory(vaultRoot, relativePath);
  return sortEntries(entries);
}

function sortEntries(entries: Dirent[]): Dirent[] {
  return entries.sort((left, right) => compareText(left.name, right.name));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fileOperationError(operation: string, relativePath: string, error: unknown): McpToolError {
  const code = getErrorCode(error);
  if (code === 'ENOENT')
    return new McpToolError(`Path not found in the selected vault: "${relativePath}".`);
  if (code === 'EACCES' || code === 'EPERM') {
    return new McpToolError(
      `Permission denied while attempting to ${operation} "${relativePath}".`,
    );
  }
  if (code === 'ELOOP' || code === 'ENOTDIR') {
    return new McpToolError(`Unsafe or unavailable path: "${relativePath}".`);
  }
  return new McpToolError(`Unable to ${operation} "${relativePath}"${code ? ` (${code})` : ''}.`);
}

function startupPathError(error: unknown): Error {
  const code = getErrorCode(error);
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return new Error('The selected vault directory does not exist.');
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return new Error('Permission denied while accessing the selected vault directory.');
  }
  return new Error(`Unable to access the selected vault directory${code ? ` (${code})` : ''}.`);
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

async function executeTool<T extends Record<string, unknown>>(
  operation: () => Promise<T>,
): Promise<CallToolResult> {
  try {
    const result = await operation();
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof McpToolError) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    process.stderr.write(`ARC MCP tool failure: ${errorName}\n`);
    return {
      content: [{ type: 'text', text: 'Unexpected server error. Check server diagnostics.' }],
      isError: true,
    };
  }
}
