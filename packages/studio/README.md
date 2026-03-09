# Deploid Studio

Experimental desktop client for Deploid workflows in a project folder.

## Install

```bash
npm install -g @deploid/studio
```

## Run

```bash
deploid-studio
```

## What You Get

- Project folder picker with recent-folder shortcuts.
- Readiness-first workflow board driven by `deploid doctor`.
- Blockers, warnings, artifacts, and connected device visibility without digging through logs.
- Recommended quick actions based on current project state.
- Live activity panel with output filters and copy/clear controls.
- Run state indicators and session metrics.

## Notes
- Deploid Studio executes `@deploid/cli` commands from the selected working directory.
- The primary product direction is CLI + reusable core APIs; Studio is an optional client on top of that stack.
- Packaging in Deploid 2.0 is `capacitor` only.
