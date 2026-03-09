import { spawnSync } from 'node:child_process';

export interface AndroidDeviceRecord {
  id: string;
  state: string;
}

export function listAndroidDevices(): AndroidDeviceRecord[] {
  const result = spawnSync('adb', ['devices'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    const reason = (result.stderr || '').trim() || 'adb devices failed';
    throw new Error(reason);
  }

  return (result.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices'))
    .map((line) => {
      const [id, state = 'unknown'] = line.split('\t');
      return { id, state };
    });
}
