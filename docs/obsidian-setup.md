# Obsidian setup

ARC CLI creates Markdown files and query blocks; it does not configure the Obsidian application or install community plugins.

## Dataview

Install and enable the **Dataview** community plugin to render the queries in `000_Atlas/Dashboard.md` and the example project note. Queries expect the fields and values described in [Templates and metadata](templates-and-metadata.md).

Without Dataview, the Markdown and query blocks remain in the files but will not appear as generated tables or task lists.

## Templater

Install and enable the **Templater** community plugin, then:

1. Set the Templater template folder location to `999_Templates/`.
2. Optionally configure folder-template rules for `300_Slipbox/`, `200_Projects/`, and `400_Journal/`.
3. Use the template picker or your configured workflow to create notes.

The CLI only generates templates. Templater does not automatically apply a template merely because the file exists.

## Graph View recommendations

The following filters and colors are recommendations to configure manually in Graph View groups. ARC CLI does not modify Obsidian settings or guarantee that settings are portable between vaults.

| ARC layer | Search/filter        | Suggested color       |
| --------- | -------------------- | --------------------- |
| Atlas     | `path:000_Atlas`     | Gold/yellow `#F1C40F` |
| Spaces    | `path:100_Spaces`    | Blue `#3498DB`        |
| Projects  | `path:200_Projects`  | Green `#2ECC71`       |
| Slipbox   | `path:300_Slipbox`   | Purple `#9B59B6`      |
| Journal   | `path:400_Journal`   | Orange `#E67E22`      |
| Templates | `path:999_Templates` | Gray `#7F8C8D`        |

These are visual conventions only; graph groups do not create access restrictions.

## AI and filesystem access

ARC's folder names can help a person or a configured AI client navigate context, but they do not enforce permissions.

The generated `.claudeignore` contains best-effort exclusions for clients that recognize this file. It is not an access-control or privacy boundary, and arbitrary AI/MCP clients may ignore it. Configure access within each client and use filesystem/operating-system permissions for actual restrictions. Do not place secrets in a vault based only on ignore rules.
