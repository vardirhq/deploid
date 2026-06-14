# Deploid

**Ship your web app to Android. Without the Android expertise.**

Deploid is a CLI that takes any Vite, Next.js, or React app and turns it into a signed, published Android package — handling icons, Capacitor, Gradle, versioning, signing, changelogs, and Play Store uploads so you don't have to.

```bash
npm install -g @deploid/cli
cd my-web-app
deploid init        # auto-detects your framework, installs deps
deploid package     # builds web app + wraps in Capacitor + generates icons
deploid build       # compiles APK
deploid deploy --launch   # installs on your phone
```

That's the whole thing. No Android Studio required for the happy path. No manually generating icons at six densities. No wrestling with `build.gradle`.

---

## What it actually does

When you run those four commands, here's what happens under the hood:

**`deploid init`**
- Detects your framework (Vite / Next.js / CRA) from `package.json`
- Generates a typed `deploid.config.ts` with sensible defaults
- Installs `@capacitor/cli`, `@capacitor/core`, `@capacitor/android`
- Adds `android:build`, `android:deploy`, `android:ship` scripts to your `package.json`
- No Firebase prompts, no one-by-one plugin interrogation — just setup

**`deploid package`**
- Runs your web build command
- Auto-generates app icons at all Android densities + PWA sizes from your logo SVG
- Syncs assets into Capacitor
- Configures `AndroidManifest.xml`, `build.gradle`, `strings.xml` from your config
- Adds the Android platform if it doesn't exist yet

**`deploid build`**
- Validates your toolchain before starting (Java 21+, `ANDROID_HOME`) — fails fast with a clear message instead of a cryptic Gradle error 3 minutes in
- Builds a debug APK
- Builds a signed release AAB if signing is configured

**`deploid deploy`**
- Finds connected devices automatically
- Installs the APK
- Optionally launches the app and tails logcat

---

## The release workflow

Getting to the Play Store is usually where things fall apart. Deploid handles the whole chain:

```bash
# One-time signing setup
deploid release init --yes
# → creates secrets/ directory
# → adds signing config to deploid.config.ts
# → writes .env.deploid.example with required env vars
# → adds secrets to .gitignore

# Set your passwords (from CI secrets or locally)
export DEPLOID_ANDROID_STORE_PASSWORD="..."
export DEPLOID_ANDROID_KEY_PASSWORD="..."

# Ship it
deploid ship --patch --from-git
# → bumps version in package.json AND build.gradle simultaneously
# → builds signed AAB
# → generates CHANGELOG.md from git history
# → publishes to GitHub Releases and/or Play Store
```

---

## CI/CD

```bash
deploid ci init github
```

Generates a complete `.github/workflows/deploid-release.yml` — including secrets reference, Java setup, Node setup, and publish steps.

For scripted / headless init:

```bash
deploid init --yes --app-name "MyApp" --app-id "com.example.myapp"
```

---

## Diagnostics

Not sure why something is broken? Run:

```bash
deploid doctor
```

Checks your entire environment — Java version, Android SDK location, Capacitor installation, signing config, Gradle wrapper, SDK licenses — and tells you exactly what's wrong and how to fix it. Run it before filing an issue.

```
Deploid Doctor
Project: /home/chris/my-web-app
Status: ACTION NEEDED (8 passed, 1 warning, 1 failure)

Workflow readiness:
  PASS Project setup           100%
  PASS Android build           100%
  WARN Release readiness        60%
  PASS Device deploy           100%

Release:
  WARN Android signing         No signing config found. Run: deploid release init
```

---

## Supported frameworks

| Framework | Detection | Build output |
|---|---|---|
| **Vite** (React, Vue, Svelte) | Auto | `dist/` |
| **Next.js** (static export) | Auto | `out/` |
| **Create React App** | Auto | `build/` |
| **Static HTML** | `--framework static` | `public/` |

Framework detection reads your `package.json` dependencies — no `--framework` flag needed for standard setups.

---

## Requirements

- **Node.js 18+**
- **Java 21+** — [download](https://adoptium.net/)
- **Android SDK** with `ANDROID_HOME` set — install via [Android Studio](https://developer.android.com/studio) or command-line tools

Not sure if you have everything? `deploid doctor` will tell you.

---

## Commands

| Command | What it does |
|---|---|
| `deploid init` | Set up config, install Capacitor deps, scaffold package.json scripts |
| `deploid doctor` | Full environment and release readiness audit |
| `deploid assets` | Generate icons from your logo (runs automatically inside `package`) |
| `deploid package` | Build web app → sync Capacitor → configure Android project |
| `deploid build` | Compile APK (debug) and AAB (release, if signing configured) |
| `deploid deploy` | Install APK on connected device; `--launch` to open, `--logs` to tail |
| `deploid devices` | List connected Android devices and emulators |
| `deploid version` | Bump semver + sync Android `versionCode`/`versionName` |
| `deploid changelog` | Generate `CHANGELOG.md` from release notes and git history |
| `deploid ship` | Full release run: version → build → changelog → publish |
| `deploid publish` | Upload APK/AAB to GitHub Releases or Play Console |
| `deploid release init` | Scaffold signing config, `.env` template, secrets directory |
| `deploid firebase` | Wire up Firebase push notifications |
| `deploid ci init github` | Generate GitHub Actions release workflow |
| `deploid artifacts` | List, inspect, or clean generated outputs |
| `deploid plugin init` | Scaffold a custom plugin |
| `deploid daemon` | Local HTTP daemon for integrating external tools |

---

## Programmatic API

Use `@deploid/core` to drive Deploid from your own tooling instead of shelling out:

```ts
import { runDoctorCommand, runPluginCommand, inspectArtifacts } from '@deploid/core';

// Run a full doctor check
await runDoctorCommand({
  cwd: '/path/to/project',
  doctorOptions: { json: true, summary: true }
});

// Trigger a build
await runPluginCommand('build-android', { cwd: '/path/to/project' });

// Inspect what was built
const artifacts = inspectArtifacts('/path/to/project');
```

Or run `deploid daemon` for a language-agnostic local HTTP interface.

---

## Plugin system

Deploid is built on a plugin pipeline. Every capability — assets, packaging, build, deploy, publish — is a plugin. You can write your own:

```bash
deploid plugin init my-custom-step
```

See [Plugin Development](docs/plugins.md) for the contract.

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration Reference](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [Android Troubleshooting](docs/ANDROID_TROUBLESHOOTING.md)
- [Plugin Development](docs/plugins.md)
- [Programmatic API](docs/api.md)
- [Examples](docs/examples.md)
- [Contributing](docs/contributing.md)

---

MIT © [MadsenDev](https://github.com/MadsenDev)
