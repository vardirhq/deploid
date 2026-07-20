import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let activeProcess: ChildProcessWithoutNullStreams | null = null;

const ALLOWED_COMMANDS = new Set([
  'init',
  'doctor',
  'assets',
  'package',
  'build',
  'deploy',
  'devices',
  'logs',
  'uninstall',
  'debug',
  'ios',
  'ios:handbook',
  'firebase',
  'plugin',
  'release',
  'version',
  'changelog',
  'ship',
  'artifacts',
  'electron',
  'publish'
]);

function createWindow(): void {
  const screenshotPath = process.env.DEPLOID_STUDIO_SCREENSHOT_PATH;
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0b0e0c',
    autoHideMenuBar: true,
    title: 'Deploid',
    show: !screenshotPath,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(join(__dirname, 'renderer', 'index.html'));
  if (screenshotPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (!mainWindow) return;
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(resolve(screenshotPath), image.toPNG());
        app.quit();
      }, 2500);
    });
  }
}

function sendLog(kind: 'stdout' | 'stderr' | 'system', message: string): void {
  mainWindow?.webContents.send('studio:log', { kind, message });
}

function resolveCliEntrypoint(): string {
  const configured = process.env.DEPLOID_CLI_PATH;
  const resolved = configured ? resolve(configured) : require.resolve('@deploid/cli');
  if (app.isPackaged) {
    const unpacked = resolved.replace(`${join('app.asar', '')}`, `${join('app.asar.unpacked', '')}`);
    if (fs.existsSync(unpacked)) return unpacked;
  }
  return resolved;
}

function cliEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    FORCE_COLOR: '1'
  };
}

function parseCommand(input: string): string[] {
  const args: string[] = [];
  const matcher = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  for (const match of input.trim().matchAll(matcher)) {
    args.push(match[1] ?? match[2] ?? match[3]);
  }
  return args;
}

ipcMain.handle('studio:choose-project', async (_event, payload: { cwd?: string } = {}) => {
  const dialogOptions: OpenDialogOptions = {
    defaultPath: payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : getLaunchCwd(),
    properties: ['openDirectory']
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

ipcMain.handle('studio:get-default-cwd', () => getLaunchCwd());

ipcMain.handle('studio:get-project-overview', (_event, payload: { cwd: string }) => {
  if (!payload.cwd) throw new Error('Project folder is required');
  return loadProjectOverview(payload.cwd);
});

ipcMain.handle('studio:reveal-artifact', async (_event, payload: { cwd: string; path: string }) => {
  const root = resolve(payload.cwd);
  const target = resolve(payload.path);
  const relation = relative(root, target);
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) {
    if (target !== root) throw new Error('Artifact must be inside the selected project');
  }
  if (!fs.existsSync(target)) throw new Error('Artifact no longer exists');
  shell.showItemInFolder(target);
  return { revealed: true };
});

ipcMain.handle('studio:run-command', async (_event, payload: { cwd: string; command: string }) => {
  if (activeProcess) throw new Error('A command is already running');
  if (!payload.cwd) throw new Error('Project folder is required');

  const args = parseCommand(payload.command);
  if (!args.length) throw new Error('Command is required');
  if (!ALLOWED_COMMANDS.has(args[0])) throw new Error(`Unsupported command: ${args[0]}`);

  const cliEntrypoint = resolveCliEntrypoint();
  sendLog('system', `$ deploid ${args.join(' ')}\n`);
  activeProcess = spawn(process.execPath, [cliEntrypoint, ...args], {
    cwd: payload.cwd,
    env: cliEnvironment()
  });
  mainWindow?.webContents.send('studio:state', { running: true, command: payload.command });

  activeProcess.stdout.on('data', (chunk) => sendLog('stdout', String(chunk)));
  activeProcess.stderr.on('data', (chunk) => sendLog('stderr', String(chunk)));

  return await new Promise<{ code: number | null }>((done) => {
    activeProcess?.on('error', (error) => sendLog('stderr', `${error.message}\n`));
    activeProcess?.on('close', (code) => {
      sendLog('system', `Process exited with code ${String(code)}\n`);
      activeProcess = null;
      mainWindow?.webContents.send('studio:state', { running: false, command: payload.command, code });
      done({ code });
    });
  });
});

ipcMain.handle('studio:stop-command', () => {
  if (!activeProcess) return { stopped: false };
  activeProcess.kill('SIGINT');
  return { stopped: true };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function loadProjectOverview(cwd: string) {
  const projectRoot = resolve(cwd);
  if (!fs.existsSync(projectRoot)) throw new Error('Project folder does not exist');
  const packageJson = readJson(join(projectRoot, 'package.json'));
  const doctor = getDoctorReport(projectRoot);
  const projectName = packageJson?.productName || packageJson?.name || basename(projectRoot);

  return {
    projectName,
    version: packageJson?.version || null,
    cwd: projectRoot,
    doctor,
    artifacts: findArtifacts(projectRoot),
    devices: getConnectedDevices(),
    presence: {
      config: hasAnyFile(projectRoot, ['deploid.config.ts', 'deploid.config.js', 'deploid.config.mjs', 'deploid.config.cjs']),
      capacitor: hasAnyFile(projectRoot, ['capacitor.config.ts', 'capacitor.config.json']),
      android: fs.existsSync(join(projectRoot, 'android')),
      electron: fs.existsSync(join(projectRoot, 'electron')) || fs.existsSync(join(projectRoot, 'dist-electron'))
    }
  };
}

function getLaunchCwd(): string {
  const candidate = process.env.DEPLOID_STUDIO_LAUNCH_CWD || process.cwd();
  return candidate && fs.existsSync(candidate) ? candidate : app.getPath('home');
}

function getDoctorReport(cwd: string) {
  const result = spawnSync(process.execPath, [resolveCliEntrypoint(), 'doctor', '--json', '--summary'], {
    cwd,
    env: cliEnvironment(),
    encoding: 'utf8',
    timeout: 30_000
  });
  if (!result.stdout?.trim()) return null;
  try {
    return JSON.parse(stripAnsi(result.stdout));
  } catch {
    return null;
  }
}

function findArtifacts(cwd: string) {
  const candidates = [
    { label: 'Debug APK', type: 'android', path: join(cwd, 'android/app/build/outputs/apk/debug/app-debug.apk') },
    { label: 'Release APK', type: 'android', path: join(cwd, 'android/app/build/outputs/apk/release/app-release.apk') },
    { label: 'Release AAB', type: 'android', path: join(cwd, 'android/app/build/outputs/bundle/release/app-release.aab') },
    { label: 'Desktop output', type: 'desktop', path: join(cwd, 'dist-electron') }
  ];
  return candidates.filter(({ path }) => fs.existsSync(path)).map((artifact) => ({
    ...artifact,
    size: formatSize(fs.statSync(artifact.path).size)
  }));
}

function getConnectedDevices() {
  const version = spawnSync('adb', ['version'], { encoding: 'utf8' });
  if (version.status !== 0) return { available: false, count: 0, entries: [] as Array<{ id: string; status: string }> };
  const devices = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  const entries = `${devices.stdout || ''}`.split('\n').filter((line) => /\t/.test(line)).map((line) => {
    const [id, status] = line.split('\t');
    return { id, status: status || 'unknown' };
  });
  return { available: true, count: entries.length, entries };
}

function readJson(filePath: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
  } catch {
    return null;
  }
}

function hasAnyFile(cwd: string, filenames: string[]): boolean {
  return filenames.some((filename) => fs.existsSync(join(cwd, filename)));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}
