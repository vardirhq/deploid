# Changelog

## Unreleased

### Added

- Added new top-level CLI commands for `doctor`, `daemon`, `artifacts`, `electron`, `version`, `changelog`, and `ship`.
- Added richer CLI options for project initialization, asset source overrides, targeted Android deployment, emulator booting, log streaming, and JSON-oriented device inspection.
- Added an app-facing core/API layer with daemon support, artifact inspection helpers, device helpers, and example client integration docs.
- Added first-party plugin packages for artifacts, changelog generation, CI bootstrapping, doctor checks, Electron packaging, publishing, release initialization, and version orchestration.

### Changed

- Expanded Deploid from an Android packaging flow into a broader release workflow covering readiness checks, release-note generation, publishing, and external app integration.
- Updated package publishing metadata across the workspace, including `@deploid/cli` `2.0.20`, `@deploid/core` `2.0.2`, `@deploid/studio` `2.0.8`, `@deploid/plugin-deploy-android` `2.0.1`, and `@deploid/plugin-storage` `2.0.1`.
- Broadened the storage plugin's Capacitor compatibility range to include Capacitor 8.
- Expanded the documentation set with new API documentation plus larger CLI, plugin, example, and Studio coverage.

### Improved

- Reworked command execution to route more workflows through reusable plugin helpers instead of one-off pipeline wiring.
- Refreshed Deploid Studio's renderer and desktop integration to match the expanded workflow surface.
