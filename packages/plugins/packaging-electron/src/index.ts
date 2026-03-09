import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}

type PackageJson = {
  name?: string;
  description?: string;
  author?: string | { name?: string; email?: string };
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: Record<string, any>;
};

const runPackagingElectron: PipelineStep = async ({ logger, config, cwd }: any) => {
  logger.info(`packaging-electron: preparing ${config.appName} for desktop (Windows/macOS/Linux)`);

  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(raw) as PackageJson;

    ensureElectronEntryFiles(cwd, config, logger);

    let changed = false;
    changed = ensureMainEntry(packageJson) || changed;
    changed = ensureScripts(packageJson, config, logger) || changed;
    changed = ensureBuildConfig(packageJson, config, logger) || changed;

    if (changed) {
      fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
      logger.info('Updated package.json with Electron scripts/config');
    } else {
      logger.debug('package.json already has Electron defaults');
    }

    await ensureDesktopDependencies(cwd, packageJson, logger);

    logger.info('✅ Electron packaging scaffold is ready');
    logger.info('Run `npm run electron:build:win|mac|linux` (or pnpm/yarn/bun equivalent) to create installers');
  } catch (error) {
    logger.error(`Electron packaging failed: ${error}`);
    throw error;
  }
};

const plugin = {
  name: 'packaging-electron',
  requirements: ['node', 'npm|pnpm|yarn|bun'],
  plan: () => [
    'Create Electron main/preload entry files',
    'Add Electron scripts + electron-builder targets to package.json',
    'Install Electron desktop dependencies'
  ],
  validate: async ({ cwd }: any) => {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project root');
    }
  },
  run: runPackagingElectron
};

const packagingElectron = (): PipelineStep => runPackagingElectron;

function ensureElectronEntryFiles(cwd: string, config: any, logger: any): void {
  const electronDir = path.join(cwd, 'electron');
  if (!fs.existsSync(electronDir)) {
    fs.mkdirSync(electronDir, { recursive: true });
  }

  const mainPath = path.join(electronDir, 'main.cjs');
  if (!fs.existsSync(mainPath)) {
    fs.writeFileSync(mainPath, createMainTemplate(config.web.webDir));
    logger.info('Created electron/main.cjs');
  }

  const preloadPath = path.join(electronDir, 'preload.cjs');
  if (!fs.existsSync(preloadPath)) {
    fs.writeFileSync(preloadPath, createPreloadTemplate());
    logger.info('Created electron/preload.cjs');
  }
}

function createMainTemplate(webDir: string): string {
  return `const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const webDir = process.env.DEPLOID_WEB_DIR || '${escapeSingleQuotes(webDir)}';
const devServerUrl = process.env.ELECTRON_START_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (devServerUrl) {
    win.loadURL(devServerUrl);
    return;
  }

  const indexPath = path.join(__dirname, '..', webDir, 'index.html');
  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`;
}

function createPreloadTemplate(): string {
  return `const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('deploidElectron', {
  platform: process.platform,
  versions: process.versions
});
`;
}

function ensureMainEntry(packageJson: PackageJson): boolean {
  if (!packageJson.main) {
    packageJson.main = 'electron/main.cjs';
    return true;
  }
  return false;
}

function ensureScripts(packageJson: PackageJson, config: any, logger: any): boolean {
  packageJson.scripts ||= {};

  const desiredScripts: Record<string, string> = {
    'electron:dev': 'electron .',
    'electron:build': `${config.web.buildCommand} && electron-builder`,
    'electron:build:win': `${config.web.buildCommand} && electron-builder --win`,
    'electron:build:mac': `${config.web.buildCommand} && electron-builder --mac`,
    'electron:build:linux': `${config.web.buildCommand} && electron-builder --linux`
  };

  let changed = false;

  for (const [key, value] of Object.entries(desiredScripts)) {
    if (!packageJson.scripts[key]) {
      packageJson.scripts[key] = value;
      changed = true;
    }
  }

  if (!changed) {
    logger.debug('Electron scripts already present; leaving existing values untouched');
  }

  return changed;
}

function ensureBuildConfig(packageJson: PackageJson, config: any, logger: any): boolean {
  if (!packageJson.build || typeof packageJson.build !== 'object') {
    packageJson.build = {};
  }

  const build = packageJson.build;
  let changed = false;

  changed = setIfMissing(build, 'appId', config.appId) || changed;
  changed = setIfMissing(build, 'productName', config.appName) || changed;
  changed = setIfMissing(packageJson, 'description', `${config.appName} desktop app`) || changed;

  if (!build.directories || typeof build.directories !== 'object') {
    build.directories = {};
    changed = true;
  }
  changed = setIfMissing(build.directories, 'output', 'dist-electron') || changed;

  if (!Array.isArray(build.files)) {
    build.files = [];
    changed = true;
  }
  const requiredFiles = [`${config.web.webDir}/**/*`, 'electron/**/*', 'package.json'];
  for (const pattern of requiredFiles) {
    if (!build.files.includes(pattern)) {
      build.files.push(pattern);
      changed = true;
    }
  }

  if (!build.win || typeof build.win !== 'object') {
    build.win = { target: ['nsis'] };
    changed = true;
  } else if (!Array.isArray(build.win.target)) {
    build.win.target = ['nsis'];
    changed = true;
  }

  if (!build.mac || typeof build.mac !== 'object') {
    build.mac = { target: ['dmg', 'zip'], category: 'public.app-category.productivity' };
    changed = true;
  } else {
    changed = setIfMissing(build.mac, 'target', ['dmg', 'zip']) || changed;
    changed = setIfMissing(build.mac, 'category', 'public.app-category.productivity') || changed;
  }

  if (!build.linux || typeof build.linux !== 'object') {
    build.linux = { target: ['AppImage', 'deb'], category: 'Utility' };
    changed = true;
  } else {
    changed = setIfMissing(build.linux, 'target', ['AppImage', 'deb']) || changed;
    changed = setIfMissing(build.linux, 'category', 'Utility') || changed;
  }
  const maintainer = formatMaintainer(packageJson.author);
  if (maintainer) {
    changed = setIfMissing(build.linux, 'maintainer', maintainer) || changed;
  }

  if (!changed) {
    logger.debug('electron-builder config already present; leaving existing values untouched');
  }

  return changed;
}

function setIfMissing(target: Record<string, any>, key: string, value: any): boolean {
  if (target[key] === undefined) {
    target[key] = value;
    return true;
  }
  return false;
}

function formatMaintainer(author: PackageJson['author']): string | null {
  if (!author) return null;
  if (typeof author === 'string') {
    return author;
  }
  if (author.name && author.email) {
    return `${author.name} <${author.email}>`;
  }
  if (author.name) {
    return author.name;
  }
  return null;
}

async function ensureDesktopDependencies(cwd: string, packageJson: PackageJson, logger: any): Promise<void> {
  const installed = {
    electron: Boolean(packageJson.devDependencies?.electron || packageJson.dependencies?.electron),
    electronBuilder: Boolean(packageJson.devDependencies?.['electron-builder'] || packageJson.dependencies?.['electron-builder'])
  };

  const missing: string[] = [];
  if (!installed.electron) {
    missing.push('electron');
  }
  if (!installed.electronBuilder) {
    missing.push('electron-builder');
  }

  if (missing.length === 0) {
    logger.debug('Electron dependencies already installed');
    return;
  }

  const installCmd = detectPackageManager(cwd);
  logger.info(`Installing desktop dependencies with ${installCmd.command}: ${missing.join(', ')}`);

  await runCommand(installCmd.command, [...installCmd.args, ...missing], cwd);
}

function detectPackageManager(cwd: string): { command: string; args: string[] } {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return { command: 'pnpm', args: ['add', '-D'] };
  }

  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return { command: 'yarn', args: ['add', '-D'] };
  }

  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) {
    return { command: 'bun', args: ['add', '-d'] };
  }

  return { command: 'npm', args: ['install', '-D'] };
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${command} ${args.join(' ')}), exit code: ${code ?? 'unknown'}`));
    });
  });
}

export default plugin;
export { packagingElectron, plugin };
