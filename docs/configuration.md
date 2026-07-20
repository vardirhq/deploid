# Configuration Reference

This document provides a comprehensive reference for Deploid configuration options.

## Configuration File

Deploid supports multiple configuration file formats:

- `deploid.config.ts` (TypeScript - recommended)
- `deploid.config.js` (JavaScript)
- `deploid.config.mjs` (ES Modules)
- `deploid.config.cjs` (CommonJS)

## Basic Configuration

### Minimal Configuration

```typescript
export default {
  appName: 'MyApp',
  appId: 'com.example.myapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
  },
};
```

### Complete Configuration

```typescript
export default {
  // App metadata
  appName: 'MyApp',
  appId: 'com.example.myapp',
  
  // Web app configuration
  web: {
    framework: 'vite', // 'vite' | 'next' | 'cra' | 'static'
    buildCommand: 'npm run build',
    webDir: 'dist',
    pwa: {
      manifest: 'public/manifest.json',
      serviceWorker: true,
    },
  },
  
  // Android configuration
  android: {
    packaging: 'capacitor', // 'capacitor' (2.0)
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET', 'CAMERA'],
    signing: {
      keystorePath: './android.keystore',
      alias: 'mykey',
      storePasswordEnv: 'ANDROID_STORE_PWD',
      keyPasswordEnv: 'ANDROID_KEY_PWD',
    },
    version: {
      code: 1,
      name: '1.0.0',
    },
    display: {
      fullscreen: false,
      immersive: false,
      orientation: 'portrait',
      statusBarStyle: 'auto',
      statusBarHidden: false,
      navigationBarHidden: false,
      windowSoftInputMode: 'adjustResize',
    },
    launch: {
      launchMode: 'standard',
      allowBackup: true,
    },
    build: {
      enableProguard: false,
      enableMultidex: false,
      minifyEnabled: false,
      shrinkResources: false,
      buildType: 'apk',
    },
    performance: {
      hardwareAccelerated: true,
      largeHeap: false,
    },
  },
  
  // Asset generation
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
  
  // Publishing configuration
  publish: {
    play: {
      track: 'internal', // 'internal' | 'alpha' | 'beta' | 'production'
      status: 'draft', // 'draft' | 'inProgress' | 'halted' | 'completed'
      serviceAccountJson: 'secrets/play.json',
    },
    github: {
      repo: 'your-username/your-repo',
      draft: true,
    },
  },
  
  // Custom plugins
  plugins: ['custom-plugin'],
};
```

## Configuration Options

### App Metadata

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `appName` | `string` | ✅ | Display name of your app |
| `appId` | `string` | ✅ | Unique identifier (reverse domain notation) |

### Web Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `framework` | `'vite' \| 'next' \| 'cra' \| 'static'` | ✅ | - | Web framework type |
| `buildCommand` | `string` | ✅ | - | Command to build the web app |
| `webDir` | `string` | ✅ | - | Directory containing built web assets |
| `pwa.manifest` | `string` | ❌ | - | Path to PWA manifest file |
| `pwa.serviceWorker` | `boolean` | ❌ | `false` | Enable service worker |

### Android Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `packaging` | `'capacitor'` | ✅ | - | Android packaging engine in 2.0 |
| `targetSdk` | `number` | ❌ | `34` | Target Android SDK version |
| `minSdk` | `number` | ❌ | `24` | Minimum Android SDK version |
| `permissions` | `string[]` | ❌ | `['INTERNET']` | Android permissions |
| `signing.keystorePath` | `string` | ❌ | - | Path to Android keystore |
| `signing.alias` | `string` | ❌ | - | Keystore alias |
| `signing.storePasswordEnv` | `string` | ❌ | - | Environment variable for store password |
| `signing.keyPasswordEnv` | `string` | ❌ | - | Environment variable for key password |
| `version.code` | `number` | ❌ | `1` | Version code (integer) |
| `version.name` | `string` | ❌ | `'1.0.0'` | Version name (string) |

#### Display Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `display.fullscreen` | `boolean` | ❌ | `false` | Enable fullscreen mode (hides status bar and navigation bar) |
| `display.immersive` | `boolean` | ❌ | `false` | Enable immersive mode (hides system UI with swipe gesture) |
| `display.orientation` | `'portrait' \| 'landscape' \| 'sensor' \| 'sensorPortrait' \| 'sensorLandscape' \| 'fullSensor' \| 'reversePortrait' \| 'reverseLandscape'` | ❌ | `'portrait'` | Screen orientation lock |
| `display.statusBarStyle` | `'light' \| 'dark' \| 'auto'` | ❌ | `'auto'` | Status bar content style (light/dark icons) |
| `display.statusBarHidden` | `boolean` | ❌ | `false` | Hide status bar |
| `display.navigationBarHidden` | `boolean` | ❌ | `false` | Hide navigation bar |
| `display.windowSoftInputMode` | `'adjustResize' \| 'adjustPan' \| 'adjustNothing'` | ❌ | `'adjustResize'` | Keyboard behavior when shown |

#### Launch Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `launch.launchMode` | `'standard' \| 'singleTop' \| 'singleTask' \| 'singleInstance'` | ❌ | `'standard'` | Activity launch mode |
| `launch.taskAffinity` | `string` | ❌ | - | Task affinity (for grouping activities) |
| `launch.allowBackup` | `boolean` | ❌ | `true` | Allow Android backup service |
| `launch.allowClearUserData` | `boolean` | ❌ | `true` | Allow user to clear app data |

#### Build Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `build.enableProguard` | `boolean` | ❌ | `false` | Enable ProGuard/R8 code obfuscation |
| `build.enableMultidex` | `boolean` | ❌ | `false` | Enable multidex support (for apps with >65k methods) |
| `build.minifyEnabled` | `boolean` | ❌ | `false` | Enable code minification |
| `build.shrinkResources` | `boolean` | ❌ | `false` | Remove unused resources (requires minifyEnabled) |
| `build.buildType` | `'apk' \| 'aab' \| 'both'` | ❌ | `'apk'` | Output format (APK for direct install, AAB for Play Store) |

#### Performance Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `performance.hardwareAccelerated` | `boolean` | ❌ | `true` | Enable hardware acceleration |
| `performance.largeHeap` | `boolean` | ❌ | `false` | Request large heap size (for memory-intensive apps) |

### Asset Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `source` | `string` | ✅ | - | Path to source logo (SVG/PNG) |
| `output` | `string` | ❌ | `'assets-gen/'` | Output directory for generated assets |

### Publish Configuration

`publish` fields are reserved for a future automated publish workflow. `deploid publish` is not implemented in 2.0.

#### Play Store

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `track` | `'internal' \| 'alpha' \| 'beta' \| 'production'` | ❌ | Play Store release track; defaults to `internal` |
| `status` | `'draft' \| 'inProgress' \| 'halted' \| 'completed'` | ❌ | Release state sent to Play. New `release init` scaffolds use `draft`; existing configs without this option retain `completed` behavior. |
| `serviceAccountJson` | `string` | ❌ | Path to Google service account JSON |

#### GitHub Releases

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `repo` | `string` | ✅ | GitHub repository (owner/repo) |
| `draft` | `boolean` | ❌ | `false` | Create as draft release |

## Android Configuration Examples

### Fullscreen Game App

```typescript
export default {
  appName: 'MyGame',
  appId: 'com.example.mygame',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
    display: {
      fullscreen: true,
      immersive: true,
      orientation: 'landscape',
      statusBarHidden: true,
      navigationBarHidden: true,
    },
    performance: {
      hardwareAccelerated: true,
      largeHeap: true,
    },
  },
};
```

### Production-Ready App with Optimization

```typescript
export default {
  appName: 'MyApp',
  appId: 'com.example.myapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
    display: {
      orientation: 'portrait',
      statusBarStyle: 'dark',
      windowSoftInputMode: 'adjustResize',
    },
    build: {
      enableProguard: true,
      enableMultidex: true,
      minifyEnabled: true,
      shrinkResources: true,
      buildType: 'aab', // For Play Store
    },
    signing: {
      keystorePath: './release.keystore',
      alias: 'release',
      storePasswordEnv: 'KEYSTORE_PASSWORD',
      keyPasswordEnv: 'KEY_PASSWORD',
    },
  },
};
```

### Tablet-Optimized App

```typescript
export default {
  appName: 'MyTabletApp',
  appId: 'com.example.tabletapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
    display: {
      orientation: 'sensor', // Allow rotation
      statusBarStyle: 'auto',
    },
    launch: {
      launchMode: 'singleTask', // Keep single instance
    },
  },
};
```

## Framework-Specific Configuration

### Vite Projects

```typescript
export default {
  appName: 'ViteApp',
  appId: 'com.example.viteapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
  },
};
```

### Next.js Projects

```typescript
export default {
  appName: 'NextApp',
  appId: 'com.example.nextapp',
  web: {
    framework: 'next',
    buildCommand: 'npm run build',
    webDir: 'out', // Next.js static export
  },
  android: {
    packaging: 'capacitor',
  },
};
```

### Create React App

```typescript
export default {
  appName: 'CRAApp',
  appId: 'com.example.craapp',
  web: {
    framework: 'cra',
    buildCommand: 'npm run build',
    webDir: 'build',
  },
  android: {
    packaging: 'capacitor',
  },
};
```

### Static HTML

```typescript
export default {
  appName: 'StaticApp',
  appId: 'com.example.staticapp',
  web: {
    framework: 'static',
    buildCommand: 'echo "Static files ready"',
    webDir: 'public',
  },
  android: {
    packaging: 'capacitor',
  },
};
```

## Packaging Engine Configuration

### Capacitor

```typescript
export default {
  android: {
    packaging: 'capacitor',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET', 'CAMERA', 'STORAGE'],
  },
};
```

### Tauri (Not Supported in 2.0)

Tauri packaging is planned for a future release and is not currently available.

### TWA (Not Supported in 2.0)

Trusted Web Activity packaging is planned for a future release and is not currently available.

## Environment Variables

### Android Signing

```bash
# Set in your environment or .env file
export ANDROID_STORE_PWD="your-store-password"
export ANDROID_KEY_PWD="your-key-password"
```

### Debug Logging

```bash
# Enable debug logging
export DEPLOID_LOG_LEVEL="debug"
```

## Configuration Validation

Deploid validates your configuration and provides helpful error messages:

```typescript
// ❌ Invalid configuration
export default {
  appName: 'MyApp',
  // Missing required fields
};

// ✅ Valid configuration
export default {
  appName: 'MyApp',
  appId: 'com.example.myapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
  },
};
```

## Advanced Configuration

### Custom Plugins

```typescript
export default {
  // ... other config
  plugins: [
    'custom-asset-plugin',
    'custom-build-plugin',
  ],
};
```

### Multiple Environments

```typescript
// deploid.config.ts
const isProduction = process.env.NODE_ENV === 'production';

export default {
  appName: 'MyApp',
  appId: 'com.example.myapp',
  web: {
    framework: 'vite',
    buildCommand: isProduction ? 'npm run build:prod' : 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
    targetSdk: isProduction ? 34 : 33,
    version: {
      code: isProduction ? 5 : 1,
      name: isProduction ? '1.0.4' : '1.0.0-dev',
    },
  },
};
```

## Configuration Examples

### Complete Production Setup

```typescript
export default {
  appName: 'MyAwesomeApp',
  appId: 'com.mycompany.myawesomeapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build',
    webDir: 'dist',
    pwa: {
      manifest: 'public/manifest.json',
      serviceWorker: true,
    },
  },
  android: {
    packaging: 'capacitor',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET', 'CAMERA', 'STORAGE', 'NOTIFICATIONS'],
    signing: {