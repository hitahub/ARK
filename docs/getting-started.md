# Getting started

This guide covers installing and using ARC CLI. For the concepts behind the folder model, see [ARC methodology](methodology.md).

## Requirements

- Node.js 20 or newer.
- To use the generated Dataview queries and Templater templates in Obsidian, install those community plugins separately. See [Obsidian setup](obsidian-setup.md).
- `arc init` installs the ARC Vault Companion files by default; enable it from Obsidian's Community plugins settings.

## Run from the registry

The package name is `@hitahub/arc`; its binary command is `arc`. Once the package has been published and is accessible from your npm registry:

```bash
# Initialize the current directory. The CLI asks for confirmation.
npx @hitahub/arc init

# Initialize a particular vault directory.
npx @hitahub/arc init ./MyNewVault
npx @hitahub/arc init ./MyNewVault --no-plugin

# Verify the current directory or a specified vault.
npx @hitahub/arc verify
npx @hitahub/arc verify ./MyNewVault
npx @hitahub/arc health ./MyNewVault
npx @hitahub/arc update ./MyNewVault
npx @hitahub/arc archive "Project Alpha" ./MyNewVault --dry-run
npx @hitahub/arc links suggest ./MyNewVault
npx @hitahub/arc hook install ./MyNewVault --repo . --dry-run
npx @hitahub/arc init ./PreviewVault --dry-run
npx @hitahub/arc update ./MyNewVault --dry-run
```

Equivalent commands using pnpm:

```bash
pnpm dlx @hitahub/arc init
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc init ./MyNewVault --no-plugin
pnpm dlx @hitahub/arc verify
pnpm dlx @hitahub/arc verify ./MyNewVault
pnpm dlx @hitahub/arc health ./MyNewVault
pnpm dlx @hitahub/arc update ./MyNewVault
pnpm dlx @hitahub/arc archive "Project Alpha" ./MyNewVault --dry-run
pnpm dlx @hitahub/arc links suggest ./MyNewVault
pnpm dlx @hitahub/arc hook install ./MyNewVault --repo . --dry-run
```

If installed globally, invoke the binary directly:

```bash
npm install --global @hitahub/arc
arc init ./MyNewVault
arc verify ./MyNewVault
arc health ./MyNewVault
arc update ./MyNewVault
arc archive "Project Alpha" ./MyNewVault --dry-run
arc links suggest ./MyNewVault
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
node bin/cli.mjs links suggest ./MyNewVault
```

The package is not downloaded from the registry when using `node bin/cli.mjs`.

## `init` behavior

`arc init [path]` creates the ARC baseline in the target directory.

- If `path` is omitted, the target is the current working directory and the CLI asks for confirmation before writing.
- If `path` is supplied, the CLI creates that directory if necessary and does not prompt.
- Missing directories and generated files are created. Existing scaffold files are preserved and reported; there is no general overwrite/force mode.
- A directory occupying a generated file path is an error.
- A local-calendar-year folder is created in `400_Journal/`.
- The ARC Obsidian companion's `manifest.json`, `main.js`, and `styles.css` are installed to `.obsidian/plugins/arc-obsidian-plugin/` by default. Existing files are preserved unless the installed ARC plugin version differs, in which case `init` asks before updating and backs up replaced files under `.arc-backups/`. Use `--no-plugin` to skip the plugin; Obsidian must still be told to enable it in Settings.
- `--dry-run` also previews the plugin files. Plugin installation requires the bundled plugin assets; `pnpm build` creates them for checkout usage.
- An I/O error is surfaced and results in a non-zero process exit code. Newly created files that still contain generated content and empty directories are rolled back; existing or subsequently changed content is left intact.
- `--dry-run` previews files without writing. The current-directory confirmation still applies when the path is omitted.

## `verify` behavior

`arc verify [path]` defaults to the current directory. It checks the required directories and files listed in [Vault structure](vault-structure.md), and rejects directories directly inside `300_Slipbox/`.

Additional user folders and files are allowed. The example project is scaffolded by `init`, but is not required for `verify` to pass. An invalid vault or a filesystem/command error exits non-zero.

## `health` behavior

`arc health [path]` reports unresolved local Markdown and Obsidian wikilinks, notes under the ARC content layers with no inbound links, and all structural findings from `verify`. External URLs, links inside code, template source files, and valid links to folders are ignored. It is a report-only check: it never changes the vault. Findings cause a non-zero exit status. Orphan detection is heuristic and does not validate headings, metadata fields, or Dataview query results.

## `links suggest` behavior

`arc links suggest <vault-path>` requires an explicit vault directory and
analyzes only direct, non-hidden Markdown files in `300_Slipbox/`. It uses
deterministic local TF-IDF cosine similarity; frontmatter and code blocks do
not contribute to matching. The report shows at most 20 pairs that share at
least two non-stopword terms and meet the minimum similarity threshold,
alongside the strongest shared terms. Scores are heuristic and do not establish
that notes are meaningfully related. The minimum cosine similarity is 0.12.

The scan is bounded to 500 notes, 64 KiB per note, 8 MiB total content, 100,000
unique terms, 2,000 directory entries, and 1,000,000 term-pair comparisons.
Exceeding a limit or encountering an unsafe symlink or unreadable/invalid note
is reported as an error rather than silently truncating results. The command
performs no network requests, model downloads, caching, or file writes. Review
every suggestion and apply any links manually.

## Git hook integration

ARC can run its existing `health` checks before commits through an explicitly
installed local Git `pre-commit` hook. Nothing in `init`, `health`, or other
commands installs or changes hooks.

Run the command from the Git repository (or pass its path with `--repo`); the
vault path is required and may be outside the repository:

```bash
arc hook install ./MyNewVault --repo . --dry-run
arc hook install ./MyNewVault --repo .
arc hook uninstall --repo .
```

The preview reports the hook and vault paths without changing files. Installation
rejects custom `core.hooksPath` settings, occupied hook locations, and unsafe
symlinked hook paths; it never replaces or chains an existing hook. Repeating
installation for the same vault is safe. Removal deletes only an intact ARC
hook and can also be previewed with `--dry-run`.

The hook invokes the `arc health` check for the resolved vault path. Run
`arc health` before installation to review existing findings; any health
finding or operational error blocks commits. Checks remain read-only and do
not modify notes or the index. Because the hook is local clone configuration,
it is not shared with teammates and is not an access-control, security, or CI
guarantee. CI and other repository policy should enforce any required checks
independently. The hook uses the Node and ARC installation active during setup;
uninstall it before moving/removing that installation, or reinstall it at its
new location. If checks are too slow for interactive commits, opt out with
`arc hook uninstall --repo .`.

Git hook integration is optional and user-managed. Do not opt another user or
repository into it without their explicit consent.

## `update` behavior

`arc update [path]` previews scaffold files that would be added or replaced and asks for confirmation (default: no). Replaced files are backed up under `.arc-backups/<timestamp>/` before updating; identical files remain untouched and symlinked scaffold files are preserved. `--yes` accepts the displayed preview for non-interactive use, while `--dry-run` prints it without prompting or writing.

## `archive` behavior

`arc archive <project-name> [path]` moves the matching direct child of
`200_Projects/` to `900_Archive/Projects/<project-name>/`. The project must
contain exactly one Markdown note with `type: project` and `status: done`.
Archiving changes only that note's status to `archived`; other files and note
contents are preserved. The CLI previews the move and asks for confirmation
(default: no). Use `--dry-run` to preview without prompting or writing, or
`--yes` to confirm non-interactively.

An existing destination is never overwritten. The CLI rejects symlinks and
special files anywhere inside the project, as well as symlinked archive
directories. If metadata cannot be updated after the move, ARC attempts to move
the project back; an incomplete rollback is reported explicitly. Project
contents are not rewritten to update path-qualified links, so review those
references after moving; basename wikilinks and links between files inside the
project retain their existing content.

## Troubleshooting

### The `npx` or `pnpm dlx` command cannot find the package

The scoped package must first be published to a registry, and your npm configuration must have access to that scope. Local checkout usage does not require publishing.

### Obsidian displays the query blocks as text or templates do not run

Install and enable Dataview and Templater in Obsidian. Configure Templater to use `999_Templates/` and set any desired folder-template rules; creating template files does not enable or assign the plugins automatically. See [Obsidian setup](obsidian-setup.md).

### Verification reports a Slipbox directory

Move the folder out of `300_Slipbox/` or flatten its notes. The ARC rule forbids direct child directories there; files may remain directly in the Slipbox.
