# Vault workflows

These workflows show how ARC's vault layers can work together in Obsidian.
They are user practices, not automation provided by ARC CLI. Start with
[ARC vault architecture](architecture.md) for the system overview and
[Templates and metadata](templates-and-metadata.md) for the note contracts.

## Capture an idea and develop it into knowledge

1. Add a rough thought to `000_Atlas/MoC_Idea_Matrix.md` when it is not yet
   clear enough to become a standalone note.
2. When the idea is reusable, create a note in `300_Slipbox/` using
   `TPL_Concept.md`.
3. Give the note a specific title and summarize one central idea in its
   `Idea` section.
4. Add descriptive links in `Connections`, and link to it from the project,
   journal, or other concept where it is useful.
5. Remove or mark the original matrix entry according to your preferred
   capture practice.

Slipbox notes stay directly in `300_Slipbox/`; organize them with titles,
tags, and links rather than subfolders. `arc verify` rejects direct child
directories there.

## Start and run a project

1. Create a project folder under `200_Projects/` and an index note in it.
   The generated `210_Project_Alpha/` is an example, not a required project.
2. Give the project note `type: project`, a status, and a clear desired outcome.
3. Create a phase folder for a coherent period or stage of work. Customize
   phase names to your project; the example `Phase_03_Active/` is not a fixed
   naming requirement.
4. Create a task note with `TPL_Project_Task.md` when a task needs its own
   outcome, status, or next actions. Fill in its `project` and `phase` values.
5. Use Markdown checkboxes for smaller actions that belong in a project note,
   phase note, meeting note, or journal entry.
6. Link the project index to its active phase and archive location. Update
   metadata and links manually as work changes.

The Dashboard can list active project notes, open task notes, and unchecked
Markdown tasks. It does not create projects, assign tasks, or update statuses.

## Record a day or meeting

1. Create a note under `400_Journal/<year>/` using `TPL_Daily_Journal.md` for
   a date-based record.
2. Use `TPL_Meeting_Note.md` for a meeting. Add attendees and the related
   project to its frontmatter when relevant.
3. Record follow-ups as Markdown checkboxes. Keep the notes under
   `200_Projects/` or `400_Journal/` if you want the generated Dashboard's
   Open Action Items query to find them.
4. Link to related projects and Slipbox notes for context.

ARC CLI creates the current local calendar-year folder during initialization.
It does not create a new year folder automatically later.

## Review and maintain

Use `TPL_Weekly_Review.md` as a prompt for a regular review:

- Review active projects and clarify their next actions.
- Check task-note statuses and project metadata.
- Move useful ideas from the matrix into the Slipbox.
- Follow up on unchecked action items and broken links.
- Decide manually whether completed project phases should be archived.

The template's checklist is a reminder, not a command that runs these checks.
ARC CLI does not automate review, archive phases, or detect broken links.

## Choose between a task note and a checkbox

| Use a task note when...                                | Use a checkbox when...                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| The task has a distinct outcome and lifecycle.         | The action is small and makes sense in its current note. |
| It needs project, phase, deadline, or status metadata. | A short Markdown action is enough.                       |
| You want it listed by the Dashboard's task-note query. | You want it collected by the Dashboard's `TASK` query.   |

An unchecked checkbox is not automatically equivalent to a task note. The two
are queried differently and have different metadata.

## Customize without losing the ARC baseline

- Add your own files and directories outside `300_Slipbox/`; verification
  permits additional content.
- Keep the required directories and files listed in
  [Vault structure](vault-structure.md#what-verification-requires) if you use
  `arc verify`.
- Keep Slipbox notes flat if you want verification to pass.
- If you rename folders, update Dataview `FROM` paths and any links that refer
  to those folders.
- If you rename metadata fields or status values, update templates and
  Dataview filters together.
- Keep in mind that running `arc init` again preserves existing files; it
  does not replace them with updated template content.
