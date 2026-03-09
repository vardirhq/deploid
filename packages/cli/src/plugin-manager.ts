import { execa } from 'execa';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

export interface PluginManagerOptions {
  list?: boolean;
  install?: string;
  remove?: string;
  init?: string;
  validate?: string | boolean;
  dir?: string;
  force?: boolean;
  json?: boolean;
}

// Available plugins with their details
const availablePlugins = {
  'assets': {
    name: '@deploid/plugin-assets',
    description: 'Generate app icons and assets from your logo',
    required: true
  },
  'artifacts': {
    name: '@deploid/plugin-artifacts',
    description: 'Inspect and clean generated Android, desktop, and asset outputs',
    required: false
  },
  'packaging-capacitor': {
    name: '@deploid/plugin-packaging-capacitor',
    description: 'Package your app with Capacitor',
    required: false
  },
  'packaging-electron': {
    name: '@deploid/plugin-packaging-electron',
    description: 'Create Electron desktop apps for Windows, macOS, and Linux',
    required: false
  },
  'build-android': {
    name: '@deploid/plugin-build-android',
    description: 'Build Android APK/AAB files',
    required: false
  },
  'deploy-android': {
    name: '@deploid/plugin-deploy-android',
    description: 'Deploy to Android devices via ADB',
    required: false
  },
  'prepare-ios': {
    name: '@deploid/plugin-prepare-ios',
    description: 'Prepare iOS project for Mac handoff',
    required: false
  },
  'debug-network': {
    name: '@deploid/plugin-debug-network',
    description: 'Add network debugging tools to your app',
    required: false
  },
  'doctor': {
    name: '@deploid/plugin-doctor',
    description: 'Audit project readiness, dependencies, and Android tooling',
    required: false
  },
  'release-init': {
    name: '@deploid/plugin-release-init',
    description: 'Scaffold Android signing, release metadata, and publish placeholders',
    required: false
  },
  'publish': {
    name: '@deploid/plugin-publish',
    description: 'Upload APK/AAB artifacts to GitHub Releases or Play Console',
    required: false
  },
  'version': {
    name: '@deploid/plugin-version',
    description: 'Sync semver, Android versionCode/name, and release notes scaffolding',
    required: false
  },
  'changelog': {
    name: '@deploid/plugin-changelog',
    description: 'Generate CHANGELOG entries from release notes and git history',
    required: false
  },
  'ci-init': {
    name: '@deploid/plugin-ci-init',
    description: 'Generate GitHub Actions workflow scaffolding for Deploid releases',
    required: false
  },
  'storage': {
    name: '@deploid/plugin-storage',
    description: 'Cross-platform storage utilities for web and native',
    required: false
  }
};

export async function managePlugins(options: PluginManagerOptions): Promise<void> {
  const cwd = process.cwd();

  const requiresProject = !options.init && !options.validate;

  // Check if we're in a Deploid project
  if (requiresProject && !hasDeploidConfig(cwd)) {
    console.error('❌ Not in a Deploid project. Run "deploid init" first.');
    process.exit(1);
  }

  if (options.list) {
    await listPlugins(cwd);
  } else if (options.install) {
    await installPlugin(cwd, options.install);
  } else if (options.remove) {
    await removePlugin(cwd, options.remove);
  } else if (options.init) {
    const { initPluginScaffold } = await import('./plugin-tools.js');
    await initPluginScaffold(options.init, { dir: options.dir, force: options.force });
  } else if (options.validate) {
    const { validatePluginScaffold } = await import('./plugin-tools.js');
    await validatePluginScaffold(typeof options.validate === 'string' ? options.validate : undefined, { json: options.json });
  } else {
    // Interactive mode
    await interactivePluginManager(cwd);
  }
}

async function listPlugins(cwd: string): Promise<void> {
  console.log('📦 Available Deploid Plugins:\n');
  
  for (const [key, plugin] of Object.entries(availablePlugins)) {
    const isInstalled = await isPluginInstalled(cwd, plugin.name);
    const status = isInstalled ? '✅ Installed' : '⏸️  Not installed';
    const required = plugin.required ? ' (Required)' : '';
    
    console.log(`${status} ${plugin.description}${required}`);
    console.log(`   Package: ${plugin.name}`);
    console.log(`   Key: ${key}\n`);
  }
}

function hasDeploidConfig(cwd: string): boolean {
  return ['deploid.config.ts', 'deploid.config.js', 'deploid.config.mjs', 'deploid.config.cjs']
    .some((candidate) => fs.existsSync(path.join(cwd, candidate)));
}

async function installPlugin(cwd: string, pluginKey: string): Promise<void> {
  const plugin = availablePlugins[pluginKey as keyof typeof availablePlugins];
  
  if (!plugin) {
    console.error(`❌ Unknown plugin: ${pluginKey}`);
    console.log('Available plugins:', Object.keys(availablePlugins).join(', '));
    process.exit(1);
  }

  if (await isPluginInstalled(cwd, plugin.name)) {
    console.log(`✅ Plugin ${plugin.name} is already installed`);
    return;
  }

  console.log(`📦 Installing ${plugin.description}...`);
  
  try {
    // Try normal install first
    try {
      await execa('npm', ['install', plugin.name], { cwd });
    } catch (error) {
      // If normal install fails, try with legacy peer deps
      console.log('⚠️  Normal install failed, trying with legacy peer deps...');
      await execa('npm', ['install', plugin.name, '--legacy-peer-deps'], { cwd });
    }
    console.log(`✅ Successfully installed ${plugin.name}`);
    
    // If it's a plugin that sets up files, run it
    if (pluginKey === 'storage') {
      console.log('🔧 Setting up storage utilities...');
      // The storage plugin will automatically set up files when installed
    }
  } catch (error) {
    console.error(`❌ Failed to install ${plugin.name}:`, error);
    process.exit(1);
  }
}

async function removePlugin(cwd: string, pluginKey: string): Promise<void> {
  const plugin = availablePlugins[pluginKey as keyof typeof availablePlugins];
  
  if (!plugin) {
    console.error(`❌ Unknown plugin: ${pluginKey}`);
    console.log('Available plugins:', Object.keys(availablePlugins).join(', '));
    process.exit(1);
  }

  if (plugin.required) {
    console.error(`❌ Cannot remove required plugin: ${plugin.description}`);
    process.exit(1);
  }

  if (!(await isPluginInstalled(cwd, plugin.name))) {
    console.log(`ℹ️  Plugin ${plugin.name} is not installed`);
    return;
  }

  console.log(`🗑️  Removing ${plugin.description}...`);
  
  try {
    await execa('npm', ['uninstall', plugin.name], { cwd });
    console.log(`✅ Successfully removed ${plugin.name}`);
  } catch (error) {
    console.error(`❌ Failed to remove ${plugin.name}:`, error);
    process.exit(1);
  }
}

async function interactivePluginManager(cwd: string): Promise<void> {
  console.log('🔧 Deploid Plugin Manager\n');
  
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
    console.log('What would you like to do?');
    console.log('1. List available plugins');
    console.log('2. Install a plugin');
    console.log('3. Remove a plugin');
    console.log('4. Exit');
    
    const choice = await question('\nEnter your choice (1-4): ');
    
    switch (choice.trim()) {
      case '1':
        await listPlugins(cwd);
        break;
        
      case '2':
        await interactiveInstall(cwd, rl);
        break;
        
      case '3':
        await interactiveRemove(cwd, rl);
        break;
        
      case '4':
        console.log('👋 Goodbye!');
        break;
        
      default:
        console.log('❌ Invalid choice');
    }
  } finally {
    rl.close();
  }
}

async function interactiveInstall(cwd: string, rl: any): Promise<void> {
  console.log('\n📦 Available plugins to install:\n');
  
  const allPlugins = Object.entries(availablePlugins)
    .filter(([key, plugin]) => !plugin.required);
  
  const installablePlugins = [];
  for (let i = 0; i < allPlugins.length; i++) {
    const [key, plugin] = allPlugins[i];
    const isInstalled = await isPluginInstalled(cwd, plugin.name);
    installablePlugins.push({
      key,
      plugin,
      index: i + 1,
      isInstalled
    });
  }

  for (const { key, plugin, index, isInstalled } of installablePlugins) {
    const status = isInstalled ? '✅ Installed' : '⏸️  Not installed';
    console.log(`${index}. ${status} ${plugin.description}`);
  }
  
  const choice = await new Promise<string>((resolve) => {
    rl.question('\nEnter plugin number to install (or 0 to cancel): ', resolve);
  });
  
  const pluginIndex = parseInt(choice) - 1;
  
  if (pluginIndex === -1) {
    console.log('Installation cancelled');
    return;
  }
  
  if (pluginIndex < 0 || pluginIndex >= installablePlugins.length) {
    console.log('❌ Invalid choice');
    return;
  }
  
  const { key, plugin, isInstalled } = installablePlugins[pluginIndex];
  
  if (isInstalled) {
    console.log(`✅ ${plugin.description} is already installed`);
    return;
  }
  
  await installPlugin(cwd, key);
}

async function interactiveRemove(cwd: string, rl: any): Promise<void> {
  console.log('\n🗑️  Installed plugins you can remove:\n');
  
  const allPlugins = Object.entries(availablePlugins)
    .filter(([key, plugin]) => !plugin.required);
  
  const removablePlugins = [];
  for (let i = 0; i < allPlugins.length; i++) {
    const [key, plugin] = allPlugins[i];
    const isInstalled = await isPluginInstalled(cwd, plugin.name);
    if (isInstalled) {
      removablePlugins.push({
        key,
        plugin,
        index: removablePlugins.length + 1
      });
    }
  }

  if (removablePlugins.length === 0) {
    console.log('No removable plugins found');
    return;
  }

  for (const { key, plugin, index } of removablePlugins) {
    console.log(`${index}. ${plugin.description}`);
  }
  
  const choice = await new Promise<string>((resolve) => {
    rl.question('\nEnter plugin number to remove (or 0 to cancel): ', resolve);
  });
  
  const pluginIndex = parseInt(choice) - 1;
  
  if (pluginIndex === -1) {
    console.log('Removal cancelled');
    return;
  }
  
  if (pluginIndex < 0 || pluginIndex >= removablePlugins.length) {
    console.log('❌ Invalid choice');
    return;
  }
  
  const { key } = removablePlugins[pluginIndex];
  await removePlugin(cwd, key);
}

async function isPluginInstalled(cwd: string, pluginName: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return !!(packageJson.dependencies?.[pluginName] || packageJson.devDependencies?.[pluginName]);
  } catch {
    return false;
  }
}
