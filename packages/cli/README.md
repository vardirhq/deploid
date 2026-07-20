# @deploid/cli

The single user-facing Deploid package. It contains the CLI, public TypeScript API,
core runtime, and all built-in workflow modules.

## Install

```bash
npm install --global @deploid/cli
```

Then initialize a web application:

```bash
deploid init
deploid package
deploid build
deploid deploy --launch
```

Built-in capabilities do not need separate npm installation. List them with:

```bash
deploid plugin --list
```

`@deploid/plugin-storage` is optional because it becomes a dependency of the
consumer application. Install it with `deploid plugin --install storage`.

## Programmatic API

```ts
import { loadConfig, runPluginCommand, inspectArtifacts } from '@deploid/cli';

const config = await loadConfig();
await runPluginCommand('doctor', { cwd: process.cwd(), config });
const artifacts = inspectArtifacts(process.cwd(), config);
```

## Custom plugins

```bash
deploid plugin init my-step
deploid plugin validate plugins/my-step
```

Custom plugins use `@deploid/cli` as their peer dependency and are resolved by the
same runtime loader as built-ins.
