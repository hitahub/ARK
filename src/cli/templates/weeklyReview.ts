// Weekly maintenance prompts are checkboxes to support review progress tracking.
export const weeklyReview = `---
type: weekly-review
week: <% tp.date.now("gggg-[W]ww") %>
---

# Weekly Review — <% tp.date.now("gggg-[W]ww") %>

## Review

- [ ] Review active projects and next actions
- [ ] Review overdue and completed tasks
- [ ] Move useful loose ideas into the Slipbox
- [ ] Check for broken links and misplaced notes

## Next week's focus

1.
`;
