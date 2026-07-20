# Changelog

## Unreleased

### Added

- Added a standalone Deploid desktop client with readiness, workflow, target, artifact, device, and live CLI activity views.
- Added native AppImage/DEB, DMG/ZIP, and NSIS/portable desktop packaging with cross-platform GitHub Actions builds and bundled-CLI smoke validation.
- Added branded desktop application artwork and automated implementation screenshots for visual review.
- Added clean-install package validation on Linux, macOS, and Windows, plus an initialized-project smoke test on Linux.
- Added packed-install release validation that exercises the published CLI, public API, and built-in module discovery.
- Added a migration guide for projects and custom plugins moving from `@deploid/core` to `@deploid/cli`.
- Added new top-level CLI commands for `doctor`, `daemon`, `artifacts`, `electron`, `version`, `changelog`, and `ship`.
- Added richer CLI options for project initialization, asset source overrides, targeted Android deployment, emulator booting, log streaming, and JSON-oriented device inspection.
- Added an app-facing core/API layer with daemon support, artifact inspection helpers, device helpers, and example client integration docs.
- Added first-party plugin packages for artifacts, changelog generation, CI bootstrapping, doctor checks, Electron packaging, publishing, release initialization, and version orchestration.

### Changed

- Retired `@deploid/studio` as a public npm package; the private workspace now produces standalone desktop installers with an embedded CLI.
- Prepared desktop version `2.0.8-beta.1` for the first cross-platform GitHub prerelease.
- Changed `@deploid/cli` to the single user-facing distribution, with private core and built-in module output carried inside the package.
- Changed Sharp and Google APIs back to normal npm dependencies so native packages are selected for the user's platform instead of being frozen into the release tarball.
- Updated current documentation and the website to distinguish built-ins from optional and third-party integrations.
- Expanded Deploid from an Android packaging flow into a broader release workflow covering readiness checks, release-note generation, publishing, and external app integration.
- Updated package publishing metadata across the workspace, including `@deploid/cli` `2.0.20`, `@deploid/core` `2.0.2`, `@deploid/studio` `2.0.8`, `@deploid/plugin-deploy-android` `2.0.1`, and `@deploid/plugin-storage` `2.0.1`.
- Broadened the storage plugin's Capacitor compatibility range to include Capacitor 8.
- Expanded the documentation set with new API documentation plus larger CLI, plugin, example, and Studio coverage.

### Improved

- Reworked command execution to route more workflows through reusable plugin helpers instead of one-off pipeline wiring.
- Refreshed Deploid Studio's renderer and desktop integration to match the expanded workflow surface.

### Removed

- Removed separate publishing for core and built-in plugin workspaces.
- Removed the obsolete Changesets-based multi-package release configuration.
