import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve(process.argv[2] || 'release');

function firstDirectory(pattern) {
  const name = fs.readdirSync(releaseDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && pattern.test(entry.name))?.name;
  if (!name) throw new Error(`Could not find packaged directory matching ${pattern}`);
  return path.join(releaseDir, name);
}

let executable;
let resources;
if (process.platform === 'darwin') {
  const output = firstDirectory(/^mac/);
  const appName = fs.readdirSync(output).find((name) => name.endsWith('.app'));
  if (!appName) throw new Error('Could not find packaged macOS app');
  const contents = path.join(output, appName, 'Contents');
  executable = path.join(contents, 'MacOS', 'Deploid');
  resources = path.join(contents, 'Resources');
} else {
  const output = firstDirectory(process.platform === 'win32' ? /^win-/ : /^linux-/);
  executable = path.join(output, process.platform === 'win32' ? 'deploid.exe' : 'deploid');
  resources = path.join(output, 'resources');
}

const cliEntry = path.join(
  resources,
  'app.asar.unpacked',
  'node_modules',
  '@deploid',
  'cli',
  'dist',
  'index.js'
);

for (const required of [executable, cliEntry]) {
  if (!fs.existsSync(required)) throw new Error(`Missing packaged runtime file: ${required}`);
}

const result = spawnSync(executable, [cliEntry, '--version'], {
  encoding: 'utf8',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  timeout: 30_000
});
if (result.status !== 0 || !/\d+\.\d+\.\d+/.test(result.stdout || '')) {
  throw new Error(`Bundled CLI smoke test failed (${result.status}): ${result.stderr || result.stdout}`);
}

console.log(`Validated bundled CLI ${result.stdout.trim()} via ${path.basename(executable)}`);
