import fs from 'node:fs';
import path from 'node:path';

interface VersionOptions {
  version?: string;
  major?: boolean;
  minor?: boolean;
  patch?: boolean;
  code?: number;
  syncPackage?: boolean;
  notesFile?: string;
  dryRun?: boolean;
  json?: boolean;
}

interface PipelineContext {
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  config: {
    appName: string;
    android: {
      version?: { code?: number; name?: string };
    };
  };
  cwd: string;
  versionOptions?: VersionOptions;
}

interface VersionPlan {
  configPath: string;
  packageJsonPath: string | null;
  notesPath: string;
  previousVersionName: string;
  nextVersionName: string;
  previousCode: number;
  nextCode: number;
  syncPackage: boolean;
}

const CONFIG_CANDIDATES = ['deploid.config.ts', 'deploid.config.js', 'deploid.config.mjs', 'deploid.config.cjs'];

const plugin = {
  name: 'version',
  plan: () => [
    'Resolve the next semantic version and Android versionCode',
    'Sync package.json and deploid.config.* version metadata',
    'Create or update release notes scaffold'
  ],
  run: runVersion
};

async function runVersion(ctx: PipelineContext): Promise<void> {
  const plan = buildPlan(ctx);

  if (ctx.versionOptions?.dryRun) {
    if (ctx.versionOptions?.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      ctx.logger.info(`version dry-run: ${plan.previousVersionName} (${plan.previousCode}) -> ${plan.nextVersionName} (${plan.nextCode})`);
      if (plan.syncPackage && plan.packageJsonPath) {
        ctx.logger.info(`package.json: ${path.relative(ctx.cwd, plan.packageJsonPath)}`);
      }
      ctx.logger.info(`config: ${path.relative(ctx.cwd, plan.configPath)}`);
      ctx.logger.info(`release notes: ${path.relative(ctx.cwd, plan.notesPath)}`);
      ctx.logger.info(`tag suggestion: v${plan.nextVersionName}`);
    }
    return;
  }

  updateConfigVersion(plan.configPath, plan.nextVersionName, plan.nextCode);
  if (plan.syncPackage && plan.packageJsonPath) {
    updatePackageJsonVersion(plan.packageJsonPath, plan.nextVersionName);
  }
  updateReleaseNotes(plan.notesPath, ctx.config.appName, plan.nextVersionName, plan.nextCode);

  ctx.logger.info(`Updated version to ${plan.nextVersionName} (${plan.nextCode}).`);
  if (plan.syncPackage && plan.packageJsonPath) {
    ctx.logger.info(`Synced package.json version to ${plan.nextVersionName}.`);
  }
  ctx.logger.info(`Release notes scaffold ready: ${path.relative(ctx.cwd, plan.notesPath)}`);
  ctx.logger.info(`Suggested tag: v${plan.nextVersionName}`);
}

function buildPlan(ctx: PipelineContext): VersionPlan {
  const options = ctx.versionOptions || {};
  const configPath = findConfigPath(ctx.cwd);
  if (!configPath) {
    throw new Error('No Deploid config file found. Run "deploid init" first.');
  }

  const packageJsonPath = path.join(ctx.cwd, 'package.json');
  const hasPackageJson = fs.existsSync(packageJsonPath);
  const syncPackage = options.syncPackage !== false && hasPackageJson;
  const previousVersionName = ctx.config.android.version?.name || readPackageVersion(packageJsonPath) || '1.0.0';
  const previousCode = ctx.config.android.version?.code || 1;
  const nextVersionName = resolveNextVersion(previousVersionName, options);
  const nextCode = resolveNextCode(previousCode, options, nextVersionName !== previousVersionName);
  const notesPath = path.join(ctx.cwd, options.notesFile || 'RELEASE_NOTES.md');

  return {
    configPath,
    packageJsonPath: hasPackageJson ? packageJsonPath : null,
    notesPath,
    previousVersionName,
    nextVersionName,
    previousCode,
    nextCode,
    syncPackage
  };
}

function readPackageVersion(packageJsonPath: string): string | null {
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return pkg.version || null;
  } catch {
    return null;
  }
}

function resolveNextVersion(current: string, options: VersionOptions): string {
  if (options.version) {
    assertSemver(options.version);
    return options.version;
  }

  const bumpFlags = [options.major, options.minor, options.patch].filter(Boolean).length;
  if (bumpFlags > 1) {
    throw new Error('Choose only one of --major, --minor, or --patch.');
  }

  if (options.major) return bumpVersion(current, 'major');
  if (options.minor) return bumpVersion(current, 'minor');
  if (options.patch || bumpFlags === 0) return bumpVersion(current, 'patch');
  return current;
}

function resolveNextCode(currentCode: number, options: VersionOptions, versionChanged: boolean): number {
  if (typeof options.code === 'number') {
    if (options.code < 1) {
      throw new Error('Android versionCode must be >= 1.');
    }
    return options.code;
  }
  return versionChanged ? currentCode + 1 : currentCode;
}

function assertSemver(version: string): void {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version "${version}". Expected semver like 1.2.3 or 1.2.3-beta.1.`);
  }
}

function bumpVersion(current: string, kind: 'major' | 'minor' | 'patch'): string {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
  if (!match) {
    throw new Error(`Cannot bump non-semver version "${current}". Pass an explicit version instead.`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (kind === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function findConfigPath(cwd: string): string | null {
  for (const candidate of CONFIG_CANDIDATES) {
    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function updateConfigVersion(configPath: string, versionName: string, versionCode: number): void {
  const source = fs.readFileSync(configPath, 'utf8');
  const updated = replaceVersionBlock(source, versionName, versionCode);
  fs.writeFileSync(configPath, updated);
}

function replaceVersionBlock(source: string, versionName: string, versionCode: number): string {
  const versionPattern = /version\s*:\s*\{[\s\S]*?code\s*:\s*\d+[\s\S]*?name\s*:\s*['"`][^'"`]+['"`][\s\S]*?\}/m;
  const replacement = `version: {\n      code: ${versionCode},\n      name: '${versionName}'\n    }`;

  if (versionPattern.test(source)) {
    return source.replace(versionPattern, replacement);
  }

  const androidPattern = /android\s*:\s*\{/m;
  const match = androidPattern.exec(source);
  if (!match || typeof match.index !== 'number') {
    throw new Error('Unable to find android config block to update version.');
  }

  const openBraceIndex = source.indexOf('{', match.index);
  const insertIndex = openBraceIndex + 1;
  return `${source.slice(0, insertIndex)}\n    ${replacement},${source.slice(insertIndex)}`;
}

function updatePackageJsonVersion(packageJsonPath: string, versionName: string): void {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>;
  pkg.version = versionName;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function updateReleaseNotes(notesPath: string, appName: string, versionName: string, versionCode: number): void {
  const content = `# ${appName} ${versionName}\n\n- Android versionCode: ${versionCode}\n- Release date: ${new Date().toISOString().slice(0, 10)}\n\n## Highlights\n\n- \n\n## Fixes\n\n- \n`;
  if (!fs.existsSync(notesPath)) {
    fs.writeFileSync(notesPath, content);
    return;
  }

  const existing = fs.readFileSync(notesPath, 'utf8');
  if (existing.includes(`# ${appName} ${versionName}`)) {
    return;
  }
  fs.writeFileSync(notesPath, `${content}\n${existing}`);
}

export default plugin;
export { plugin };
