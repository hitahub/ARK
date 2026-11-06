# Roadmap

This page summarizes what the repository currently implements and which
directions are still deferred. It is a status overview, not a delivery
schedule, prioritization, or commitment. For command details, safety rules, and
limitations, follow the linked user guides; the implementation and tests are
the source of truth.

## Implemented capabilities

| Area                         | Current status                                                                                                                                                                                        | User-facing reference                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CLI scaffold and maintenance | `init`, `verify`, `health`, and `update` create, check, report on, and update a vault baseline.                                                                                                       | [Getting started](getting-started.md)                                                                                  |
| Obsidian companion           | Built with the CLI and installed by `arc init` by default. Includes read-only Slipbox structure diagnostics, explicit ARC note creation, and active-note unresolved-wikilink diagnostics.             | [Plugin guide](obsidian-plugin.md)                                                                                     |
| MCP integration              | Optional stdio server with read-only `get_active_projects`, `search_slipbox_by_tag`, and `get_note` tools for an explicitly selected vault.                                                           | [MCP guide](mcp-server.md)                                                                                             |
| Health and Git hooks         | Report-only health checks find structural issues, broken local links, and likely orphan notes. Explicit hook commands can run the same checks before commits.                                         | [Health behavior](getting-started.md#health-behavior), [Git hook integration](getting-started.md#git-hook-integration) |
| Link suggestions             | Bounded local lexical suggestions are the default; optional semantic matching uses a local Ollama model. Suggestions are reviewable and never applied automatically. Reports can be saved explicitly. | [Link suggestion behavior](getting-started.md#links-suggest-behavior)                                                  |
| Project lifecycle            | `arc archive` moves a completed project to the archive after preview and confirmation, with collision checks and rollback handling.                                                                   | [Archive behavior](getting-started.md#archive-behavior)                                                                |
| Selected-content export      | `arc publish` previews explicitly selected Markdown and exports to a new local review directory, applying documented exclusions and metadata handling.                                                | [Publish behavior](getting-started.md#publish-behavior)                                                                |

## Deferred or exploratory directions

These are areas that may be considered later. None has a delivery date or
implementation commitment; each needs requirements and feasibility review
before work is scoped.

| Direction                            | Current boundary                                                                                                                | What needs to be decided before implementation                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Obsidian community plugin listing    | Plugin build assets are produced in-repository, but the plugin has not been submitted to the Obsidian community directory.      | Submission ownership, release process, support expectations, and compatibility policy.                      |
| AI-client synchronization            | The plugin does not synchronize task context or vault content with AI clients.                                                  | Transport, user consent, authentication, data scope, lifecycle, and privacy requirements.                   |
| Write-capable MCP tools              | The MCP server is read-only; tools such as task creation are not implemented.                                                   | Allowed write scope, confirmation model, conflict handling, validation, and recovery behavior.              |
| Broader Markdown compatibility       | Health checks intentionally implement bounded local-link and structure heuristics, not a complete Markdown parser or validator. | Required syntax compatibility, parser choice, performance bounds, and expected false-positive behavior.     |
| Link-suggestion caching              | Suggestions are computed per invocation; caching is not part of the current contract.                                           | Invalidation, storage location, privacy implications, and whether performance benefits justify added state. |
| Remote publishing or synchronization | `arc publish` writes only to a new local review directory; it does not upload or sync content.                                  | Target services, credentials, consent, privacy review, conflict behavior, and rollback expectations.        |

## Explicit limitations

- Local Git hooks are optional and can be bypassed; they are not a CI check,
  authorization mechanism, or security guarantee.
- Folder conventions, ignore files, structured outputs, and local integrations
  are not security boundaries. ARC runs with the invoking user's filesystem
  permissions.
- Link suggestions and orphan detection are heuristics. They do not determine
  whether knowledge is correct or conceptually related.
- Local export's metadata checks do not detect sensitive prose. Review exported
  files before sharing them.

For preserved rationale and earlier proposals, see the [project plan index](plans/README.md).
