# Manual npm release guide

This guide describes a manual release process for the public scoped package `@hitahub/arc`. It does not publish automatically. Coordinate the release with the project maintainers.

## Before the first publish

Confirm all of the following before publishing:

- The publisher is signed in to npm with an account authorized to publish under the `@hitahub` scope.
- The scope and registry are configured as intended. Check the registry with `npm config get registry`.
- The package name and version are available and correct. A published version cannot be reused.
- The intended visibility is public. Scoped packages may require the explicit `--access public` flag on the first publish.
- The working tree and release commit are the reviewed state to publish.
- The release notes accurately describe implemented changes; do not describe exploratory roadmap items as shipped features.

Do not commit npm tokens or credentials to the repository. Use npm's supported login and authentication mechanisms.

## Prepare and validate

From the release commit:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
npm pack --dry-run
```

Inspect the dry-run output. It should include `README.md`, `docs/`, `bin/cli.mjs`, `dist/`, and `package.json`; it should identify the package as `@hitahub/arc` and expose the `arc` binary.

Review the version in `package.json`. Maintainers should select and update the release version in a separate reviewed change. Do not edit generated lockfile metadata manually; if the versioning change affects `pnpm-lock.yaml`, regenerate it with pnpm and review the resulting diff.

## Publish

For the first public release of a scoped package, publish with explicit public access:

```bash
npm publish --access public
```

For later releases, confirm the package's current visibility and follow the maintainers' release instructions. Do not run `npm publish` from an unreviewed working tree or as part of ordinary pull-request validation.

## Verify the published release

After publication, verify the registry metadata and test the package through its public entry points:

```bash
npm view @hitahub/arc version
npx @hitahub/arc@latest --version
pnpm dlx @hitahub/arc@latest --version
```

Test `init` and `verify` against a temporary directory, not a personal vault. Confirm that the reported version matches the intended release and that the binary remains named `arc`.

## Release automation

Release automation, changelog generation, tagging policy, and automated publishing are not configured in this repository. Add them only after maintainers decide on the desired workflow and credential/permission model.
