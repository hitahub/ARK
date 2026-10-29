# Getting started

This guide covers installing and using ARC CLI. For the concepts behind the folder model, see [ARC methodology](methodology.md).

## Requirements

- Node.js 20 or newer.
- To use the generated Dataview queries and Templater templates in Obsidian, install those community plugins separately. See [Obsidian setup](obsidian-setup.md).

## Run from the registry

The package name is `@hitahub/arc`; its binary command is `arc`. Once the package has been published and is accessible from your npm registry:

```bash
# Initialize the current directory. The CLI asks for confirmation.
npx @hitahub/arc init

# Initialize a particular vault directory.
npx @hitahub/arc init ./MyNewVault

# Verify the current directory or a specified vault.
npx @hitahub/arc verify
npx @hitahub/arc verify ./MyNewVault
npx @hitahub/arc health ./MyNewVault
npx @hitahub/arc update ./MyNewVault
npx @hitahub/arc init ./PreviewVault --dry-run
npx @hitahub/arc update ./MyNewVault --dry-run
```

Equivalent commands using pnpm:

```bash
pnpm dlx @hitahub/arc init
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc verify
pnpm dlx @hitahub/arc verify ./MyNewVault
pnpm dlx @hitahub/arc health ./MyNewVault
pnpm dlx @hitahub/arc update ./MyNewVault
```

If installed globally, invoke the binary directly:

```bash
npm install --global @hitahub/arc
arc init ./MyNewVault
arc verify ./MyNewVault
arc health ./MyNewVault
arc update ./MyNewVault
```

## Run from a checkout

For local development or before publication:

```bash
pnpm install
pnpm build
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
node bin/cli.mjs health ./MyNewVault
node bin/cli.mjs update ./MyNewVault
```

The package is not downloaded from the registry when using `node bin/cli.mjs`.

## `init` behavior

`arc init [path]` creates the ARC baseline in the target directory.

- If `path` is omitted, the target is the current working directory and the CLI asks for confirmation before writing.
- If `path` is supplied, the CLI creates that directory if necessary and does not prompt.
- Missing directories and generated files are created. Existing files are preserved and reported; there is no overwrite/force mode.
- A directory occupying a generated file path is an error.
- A local-calendar-year folder is created in `400_Journal/`.
- An I/O error is surfaced and results in a non-zero process exit code. Newly created files that still contain generated content and empty directories are rolled back; existing or subsequently changed content is left intact.
- `--dry-run` previews files without writing. The current-directory confirmation still applies when the path is omitted.

## `verify` behavior

`arc verify [path]` defaults to the current directory. It checks the required directories and files listed in [Vault structure](vault-structure.md), and rejects directories directly inside `300_Slipbox/`.

Additional user folders and files are allowed. The example project is scaffolded by `init`, but is not required for `verify` to pass. An invalid vault or a filesystem/command error exits non-zero.

## `health` behavior

`arc health [path]` reports unresolved local Markdown and Obsidian wikilinks, notes under the ARC content layers with no inbound links, and all structural findings from `verify`. External URLs, links inside code, template source files, and valid links to folders are ignored. It is a report-only check: it never changes the vault. Findings cause a non-zero exit status. Orphan detection is heuristic and does not validate headings, metadata fields, or Dataview query results.

## `update` behavior

`arc update [path]` previews scaffold files that would be added or replaced and asks for confirmation (default: no). Replaced files are backed up under `.arc-backups/<timestamp>/` before updating; identical files remain untouched and symlinked scaffold files are preserved. `--yes` accepts the displayed preview for non-interactive use, while `--dry-run` prints it without prompting or writing.

## Troubleshooting

### The `npx` or `pnpm dlx` command cannot find the package

The scoped package must first be published to a registry, and your npm configuration must have access to that scope. Local checkout usage does not require publishing.

### Obsidian displays the query blocks as text or templates do not run

Install and enable Dataview and Templater in Obsidian. Configure Templater to use `999_Templates/` and set any desired folder-template rules; creating template files does not enable or assign the plugins automatically. See [Obsidian setup](obsidian-setup.md).

### Verification reports a Slipbox directory

Move the folder out of `300_Slipbox/` or flatten its notes. The ARC rule forbids direct child directories there; files may remain directly in the Slipbox.
