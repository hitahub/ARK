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
src/index.ts            Commander program, command registration, and error handling
src/commands/init.ts    Vault path, confirmation, directories, and file creation
src/commands/verify.ts  Required baseline and flat-Slipbox checks
src/commands/health.ts  Internal links, orphan notes, and structure reporting
src/commands/update.ts  Preview, confirmation, backups, and scaffold updates
src/templates/          Markdown/Templater strings and vault-relative file registry
src/utils/fileSystem.ts Directory creation and exclusive write-if-missing helper
src/utils/logger.ts     Consistent styled CLI output
tests/                  Vitest unit and integration tests
```

The package is ESM. TypeScript source imports use `.js` extensions for NodeNext resolution. `tsup` bundles `src/index.ts` for Node.js 20 into `dist/index.js`, which the executable wrapper loads.

### Initialization flow

1. Resolve the requested target path against the current working directory.
2. If no path was supplied, ask for confirmation; a declined prompt exits without creating the scaffold.
3. Create the standard directories and the current local calendar year's journal folder.
4. Write the registered scaffold files and `.gitkeep` markers only when missing.
5. Report created and preserved files.

Writes use exclusive-create semantics to prevent replacing pre-existing content, including during concurrent initialization attempts. On failure, initialization removes only files it created that still contain the generated content, then removes only empty directories it created. Rollback failures are surfaced alongside the original error. `--dry-run` previews planned file changes without writing.

### Verification flow

Verification checks the required directory/file baseline and checks direct entries in `300_Slipbox/` for directories, including symlinks to directories. It allows user content elsewhere. It is a structural check only, not a Markdown/frontmatter or Dataview validator.

`health` adds a best-effort local-link scan and inbound-link heuristic for notes in ARC content layers; it also reports `verify` findings. It is read-only and intentionally does not parse Markdown syntax or validate headings and metadata. `update` previews all scaffold additions and replacements, requires confirmation unless `--yes` is supplied, backs up replaced files under `.arc-backups/`, and leaves unchanged files and symlinks alone.

## Useful commands

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `pnpm build`        | Build `dist/index.js`.                             |
| `pnpm dev`          | Run tsup in watch mode.                            |
| `pnpm test`         | Run Vitest once.                                   |
| `pnpm test:watch`   | Run Vitest in watch mode.                          |
| `pnpm typecheck`    | Run `tsc --noEmit`.                                |
| `pnpm format:check` | Check Prettier formatting without modifying files. |
| `pnpm format`       | Format project files with Prettier.                |

For a local command smoke test:

```bash
pnpm build
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
node bin/cli.mjs health ./MyNewVault
node bin/cli.mjs update ./MyNewVault
```

## Tests

Tests use Vitest and run against temporary directories. The current suite covers:

- directory creation and safe write-if-missing behavior;
- template registry, metadata conventions, and frontmatter shape;
- init confirmation, current-year folder creation, repeatability, existing-file preservation, and filesystem errors;
- CLI command routing and version registration;
- verify baseline failures, allowed user content, flat Slipbox enforcement, and directory symlinks;
- health findings for broken links, orphans, and structural issues;
- update confirmation, backups, and symlink preservation.

Run all tests with `pnpm test`.

## Build and package

`npm pack --dry-run` runs the `prepack` build and reports the package contents without publishing. `package.json` includes `bin/`, `dist/`, `docs/`, `README.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md`; npm also includes the package license file. The CLI binary name is `arc` and the npm package name is `@hitahub/arc`.

To publish, first confirm npm organization permissions, registry configuration, and the intended release version. Publication is not performed by the build or pack commands. See the [manual npm release guide](releasing.md).

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` uses Node.js 20 and pnpm, installs from the frozen lockfile, then runs formatting checks, tests, typecheck, and build.

## Code and documentation guidance

- Keep filesystem writes non-destructive; preserve user-authored vault content.
- Treat `.claudeignore` and folder conventions as hints, not access controls.
- Keep template frontmatter, Dashboard queries, and documented metadata/status vocabularies aligned.
- Update tests and these docs when observable CLI behavior changes.
- Keep future roadmap capabilities clearly separated from implemented behavior.
