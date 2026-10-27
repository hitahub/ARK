# Getting started

This guide covers installing and using ARC CLI. For the concepts behind the folder model, see [ARC methodology](methodology.md).

## Requirements

- Node.js 20 or newer.
- To use the generated Dataview queries and Templater templates in Obsidian, install those community plugins separately. See [Obsidian setup](obsidian-setup.md).

## Run from the registry

The package name is `@hitahub/arc`; its binary command is `arc`. Once the package has been published and is accessible from your npm registry:

```bash
# Initialize the current directory. The CLI asks for confirmation.
npx @hitahub/arc init

# Initialize a particular vault directory.
npx @hitahub/arc init ./MyNewVault

# Verify the current directory or a specified vault.
npx @hitahub/arc verify
npx @hitahub/arc verify ./MyNewVault
```

Equivalent commands using pnpm:

```bash
pnpm dlx @hitahub/arc init
pnpm dlx @hitahub/arc init ./MyNewVault
pnpm dlx @hitahub/arc verify
pnpm dlx @hitahub/arc verify ./MyNewVault
```

If installed globally, invoke the binary directly:

```bash
npm install --global @hitahub/arc
arc init ./MyNewVault
arc verify ./MyNewVault
```

## Run from a checkout

For local development or before publication:

```bash
pnpm install
pnpm build
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
```

The package is not downloaded from the registry when using `node bin/cli.mjs`.

## `init` behavior

`arc init [path]` creates the ARC baseline in the target directory.

- If `path` is omitted, the target is the current working directory and the CLI asks for confirmation before writing.
- If `path` is supplied, the CLI creates that directory if necessary and does not prompt.
- Missing directories and generated files are created. Existing files are preserved and reported; there is no overwrite/force mode.
- A directory occupying a generated file path is an error.
- An I/O error is surfaced and results in a non-zero process exit code. Initialization is not transactional, so an error may leave a partially created scaffold.
- A local-calendar-year folder is created in `400_Journal/`.

## `verify` behavior

`arc verify [path]` defaults to the current directory. It checks the required directories and files listed in [Vault structure](vault-structure.md), and rejects directories directly inside `300_Slipbox/`.

Additional user folders and files are allowed. The example project is scaffolded by `init`, but is not required for `verify` to pass. An invalid vault or a filesystem/command error exits non-zero.

## Troubleshooting

### The `npx` or `pnpm dlx` command cannot find the package

The scoped package must first be published to a registry, and your npm configuration must have access to that scope. Local checkout usage does not require publishing.

### Obsidian displays the query blocks as text or templates do not run

Install and enable Dataview and Templater in Obsidian. Configure Templater to use `999_Templates/` and set any desired folder-template rules; creating template files does not enable or assign the plugins automatically. See [Obsidian setup](obsidian-setup.md).

### Verification reports a Slipbox directory

Move the folder out of `300_Slipbox/` or flatten its notes. The ARC rule forbids direct child directories there; files may remain directly in the Slipbox.
