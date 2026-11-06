# ARC CLI

ARC CLI helps you build and maintain an Obsidian vault for connected knowledge,
projects, and journals. It scaffolds an **Atomic Rosetta Contextual (ARC)**
structure and provides commands to check and manage it while preserving your
existing notes.

## Quick start

The package is `@hitahub/arc`; its command is `arc`. The registry commands
below require the package to be published and available from your configured
registry. To run ARC from a local checkout, see [Getting started](docs/getting-started.md#run-from-a-checkout).

```bash
pnpm dlx @hitahub/arc init ./MyVault
pnpm dlx @hitahub/arc verify ./MyVault
pnpm dlx @hitahub/arc health ./MyVault
```

`init` creates the vault structure, dashboards, and starter templates. It also
installs the ARC Obsidian companion plugin by default. Enable it in Obsidian
under **Settings → Community plugins**. ARC does not install or configure
Dataview or Templater; see [Obsidian setup](docs/obsidian-setup.md).

`verify` checks the required folder and file structure. `health` reports
structural issues, broken local links, and likely orphan notes; it is a
read-only heuristic check, not a full Markdown or metadata validator.

Initialization preserves existing files. To skip installing the companion
plugin, use `--no-plugin`. To preview initialization, use `--dry-run`.

## More commands

| Command                                                        | What it does                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `arc update [path]`                                            | Preview and safely update scaffold files. Replaced files are backed up. |
| `arc archive <project-name> [path]`                            | Move a completed project into the archive after confirmation.           |
| `arc links suggest <vault-path>`                               | Suggest related Slipbox notes locally; does not edit notes.             |
| `arc publish <vault-path> <selection...> --output <directory>` | Export selected Markdown notes to a new local review directory.         |
| `arc hook install <vault-path> --repo <path>`                  | Optionally run ARC health checks before commits.                        |
| `arc mcp <vault-path>`                                         | Start an opt-in, read-only MCP server for a selected vault.             |

Commands that change files preview their proposed changes and ask for
confirmation by default. Read each command's guide for its flags, scope, and
safety limits. In particular, `publish` removes YAML front-matter and checks
privacy metadata, but does not detect sensitive prose or upload files. Review
exported content before sharing.

## Documentation

- [Documentation index](docs/README.md): guides organized by user and contributor tasks.
- [Getting started](docs/getting-started.md): installation, commands, and behavior.
- [Roadmap](docs/roadmap.md): implemented capabilities and deferred directions.
- [Contributing](CONTRIBUTING.md): development setup and contribution guidance.
- [Security](SECURITY.md): reporting a vulnerability.
- [Code of Conduct](CODE_OF_CONDUCT.md): community participation expectations.

## Project status

ARC provides local vault setup and maintenance, optional Git and MCP
integrations, Slipbox link suggestions, and selected-content export. The
companion plugin is installed by `init` by default. See the [roadmap](docs/roadmap.md)
for the status and boundaries of current features and deferred directions.

## License

ARC CLI is distributed under the [MIT License](LICENSE).
