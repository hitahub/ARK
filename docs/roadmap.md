# Roadmap (exploratory)

The CLI currently supports `init`, `verify`, `health`, `update`, and `archive`. Roadmap items
below distinguish available repository capabilities from future ideas. Each
future direction needs feasibility, security, and requirements review before
implementation commitments are made.

## 1. ARC Obsidian plugin

An in-repository companion plugin is available under
`src/obsidian-plugin/`. `pnpm build` produces its files alongside the CLI, and
`arc init` installs them into the vault by default (or skips them with
`--no-plugin`). See the [plugin guide](obsidian-plugin.md) for details. It
provides a read-only Slipbox structure warning, explicit ARC note creation, and
unresolved-wikilink diagnostics for the active note.

The plugin does not prevent or automatically repair filesystem changes, modify
existing notes, or synchronize task context with AI clients. AI-client sync
remains deferred until transport, consent, authentication, and lifecycle
requirements are defined. The repository package is not yet published through
the Obsidian community plugin directory.

## 2. ARC-aware MCP server

The optional, read-only `arc mcp <vault-path>` server exposes
`get_active_projects`, `search_slipbox_by_tag`, and `get_note` over MCP stdio.
It limits access to project index notes and direct Slipbox notes in the
explicitly selected vault. See the [MCP server guide](mcp-server.md) for its
contract and filesystem limitations.

Write-capable tools such as `create_task()` remain exploratory and require a
separate scope decision. Structured output does not inherently prevent
hallucinations or provide a security boundary.

## 3. Vault health checks and Git integration

The report-only `arc health` command now checks broken local Markdown/wikilinks,
orphan notes in ARC content layers, and structural baseline findings. The
explicit `arc hook install|uninstall` commands optionally run those same checks
before commits; they preview changes, reject occupied or custom hook locations,
and never install hooks silently. Future work could improve Markdown
compatibility. Local hooks are not a CI or security guarantee.

## 4. Slipbox link suggestions

`arc links suggest <vault-path>` reports bounded, deterministic lexical
matches among direct Markdown notes in `300_Slipbox/`. It is offline and
read-only; users review and apply any links themselves. Embedding-based
matching, model management, caching, and saved reports remain exploratory
follow-ups, not current behavior. See
[Getting started](getting-started.md#links-suggest-behavior) for its limits.

## 5. Project lifecycle automation

The `arc archive <project-name> [path]` command moves a project marked
`status: done` from `200_Projects/` to `900_Archive/Projects/` and updates its
index to `status: archived`. It previews and confirms by default, supports
`--dry-run` and `--yes`, rejects collisions and unsafe project entries, and
attempts rollback if the metadata update fails. User-authored path-qualified
links are not rewritten; review them after moving. See
[Getting started](getting-started.md#archive-behavior) for its safety contract.

## 6. Publishing selected content

Explore exporting explicitly selected workspaces to static sites or publishing platforms. Privacy-sensitive metadata, excluded folders, and preview/review workflows would need to be specified first.
