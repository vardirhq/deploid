# Deploid

**From build to Android package — one command.**

Deploid automates the entire process of turning a web app into a ready-to-ship Android package.

## 🚀 Quick Start

```bash
# Install globally
npm install -g @deploid/cli

# Initialize a project
deploid init

# Add your logo
cp your-logo.svg assets/logo.svg

# Generate all required assets
deploid assets

# Audit local project, release, and tooling readiness
deploid doctor

# Scaffold release signing and publish placeholders
deploid release init --yes

# Package for Android
deploid package

# Build APK/AAB
deploid build

# Deploy to connected device
deploid deploy

# Setup Firebase for push notifications
deploid firebase

# Publish the latest artifact
deploid publish --dry-run

# Bump semver + Android version metadata
deploid version --patch

# Turn release notes into CHANGELOG.md entries
deploid changelog --from-git

# Run the full release workflow
deploid ship --patch --from-git --dry-run

# Inspect generated outputs
deploid artifacts list
deploid artifacts --list

# Scaffold a custom plugin
deploid plugin init hello-world

# Run the local API daemon for external apps
deploid daemon

# Generate GitHub Actions release workflow
deploid ci init github
```

## ✨ Features

- **🖼️ Asset Generation**: Automatic icon generation for all Android densities and PWA
- **📦 Packaging**: Capacitor-based Android packaging
- **🔨 Build System**: APK/AAB generation with signing
- **🚦 Release Setup**: Signing, env, and publish scaffolding with `deploid release init`
- **☁️ Publishing**: GitHub Releases and Play Console uploads
- **🏷️ Versioning**: Sync semver, Android versionCode/name, and release notes scaffolding
- **📝 Changelog**: Generate `CHANGELOG.md` entries from release notes and git history
- **🚢 Workflow Orchestration**: Run doctor, version, build, changelog, and publish as one flow
- **📦 Artifact Management**: List, inspect, and clean generated Android, desktop, and asset outputs
- **🧱 Plugin Authoring**: Scaffold and validate custom Deploid plugins
- **🔌 Local API Daemon**: Optional loopback HTTP mode for external apps and dashboards
- **⚙️ CI/CD**: Generate GitHub Actions release workflows and secret guides
- **🔧 Plugin Architecture**: Extensible and modular design
- **🔥 Firebase Integration**: Automated push notification setup
- **📱 Native Deployment**: Direct APK installation to devices
- **🍎 iOS Preparation**: Generate Xcode projects for Mac handoff

## 🎯 Supported Frameworks

- **Vite** (React, Vue, Svelte)
- **Next.js** (Static export)
- **Create React App**
- **Static HTML** projects

## 📦 Supported Packaging Engines

- **Capacitor** - Native WebView wrapper

## 🧩 Commands

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `deploid init`    | Setup config and base folders               |
| `deploid doctor`  | Audit workflow, release, plugin, and toolchain readiness |
| `deploid release init` | Scaffold signing, env templates, and publish placeholders |
| `deploid version` | Sync semver, Android version metadata, and release notes scaffolding |
| `deploid changelog` | Turn release notes into `CHANGELOG.md` entries |
| `deploid ship` | Run the end-to-end Android release workflow |
| `deploid artifacts` | List, inspect, and clean generated outputs |
| `deploid plugin init` | Scaffold a custom plugin package |
| `deploid daemon` | Run the local Deploid HTTP daemon |
| `deploid ci init github` | Generate GitHub Actions release workflow scaffolding |
| `deploid assets`  | Generate all required icons and screenshots |
| `deploid package` | Wrap app for Android (Capacitor)             |
| `deploid build`   | Build APK/AAB (debug/release)               |
| `deploid publish` | Upload APK/AAB to GitHub Releases or Play Console |

## 📚 Documentation

- [Getting Started](docs/getting-started.md)
- [App API](docs/api.md)
- [Configuration](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [Examples](docs/examples.md)
- [Contributing](docs/contributing.md)
- [Migration 2.0](docs/MIGRATION_2_0.md)
- [Deprecation Plan](docs/DEPRECATION_PLAN.md)

<<<<<<< Updated upstream
=======
## 🖥️ Desktop GUI

Deploid Studio is an experimental desktop client layered on top of the CLI/core workflow engine.

```bash
npm install -g @deploid/studio
deploid-studio
```

## 🔌 App Integration

The long-term product direction is CLI/core first, with optional clients layered on top.

External apps can integrate through `@deploid/core` or the optional local daemon instead of shelling out blindly:

```ts
import { inspectArtifacts, runDoctorCommand, runPluginCommand } from '@deploid/core';

await runDoctorCommand({
  cwd: '/path/to/project',
  doctorOptions: { json: true, summary: true }
});

await runPluginCommand('build-android', {
  cwd: '/path/to/project',
  debug: true
});

const artifacts = inspectArtifacts('/path/to/project');
```

>>>>>>> Stashed changes
## 🎯 Current Status

✅ **Milestone 1 — Core CLI + Capacitor** (Complete)
- [x] Config loader + basic CLI
- [x] Assets (icons) generation with Sharp
- [x] Capacitor packaging
- [x] Debug APK build system

🔄 **Next: Milestone 2 — Release + CI**
- [x] Signing + release scaffolding
- [x] Play/GitHub publishing
- [x] Version orchestration
- [x] Auto GitHub Actions generator
- [x] Stable app-facing core API for external clients

## 🧠 Vision

> "Turn any web app into a publishable Android app with one command — including icons, signing, builds, and release automation."

The long-term goal: Expand to **multi-platform** (Windows .exe, macOS DMG, iOS IPA, and Web Deploy).

## 📄 License

MIT © [MadsenDev](https://github.com/MadsenDev)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](docs/contributing.md) for details.

## 📞 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/MadsenDev/deploid/issues)
- **GitHub Discussions**: [Ask questions and discuss](https://github.com/MadsenDev/deploid/discussions)

---

**Made with ❤️ by [MadsenDev](https://github.com/MadsenDev)**
