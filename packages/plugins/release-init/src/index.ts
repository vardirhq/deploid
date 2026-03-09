import fs from 'node:fs';
import path from 'node:path';

interface ReleaseInitOptions {
  yes?: boolean;
  keystorePath?: string;
  alias?: string;
  storePasswordEnv?: string;
  keyPasswordEnv?: string;
  githubRepo?: string;
  playTrack?: 'internal' | 'alpha' | 'beta' | 'production';
  playServiceAccount?: string;
  buildType?: 'apk' | 'aab' | 'both';
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
  };
  cwd: string;
  releaseInitOptions?: ReleaseInitOptions;
}

const CONFIG_CANDIDATES = ['deploid.config.ts', 'deploid.config.js', 'deploid.config.mjs', 'deploid.config.cjs'];

const plugin = {
  name: 'release-init',
  plan: () => [
    'Scaffold Android signing and version metadata',
    'Add Play and GitHub publish placeholders to the Deploid config',
    'Create env, secrets, and gitignore scaffolding for release workflows'
  ],
  run: runReleaseInit
};

async function runReleaseInit(ctx: PipelineContext): Promise<void> {
  const options = withDefaults(ctx.releaseInitOptions, ctx);
  const configPath = findConfigPath(ctx.cwd);
  if (!configPath) {
    throw new Error('No Deploid config file found. Run "deploid init" first.');
  }

  const originalConfig = fs.readFileSync(configPath, 'utf8');
  let updatedConfig = originalConfig;

  updatedConfig = ensureProperty(updatedConfig, ['android'], 'signing', {
    keystorePath: options.keystorePath,
    alias: options.alias,
    storePasswordEnv: options.storePasswordEnv,
    keyPasswordEnv: options.keyPasswordEnv
  });
  updatedConfig = ensureProperty(updatedConfig, ['android'], 'version', {
    code: 1,
    name: '1.0.0'
  });
  updatedConfig = ensureProperty(updatedConfig, ['android'], 'build', {
    buildType: options.buildType,
    minifyEnabled: false,
    shrinkResources: false
  });
  updatedConfig = ensureProperty(updatedConfig, ['publish'], 'play', {
    track: options.playTrack,
    serviceAccountJson: options.playServiceAccount
  });
  updatedConfig = ensureProperty(updatedConfig, ['publish'], 'github', {
    repo: options.githubRepo,
    draft: true
  });

  if (updatedConfig !== originalConfig) {
    fs.writeFileSync(configPath, updatedConfig);
    ctx.logger.info(`Updated ${path.basename(configPath)} with release scaffolding.`);
  } else {
    ctx.logger.info(`${path.basename(configPath)} already contains release scaffolding.`);
  }

  const envFilePath = path.join(ctx.cwd, '.env.deploid.example');
  ensureEnvExample(envFilePath, options);

  const secretsDir = path.join(ctx.cwd, path.dirname(options.playServiceAccount));
  fs.mkdirSync(secretsDir, { recursive: true });

  const gitignorePath = path.join(ctx.cwd, '.gitignore');
  ensureGitignoreEntries(gitignorePath, [
    options.keystorePath,
    options.playServiceAccount,
    '.env.deploid',
    '.env.deploid.local'
  ]);

  ctx.logger.info('Release init complete.');
  ctx.logger.info(`Next: create ${options.keystorePath}, fill .env.deploid, and run "deploid doctor --summary".`);
}

function withDefaults(options: ReleaseInitOptions | undefined, ctx: PipelineContext): Required<ReleaseInitOptions> {
  return {
    yes: Boolean(options?.yes),
    keystorePath: options?.keystorePath || 'secrets/android-upload-keystore.jks',
    alias: options?.alias || slugify(ctx.config.appName) || 'upload',
    storePasswordEnv: options?.storePasswordEnv || 'DEPLOID_ANDROID_STORE_PASSWORD',
    keyPasswordEnv: options?.keyPasswordEnv || 'DEPLOID_ANDROID_KEY_PASSWORD',
    githubRepo: options?.githubRepo || inferGithubRepo(ctx.cwd) || 'owner/repo',
    playTrack: options?.playTrack || 'internal',
    playServiceAccount: options?.playServiceAccount || 'secrets/play-service-account.json',
    buildType: options?.buildType || 'aab'
  };
}

function ensureEnvExample(filePath: string, options: Required<ReleaseInitOptions>): void {
  const lines = [
    '# Deploid release environment template',
    `${options.storePasswordEnv}=replace-me`,
    `${options.keyPasswordEnv}=replace-me`,
    `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=${options.playServiceAccount}`
  ];
  const content = `${lines.join('\n')}\n`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const merged = lines.filter((line) => !existing.includes(line));
  if (merged.length > 0) {
    const needsBreak = existing.length > 0 && !existing.endsWith('\n');
    fs.appendFileSync(filePath, `${needsBreak ? '\n' : ''}${merged.join('\n')}\n`);
  }
}

function ensureGitignoreEntries(filePath: string, entries: string[]): void {
  const normalizedEntries = entries.map((entry) => entry.replace(/\\/g, '/'));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${normalizedEntries.join('\n')}\n`);
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const toAppend = normalizedEntries.filter((entry) => !existing.includes(entry));
  if (toAppend.length === 0) return;
  const needsBreak = existing.length > 0 && !existing.endsWith('\n');
  fs.appendFileSync(filePath, `${needsBreak ? '\n' : ''}${toAppend.join('\n')}\n`);
}

function inferGithubRepo(cwd: string): string | null {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { repository?: string | { url?: string } };
    const repositoryUrl = typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url;
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

function findConfigPath(cwd: string): string | null {
  for (const candidate of CONFIG_CANDIDATES) {
    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function ensureProperty(source: string, pathSegments: string[], propertyName: string, value: unknown): string {
  let current = source;
  for (let index = 0; index < pathSegments.length; index += 1) {
    const parentPath = pathSegments.slice(0, index);
    const segment = pathSegments[index];
    current = ensureObjectProperty(current, parentPath, segment);
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
  const propertyPattern = new RegExp(`(^|\\n)\\s*${escapeRegExp(propertyName)}\\s*:`, 'm');
  return propertyPattern.test(objectBody);
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

    if (inSingle || inDouble || inTemplate) {
      continue;
    }

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
  const indentMatch = line.match(/^\s*/);
  return indentMatch?.[0] || '';
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

export default plugin;
export { plugin };
