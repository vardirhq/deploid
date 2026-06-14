import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import readline from 'node:readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface InitOptions {
  framework?: 'vite' | 'next' | 'cra' | 'static';
  packaging: 'capacitor' | 'tauri' | 'twa';
  firebase?: boolean;
  firebaseProjectId?: string;
  firebaseApiKey?: string;
  allPlugins?: boolean;
  yes?: boolean;
  force?: boolean;
  appName?: string;
  appId?: string;
  description?: string;
  authorName?: string;
  authorEmail?: string;
  assetsSource?: string;
}

interface PackageManagerProfile {
  name: 'npm' | 'pnpm' | 'yarn' | 'bun';
  installCommand: string;
  installArgs: string[];
  runBuildCommand: string;
}

interface AppMetadata {
  appName: string;
  appId: string;
  description: string;
  authorName: string;
  authorEmail: string;
  assetsSource: string;
}

export async function initProject(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const packageManager = detectPackageManager(cwd);
  const configPath = path.join(cwd, 'deploid.config.ts');
  const configExists = fs.existsSync(configPath);

  if (options.packaging !== 'capacitor') {
    throw new Error(`Packaging engine "${options.packaging}" is not supported in Deploid 2.0. Use "capacitor".`);
  }

  // Auto-detect framework from package.json if not specified
  if (!options.framework) {
    const detected = detectFramework(cwd);
    options.framework = detected ?? 'vite';
    if (detected) console.log(`✅ Auto-detected framework: ${detected}`);
  }

  const webDir = getWebDir(options.framework);
  let metadata: AppMetadata | null = null;

  if (configExists && !options.force) {
    console.log('⚠️  deploid.config.ts already exists. Continuing in retry mode.');
    console.log('    Use --force to regenerate deploid.config.ts from scratch.');
  } else {
    metadata = await collectAppMetadata(cwd, options);

    // Firebase is opt-in via --firebase flag only, never prompted during init
    // Users can run `deploid firebase` anytime to add it

    const config = generateConfig(options, packageManager, metadata);

    fs.writeFileSync(configPath, config);
    if (configExists && options.force) {
      console.log('✅ Recreated deploid.config.ts');
    } else {
      console.log('✅ Created deploid.config.ts');
    }

    updatePackageJsonMetadata(cwd, metadata, webDir);
  }

  // Create basic project structure
  await createProjectStructure(cwd, options);

  // Install required dependencies
  await installDependencies(cwd, options, packageManager);

  // Setup Firebase only if explicitly requested via --firebase flag
  if (options.firebase && options.packaging === 'capacitor') {
    await setupFirebase(cwd, options);
  }

  // Install plugin dependencies
  console.log('📦 Installing plugin dependencies...');
  await installPluginDependencies(cwd, options, packageManager);

  // Add deploid scripts to package.json for convenience
  addDeploidScripts(cwd, packageManager);

  console.log('');
  console.log('🎉 Deploid initialized!');
  printNextSteps(cwd, options);
}

function generateConfig(options: InitOptions, packageManager: PackageManagerProfile, metadata: AppMetadata): string {
  const { packaging, firebase, firebaseProjectId } = options;
  const framework = options.framework ?? 'vite';

  const buildCommand = getBuildCommand(framework, packageManager);
  const webDir = getWebDir(framework);
  
  const firebaseConfig = firebase ? `
  firebase: {
    projectId: '${firebaseProjectId || 'your-firebase-project-id'}',
    enabled: true,
  },` : `
  // firebase: { projectId: 'your-project-id', enabled: true },  // run: deploid firebase`;

  return `import type { DeploidConfig } from '@deploid/core';

const config: DeploidConfig = {
  appName: '${metadata.appName}',
  appId: '${metadata.appId}',
  web: {
    framework: '${framework}',
    buildCommand: '${buildCommand}',
    webDir: '${webDir}',
  },
  android: {
    packaging: '${packaging}',
    targetSdk: 34,
    minSdk: 24,
    permissions: ['INTERNET'],
    version: { code: 1, name: '1.0.0' },
    display: {
      fullscreen: false,
      orientation: 'portrait',
      statusBarStyle: 'auto',
      windowSoftInputMode: 'adjustResize',
    },
  },${firebaseConfig}
  assets: {
    source: '${metadata.assetsSource}',
    output: 'assets-gen/',
  },
  publish: {
    github: { repo: '${metadata.authorName.toLowerCase().replace(/\s+/g, '-')}/your-repo', draft: true },
  },
};

export default config;
`;
}

function detectFramework(cwd: string): 'vite' | 'next' | 'cra' | 'static' | null {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return null;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) return 'vite';
  if (deps['next']) return 'next';
  if (deps['react-scripts']) return 'cra';
  // Check for config files as fallback
  if (fs.existsSync(path.join(cwd, 'vite.config.ts')) || fs.existsSync(path.join(cwd, 'vite.config.js'))) return 'vite';
  if (fs.existsSync(path.join(cwd, 'next.config.js')) || fs.existsSync(path.join(cwd, 'next.config.ts'))) return 'next';
  return null;
}

function addDeploidScripts(cwd: string, packageManager: PackageManagerProfile): void {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;
  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return;
  }
  pkg.scripts ||= {};
  const added: string[] = [];
  const scriptsToAdd: Record<string, string> = {
    'android:build': 'deploid build',
    'android:deploy': 'deploid deploy --launch',
    'android:ship': 'deploid ship --patch',
    'android:doctor': 'deploid doctor',
  };
  for (const [name, cmd] of Object.entries(scriptsToAdd)) {
    if (!pkg.scripts[name]) {
      pkg.scripts[name] = cmd;
      added.push(name);
    }
  }
  if (added.length > 0) {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`✅ Added scripts to package.json: ${added.map((s) => `"${s}"`).join(', ')}`);
  }
}

function printNextSteps(cwd: string, options: InitOptions): void {
  const hasLogo = fs.existsSync(path.join(cwd, options.assetsSource || 'assets/logo.svg'));
  const hasAndroid = fs.existsSync(path.join(cwd, 'android'));

  console.log('');
  console.log('Next steps:');

  let step = 1;

  if (!hasLogo) {
    const logoPath = options.assetsSource || 'assets/logo.svg';
    console.log(`  ${step++}. Add your app logo:  cp your-logo.svg ${logoPath}`);
  }

  if (!hasAndroid) {
    console.log(`  ${step++}. Generate icons:     deploid assets`);
    console.log(`  ${step++}. Package for Android: deploid package`);
    console.log(`  ${step++}. Build APK:           deploid build`);
  } else {
    console.log(`  ${step++}. Build APK:           deploid build`);
  }

  console.log(`  ${step++}. Deploy to device:   deploid deploy --launch`);
  console.log('');
  console.log('  Run `deploid doctor` at any time to check your setup.');
  if (!options.firebase) {
    console.log('  Run `deploid firebase` to add push notification support.');
  }
}

function getBuildCommand(framework: string, packageManager: PackageManagerProfile): string {
  const buildCommand = packageManager.runBuildCommand;
  switch (framework) {
    case 'vite': return buildCommand;
    case 'next': return buildCommand;
    case 'cra': return buildCommand;
    case 'static': return 'echo "Static files ready"';
    default: return buildCommand;
  }
}

function getWebDir(framework: string): string {
  switch (framework) {
    case 'vite': return 'dist';
    case 'next': return 'out';
    case 'cra': return 'build';
    case 'static': return 'public';
    default: return 'dist';
  }
}

async function createProjectStructure(cwd: string, options: InitOptions): Promise<void> {
  // Create assets directory
  const assetsDir = path.join(cwd, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log('✅ Created assets/ directory');
  }

  // Create assets-gen directory
  const assetsGenDir = path.join(cwd, 'assets-gen');
  if (!fs.existsSync(assetsGenDir)) {
    fs.mkdirSync(assetsGenDir, { recursive: true });
    console.log('✅ Created assets-gen/ directory');
  }

  // Create template files based on packaging engine
  await createTemplateFiles(cwd, options.packaging, options.framework ?? 'vite', metadataFromOptions(options));
}

function detectPackageManager(cwd: string): PackageManagerProfile {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return {
      name: 'pnpm',
      installCommand: 'pnpm',
      installArgs: ['add'],
      runBuildCommand: 'pnpm run build'
    };
  }

  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return {
      name: 'yarn',
      installCommand: 'yarn',
      installArgs: ['add'],
      runBuildCommand: 'yarn build'
    };
  }

  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) {
    return {
      name: 'bun',
      installCommand: 'bun',
      installArgs: ['add'],
      runBuildCommand: 'bun run build'
    };
  }

  return {
    name: 'npm',
    installCommand: 'npm',
    installArgs: ['install'],
    runBuildCommand: 'npm run build'
  };
}

function installPackages(
  cwd: string,
  packageManager: PackageManagerProfile,
  packages: string[]
) {
  return execa(packageManager.installCommand, [...packageManager.installArgs, ...packages], {
    cwd,
    stdio: 'inherit'
  });
}

function installCommandHint(packageManager: PackageManagerProfile, packages: string[]): string {
  return `${packageManager.installCommand} ${[...packageManager.installArgs, ...packages].join(' ')}`;
}

async function installDependencies(cwd: string, options: InitOptions, packageManager: PackageManagerProfile): Promise<void> {
  console.log('📦 Installing required dependencies...');
  console.log(`Using package manager: ${packageManager.name}`);
  
  try {
    // Install Capacitor CLI and core packages
    await installPackages(cwd, packageManager, ['@capacitor/cli', '@capacitor/core']);
    
    // Install platform-specific packages based on packaging engine
    switch (options.packaging) {
      case 'capacitor':
        await installPackages(cwd, packageManager, ['@capacitor/android']);
        break;
      case 'tauri':
        // TODO: Install Tauri dependencies
        console.log('⚠️  Tauri packaging not yet implemented');
        break;
      case 'twa':
        // TODO: Install TWA dependencies
        console.log('⚠️  TWA packaging not yet implemented');
        break;
    }
    
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.log('⚠️  Failed to install dependencies automatically');
    console.log('Please run manually:');
    console.log(`  ${installCommandHint(packageManager, ['@capacitor/cli', '@capacitor/core', '@capacitor/android'])}`);
  }
}

function metadataFromOptions(options: InitOptions): AppMetadata {
  return {
    appName: options.appName || 'MyApp',
    appId: options.appId || 'com.example.myapp',
    description: options.description || 'Built with Deploid',
    authorName: options.authorName || 'Your Name',
    authorEmail: options.authorEmail || 'you@example.com',
    assetsSource: options.assetsSource || 'assets/logo.svg'
  };
}

function inferAppId(appName: string): string {
  const cleaned = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
  return `com.example.${cleaned || 'myapp'}`;
}

async function collectAppMetadata(cwd: string, options: InitOptions): Promise<AppMetadata> {
  const packageJsonPath = path.join(cwd, 'package.json');
  let packageJson: any = {};
  if (fs.existsSync(packageJsonPath)) {
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch {
      packageJson = {};
    }
  }

  const pkgAuthorName =
    typeof packageJson.author === 'string'
      ? packageJson.author
      : packageJson.author?.name;
  const pkgAuthorEmail =
    typeof packageJson.author === 'object'
      ? packageJson.author?.email
      : undefined;
  const packageName = typeof packageJson.name === 'string' ? packageJson.name : 'myapp';

  const defaults: AppMetadata = {
    appName: options.appName || packageJson.productName || packageJson.appName || 'MyApp',
    appId: options.appId || inferAppId(options.appName || packageName),
    description: options.description || packageJson.description || 'Built with Deploid',
    authorName: options.authorName || pkgAuthorName || 'Your Name',
    authorEmail: options.authorEmail || pkgAuthorEmail || 'you@example.com',
    assetsSource: options.assetsSource || 'assets/logo.svg'
  };

  const shouldPrompt =
    !options.yes &&
    !options.appName &&
    !options.appId &&
    !options.description &&
    !options.authorName &&
    !options.authorEmail &&
    !options.assetsSource;

  if (!shouldPrompt) {
    options.appName = defaults.appName;
    options.appId = defaults.appId;
    options.description = defaults.description;
    options.authorName = defaults.authorName;
    options.authorEmail = defaults.authorEmail;
    options.assetsSource = defaults.assetsSource;
    return defaults;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => new Promise((resolve) => rl.question(prompt, resolve));

  try {
    console.log('\n🧾 Project metadata');
    const appNameInput = (await question(`App name [${defaults.appName}]: `)).trim();
    const appName = appNameInput || defaults.appName;

    const inferredAppId = inferAppId(appName);
    const appIdDefault = options.appId || inferredAppId || defaults.appId;
    const appIdInput = (await question(`App ID (reverse domain) [${appIdDefault}]: `)).trim();
    const appId = appIdInput || appIdDefault;

    const descriptionInput = (await question(`Description [${defaults.description}]: `)).trim();
    const description = descriptionInput || defaults.description;

    const authorNameInput = (await question(`Author name [${defaults.authorName}]: `)).trim();
    const authorName = authorNameInput || defaults.authorName;

    const authorEmailInput = (await question(`Author email [${defaults.authorEmail}]: `)).trim();
    const authorEmail = authorEmailInput || defaults.authorEmail;

    const assetsSourceInput = (await question(`Asset source path [${defaults.assetsSource}]: `)).trim();
    const assetsSource = assetsSourceInput || defaults.assetsSource;

    const metadata = { appName, appId, description, authorName, authorEmail, assetsSource };
    options.appName = metadata.appName;
    options.appId = metadata.appId;
    options.description = metadata.description;
    options.authorName = metadata.authorName;
    options.authorEmail = metadata.authorEmail;
    options.assetsSource = metadata.assetsSource;
    return metadata;
  } finally {
    rl.close();
  }
}

function updatePackageJsonMetadata(cwd: string, metadata: AppMetadata, webDir: string): void {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;

  let packageJson: any;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return;
  }

  packageJson.description = metadata.description;
  packageJson.author = {
    name: metadata.authorName,
    email: metadata.authorEmail
  };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log('✅ Updated package.json metadata');
}

async function createTemplateFiles(cwd: string, packaging: string, framework: string, metadata: AppMetadata): Promise<void> {
  const templatesDir = path.join(__dirname, '../../templates');
  const webDir = getWebDir(framework);
  
  switch (packaging) {
    case 'capacitor':
      await createCapacitorTemplate(cwd, metadata, webDir);
      break;
    case 'tauri':
      await createTauriTemplate(cwd, metadata);
      break;
    case 'twa':
      await createTWATemplate(cwd, metadata);
      break;
  }
}

async function createCapacitorTemplate(cwd: string, metadata: AppMetadata, webDir: string): Promise<void> {
  const capacitorConfig = `{
  "appId": "${metadata.appId}",
  "appName": "${metadata.appName}",
  "webDir": "${webDir}",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000
    }
  }
}`;

  fs.writeFileSync(path.join(cwd, 'capacitor.config.json'), capacitorConfig);
  console.log('✅ Created capacitor.config.json');
}

async function createTauriTemplate(cwd: string, metadata: AppMetadata): Promise<void> {
  const tauriDir = path.join(cwd, 'src-tauri');
  if (!fs.existsSync(tauriDir)) {
    fs.mkdirSync(tauriDir, { recursive: true });
  }

  const tauriConfig = `{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "${metadata.appName}",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "${metadata.appId}",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "${metadata.appName}",
        "width": 1200,
        "height": 800
      }
    ]
  }
}`;

  fs.writeFileSync(path.join(tauriDir, 'tauri.conf.json'), tauriConfig);
  console.log('✅ Created tauri.conf.json');
}

async function createTWATemplate(cwd: string, metadata: AppMetadata): Promise<void> {
  const publicDir = path.join(cwd, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const manifest = `{
  "name": "${metadata.appName}",
  "short_name": "${metadata.appName}",
  "description": "${metadata.description}",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "assets-gen/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets-gen/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}`;

  fs.writeFileSync(path.join(publicDir, 'manifest.json'), manifest);
  console.log('✅ Created public/manifest.json');
}

async function askFirebaseSetup(): Promise<{ enabled: boolean; projectId?: string; apiKey?: string }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    console.log('\n🔥 Firebase Setup for Push Notifications');
    console.log('Firebase enables native push notifications for your Android app.');
    
    const enableFirebase = await question('Do you want to set up Firebase for push notifications? (y/N): ');
    const enabled = enableFirebase.toLowerCase().startsWith('y');
    
    if (!enabled) {
      console.log('⚠️  Skipping Firebase setup. You can add it later with: deploid firebase');
      return { enabled: false };
    }

    console.log('\n📋 Firebase Setup Options:');
    console.log('1. Auto-create Firebase project (requires Firebase CLI)');
    console.log('2. Use existing Firebase project');
    console.log('3. Skip for now (add later with: deploid firebase)');
    
    const choice = await question('Choose an option (1-3): ');
    
    if (choice === '3') {
      console.log('⚠️  Skipping Firebase setup. You can add it later with: deploid firebase');
      return { enabled: false };
    }
    
    if (choice === '1') {
      console.log('🚀 Auto-creating Firebase project...');
      return { enabled: true };
    }
    
    if (choice === '2') {
      const projectId = await question('Enter your Firebase project ID: ');
      const apiKey = await question('Enter your Firebase API key (optional): ');
      return { enabled: true, projectId, apiKey };
    }
    
    return { enabled: false };
  } finally {
    rl.close();
  }
}

async function setupFirebase(cwd: string, options: InitOptions): Promise<void> {
  console.log('🔥 Setting up Firebase...');
  
  try {
    // Check if Firebase CLI is installed
    try {
      await execa('firebase', ['--version'], { stdio: 'pipe' });
    } catch (error) {
      console.log('📦 Installing Firebase CLI...');
      await execa('npm', ['install', '-g', 'firebase-tools'], { stdio: 'inherit' });
    }
    
    // Login to Firebase
    console.log('🔐 Please login to Firebase...');
    await execa('firebase', ['login'], { stdio: 'inherit' });
    
    // Create Firebase project
    if (!options.firebaseProjectId) {
      console.log('🚀 Creating Firebase project...');
      const projectName = path.basename(cwd).replace(/[^a-zA-Z0-9]/g, '-');
      await execa('firebase', ['projects:create', projectName], { stdio: 'inherit' });
      options.firebaseProjectId = projectName;
    }
    
    // Initialize Firebase in the project
    await execa('firebase', ['init', 'hosting'], { 
      cwd, 
      stdio: 'inherit',
      input: 'y\nn\n' // Yes to hosting, no to other features
    });
    
    // Add Android app to Firebase
    console.log('📱 Adding Android app to Firebase...');
    const packageName = options.appId || 'com.example.myapp';
    await execa('firebase', ['apps:create', 'android', packageName], { 
      cwd, 
      stdio: 'inherit' 
    });
    
    // Download google-services.json
    console.log('📄 Downloading google-services.json...');
    await execa('firebase', ['apps:sdkconfig', 'android'], { 
      cwd, 
      stdio: 'inherit' 
    });
    
    // Move google-services.json to correct location
    const sourcePath = path.join(cwd, 'google-services.json');
    const targetPath = path.join(cwd, 'android/app/google-services.json');
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      fs.unlinkSync(sourcePath); // Remove from root
      console.log('✅ Firebase setup complete!');
    } else {
      console.log('⚠️  google-services.json not found. Please download it manually from Firebase Console.');
    }
    
  } catch (error) {
    console.log('⚠️  Firebase setup failed:', error);
    console.log('You can set it up manually later with: deploid firebase');
  }
}

async function installPluginDependencies(cwd: string, options: InitOptions, packageManager: PackageManagerProfile): Promise<void> {
  // Core plugins required for every Android project
  const corePlugins = [
    '@deploid/plugin-assets',
    '@deploid/plugin-build-android',
    '@deploid/plugin-doctor',
    '@deploid/plugin-version',
    options.packaging === 'capacitor' ? '@deploid/plugin-packaging-capacitor' : null,
  ].filter(Boolean) as string[];

  // Recommended but optional extras
  const extraPlugins: Array<{ name: string; package: string }> = [
    { name: 'deploy-android (ADB device deployment)', package: '@deploid/plugin-deploy-android' },
    { name: 'prepare-ios (iOS Xcode project handoff)', package: '@deploid/plugin-prepare-ios' },
    { name: 'storage (cross-platform Capacitor storage)', package: '@deploid/plugin-storage' },
    { name: 'debug-network (network debugging overlay)', package: '@deploid/plugin-debug-network' },
    { name: 'packaging-electron (desktop app packaging)', package: '@deploid/plugin-packaging-electron' },
  ];

  try {
    console.log(`  Core: ${corePlugins.join(', ')}`);
    await installPackages(cwd, packageManager, corePlugins);
    console.log('✅ Core plugins installed');

    let selectedExtras: string[] = [];

    if (options.allPlugins) {
      selectedExtras = extraPlugins.map((p) => p.package);
      console.log('✅ All optional plugins selected (--all-plugins)');
    } else if (options.yes) {
      console.log('  Skipping optional plugins (--yes mode). Add later with: deploid plugin --install <name>');
    } else {
      // Ask once with a concise list instead of prompting one-by-one
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const question = (prompt: string): Promise<string> => new Promise((resolve) => rl.question(prompt, resolve));

      try {
        console.log('\n  Optional plugins (press Enter to skip, or type numbers separated by spaces):');
        for (const [i, p] of extraPlugins.entries()) {
          console.log(`    [${i + 1}] ${p.name}`);
        }
        const answer = (await question('  Install extras [e.g. 1 2]: ')).trim();
        if (answer) {
          const indices = answer.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= extraPlugins.length);
          selectedExtras = indices.map((n) => extraPlugins[n - 1].package);
        }
      } finally {
        rl.close();
      }
    }

    if (selectedExtras.length > 0) {
      console.log(`\n📦 Installing optional plugins: ${selectedExtras.join(', ')}`);
      try {
        await installPackages(cwd, packageManager, selectedExtras);
        console.log('✅ Optional plugins installed');
      } catch (error) {
        console.log('⚠️  Some optional plugins failed to install. You can add them later:');
        console.log(`    ${installCommandHint(packageManager, selectedExtras)}`);
      }
    }
  } catch (error) {
    console.log('⚠️  Failed to install plugin packages:', error);
    console.log(`    Run manually: ${installCommandHint(packageManager, corePlugins)}`);
  }
}
