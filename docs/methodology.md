# ARC methodology

**Atomic Rosetta Contextual (ARC)** is a personal knowledge and execution framework intended to work with ordinary Markdown tools and, when explicitly configured, AI clients that can access local files. It combines context boundaries, connected atomic notes, and iterative project execution.

## ACCESS: actionable boundaries

The numbered top-level folders distinguish ongoing areas, bounded projects, reference knowledge, and time-based records. This makes information easier for a person or a permitted client to navigate.

Folder names are organizational conventions only. They do not enforce security boundaries or limit what an AI/MCP client can read. Apply OS permissions and configure client access separately.

## Zettelkasten: fluid connectivity

The `300_Slipbox/` is the knowledge base for atomic ideas and technical concepts. Keep notes flat in this directory and connect them with descriptive Obsidian wikilinks such as `[[Related Concept]]`.

The no-subfolder rule is intended to keep concepts easy to discover and connect. ARC CLI verification checks that there are no directories directly inside `300_Slipbox/`.

## Agile execution: iterative projects

The `200_Projects/` folder holds initiatives with a desired outcome and a finite scope. Each project can be divided into active phases or sprints. Completed work can be moved to an archive so it is distinct from current execution.

ARC CLI scaffolds an example project layout, but it does not manage project lifecycle, move completed projects, or automatically update project status.

## Layers work together

1. Use Spaces for ongoing responsibilities without a fixed completion date.
2. Use Projects for bounded outcomes and active phases.
3. Capture reusable knowledge in atomic Slipbox notes and link notes across areas.
4. Use the Atlas and Dashboard to orient around projects and next actions.
5. Use Journal folders for time-ordered daily notes and meeting records.

ARC is a flexible convention rather than an access-control system. Customize the vault while retaining the flat Slipbox rule if you want `arc verify` to pass.
