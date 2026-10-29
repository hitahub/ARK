# ARC CLI

ARC CLI scaffolds and verifies an **Atomic Rosetta Contextual (ARC)** knowledge vault. It creates an Obsidian-friendly folder structure, Markdown dashboards, and starter templates while preserving existing files.

> The npm package is named `@hitahub/arc`; the executable is named `arc`. The `npx` and `pnpm dlx` commands below require the package to be published and accessible from your configured registry.

## Quick start

```bash
npx @hitahub/arc init ./MyNewVault
npx @hitahub/arc verify ./MyNewVault
npx @hitahub/arc health ./MyNewVault
npx @hitahub/arc update ./MyNewVault
```

Or with pnpm:

```bash
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc verify ./MyNewVault
pnpm dlx @hitahub/arc health ./MyNewVault
pnpm dlx @hitahub/arc update ./MyNewVault
```

Use `arc init` without a path to scaffold the current directory after confirming. Initialization creates missing files and never overwrites existing files.

## Documentation

| Guide                                                    | Description                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Contributing](CONTRIBUTING.md)                          | Development setup, contribution workflow, and pull request guidance.       |
| [Code of Conduct](CODE_OF_CONDUCT.md)                    | Community participation expectations.                                      |
| [Security](SECURITY.md)                                  | How to report security vulnerabilities privately.                          |
| [Getting started](docs/getting-started.md)               | Requirements, install and usage examples, CLI behavior, troubleshooting.   |
| [ARC methodology](docs/methodology.md)                   | ACCESS, Zettelkasten, and iterative project execution.                     |
| [Vault architecture](docs/architecture.md)               | ARC layers, information flow, metadata contract, and design principles.    |
| [Vault structure](docs/vault-structure.md)               | Folder roles, scaffold tree, required baseline, and verification behavior. |
| [Vault workflows](docs/vault-workflows.md)               | Practical capture, project, journal, review, and customization workflows.  |
| [Templates and metadata](docs/templates-and-metadata.md) | Generated notes, frontmatter fields, status values, and Dataview queries.  |
| [Obsidian setup](docs/obsidian-setup.md)                 | Dataview, Templater, Graph View, and AI/filesystem access limitations.     |
| [Development](docs/development.md)                       | Architecture, scripts, tests, build, and CI.                               |
| [Releasing](docs/releasing.md)                           | Manual npm package release checklist.                                      |
| [Roadmap](docs/roadmap.md)                               | Exploratory ideas that are not implemented in the current CLI.             |
| [Project plan](docs/plans/00.plan.md)                    | Current project plan and vault architecture specification.                 |

## Project status

The CLI provides `init`, `verify`, report-only `health`, and confirmed `update` commands. Obsidian plugin automation, MCP services, semantic linking, archive automation, and publishing integrations remain future explorations.

## License

ARC CLI is distributed under the [MIT License](LICENSE).
