# Deploid Documentation

**From build to Android package — one command.**

Deploid is a unified build pipeline for web apps that turns them into Android apps (APK/AAB).

## 📚 Table of Contents

- [Getting Started](getting-started.md)
- [Architecture](architecture.md)
- [App API](api.md)
- [Local Daemon Mode](api.md#local-daemon-mode)
- [Configuration](configuration.md)
- [Plugins](plugins.md)
- [CLI Reference](cli-reference.md)
- [Examples](examples.md)
- [Contributing](contributing.md)
- [Migration 2.0](MIGRATION_2_0.md)
- [Deprecation Plan](DEPRECATION_PLAN.md)

## 🎯 What is Deploid?

Deploid automates the entire process of turning a web app into a ready-to-ship Android package. It replaces the fragmented manual steps (Capacitor, Gradle, Bubblewrap, Fastlane, icons, screenshots, signing, etc.) with one consistent workflow.

### Key Features

- **🖼️ Asset Generation**: Automatic icon generation for all Android densities and PWA
- **📦 Packaging**: Capacitor-based Android packaging
- **🔨 Build System**: APK/AAB generation with signing
- **📱 iOS Preparation**: Complete iOS project setup for Mac handoff
- **🚀 Deployment**: Direct APK deployment to Android devices
- **🐛 Debug Tools**: Network debugging and troubleshooting components
- **🚦 Release Setup**: Signing, env, and publish scaffolding with `deploid release init`
- **☁️ Publishing**: GitHub Releases and Play Console uploads
- **🔧 Plugin Architecture**: Extensible and modular design
- **🧱 Plugin Authoring**: Scaffold and validate external plugins
- **🔌 Local Daemon**: Optional loopback HTTP surface for external apps
- **⚙️ CI/CD Ready**: GitHub Actions generator

### Supported Frameworks

- **Vite** (React, Vue, Svelte)
- **Next.js** (Static export)
- **Create React App**
- **Static HTML** projects

### Supported Packaging Engines

- **Capacitor** - Native WebView wrapper

### Desktop GUI

The former Deploid Studio npm package is retired. A future GUI will be distributed as
a standalone desktop application and will use the Deploid CLI as its workflow engine.

## 🚀 Quick Start

```bash
# Setup Deploid (first time)
git clone https://github.com/MadsenDev/deploid.git
cd deploid
pnpm install
./install-global.sh

# Initialize a project
deploid init

# Add your logo
cp your-logo.svg assets/logo.svg

# Generate all required assets
deploid assets

# Scaffold release config
deploid release init --yes

# Bump semver + Android version metadata
deploid version --patch

# Turn release notes into CHANGELOG entries
deploid changelog --from-git

# Run the full release workflow
deploid ship --patch --from-git --dry-run

# Inspect generated outputs
deploid artifacts list

# Generate GitHub Actions release workflow
deploid ci init github

# Package for Android
deploid package

# Build APK/AAB
deploid build

# Deploy to a connected device
deploid deploy
```

## 📁 Project Structure

```
deploid/
├── packages/
│   ├── cli/                    # Command line interface
│   ├── core/                   # Config loader, logger, pipeline runner
│   └── plugins/
│       ├── assets/             # Icon/screenshot generation
│       ├── packaging-capacitor/ # Capacitor packaging
│       └── build-android/      # APK/AAB building
├── examples/                   # Example projects
└── docs/                       # Documentation
```

## 🧩 Commands

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `deploid init`    | Setup config and base folders               |
| `deploid release init` | Scaffold signing, env templates, and publish placeholders |
| `deploid version` | Sync semver, Android version metadata, and release notes scaffolding |
| `deploid changelog` | Turn release notes into `CHANGELOG.md` entries |
| `deploid ship` | Run the end-to-end Android release workflow |
| `deploid artifacts` | List, inspect, and clean generated outputs |
| `deploid ci init github` | Generate GitHub Actions release workflow scaffolding |
| `deploid assets`  | Generate all required icons and screenshots |
| `deploid package` | Wrap app for Android (Capacitor)             |
| `deploid build`   | Build APK/AAB (debug/release)               |
| `deploid debug`   | Add network debugging tools to your project  |
| `deploid deploy`  | Deploy APK to connected Android devices     |
| `deploid devices` | List connected Android devices               |
| `deploid logs`   | View app logs from connected device          |
| `deploid uninstall` | Uninstall app from connected devices      |
| `deploid ios`     | Prepare iOS project for Mac handoff          |
| `deploid ios:assets` | Not implemented in 2.0                    |
| `deploid ios:handbook` | Generate iOS handoff documentation      |
| `deploid publish` | Upload APK/AAB to GitHub Releases or Play Console |

## 🎯 Current Status

✅ **Milestone 1 — Core CLI + Capacitor** (Complete)
- [x] Config loader + basic CLI
- [x] Assets (icons) generation with Sharp
- [x] Capacitor packaging
- [x] Debug APK build system
- [x] Network debugging tools
- [x] Android deployment system
- [x] iOS project preparation

🔄 **Next: Milestone 2 — Release + CI**
- [x] Signing + release scaffolding
- [x] Play/GitHub publishing
- [x] Version orchestration
- [x] Auto GitHub Actions generator

## 🧠 Vision

> "Turn any web app into a publishable Android app with one command — including icons, signing, builds, and release automation."

The long-term goal: Expand to **multi-platform** (Windows .exe, macOS DMG, iOS IPA, and Web Deploy).
