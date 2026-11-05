# Development

This document describes the current implementation and how to work on the repository.

## Requirements and setup

- Node.js 20 or newer.
- pnpm.

```bash
pnpm install
```

## Architecture

```text
bin/cli.mjs             Executable entry; imports the built ESM bundle
src/cli/index.ts                  Commander program and error handling
src/cli/commands/                 CLI commands, including archive, link suggestions, and MCP
src/cli/templates/                Markdown/Templater strings and scaffold registry
src/cli/utils/                    Filesystem and logging helpers
src/obsidian-plugin/               Obsidian entry point, templates, and diagnostics
tests/cli/                         CLI unit and integration tests
tests/cli/commands/mcp.test.ts     MCP protocol and filesystem-boundary tests
tests/obsidian-plugin/             Plugin logic unit tests
scripts/build-obsidian-plugin.mjs  Produces files for local install/community release
```

The root package is ESM. TypeScript source imports use `.js` extensions for
NodeNext resolution. `tsup` bundles `src/cli/index.ts` for Node.js 20 into
`dist/cli/index.js`, which the executable wrapper loads. `pnpm build` also
builds the plugin as CommonJS with Obsidian externalized; its manifest, bundle,
and stylesheet are written to `dist/obsidian-plugin/`. These files are included
in the npm package and copied by `arc init` into the vault unless `--no-plugin`
is specified.

### Initialization flow

1. Resolve the requested target path against the current working directory.
2. If no path was supplied, ask for confirmation; a declined prompt exits without creating the scaffold.
3. Load the packaged plugin assets unless plugin installation was disabled.
4. If the installed ARC plugin manifest version differs from the bundled version, ask before updating it; accepted updates back up replaced assets under `.arc-backups/`.
5. Create the standard directories and the current local calendar year's journal folder.
6. Write the registered scaffold and plugin files, preserving existing files unless an ARC plugin version update was accepted.
7. Report created, updated, and preserved files.

Writes use exclusive-create semantics to prevent replacing pre-existing content, including during concurrent initialization attempts. Plugin installation rejects symlinked parent paths to avoid writing outside the vault. On failure, initialization removes only files it created that still contain the generated content, then removes only empty directories it created. Rollback failures are surfaced alongside the original error. `--dry-run` previews planned file changes without writing.

The plugin build derives its manifest version from the root `package.json`, which is the release version source for both CLI and plugin artifacts. Community Plugin submission remains a separate, deferred release decision.

### Verification flow

Verification checks the required directory/file baseline and checks direct entries in `300_Slipbox/` for directories, including symlinks to directories. It allows user content elsewhere. It is a structural check only, not a Markdown/front-matter or Dataview validator.

`health` adds a best-effort local-link scan and inbound-link heuristic for notes in ARC content layers; it also reports `verify` findings. It is read-only and intentionally does not parse Markdown syntax or validate headings and metadata. `update` previews all scaffold additions and replacements, requires confirmation unless `--yes` is supplied, backs up replaced files under `.arc-backups/`, and leaves unchanged files and symlinks alone.
`archive` moves a project marked `status: done` into `900_Archive/Projects/`,
changes its index status to `archived`, rejects collisions and unsafe entries,
and rolls the move back if updating metadata fails.
`hook install` and `hook uninstall` explicitly manage an ARC-owned pre-commit
hook. The hook invokes the existing report-only health command for a resolved
vault path and never replaces an existing hook or custom `core.hooksPath`.
`mcp` starts an opt-in stdio MCP server for an explicitly selected vault. Its
read-only tools expose active project index metadata and direct Slipbox notes;
path validation, YAML parsing, and response/scan limits are implemented in
`src/cli/commands/mcp.ts`. See [ARC MCP server](mcp-server.md) for the public
tool contract and limitations.
`arc links suggest` keeps deterministic lexical matching as its offline
default; the explicit `--semantic --model <name>` mode uses an installed local
Ollama model through the fixed loopback endpoint. See the [link suggestion
behavior](getting-started.md#links-suggest-behavior) for its limits and privacy
contract.

## Useful commands

| Command             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `pnpm build`        | Build the CLI and plugin into `dist/`.                         |
| `pnpm build:plugin` | Build community-plugin-ready files in `dist/obsidian-plugin/`. |
| `pnpm dev`          | Run tsup in watch mode.                                        |
| `pnpm test`         | Run Vitest once.                                               |
| `pnpm test:watch`   | Run Vitest in watch mode.                                      |
| `pnpm typecheck`    | Type-check CLI and plugin sources.                             |
| `pnpm format:check` | Check Prettier formatting without modifying files.             |
| `pnpm format`       | Format project files with Prettier.                            |

For a local command smoke test:

```bash
pnpm build
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
node bin/cli.mjs health ./MyNewVault
node bin/cli.mjs update ./MyNewVault
node bin/cli.mjs mcp /absolute/path/to/your/vault
```

## Tests

Tests use Vitest and run against temporary directories. The current suite covers:

- directory creation and safe write-if-missing behavior;
- template registry, metadata conventions, and front-matter shape;
- init confirmation, current-year folder creation, repeatability, existing-file preservation, and filesystem errors;
- CLI command routing and version registration;
- verify baseline failures, allowed user content, flat Slipbox enforcement, and directory symlinks;
- health findings for broken links, orphans, and structural issues;
- update confirmation, backups, and symlink preservation.
- archive previews, confirmation, collisions, metadata, unsafe entries, and rollback;
- Git hook preview, idempotent install/removal, conflicts, non-Git paths,
  symlink safety, and linked worktrees;
- MCP tool schemas and results, metadata errors, content and result limits,
  vault-relative path boundaries, symlink rejection, and read-only behavior;
- local Slipbox lexical and semantic link suggestion ranking, Ollama request
  failures and limits, scan limits, symlink rejection, CLI routing, and
  read-only behavior;
- plugin installation by default, opt-out, dry-run, collision preservation, and symlink safety.

Run all tests with `pnpm test`.

## Build and package

`npm pack --dry-run` runs the `prepack` build and reports the package contents without publishing. `package.json` includes `bin/`, `dist/`, `docs/`, `README.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md`; npm also includes the package license file. The CLI binary name is `arc` and the npm package name is `@hitahub/arc`.

To publish, first confirm npm organization permissions, registry configuration, and the intended release version. Publication is not performed by the build or pack commands. See the [manual npm release guide](releasing.md).

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` uses Node.js 20 and
pnpm, installs from the frozen lockfile, then runs formatting checks, tests,
typecheck, and both CLI and plugin builds.
It also validates each commit subject in the push or pull request and the pull
request title against the ruleset documented in
[Contributing](../CONTRIBUTING.md).

## Code and documentation guidance

- Keep filesystem writes non-destructive; preserve user-authored vault content.
- Treat `.claudeignore` and folder conventions as hints, not access controls.
- Keep template front-matter, Dashboard queries, and documented metadata/status vocabularies aligned.
- Update tests and these docs when observable CLI behavior changes.
- Keep future roadmap capabilities clearly separated from implemented behavior.
