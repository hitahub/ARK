// Keep status values aligned with the Dashboard Dataview filters and ARC data contract.
export const task = `---
type: task
project: ""
phase: ""
status: todo
created: <% tp.date.now("YYYY-MM-DD") %>
deadline:
---

# <% tp.file.title %>

## Outcome


## Next actions

- [ ]
`;
