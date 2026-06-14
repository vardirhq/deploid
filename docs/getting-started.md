# Getting Started with Deploid

## Prerequisites

Before you start, make sure you have:

- **Node.js 18+** — `node --version`
- **Java 21+** — `java -version` (download at [adoptium.net](https://adoptium.net/))
- **Android SDK** — set `ANDROID_HOME` to your SDK path
  - Easiest: install [Android Studio](https://developer.android.com/studio), then set `ANDROID_HOME="$HOME/Android/Sdk"`

Run `deploid doctor` at any point to see exactly what's missing.

## Installation

```bash
npm install -g @deploid/cli
# or: pnpm add -g @deploid/cli
```

For development from source:

```bash
git clone https://github.com/MadsenDev/deploid.git
cd deploid
pnpm install
pnpm -r build
./install-global.sh    # creates ~/.local/bin/deploid symlink
```

## Quick Start

### 1. Initialize

```bash
cd my-web-app
deploid init
```

Deploid auto-detects your framework (Vite, Next.js, CRA) from `package.json`. It will:
- Generate `deploid.config.ts`
- Create `assets/` and `assets-gen/` directories
- Create `capacitor.config.json`
- Install `@capacitor/cli`, `@capacitor/core`, `@capacitor/android`
- Add `android:build`, `android:deploy`, `android:ship`, `android:doctor` to your `package.json`

For CI or scripted use, skip all prompts:
```bash
deploid init --yes --app-name "MyApp" --app-id "com.example.myapp"
```

### 2. Add your logo

```bash
cp your-logo.svg assets/logo.svg
```

SVG is recommended. PNG and JPEG also work.

### 3. Package for Android

```bash
deploid package
```

This runs in one step:
- Builds your web app (`npm run build` or equivalent)
- Auto-generates icons if `assets-gen/` is empty and your logo exists
- Syncs with Capacitor
- Adds the Android platform if not already present
- Applies your config (app name, ID, SDK versions, permissions)

### 4. Build the APK

```bash
deploid build
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

If signing is configured in `deploid.config.ts`, a release AAB is also built.

### 5. Deploy to a device

```bash
deploid deploy --launch
```

Installs the APK on the first connected device/emulator and launches the app.
Add `--logs` to tail logcat output.

---

## Configuration

`deploid init` generates `deploid.config.ts` automatically. Minimal example:

```typescript
import type { DeploidConfig } from '@deploid/core';

const config: DeploidConfig = {
  appName: 'MyApp',
  appId: 'com.example.myapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET'],
    version: { code: 1, name: '1.0.0' },
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
};

export default config;
```

See [Configuration Reference](configuration.md) for all options.

## Release workflow

```bash
# Scaffold signing config and .env template
deploid release init --yes

# Set your keystore passwords
export DEPLOID_ANDROID_STORE_PASSWORD="..."
export DEPLOID_ANDROID_KEY_PASSWORD="..."

# Bump version, build, generate changelog, publish
deploid ship --patch --from-git
```

## Supported frameworks

| Framework | Auto-detected? | webDir |
|---|---|---|
| Vite | Yes (detects `vite` in deps) | `dist` |
| Next.js | Yes (detects `next` in deps) | `out` |
| Create React App | Yes (detects `react-scripts`) | `build` |
| Static HTML | Manual (`--framework static`) | `public` |

For Next.js, make sure `next.config.js` has `output: 'export'`.

## Troubleshooting

**`deploid doctor`** is always the first thing to run — it tells you exactly what's wrong and what to fix.

**Capacitor CLI not found after init**
```bash
npm install @capacitor/cli @capacitor/core @capacitor/android
```

**Android SDK not found**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

**Java not found / wrong version**
- Install JDK 21 from [adoptium.net](https://adoptium.net/)
- Set `JAVA_HOME` to the JDK directory

**Build fails after changing app config**
```bash
# Re-sync and rebuild
deploid package
deploid build
```

**Debug logging**
```bash
deploid build --debug
# or
DEPLOID_LOG_LEVEL=debug deploid build
```

## Next steps

- [Configuration Reference](configuration.md)
- [CLI Reference](cli-reference.md)
- [Android Troubleshooting](ANDROID_TROUBLESHOOTING.md)
- [Plugin Development](plugins.md)
- [Examples](examples.md)
