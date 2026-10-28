# ARC CLI

ARC CLI scaffolds and verifies an **Atomic Rosetta Contextual (ARC)** knowledge vault. It creates an Obsidian-friendly folder structure, Markdown dashboards, and starter templates while preserving existing files.

> The npm package is named `@hitahub/arc`; the executable is named `arc`. The `npx` and `pnpm dlx` commands below require the package to be published and accessible from your configured registry.

## Quick start

```bash
npx @hitahub/arc init ./MyNewVault
npx @hitahub/arc verify ./MyNewVault
```

Or with pnpm:

```bash
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc verify ./MyNewVault
```

Use `arc init` without a path to scaffold the current directory after confirming. Initialization creates missing files and never overwrites existing files.

## Documentation

| Guide                                                    | Description                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Contributing](CONTRIBUTING.md)                          | Development setup, contribution workflow, and pull request guidance.       |
| [Code of Conduct](CODE_OF_CONDUCT.md)                    | Community participation expectations.                                      |
| [Getting started](docs/getting-started.md)               | Requirements, install and usage examples, CLI behavior, troubleshooting.   |
| [ARC methodology](docs/methodology.md)                   | ACCESS, Zettelkasten, and iterative project execution.                     |
| [Vault structure](docs/vault-structure.md)               | Folder roles, scaffold tree, required baseline, and verification behavior. |
| [Templates and metadata](docs/templates-and-metadata.md) | Generated notes, frontmatter fields, status values, and Dataview contract. |
| [Obsidian setup](docs/obsidian-setup.md)                 | Dataview, Templater, Graph View, and AI/filesystem access limitations.     |
| [Development](docs/development.md)                       | Architecture, scripts, tests, build, and CI.                               |
| [Releasing](docs/releasing.md)                           | Manual npm package release checklist.                                      |
| [Roadmap](docs/roadmap.md)                               | Exploratory ideas that are not implemented in the current CLI.             |

## Project status

The current CLI provides `init` and `verify`. Obsidian plugin automation, MCP services, health checks, semantic linking, archive automation, and publishing integrations are future explorations, not current features.

## License

ARC CLI is distributed under the [MIT License](LICENSE).
