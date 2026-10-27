# Vault structure

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
└── .claudeignore
```

`.gitkeep` marker files are placed in empty folders where needed. `000_Atlas/` contains Markdown files; `300_Slipbox/` gets a `.gitkeep` marker when initially scaffolded.

## Folder responsibilities

| Path                                          | Role                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `000_Atlas/`                                  | System entrypoints: the Dashboard and idea matrix.                                                                  |
| `100_Spaces/`                                 | Ongoing responsibilities; the scaffold includes career/business, creative side hustle, and personal areas.          |
| `200_Projects/`                               | Bounded goals. The scaffold includes example Alpha and B project folders and an Alpha project index.                |
| `200_Projects/<project>/Phase_*`              | Active project execution phases; customize names and phase numbers to fit the project.                              |
| `200_Projects/<project>/Past_Phases_Archive/` | Optional archive location for completed phases.                                                                     |
| `300_Slipbox/`                                | Flat storage for concept and technical notes. No direct child directories are allowed.                              |
| `400_Journal/<year>/`                         | Daily journals, meetings, and other time-ordered notes for a year. `init` creates the current local year directory. |
| `999_Templates/`                              | Templater source files, not automatically activated by the CLI.                                                     |

## What verification requires

`arc verify` requires:

- Directories: `000_Atlas/`, `100_Spaces/`, its three standard subfolders, `200_Projects/`, `300_Slipbox/`, `400_Journal/`, and `999_Templates/`.
- Files: `000_Atlas/Dashboard.md`, `000_Atlas/MoC_Idea_Matrix.md`, all six `999_Templates/TPL_*.md` files, and `.claudeignore`.
- No directory directly inside `300_Slipbox/`. Directory symlinks to folders also count as violations.

It does **not** require `.gitkeep` markers, a particular year directory, `210_Project_Alpha/`, or `220_Project_B/`. Additional files, projects, phases, year folders, and directories outside the Slipbox are allowed.

Verification checks for presence and basic file/directory types. It does not validate Markdown content, frontmatter correctness, Dataview results, or the user's entire vault layout.
