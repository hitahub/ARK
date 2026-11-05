# ARC CLI

ARC CLI helps you build and maintain an Obsidian vault for connected knowledge,
projects, and journals. It scaffolds an **Atomic Rosetta Contextual (ARC)**
structure and provides commands to check and manage it while preserving your
existing notes.

## Quick start

The npm package is `@hitahub/arc`; its command is `arc`. The registry commands
below require the package to be published and available from your configured
registry. To run ARC from a local checkout, see [Getting started](docs/getting-started.md#run-from-a-checkout).

```bash
npx @hitahub/arc init ./MyVault
npx @hitahub/arc verify ./MyVault
npx @hitahub/arc health ./MyVault
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
safety limits. In particular, `publish` removes YAML frontmatter and checks
privacy metadata, but does not detect sensitive prose or upload files. Review
exported content before sharing.

## Documentation

### Using ARC

- [Getting started](docs/getting-started.md): installation, commands, and behavior.
- [ARC methodology](docs/methodology.md): the ideas behind the ARC approach.
- [Vault architecture](docs/architecture.md): layers, information flow, and metadata.
- [Vault structure](docs/vault-structure.md): folders and verification requirements.
- [Vault workflows](docs/vault-workflows.md): capture, projects, journals, and reviews.
- [Templates and metadata](docs/templates-and-metadata.md): generated notes and fields.

### Obsidian setup

- [Obsidian setup](docs/obsidian-setup.md): Dataview, Templater, and Graph View.
- [ARC Obsidian plugin](docs/obsidian-plugin.md): companion features and installation.

### Contributing and project information

- [Contributing](CONTRIBUTING.md): development setup and pull request guidance.
- [Development](docs/development.md): architecture, scripts, tests, and CI.
- [Security](SECURITY.md): reporting a vulnerability.
- [Code of Conduct](CODE_OF_CONDUCT.md): community participation expectations.
- [Releasing](docs/releasing.md): manual npm release guide.
- [Roadmap](docs/roadmap.md): current capabilities and exploratory directions.
- [Plan index](docs/plans/README.md): project plan documents.

## Project status

ARC provides local vault setup and maintenance, optional Git and MCP
integrations, Slipbox link suggestions, and selected-content export. The
companion plugin is installed by `init` by default. Remote publishing and
synchronization are out of scope.

## License

ARC CLI is distributed under the [MIT License](LICENSE).
