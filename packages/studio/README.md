# Deploid desktop app

The Deploid GUI is a private workspace application distributed as native desktop
artifacts, not as an npm package. It bundles the supported `@deploid/cli` and provides
a readiness-first interface over the same commands and project state.

## Product boundary

- The CLI remains the workflow engine and public npm product.
- The desktop app selects projects, runs allow-listed CLI commands, and presents doctor,
  artifact, device, and activity data.
- Releases are downloadable AppImage/DEB, DMG/ZIP, and NSIS/portable Windows artifacts.
- User projects do not need a global Deploid or npm installation to run the bundled app.

## Development

```bash
pnpm install
pnpm --filter @deploid/studio dev
```

Set `DEPLOID_STUDIO_LAUNCH_CWD` to open a particular project during development.
Set `DEPLOID_CLI_PATH` only when testing against an alternate CLI entrypoint.

## Build installers

```bash
pnpm --filter @deploid/studio dist:linux
pnpm --filter @deploid/studio dist:mac
pnpm --filter @deploid/studio dist:windows
```

Artifacts are written to `packages/studio/release/`. Cross-platform production builds
run in GitHub Actions so each installer is produced on its native operating system.
