# ARC Obsidian plugin

The optional ARC Vault Companion adds lightweight ARC-specific checks and note
creation inside Obsidian. The CLI remains independent and works without the
plugin.

## Build and install locally

From the repository root:

```bash
pnpm install
pnpm build:plugin
```

The build writes `manifest.json`, `main.js`, and `styles.css` to
`dist/obsidian-plugin/`. Copy those files into
`<vault>/.obsidian/plugins/arc-obsidian-plugin/`, then enable **ARC Vault
Companion** under **Settings → Community plugins**. Restart or reload Obsidian
after replacing the plugin files. The generated directory is prepared for a
future community-plugin release, but no release or submission is performed by
this build.

## Features

- **Slipbox structure warning:** checks for direct child folders inside
  `300_Slipbox/`, and reports when the expected folder is missing or is not a
  folder. The status-bar item and **Check ARC Slipbox structure** command report
  findings; they do not prevent, move, or delete files.
- **Explicit note creation:** **Create ARC note** opens a dialog for a concept,
  project, or task. It creates a new file under `300_Slipbox/` or
  `200_Projects/`, uses ARC-compatible starter metadata, and adds a numeric
  suffix rather than overwriting a note with the same title. It does not run
  Templater expressions.
- **Active-note link diagnostics:** the status bar reports unresolved wikilinks
  in the active Markdown note. Click it or run **Check unresolved wikilinks in
  active note** to see targets and line numbers. Link resolution uses Obsidian's
  metadata cache; diagnostics are read-only and do not infer whether a link is
  conceptually meaningful.

The plugin does not synchronize vault content with AI clients. Folder
organization is not an access-control boundary. Use filesystem permissions
and configure any external clients separately.

## Development

```bash
pnpm test
pnpm typecheck
pnpm build:plugin
```

The plugin source is in `src/obsidian-plugin/`. Automated tests cover
metadata generation, title sanitization, folder routing, and wikilink parsing;
visual behavior should also be smoke-tested in Obsidian.
