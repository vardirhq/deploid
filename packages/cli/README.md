# Deploid CLI

**From build to Android package — one command.**

Deploid CLI turns a web app into a packaged Android app using a Capacitor-based pipeline.

## Quick Start

```bash
# Install globally
npm install -g @deploid/cli

# Initialize in your web app directory
deploid init

<<<<<<< Updated upstream
# Add logo
=======
# Initialize with full app metadata (non-interactive)
deploid init --app-name "NineGrid" --app-id "dev.madsens.ninegrid" --author-name "Chris Madsen" --author-email "chris@madsens.dev" --description "NineGrid Sudoku app" --assets-source "public/logo.png"

# Add your logo
>>>>>>> Stashed changes
cp your-logo.svg assets/logo.svg

# Generate assets
deploid assets

<<<<<<< Updated upstream
# Package for Android (Capacitor)
=======
# Override source for one run
deploid assets --source public/logo.png

# Scaffold release config
deploid release init --yes

# Package for Android
>>>>>>> Stashed changes
deploid package

# Build APK/AAB
deploid build

# Deploy debug APK to connected device
deploid deploy
<<<<<<< Updated upstream
=======

# Setup Firebase for push notifications
deploid firebase

# Manage plugins
deploid plugin --list
deploid plugin --install storage
deploid plugin --remove debug-network

# Publish to stores
deploid publish --dry-run

# Bump semver + Android version metadata
deploid version --patch

# Turn release notes into CHANGELOG entries
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
>>>>>>> Stashed changes
```

## Deploid 2.0 Status

<<<<<<< Updated upstream
- Packaging engine support: `capacitor` only.
- `deploid publish`: not implemented yet.
- `deploid ios:assets`: not implemented yet.
=======
- **🖼️ Asset Generation**: Automatic icon generation for all Android densities and PWA
- **📦 Multi-Engine Packaging**: Capacitor, Tauri, and TWA support
- **🔨 Build System**: APK/AAB generation with signing
- **🚦 Release Setup**: Signing, env, and publish scaffolding with `deploid release init`
- **☁️ Publishing**: Play Store and GitHub Releases integration
- **🧱 Plugin Authoring**: Scaffold and validate custom plugins
- **🔌 Local API Daemon**: Optional loopback HTTP mode for external apps
- **🔧 Plugin Architecture**: Extensible and modular design
- **💾 Cross-Platform Storage**: Seamless storage across web and native environments
- **🔥 Firebase Integration**: Automated push notification setup
- **📱 Native Deployment**: Direct APK installation to devices
- **🍎 iOS Preparation**: Generate Xcode projects for Mac handoff
>>>>>>> Stashed changes

## Commands

| Command | Description |
| --- | --- |
| `deploid init` | Create config and project structure |
| `deploid assets` | Generate required app assets |
| `deploid package` | Package app for Android (Capacitor) |
| `deploid build` | Build Android artifacts |
| `deploid deploy` | Install built APK on connected devices |
| `deploid devices` | List connected Android devices |
| `deploid logs` | Stream Android logs |
| `deploid uninstall` | Uninstall app from device |
| `deploid debug` | Add network debug component |
| `deploid ios` | Prepare iOS project handoff |
| `deploid ios:handbook` | Generate iOS handoff docs |
| `deploid plugin` | Manage Deploid plugins |
| `deploid firebase` | Setup Firebase integration |
| `deploid publish` | Not implemented in 2.0 |

## Plugin Notes

- Runtime plugin contract supports `validate`, `plan`, and `run`.
- Core runtime is centralized in `@deploid/core`.

## Docs

<<<<<<< Updated upstream
- [Top-level README](../../README.md)
- [CLI Reference](../../docs/cli-reference.md)
- [Migration 2.0](../../docs/MIGRATION_2_0.md)
- [Deprecation Plan](../../docs/DEPRECATION_PLAN.md)
=======
// Store data
await crossPlatformStorage.set('theme', 'dark')
await secureStorageUtil.set('authToken', 'secret-token')

// Retrieve data
const theme = await crossPlatformStorage.get('theme')
const token = await secureStorageUtil.get('authToken')
```

**Features:**
- 🌐 **Web**: Uses localStorage/sessionStorage
- 📱 **Native**: Uses Capacitor Preferences + Secure Storage
- 🔒 **Security**: Encrypted storage for sensitive data
- 🔄 **Migration**: Easy transition from existing localStorage

## 🔧 Plugin Management

Deploid includes a powerful plugin system that you can manage after initialization:

```bash
# List all available plugins
deploid plugin --list

# Install a specific plugin
deploid plugin --install storage
deploid plugin --install debug-network
deploid plugin --install packaging-electron

# Remove a plugin
deploid plugin --remove debug-network

# Scaffold a custom plugin
deploid plugin init hello-world

# Validate a plugin package
deploid plugin validate ./plugins/hello-world

# Interactive plugin manager
deploid plugin
```

### Available Plugins

- **📦 Assets** - Generate app icons and assets (required)
- **📱 Packaging** - Capacitor, Tauri, TWA support (required for packaging)
- **🖥️ Electron** - Desktop packaging for Windows, macOS, and Linux
- **🔨 Build** - Android APK/AAB generation
- **📲 Deploy** - Direct device deployment via ADB
- **🍎 iOS** - iOS project preparation for Mac handoff
- **🐛 Debug** - Network debugging tools
- **💾 Storage** - Cross-platform storage utilities

## 🎯 Supported Frameworks

- **Vite** (React, Vue, Svelte)
- **Next.js** (Static export)
- **Create React App**
- **Static HTML** projects

## 📦 Supported Packaging Engines

- **Capacitor** - Native WebView wrapper
- **Tauri** - Rust-based desktop/mobile (planned)
- **TWA** - Trusted Web Activity (planned)

## 🧩 Commands

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `deploid init`    | Setup config and base folders               |
| `deploid release init` | Scaffold signing, env templates, and publish placeholders |
| `deploid version` | Sync semver, Android version metadata, and release notes scaffolding |
| `deploid changelog` | Turn release notes into `CHANGELOG.md` entries |
| `deploid ship` | Run the end-to-end Android release workflow |
| `deploid artifacts` | List, inspect, and clean generated outputs |
| `deploid plugin init` | Scaffold a custom plugin package |
| `deploid daemon` | Run the local Deploid HTTP daemon |
| `deploid ci init github` | Generate GitHub Actions release workflow scaffolding |
| `deploid assets`  | Generate all required icons and screenshots |
| `deploid package` | Wrap app for Android (Capacitor/Tauri/TWA)  |
| `deploid electron` | Setup Electron desktop packaging             |
| `deploid build`   | Build APK/AAB (debug/release)               |
| `deploid publish` | Upload build to Play Store or GitHub        |

## 📚 Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [Examples](docs/examples.md)
- [Contributing](docs/contributing.md)

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
>>>>>>> Stashed changes
