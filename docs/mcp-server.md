# ARC MCP server

ARC provides an optional, local, read-only Model Context Protocol (MCP) server
for compatible AI clients. It exposes a small, structured view of an explicitly
selected vault; it does not start automatically and does not change `arc init`.

## Requirements and launch

- Node.js 20 or newer.
- Install `@hitahub/arc` and make the `arc` executable available to the MCP
  client.
- Select an existing, non-symlink vault directory explicitly.
- ARC uses the official TypeScript MCP SDK (`@modelcontextprotocol/sdk`
  `^1.32.2`) and negotiates the protocol version supported by the client.

Start the server directly with:

```bash
arc mcp /absolute/path/to/your/vault
```

The command uses MCP's standard input/output transport. Protocol messages are
written to stdout; diagnostics are written to stderr. The server exits with a
non-zero status if it cannot validate or access the selected vault. No other
vault is selected as a fallback.

Configure an MCP client that supports stdio servers with an entry equivalent
to:

```json
{
  "mcpServers": {
    "arc": {
      "command": "arc",
      "args": ["mcp", "/absolute/path/to/your/vault"]
    }
  }
}
```

Use the client-specific configuration location and restart/reload procedure
for your MCP client. ARC does not register clients or write client
configuration. If the client cannot find `arc` on its `PATH`, configure the
absolute path to the executable as `command`.

## Tools and response shapes

All tools are read-only. Successful results include structured content and a
JSON text representation of the same object. Paths in results are
vault-relative and use `/` separators. Tool errors use MCP's `isError` result
and an actionable text message.

### `get_active_projects`

Takes no arguments. Searches Markdown files inside project folders below
`200_Projects/` for notes whose YAML frontmatter has `type: project` and
`status: active`.

```json
{
  "projects": [
    {
      "path": "200_Projects/210_Project_Alpha/MoC_Project_Alpha.md",
      "title": "Project Alpha",
      "status": "active"
    }
  ],
  "truncated": false
}
```

The title is taken from the first level-one Markdown heading, or falls back to
the filename when no such heading exists.

### `search_slipbox_by_tag`

Takes a non-empty `tag` string of at most 128 characters. Matching is
case-insensitive after trimming surrounding whitespace. It searches only
direct Markdown files in `300_Slipbox/`; a note's `tags` frontmatter field must
be a YAML list of non-empty strings.

```json
{
  "tag": "engineering",
  "notes": [
    {
      "path": "300_Slipbox/Concept_Note.md",
      "title": "Concept Note",
      "tags": ["engineering", "ideas"]
    }
  ],
  "truncated": false
}
```

### `get_note`

Takes a vault-relative Markdown `path` of at most 1,024 characters. It returns
the full content of a project index note under `200_Projects/` or a direct
Markdown note under `300_Slipbox/`.

```json
{
  "path": "300_Slipbox/Concept_Note.md",
  "content": "---\ntype: concept\ntags: [engineering]\n---\n\n# Concept Note\n",
  "sizeBytes": 58
}
```

## Content scope and limits

- Project results are limited to notes below `200_Projects/` with
  `type: project`; a project index must have a non-empty string `status`.
- Slipbox search and note reads are limited to direct Markdown files in
  `300_Slipbox/`.
- Hidden path components, symlinks, traversal paths, and all other vault
  locations are rejected or excluded. `.claudeignore` is not read or treated
  as an access-control policy.
- Frontmatter must be valid YAML. Invalid YAML, invalid consumed metadata, and
  filesystem errors are returned as tool errors instead of being silently
  skipped.
- A note may be at most 65,536 bytes. A scan examines at most 2,000 directory
  entries and 8 MiB total note data. Exceeding a scan budget returns an error
  rather than a partial result.
- At most 50 matches are returned by either search tool. If more matches
  exist, the first 50 paths in sorted order are returned with `truncated:
true`.
- A title may be at most 256 characters. A `tags` list may contain at most 100
  strings, each at most 128 characters. A tool request's stdio message is
  limited to 256 KiB.

These are application-level limits and exclusions, not filesystem
authorization. The server runs with the invoking user's filesystem
permissions. An MCP client or another process with direct filesystem access
may be able to read more than ARC exposes.

## Privacy and security limitations

The server does not write to the vault, execute shell commands, fetch network
resources, follow external links, or configure AI clients. However, it is not a
sandbox or a security boundary. Do not select a vault containing content that
the connected client should not receive. Structured responses do not prevent
hallucinations or prompt injection.

## Troubleshooting

- **Vault directory does not exist:** pass the exact path to the intended
  vault; ARC does not guess another location.
- **Permission denied:** confirm the user running the MCP client can read the
  vault and its permitted content directories.
- **Unsafe symlink:** remove the symlink from the requested path or permitted
  content tree and use a regular in-vault file.
- **Malformed metadata:** fix the reported note's YAML delimiters or consumed
  fields. `type: project` notes require a non-empty string `status`, and
  Slipbox `tags`, when present, must be a YAML list of non-empty strings.
- **The client cannot start the command:** verify the configured executable
  path and the client's stdio MCP configuration, then restart the client.

For general MCP client access limitations, see
[Obsidian setup](obsidian-setup.md#ai-and-filesystem-access).
