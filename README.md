# ARC CLI

ARC CLI scaffolds an Atomic Rosetta Contextual (ARC) folder structure and starter Markdown files in an Obsidian vault.

## Requirements

- Node.js 20 or newer
- pnpm for local development

## Local development

```bash
pnpm install
pnpm build
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
pnpm test
pnpm format:check
```

After publishing the package, use `pnpm dlx arc@latest` without a global install:

```bash
pnpm dlx arc@latest init
pnpm dlx arc@latest init ./MyNewVault
pnpm dlx arc@latest verify ./MyNewVault
```

With no path, `init` asks before scaffolding the current directory. Supplying a path skips the prompt. Initialization creates missing files and directories but never overwrites existing files; existing files are reported as preserved. Filesystem failures are reported and return a non-zero exit code. A failure can leave a partially scaffolded directory.

`verify` checks the required ARC baseline while allowing user-added content. It fails if any directory is created directly inside `300_Slipbox/`. Optional sample project content does not affect verification.

## Obsidian setup

The CLI writes Markdown, Dataview query blocks, and Templater templates; it does not install or configure Obsidian plugins. Install Dataview and Templater separately. Configure Templater to use `999_Templates/` and set up any desired folder-template rules. Configure Graph View groups and colors manually in Obsidian.

The generated `.claudeignore` is only a best-effort hint for clients that recognize it. It is not an access-control boundary. Configure filesystem permissions and AI/MCP client access separately.

## Development commands

- `pnpm build` bundles the ESM CLI into `dist/`.
- `pnpm test` runs unit and integration tests.
- `pnpm typecheck` runs the TypeScript compiler without emitting files.
- `pnpm format:check` checks formatting without modifying files.
- `pnpm format` formats supported project files.
