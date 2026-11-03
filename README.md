# ARC CLI

ARC CLI scaffolds, verifies, inspects, and safely updates an **Atomic Rosetta Contextual (ARC)** knowledge vault. It creates an Obsidian-friendly folder structure, Markdown dashboards, and starter templates while preserving existing files unless a user confirms a plugin version update.

> The npm package is named `@hitahub/arc`; the executable is named `arc`. The `npx` and `pnpm dlx` commands below require the package to be published and accessible from your configured registry.

## Quick start

```bash
npx @hitahub/arc init ./MyNewVault
npx @hitahub/arc verify ./MyNewVault
npx @hitahub/arc health ./MyNewVault
npx @hitahub/arc update ./MyNewVault
npx @hitahub/arc archive "Project Alpha" ./MyNewVault --dry-run
```

Or with pnpm:

```bash
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc verify ./MyNewVault
pnpm dlx @hitahub/arc health ./MyNewVault
pnpm dlx @hitahub/arc update ./MyNewVault
pnpm dlx @hitahub/arc archive "Project Alpha" ./MyNewVault --dry-run
```

Use `arc init` without a path to scaffold the current directory after confirming. Initialization creates missing files and preserves existing ones, except for an ARC plugin update explicitly confirmed by the user.

`init` and `update` support `--dry-run` to preview changes. `update --yes` applies
the preview without prompting; changed scaffold files are backed up under
`.arc-backups/` before replacement.

`archive` previews and confirms moving a project marked `status: done` from
`200_Projects/` to `900_Archive/Projects/`. It updates the project index to
`status: archived`; use `--yes` for non-interactive use.

`init` also installs the ARC Obsidian companion plugin by default into
`.obsidian/plugins/arc-obsidian-plugin/`. Use `--no-plugin` to skip it. Existing
plugin files are preserved unless the installed ARC plugin version differs from
the CLI bundle; in that case, `init` asks before updating and backs up replaced
files under `.arc-backups/`. Declining preserves the installed plugin. Obsidian
still requires enabling the plugin in its settings.

## Documentation

| Guide                                                               | Description                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Contributing](CONTRIBUTING.md)                                     | Development setup, contribution workflow, and pull request guidance.       |
| [Code of Conduct](CODE_OF_CONDUCT.md)                               | Community participation expectations.                                      |
| [Security](SECURITY.md)                                             | How to report security vulnerabilities privately.                          |
| [Getting started](docs/getting-started.md)                          | Requirements, install and usage examples, CLI behavior, troubleshooting.   |
| [ARC methodology](docs/methodology.md)                              | ACCESS, Zettelkasten, and iterative project execution.                     |
| [Vault architecture](docs/architecture.md)                          | ARC layers, information flow, metadata contract, and design principles.    |
| [Vault structure](docs/vault-structure.md)                          | Folder roles, scaffold tree, required baseline, and verification behavior. |
| [Vault workflows](docs/vault-workflows.md)                          | Practical capture, project, journal, review, and customization workflows.  |
| [Templates and metadata](docs/templates-and-metadata.md)            | Generated notes, frontmatter fields, status values, and Dataview queries.  |
| [Obsidian setup](docs/obsidian-setup.md)                            | Dataview, Templater, Graph View, and AI/filesystem access limitations.     |
| [ARC Obsidian plugin](docs/obsidian-plugin.md)                      | Automatic installation, manual builds, and supported features.             |
| [Development](docs/development.md)                                  | Architecture, scripts, tests, build, and CI.                               |
| [Releasing](docs/releasing.md)                                      | Manual npm package release checklist.                                      |
| [Roadmap](docs/roadmap.md)                                          | Current ecosystem capabilities and exploratory directions.                 |
| [Plan index](docs/plans/README.md)                                  | Plan naming convention and project plan documents.                         |
| [Project foundation plan](docs/plans/00.arc-cli-foundation.plan.md) | Original CLI scope and architecture specification.                         |

## Project status

The CLI provides `init`, `verify`, report-only `health`, confirmed `update`,
and safe project `archive` commands. The ARC Obsidian companion is installed
by `init` by default and can be skipped with `--no-plugin`; MCP services,
semantic linking, and publishing integrations remain future explorations.

## License

ARC CLI is distributed under the [MIT License](LICENSE).
