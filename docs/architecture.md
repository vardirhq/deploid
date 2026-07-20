# Deploid architecture

Deploid is modular in the repository and monolithic at the npm distribution boundary.

## Package boundary

- `@deploid/cli` is the public package and contains the executable and TypeScript API.
- `packages/core` is a private workspace containing configuration, pipelines, logging, and loading.
- `packages/plugins/*` contains private built-in workflow modules.
- `@deploid/plugin-storage` is public because it runs inside consumer applications.
- The legacy Studio prototype is a private workspace and is not published to npm.

During `@deploid/cli` build, compiled core and built-in output is copied into
`dist/internal`. Third-party libraries such as Sharp and Google APIs remain normal
CLI dependencies, allowing npm to select platform-correct native packages.

## Command flow

```text
command -> load configuration -> load built-in/custom module -> create context -> run pipeline
```

The loader prefers the internal module carried by the current CLI release. If no
built-in exists for a key, it resolves an installed `@deploid/plugin-<key>` package.

## Public API

Consumers import types and orchestration helpers from the same package:

```ts
import { loadConfig, runPluginCommand } from '@deploid/cli';
```

The package export maps that API to the internal core output without exposing the
private workspace as a separately versioned product.

## Repository layout

```text
packages/
  cli/                 public npm distribution
  core/                private runtime workspace
  plugins/             private built-ins plus public storage integration
  studio/              private legacy GUI prototype
```

## Design rules

1. Built-in module versions always match the CLI release.
2. User projects never install built-ins individually.
3. Native and third-party dependencies are installed normally by npm.
4. Custom plugins depend on the public `@deploid/cli` contract.
5. Release validation must install the packed tarball and exercise both CLI and API.
6. A future GUI is a standalone desktop release that drives the CLI or its local API.
