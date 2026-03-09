# Deploid Refactor TODO

## Cleanup and Baseline
- [x] Remove generated and duplicate artifacts from git (e.g., `*.tsbuildinfo`, stale compiled outputs if redundant).
- [x] Standardize naming: remove all runtime/user-facing `shipwright` references.
- [x] Align package metadata (homepage/repo/bugs/bin naming) across workspace.
- [x] Bump workspace packages to `2.0.0` and mark monorepo root as private.
- [x] Add/update `.gitignore` for generated build metadata.
- [x] Run build/tests to establish a green baseline after cleanup.

## Architecture Consolidation
- [x] Choose one core runtime path and remove duplicate core implementation.
- [x] Define a single `DeploidConfig` type and remove the legacy alias.
- [x] Centralize config loading/validation in one package.
- [x] Replace ad-hoc plugin loading with one shared plugin loader.
- [x] Ensure CLI is a thin orchestration layer only.

## Plugin and Pipeline Improvements
- [x] Define a stable plugin contract (`validate`, `plan`, `run`).
- [x] Add capability/preflight checks (ADB, Java, Android SDK, Node).
- [x] Make plugin operations idempotent and rerunnable.
- [x] Remove placeholder commands or guard them behind clear experimental flags.

## Quality and Tooling
- [x] Add integration fixtures for `vite`, `next`, `cra`, and static projects.
- [x] Expand CLI integration tests for real command flows.
- [x] Add CI matrix for supported Node versions.
- [x] Add release/versioning workflow and enforce source-of-truth from `src`.

## Docs and Migration
- [x] Update docs to match real command behavior and supported features.
- [x] Document migration notes for renamed config/types.
- [x] Publish a deprecation plan for legacy naming/commands.

## Deploid Studio UX
- [x] Redesign Studio layout to feel workflow-first instead of terminal-first.
- [x] Replace plain command dropdown with friendly task cards and descriptions.
- [x] Add user-focused controls: recent folders, clearer status, run metrics, log filter/copy/clear.
- [x] Add visual polish pass with iconography and branded empty/success/error states.
- [x] Rebuild Studio around readiness, blockers, artifacts, devices, and quick actions instead of command-launcher UX.

## Compatibility Follow-ups
- [x] Fix `@deploid/plugin-storage` peer compatibility for Capacitor 8 projects.
- [x] Make `deploid init` install required plugins even if optional plugin install fails.
- [x] Auto-detect package manager in `deploid init` and prefer lockfile-native installs (pnpm/yarn/bun).
- [x] Allow `deploid init` retries when `deploid.config.ts` already exists (resume mode + `--force` overwrite).
- [x] Add `deploid assets --source <path>` override to avoid editing config for one-off asset generation.
- [x] Add `@deploid/plugin-packaging-electron` and wire CLI/plugin manager support for desktop app scaffolding.
- [x] Expand `deploid init` to collect app metadata and propagate to `deploid.config.ts`, `capacitor.config.json`, and `package.json`.
- [x] Normalize artifact command aliases so `deploid artifacts --list|--inspect|--clean` matches other CLI command styles.

## Release Workflow Foundations
- [x] Add `deploid doctor` to audit project readiness, required tooling, and common Android setup gaps.
- [x] Expand `deploid doctor` with richer readiness sections, output modes, and safe auto-fixes.
- [x] Add Studio-facing doctor integration so readiness can be surfaced outside raw CLI logs.

## CLI as Core Product
- [x] Extract reusable core command-runner APIs so external apps can integrate without shelling out blindly.
- [x] Rebase the CLI onto the shared command API instead of ad hoc command orchestration.
- [x] Reposition Studio as an optional experimental client rather than the primary product direction.

## Release Workflow Roadmap
### Phase 1: Release Setup and Shipping
- [x] Add `deploid release init` to scaffold signing, versioning, env templates, and publish placeholders.
- [x] Implement real `deploid publish` flows for GitHub Releases and Play internal-track uploads.
- [x] Add `deploid version` to coordinate semver, Android version metadata, and release notes scaffolding.

### Phase 2: Workflow Orchestration
- [x] Add opinionated workflow commands such as `deploid build`, `deploid ship`, and `deploid release`.
- [x] Expand `deploid doctor --fix` to repair config drift, missing scripts/deps, and release metadata.
- [x] Add artifact management commands for listing, inspecting, and cleaning generated outputs.

### Phase 3: Team and CI Automation
- [x] Add `deploid ci init github` to generate release-ready GitHub Actions workflows and secret docs.
- [x] Improve device/deploy UX with device targeting, emulator boot, launch-and-log, and faster iteration loops.
- [x] Add changelog and release notes automation for local and CI-driven releases.

### Phase 4: Platform Surface
- [x] Add `deploid plugin init` and plugin validation/templates for extension authors.
- [x] Add an optional local API/daemon mode for external apps to integrate without shelling out.
- [x] Publish richer external-client examples built on `@deploid/core`.
