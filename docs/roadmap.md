# Roadmap (exploratory)

Everything on this page is a **future idea**, not functionality currently implemented by ARC CLI. The current CLI supports only `init` and `verify`. Each direction needs feasibility, security, and requirements review before implementation commitments are made.

## 1. ARC Obsidian plugin

Explore a native Obsidian plugin that could complement or replace parts of the external template workflow:

- Slipbox warnings or enforcement, after verifying the supported APIs and how external filesystem changes are handled.
- Native note injection based on the destination folder, after validating Obsidian file-creation hooks.
- Editor diagnostics for isolated or unclear wikilinks, preferably with opt-in correction.
- Optional synchronization of task context to local AI clients, with explicit transport, consent, authentication, and lifecycle requirements.

These are feasibility questions; no plugin currently ships in this repository.

## 2. ARC-aware MCP server

Explore semantic tools such as `get_active_projects()`, `search_slipbox_by_tag()`, and `create_task()` as an alternative interface to generic filesystem access. Evaluate permission boundaries, client compatibility, data freshness, and whether structured responses improve retrieval or token use. Structured output does not inherently prevent hallucinations.

## 3. Vault health checks and Git integration

Consider an `arc health` command that reports orphaned notes, broken links, and ARC rule violations. Git hooks could be an opt-in integration for users who want vault checks before committing. Do not install hooks silently.

## 4. Semantic auto-link suggestions

Explore an offline embedding workflow that suggests related Slipbox notes, potentially using a local model. Suggestions should be reviewable and must not silently rewrite user notes.

## 5. Project lifecycle automation

Consider an `arc archive` command to move completed projects into cold storage and update project metadata. Define collision handling, rollback behavior, link updates, and confirmation requirements before implementing file moves.

## 6. Publishing selected content

Explore exporting explicitly selected workspaces to static sites or publishing platforms. Privacy-sensitive metadata, excluded folders, and preview/review workflows would need to be specified first.
