# Examples

This document provides practical examples of using Deploid with different web frameworks and configurations.

## Integration Example

If you are building your own client around Deploid, see:

- [examples/api-client/README.md](/home/chris/Documents/GitHub/deploid/examples/api-client/README.md)

That example covers both direct `@deploid/cli` usage and the optional local daemon mode.

## Framework Examples

### Vite + React

**Project Setup**:
```bash
# Create Vite React project
npm create vite@latest my-app -- --template react
cd my-app

# Initialize Deploid
deploid init --framework vite --packaging capacitor
```

**Configuration** (`deploid.config.ts`):
```typescript
export default {
  appName: 'MyViteApp',
  appId: 'com.example.myviteapp',
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
    permissions: ['INTERNET', 'CAMERA'],
    version: { code: 1, name: '1.0.0' },
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
};
```

**Build Process**:
```bash
# Add logo
cp logo.svg assets/logo.svg

# Generate assets
deploid assets

# Package for Android
deploid package

# Build APK
deploid build
```

### Next.js Static Export

**Project Setup**:
```bash
# Create Next.js project
npx create-next-app@latest my-app
cd my-app

# Initialize Deploid
deploid init --framework next --packaging capacitor
```

**Configuration** (`deploid.config.ts`):
```typescript
export default {
  appName: 'MyNextApp',
  appId: 'com.example.mynextapp',
  web: {
    framework: 'next',
    buildCommand: 'npm run build',
    webDir: 'out', // Next.js static export
    pwa: {
      manifest: 'public/manifest.json',
      serviceWorker: true,
    },
  },
  android: {
    packaging: 'capacitor',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET'],
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
};
```

**Next.js Configuration** (`next.config.js`):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
```

### Create React App

**Project Setup**:
```bash
# Create CRA project
npx create-react-app my-app
cd my-app

# Initialize Deploid
deploid init --framework cra --packaging capacitor
```

**Configuration** (`deploid.config.ts`):
```typescript
export default {
  appName: 'MyCRAApp',
  appId: 'com.example.mycraapp',
  web: {
    framework: 'cra',
    buildCommand: 'npm run build',
    webDir: 'build',
    pwa: {
      manifest: 'public/manifest.json',
      serviceWorker: true,
    },
  },
  android: {
    packaging: 'capacitor',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET'],
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
};
```

### Static HTML

**Project Setup**:
```bash
# Create static project
mkdir my-static-app
cd my-static-app

# Initialize Deploid
deploid init --framework static --packaging capacitor
```

**Configuration** (`deploid.config.ts`):
```typescript
export default {
  appName: 'MyStaticApp',
  appId: 'com.example.mystaticapp',
  web: {
    framework: 'static',
    buildCommand: 'echo "Static files ready"',
    webDir: 'public',
  },
  android: {
    packaging: 'capacitor',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET'],
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
};
```

## Advanced Examples

### Production Configuration

**Complete Production Setup**:
```typescript
export default {
  appName: 'MyProductionApp',
  appId: 'com.mycompany.myproductionapp',
  web: {
    framework: 'vite',
    buildCommand: 'npm run build:prod',
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
    permissions: [
      'INTERNET',
      'CAMERA',
      'STORAGE',
      'NOTIFICATIONS',
      'ACCESS_FINE_LOCATION',
    ],
    signing: {
      keystorePath: './android.keystore',
      alias: 'mykey',
      storePasswordEnv: 'ANDROID_STORE_PWD',
      keyPasswordEnv: 'ANDROID_KEY_PWD',
    },
    version: {
      code: 10,
      name: '2.1.0',
    },
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
  publish: {
    play: {
      track: 'production',
      serviceAccountJson: 'secrets/play.json',
    },
    github: {
      repo: 'mycompany/myproductionapp',
      draft: false,
    },
  },
};
```

### Multi-Environment Configuration

**Environment-Specific Setup**:
```typescript
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

export default {
  appName: 'MyApp',
  appId: 'com.example.myapp',
  web: {
    framework: 'vite',
    buildCommand: isProduction 
      ? 'npm run build:prod' 
      : isStaging 
        ? 'npm run build:staging' 
        : 'npm run build',
    webDir: 'dist',
  },
  android: {
    packaging: 'capacitor',
    targetSdk: isProduction ? 34 : 33,
    minSdk: 24,
    permissions: isProduction 
      ? ['INTERNET', 'CAMERA', 'STORAGE'] 
      : ['INTERNET'],
    signing: isProduction ? {
      keystorePath: './android.keystore',
      alias: 'mykey',
      storePasswordEnv: 'ANDROID_STORE_PWD',
      keyPasswordEnv: 'ANDROID_KEY_PWD',
    } : undefined,
    version: {
      code: isProduction ? 10 : isStaging ? 5 : 1,
      name: isProduction ? '2.1.0' : isStaging ? '2.1.0-beta' : '2.1.0-dev',
    },
  },
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
  publish: isProduction ? {
    play: {
      track: 'production',
      serviceAccountJson: 'secrets/play.json',
    },
    github: {
      repo: 'mycompany/myapp',
      draft: false,
    },
  } : undefined,
};
```

### Custom Plugin Integration

**Using Custom Plugins**:
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
  assets: {
    source: 'assets/logo.svg',
    output: 'assets-gen/',
  },
  // Custom plugin configuration
  customPlugin: {
    option1: 'value1',
    option2: 42,
  },
  plugins: [
    'custom-asset-plugin',
    'custom-build-plugin',
  ],
};
```

## CI/CD Examples

### GitHub Actions

**Build Pipeline (2.0)**:
```yaml
name: Build Android Package
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Deploid
        run: npm install -g @deploid/cli
        
      - name: Generate assets
        run: deploid assets
        
      - name: Package for Android
        run: deploid package
        
      - name: Setup Android SDK
        uses: android-actions/setup-android@v2
        
      - name: Build APK/AAB
        run: deploid build
        env:
          ANDROID_STORE_PWD: ${{ secrets.ANDROID_STORE_PWD }}
          ANDROID_KEY_PWD: ${{ secrets.ANDROID_KEY_PWD }}
          
      # Deploid 2.0 note:
      # "deploid publish" is not implemented yet.
```

### GitLab CI

**GitLab CI Pipeline**:
```yaml
stages:
  - build

variables:
  NODE_VERSION: "18"

build:
  stage: build
  image: node:${NODE_VERSION}
  before_script:
    - npm install -g @deploid/cli
  script:
    - deploid assets
    - deploid package
    - deploid build
  artifacts:
    paths:
      - android/app/build/outputs/
    expire_in: 1 week

# Deploid 2.0 note:
# publish stage is omitted because "deploid publish" is not implemented.
```

### Jenkins Pipeline

**Jenkinsfile**:
```groovy
pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g @deploid/cli'
            }
        }
        
        stage('Assets') {
            steps {
                sh 'deploid assets'
            }
        }
        
        stage('Package') {
            steps {
                sh 'deploid package'
            }
        }
        
        stage('Build') {
            steps {
                sh 'deploid build'
            }
        }
        
        // Deploid 2.0 note:
        // publish stage omitted because "deploid publish" is not implemented.
    }
}
```

## Troubleshooting Examples

### Common Issues and Solutions

**1. Capacitor CLI Not Found**
```bash
# Solution: Install globally
npm install -g @capacitor/cli

# Or use npx
npx @capacitor/cli --version
```

**2. Android Studio Not Found**
```bash
# Solution: Install Android Studio and set environment variables
export ANDROID_HOME=/path/to/android/sdk
export ANDROID_SDK_ROOT=/path/to/android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

**3. Java Not Found**
```bash
# Solution: Install JDK and set JAVA_HOME
export JAVA_HOME=/path/to/jdk
export PATH=$PATH:$JAVA_HOME/bin
```

**4. Build Fails**
```bash
# Solution: Clean and rebuild
rm -rf android/
deploid package
deploid build
```

**5. Signing Issues**
```bash
# Solution: Check keystore and passwords
keytool -list -v -keystore android.keystore -alias mykey
```

### Debug Examples

**Enable Debug Logging**:
```bash
# Debug all commands
DEPLOID_LOG_LEVEL=debug deploid assets
DEPLOID_LOG_LEVEL=debug deploid package
DEPLOID_LOG_LEVEL=debug deploid build
```

**Check Capacitor Setup**:
```bash
# Verify Capacitor installation
npx @capacitor/cli doctor

# Check Android setup
npx @capacitor/cli build android --list
```

**Validate Configuration**:
```bash
# Check if configuration is valid
node -e "console.log(require('./deploid.config.js'))"
```

## Performance Examples

### Optimized Build Process

**Build Script** (`package.json`):
```json
{
  "scripts": {
    "build:android": "deploid assets && deploid package && deploid build",
    "build:android:debug": "deploid assets && deploid package && deploid build --debug",
    "build:android:release": "deploid assets && deploid package && deploid build --release"
  }
}
```

**Parallel Asset Generation**:
```typescript
// Custom plugin for parallel processing
export const parallelAssetPlugin = (): PipelineStep => async ({ logger, config, cwd }) => {
  const sizes = [48, 72, 96, 144, 192];
  const promises = sizes.map(size => generateIcon(size));
  await Promise.all(promises);
  logger.info('All assets generated in parallel');
};
```

### Caching Examples

**Docker Build with Caching**:
```dockerfile
FROM node:18-alpine

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install Deploid
RUN npm install -g @deploid/cli

# Copy source
COPY . .

# Build with caching
RUN deploid assets
RUN deploid package
RUN deploid build
```

**GitHub Actions Caching**:
```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    
- name: Cache Android build
  uses: actions/cache@v3
  with:
    path: android/
    key: ${{ runner.os }}-android-${{ hashFiles('**/deploid.config.ts') }}
```
