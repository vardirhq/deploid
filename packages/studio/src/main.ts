import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
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
  'plugin'
]);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(join(__dirname, 'renderer', 'index.html'));
}

function sendLog(kind: 'stdout' | 'stderr' | 'system', message: string): void {
  if (!mainWindow) return;
  mainWindow.webContents.send('studio:log', { kind, message });
}

function resolveCliEntrypoint(): string {
  return require.resolve('@deploid/cli/dist/index.js');
}

function parseCommand(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

ipcMain.handle('studio:choose-project', async (_event, payload: { cwd?: string } = {}) => {
  const dialogOptions: OpenDialogOptions = {
    defaultPath: payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : getLaunchCwd(),
    properties: ['openDirectory']
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('studio:get-default-cwd', async () => {
  return getLaunchCwd();
});

ipcMain.handle('studio:get-doctor-report', async (_event, payload: { cwd: string }) => {
  if (!payload.cwd) {
    throw new Error('Project folder is required');
  }

  const cliEntrypoint = resolveCliEntrypoint();
  const result = spawnSync(process.execPath, [cliEntrypoint, 'doctor', '--json', '--summary'], {
    cwd: payload.cwd,
    env: process.env,
    encoding: 'utf8'
  });

  if (!result.stdout?.trim()) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
});

ipcMain.handle('studio:get-project-overview', async (_event, payload: { cwd: string }) => {
  if (!payload.cwd) {
    throw new Error('Project folder is required');
  }

  return loadProjectOverview(payload.cwd);
});

ipcMain.handle('studio:run-command', async (_event, payload: { cwd: string; command: string }) => {
  if (activeProcess) {
    throw new Error('A command is already running');
  }
  if (!payload.cwd) {
    throw new Error('Project folder is required');
  }

  const args = parseCommand(payload.command);
  if (args.length === 0) {
    throw new Error('Command is required');
  }
  if (!ALLOWED_COMMANDS.has(args[0])) {
    throw new Error(`Unsupported command: ${args[0]}`);
  }

  const cliEntrypoint = resolveCliEntrypoint();
  sendLog('system', `$ deploid ${args.join(' ')}\n`);

  activeProcess = spawn(process.execPath, [cliEntrypoint, ...args], {
    cwd: payload.cwd,
    env: process.env
  });

  mainWindow?.webContents.send('studio:state', { running: true });

  activeProcess.stdout.on('data', (chunk) => {
    sendLog('stdout', String(chunk));
  });
  activeProcess.stderr.on('data', (chunk) => {
    sendLog('stderr', String(chunk));
  });

  return await new Promise<{ code: number | null }>((resolve) => {
    activeProcess?.on('close', (code) => {
      sendLog('system', `\nProcess exited with code ${String(code)}\n`);
      activeProcess = null;
      mainWindow?.webContents.send('studio:state', { running: false });
      resolve({ code });
    });
  });
});

ipcMain.handle('studio:stop-command', async () => {
  if (!activeProcess) {
    return { stopped: false };
  }
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
  const doctor = getDoctorReport(cwd);
  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = readJson(packageJsonPath);
  const projectName =
    packageJson?.productName ||
    packageJson?.name ||
    basename(cwd);

  return {
    projectName,
    cwd,
    doctor,
    artifacts: findArtifacts(cwd),
    devices: getConnectedDevices(),
    presence: {
      config: hasAnyFile(cwd, ['deploid.config.ts', 'deploid.config.js', 'deploid.config.mjs', 'deploid.config.cjs']),
      capacitor: fs.existsSync(join(cwd, 'capacitor.config.json')),
      android: fs.existsSync(join(cwd, 'android')),
      electron: fs.existsSync(join(cwd, 'electron'))
    }
  };
}

function getLaunchCwd(): string {
  const candidate = process.env.DEPLOID_STUDIO_LAUNCH_CWD || process.cwd();
  if (candidate && fs.existsSync(candidate)) {
    return candidate;
  }
  return process.cwd();
}

function getDoctorReport(cwd: string) {
  const cliEntrypoint = resolveCliEntrypoint();
  const result = spawnSync(process.execPath, [cliEntrypoint, 'doctor', '--json', '--summary'], {
    cwd,
    env: process.env,
    encoding: 'utf8'
  });

  if (!result.stdout?.trim()) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
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

  return candidates
    .filter((candidate) => fs.existsSync(candidate.path))
    .map((candidate) => ({
      ...candidate,
      size: formatSize(fs.statSync(candidate.path).size),
      path: candidate.path
    }));
}

function getConnectedDevices() {
  const version = spawnSync('adb', ['version'], { encoding: 'utf8' });
  if (version.status !== 0) {
    return { available: false, count: 0, entries: [] as Array<{ id: string; status: string }> };
  }

  const devices = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  const entries = `${devices.stdout || ''}`
    .split('\n')
    .filter((line) => /\t/.test(line))
    .map((line) => {
      const [id, status] = line.split('\t');
      return { id, status: status || 'unknown' };
    });

  return {
    available: true,
    count: entries.length,
    entries
  };
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
