# Templates and metadata

ARC CLI writes starter Markdown templates into `999_Templates/`. The templates contain Templater expressions, but the CLI does not install Templater, configure its settings, or automatically apply templates to new notes. See [Obsidian setup](obsidian-setup.md).

## Generated files

| File                                                  | Purpose and key content                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `000_Atlas/Dashboard.md`                              | Dataview views for active projects, open task notes, and unchecked Markdown tasks. |
| `000_Atlas/MoC_Idea_Matrix.md`                        | Capture loose ideas and connect them to Slipbox notes.                             |
| `200_Projects/210_Project_Alpha/MoC_Project_Alpha.md` | Example project note with desired outcome, active phase, archive, and task query.  |
| `999_Templates/TPL_Concept.md`                        | Atomic concept note with generated ID/date, type, tags, idea, and connections.     |
| `999_Templates/TPL_Project_Task.md`                   | Task note with project, phase, status, outcome, and next actions.                  |
| `999_Templates/TPL_Daily_Journal.md`                  | Date-based journal with focus, notes, and flash ideas.                             |
| `999_Templates/TPL_Tech_Architecture.md`              | Technical concept with API endpoint and database schema tables.                    |
| `999_Templates/TPL_Meeting_Note.md`                   | Meeting date, attendees, notes, project, and checkbox action items.                |
| `999_Templates/TPL_Weekly_Review.md`                  | Weekly maintenance checklist and next-week focus.                                  |

`arc init` also creates `.claudeignore` as a best-effort hint file. See [Obsidian setup](obsidian-setup.md#ai-and-filesystem-access).

## Frontmatter contract

The generated Dashboard queries expect the following metadata:

### Project notes

```yaml
type: project
status: active
deadline:
```

The documented project status vocabulary is `active`, `on-hold`, `done`, and `archived`. The generated example uses `active`.

### Task notes

```yaml
type: task
project: 'Project Alpha'
phase: 'Phase_03_Active'
status: todo
created: 2026-10-28
deadline:
```

Task status values are `todo`, `in-progress`, `done`, and `blocked`. The Dashboard queries task notes under `200_Projects/` where `type = "task"` and `status != "done"`.

The current template seeds `project` and `phase` as empty strings; replace them with the relevant project and phase identifiers when creating a real task.

### Other note types

- Concepts use `type: concept`; the technical architecture template adds `subtype: tech-architecture`.
- Daily journals use `type: journal` and a `date`.
- Meeting notes use `type: meeting`, `date`, `attendees`, and `project`.
- Weekly reviews use `type: weekly-review` and a week identifier.

## Markdown action items

Meeting action items and other checklist tasks are Markdown checkboxes:

```markdown
- [ ] Confirm next project milestone
- [x] Share meeting notes
```

The Dashboard's Dataview `TASK` query finds incomplete Markdown tasks under `200_Projects/` and `400_Journal/`. These checklist items are distinct from task-note YAML metadata and can coexist with task notes.

## Maintain the contract

If you rename metadata fields or status values, update the affected templates and Dataview queries together. Dataview must be installed and enabled for query blocks to render.
