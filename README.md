# Deploid

**From web app to Android package — one command.**

Deploid automates the entire process of turning a web app into a ready-to-ship Android package: icons, signing, builds, versioning, changelog, and publish.

## Prerequisites

- Node.js 18+
- Java 21+ (`java -version`)
- Android SDK with `ANDROID_HOME` set

Run `deploid doctor` at any time to check your environment.

## Quick Start

```bash
# Install globally
npm install -g @deploid/cli

# Initialize — auto-detects your framework, no extra steps
cd my-web-app
deploid init

# Add your app logo (SVG recommended)
cp your-logo.svg assets/logo.svg

# Package for Android (auto-generates icons, syncs Capacitor)
deploid package

# Build the APK
deploid build

# Deploy to a connected device
deploid deploy --launch
```

That's it. The scripts `android:build`, `android:deploy`, and `android:doctor` are added to your `package.json` by `deploid init` so you can also drive builds from your existing npm workflow.

### CI / non-interactive

```bash
deploid init --yes --app-name "MyApp" --app-id "com.example.myapp"
```

### Release workflow

```bash
# Scaffold signing config and env template
deploid release init --yes

# Bump version, build, changelog, publish — all in one
deploid ship --patch --from-git
```

### Firebase push notifications

```bash
deploid firebase
```

## Features

- **Asset Generation** — Icons for all Android densities and PWA from a single source image
- **Packaging** — Capacitor-based Android WebView wrapping
- **Build System** — APK/AAB generation with optional signing
- **Release Setup** — Signing config, env template, secrets directory scaffolding
- **Publishing** — GitHub Releases and Play Console uploads
- **Versioning** — Sync semver, Android versionCode/name, and release notes
- **Changelog** — Generate `CHANGELOG.md` from release notes and git history
- **Workflow Orchestration** — Doctor → version → build → changelog → publish as one `deploid ship`
- **Artifact Management** — List, inspect, and clean generated outputs
- **CI/CD** — Generate GitHub Actions release workflows
- **Plugin Architecture** — Extensible with custom plugins
- **Firebase** — Automated push notification setup
- **Device Deployment** — Direct APK installation and log streaming via ADB
- **iOS Preparation** — Xcode project generation for Mac handoff
- **App API** — Programmatic access via `@deploid/core` or local HTTP daemon

## Supported Frameworks

- **Vite** (React, Vue, Svelte) — auto-detected
- **Next.js** (static export) — auto-detected
- **Create React App** — auto-detected
- **Static HTML**

## Commands

| Command | Description |
| --- | --- |
| `deploid init` | Set up config, install deps, add package.json scripts |
| `deploid doctor` | Audit toolchain, project, and release readiness |
| `deploid assets` | Generate icons and PWA assets from your logo |
| `deploid package` | Build web app, sync with Capacitor, configure Android |
| `deploid build` | Build debug APK (and release AAB if signing is configured) |
| `deploid deploy` | Install APK to connected device and optionally launch + tail logs |
| `deploid devices` | List connected Android devices and emulators |
| `deploid version` | Bump semver and sync Android versionCode/name |
| `deploid changelog` | Generate `CHANGELOG.md` from release notes and git history |
| `deploid ship` | End-to-end release workflow (version → build → changelog → publish) |
| `deploid publish` | Upload APK/AAB to GitHub Releases or Play Console |
| `deploid release init` | Scaffold signing config, env template, secrets directory |
| `deploid firebase` | Set up Firebase push notifications |
| `deploid ci init github` | Generate GitHub Actions release workflow |
| `deploid artifacts` | List, inspect, or clean generated outputs |
| `deploid plugin init` | Scaffold a custom plugin |
| `deploid daemon` | Run local HTTP daemon for external app integration |

## App Integration

External apps can integrate via `@deploid/core` instead of shelling out:

```ts
import { runDoctorCommand, runPluginCommand, inspectArtifacts } from '@deploid/core';

await runDoctorCommand({ cwd: '/path/to/project', doctorOptions: { json: true } });
await runPluginCommand('build-android', { cwd: '/path/to/project' });
const artifacts = inspectArtifacts('/path/to/project');
```

Or use the optional local HTTP daemon (`deploid daemon`) for language-agnostic integration.

## Desktop GUI

Deploid Studio is an experimental desktop client layered on top of the CLI:

```bash
npm install -g @deploid/studio
deploid-studio
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [API](docs/api.md)
- [Examples](docs/examples.md)
- [Plugins](docs/plugins.md)
- [Contributing](docs/contributing.md)
- [Migration 2.0](docs/MIGRATION_2_0.md)
- [Android Troubleshooting](docs/ANDROID_TROUBLESHOOTING.md)

## License

MIT © [MadsenDev](https://github.com/MadsenDev)
