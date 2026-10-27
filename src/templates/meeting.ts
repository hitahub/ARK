// Action items use Markdown checkboxes so Dataview task queries can aggregate them.
export const meeting = `---
type: meeting
date: <% tp.date.now("YYYY-MM-DD") %>
attendees: []
project: ""
---

# <% tp.file.title %>

## Notes


## Action Items

- [ ]
`;
