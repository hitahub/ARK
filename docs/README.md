# Documentation

Use this index to find the guide that matches what you want to do. The
repository [README](../README.md) is the project overview and quick start; this
page is the detailed documentation map.

## Use ARC

| If you want to...                                            | Start here                                          | Related reference                                            |
| ------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------ |
| Install ARC, run commands, or understand command behavior    | [Getting started](getting-started.md)               | [Vault structure](vault-structure.md)                        |
| Understand the ideas behind ARC                              | [ARC methodology](methodology.md)                   | [Vault architecture](architecture.md)                        |
| Set up Obsidian plugins and Graph View                       | [Obsidian setup](obsidian-setup.md)                 | [ARC Obsidian plugin](obsidian-plugin.md)                    |
| Use the companion plugin                                     | [ARC Obsidian plugin](obsidian-plugin.md)           | [Getting started](getting-started.md#init-behavior)          |
| Configure or understand the optional MCP server              | [ARC MCP server](mcp-server.md)                     | [Obsidian setup](obsidian-setup.md#ai-and-filesystem-access) |
| Understand generated notes, front-matter, or queries         | [Templates and metadata](templates-and-metadata.md) | [Vault structure](vault-structure.md)                        |
| Follow common capture, project, journal, or review practices | [Vault workflows](vault-workflows.md)               | [ARC methodology](methodology.md)                            |
| Check what is implemented and what remains exploratory       | [Roadmap](roadmap.md)                               | [Project plans](plans/README.md)                             |

## Contribute and maintain

| If you want to...                                            | Start here                           |
| ------------------------------------------------------------ | ------------------------------------ |
| Set up the repository, change code, or run checks            | [Development](development.md)        |
| Propose and validate a contribution                          | [Contributing](../CONTRIBUTING.md)   |
| Prepare a package release                                    | [Manual release guide](releasing.md) |
| Report a security issue                                      | [Security policy](../SECURITY.md)    |
| Understand the project’s documented plans and design history | [Project plans](plans/README.md)     |

## How these documents relate

- **Getting started** is the user-facing command reference. It documents
  current CLI behavior and safety limits.
- **Vault structure**, **templates and metadata**, and **architecture** explain
  the generated vault contract. Keep their descriptions consistent with the
  implementation and tests.
- **Obsidian setup**, **the plugin guide**, and **the MCP guide** cover optional
  integrations and their boundaries.
- **Development** is the source for repository layout, implementation flows,
  tests, builds, and CI.
- **Roadmap** summarizes current capabilities and possible future directions;
  it is not a schedule or a promise to implement deferred ideas.
- **Project plans** preserve design rationale and implementation history.
  Some plans are historical or exploratory and may not describe current
  behavior. For current behavior, prefer the implementation and its linked
  user-facing guide.

When behavior changes, update the relevant guide and its tests together. Keep
cross-document links relative to the file containing each link.
