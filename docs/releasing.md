# Manual package release guide

This guide describes a manual release process for the public scoped package
`@hitahub/arc` using pnpm. It does not publish automatically. Coordinate the
release with the project maintainers.

## Before the first publish

Confirm all of the following before publishing:

- The publisher is authenticated with an account authorized to publish under
  the `@hitahub` scope.
- The scope and registry are configured as intended. Check the configured
  registry with `pnpm config get registry`.
- The package name and version are available and correct. A published version cannot be reused.
- The intended visibility is public. Scoped packages may require the explicit `--access public` flag on the first publish.
- The working tree and release commit are the reviewed state to publish.
- The release notes accurately describe implemented changes; do not describe exploratory roadmap items as shipped features.

Do not commit registry tokens or credentials to the repository. Use pnpm's
supported login and authentication mechanisms.

## Prepare and validate

From the release commit:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
pnpm pack --dry-run
```

Inspect the dry-run output. It should include `README.md`, `docs/`, `bin/cli.mjs`, `dist/`, and `package.json`; it should identify the package as `@hitahub/arc` and expose the `arc` binary.

Review the version in `package.json`. Maintainers should select and update the release version in a separate reviewed change. Do not edit generated lockfile metadata manually; if the versioning change affects `pnpm-lock.yaml`, regenerate it with pnpm and review the resulting diff.

The plugin build writes this same version into
`dist/obsidian-plugin/manifest.json`; verify the built manifest matches
`package.json` before publishing. The source plugin manifest's version is kept
aligned for repository clarity, but the build output always uses the package
version as its source of truth.

## Publish

For the first public release of a scoped package, publish with explicit public
access:

```bash
pnpm publish --access public
```

For later releases, confirm the package's current visibility and follow the
maintainers' release instructions. Do not run `pnpm publish` from an
unreviewed working tree or as part of ordinary pull-request validation.

## Verify the published release

After publication, verify the registry metadata and test the package through its public entry points:

```bash
pnpm dlx @hitahub/arc@latest --version
```

Test `init` and `verify` against a temporary directory, not a personal vault. Confirm that the reported version matches the intended release and that the binary remains named `arc`.

## Release automation

Release automation, changelog generation, tagging policy, and automated publishing are not configured in this repository. Add them only after maintainers decide on the desired workflow and credential/permission model.
