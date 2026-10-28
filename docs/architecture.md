# ARC vault architecture

ARC (Atomic Rosetta Contextual) is a folder-based system for combining personal
knowledge with project execution in an Obsidian vault. Its architecture separates
information by its role and expected lifetime, while Markdown links connect
related notes across those boundaries.

This page is the architectural overview. For operational examples, see
[Vault workflows](vault-workflows.md); for folder-by-folder details, see
[Vault structure](vault-structure.md).

## Architectural model

ARC has three complementary ideas:

- **Context boundaries (ACCESS):** separate ongoing responsibilities, bounded
  projects, reusable knowledge, and time-based records into distinct areas.
- **Atomic connected knowledge (Zettelkasten):** keep reusable concepts in a
  flat Slipbox and connect them with descriptive links.
- **Iterative execution (Agile):** express projects as outcomes and break work
  into phases, task notes, and action items.

The vault layers have different jobs:

| Layer            | Main question it answers                        | Typical content                                          |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `000_Atlas/`     | Where do I start?                               | Dashboards, maps of content, idea capture                |
| `100_Spaces/`    | What responsibilities do I maintain?            | Ongoing areas without a fixed completion date            |
| `200_Projects/`  | What outcome am I actively trying to achieve?   | Project indexes, phases, tasks, and project action items |
| `300_Slipbox/`   | What reusable idea or knowledge have I learned? | Atomic concepts and technical notes                      |
| `400_Journal/`   | What happened, and when?                        | Daily journals, meeting notes, and reviews               |
| `999_Templates/` | How should I create a consistent note?          | Templater source files                                   |

These are organizational boundaries, not permissions. Folder names, Obsidian
links, Dataview, and `.claudeignore` do not restrict access to files.

## How information moves through the vault

```text
Capture an idea or event
    ├── fleeting idea ──> Atlas idea matrix ──> Slipbox concept
    ├── dated activity ──> Journal / meeting note
    └── desired outcome ──> Project index ──> phase / task / action item

Project and journal notes ──link to──> reusable Slipbox concepts
Dashboard ──queries metadata and checkboxes from──> projects and journals
```

This is a suggested workflow, not an automated pipeline. Users decide when an
idea is ready to become a concept, which project owns a task, and when to
archive completed work. ARC CLI only scaffolds files and checks a limited
structural baseline; it does not move notes, create links, or manage lifecycle.

## Note types and connections

ARC uses two complementary ways to represent work:

1. **Typed notes** use YAML frontmatter such as `type: project` or
   `type: task`. Dataview can query these properties to build tables.
2. **Markdown checkboxes** such as `- [ ] Follow up` represent individual
   actions. Dataview's `TASK` query can collect these without requiring a
   separate task note.

Use a task note when the work needs its own outcome, project/phase association,
status, or dedicated next actions. Use a checkbox for a small action that is
best kept in context, such as a meeting follow-up. Both can coexist.

Use Obsidian wikilinks such as `[[Concept Name]]` to connect notes by meaning.
The filesystem location describes a note's primary role; links provide
cross-cutting context without duplicating the same information in multiple
folders.

## Metadata and dashboard contract

The generated Dashboard relies on a small metadata contract:

- Project notes under `200_Projects/` are included in Active Projects when
  `type` is `project` and `status` is `active`.
- Task notes under `200_Projects/` appear in Open Task Notes when
  `type` is `task` and `status` is not `done`.
- Unchecked Markdown tasks under `200_Projects/` and `400_Journal/` appear in
  Open Action Items.

The `project`, `phase`, `deadline`, and status values are conventions; the
Dashboard does not validate whether references point to existing notes.
See [Templates and metadata](templates-and-metadata.md) for all generated
fields, status vocabularies, and query blocks.

## What ARC CLI creates and checks

`arc init` creates the standard directories, starter templates and index
Markdown, an example project layout, `.gitkeep` markers where needed, a journal
directory for the current local year, and a best-effort `.claudeignore`.
Initialization creates missing files and preserves existing ones.

`arc verify` checks for the required baseline directories and files, and
enforces only one content convention: no directory directly inside
`300_Slipbox/`. It does not check note contents, frontmatter, links, Dataview
results, optional example projects, or Obsidian plugin settings. See
[Vault structure](vault-structure.md#what-verification-requires) for the exact
requirements.

## Design principles

- **Keep capture lightweight.** Use the appropriate layer without requiring
  every thought to become a fully structured note.
- **Separate ongoing areas from finite outcomes.** Spaces persist; projects
  have a desired result and can eventually be completed.
- **Connect, do not over-nest.** Keep Slipbox notes flat and use links to
  express conceptual relationships.
- **Keep source notes useful without plugins.** Markdown remains readable when
  Dataview or Templater is unavailable; those plugins add convenience.
- **Preserve user ownership.** CLI setup is non-overwriting, and users control
  note organization, plugin configuration, and lifecycle decisions.
- **Do not treat organization as security.** Apply operating-system permissions
  and configure AI clients independently when access boundaries matter.

## Customization

The scaffold is a starting point, not a closed schema. Add folders and notes
where useful, rename example projects, and adapt templates to your workflow.
Keep the required baseline and flat Slipbox rule if you want `arc verify` to
pass. If you change frontmatter fields or status values, update the templates
and their Dataview queries together.
