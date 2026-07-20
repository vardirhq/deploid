# Contributing to Deploid

## Setup

Requirements: Node.js 18+, pnpm 9.12.0, Git, and Android tooling for device/build work.

```bash
git clone https://github.com/vardirhq/deploid.git
cd deploid
pnpm install
pnpm build
pnpm test
```

## Repository model

`packages/core` and the built-ins under `packages/plugins` are private implementation
workspaces. `packages/cli` assembles their compiled output into the public
`@deploid/cli` package. Do not add a built-in as a separately published package.

Storage is the exception because its code and Capacitor dependencies are installed
inside consumer applications. Studio also has a separate lifecycle.

## Making changes

```bash
git switch -c feat/my-change
pnpm build
pnpm test
node packages/cli/bin/deploid --help
```

For packaging changes, reproduce the release validation:

```bash
pnpm --filter @deploid/cli deploy --prod .release/cli
node scripts/prepare-release.mjs .release/cli
(cd .release/cli && pnpm pack --pack-destination ../artifacts)
```

## Built-in modules

Keep one responsibility per workspace and export a `DeploidPlugin`. Add new built-ins
to `packages/cli/scripts/copy-builtins.mjs`, the CLI development dependencies, and
the runtime/plugin documentation. Third-party dependencies required at runtime must
also be declared by `@deploid/cli` so npm installs them for the user's platform.

## Custom plugins

Use `deploid plugin init <name>`. Generated plugins import `DeploidPlugin` from
`@deploid/cli` and declare it as a peer dependency.

## Pull requests

- Use a conventional title (`feat:`, `fix:`, `docs:`, or `chore:`).
- Add or update tests for behavior changes.
- Update current documentation when the public surface changes.
- Call out breaking changes explicitly.
- Ensure CI and release-package validation pass.

## Releases

Merges to `main` publish `@deploid/cli` through npm trusted publishing. `feat:`
releases receive a minor bump, breaking changes a major bump, and other updates a
patch bump. Core and built-in workspaces are never published independently.
