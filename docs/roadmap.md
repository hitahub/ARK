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

Explore semantic tools such as `get_active_projects()`, `search_slipbox_by_tag()`, and `create_task()` as an alternative interface to generic filesystem access. Evaluate permission boundaries, client compatibility, data freshness, and whether structured responses improve retrieval or token use. Structured output does not inherently prevent hallucinations.

## 3. Vault health checks and Git integration

The report-only `arc health` command now checks broken local Markdown/wikilinks,
orphan notes in ARC content layers, and structural baseline findings. Future
work could improve Markdown compatibility and add an opt-in Git hook integration
for users who want checks before committing. Do not install hooks silently.

## 4. Semantic auto-link suggestions

Explore an offline embedding workflow that suggests related Slipbox notes, potentially using a local model. Suggestions should be reviewable and must not silently rewrite user notes.

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
