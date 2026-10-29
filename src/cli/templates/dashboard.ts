// These Dataview queries use the project and task frontmatter contract from the templates.
export const dashboard = `# ARC Dashboard

## Active Projects

\`\`\`dataview
TABLE status, deadline
FROM "200_Projects"
WHERE type = "project" AND status = "active"
SORT deadline ASC
\`\`\`

## Open Task Notes

\`\`\`dataview
TABLE project, phase, status
FROM "200_Projects"
WHERE type = "task" AND status != "done"
SORT project ASC, phase ASC
\`\`\`

## Open Action Items

\`\`\`dataview
TASK
FROM "200_Projects" OR "400_Journal"
WHERE !completed
\`\`\`
`;
