# Project plans

Plan files use this naming convention:

```text
<NN>.<lowercase-kebab-case-topic>.plan.md
```

- `NN` is a unique, zero-padded, two-digit sequence number.
- The topic describes the plan in lowercase kebab case.
- Keep the sequence number when a plan is completed; do not renumber later plans.
- Use the next available number for a new plan.

## Plans

| File                                                                                                                 | Purpose                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [00.arc-cli-foundation.plan.md](./00.arc-cli-foundation.plan.md)                                                     | Original CLI scope and architecture.                                                 |
| [01.arc-obsidian-plugin.plan.md](./01.arc-obsidian-plugin.plan.md)                                                   | ARC Obsidian companion implementation.                                               |
| [02.recent-changes-review.plan.md](./02.recent-changes-review.plan.md)                                               | Review of the plugin introduction changes.                                           |
| [03.technical-review-roadmap-plugin-installation.plan.md](./03.technical-review-roadmap-plugin-installation.plan.md) | Current technical review, implementation roadmap, and automatic plugin installation. |
| [04.project-lifecycle-automation.plan.md](./04.project-lifecycle-automation.plan.md)                                 | Implemented safe project archiving and lifecycle automation.                         |
| [05.git-hook-integration.plan.md](./05.git-hook-integration.plan.md)                                                 | Implemented opt-in integration between `arc health` and Git commits.                 |
| [06.arc-aware-mcp-server.plan.md](./06.arc-aware-mcp-server.plan.md)                                                 | Implemented scope and data contract for the optional read-only MCP server.           |
| [07.semantic-auto-link-suggestions.plan.md](./07.semantic-auto-link-suggestions.plan.md)                             | Exploratory plan for offline, reviewable Slipbox link suggestions.                   |
| [08.publishing-selected-content.plan.md](./08.publishing-selected-content.plan.md)                                   | Implemented local workflow for exporting a reviewable subset of vault content.       |
| [09.saving-link-suggestion-reports.plan.md](./09.saving-link-suggestion-reports.plan.md)                             | Implemented explicit, local saving of link-suggestion reports.                       |
| [10.evaluating-semantic-link-matching.plan.md](./10.evaluating-semantic-link-matching.plan.md)                       | Synthetic evaluation and approved scope for opt-in local semantic matching.          |
