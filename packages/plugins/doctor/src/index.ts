import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type CheckStatus = 'pass' | 'warn' | 'fail';
type CheckCategory = 'project' | 'workflows' | 'tooling' | 'plugins' | 'release';
type WorkflowId = 'init' | 'build' | 'release' | 'deploy' | 'desktop';
type FixStatus = 'applied' | 'skipped' | 'failed';

interface CheckResult {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  message: string;
  details?: string;
  workflows: WorkflowId[];
  fixable?: boolean;
}

interface WorkflowReadiness {
  id: WorkflowId;
  title: string;
  status: CheckStatus;
  score: number;
  totals: Record<CheckStatus, number>;
  nextAction?: string;
}

interface FixResult {
  id: string;
  title: string;
  status: FixStatus;
  message: string;
}

interface DoctorSummary {
  ok: boolean;
  cwd: string;
  checks: CheckResult[];
  totals: Record<CheckStatus, number>;
  workflows: WorkflowReadiness[];
  fixes: FixResult[];
}

interface DoctorOptions {
  json?: boolean;
  markdown?: boolean;
  ci?: boolean;
  summary?: boolean;
  verbose?: boolean;
  projectOnly?: boolean;
  fix?: boolean;
}

interface DeploidConfigShape {
  appName?: string;
  appId?: string;
  web?: { framework?: string; buildCommand?: string; webDir?: string };
  android?: {
    packaging?: string;
    signing?: {
      keystorePath?: string;
      alias?: string;
      storePasswordEnv?: string;
      keyPasswordEnv?: string;
    };
    version?: { code?: number; name?: string };
    build?: { buildType?: 'apk' | 'aab' | 'both' };
  };
  assets?: { source?: string; output?: string };
  publish?: {
    play?: { track?: string; serviceAccountJson?: string };
    github?: { repo?: string; draft?: boolean };
  };
  plugins?: string[];
}

interface PipelineContext {
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  debug?: boolean;
  config: {
    appName: string;
    appId: string;
    web: { framework: string; buildCommand: string; webDir: string };
    android: { packaging: string };
  };
  cwd: string;
  doctorOptions?: DoctorOptions;
}

interface ProjectState {
  cwd: string;
  packageJsonPath: string;
  packageJson: Record<string, unknown> | null;
  configPath: string | null;
  config: DeploidConfigShape | null;
  capacitorConfigPath: string;
  capacitorConfig: Record<string, unknown> | null;
  androidDir: string;
  androidBuildGradlePath: string;
  packageDeps: Record<string, unknown>;
  packageScripts: Record<string, unknown>;
}

const CONFIG_CANDIDATES = ['deploid.config.ts', 'deploid.config.js', 'deploid.config.mjs', 'deploid.config.cjs'];
const WORKFLOW_TITLES: Record<WorkflowId, string> = {
  init: 'Project setup',
  build: 'Android build',
  release: 'Release readiness',
  deploy: 'Device deploy',
  desktop: 'Desktop packaging'
};

const plugin = {
  name: 'doctor',
  plan: () => [
    'Inspect project files and config consistency',
    'Assess workflow readiness for setup, build, release, deploy, and desktop packaging',
    'Offer machine-readable output and safe auto-fixes'
  ],
  run: runDoctor
};

async function runDoctor(ctx: PipelineContext): Promise<void> {
  const options = ctx.doctorOptions ?? {};
  const summary = await inspectProject(ctx.cwd, options);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (options.markdown) {
    console.log(renderMarkdown(summary, options));
  } else if (options.ci) {
    console.log(renderCi(summary));
  } else {
    printSummary(summary, options);
  }

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

async function inspectProject(cwd: string, options: DoctorOptions = {}): Promise<DoctorSummary> {
  const state = await loadProjectState(cwd);
  const checks: CheckResult[] = [];
  const fixes: FixResult[] = [];

  checks.push(...collectProjectChecks(state));

  if (state.config) {
    checks.push(...collectConfigChecks(state));
    checks.push(...collectConsistencyChecks(state));
    checks.push(...collectReleaseChecks(state));
    checks.push(...collectPluginChecks(state));
  } else {
    checks.push(
      warn('web-output', 'Web output directory', 'Skipped because no Deploid config was loaded.', ['init', 'build']),
      warn('assets-source', 'Asset source', 'Skipped because no Deploid config was loaded.', ['init'], undefined, true),
      warn('android-signing', 'Android signing', 'Skipped because no Deploid config was loaded.', ['release']),
      warn('capacitor-config', 'Capacitor config', 'Skipped because no Deploid config was loaded.', ['build'], undefined, true),
      warn('android-project', 'Android project', 'Skipped because no Deploid config was loaded.', ['build', 'deploy']),
      warn('versioning', 'Version metadata', 'Skipped because no Deploid config was loaded.', ['release']),
      warn('publish-config', 'Publish config', 'Skipped because no Deploid config was loaded.', ['release']),
      warn('plugin-state', 'Plugin surface', 'Skipped because no Deploid config was loaded.', ['init', 'desktop'])
    );
  }

  if (!options.projectOnly) {
    checks.push(...collectToolingChecks(state));
  }

  if (options.fix) {
    fixes.push(...applyFixes(state, checks));
    if (fixes.some((fix) => fix.status === 'applied')) {
      const refreshed = await inspectProject(cwd, { ...options, fix: false });
      return { ...refreshed, fixes };
    }
  }

  const totals = countStatuses(checks);
  const workflows = buildWorkflowReadiness(checks);

  return {
    ok: totals.fail === 0,
    cwd,
    checks,
    totals,
    workflows,
    fixes
  };
}

async function loadProjectState(cwd: string): Promise<ProjectState> {
  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJson = readJson<Record<string, unknown>>(packageJsonPath);
  const configPath = findExistingPath(cwd, CONFIG_CANDIDATES);
  const config = configPath ? await loadProjectConfig(configPath) : null;
  const capacitorConfigPath = path.join(cwd, 'capacitor.config.json');
  const capacitorConfig = readJson<Record<string, unknown>>(capacitorConfigPath);

  return {
    cwd,
    packageJsonPath,
    packageJson,
    configPath,
    config,
    capacitorConfigPath,
    capacitorConfig,
    androidDir: path.join(cwd, 'android'),
    androidBuildGradlePath: path.join(cwd, 'android', 'app', 'build.gradle'),
    packageDeps: {
      ...(asRecord(packageJson?.dependencies)),
      ...(asRecord(packageJson?.devDependencies))
    },
    packageScripts: asRecord(packageJson?.scripts)
  };
}

function collectProjectChecks(state: ProjectState): CheckResult[] {
  return [
    fs.existsSync(state.packageJsonPath)
      ? pass('package-json', 'package.json', 'Found package.json in project root.', ['init'])
      : fail('package-json', 'package.json', 'package.json is missing from the project root.', ['init']),
    state.configPath
      ? pass('deploid-config', 'Deploid config', `Found ${path.basename(state.configPath)}.`, ['init', 'build', 'release'])
      : fail('deploid-config', 'Deploid config', 'No Deploid config file was found.', ['init', 'build', 'release'])
  ];
}

function collectConfigChecks(state: ProjectState): CheckResult[] {
  const config = state.config;
  const checks: CheckResult[] = [];
  checks.push(checkBuildCommand(state));
  checks.push(checkWebDir(state));
  checks.push(checkAssetsSource(state));
  checks.push(checkCapacitorConfig(state));
  checks.push(checkAndroidProject(state));
  checks.push(checkSigning(state));
  checks.push(checkVersioning(state));
  return checks;
}

function collectConsistencyChecks(state: ProjectState): CheckResult[] {
  const checks: CheckResult[] = [];
  const config = state.config;
  const capacitorConfig = state.capacitorConfig;

  if (config?.android?.packaging === 'capacitor' && capacitorConfig) {
    const mismatches: string[] = [];
    if (capacitorConfig.appId && capacitorConfig.appId !== config.appId) mismatches.push(`appId=${String(capacitorConfig.appId)}`);
    if (capacitorConfig.appName && capacitorConfig.appName !== config.appName) mismatches.push(`appName=${String(capacitorConfig.appName)}`);
    if (capacitorConfig.webDir && capacitorConfig.webDir !== config.web?.webDir) mismatches.push(`webDir=${String(capacitorConfig.webDir)}`);

    checks.push(
      mismatches.length === 0
        ? pass('capacitor-sync', 'Capacitor sync', 'Capacitor metadata matches Deploid config.', ['build', 'release'])
        : warn(
            'capacitor-sync',
            'Capacitor sync',
            `Capacitor metadata differs from Deploid config (${mismatches.join(', ')}).`,
            ['build', 'release'],
            'Run `deploid package` to resync generated native metadata.',
            true
          )
    );
  }

  const packageBuild = asRecord(state.packageJson?.build);
  if (Object.keys(packageBuild).length > 0 && config) {
    const mismatches: string[] = [];
    if (packageBuild.appId && packageBuild.appId !== config.appId) mismatches.push('build.appId');
    if (packageBuild.productName && packageBuild.productName !== config.appName) mismatches.push('build.productName');
    checks.push(
      mismatches.length === 0
        ? pass('package-build-meta', 'Package metadata', 'package.json build metadata matches config.', ['desktop', 'release'])
        : warn(
            'package-build-meta',
            'Package metadata',
            `package.json metadata differs from config (${mismatches.join(', ')}).`,
            ['desktop', 'release'],
            'Align package.json and deploid.config.ts to avoid release drift.'
          )
    );
  }

  if (fs.existsSync(state.androidBuildGradlePath) && config?.appId) {
    const buildGradle = safeRead(state.androidBuildGradlePath);
    const appIdMatch = buildGradle.match(/applicationId\s+"([^"]+)"/);
    if (appIdMatch?.[1] === config.appId) {
      checks.push(pass('android-app-id', 'Android appId', 'Gradle applicationId matches config.', ['build', 'release']));
    } else if (appIdMatch?.[1]) {
      checks.push(
        warn(
          'android-app-id',
          'Android appId',
          `Gradle applicationId is ${appIdMatch[1]} but config uses ${config.appId}.`,
          ['build', 'release'],
          'Run `deploid package` before your next build.'
        )
      );
    }
  }

  return checks;
}

function collectReleaseChecks(state: ProjectState): CheckResult[] {
  const config = state.config;
  if (!config) return [];

  const checks: CheckResult[] = [];
  const playConfig = config.publish?.play;
  const githubConfig = config.publish?.github;

  if (playConfig?.serviceAccountJson) {
    const fullPath = path.join(state.cwd, playConfig.serviceAccountJson);
    checks.push(
      fs.existsSync(fullPath)
        ? pass('play-service-account', 'Play credentials', `Found ${playConfig.serviceAccountJson}.`, ['release'])
        : fail(
            'play-service-account',
            'Play credentials',
            `${playConfig.serviceAccountJson} does not exist.`,
            ['release'],
            'Add the Play service account JSON before automating Play uploads.'
          )
    );
  } else {
    checks.push(warn('play-service-account', 'Play credentials', 'No Play service account configured.', ['release'], undefined, true));
  }

  checks.push(
    githubConfig?.repo
      ? pass('github-release', 'GitHub release target', `Configured for ${githubConfig.repo}.`, ['release'])
      : warn('github-release', 'GitHub release target', 'No GitHub release repo configured.', ['release'], undefined, true)
  );

  return checks;
}

function collectPluginChecks(state: ProjectState): CheckResult[] {
  const checks: CheckResult[] = [];
  const config = state.config;
  const deps = state.packageDeps;
  const hasElectronFiles = fs.existsSync(path.join(state.cwd, 'electron'));
  const hasDesktopScripts = ['electron:build', 'electron:build:win', 'electron:build:mac'].some((key) => typeof state.packageScripts[key] === 'string');
  const usesCapacitor = config?.android?.packaging === 'capacitor';

  if (usesCapacitor) {
    checks.push(
      typeof deps['@capacitor/core'] === 'string' && typeof deps['@capacitor/cli'] === 'string'
        ? pass('capacitor-dependency', 'Capacitor packages', 'Capacitor dependencies are present.', ['build', 'deploy'])
        : warn(
            'capacitor-dependency',
            'Capacitor packages',
            'Capacitor dependencies are incomplete in package.json.',
            ['build', 'deploy'],
            'Install @capacitor/core and @capacitor/cli in the app project.'
          )
    );
  }

  if (hasElectronFiles || hasDesktopScripts) {
    checks.push(
      typeof deps.electron === 'string' && typeof deps['electron-builder'] === 'string'
        ? pass('electron-dependency', 'Electron packages', 'Electron dependencies are present.', ['desktop'])
        : warn(
            'electron-dependency',
            'Electron packages',
            'Desktop packaging files exist but Electron dependencies are incomplete.',
            ['desktop'],
            'Run `deploid electron` or install electron and electron-builder.'
          )
    );
  } else {
    checks.push(warn('electron-dependency', 'Electron packages', 'Desktop packaging is not configured.', ['desktop']));
  }

  return checks;
}

function collectToolingChecks(state: ProjectState): CheckResult[] {
  return [
    checkCommand('node', ['--version'], 'Node.js', 'Required to run Deploid.', ['init', 'build', 'release', 'deploy', 'desktop']),
    checkNpm(),
    checkCommand('npx', ['--version'], 'npx', 'Used to invoke Capacitor CLI commands.', ['build', 'release']),
    checkJava(),
    checkAdb(),
    checkAndroidSdk(),
    checkGradleWrapper(state)
  ];
}

function buildWorkflowReadiness(checks: CheckResult[]): WorkflowReadiness[] {
  return (Object.keys(WORKFLOW_TITLES) as WorkflowId[]).map((workflow) => {
    const relevant = checks.filter((check) => check.workflows.includes(workflow));
    const totals = countStatuses(relevant);
    const total = relevant.length || 1;
    const score = Math.max(0, Math.round(((totals.pass + totals.warn * 0.5) / total) * 100));
    const status: CheckStatus =
      totals.fail > 0 ? 'fail' : totals.warn > 0 ? 'warn' : 'pass';
    const nextAction = relevant.find((check) => check.status !== 'pass')?.details || relevant.find((check) => check.status !== 'pass')?.message;

    return {
      id: workflow,
      title: WORKFLOW_TITLES[workflow],
      status,
      score,
      totals,
      nextAction
    };
  });
}

function applyFixes(state: ProjectState, checks: CheckResult[]): FixResult[] {
  const fixes: FixResult[] = [];
  const missingAssetsSource = checks.find((check) => check.id === 'assets-source' && check.status === 'fail');
  if (missingAssetsSource) {
    const source = state.config?.assets?.source;
    if (source) {
      const dir = path.join(state.cwd, path.dirname(source));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        fixes.push({ id: 'assets-dir', title: 'Asset directory', status: 'applied', message: `Created ${path.relative(state.cwd, dir)}.` });
      } else {
        fixes.push({ id: 'assets-dir', title: 'Asset directory', status: 'skipped', message: 'Asset directory already exists.' });
      }
    }
  }

  const capacitorNeedsSync = checks.find(
    (check) => ['capacitor-config', 'capacitor-sync'].includes(check.id) && check.fixable && state.config?.android?.packaging === 'capacitor'
  );
  if (capacitorNeedsSync && state.config) {
    const webDir = state.config.web?.webDir || 'dist';
    const nextConfig = {
      appId: state.config.appId || 'com.example.myapp',
      appName: state.config.appName || 'MyApp',
      webDir,
      bundledWebRuntime: false
    };
    const hadConfig = fs.existsSync(state.capacitorConfigPath);
    fs.writeFileSync(state.capacitorConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
    fixes.push({ id: 'capacitor-config', title: 'Capacitor config', status: 'applied', message: `${hadConfig ? 'Synced' : 'Created'} capacitor.config.json.` });
  }

  if (state.configPath && state.config) {
    const originalConfig = safeRead(state.configPath);
    let updatedConfig = originalConfig;

    if (checks.find((check) => check.id === 'android-signing' && check.status !== 'pass')) {
      updatedConfig = ensureProperty(updatedConfig, ['android'], 'signing', {
        keystorePath: state.config.android?.signing?.keystorePath || 'secrets/android-upload-keystore.jks',
        alias: state.config.android?.signing?.alias || slugify(state.config.appName || 'upload'),
        storePasswordEnv: state.config.android?.signing?.storePasswordEnv || 'DEPLOID_ANDROID_STORE_PASSWORD',
        keyPasswordEnv: state.config.android?.signing?.keyPasswordEnv || 'DEPLOID_ANDROID_KEY_PASSWORD'
      });
    }

    if (checks.find((check) => check.id === 'versioning' && check.status !== 'pass')) {
      updatedConfig = ensureProperty(updatedConfig, ['android'], 'version', {
        code: state.config.android?.version?.code && state.config.android.version.code >= 1 ? state.config.android.version.code : 1,
        name: state.config.android?.version?.name || '1.0.0'
      });
    }

    if (checks.find((check) => check.id === 'github-release' && check.status !== 'pass')) {
      updatedConfig = ensureProperty(updatedConfig, ['publish'], 'github', {
        repo: inferGithubRepo(state.cwd) || 'owner/repo',
        draft: true
      });
    }

    if (checks.find((check) => check.id === 'play-service-account' && check.status !== 'pass')) {
      updatedConfig = ensureProperty(updatedConfig, ['publish'], 'play', {
        track: state.config.publish?.play?.track || 'internal',
        serviceAccountJson: state.config.publish?.play?.serviceAccountJson || 'secrets/play-service-account.json'
      });
    }

    if (updatedConfig !== originalConfig) {
      fs.writeFileSync(state.configPath, updatedConfig);
      fixes.push({ id: 'release-config', title: 'Release config', status: 'applied', message: `Updated ${path.basename(state.configPath)} with release placeholders.` });
    }
  }

  const envExamplePath = path.join(state.cwd, '.env.deploid.example');
  const envLines = [
    '# Deploid signing placeholders',
    state.config?.android?.signing?.storePasswordEnv ? `${state.config.android.signing.storePasswordEnv}=replace-me` : 'DEPLOID_ANDROID_STORE_PASSWORD=replace-me',
    state.config?.android?.signing?.keyPasswordEnv ? `${state.config.android.signing.keyPasswordEnv}=replace-me` : 'DEPLOID_ANDROID_KEY_PASSWORD=replace-me',
    state.config?.publish?.play?.serviceAccountJson ? `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=${state.config.publish.play.serviceAccountJson}` : null
  ].filter((value): value is string => Boolean(value));
  if (envLines.length > 1) {
    const existing = fs.existsSync(envExamplePath) ? safeRead(envExamplePath) : '';
    const missingLines = envLines.filter((line) => !existing.includes(line));
    if (!fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, `${envLines.join('\n')}\n`);
      fixes.push({ id: 'signing-env-example', title: 'Signing env template', status: 'applied', message: 'Created .env.deploid.example.' });
    } else if (missingLines.length > 0) {
      const needsBreak = existing.length > 0 && !existing.endsWith('\n');
      fs.appendFileSync(envExamplePath, `${needsBreak ? '\n' : ''}${missingLines.join('\n')}\n`);
      fixes.push({ id: 'signing-env-example', title: 'Signing env template', status: 'applied', message: 'Updated .env.deploid.example.' });
    }
  }

  const sensitivePaths = [
    state.config?.android?.signing?.keystorePath || 'secrets/android-upload-keystore.jks',
    state.config?.publish?.play?.serviceAccountJson || 'secrets/play-service-account.json',
    '.env.deploid',
    '.env.deploid.local'
  ].filter((value): value is string => Boolean(value));
  if (sensitivePaths.length > 0) {
    const gitignorePath = path.join(state.cwd, '.gitignore');
    const existing = fs.existsSync(gitignorePath) ? safeRead(gitignorePath) : '';
    const missingEntries = sensitivePaths.filter((entry) => !existing.includes(entry));
    if (missingEntries.length > 0) {
      const needsBreak = existing.length > 0 && !existing.endsWith('\n');
      fs.appendFileSync(gitignorePath, `${needsBreak ? '\n' : ''}${missingEntries.join('\n')}\n`);
      fixes.push({ id: 'gitignore-release', title: 'Release gitignore', status: 'applied', message: 'Updated .gitignore with release-sensitive paths.' });
    }
  }

  const playServiceAccount = state.config?.publish?.play?.serviceAccountJson || 'secrets/play-service-account.json';
  if (playServiceAccount) {
    const secretsDir = path.join(state.cwd, path.dirname(playServiceAccount));
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true });
      fixes.push({ id: 'secrets-dir', title: 'Secrets directory', status: 'applied', message: `Created ${path.relative(state.cwd, secretsDir)}.` });
    }
  }

  if (fixes.length === 0) {
    fixes.push({ id: 'noop', title: 'Auto-fix', status: 'skipped', message: 'No safe automatic fixes were available.' });
  }

  return fixes;
}

function printSummary(summary: DoctorSummary, options: DoctorOptions): void {
  const showPasses = options.verbose && !options.summary;
  const showDetails = !options.summary;

  console.log('Deploid Doctor');
  console.log(`Project: ${summary.cwd}`);
  console.log(
    `Status: ${summary.ok ? 'OK' : 'ACTION NEEDED'} (${summary.totals.pass} passed, ${summary.totals.warn} warnings, ${summary.totals.fail} failures)`
  );

  console.log('');
  console.log('Workflow readiness:');
  for (const workflow of summary.workflows) {
    console.log(`  ${workflow.status.toUpperCase().padEnd(4, ' ')} ${workflow.title.padEnd(20, ' ')} ${String(workflow.score).padStart(3, ' ')}%`);
    if (workflow.nextAction && showDetails) {
      console.log(`       ${workflow.nextAction}`);
    }
  }

  const categories: Array<{ key: CheckCategory; title: string }> = [
    { key: 'project', title: 'Project' },
    { key: 'release', title: 'Release' },
    { key: 'plugins', title: 'Plugins' },
    { key: 'tooling', title: 'Tooling' }
  ];

  for (const category of categories) {
    const rows = summary.checks.filter((check) => check.category === category.key && (showPasses || check.status !== 'pass'));
    if (rows.length === 0) continue;
    console.log('');
    console.log(`${category.title}:`);
    for (const check of rows) {
      console.log(`  ${check.status.toUpperCase().padEnd(4, ' ')} ${check.title.padEnd(22, ' ')} ${check.message}`);
      if (check.details && showDetails) {
        console.log(`       ${check.details}`);
      }
    }
  }

  if (summary.fixes.length > 0) {
    console.log('');
    console.log('Fixes:');
    for (const fix of summary.fixes) {
      console.log(`  ${fix.status.toUpperCase().padEnd(7, ' ')} ${fix.title}: ${fix.message}`);
    }
  }

  if (!summary.ok) {
    console.log('');
    console.log('Next actions:');
    for (const check of summary.checks.filter((item) => item.status !== 'pass').slice(0, 6)) {
      console.log(`  - ${check.title}: ${check.details || check.message}`);
    }
  }
}

function renderMarkdown(summary: DoctorSummary, options: DoctorOptions): string {
  const lines: string[] = [];
  lines.push('# Deploid Doctor');
  lines.push('');
  lines.push(`- Project: \`${summary.cwd}\``);
  lines.push(`- Status: **${summary.ok ? 'OK' : 'ACTION NEEDED'}**`);
  lines.push(`- Totals: ${summary.totals.pass} passed, ${summary.totals.warn} warnings, ${summary.totals.fail} failures`);
  lines.push('');
  lines.push('## Workflow Readiness');
  for (const workflow of summary.workflows) {
    lines.push(`- ${workflow.title}: ${workflow.status.toUpperCase()} (${workflow.score}%)`);
    if (workflow.nextAction && !options.summary) lines.push(`  ${workflow.nextAction}`);
  }

  const sections: CheckCategory[] = ['project', 'release', 'plugins', 'tooling'];
  for (const section of sections) {
    const rows = summary.checks.filter((check) => check.category === section && (!options.summary || check.status !== 'pass'));
    if (rows.length === 0) continue;
    lines.push('');
    lines.push(`## ${capitalize(section)}`);
    for (const row of rows) {
      lines.push(`- ${row.status.toUpperCase()} ${row.title}: ${row.message}`);
      if (row.details && !options.summary) lines.push(`  ${row.details}`);
    }
  }

  if (summary.fixes.length > 0) {
    lines.push('');
    lines.push('## Fixes');
    for (const fix of summary.fixes) lines.push(`- ${fix.status.toUpperCase()} ${fix.title}: ${fix.message}`);
  }

  return lines.join('\n');
}

function renderCi(summary: DoctorSummary): string {
  const lines = [
    `DOCTOR_STATUS=${summary.ok ? 'ok' : 'action-needed'}`,
    `DOCTOR_PASSED=${summary.totals.pass}`,
    `DOCTOR_WARNINGS=${summary.totals.warn}`,
    `DOCTOR_FAILURES=${summary.totals.fail}`
  ];
  for (const workflow of summary.workflows) {
    lines.push(`WORKFLOW_${workflow.id.toUpperCase()}=${workflow.status}:${workflow.score}`);
  }
  return lines.join('\n');
}

function checkBuildCommand(state: ProjectState): CheckResult {
  const buildCommand = state.config?.web?.buildCommand;
  if (!buildCommand) {
    return fail('build-command', 'Build command', 'No `web.buildCommand` configured.', ['init', 'build']);
  }

  const scriptName = inferScriptName(buildCommand);
  if (scriptName && typeof state.packageScripts[scriptName] !== 'string') {
    return warn(
      'build-command',
      'Build command',
      `Configured build command references missing script "${scriptName}".`,
      ['init', 'build'],
      'Add the script to package.json or update `web.buildCommand`.'
    );
  }

  return pass('build-command', 'Build command', `Configured build command: ${buildCommand}.`, ['init', 'build']);
}

function checkWebDir(state: ProjectState): CheckResult {
  const webDir = state.config?.web?.webDir;
  if (!webDir) {
    return fail('web-output', 'Web output directory', 'No `web.webDir` configured.', ['init', 'build']);
  }

  const fullPath = path.join(state.cwd, webDir);
  if (!fs.existsSync(fullPath)) {
    return warn(
      'web-output',
      'Web output directory',
      `${webDir} does not exist yet.`,
      ['build'],
      'Run your web build before packaging if you expect ready-to-sync assets.'
    );
  }

  const indexPath = path.join(fullPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return warn(
      'web-output',
      'Web output directory',
      `${webDir} exists but index.html is missing.`,
      ['build'],
      'Check `web.webDir` or your framework build output.'
    );
  }

  return pass('web-output', 'Web output directory', `Found ${webDir}.`, ['build']);
}

function checkAssetsSource(state: ProjectState): CheckResult {
  const source = state.config?.assets?.source;
  if (!source) {
    return warn('assets-source', 'Asset source', 'No `assets.source` configured.', ['init'], undefined, true);
  }

  const sourcePath = path.join(state.cwd, source);
  if (fs.existsSync(sourcePath)) {
    return pass('assets-source', 'Asset source', `Found ${source}.`, ['init']);
  }

  return fail(
    'assets-source',
    'Asset source',
    `${source} does not exist.`,
    ['init'],
    'Add the source asset or update `assets.source` before running `deploid assets`.',
    true
  );
}

function checkSigning(state: ProjectState): CheckResult {
  const signing = state.config?.android?.signing;
  if (!signing?.keystorePath) {
    return warn('android-signing', 'Android signing', 'No Android signing config found.', ['release'], undefined, true);
  }

  const keystorePath = path.join(state.cwd, signing.keystorePath);
  const missingEnvVars = [signing.storePasswordEnv, signing.keyPasswordEnv]
    .filter((name): name is string => Boolean(name))
    .filter((name) => !process.env[name]);

  if (!fs.existsSync(keystorePath)) {
    return fail(
      'android-signing',
      'Android signing',
      `Keystore file is missing: ${signing.keystorePath}.`,
      ['release'],
      'Create the keystore or fix `android.signing.keystorePath`.',
      true
    );
  }

  if (missingEnvVars.length > 0) {
    return warn(
      'android-signing',
      'Android signing',
      `Keystore found, but env vars are missing: ${missingEnvVars.join(', ')}.`,
      ['release'],
      'Release builds will fail until those password env vars are exported.',
      true
    );
  }

  return pass('android-signing', 'Android signing', 'Signing keystore and env vars look ready.', ['release']);
}

function checkCapacitorConfig(state: ProjectState): CheckResult {
  if (state.config?.android?.packaging !== 'capacitor') {
    return warn('capacitor-config', 'Capacitor config', `Packaging engine is ${state.config?.android?.packaging || 'unknown'}.`, ['build']);
  }

  if (fs.existsSync(state.capacitorConfigPath)) {
    return pass('capacitor-config', 'Capacitor config', 'Found capacitor.config.json.', ['build']);
  }

  return warn(
    'capacitor-config',
    'Capacitor config',
    'capacitor.config.json is missing.',
    ['build'],
    'Run `deploid init`, `deploid package`, or `deploid doctor --fix` to scaffold Capacitor configuration.',
    true
  );
}

function checkAndroidProject(state: ProjectState): CheckResult {
  if (fs.existsSync(state.androidDir)) {
    return pass('android-project', 'Android project', 'Found android/ project.', ['build', 'deploy']);
  }

  return warn(
    'android-project',
    'Android project',
    'android/ project has not been generated yet.',
    ['build', 'deploy'],
    'Run `deploid package` before building or deploying Android artifacts.'
  );
}

function checkVersioning(state: ProjectState): CheckResult {
  const version = state.config?.android?.version;
  if (!version?.code || !version?.name) {
    return warn('versioning', 'Version metadata', 'Android version code/name are incomplete.', ['release'], undefined, true);
  }

  if (version.code < 1) {
    return fail('versioning', 'Version metadata', 'Android version code must be >= 1.', ['release'], undefined, true);
  }

  return pass('versioning', 'Version metadata', `Configured version ${version.name} (${version.code}).`, ['release']);
}

function checkCommand(command: string, args: string[], title: string, details: string, workflows: WorkflowId[]): CheckResult {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status === 0) {
    const output = `${result.stdout || ''} ${result.stderr || ''}`.trim().split('\n')[0]?.trim();
    return pass(command, title, `${command} is available.`, workflows, output || details);
  }

  return fail(command, title, `${command} is not available.`, workflows, result.error?.message || result.stderr?.trim() || details);
}

function checkNpm(): CheckResult {
  const check = checkCommand('npm', ['--version'], 'npm', 'Used by init, plugin setup, and Capacitor workflows.', ['init', 'build', 'release', 'desktop']);
  if (check.status === 'pass') {
    const major = Number.parseInt((check.details || '').split('.')[0] || '0', 10);
    if (major > 0 && major < 9) {
      return warn('npm', 'npm', `npm ${check.details} is available but older than recommended.`, ['init', 'build', 'release', 'desktop']);
    }
  }
  return check;
}

function checkJava(): CheckResult {
  const result = spawnSync('java', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return fail('java', 'Java', 'java is not available.', ['build', 'release'], result.error?.message || 'Install Java 17+ for Android builds.');
  }
  const firstLine = `${result.stdout || ''} ${result.stderr || ''}`.trim().split('\n')[0]?.trim();
  const match = firstLine.match(/version "(\d+)/);
  const major = Number(match?.[1] || '0');
  if (major > 0 && major < 17) {
    return warn('java', 'Java', `Java ${major} is installed but Java 17+ is recommended.`, ['build', 'release'], firstLine);
  }
  return pass('java', 'Java', 'java is available.', ['build', 'release'], firstLine);
}

function checkAdb(): CheckResult {
  const version = checkCommand('adb', ['version'], 'ADB', 'Required for device listing, deploy, and logs.', ['deploy']);
  if (version.status !== 'pass') return version;

  const devicesResult = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  const lines = `${devicesResult.stdout || ''}`.split('\n').filter((line) => /\t/.test(line));
  const unauthorized = lines.filter((line) => line.includes('unauthorized') || line.includes('offline'));
  if (unauthorized.length > 0) {
    return warn('adb', 'ADB', `ADB is available but ${unauthorized.length} device(s) need attention.`, ['deploy'], unauthorized.join(', '));
  }
  if (lines.length === 0) {
    return warn('adb', 'ADB', 'ADB is available but no devices are connected.', ['deploy']);
  }
  return pass('adb', 'ADB', `ADB is available with ${lines.length} connected device(s).`, ['deploy'], version.details);
}

function checkAndroidSdk(): CheckResult {
  const envHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const sdkPath = envHome || path.join(process.env.HOME || '', 'Android', 'Sdk');

  if (!sdkPath || !fs.existsSync(sdkPath)) {
    return fail(
      'android-sdk',
      'Android SDK',
      'Android SDK directory was not found.',
      ['build', 'release', 'deploy'],
      'Set ANDROID_HOME or ANDROID_SDK_ROOT, or install the SDK in ~/Android/Sdk.'
    );
  }

  const platformToolsPath = path.join(sdkPath, 'platform-tools');
  if (!fs.existsSync(platformToolsPath)) {
    return warn(
      'android-sdk',
      'Android SDK',
      `SDK found at ${sdkPath}, but platform-tools is missing.`,
      ['build', 'release', 'deploy'],
      'Install Android SDK Platform Tools to enable adb-based workflows.'
    );
  }

  const hasBuildTools = fs.existsSync(path.join(sdkPath, 'build-tools'));
  if (!hasBuildTools) {
    return warn('android-sdk', 'Android SDK', `SDK found at ${sdkPath}, but build-tools is missing.`, ['build', 'release']);
  }

  return pass('android-sdk', 'Android SDK', `SDK found at ${sdkPath}.`, ['build', 'release', 'deploy']);
}

function checkGradleWrapper(state: ProjectState): CheckResult {
  if (!fs.existsSync(state.androidDir)) {
    return warn('gradle-wrapper', 'Gradle wrapper', 'Skipped because android/ has not been generated yet.', ['build', 'release']);
  }
  const wrapper = path.join(state.androidDir, 'gradlew');
  if (!fs.existsSync(wrapper)) {
    return fail('gradle-wrapper', 'Gradle wrapper', 'android/ exists but gradlew is missing.', ['build', 'release']);
  }

  const result = spawnSync(wrapper, ['-v'], { cwd: state.androidDir, encoding: 'utf8' });
  if (result.status !== 0) {
    return warn('gradle-wrapper', 'Gradle wrapper', 'Gradle wrapper exists but did not respond cleanly.', ['build', 'release']);
  }
  const firstLine = `${result.stdout || ''}${result.stderr || ''}`.split('\n').find((line) => line.trim().length > 0)?.trim();
  return pass('gradle-wrapper', 'Gradle wrapper', 'Gradle wrapper is present.', ['build', 'release'], firstLine);
}

function countStatuses(checks: CheckResult[]): Record<CheckStatus, number> {
  return {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length
  };
}

function pass(
  id: string,
  title: string,
  message: string,
  workflows: WorkflowId[],
  details?: string,
  fixable = false
): CheckResult {
  return { id, category: categoryFor(id), title, status: 'pass', message, details, workflows, fixable };
}

function warn(
  id: string,
  title: string,
  message: string,
  workflows: WorkflowId[],
  details?: string,
  fixable = false
): CheckResult {
  return { id, category: categoryFor(id), title, status: 'warn', message, details, workflows, fixable };
}

function fail(
  id: string,
  title: string,
  message: string,
  workflows: WorkflowId[],
  details?: string,
  fixable = false
): CheckResult {
  return { id, category: categoryFor(id), title, status: 'fail', message, details, workflows, fixable };
}

function categoryFor(id: string): CheckCategory {
  if (['node', 'npm', 'npx', 'java', 'adb', 'android-sdk', 'gradle-wrapper'].includes(id)) return 'tooling';
  if (['capacitor-dependency', 'electron-dependency', 'plugin-state'].includes(id)) return 'plugins';
  if (['android-signing', 'versioning', 'play-service-account', 'github-release', 'package-build-meta'].includes(id)) return 'release';
  if (['build-command', 'capacitor-sync'].includes(id)) return 'workflows';
  return 'project';
}

function ensureProperty(source: string, pathSegments: string[], propertyName: string, value: unknown): string {
  let current = source;
  for (let index = 0; index < pathSegments.length; index += 1) {
    const parentPath = pathSegments.slice(0, index);
    current = ensureObjectProperty(current, parentPath, pathSegments[index]);
  }
  return ensureValueProperty(current, pathSegments, propertyName, value);
}

function ensureObjectProperty(source: string, parentPath: string[], propertyName: string): string {
  const parentRange = findObjectRangeByPath(source, parentPath);
  if (!parentRange) {
    throw new Error(`Unable to find config object path: ${parentPath.join('.') || 'root'}`);
  }

  const body = source.slice(parentRange.openBraceIndex + 1, parentRange.closeBraceIndex);
  if (hasProperty(body, propertyName)) {
    return source;
  }

  const parentIndent = lineIndentAt(source, parentRange.openBraceIndex);
  const childIndent = `${parentIndent}  `;
  const insertion = `\n${childIndent}${propertyName}: {},`;
  return `${source.slice(0, parentRange.closeBraceIndex)}${insertion}\n${parentIndent}${source.slice(parentRange.closeBraceIndex)}`;
}

function ensureValueProperty(source: string, parentPath: string[], propertyName: string, value: unknown): string {
  const parentRange = findObjectRangeByPath(source, parentPath);
  if (!parentRange) {
    throw new Error(`Unable to find config object path: ${parentPath.join('.') || 'root'}`);
  }

  const body = source.slice(parentRange.openBraceIndex + 1, parentRange.closeBraceIndex);
  if (hasProperty(body, propertyName)) {
    return source;
  }

  const parentIndent = lineIndentAt(source, parentRange.openBraceIndex);
  const childIndent = `${parentIndent}  `;
  const renderedValue = renderValue(value, childIndent);
  const insertion = `\n${childIndent}${propertyName}: ${renderedValue},`;
  return `${source.slice(0, parentRange.closeBraceIndex)}${insertion}\n${parentIndent}${source.slice(parentRange.closeBraceIndex)}`;
}

function hasProperty(objectBody: string, propertyName: string): boolean {
  return new RegExp(`(^|\\n)\\s*${escapeRegExp(propertyName)}\\s*:`, 'm').test(objectBody);
}

function findObjectRangeByPath(source: string, pathSegments: string[]): { openBraceIndex: number; closeBraceIndex: number } | null {
  let currentRange = findRootObjectRange(source);
  if (!currentRange) return null;

  for (const segment of pathSegments) {
    const body = source.slice(currentRange.openBraceIndex + 1, currentRange.closeBraceIndex);
    const propertyPattern = new RegExp(`(^|\\n)(\\s*)${escapeRegExp(segment)}\\s*:\\s*\\{`, 'm');
    const match = propertyPattern.exec(body);
    if (!match || typeof match.index !== 'number') return null;
    const braceOffset = body.indexOf('{', match.index);
    if (braceOffset === -1) return null;
    const openBraceIndex: number = currentRange.openBraceIndex + 1 + braceOffset;
    const closeBraceIndex: number = findMatchingBrace(source, openBraceIndex);
    if (closeBraceIndex === -1) return null;
    currentRange = { openBraceIndex, closeBraceIndex };
  }

  return currentRange;
}

function findRootObjectRange(source: string): { openBraceIndex: number; closeBraceIndex: number } | null {
  const exportMatch = /(export\s+default|module\.exports\s*=)\s*\{/.exec(source);
  if (!exportMatch || typeof exportMatch.index !== 'number') return null;
  const openBraceIndex = source.indexOf('{', exportMatch.index);
  if (openBraceIndex === -1) return null;
  const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
  if (closeBraceIndex === -1) return null;
  return { openBraceIndex, closeBraceIndex };
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    const prev = source[index - 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && char === '/') inBlockComment = false;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate) {
      if (char === '/' && next === '/') {
        inLineComment = true;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        continue;
      }
    }
    if (!inDouble && !inTemplate && char === '\'' && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && char === '"' && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && char === '`' && prev !== '\\') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function lineIndentAt(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const line = source.slice(lineStart, index);
  return line.match(/^\s*/)?.[0] || '';
}

function renderValue(value: unknown, indent: string): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => renderValue(entry, indent)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([key, entryValue]) => `${indent}  ${key}: ${renderValue(entryValue, `${indent}  `)}`).join(',\n')}\n${indent}}`;
  }
  return 'undefined';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferGithubRepo(cwd: string): string | null {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { repository?: string | { url?: string } };
    const repositoryUrl = typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url;
    if (!repositoryUrl) return null;
    const match = repositoryUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function inferScriptName(command: string): string | null {
  const match = command.match(/(?:npm|pnpm|bun)\s+run\s+([a-zA-Z0-9:_-]+)/) || command.match(/yarn\s+([a-zA-Z0-9:_-]+)/);
  return match?.[1] || null;
}

function findExistingPath(cwd: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

async function loadProjectConfig(configPath: string): Promise<DeploidConfigShape | null> {
  try {
    const mod = await import(pathToFileUrl(configPath).href);
    return (mod.default || mod) as DeploidConfigShape;
  } catch {
    return null;
  }
}

function pathToFileUrl(filePath: string): URL {
  const resolved = path.resolve(filePath);
  const url = new URL('file://');
  url.pathname = resolved;
  return url;
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function safeRead(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default plugin;
export { inspectProject, plugin };
