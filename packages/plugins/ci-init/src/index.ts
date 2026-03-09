import fs from 'node:fs';
import path from 'node:path';

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

interface CiInitOptions {
  provider?: 'github';
  workflowName?: string;
  nodeVersion?: string;
  javaVersion?: string;
  packageManager?: PackageManager | 'auto';
  includeVersion?: boolean;
  force?: boolean;
}

interface PipelineContext {
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  config: {
    android: {
      signing?: {
        storePasswordEnv?: string;
        keyPasswordEnv?: string;
      };
    };
    publish?: {
      play?: { serviceAccountJson?: string };
      github?: { repo?: string };
    };
  };
  cwd: string;
  ciInitOptions?: CiInitOptions;
}

const plugin = {
  name: 'ci-init',
  plan: () => [
    'Infer package manager and CI prerequisites from the current project',
    'Generate a GitHub Actions workflow for doctor, build, and publish',
    'Write a secrets/setup guide alongside the workflow'
  ],
  run: runCiInit
};

async function runCiInit(ctx: PipelineContext): Promise<void> {
  const options = withDefaults(ctx);
  if (options.provider !== 'github') {
    throw new Error(`Unsupported CI provider "${options.provider}". Only "github" is implemented right now.`);
  }

  const packageManager = resolvePackageManager(ctx.cwd, options.packageManager);
  const workflowDir = path.join(ctx.cwd, '.github', 'workflows');
  const workflowPath = path.join(workflowDir, 'deploid-release.yml');
  const docsDir = path.join(ctx.cwd, '.github');
  const guidePath = path.join(docsDir, 'DEPLOID_SECRETS.md');

  if (!options.force && fs.existsSync(workflowPath)) {
    throw new Error(`${path.relative(ctx.cwd, workflowPath)} already exists. Re-run with --force to overwrite.`);
  }

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });

  const workflow = renderGithubWorkflow(ctx, options, packageManager);
  const guide = renderSecretsGuide(ctx, options);

  fs.writeFileSync(workflowPath, workflow);
  fs.writeFileSync(guidePath, guide);

  ctx.logger.info(`Created ${path.relative(ctx.cwd, workflowPath)}.`);
  ctx.logger.info(`Created ${path.relative(ctx.cwd, guidePath)}.`);
  ctx.logger.info('Next: add the documented GitHub secrets, then push a tag or run the workflow manually.');
}

function withDefaults(ctx: PipelineContext): Required<CiInitOptions> {
  return {
    provider: ctx.ciInitOptions?.provider || 'github',
    workflowName: ctx.ciInitOptions?.workflowName || 'Deploid Release',
    nodeVersion: ctx.ciInitOptions?.nodeVersion || '20',
    javaVersion: ctx.ciInitOptions?.javaVersion || '21',
    packageManager: ctx.ciInitOptions?.packageManager || 'auto',
    includeVersion: Boolean(ctx.ciInitOptions?.includeVersion ?? true),
    force: Boolean(ctx.ciInitOptions?.force)
  };
}

function resolvePackageManager(cwd: string, requested: PackageManager | 'auto'): PackageManager {
  if (requested !== 'auto') return requested;
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'bun.lock')) || fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun';
  return 'npm';
}

function renderGithubWorkflow(ctx: PipelineContext, options: Required<CiInitOptions>, packageManager: PackageManager): string {
  const setupPackageManager = packageManager === 'pnpm'
    ? `      - uses: pnpm/action-setup@v4\n        with:\n          version: 9\n\n`
    : packageManager === 'yarn'
      ? `      - name: Enable Corepack\n        run: corepack enable\n\n`
      : packageManager === 'bun'
        ? `      - uses: oven-sh/setup-bun@v2\n\n`
        : '';

  const installDependencies = packageManager === 'pnpm'
    ? 'pnpm install --frozen-lockfile'
    : packageManager === 'yarn'
      ? 'yarn install --frozen-lockfile'
      : packageManager === 'bun'
        ? 'bun install --frozen-lockfile'
        : 'npm ci';

  const cache = packageManager === 'bun' ? 'npm' : packageManager;
  const maybeVersionStep = options.includeVersion ? `      - name: Bump release metadata\n        run: deploid version --patch\n\n` : '';
  const storePasswordEnv = ctx.config.android.signing?.storePasswordEnv || 'DEPLOID_ANDROID_STORE_PASSWORD';
  const keyPasswordEnv = ctx.config.android.signing?.keyPasswordEnv || 'DEPLOID_ANDROID_KEY_PASSWORD';
  const playEnv = ctx.config.publish?.play?.serviceAccountJson
    ? `          GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: \${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}\n`
    : '';
  const publishTarget = ctx.config.publish?.play?.serviceAccountJson && ctx.config.publish?.github?.repo
    ? 'all'
    : ctx.config.publish?.play?.serviceAccountJson
      ? 'play'
      : 'github';

  return `name: ${options.workflowName}

on:
  workflow_dispatch:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '${options.nodeVersion}'
          cache: '${cache}'

${setupPackageManager}      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '${options.javaVersion}'

      - uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: ${installDependencies}

      - name: Install Deploid
        run: npm install -g @deploid/cli

      - name: Doctor
        run: deploid doctor --summary

      - name: Generate assets
        run: deploid assets

      - name: Package app
        run: deploid package

${maybeVersionStep}      - name: Build Android artifacts
        run: deploid build
        env:
          ${storePasswordEnv}: \${{ secrets.${storePasswordEnv} }}
          ${keyPasswordEnv}: \${{ secrets.${keyPasswordEnv} }}

      - name: Publish release
        run: deploid publish --target ${publishTarget} --notes-file RELEASE_NOTES.md
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
${playEnv}`;
}

function renderSecretsGuide(ctx: PipelineContext, options: Required<CiInitOptions>): string {
  const storePasswordEnv = ctx.config.android.signing?.storePasswordEnv || 'DEPLOID_ANDROID_STORE_PASSWORD';
  const keyPasswordEnv = ctx.config.android.signing?.keyPasswordEnv || 'DEPLOID_ANDROID_KEY_PASSWORD';
  const secrets: string[] = [
    '- `GITHUB_TOKEN`: built-in GitHub token for release creation and asset upload.',
    `- \`${storePasswordEnv}\`: Android keystore store password.`,
    `- \`${keyPasswordEnv}\`: Android keystore key password.`
  ];

  if (ctx.config.publish?.play?.serviceAccountJson) {
    secrets.push('- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: path secret/credential reference used by your Play publishing setup.');
  }

  return `# Deploid CI Secrets

Generated by \`deploid ci init github\`.

## Workflow

- Workflow name: ${options.workflowName}
- Triggered on version tags matching \`v*\`
- Also available through \`workflow_dispatch\`

## Required Secrets

${secrets.join('\n')}

## Repository Files

- Ensure your Android keystore file is available to the workflow runtime.
- Ensure your Play service account json exists at the path configured in \`deploid.config.*\` if Play publishing is enabled.
- Commit \`RELEASE_NOTES.md\` if you want CI publishes to use curated notes.

## Suggested Flow

1. Run \`deploid doctor --summary\` locally until release readiness is green.
2. Use \`deploid version\` to bump semver and Android version metadata.
3. Commit the version change and release notes.
4. Push a tag like \`v1.2.3\` to trigger the generated workflow.
`;
}

export default plugin;
export { plugin };
