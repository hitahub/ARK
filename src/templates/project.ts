// Project status and task queries follow the metadata contract consumed by the dashboard.
export const projectIndex = `---
type: project
status: active
deadline:
---

# Project Alpha

## Desired outcome


## Active phase

- [[Phase_03_Active/]]

## Archive

- [[Past_Phases_Archive/]]

## Tasks

\`\`\`dataview
TASK
FROM "200_Projects/210_Project_Alpha"
WHERE !completed
\`\`\`
`;
