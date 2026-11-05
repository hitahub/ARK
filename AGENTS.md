# Repository guidance

Keep this guide concise, actionable, and specific to repository-wide work.
Link to detailed documentation rather than duplicating it.

## Project principles

- ARC combines clear organizational boundaries (ACCESS), connected atomic
  knowledge (Zettelkasten), and iterative execution (Agile phases). Folders
  communicate scope; they do not enforce permissions.
- Keep `300_Slipbox/` flat. Put concept and technical notes directly in it and
  connect them with Obsidian wiki-links.
- Preserve the CLI's non-destructive behavior and user-authored vault content.
  Ignore files and folder conventions are organizational hints, not security
  boundaries.
- Keep templates, front-matter, Dashboard queries, and documented metadata
  vocabularies consistent.

The [foundation plan](docs/plans/00.arc-cli-foundation.plan.md) records design
rationale, not necessarily current behavior. Treat the implementation and
[development guide](docs/development.md) as the source of truth; describe
roadmap ideas as planned, not implemented.

## Working in the codebase

- Use Node.js 20 or newer and pnpm. This is an ESM project; TypeScript imports
  use `.js` extensions for NodeNext resolution.
- CLI code is in `src/cli/`, the Obsidian plugin is in `src/obsidian-plugin/`,
  and tests are in `tests/`.
- Keep changes focused. For observable behavior changes, update tests and
  relevant documentation.
- Surface filesystem and command errors; do not hide failures or add
  success-shaped fallbacks. Never add credentials or other secrets.

Run checks relevant to the change. The full validation set is:

```bash
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
```

For documentation-only changes, run `pnpm format:check` and verify changed
relative Markdown links. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[development guide](docs/development.md) for detailed contribution and
validation guidance.
