import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const targetDir = process.argv[2];
if (!targetDir) throw new Error('Usage: node scripts/prepare-release.mjs <package-directory>');

const packagePath = join(targetDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const commitMessage = process.env.RELEASE_COMMIT_MESSAGE || execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' });

let currentVersion = packageJson.version;
try {
  currentVersion = execFileSync('npm', ['view', `${packageJson.name}@latest`, 'version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
} catch {
  // The first publish starts from the checked-in package version.
}

const breaking = /BREAKING CHANGE:/i.test(commitMessage) || /^[a-z]+(?:\([^)]*\))?!:/im.test(commitMessage);
const feature = /^feat(?:\([^)]*\))?:/im.test(commitMessage);
const bump = breaking ? 'major' : feature ? 'minor' : 'patch';
const [major, minor, patch] = currentVersion.split('.').map(Number);

if (![major, minor, patch].every(Number.isInteger)) {
  throw new Error(`Cannot derive a release from invalid version: ${currentVersion}`);
}

const nextVersion = bump === 'major'
  ? `${major + 1}.0.0`
  : bump === 'minor'
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

packageJson.version = nextVersion;
delete packageJson.devDependencies;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
process.stdout.write(nextVersion);
