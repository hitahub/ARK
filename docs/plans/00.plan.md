# 🚀 ARC CLI Project Plan (Obsidian Vault Scaffolding)

---

## 📝 Project Objective & Methodology

Develop a Node.js command-line interface (CLI) using TypeScript. This tool will scaffold the **Atomic Rosetta Contextual (ARC)** architecture directly into a target Obsidian Vault directory, complete with a unit and integration testing suite, enforced code formatting checks, and documented recommendations for Obsidian graph colors.

### The Universal ARC Methodology

The **ARC Methodology** is an AI-agnostic Personal Knowledge Management (PKM) framework designed to bridge raw human thought and active execution with any AI Agent or client running via local or cloud-based directory protocols (like MCP). It combines three essential productivity paradigms:

* **ACCESS (Actionable Boundaries):** Macro-folder partitioning to make scope boundaries easier for people and AI clients to identify. Folders organize information; they do not enforce access permissions.
* **Zettelkasten (Fluid Connectivity):** Flat, folderless "atomic" notes inside the brainstorming phase, connected strictly by internal wiki-links `[[Note]]`. This allows connections across completely different areas of life to merge natively via semantic clustering and vector indexing.
* **Agile Systems (Iterative Execution):** Structural execution grouping that organizes workflows into explicit "Phases" or "Sprints" to avoid stagnation and track tangible progress.

The primary command `arc init` will generate the ARC folder hierarchy and Markdown files, including Dataview queries and Templater templates. Dataview and Templater must be installed and configured in Obsidian separately; the CLI does not install plugins or configure Obsidian. Generated ignore files are client-specific hints, not access controls. AI or MCP clients can use the vault only if separately configured and granted filesystem access.

---

## 🛠️ Tech Stack & Development Environment

* **Runtime:** Node.js (v20+), executed via `fnm` on Apple Silicon (macOS).
* **Package Manager:** `pnpm` (fast, disk space efficient package manager)
* **Environment:** VS Code + Docker Desktop/OrbStack for Dev Containers.
* **Language:** TypeScript
* **CLI Framework:** `commander` (for command parsing)
* **Interactivity:** `@inquirer/prompts` (for Y/N safety confirmations)
* **File System:** `fs-extra` (for robust directory and file generation)
* **Styling:** `chalk` (for terminal output styling)
* **Bundler:** `tsup` (configured for ESM output to match `bin/cli.mjs`)
* **Testing Framework:** `vitest` (for high-speed unit and integration testing)
* **Code Formatter:** `prettier` (for consistent code style enforcement)

---

## 💻 CLI Usage (local development and published package)

For local development, build the CLI and invoke its wrapper directly. After publishing the scoped package `@hitahub/arc`, users can run it without a global installation using `npx` or `pnpm dlx`. The executable remains `arc`.

1. **Build and initialize a local test vault:**

```bash
pnpm build
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault

```

1. **Initialize in the current directory using the published package:**

```bash
npx @hitahub/arc init
pnpm dlx @hitahub/arc init

```

*The CLI prompts before scaffolding the current directory.*
3. **Initialize a specific directory using the published package:**

```bash
npx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc init ./MyNewVault

```

*Creates the directory if needed. No confirmation is required for a specific path; existing content is preserved as described in the initialization policy below.*
4. **Verify the current directory or a specific directory:**

```bash
npx @hitahub/arc verify
npx @hitahub/arc verify ./MyNewVault
pnpm dlx @hitahub/arc verify
pnpm dlx @hitahub/arc verify ./MyNewVault

```

*Checks the required ARC baseline and Slipbox rule; user-added content is allowed.*

---

## 🏗️ CLI Source Code, Executable & Test Structure (`bin/`, `src/` & `tests/`)

```text
arc/
├── .devcontainer/
│   └── devcontainer.json               # Configures the isolated Node.js & TypeScript development environment in VS Code
├── .vscode/
│   ├── launch.json                     # VS Code debugger configuration for local CLI testing
│   └── settings.json                   # Workspace formatting rules
├── .github/
│   └── workflows/
│       └── ci.yml                      # Install, format-check, test, and build on pull requests
├── bin/
│   └── cli.mjs                         # Main executable wrapper script (shebang #!/usr/bin/env node pointing to dist/index.js)
├── dist/                               # [Auto-generated] Compiled TypeScript to JavaScript output
│   └── index.js                        # The main compiled ESM application logic imported by bin/cli.mjs
├── src/
│   ├── commands/
│   │   ├── init.ts                     # Core logic for 'arc init' (creates vault folders & injects templates)
│   │   └── verify.ts                   # Core logic for 'arc verify' (validates vault structural compliance against ARC)
│   ├── templates/
│   │   ├── dashboard.ts                # Returns Markdown strings for Dataview queries in the Atlas
│   │   ├── matrix.ts                   # Returns Markdown strings for MoC_Idea_Matrix.md
│   │   ├── atomic.ts                   # Returns Templater strings for Concept Notes in the Slipbox
│   │   ├── task.ts                     # Returns Templater strings for Project Tasks
│   │   ├── journal.ts                  # Returns Templater strings for Daily Journals
│   │   ├── techArch.ts                 # Returns Templater strings for Software Architecture documentation
│   │   ├── meeting.ts                  # Returns Templater strings for Meeting & Stand-up notes
│   │   ├── weeklyReview.ts             # Returns Templater strings for System Maintenance checklists
│   │   └── ignore.ts                   # Returns configuration string for the .claudeignore file
│   ├── utils/
│   │   ├── logger.ts                   # Chalk-based console styling wrapper (success, error, info)
│   │   └── fileSystem.ts               # fs-extra utility functions (ensureDir, writeFile, etc.)
│   └── index.ts                        # Application entry point (Initializes Commander.js & command routing)
├── tests/                              # Unit & Integration tests directory (powered by Vitest)
│   ├── commands/
│   │   ├── init.test.ts                # Tests scaffolding generation and safe prompt behaviors
│   │   └── verify.test.ts              # Tests folder compliance checks against ARC rules
│   ├── templates/
│   │   └── templates.test.ts           # Validates string outputs and YAML frontmatter integrity for all templates
│   ├── utils/
│   │   └── fileSystem.test.ts          # Tests file system helpers and path resolution utilities
│   └── index.test.ts                   # Tests CLI entry point routing, command registration, and version flag
├── .gitignore                          # Git exclusion file (ignores node_modules/, dist/, etc.)
├── .prettierignore                     # Prettier exclusion file (ignores dist/, node_modules/, coverage/, etc.)
├── .prettierrc                         # Prettier code formatting rules (semi, singleQuote, trailingComma, etc.)
├── package.json                        # Project definitions, dependency management, and bin mapping to "bin/cli.mjs"
├── pnpm-lock.yaml                      # pnpm lockfile for deterministic dependency resolution
├── README.md                           # Documentation for global installation, building, and CLI usage instructions
├── tsconfig.json                       # TypeScript compiler options (Target: ESNext/Node)
└── tsup.config.ts                      # Bundler configuration targeting ESM output for dist/index.js

```

---

## 📂 Target Vault Architecture

When `arc init <path>` is executed, the CLI generates the following baseline structure at the target location. This is the initial scaffold, not an exhaustive allowlist of content that may exist in a vault.

### Scaffolded Tree

```text
Target-Vault-Root/
├── 000_Atlas/                  # High-Level Command Centers (System Entrypoints)
│   ├── Dashboard.md            # The master runway of your current active lifecycle
│   └── MoC_Idea_Matrix.md      # Semantic web indexing loose, high-potential concepts
├── 100_Spaces/                 # Long-Term Life & Work Spheres
│   ├── 110_Career_Business/    # Primary profession, entities, or corporate roles
│   │   └── .gitkeep
│   ├── 120_Creative_SideHustle/# Writing, content pipelines, or personal brands
│   │   └── .gitkeep
│   └── 130_Personal/           # Finances, health metrics, and home parameters
│       └── .gitkeep
├── 200_Projects/               # Bound Initiatives (Explicit Goals & Deadlines)
│   ├── .gitkeep
│   ├── 210_Project_Alpha/      # Optional example long-term project workspace
│   │   ├── MoC_Project_Alpha.md# Master Index Blueprint for Project Alpha
│   │   ├── Past_Phases_Archive/# Cold storage to clear clutter from AI context memory
│   │   └── Phase_03_Active/    # Active execution folder parsed daily by your AI
│   └── 220_Project_B/          # Optional example short-term project workspace
├── 300_Slipbox/                # Flat Atomic Concept Storage (System-wide knowledge)
│   └── .gitkeep                # All raw concept/technical notes live here flat
├── 400_Journal/                # Time-Series Daily Scratchpads and Logs
│   ├── .gitkeep
│   └── <current-year>/         # Created using the current local year at initialization
├── 999_Templates/              # Templater templates directory
│   ├── TPL_Concept.md
│   ├── TPL_Project_Task.md
│   ├── TPL_Daily_Journal.md
│   ├── TPL_Tech_Architecture.md# Spec for engineering docs (DB/API)
│   ├── TPL_Meeting_Note.md     # Spec for project syncs & standups
│   └── TPL_Weekly_Review.md    # System maintenance checklist
└── .claudeignore               # Best-effort ignore hints for compatible Claude clients

```

### Core Definitions & Rules

* **`000_Atlas/`**: The high-level command center. It contains macro-level dashboards and maps of content (MoCs) used for daily orientation. This is the first place an AI agent or the user looks to understand the current system state.
* **`100_Spaces/`**: Dedicated to continuous, ongoing areas of responsibility that have no distinct end date (e.g., career, personal finances, side hustles).
* **`200_Projects/`**: Workspaces for specific goals with clear deadlines and outcomes. Each project gets its own isolated subfolder containing its active phases, past archives, and specific Map of Content (MoC).
* **`300_Slipbox/`**: The Zettelkasten knowledge base. **Rule: No subfolders allowed directly inside this folder.** All technical notes, concepts, and ideas live here as flat `.md` files to maximize vector search efficiency and semantic linking.
* **`400_Journal/`**: Time-series data, daily scratchpads, and meeting notes, organized chronologically by year.
* **`999_Templates/`**: Directory for Templater templates. It is not hidden by the filesystem; configure Templater to use this directory and optionally exclude it from Obsidian searches.

### Initialization and Verification Behavior

* `arc init` with no path targets the current working directory and asks for confirmation before writing. A supplied path does not prompt.
* Initialization is repeatable and non-destructive: create missing directories and files, never overwrite existing files, and report each skipped file. Do not offer a force-overwrite option in the initial release.
* Filesystem errors must be reported clearly and result in a non-zero exit code. Initialization may have created some missing directories or files before an error; it does not promise rollback.
* `arc verify` checks the required top-level ARC folders, standard Spaces subfolders, generated Atlas and template files, and `.claudeignore`, and reports missing items. The sample project folders/files (`210_Project_Alpha/` and `220_Project_B/`) are optional. Extra user files, folders, projects, phases, and journal-year folders are allowed.
* Verification fails if a directory exists directly inside `300_Slipbox/`. Nested directories elsewhere are allowed.
* The journal year directory is derived from the local calendar year at initialization. Keep date generation testable by injecting or otherwise controlling the clock in tests.

### Core Files, Templates & Automation

* **`Dashboard.md`**: The master operational runway. Contains Dataview queries that automatically pull active tasks and projects. AI agents read this first to establish current system context.
* **`MoC_Idea_Matrix.md`**: The semantic web index mapping loose, high-potential concepts and connecting diverse nodes from the Slipbox.
* **`MoC_Project_Alpha.md`**: A Map of Content acting as a master blueprint for a specific project, tracking execution phases and deliverables.
* **`TPL_Concept.md`**: A Templater template for concept notes in `300_Slipbox/`. Captures flat, atomic ideas and injects `id`, `type: concept`, and `tags`.
* **`TPL_Project_Task.md`**: A Templater template for task-note creation in `200_Projects/`. Defines actionable tasks and injects `project`, `phase`, and `status`.
* **`TPL_Daily_Journal.md`**: A Templater template for journal notes in `400_Journal/`. Provides a time-series scratchpad with a quick "Flash Ideas" capture zone.
* **`TPL_Tech_Architecture.md`**: A Templater template for technical notes in `300_Slipbox/`. Captures software engineering specs, injects `subtype: tech-architecture`, and pre-formats API endpoints and database schema tables.
* **`TPL_Meeting_Note.md`**: A Templater template for meeting-note creation in `200_Projects/` or `400_Journal/`. Captures stand-ups and syncs, injects `attendees`, and formats structural action items for Dataview task queries.
* **`TPL_Weekly_Review.md`**: A Templater template for reviews in `400_Journal/`. Provides a system maintenance checklist (e.g., reviewing completed projects and moving loose ideas to the Slipbox).
* **`.claudeignore`**: Provides best-effort exclusions for Claude clients that honor this filename. It does not block filesystem access and is not a security or privacy boundary; other AI/MCP clients may ignore it. Configure access restrictions in each client or at the filesystem/OS level.

### Template Data Contract and Obsidian Prerequisites

* The CLI writes Markdown and query text only. Users must install the Obsidian community plugins **Dataview** and **Templater** themselves. They must configure Templater's template folder to `999_Templates/` and enable the desired folder-template rules; generated templates are not automatically triggered by Obsidian.
* Project task notes use YAML frontmatter with `type: task`, `project`, `phase`, and `status`. Use the status values `todo`, `in-progress`, `done`, or `blocked`. Project MoCs use `type: project` and one of `active`, `on-hold`, `done`, or `archived` for `status`. Dashboard queries must use these field names and values.
* Meeting action items use Markdown task checkboxes; Dataview task queries roll these up separately from task-note frontmatter. Templates and dashboard queries must include examples that match this contract.
* Graph group colors and path filters are recommendations for users to enter in Obsidian's Graph View settings. The CLI does not edit Obsidian's settings or guarantee that those settings transfer between vaults.

### Recommended Obsidian Graph View Colors

To maintain visual clarity and cognitive distinction across the architecture layers within Obsidian's Graph View, the following color code standard is established for Graph Groups:

| ARC Layer | Folder Path / Rule | Recommended Color / Hex | Visual Purpose |
| --- | --- | --- | --- |
| **Atlas** | `path:000_Atlas` | **Gold / Yellow** (`#F1C40F`) | Highlights command centers and master system entrypoints. |
| **Spaces** | `path:100_Spaces` | **Electric Blue** (`#3498DB`) | Represents continuous, long-term life and work spheres. |
| **Projects** | `path:200_Projects` | **Emerald Green** (`#2ECC71`) | Signals active execution, bounded goals, and sprints. |
| **Slipbox** | `path:300_Slipbox` | **Amethyst Purple** (`#9B59B6`) | Visualizes the Zettelkasten atomic knowledge web. |
| **Journal** | `path:400_Journal` | **Coral Orange** (`#E67E22`) | Distinguishes chronological logs and daily scratchpads. |
| **Templates** | `path:999_Templates` | **Slate Gray** (`#7F8C8D`) | Mutes system automation scripts and UI metadata. |

---

## 🏃 Execution Phases (Roadmap)

### Phase 1: Environment & Dependency Initialization

* [x] Create `.devcontainer/devcontainer.json` mapping to a Node.js image with `pnpm` enabled.
* [x] Initialize `package.json` with the project metadata and CLI dependencies.
* [x] Install runtime dependencies using `pnpm add commander fs-extra chalk @inquirer/prompts`.
* [x] Install dev dependencies using `pnpm add -D typescript @types/node @types/fs-extra tsup vitest prettier`.
* [x] Configure `tsconfig.json`, `tsup.config.ts`, `.prettierrc`, and `.prettierignore`.
* [x] Add package scripts for build, test, type checking, and non-mutating formatting checks.

### Phase 2: Core CLI Architecture Setup

* [x] Create `bin/cli.mjs` wrapper script with the proper shebang (`#!/usr/bin/env node`) importing the built CLI.
* [x] Write `src/index.ts` to implement `commander`, defining the CLI name, version, and the commands.
* [x] Map the `"bin"` property in `package.json` to `"bin/cli.mjs"`.
* [x] Create the `logger.ts` and `fileSystem.ts` utilities.
* [x] Define CLI exit codes, path resolution, confirmation behavior, and collision reporting.

### Phase 3: Template & Command Logic Implementation

* [x] Populate `src/templates/` with the Markdown structures.
* [x] Write `src/commands/init.ts` logic:
  * [x] If `[path]` is empty, default to `process.cwd()` and ask for confirmation.
  * [x] Create missing directories without deleting or replacing existing content.
  * [x] Write only missing files and report existing files as preserved.
  * [x] Report filesystem errors and exit non-zero; document possible partial scaffolds.
  * [x] Create the current local calendar year's journal folder with testable clock behavior.
* [x] Inject `.gitkeep` files into designated folders.
* [x] Inject boilerplate `.md` files into their respective directories.
* [x] Add stylized terminal feedback using `logger.ts`.
* [x] Document Dataview/Templater installation and Graph View configuration as user setup.

### Phase 4: Testing Suite Implementation (`tests/`)

* [x] Write `tests/utils/fileSystem.test.ts` to validate helper functions.
* [x] Write `tests/templates/templates.test.ts` to verify Markdown output and frontmatter structure.
* [x] Write command tests for scaffolding, confirmation, idempotency, collisions, errors, and compliance.
* [x] Write `tests/index.test.ts` to test CLI routing and version configuration.
* [x] Verify that user-added content is accepted and direct Slipbox subfolders are rejected.
* [x] Test current-year folder generation with a controlled clock.

### Phase 5: Build & Local Testing

* [x] Add build, test, typecheck, and formatting-check scripts to `package.json`.
* [x] Add CI to install with the frozen lockfile and run format check, tests, typecheck, and build.
* [x] Run build, tests, and formatting checks.
* [x] Smoke-test local CLI commands against temporary vaults and verify npm package contents.
* [x] Document that `npx @hitahub/arc ...` and `pnpm dlx @hitahub/arc ...` require the scoped package to be published and accessible from the configured registry.

---

## 🔮 Future Roadmap (Ecosystem Expansion)

The following are exploratory directions after the core CLI scaffolding is stable. Each requires feasibility and requirements validation before implementation commitments:

### 1. Obsidian Plugin Ecosystem (ARC Enforcer) — Exploration

A native Obsidian plugin that may help maintain day-to-day structural integrity without relying on external dependencies like Templater or Linter.

* **Slipbox Guardian (Anti-Subfolder Protocol):** Investigate whether supported Obsidian APIs can reliably detect and prevent folder creation inside `300_Slipbox/`. Define behavior for external filesystem changes and API limitations before promising enforcement.
* **Native ARC Injector:** Explore replacing Templater with native template generation. Validate file-creation hooks and define ID and YAML behavior based on folder paths before committing to automatic injection.
* **Naked Link Linter:** Prototype editor diagnostics for isolated `[[Links]]`; assess supported editor APIs and whether a warning or opt-in correction is feasible.
* **MCP Sync Daemon:** Investigate whether an Obsidian plugin can safely expose task status to configured local clients. Define transport, consent, authentication, and lifecycle requirements before promising real-time synchronization.

### 2. Dedicated ARC MCP Server (`@arc-cli/mcp-server`) — Exploration

Explore an ARC-aware context server as an alternative to generic filesystem MCP access for compatible clients.

* Exposes specific semantic tools to the LLM (e.g., `get_active_projects()`, `search_slipbox_by_tag()`, `create_task()`).
* Measure whether structured JSON context improves token use and retrieval quality compared with parsing Markdown; do not assume it eliminates hallucinations.

### 3. CI/CD for Notes (`arc health` & Git Hooks)

Treating the knowledge base like a production codebase.

* **`npx @hitahub/arc health`**: Scans the vault to report on orphaned notes, broken links, or ARC rule violations.
* **Git Hook Integration**: Automatically installs via Husky to prevent committing code/notes if the vault violates ARC rules (e.g., preventing a push if subfolders exist in the Slipbox).

### 4. AI-Powered Semantic Auto-Linker

An offline background daemon running a local embedding model (via Ollama).

* Automatically analyzes new notes in `300_Slipbox/` and suggests relevant `[[Links]]` at the bottom of the document based on vector similarity, ensuring no idea gets lost.

### 5. Lifecycle Automation (`arc archive`)

* **`npx @hitahub/arc archive <Project-Name>`**: Automatically moves completed projects out of `200_Projects/` into cold storage, rewrites the YAML frontmatter to `status: archived`, and purges it from the active `Dashboard.md`.

### 6. Seamless Web Publishing (`arc publish`)

* Converts specific active workspaces (like `120_Creative_SideHustle`) into static sites (Astro/VitePress) or pushes content directly to newsletter platforms via API, automatically stripping internal AI tags and metadata.
