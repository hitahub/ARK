import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createArcMcpServer, resolveMcpVaultRoot } from '../../../src/cli/commands/mcp.js';

const MAX_NOTE_BYTES = 64 * 1024;
const MAX_SCAN_ENTRIES = 2_000;
const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_RESULTS = 50;

function getStructuredField(
  result: Awaited<ReturnType<Client['callTool']>>,
  field: string,
): unknown {
  const structuredContent: unknown = result.structuredContent;
  if (typeof structuredContent !== 'object' || structuredContent === null) return undefined;
  return Reflect.get(structuredContent, field);
}

describe('ARC MCP server', () => {
  let vaultRoot: string;
  let server: Awaited<ReturnType<typeof createArcMcpServer>>;
  let client: Client;

  beforeEach(async () => {
    vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-mcp-'));
    await fs.mkdir(path.join(vaultRoot, '200_Projects', 'Alpha'), { recursive: true });
    await fs.mkdir(path.join(vaultRoot, '200_Projects', 'Beta'), { recursive: true });
    await fs.mkdir(path.join(vaultRoot, '300_Slipbox'));
    await fs.writeFile(
      path.join(vaultRoot, '200_Projects', 'Alpha', 'MoC_Alpha.md'),
      '---\ntype: project\nstatus: active\n---\n\n# Alpha Project\n',
    );
    await fs.writeFile(
      path.join(vaultRoot, '200_Projects', 'Alpha', 'Task.md'),
      '---\ntype: task\nstatus: todo\n---\n\n# Not an index\n',
    );
    await fs.writeFile(
      path.join(vaultRoot, '200_Projects', 'Beta', 'MoC_Beta.md'),
      '---\ntype: project\nstatus: done\n---\n\n# Completed Project\n',
    );
    await fs.writeFile(
      path.join(vaultRoot, '300_Slipbox', 'concept.md'),
      '---\ntype: concept\ntags: [engineering, ideas]\n---\n\n# Concept Note\n',
    );
    await fs.writeFile(path.join(vaultRoot, '300_Slipbox', '.hidden.md'), '# Hidden\n');

    server = await createArcMcpServer(vaultRoot);
    client = new Client({ name: 'arc-mcp-tests', version: '1.0.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    await fs.rm(vaultRoot, { recursive: true, force: true });
  });

  it('exposes only the three documented read-only tools', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_active_projects',
      'get_note',
      'search_slipbox_by_tag',
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.find((tool) => tool.name === 'get_note')?.inputSchema.properties).toHaveProperty(
      'path',
    );
    expect(
      tools.find((tool) => tool.name === 'search_slipbox_by_tag')?.inputSchema.properties,
    ).toHaveProperty('tag');
  });

  it('returns bounded, structured ARC results over the MCP protocol without writing notes', async () => {
    const active = await client.callTool({ name: 'get_active_projects', arguments: {} });
    expect(active.isError).toBeUndefined();
    expect(active.structuredContent).toEqual({
      projects: [
        {
          path: '200_Projects/Alpha/MoC_Alpha.md',
          title: 'Alpha Project',
          status: 'active',
        },
      ],
      truncated: false,
    });

    const search = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'ENGINEERING' },
    });
    expect(search.isError).toBeUndefined();
    expect(search.structuredContent).toEqual({
      tag: 'ENGINEERING',
      notes: [
        {
          path: '300_Slipbox/concept.md',
          title: 'Concept Note',
          tags: ['engineering', 'ideas'],
        },
      ],
      truncated: false,
    });

    const note = await client.callTool({
      name: 'get_note',
      arguments: { path: '300_Slipbox/concept.md' },
    });
    expect(note.isError).toBeUndefined();
    expect(note.structuredContent).toMatchObject({
      path: '300_Slipbox/concept.md',
      content: expect.stringContaining('# Concept Note'),
    });

    expect(await fs.readFile(path.join(vaultRoot, '300_Slipbox', 'concept.md'), 'utf8')).toContain(
      '# Concept Note',
    );
    expect((await fs.readdir(path.join(vaultRoot, '300_Slipbox'))).sort()).toEqual([
      '.hidden.md',
      'concept.md',
    ]);
  });

  it('rejects traversal, out-of-scope paths, and symlinks', async () => {
    const traversal = await client.callTool({
      name: 'get_note',
      arguments: { path: '../outside.md' },
    });
    expect(traversal.isError).toBe(true);

    const outOfScope = await client.callTool({
      name: 'get_note',
      arguments: { path: '400_Journal/today.md' },
    });
    expect(outOfScope.isError).toBe(true);

    const outsidePath = path.join(os.tmpdir(), `arc-mcp-outside-${path.basename(vaultRoot)}.md`);
    await fs.writeFile(outsidePath, '# Outside secret\n');
    await fs.symlink(outsidePath, path.join(vaultRoot, '300_Slipbox', 'linked.md'), 'file');
    try {
      const linked = await client.callTool({
        name: 'get_note',
        arguments: { path: '300_Slipbox/linked.md' },
      });
      expect(linked.isError).toBe(true);
      expect(JSON.stringify(linked)).not.toContain('Outside secret');
    } finally {
      await fs.unlink(outsidePath);
    }
  });

  it('rejects a selected vault path that is itself a symlink', async () => {
    const aliasPath = `${vaultRoot}-alias`;
    await fs.symlink(vaultRoot, aliasPath, 'dir');
    try {
      await expect(resolveMcpVaultRoot(aliasPath)).rejects.toThrow('non-symlink directory');
    } finally {
      await fs.unlink(aliasPath);
    }
  });

  it('rejects symlink-derived project index paths without reading their content', async () => {
    const externalProject = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-mcp-external-project-'));
    const linkedProject = path.join(vaultRoot, '200_Projects', 'Linked');
    await fs.writeFile(
      path.join(externalProject, 'MoC_External.md'),
      '---\ntype: project\nstatus: active\n---\n\n# External Secret\n',
    );
    await fs.symlink(externalProject, linkedProject, 'dir');

    try {
      const result = await client.callTool({ name: 'get_active_projects', arguments: {} });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain('External Secret');
      expect(JSON.stringify(result)).not.toContain(externalProject);
    } finally {
      await fs.unlink(linkedProject);
      await fs.rm(externalProject, { recursive: true, force: true });
    }
  });

  it('reports malformed YAML instead of silently omitting a Slipbox note', async () => {
    await fs.writeFile(
      path.join(vaultRoot, '300_Slipbox', 'broken.md'),
      '---\ntags: [engineering\n---\n# Broken\n',
    );

    const result = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'engineering' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContainEqual(
      expect.objectContaining({ type: 'text', text: expect.stringContaining('Malformed YAML') }),
    );
  });

  it('returns a protocol validation error for an oversized search argument', async () => {
    const exactlyAtLimit = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'x'.repeat(128) },
    });
    expect(exactlyAtLimit.isError).toBeUndefined();

    const result = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'x'.repeat(129) },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining(
          'Input validation error: Invalid arguments for tool search_slipbox_by_tag',
        ),
      }),
    );
  });

  it('accepts a path at its schema limit and rejects a longer path', async () => {
    const pathAtLimit = `300_Slipbox/${'x'.repeat(1_024 - '300_Slipbox/'.length - '.md'.length)}.md`;
    const validLength = await client.callTool({
      name: 'get_note',
      arguments: { path: pathAtLimit },
    });
    expect(validLength.isError).toBe(true);
    expect(validLength.content).not.toContainEqual(
      expect.objectContaining({ text: expect.stringContaining('Input validation error') }),
    );

    const overLimit = await client.callTool({
      name: 'get_note',
      arguments: { path: `${pathAtLimit}x` },
    });
    expect(overLimit.isError).toBe(true);
    expect(overLimit.content).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining(
          'Input validation error: Invalid arguments for tool get_note',
        ),
      }),
    );
  });

  it('caps returned matches and enforces the exact note content size limit', async () => {
    for (let index = 0; index < MAX_RESULTS; index += 1) {
      await fs.writeFile(
        path.join(vaultRoot, '300_Slipbox', `match-${index}.md`),
        '---\ntags: [bounded]\n---\n',
      );
    }
    const exactlyAtLimit = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'bounded' },
    });
    expect(getStructuredField(exactlyAtLimit, 'truncated')).toBe(false);
    expect(getStructuredField(exactlyAtLimit, 'notes')).toHaveLength(MAX_RESULTS);

    await fs.writeFile(
      path.join(vaultRoot, '300_Slipbox', `match-${MAX_RESULTS}.md`),
      '---\ntags: [bounded]\n---\n',
    );
    const results = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'bounded' },
    });
    expect(getStructuredField(results, 'truncated')).toBe(true);
    expect(getStructuredField(results, 'notes')).toHaveLength(MAX_RESULTS);

    const exactLimitContent = 'x'.repeat(MAX_NOTE_BYTES);
    await fs.writeFile(path.join(vaultRoot, '300_Slipbox', 'sized.md'), exactLimitContent);
    const exactLimit = await client.callTool({
      name: 'get_note',
      arguments: { path: '300_Slipbox/sized.md' },
    });
    expect(exactLimit.isError).toBeUndefined();
    expect(exactLimit.structuredContent).toMatchObject({ sizeBytes: MAX_NOTE_BYTES });

    await fs.writeFile(path.join(vaultRoot, '300_Slipbox', 'sized.md'), `${exactLimitContent}x`);
    const overLimit = await client.callTool({
      name: 'get_note',
      arguments: { path: '300_Slipbox/sized.md' },
    });
    expect(overLimit.isError).toBe(true);
    expect(overLimit.content).toContainEqual(
      expect.objectContaining({ type: 'text', text: expect.stringContaining('content limit') }),
    );
  });

  it('allows exactly the scan byte budget and errors when it is exceeded', async () => {
    await fs.unlink(path.join(vaultRoot, '300_Slipbox', 'concept.md'));
    const frontmatter = '---\ntags: [scan]\n---\n\n';
    const noteContent = `${frontmatter}${'x'.repeat(
      MAX_NOTE_BYTES - Buffer.byteLength(frontmatter),
    )}`;
    for (let index = 0; index < MAX_SCAN_BYTES / MAX_NOTE_BYTES; index += 1) {
      await fs.writeFile(
        path.join(vaultRoot, '300_Slipbox', `scan-${String(index).padStart(3, '0')}.md`),
        noteContent,
      );
    }

    const exactlyAtLimit = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'scan' },
    });
    expect(exactlyAtLimit.isError).toBeUndefined();
    expect(exactlyAtLimit.structuredContent).toMatchObject({ truncated: true });

    await fs.writeFile(path.join(vaultRoot, '300_Slipbox', 'z-overflow.md'), 'x');
    const overLimit = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'scan' },
    });
    expect(overLimit.isError).toBe(true);
    expect(overLimit.content).toContainEqual(
      expect.objectContaining({ type: 'text', text: expect.stringContaining('scan limit') }),
    );
  });

  it('allows exactly the scan entry budget and rejects one additional entry', async () => {
    await fs.unlink(path.join(vaultRoot, '300_Slipbox', 'concept.md'));
    for (let index = 0; index < MAX_SCAN_ENTRIES - 1; index += 1) {
      await fs.writeFile(
        path.join(vaultRoot, '300_Slipbox', `entry-${String(index).padStart(4, '0')}.md`),
        '',
      );
    }

    const exactlyAtLimit = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'entry' },
    });
    expect(exactlyAtLimit.isError).toBeUndefined();
    expect(exactlyAtLimit.structuredContent).toMatchObject({
      notes: [],
      truncated: false,
    });

    await fs.writeFile(path.join(vaultRoot, '300_Slipbox', 'z-overflow.md'), '');
    const overLimit = await client.callTool({
      name: 'search_slipbox_by_tag',
      arguments: { tag: 'entry' },
    });
    expect(overLimit.isError).toBe(true);
    expect(overLimit.content).toContainEqual(
      expect.objectContaining({ type: 'text', text: expect.stringContaining('entry scan limit') }),
    );
  });
});
