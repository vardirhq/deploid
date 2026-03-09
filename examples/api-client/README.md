# API Client Example

This example shows how a custom app or script can call Deploid through the shared core API instead of spawning the CLI directly.

## Files

- `doctor.mjs` - runs the shared doctor command API
- `artifacts.mjs` - reads artifact metadata through `@deploid/core`
- `daemon-client.mjs` - calls the local HTTP daemon

## Run

From this repository root:

```bash
pnpm --filter @deploid/core build
node examples/api-client/doctor.mjs /path/to/project
node examples/api-client/artifacts.mjs /path/to/project
```

If no path is provided, it uses the current working directory.

To exercise the daemon:

```bash
pnpm --filter @deploid/cli build
node packages/cli/dist/index.js daemon
node examples/api-client/daemon-client.mjs /path/to/project
```

## Why This Matters

This is the preferred integration direction for:

- custom dashboards
- Electron clients
- editor extensions
- automation wrappers

Instead of doing:

```bash
deploid doctor --json
```

an app can call the same core behavior directly.
In this repo example, the script imports the local built core package from `packages/core/dist`.

In an external app, you would install and import `@deploid/core` directly.
