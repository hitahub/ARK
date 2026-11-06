# Vault structure

For the architectural overview and how the layers connect, see
[ARC vault architecture](architecture.md). Practical end-to-end examples are
in [Vault workflows](vault-workflows.md).

`arc init` creates the baseline structure below. The example project folders are included as starter content; they are not required by `arc verify`.

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
│   ├── .gitkeep
│   ├── 210_Project_Alpha/
│   │   ├── MoC_Project_Alpha.md
│   │   ├── Past_Phases_Archive/
│   │   └── Phase_03_Active/
│   └── 220_Project_B/
├── 900_Archive/
│   └── Projects/                  # created by `arc archive`, not by `arc init`
├── 300_Slipbox/
├── 400_Journal/
│   └── <current-local-year>/
├── 999_Templates/
│   ├── TPL_Concept.md
│   ├── TPL_Project_Task.md
│   ├── TPL_Daily_Journal.md
│   ├── TPL_Tech_Architecture.md
│   ├── TPL_Meeting_Note.md
│   └── TPL_Weekly_Review.md
├── .obsidian/
│   └── plugins/
│       └── arc-obsidian-plugin/
│           ├── manifest.json
│           ├── main.js
│           └── styles.css
└── .claudeignore
```

`.gitkeep` marker files are placed in empty folders where needed. `000_Atlas/` contains Markdown files; `300_Slipbox/` gets a `.gitkeep` marker when initially scaffolded.
The ARC companion plugin files are included by default; `arc init --no-plugin`
skips them. They are not required by `arc verify`, and the plugin still needs to
be enabled in Obsidian's settings.

## Folder responsibilities

| Path                                          | Role and usage                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `000_Atlas/`                                  | Navigation and orientation. `Dashboard.md` provides Dataview views; `MoC_Idea_Matrix.md` is a lightweight place to capture and connect emerging ideas. These are entrypoints, not authoritative copies of every note.    |
| `100_Spaces/`                                 | Ongoing responsibilities without a fixed completion date. The scaffold starts with `110_Career_Business/`, `120_Creative_SideHustle/`, and `130_Personal/`. Add notes that support maintaining an area over time.        |
| `200_Projects/`                               | Bounded initiatives with a desired outcome. A project may have an index note, phases, task notes, and project-specific checklists. Example project folders are starter content and can be renamed, replaced, or removed. |
| `200_Projects/<project>/Phase_*`              | Optional organization for active work by phase, sprint, or another useful stage. The names and numbering are user-defined.                                                                                               |
| `200_Projects/<project>/Past_Phases_Archive/` | Optional place for completed phases. Moving content here and updating project links/status are manual actions.                                                                                                           |
| `900_Archive/Projects/<project>/`             | Cold storage created by `arc archive` for completed projects; this folder is not part of the `arc init` baseline.                                                                                                        |
| `300_Slipbox/`                                | Flat collection of reusable concept and technical notes. Keep each note directly in this folder and connect related concepts with descriptive wikilinks. No direct child directories are allowed by `arc verify`.        |
| `400_Journal/<year>/`                         | Time-ordered records such as daily journals, meetings, and reviews. Initialization creates the current local calendar-year directory; later years are created by the user.                                               |
| `999_Templates/`                              | Markdown template sources for Templater. The CLI creates them but does not install, configure, or invoke Templater.                                                                                                      |
| `.claudeignore`                               | Best-effort exclusion hints for Claude clients that honor this file. It is not a security or access-control boundary.                                                                                                    |

The Obsidian plugin creates each project as a folder containing `Project.md`,
which is compatible with `arc archive`.

### Number prefixes

The numeric prefixes are a navigation convention, not a permission model or
required ordering enforced on every folder. They keep the main layers grouped
and sorted in file browsers. The CLI requires the named baseline paths listed
below; it does not validate numbering on user-created project, phase, or
additional folders.

### Notes, links, and metadata

Folder location communicates a note's primary role. Front-matter communicates
its type and queryable properties, while Obsidian wikilinks express
relationships across folders. For example, a project task can live under its
project, have `type: task` and a `project` value, and link to a Slipbox concept
that informs the work. These are complementary conventions; `arc verify` does
not check whether a link or metadata reference resolves.

See [Templates and metadata](templates-and-metadata.md) for field definitions
and [Vault workflows](vault-workflows.md) for examples.

### Example project layout

The scaffold's `210_Project_Alpha/` demonstrates one possible layout:

```text
210_Project_Alpha/
├── MoC_Project_Alpha.md
├── Past_Phases_Archive/
└── Phase_03_Active/
```

The project index links to the active phase and archive and includes a
Dataview task query. ARC does not require this structure, manage its contents,
or create matching phase notes automatically.

## What verification requires

`arc verify` requires:

- Directories: `000_Atlas/`, `100_Spaces/`, its three standard subfolders, `200_Projects/`, `300_Slipbox/`, `400_Journal/`, and `999_Templates/`.
- Files: `000_Atlas/Dashboard.md`, `000_Atlas/MoC_Idea_Matrix.md`, all six `999_Templates/TPL_*.md` files, and `.claudeignore`.
- No directory directly inside `300_Slipbox/`. Directory symlinks to folders also count as violations.

It does **not** require `.gitkeep` markers, a particular year directory, `210_Project_Alpha/`, or `220_Project_B/`. Additional files, projects, phases, year folders, and directories outside the Slipbox are allowed.

Verification checks for presence and basic file/directory types. It does not validate Markdown content, front-matter correctness, Dataview results, or the user's entire vault layout.

`arc init` preserves existing scaffold files, including templates and indexes.
The installed ARC plugin is also preserved unless its manifest version differs
from the CLI bundle and the user confirms an update; replaced plugin assets are
backed up under `.arc-backups/`.

`arc archive` moves a project marked `status: done` from `200_Projects/` to
`900_Archive/Projects/` and changes its index status to `archived`. Archived
projects are outside the generated Dashboard queries and are not required by
`arc verify`.
