import fs from 'node:fs';
import path from 'node:path';
import type { DeploidConfig } from './types.js';

export type ArtifactKind = 'android-debug-apk' | 'android-release-apk' | 'android-release-aab' | 'assets' | 'desktop';

export interface ArtifactRecord {
  kind: ArtifactKind;
  label: string;
  path: string;
  exists: boolean;
  isDirectory: boolean;
  sizeBytes: number;
}

export function inspectArtifacts(cwd: string, config?: Pick<DeploidConfig, 'assets'>): ArtifactRecord[] {
  const assetsOutput = config?.assets?.output || 'assets-gen';
  return [
    makeArtifactRecord('android-debug-apk', 'Debug APK', path.join(cwd, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')),
    makeArtifactRecord('android-release-apk', 'Release APK', path.join(cwd, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')),
    makeArtifactRecord('android-release-aab', 'Release AAB', path.join(cwd, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')),
    makeArtifactRecord('assets', 'Generated assets', path.join(cwd, assetsOutput)),
    makeArtifactRecord('desktop', 'Desktop output', path.join(cwd, 'dist-electron'))
  ];
}

function makeArtifactRecord(kind: ArtifactKind, label: string, targetPath: string): ArtifactRecord {
  const exists = fs.existsSync(targetPath);
  const stats = exists ? fs.statSync(targetPath) : null;
  return {
    kind,
    label,
    path: targetPath,
    exists,
    isDirectory: Boolean(stats?.isDirectory()),
    sizeBytes: stats ? measureSize(targetPath, stats.isDirectory()) : 0
  };
}

function measureSize(targetPath: string, isDirectory: boolean): number {
  if (!isDirectory) {
    return fs.statSync(targetPath).size;
  }

  let total = 0;
  for (const entry of fs.readdirSync(targetPath)) {
    const childPath = path.join(targetPath, entry);
    const childStats = fs.statSync(childPath);
    total += childStats.isDirectory() ? measureSize(childPath, true) : childStats.size;
  }
  return total;
}
