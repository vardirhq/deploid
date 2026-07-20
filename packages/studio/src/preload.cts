import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('deploidStudio', {
  getDefaultCwd: () => ipcRenderer.invoke('studio:get-default-cwd') as Promise<string>,
  getProjectOverview: (cwd: string) => ipcRenderer.invoke('studio:get-project-overview', { cwd }) as Promise<any>,
  chooseProject: (cwd?: string) => ipcRenderer.invoke('studio:choose-project', { cwd }) as Promise<string | null>,
  revealArtifact: (cwd: string, path: string) =>
    ipcRenderer.invoke('studio:reveal-artifact', { cwd, path }) as Promise<{ revealed: boolean }>,
  runCommand: (cwd: string, command: string) =>
    ipcRenderer.invoke('studio:run-command', { cwd, command }) as Promise<{ code: number | null }>,
  stopCommand: () => ipcRenderer.invoke('studio:stop-command') as Promise<{ stopped: boolean }>,
  onLog: (cb: (entry: { kind: 'stdout' | 'stderr' | 'system'; message: string }) => void) =>
    ipcRenderer.on('studio:log', (_event, payload) => cb(payload)),
  onState: (cb: (state: { running: boolean; command?: string; code?: number | null }) => void) =>
    ipcRenderer.on('studio:state', (_event, payload) => cb(payload))
});
