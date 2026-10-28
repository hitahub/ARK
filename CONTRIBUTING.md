# Contributing to ARC CLI

Thank you for helping improve ARC CLI. This guide explains how to propose changes, work on the codebase, and prepare a pull request.

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Please report security vulnerabilities using the process in [SECURITY.md](SECURITY.md), not through a public issue or pull request.

## Before you start

- For a bug fix or a small documentation correction, you can open a pull request directly.
- For a new command, behavior change, or larger feature, open an issue or discussion first so the scope and approach can be agreed on before implementation.
- Check existing issues and pull requests for related work.
- Keep contributions focused. Avoid bundling unrelated cleanup with a feature or fix.

There is currently no required issue template, branch naming scheme, commit message format, CLA, or DCO process. Follow any instructions added to the repository in the future.

## Set up the project

Requirements:

- Node.js 20 or newer
- pnpm

Fork and clone the repository, then install dependencies:

```bash
git clone https://github.com/hitahub/ARK.git
cd ARK
pnpm install
```

Create a working branch for your change:

```bash
git switch -c describe-your-change
```

Use a descriptive branch name appropriate to the change; the example above is not a mandatory naming convention.

## Make a change

- Preserve the CLI's non-destructive behavior: initialization must not overwrite existing vault files.
- Surface filesystem and command errors clearly; avoid silent failures or success-shaped fallbacks.
- Keep generated templates, frontmatter fields, status values, and Dataview queries consistent.
- Add or update tests when observable behavior changes.
- Update the relevant user or developer documentation when commands, behavior, metadata, or setup instructions change. Documentation is under [`docs/`](docs/); the README links to the guides.
- Keep future or experimental ideas clearly distinguished from implemented features.
- Do not add credentials, tokens, private keys, or other secrets to the repository.

For an overview of the codebase and implementation flows, see [`docs/development.md`](docs/development.md). For CLI and vault behavior, see [`docs/getting-started.md`](docs/getting-started.md) and [`docs/vault-structure.md`](docs/vault-structure.md).

## Validate your work

Run the relevant checks before opening a pull request:

```bash
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
```

All four checks are run by the GitHub Actions CI workflow. Tests use temporary directories and should not rely on or modify a personal Obsidian vault.

If your change affects CLI behavior, you can also smoke-test against a temporary target:

```bash
node bin/cli.mjs init ./MyNewVault
node bin/cli.mjs verify ./MyNewVault
```

## Open a pull request

When opening a pull request:

1. Explain the problem and the intended change.
2. Summarize user-visible behavior and any compatibility implications.
3. List the checks you ran and their results.
4. Link the related issue or discussion, if one exists.
5. Include screenshots only when they help explain a visual change.

Keep the pull request focused and respond to review feedback with follow-up commits. Do not force-push or rewrite shared history unless repository maintainers explicitly request it.

## Documentation and release scope

Documentation-only changes do not require a production build, but run `pnpm format:check` and verify any changed relative Markdown links. Code changes should pass the full validation commands above.

Contributors should not publish npm releases as part of ordinary pull requests. Release versioning and publication should be coordinated with the maintainers.
