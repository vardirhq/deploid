import fs from 'node:fs';
import path from 'node:path';

type ArtifactKind = 'android-debug-apk' | 'android-release-apk' | 'android-release-aab' | 'assets' | 'desktop';

interface ArtifactCommandOptions {
  action?: 'list' | 'inspect' | 'clean';
  kind?: ArtifactKind | 'all';
  json?: boolean;
  dryRun?: boolean;
}

interface PipelineContext {
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  config: {
    assets?: { output?: string };
  };
  cwd: string;
  artifactOptions?: ArtifactCommandOptions;
}

interface ArtifactRecord {
  kind: ArtifactKind;
  label: string;
  path: string;
  exists: boolean;
  isDirectory: boolean;
  sizeBytes: number;
}

const plugin = {
  name: 'artifacts',
  plan: () => [
    'Discover generated Android, desktop, and asset outputs',
    'List or inspect artifact metadata',
    'Clean generated outputs when explicitly requested'
  ],
  run: runArtifacts
};

async function runArtifacts(ctx: PipelineContext): Promise<void> {
  const options = withDefaults(ctx.artifactOptions);
  const records = findArtifacts(ctx.cwd, ctx.config);
  const filtered = records.filter((record) => options.kind === 'all' || record.kind === options.kind);

  if (options.action === 'list') {
    renderList(filtered, options.json);
    return;
  }

  if (options.action === 'inspect') {
    renderInspect(filtered, options.json);
    return;
  }

  const targets = filtered.filter((record) => record.exists);
  if (options.dryRun) {
    if (options.json) {
      console.log(JSON.stringify({ action: 'clean', targets }, null, 2));
    } else {
      ctx.logger.info(`artifact clean dry-run: ${targets.length} target(s)`);
      for (const target of targets) {
        ctx.logger.info(`- ${target.label}: ${path.relative(ctx.cwd, target.path)}`);
      }
    }
    return;
  }

  if (targets.length === 0) {
    ctx.logger.info('No matching artifacts to clean.');
    return;
  }

  for (const target of targets) {
    fs.rmSync(target.path, { recursive: true, force: true });
  }
  ctx.logger.info(`Removed ${targets.length} artifact target(s).`);
}

function withDefaults(options: ArtifactCommandOptions | undefined): Required<ArtifactCommandOptions> {
  return {
    action: options?.action || 'list',
    kind: options?.kind || 'all',
    json: Boolean(options?.json),
    dryRun: Boolean(options?.dryRun)
  };
}

function findArtifacts(cwd: string, config: PipelineContext['config']): ArtifactRecord[] {
  const assetsOutput = config.assets?.output || 'assets-gen';
  return [
    makeRecord('android-debug-apk', 'Debug APK', path.join(cwd, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')),
    makeRecord('android-release-apk', 'Release APK', path.join(cwd, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')),
    makeRecord('android-release-aab', 'Release AAB', path.join(cwd, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')),
    makeRecord('assets', 'Generated assets', path.join(cwd, assetsOutput)),
    makeRecord('desktop', 'Desktop output', path.join(cwd, 'dist-electron'))
  ];
}

function makeRecord(kind: ArtifactKind, label: string, targetPath: string): ArtifactRecord {
  const exists = fs.existsSync(targetPath);
  const stats = exists ? fs.statSync(targetPath) : null;
  return {
    kind,
    label,
    path: targetPath,
    exists,
    isDirectory: Boolean(stats?.isDirectory()),
    sizeBytes: stats ? sizeOf(targetPath, stats.isDirectory()) : 0
  };
}

function sizeOf(targetPath: string, isDirectory: boolean): number {
  if (!isDirectory) {
    return fs.statSync(targetPath).size;
  }
  let total = 0;
  for (const entry of fs.readdirSync(targetPath)) {
    const childPath = path.join(targetPath, entry);
    const stats = fs.statSync(childPath);
    total += stats.isDirectory() ? sizeOf(childPath, true) : stats.size;
  }
  return total;
}

function renderList(records: ArtifactRecord[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ artifacts: records }, null, 2));
    return;
  }

  console.log('Deploid Artifacts');
  for (const record of records) {
    const status = record.exists ? 'FOUND' : 'MISS ';
    console.log(`${status} ${record.label.padEnd(18, ' ')} ${formatBytes(record.sizeBytes).padStart(8, ' ')}  ${record.path}`);
  }
}

function renderInspect(records: ArtifactRecord[], json: boolean): void {
  const existing = records.filter((record) => record.exists);
  if (json) {
    console.log(JSON.stringify({ artifacts: existing }, null, 2));
    return;
  }

  console.log('Artifact Details');
  for (const record of existing) {
    console.log(`${record.label}`);
    console.log(`  kind: ${record.kind}`);
    console.log(`  path: ${record.path}`);
    console.log(`  type: ${record.isDirectory ? 'directory' : 'file'}`);
    console.log(`  size: ${formatBytes(record.sizeBytes)} (${record.sizeBytes} bytes)`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default plugin;
export { plugin };
