import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface PluginInitOptions {
  dir?: string;
  force?: boolean;
}

interface PluginValidateOptions {
  json?: boolean;
}

interface ValidationResult {
  ok: boolean;
  targetDir: string;
  checks: Array<{
    id: string;
    status: 'pass' | 'fail';
    message: string;
  }>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPackageJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string;
};
const cliPeerVersion = `^${cliPackageJson.version}`;

export async function initPluginScaffold(rawName: string, options: PluginInitOptions = {}): Promise<void> {
  const pluginKey = normalizePluginKey(rawName);
  const packageName = `@deploid/plugin-${pluginKey}`;
  const targetDir = path.resolve(process.cwd(), options.dir || path.join('plugins', pluginKey));

  if (fs.existsSync(targetDir) && !options.force) {
    throw new Error(`Plugin directory already exists: ${targetDir}. Use --force to overwrite.`);
  }

  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  writeFile(targetDir, 'package.json', renderPackageJson(packageName));
  writeFile(targetDir, 'tsconfig.json', renderTsconfig());
  writeFile(targetDir, path.join('src', 'index.ts'), renderPluginSource(pluginKey));
  writeFile(targetDir, 'README.md', renderReadme(packageName, pluginKey));

  console.log(`Created plugin scaffold at ${targetDir}`);
  console.log(`Next steps:`);
  console.log(`  1. cd ${targetDir}`);
  console.log(`  2. npm install`);
  console.log(`  3. npm run build`);
  console.log(`  4. deploid plugin validate ${targetDir}`);
}

export async function validatePluginScaffold(rawTarget: string | undefined, options: PluginValidateOptions = {}): Promise<void> {
  const targetDir = path.resolve(process.cwd(), rawTarget || '.');
  const result = inspectPluginScaffold(targetDir);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Deploid Plugin Validation');
    console.log(`Target: ${targetDir}`);
    for (const check of result.checks) {
      console.log(`${check.status.toUpperCase().padEnd(4, ' ')} ${check.message}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

function inspectPluginScaffold(targetDir: string): ValidationResult {
  const checks: ValidationResult['checks'] = [];
  const packageJsonPath = path.join(targetDir, 'package.json');
  const tsconfigPath = path.join(targetDir, 'tsconfig.json');
  const srcIndexPath = path.join(targetDir, 'src', 'index.ts');
  const readmePath = path.join(targetDir, 'README.md');

  checks.push(existsCheck('package-json', packageJsonPath, 'package.json exists.'));
  checks.push(existsCheck('tsconfig', tsconfigPath, 'tsconfig.json exists.'));
  checks.push(existsCheck('entrypoint', srcIndexPath, 'src/index.ts exists.'));
  checks.push(existsCheck('readme', readmePath, 'README.md exists.'));

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>;
      const name = String(packageJson.name || '');
      const main = String(packageJson.main || '');
      const type = String(packageJson.type || '');
      const hasCliPeer = Boolean(
        (packageJson.peerDependencies as Record<string, unknown> | undefined)?.['@deploid/cli']
      );
      checks.push(name.startsWith('@deploid/plugin-')
        ? pass('package-name', `package.json name uses the @deploid/plugin-* convention (${name}).`)
        : fail('package-name', 'package.json name should start with @deploid/plugin-.'));
      checks.push(main === 'dist/index.js'
        ? pass('package-main', 'package.json main points to dist/index.js.')
        : fail('package-main', 'package.json main should be dist/index.js.'));
      checks.push(type === 'module'
        ? pass('package-type', 'package.json type is module.')
        : fail('package-type', 'package.json type should be module.'));
      checks.push(hasCliPeer
        ? pass('cli-peer', '@deploid/cli peer dependency is present.')
        : fail('cli-peer', '@deploid/cli peer dependency is missing.'));
    } catch (error) {
      checks.push(fail('package-parse', `package.json is not valid JSON: ${String(error)}`));
    }
  }

  if (fs.existsSync(srcIndexPath)) {
    const source = fs.readFileSync(srcIndexPath, 'utf8');
    checks.push(source.includes('name:')
      ? pass('plugin-name', 'src/index.ts defines a plugin name.')
      : fail('plugin-name', 'src/index.ts should define a plugin name.'));
    checks.push(source.includes('run:')
      ? pass('plugin-run', 'src/index.ts defines a run handler.')
      : fail('plugin-run', 'src/index.ts should define a run handler.'));
    checks.push(source.includes('DeploidPlugin')
      ? pass('plugin-type', 'src/index.ts references DeploidPlugin typing.')
      : fail('plugin-type', 'src/index.ts should type the plugin as DeploidPlugin.'));
  }

  return {
    ok: checks.every((check) => check.status === 'pass'),
    targetDir,
    checks
  };
}

function normalizePluginKey(rawName: string): string {
  return rawName
    .trim()
    .replace(/^@deploid\/plugin-/, '')
    .replace(/^plugin-/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function writeFile(targetDir: string, relativePath: string, contents: string): void {
  const fullPath = path.join(targetDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, 'utf8');
}

function renderPackageJson(packageName: string): string {
  return `${JSON.stringify({
    name: packageName,
    version: '0.1.0',
    private: false,
    publishConfig: {
      access: 'public'
    },
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    files: ['dist/', 'README.md'],
    scripts: {
      build: 'tsc -p tsconfig.json'
    },
    peerDependencies: {
      '@deploid/cli': cliPeerVersion
    },
    devDependencies: {
      typescript: '^5.9.3'
    }
  }, null, 2)}\n`;
}

function renderTsconfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
`;
}

function renderPluginSource(pluginKey: string): string {
  return `import type { DeploidPlugin } from '@deploid/cli';

const plugin: DeploidPlugin = {
  name: '${pluginKey}',
  requirements: ['Node.js 18+'],
  plan: async () => [
    'Inspect the current project state',
    'Apply your custom workflow logic',
    'Report actionable output to the caller'
  ],
  run: async (ctx) => {
    ctx.logger.info('Replace this with your plugin implementation.');
    ctx.logger.info(\`Running ${pluginKey} in \${ctx.cwd}\`);
  }
};

export default plugin;
export { plugin };
`;
}

function renderReadme(packageName: string, pluginKey: string): string {
  return `# ${packageName}

Starter template for a custom Deploid plugin.

## Commands

\`\`\`bash
npm install
npm run build
deploid plugin validate .
\`\`\`

## Local usage

Build the plugin and install it into a Deploid project:

\`\`\`bash
npm install ${packageName}
\`\`\`

Then invoke it through the shared plugin contract under the key \`${pluginKey}\`.
`;
}

function existsCheck(id: string, targetPath: string, message: string) {
  return fs.existsSync(targetPath) ? pass(id, message) : fail(id, `Missing ${path.basename(targetPath)}.`);
}

function pass(id: string, message: string) {
  return { id, status: 'pass' as const, message };
}

function fail(id: string, message: string) {
  return { id, status: 'fail' as const, message };
}
