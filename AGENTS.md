# Repository guidance

This file is a concise working guide for human contributors and coding agents.
Keep instructions actionable and repository-specific; link to detailed
documentation instead of duplicating it.

## Project foundations

- ARC combines clear organizational boundaries (ACCESS), connected atomic
  knowledge (Zettelkasten), and iterative execution (Agile phases). Folders
  help people and clients understand scope; they do not enforce permissions.
- Keep `300_Slipbox/` flat: concept and technical notes belong directly in
  that directory and connect through Obsidian wiki-links.
- Preserve the CLI's non-destructive behavior and user-authored vault content.
  Ignore files and folder conventions are hints, not access controls.
- Keep templates, frontmatter, Dashboard queries, and documented metadata
  vocabularies aligned.

The original design rationale is in
[`docs/plans/00.arc-cli-foundation.plan.md`](docs/plans/00.arc-cli-foundation.plan.md).
That plan records the foundation, not necessarily current behavior. For current
architecture, commands, and validation, follow the implementation and
[`docs/development.md`](docs/development.md); label roadmap ideas as planned
rather than implemented.

## Working in this repository

- Use Node.js 20 or newer and pnpm. The project is ESM; TypeScript source
  imports use `.js` extensions for NodeNext resolution.
- CLI implementation is in `src/cli/`, the Obsidian plugin is in
  `src/obsidian-plugin/`, and tests are in `tests/`.
- Keep changes focused. When observable behavior changes, add or update tests
  and relevant documentation.
- Report filesystem and command errors clearly. Do not silently hide failures
  or add success-shaped fallbacks.
- Do not add credentials, tokens, private keys, or other secrets.

Run the relevant checks before proposing a change:

```bash
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
```

For documentation-only changes, `pnpm format:check` and checking changed
relative Markdown links are sufficient. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`docs/development.md`](docs/development.md) for the full contribution and
development guidance.
