// Templater expands the ID and creation date when a concept note is created.
export const atomic = `---
id: <% tp.date.now("YYYYMMDDHHmmss") %>
type: concept
tags: []
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

## Idea


## Connections

-
`;
