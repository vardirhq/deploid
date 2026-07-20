# Plugins and built-in modules

Deploid keeps a plugin architecture internally while presenting one package to users.
Installing `@deploid/cli` includes every built-in workflow module.

## Built-in modules

- `assets`
- `artifacts`
- `build-android`
- `changelog`
- `ci-init`
- `debug-network`
- `deploy-android`
- `doctor`
- `packaging-capacitor`
- `packaging-electron`
- `prepare-ios`
- `publish`
- `release-init`
- `version`

Use `deploid plugin --list` to inspect them. Built-ins cannot be installed or
removed individually because their versions must match the CLI release.

## Optional app integrations

`@deploid/plugin-storage` remains separate because it is installed into the app and
declares Capacitor peer dependencies:

```bash
deploid plugin --install storage
```

## Create a custom plugin

```bash
deploid plugin init my-step
cd plugins/my-step
npm install
npm run build
deploid plugin validate .
```

A custom plugin uses the public CLI contract:

```ts
import type { DeploidPlugin } from '@deploid/cli';

const plugin: DeploidPlugin = {
  name: 'my-step',
  async plan() {
    return ['Inspect the project', 'Apply the custom step'];
  },
  async run(ctx) {
    ctx.logger.info(`Running in ${ctx.cwd}`);
  }
};

export default plugin;
```

Its package should expose `dist/index.js` and declare:

```json
{
  "name": "@your-scope/deploid-plugin-my-step",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@deploid/cli": "^2.0.0"
  }
}
```

The built-in loader first checks the modules carried by the CLI, then resolves an
installed `@deploid/plugin-<key>` package for third-party compatibility.

## Repository development

Built-ins remain separate private workspaces under `packages/plugins/`. This keeps
their code, dependencies, and tests modular. During the CLI build their compiled
output is copied into `packages/cli/dist/internal/`; they are not published as
independent npm packages.
