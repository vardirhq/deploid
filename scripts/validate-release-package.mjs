import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const releaseDir = path.resolve(process.argv[2] || '.release/cli');
const artifactsDir = path.join(path.dirname(releaseDir), 'artifacts');
const maxTarballBytes = 2_000_000;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...options
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

rmSync(artifactsDir, { recursive: true, force: true });
mkdirSync(artifactsDir, { recursive: true });
run('pnpm', ['pack', '--pack-destination', artifactsDir], { cwd: releaseDir });

const tarballs = readdirSync(artifactsDir).filter((file) => file.endsWith('.tgz'));
assert(tarballs.length === 1, `Expected one tarball, found ${tarballs.length}`);
const tarball = path.join(artifactsDir, tarballs[0]);
const tarballBytes = statSync(tarball).size;
assert(tarballBytes < maxTarballBytes, `Tarball is ${tarballBytes} bytes; limit is ${maxTarballBytes}`);

const contents = run('tar', ['-tzf', tarball]).replaceAll('\\', '/');
for (const required of [
  'package/dist/internal/core/index.js',
  'package/dist/internal/plugins/assets/index.js',
  'package/dist/internal/plugins/publish/index.js'
]) {
  assert(contents.includes(required), `Tarball is missing ${required}`);
}

const smokeRoot = mkdtempSync(path.join(tmpdir(), 'deploid-package-smoke-'));
run('npm', ['install', '--prefix', smokeRoot, tarball]);
const cliEntrypoint = path.join(smokeRoot, 'node_modules', '@deploid', 'cli', 'bin', 'deploid');
const version = run(process.execPath, [cliEntrypoint, '--version']).trim();
assert(/^\d+\.\d+\.\d+/.test(version), `Unexpected CLI version output: ${version}`);

writeFileSync(
  path.join(smokeRoot, 'deploid.config.mjs'),
  "export default { appName: 'Smoke', appId: 'com.example.smoke', web: { framework: 'static', buildCommand: 'true', webDir: 'public' }, android: { packaging: 'capacitor' } };\n"
);
const pluginList = run(process.execPath, [cliEntrypoint, 'plugin', '--list'], { cwd: smokeRoot });
assert(pluginList.includes('Built in'), 'Installed CLI did not report built-in modules');

writeFileSync(
  path.join(smokeRoot, 'api-check.mjs'),
  "import * as api from '@deploid/cli'; if (typeof api.runPluginCommand !== 'function') process.exit(1);\n"
);
run(process.execPath, ['api-check.mjs'], { cwd: smokeRoot });

if (process.env.DEPLOID_VALIDATE_INIT === 'true') {
  const projectDir = path.join(smokeRoot, 'initialized-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(path.join(projectDir, 'package.json'), '{"name":"deploid-smoke-app","version":"1.0.0","private":true}\n');
  run(process.execPath, [
    cliEntrypoint, 'init', '--yes', '--framework', 'static',
    '--app-name', 'Smoke App', '--app-id', 'com.example.smokeapp'
  ], { cwd: projectDir, stdio: 'inherit' });

  const generatedConfig = readFileSync(path.join(projectDir, 'deploid.config.ts'), 'utf8');
  const projectPackage = JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const projectDeps = { ...projectPackage.dependencies, ...projectPackage.devDependencies };
  assert(generatedConfig.includes("from '@deploid/cli'"), 'Generated config does not use the public CLI type API');
  assert(projectDeps['@capacitor/core'], 'Initialized project is missing @capacitor/core');
  assert(projectDeps['@capacitor/android'], 'Initialized project is missing @capacitor/android');
  assert(!Object.keys(projectDeps).some((name) => name.startsWith('@deploid/plugin-')), 'Initialized project installed a built-in plugin package');
}

console.log(JSON.stringify({
  platform: process.platform,
  version,
  tarballBytes,
  files: contents.trim().split(/\r?\n/).length,
  initializedProject: process.env.DEPLOID_VALIDATE_INIT === 'true'
}, null, 2));
