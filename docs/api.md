# App API

Deploid's primary product direction is now:

1. `@deploid/cli` as the reusable workflow/runtime layer
2. `@deploid/cli` as the terminal client
3. optional clients such as Studio or third-party apps on top

This document covers the app-facing API currently exported by `@deploid/cli`.

## Design Goals

- Let external apps integrate without shelling out blindly.
- Keep machine-facing calls stable and explicit.
- Make CLI behavior a thin wrapper over reusable core operations.

## Current Surface

`@deploid/cli` currently exports these app-facing helpers:

- `createFallbackConfig()`
- `loadConfigOptional(cwd?, fallback?)`
- `inspectArtifacts(cwd, config?)`
- `listAndroidDevices()`
- `runPluginCommand(pluginName, options?)`
- `runDoctorCommand(options?)`

These are exported from:

- [packages/core/src/app-api.ts](/home/chris/Documents/GitHub/deploid/packages/core/src/app-api.ts)

## Install

```bash
npm install @deploid/cli
```

## Example

```ts
import { inspectArtifacts, runDoctorCommand, runPluginCommand } from '@deploid/cli';

await runDoctorCommand({
  cwd: '/path/to/project',
  doctorOptions: {
    json: true,
    summary: true
  }
});

await runPluginCommand('assets', {
  cwd: '/path/to/project',
  debug: true
});

const artifacts = inspectArtifacts('/path/to/project');
```

## API Reference

### `createFallbackConfig()`

Returns a minimal `DeploidConfig` shape for commands that should still run when no project config exists yet.

Use it when a client needs a harmless placeholder config for diagnostics-style flows.

### `loadConfigOptional(cwd?, fallback?)`

Attempts to load Deploid config from `cwd`.

- If config exists, returns it.
- If config is missing, returns the provided `fallback`.
- If no fallback is passed, uses `createFallbackConfig()`.

This is useful for diagnostics and onboarding flows where "missing config" is expected state rather than a hard error.

### `runPluginCommand(pluginName, options?)`

Runs a single Deploid plugin through the shared pipeline.

Options:

- `cwd?: string`
- `config?: DeploidConfig`
- `debug?: boolean`
- `contextExtras?: Record<string, unknown>`

This is the main primitive external apps should use for one-shot workflow actions such as:

- `assets`
- `packaging-capacitor`
- `build-android`
- `deploy-android`
- `prepare-ios`

Example:

```ts
await runPluginCommand('build-android', {
  cwd: projectRoot,
  debug: true
});
```

### `inspectArtifacts(cwd, config?)`

Returns the same artifact metadata used by `deploid artifacts`.

Use it for:

- release dashboards
- recent build output cards
- cleanup prompts
- desktop/mobile artifact pickers

Example:

```ts
import { inspectArtifacts, loadConfigOptional } from '@deploid/cli';

const config = await loadConfigOptional(projectRoot);
const artifacts = inspectArtifacts(projectRoot, config);
```

### `listAndroidDevices()`

Runs `adb devices` and returns structured device records.

Example:

```ts
import { listAndroidDevices } from '@deploid/cli';

const devices = listAndroidDevices();
```

### `runDoctorCommand(options?)`

Runs the doctor plugin using the same shared command path as the CLI.

Options:

- all `CommandRunOptions`
- `doctorOptions?:`
  - `json?: boolean`
  - `markdown?: boolean`
  - `ci?: boolean`
  - `summary?: boolean`
  - `verbose?: boolean`
  - `projectOnly?: boolean`
  - `fix?: boolean`

Example:

```ts
await runDoctorCommand({
  cwd: projectRoot,
  doctorOptions: {
    markdown: true,
    summary: true
  }
});
```

## What External Clients Should Do

Recommended:

- Use `runDoctorCommand()` for diagnostics and readiness dashboards.
- Use `runPluginCommand()` for concrete workflow steps.
- Treat CLI text output as human-facing, not machine contract.
- Prefer JSON/CI/Markdown modes when building automation around doctor.

Not recommended:

- Parsing freeform terminal output when structured API access exists.
- Re-implementing config loading or plugin resolution externally.
- Assuming Studio-specific behavior is the main supported path.

## Stability Notes

This API is still early-stage, but it is the intended direction for:

- editor integrations
- internal dashboards
- Electron/web clients
- CI wrappers
- custom deployment apps

The next logical additions are likely:

- workflow-level run helpers (`runWorkflow('build')`)
- structured results instead of relying on process output side effects
- a dedicated daemon client package on top of the local HTTP mode

## Local Daemon Mode

`@deploid/cli` now exposes an optional local daemon:

```bash
deploid daemon --host 127.0.0.1 --port 4949
```

Available endpoints:

- `GET /health`
- `GET /config?cwd=/abs/path`
- `GET /artifacts?cwd=/abs/path&kind=all`
- `GET /devices`
- `POST /doctor`
- `POST /plugin`

Example `POST /doctor` body:

```json
{
  "cwd": "/path/to/project",
  "doctorOptions": {
    "summary": true,
    "projectOnly": true
  }
}
```

See:

- [examples/api-client/README.md](/home/chris/Documents/GitHub/deploid/examples/api-client/README.md)
