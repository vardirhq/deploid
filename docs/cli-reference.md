# CLI reference

Run `deploid <command> --help` for the complete option list.

## Project setup and diagnostics

| Command | Purpose |
|---|---|
| `deploid init` | Detect the web framework, create configuration, install Capacitor, and add scripts |
| `deploid doctor` | Audit project, Android tooling, signing, and release readiness |
| `deploid daemon` | Start the local HTTP API for external tools |

`init` supports `--yes`, application metadata flags, `--assets-source`, and the
`capacitor` packaging engine. `doctor` supports JSON, Markdown, CI, summary,
project-only, verbose, and safe-fix modes.

## Build workflow

| Command | Purpose |
|---|---|
| `deploid assets` | Generate icons and screenshots |
| `deploid package` | Build the web app and synchronize the Capacitor Android project |
| `deploid electron` | Set up Electron desktop packaging |
| `deploid build` | Build Android APK/AAB outputs |
| `deploid artifacts [list\|inspect\|clean]` | Inspect or remove generated outputs |

## Versioning and release

| Command | Purpose |
|---|---|
| `deploid version [version]` | Synchronize semver and Android version metadata |
| `deploid changelog [version]` | Update `CHANGELOG.md` from notes and Git history |
| `deploid release init` | Scaffold signing and publishing configuration |
| `deploid publish` | Upload artifacts to GitHub Releases or Play Console |
| `deploid ship [version]` | Run the complete doctor → assets → package → build → changelog → publish flow |
| `deploid ci init github` | Generate a GitHub Actions release workflow |

Use `--dry-run` on version, changelog, publish, and ship when available. Play
publishing supports internal, alpha, beta, and production tracks; release scaffolding
defaults to a draft Play release.

## Devices

| Command | Purpose |
|---|---|
| `deploid devices` | List devices and optionally boot an emulator |
| `deploid deploy` | Install an APK; optionally launch it and stream logs |
| `deploid logs` | Stream logcat with device and app filters |
| `deploid uninstall` | Remove the configured app from a device |

## Integrations

| Command | Purpose |
|---|---|
| `deploid firebase` | Configure Firebase push-notification support |
| `deploid debug` | Add network-debugging support |
| `deploid ios` | Prepare an iOS project for Mac handoff |
| `deploid ios:handbook` | Generate iOS handoff documentation |
| `deploid ios:assets` | Reserved iOS asset command; currently fails fast |

## Plugins

```bash
deploid plugin --list
deploid plugin --install storage
deploid plugin --remove storage
deploid plugin init <name>
deploid plugin validate [path]
```

Core workflow modules are built into `@deploid/cli` and cannot be installed or
removed individually. Storage is an optional app-runtime package. Custom plugins are
installed with the project package manager and use `@deploid/cli` as their peer API.
