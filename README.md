# ARC CLI

ARC CLI scaffolds and verifies an **Atomic Rosetta Contextual (ARC)** knowledge-management vault. It creates a practical Obsidian folder structure, Markdown dashboards, and starter templates while preserving files already in the target vault.

> **Package status:** the package name is `@hitahub/arc`, and its executable is `arc`. The `npx` and `pnpm dlx` commands below work after the package has been published to a registry your account can access.

## What is ARC?

ARC combines three approaches to personal knowledge and execution:

- **ACCESS (Actionable Boundaries):** top-level folders distinguish ongoing areas, projects, reference knowledge, and time-based notes. These boundaries organize context; they do not enforce filesystem or AI access permissions.
- **Zettelkasten:** concepts are captured as atomic Markdown notes and linked with Obsidian wikilinks such as `[[Related Concept]]`.
- **Agile execution:** projects are organized around outcomes and active phases, with completed phases moved to an archive.

The CLI creates Markdown and query text. It does not install Obsidian plugins, configure AI clients, or enforce folder access permissions.

## Requirements

- Node.js 20 or newer
- Obsidian is optional for generating the vault, but required to use Obsidian-specific features
- Dataview and Templater community plugins are optional prerequisites for the generated queries and templates

## Install and use

After `@hitahub/arc` is published:

```bash
# Initialize the current directory (asks for confirmation)
npx @hitahub/arc init

# Initialize a specific directory
npx @hitahub/arc init ./MyNewVault

# Verify the current directory or a target vault
npx @hitahub/arc verify
npx @hitahub/arc verify ./MyNewVault
```

With pnpm, use `pnpm dlx`:

```bash
pnpm dlx @hitahub/arc init
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc verify ./MyNewVault
```

If installed globally, the executable is named `arc`:

```bash
arc init ./MyNewVault
arc verify ./MyNewVault
```

### Initialization behavior

- `arc init` without a path targets the current working directory and asks for confirmation before writing.
- Providing a target path skips the confirmation and creates the directory if needed.
- Initialization creates missing folders and files only. It never replaces existing files; existing files are reported as preserved.
- An I/O error is reported and results in a non-zero exit code. A failed initialization may leave a partially created scaffold; it does not roll back prior writes.
- A journal folder for the current local calendar year is created under `400_Journal/`.

### Verification behavior

`arc verify [path]` checks for the required ARC baseline: top-level folders, standard Spaces subfolders, Atlas files, template files, and `.claudeignore`. Optional example project content and other user-added files or directories are allowed. Verification fails if a directory exists directly inside `300_Slipbox/`; nested directories elsewhere are allowed.

## Vault structure

```text
Vault/
├── 000_Atlas/
│   ├── Dashboard.md
│   └── MoC_Idea_Matrix.md
├── 100_Spaces/
│   ├── 110_Career_Business/
│   ├── 120_Creative_SideHustle/
│   └── 130_Personal/
├── 200_Projects/
│   ├── 210_Project_Alpha/       # Example project
│   │   ├── MoC_Project_Alpha.md
│   │   ├── Past_Phases_Archive/
│   │   └── Phase_03_Active/
│   └── 220_Project_B/           # Example project
├── 300_Slipbox/                 # Flat atomic notes; no direct subfolders
├── 400_Journal/
│   └── <current-year>/
├── 999_Templates/
│   ├── TPL_Concept.md
│   ├── TPL_Project_Task.md
│   ├── TPL_Daily_Journal.md
│   ├── TPL_Tech_Architecture.md
│   ├── TPL_Meeting_Note.md
│   └── TPL_Weekly_Review.md
└── .claudeignore
```

### Folder roles

| Folder           | Purpose                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `000_Atlas/`     | Dashboards and high-level Maps of Content for system navigation.                                |
| `100_Spaces/`    | Ongoing responsibilities without a defined end date, such as career and personal life.          |
| `200_Projects/`  | Bounded initiatives with outcomes, deadlines, phases, and project notes.                        |
| `300_Slipbox/`   | Flat storage for atomic concepts and technical notes. Do not create folders directly inside it. |
| `400_Journal/`   | Daily journals, meeting notes, and time-series records grouped by year.                         |
| `999_Templates/` | Templater source files, separate from everyday notes.                                           |

The `210_Project_Alpha/` and `220_Project_B/` directories are examples, not required content for `verify`.

## Generated files and metadata

- **`000_Atlas/Dashboard.md`** contains Dataview queries for active projects, open task notes, and unchecked Markdown tasks.
- **`000_Atlas/MoC_Idea_Matrix.md`** is a starting point for capturing loose ideas and linking them to atomic notes.
- **`200_Projects/210_Project_Alpha/MoC_Project_Alpha.md`** is an example project index.
- **`999_Templates/TPL_Concept.md`** captures atomic concepts with `id`, `type: concept`, tags, and creation date.
- **`999_Templates/TPL_Project_Task.md`** captures task notes with `type: task`, `project`, `phase`, and `status`.
- **`999_Templates/TPL_Daily_Journal.md`** provides a date-based journal with focus, notes, and flash-idea sections.
- **`999_Templates/TPL_Tech_Architecture.md`** provides sections for context, API endpoints, database schema, and decisions.
- **`999_Templates/TPL_Meeting_Note.md`** captures attendees, meeting notes, and Markdown checkbox action items.
- **`999_Templates/TPL_Weekly_Review.md`** provides a maintenance checklist.

Task-note status values are `todo`, `in-progress`, `done`, and `blocked`. Project notes use `type: project` and status values `active`, `on-hold`, `done`, or `archived`. Dashboard queries depend on these fields and values. Meeting action items are Markdown checkboxes and are queried separately from task-note frontmatter.

## Obsidian setup

The CLI only writes files; it does not install or configure plugins:

1. Install the **Dataview** community plugin to render dashboard queries.
2. Install **Templater** and set its template folder to `999_Templates/`.
3. Configure Templater folder-template rules if you want templates applied automatically. Merely generating templates does not activate them.
4. Optionally add the recommended folder groups and colors below in Graph View settings. The CLI does not modify Obsidian settings.

| ARC layer | Graph filter         | Suggested color  |
| --------- | -------------------- | ---------------- |
| Atlas     | `path:000_Atlas`     | Gold `#F1C40F`   |
| Spaces    | `path:100_Spaces`    | Blue `#3498DB`   |
| Projects  | `path:200_Projects`  | Green `#2ECC71`  |
| Slipbox   | `path:300_Slipbox`   | Purple `#9B59B6` |
| Journal   | `path:400_Journal`   | Orange `#E67E22` |
| Templates | `path:999_Templates` | Gray `#7F8C8D`   |

### AI and filesystem access

The generated `.claudeignore` is a best-effort hint only for clients that recognize it. It is not a security or privacy boundary, and other AI/MCP clients may ignore it. Configure access in each client and use filesystem or operating-system permissions for actual access restrictions.

## Development

Clone the repository and install dependencies:

```bash
pnpm install
pnpm build
```

Run the CLI locally without publishing:

```bash
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
```

Useful project commands:

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm test`         | Run unit and integration tests.               |
| `pnpm typecheck`    | Run TypeScript checks without emitting files. |
| `pnpm build`        | Bundle the ESM CLI into `dist/`.              |
| `pnpm format:check` | Check formatting without modifying files.     |
| `pnpm format`       | Format project files with Prettier.           |

The test suite covers filesystem helpers, template metadata, CLI routing, safe initialization, collision preservation, current-year folder creation, and verification of the flat-Slipbox rule. CI runs install with the frozen lockfile, formatting checks, tests, typecheck, and build.

## Future roadmap (exploratory)

The following are ideas for possible future work, not capabilities currently implemented by this CLI. Each requires feasibility and requirements review before implementation.

1. **ARC Obsidian plugin:** Explore supported Obsidian APIs for Slipbox folder warnings, native note injection, link linting, and optional sync with local AI clients.
2. **ARC-aware MCP server:** Explore semantic tools such as `get_active_projects()`, `search_slipbox_by_tag()`, and `create_task()`. Measure whether structured responses improve retrieval and token use; they do not inherently eliminate hallucinations.
3. **Vault health checks:** Consider an `arc health` command for orphaned notes, broken links, and structural issues, plus opt-in Git hook integration.
4. **Semantic auto-link suggestions:** Explore an offline embedding workflow that suggests related Slipbox notes without silently rewriting user notes.
5. **Project archival:** Consider an `arc archive` command that moves completed projects to cold storage and updates their metadata.
6. **Publishing:** Explore exporting selected workspaces to static sites or publishing platforms with private metadata excluded.
