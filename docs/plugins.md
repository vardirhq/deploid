# Plugin System

Deploid 2.0 uses a package-based plugin system with a runtime contract supported by `@deploid/core`.

## Plugin Contract

<<<<<<< Updated upstream
Plugins should export a default object with this shape:
=======
### Plugin Types

| Type | Purpose | Example |
|------|---------|---------|
| **Assets** | Generate icons, screenshots, and other assets | `@deploid/plugin-assets` |
| **Packaging** | Wrap web apps for different platforms | `@deploid/plugin-packaging-capacitor`, `@deploid/plugin-packaging-electron` |
| **Build** | Build platform-specific packages | `@deploid/plugin-build-android` |
| **Publish** | Distribute to app stores | `@deploid/plugin-publish-play` |
| **Audit** | Validate project and release readiness | `@deploid/plugin-doctor` |

### Plugin Interface
>>>>>>> Stashed changes

```typescript
export interface DeploidPlugin {
  name: string;
  requirements?: string[];
  validate?: (ctx: { cwd: string; config: DeploidConfig; logger: Logger }) => Promise<void>;
  plan?: (ctx: { cwd: string; config: DeploidConfig }) => Promise<string[]> | string[];
  run: (ctx: { cwd: string; config: DeploidConfig; logger: Logger; debug?: boolean }) => Promise<void>;
}
```

## Loading Behavior

`@deploid/core` resolves plugins in this order:

1. Installed package: `deploid-plugin-<name>`
2. Monorepo dev fallback: `packages/plugins/<name>/dist/index.js`

## Built-in Plugin Packages

- `deploid-plugin-assets`
- `deploid-plugin-packaging-capacitor`
- `deploid-plugin-build-android`
- `deploid-plugin-deploy-android`
- `deploid-plugin-debug-network`
- `deploid-plugin-prepare-ios`
- `deploid-plugin-storage`

Status notes:
- Packaging in 2.0 is `capacitor` only.
- `deploid publish` is not implemented in 2.0.
- `deploid ios:assets` is not implemented in 2.0.

## Example Plugin

```typescript
import type { DeploidPlugin } from '@deploid/core';

const plugin: DeploidPlugin = {
  name: 'my-plugin',
  requirements: ['node'],
  async validate({ cwd }) {
    // check prerequisites here
  },
  async plan() {
    return ['Check prerequisites', 'Run main task'];
  },
<<<<<<< Updated upstream
  async run({ logger }) {
    logger.info('my-plugin running');
=======
};
```

**Features**:
- Capacitor initialization
- Web app building and syncing
- Android platform setup
- Configuration updates

**Usage**:
```bash
deploid package
```

### Packaging Electron Plugin (`@deploid/plugin-packaging-electron`)

**Purpose**: Scaffold Electron desktop packaging for Windows, macOS, and Linux.

**Generated/Updated Files**:
- `electron/main.cjs` - Electron main process entrypoint
- `electron/preload.cjs` - Preload bridge
- `package.json` - Electron scripts + `electron-builder` config

**Features**:
- Cross-platform desktop targets via `electron-builder`
- Idempotent setup (keeps existing scripts/config values)
- Auto-install of `electron` and `electron-builder`

**Usage**:
```bash
deploid electron
```

### Build Android Plugin (`@deploid/plugin-build-android`)

**Purpose**: Build APK/AAB packages for Android.

**Configuration**:
```typescript
export default {
  android: {
    signing: {
      keystorePath: './android.keystore',
      alias: 'mykey',
      storePasswordEnv: 'ANDROID_STORE_PWD',
      keyPasswordEnv: 'ANDROID_KEY_PWD',
    },
  },
};
```

**Generated Packages**:
- Debug APK
- Release AAB (with signing)
- Release APK (with signing)

**Usage**:
```bash
deploid build
```

### Debug Network Plugin (`@deploid/plugin-debug-network`)

**Purpose**: Add network debugging tools to your project for troubleshooting connectivity issues.

**Generated Files**:
- `src/components/NetworkDebug.tsx` - React component for network testing

**Features**:
- API endpoint testing
- Domain connectivity testing
- Network analysis (online status, connection type, user agent)
- Error reporting with detailed information
- Alternative endpoint testing

**Usage**:
```bash
deploid debug
```

### Deploy Android Plugin (`@deploid/plugin-deploy-android`)

**Purpose**: Deploy APK to connected Android devices.

**Features**:
- Automatic device detection
- Multi-device deployment
- Auto-launch after installation
- ADB integration
- Error handling and reporting

**Requirements**:
- Android device connected via USB
- USB debugging enabled
- ADB (Android Debug Bridge) installed

**Usage**:
```bash
deploid deploy
deploid devices
deploid logs
deploid uninstall
```

### Prepare iOS Plugin (`@deploid/plugin-prepare-ios`)

**Purpose**: Prepare iOS project for Mac handoff.

**Generated Files**:
- `ios/` - Complete iOS Xcode project
- `ios/App/App/Info.plist` - iOS app configuration
- `ios/App/App/App.entitlements` - iOS capabilities
- `ios/Podfile` - CocoaPods dependencies
- `ios/Config/` - Build configuration files
- `docs/IOS_HANDBOOK.md` - Mac handoff instructions

**Features**:
- Capacitor iOS platform setup
- Bundle ID and app name configuration
- Privacy descriptions for camera, photo library, microphone
- URL schemes and deep linking
- App Transport Security (ATS) configuration
- iOS asset catalog structure
- Comprehensive handoff documentation

**Usage**:
```bash
deploid ios
deploid ios:assets
deploid ios:handbook
```

### Doctor Plugin (`@deploid/plugin-doctor`)

**Purpose**: Score readiness across setup, build, release, deploy, and desktop workflows.

**Features**:
- Human-readable report grouped by workflow and check category
- `--json`, `--markdown`, and `--ci` output modes
- Safe `--fix` actions for missing scaffolding such as `assets/` and `capacitor.config.json`
- Config consistency checks across Deploid, Capacitor, Gradle, and package metadata
- Tooling checks for Node, npm, npx, Java, ADB, Android SDK, and Gradle wrapper

**Usage**:
```bash
deploid doctor
deploid doctor --summary
deploid doctor --json
deploid doctor --fix
```

## Creating Custom Plugins

### 1. Plugin Structure

```
packages/plugins/my-plugin/
├── src/
│   └── index.ts              # Plugin implementation
├── package.json              # Plugin dependencies
├── tsconfig.json             # TypeScript configuration
└── dist/                     # Compiled output
```

### 2. Package Configuration

```json
{
  "name": "@deploid/plugin-my-plugin",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -b"
  },
  "dependencies": {
    "@deploid/core": "workspace:*"
  }
}
```

### 3. Plugin Implementation

```typescript
import { PipelineStep } from '../../../core/dist/index.js';

export const myPlugin = (): PipelineStep => async ({ logger, config, cwd }) => {
  logger.info('My plugin executing...');
  
  // Plugin logic here
  try {
    // Do something useful
    logger.info('Plugin completed successfully');
  } catch (error) {
    logger.error(`Plugin failed: ${error}`);
    throw error;
>>>>>>> Stashed changes
  }
};

export default plugin;
```

## Local Development

```bash
# Build plugin package
pnpm --filter deploid-plugin-my-plugin build

# Link into a consuming project
pnpm link --global
pnpm link --global deploid-plugin-my-plugin
```

## Operational Guidelines

- Make plugin steps idempotent where possible.
- Use `validate` for command/tool preflight checks.
- Keep side effects in `run` only.
- Prefer actionable error messages over generic failures.
