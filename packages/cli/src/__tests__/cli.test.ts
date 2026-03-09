import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliEntry = path.resolve(__dirname, '../../dist/index.js');
const packageJsonPath = path.resolve(__dirname, '../../package.json');

function runCli(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  const captureDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'deploid-cli-capture-'));
  const stdoutPath = path.join(captureDir, 'stdout.txt');
  const stderrPath = path.join(captureDir, 'stderr.txt');
  const escapedCliEntry = shellEscape(cliEntry);
  const command = `node ${escapedCliEntry}${args.length ? ` ${args.map(shellEscape).join(' ')}` : ''} > ${shellEscape(stdoutPath)} 2> ${shellEscape(stderrPath)}`;

  const result = spawnSync('/usr/bin/bash', ['-lc', command], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env
    }
  });

  const stdout = fsSync.existsSync(stdoutPath) ? fsSync.readFileSync(stdoutPath, 'utf8') : '';
  const stderr = fsSync.existsSync(stderrPath) ? fsSync.readFileSync(stderrPath, 'utf8') : '';
  fsSync.rmSync(captureDir, { recursive: true, force: true });

  return {
    stdout,
    stderr,
    exitCode: result.status ?? 0
  };
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

describe('Deploid CLI', () => {
  it('should show help when run without arguments', async () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('Build -> package -> sign -> publish web apps to Android');
  });

  it('should show version', async () => {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const { stdout } = runCli(['--version']);
    expect(stdout).toContain(pkg.version);
  });

  it('should list available commands', async () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('doctor');
    expect(stdout).toContain('init');
    expect(stdout).toContain('release');
    expect(stdout).toContain('assets');
    expect(stdout).toContain('package');
    expect(stdout).toContain('build');
    expect(stdout).toContain('deploy');
    expect(stdout).toContain('firebase');
  });

  it('should report missing project files in doctor project-only mode', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-doctor-empty-'));

    const { stdout, exitCode } = runCli(['doctor', '--project-only', '--json'], {
      cwd: tmpDir,
    });

    const report = JSON.parse(stdout);
    expect(exitCode).not.toBe(0);
    expect(report.ok).toBe(false);
    expect(report.checks.some((check: { id: string; status: string }) => check.id === 'deploid-config' && check.status === 'fail')).toBe(true);
  });

  it('should pass doctor project-only mode for a minimal valid project', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-doctor-valid-'));
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'doctor-fixture', dependencies: { '@capacitor/core': '^7.0.0' } }, null, 2)
    );
    await fs.mkdir(path.join(tmpDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'assets', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'DoctorApp',
  appId: 'com.example.doctorapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' },
  assets: { source: 'assets/logo.svg' }
};\n`
    );

    const { stdout, exitCode } = runCli(['doctor', '--project-only', '--json'], {
      cwd: tmpDir,
    });

    const report = JSON.parse(stdout);
    expect(exitCode).toBe(0);
    expect(report.ok).toBe(true);
    expect(Array.isArray(report.workflows)).toBe(true);
    expect(report.checks.some((check: { id: string; status: string }) => check.id === 'package-json' && check.status === 'pass')).toBe(true);
  });

  it('should apply safe fixes in doctor fix mode', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-doctor-fix-'));
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'doctor-fix-fixture',
        repository: { type: 'git', url: 'https://github.com/acme/doctor-fix.git' },
        scripts: { build: 'vite build' }
      }, null, 2)
    );
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'DoctorFix',
  appId: 'com.example.doctorfix',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' },
  assets: { source: 'assets/logo.svg' }
};\n`
    );

    const { stdout } = runCli(['doctor', '--project-only', '--fix', '--json'], {
      cwd: tmpDir
    });

    const report = JSON.parse(stdout);
    const updatedConfig = await fs.readFile(path.join(tmpDir, 'deploid.config.mjs'), 'utf8');
    const envExample = await fs.readFile(path.join(tmpDir, '.env.deploid.example'), 'utf8');
    const gitignore = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf8');
    expect(Array.isArray(report.fixes)).toBe(true);
    expect(report.fixes.some((fix: { status: string }) => fix.status === 'applied')).toBe(true);
    expect(fsSync.existsSync(path.join(tmpDir, 'assets'))).toBe(true);
    expect(fsSync.existsSync(path.join(tmpDir, 'capacitor.config.json'))).toBe(true);
    expect(updatedConfig).toContain("signing: {");
    expect(updatedConfig).toContain("version: {");
    expect(updatedConfig).toContain("repo: 'acme/doctor-fix'");
    expect(updatedConfig).toContain("serviceAccountJson: 'secrets/play-service-account.json'");
    expect(envExample).toContain('DEPLOID_ANDROID_STORE_PASSWORD=replace-me');
    expect(gitignore).toContain('secrets/play-service-account.json');
  });

  it('should scaffold release config and env templates', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-release-init-'));
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'release-init-fixture',
        repository: { type: 'git', url: 'https://github.com/acme/ninegrid.git' }
      }, null, 2)
    );
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'NineGrid',
  appId: 'com.example.ninegrid',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' }
};\n`
    );

    const { stdout, exitCode } = runCli(['release', 'init', '--yes'], {
      cwd: tmpDir
    });

    const updatedConfig = await fs.readFile(path.join(tmpDir, 'deploid.config.mjs'), 'utf8');
    const envExample = await fs.readFile(path.join(tmpDir, '.env.deploid.example'), 'utf8');
    const gitignore = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf8');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Release init complete');
    expect(updatedConfig).toContain("signing: {");
    expect(updatedConfig).toContain("keystorePath: 'secrets/android-upload-keystore.jks'");
    expect(updatedConfig).toContain("repo: 'acme/ninegrid'");
    expect(updatedConfig).toContain("track: 'internal'");
    expect(envExample).toContain('DEPLOID_ANDROID_STORE_PASSWORD=replace-me');
    expect(gitignore).toContain('secrets/android-upload-keystore.jks');
    expect(fsSync.existsSync(path.join(tmpDir, 'secrets'))).toBe(true);
  });

  it('should resolve publish dry-run for github releases', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-publish-dry-run-'));
    const artifactDir = path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release');
    await fs.mkdir(artifactDir, { recursive: true });
    await fs.writeFile(path.join(artifactDir, 'app-release.aab'), 'release-binary');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'PublishApp',
  appId: 'com.example.publishapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: {
    packaging: 'capacitor',
    version: { code: 7, name: '1.2.3' },
    build: { buildType: 'aab' }
  },
  publish: {
    github: { repo: 'acme/publish-app', draft: true }
  }
};\n`
    );

    const { stdout, exitCode } = runCli(['publish', '--dry-run', '--target', 'github'], {
      cwd: tmpDir
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('publish dry-run: github');
    expect(stdout).toContain('app-release.aab');
    expect(stdout).toContain('tag: v1.2.3');
    expect(stdout).toContain('github repo: acme/publish-app');
  });

  it('should list artifacts as json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-artifacts-list-'));
    await fs.mkdir(path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'assets-gen'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'), 'bundle');
    await fs.writeFile(path.join(tmpDir, 'assets-gen', 'icon-192.png'), 'asset');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'ArtifactsApp',
  appId: 'com.example.artifactsapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' },
  assets: { source: 'assets/logo.svg', output: 'assets-gen' }
};\n`
    );

    const { stdout, exitCode } = runCli(['artifacts', 'list', '--json'], { cwd: tmpDir });
    const payload = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(Array.isArray(payload.artifacts)).toBe(true);
    expect(payload.artifacts.some((artifact: { kind: string; exists: boolean }) => artifact.kind === 'android-release-aab' && artifact.exists)).toBe(true);
    expect(payload.artifacts.some((artifact: { kind: string; exists: boolean }) => artifact.kind === 'assets' && artifact.exists)).toBe(true);
  });

  it('should support artifacts flag aliases on the parent command', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-artifacts-flag-list-'));
    await fs.mkdir(path.join(tmpDir, 'dist-electron'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'dist-electron', 'app.exe'), 'desktop');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'ArtifactsFlagsApp',
  appId: 'com.example.artifactsflagsapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' }
};\n`
    );

    const { stdout, exitCode } = runCli(['artifacts', '--list', '--kind', 'desktop', '--json'], { cwd: tmpDir });
    const payload = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(Array.isArray(payload.artifacts)).toBe(true);
    expect(payload.artifacts).toHaveLength(1);
    expect(payload.artifacts[0].kind).toBe('desktop');
    expect(payload.artifacts[0].exists).toBe(true);
  });

  it('should clean artifacts with dry-run and actual removal', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-artifacts-clean-'));
    await fs.mkdir(path.join(tmpDir, 'dist-electron'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'dist-electron', 'app.exe'), 'desktop');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'ArtifactsApp',
  appId: 'com.example.artifactsapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' }
};\n`
    );

    const dryRun = runCli(['artifacts', 'clean', '--kind', 'desktop', '--dry-run'], { cwd: tmpDir });
    expect(dryRun.exitCode).toBe(0);
    expect(dryRun.stdout).toContain('artifact clean dry-run: 1 target(s)');
    expect(fsSync.existsSync(path.join(tmpDir, 'dist-electron'))).toBe(true);

    const actual = runCli(['artifacts', 'clean', '--kind', 'desktop'], { cwd: tmpDir });
    expect(actual.exitCode).toBe(0);
    expect(actual.stdout).toContain('Removed 1 artifact target(s).');
    expect(fsSync.existsSync(path.join(tmpDir, 'dist-electron'))).toBe(false);
  });

  it('should scaffold and validate a plugin package', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-plugin-init-'));

    const init = runCli(['plugin', 'init', 'hello-world', '--dir', 'custom-plugin'], { cwd: tmpDir });
    expect(init.exitCode).toBe(0);
    expect(init.stdout).toContain('Created plugin scaffold');
    expect(fsSync.existsSync(path.join(tmpDir, 'custom-plugin', 'src', 'index.ts'))).toBe(true);

    const validate = runCli(['plugin', 'validate', 'custom-plugin', '--json'], { cwd: tmpDir });
    const report = JSON.parse(validate.stdout);
    expect(validate.exitCode).toBe(0);
    expect(report.ok).toBe(true);
    expect(report.checks.some((check: { id: string; status: string }) => check.id === 'package-name' && check.status === 'pass')).toBe(true);
  });

  it('should dry-run a version bump as json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-version-plan-'));
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'version-fixture', version: '1.2.3' }, null, 2)
    );
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'VersionApp',
  appId: 'com.example.versionapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: {
    packaging: 'capacitor',
    version: { code: 7, name: '1.2.3' }
  }
};\n`
    );

    const { stdout, exitCode } = runCli(['version', '--minor', '--dry-run', '--json'], { cwd: tmpDir });
    const plan = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(plan.previousVersionName).toBe('1.2.3');
    expect(plan.nextVersionName).toBe('1.3.0');
    expect(plan.previousCode).toBe(7);
    expect(plan.nextCode).toBe(8);
  });

  it('should update config, package version, and release notes', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-version-apply-'));
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'version-apply', version: '1.2.3' }, null, 2)
    );
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'VersionApp',
  appId: 'com.example.versionapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: {
    packaging: 'capacitor',
    version: { code: 7, name: '1.2.3' }
  }
};\n`
    );

    const { stdout, exitCode } = runCli(['version', '2.0.0', '--code', '10'], { cwd: tmpDir });
    const updatedPackage = JSON.parse(await fs.readFile(path.join(tmpDir, 'package.json'), 'utf8'));
    const updatedConfig = await fs.readFile(path.join(tmpDir, 'deploid.config.mjs'), 'utf8');
    const releaseNotes = await fs.readFile(path.join(tmpDir, 'RELEASE_NOTES.md'), 'utf8');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Updated version to 2.0.0 (10).');
    expect(updatedPackage.version).toBe('2.0.0');
    expect(updatedConfig).toContain("code: 10");
    expect(updatedConfig).toContain("name: '2.0.0'");
    expect(releaseNotes).toContain('# VersionApp 2.0.0');
  });

  it('should generate a github actions workflow and secrets guide', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-ci-init-'));
    await fs.writeFile(
      path.join(tmpDir, 'pnpm-lock.yaml'),
      'lockfileVersion: 9.0\n'
    );
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'CiApp',
  appId: 'com.example.ciapp',
  web: { framework: 'vite', buildCommand: 'pnpm run build', webDir: 'dist' },
  android: {
    packaging: 'capacitor',
    signing: {
      keystorePath: 'secrets/upload.jks',
      alias: 'ci-app',
      storePasswordEnv: 'DEPLOID_ANDROID_STORE_PASSWORD',
      keyPasswordEnv: 'DEPLOID_ANDROID_KEY_PASSWORD'
    }
  },
  publish: {
    github: { repo: 'acme/ci-app', draft: true }
  }
};\n`
    );

    const { stdout, exitCode } = runCli(['ci', 'init', 'github'], { cwd: tmpDir });
    const workflow = await fs.readFile(path.join(tmpDir, '.github', 'workflows', 'deploid-release.yml'), 'utf8');
    const guide = await fs.readFile(path.join(tmpDir, '.github', 'DEPLOID_SECRETS.md'), 'utf8');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Created .github/workflows/deploid-release.yml.');
    expect(workflow).toContain('uses: pnpm/action-setup@v4');
    expect(workflow).toContain('run: deploid doctor --summary');
    expect(workflow).toContain('run: deploid version --patch');
    expect(workflow).toContain('run: deploid publish --target github --notes-file RELEASE_NOTES.md');
    expect(guide).toContain('DEPLOID_ANDROID_STORE_PASSWORD');
    expect(guide).toContain('Suggested Flow');
  });

  it('should print a ship workflow plan in dry-run mode', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-ship-plan-'));
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'ShipApp',
  appId: 'com.example.shipapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: {
    packaging: 'capacitor',
    version: { code: 3, name: '1.2.3' }
  },
  publish: {
    github: { repo: 'acme/ship-app', draft: true }
  }
};\n`
    );

    const { stdout, exitCode } = runCli(['ship', '--patch', '--from-git', '--target', 'github', '--dry-run'], {
      cwd: tmpDir
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Deploid Ship Plan');
    expect(stdout).toContain('1. Doctor: deploid doctor --summary');
    expect(stdout).toContain('2. Assets: deploid assets');
    expect(stdout).toContain('3. Package: deploid package');
    expect(stdout).toContain('4. Version: deploid version --patch');
    expect(stdout).toContain('5. Build: deploid build');
    expect(stdout).toContain('6. Changelog: deploid changelog --from-git');
    expect(stdout).toContain('7. Publish: deploid publish --target github');
  });

  it('should dry-run changelog generation as json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-changelog-plan-'));
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'NotesApp',
  appId: 'com.example.notesapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor', version: { code: 10, name: '2.0.0' } }
};\n`
    );
    await fs.writeFile(
      path.join(tmpDir, 'RELEASE_NOTES.md'),
      `# NotesApp 2.0.0

## Highlights

- Added release automation
`
    );

    const { stdout, exitCode } = runCli(['changelog', '--dry-run', '--json'], { cwd: tmpDir });
    const plan = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(plan.version).toBe('2.0.0');
    expect(plan.notesPath).toContain('RELEASE_NOTES.md');
    expect(plan.changelogPath).toContain('CHANGELOG.md');
  });

  it('should write changelog entries with optional git commits', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-changelog-apply-'));
    const binDir = path.join(tmpDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      path.join(binDir, 'git'),
      `#!/usr/bin/env bash
if [ "$1" = "describe" ]; then
  printf 'v1.9.0\\n'
  exit 0
fi
if [ "$1" = "log" ]; then
  printf 'Add release automation\\nFix android signing docs\\n'
  exit 0
fi
exit 0
`
    );
    await fs.chmod(path.join(binDir, 'git'), 0o755);
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'NotesApp',
  appId: 'com.example.notesapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor', version: { code: 10, name: '2.0.0' } }
};\n`
    );
    await fs.writeFile(
      path.join(tmpDir, 'RELEASE_NOTES.md'),
      `# NotesApp 2.0.0

## Highlights

- Added release automation
`
    );

    const { stdout, exitCode } = runCli(['changelog', '--from-git'], {
      cwd: tmpDir,
      env: { PATH: `${binDir}:${process.env.PATH || ''}` }
    });
    const changelog = await fs.readFile(path.join(tmpDir, 'CHANGELOG.md'), 'utf8');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Updated CHANGELOG.md for 2.0.0.');
    expect(changelog).toContain('## [2.0.0]');
    expect(changelog).toContain('### Commits');
    expect(changelog).toContain('- Add release automation');
    expect(changelog).toContain('- Fix android signing docs');
  });

  it('should list devices as json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-devices-json-'));
    const binDir = path.join(tmpDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(
      path.join(binDir, 'adb'),
      `#!/usr/bin/env bash
if [ "$1" = "devices" ]; then
  printf 'List of devices attached\\nemulator-5554\\tdevice\\npixel-usb\\tdevice\\n'
  exit 0
fi
if [ "$1" = "version" ]; then
  printf 'Android Debug Bridge version 1.0.41\\n'
  exit 0
fi
exit 0
`
    );
    await fs.chmod(path.join(binDir, 'adb'), 0o755);

    const { stdout, exitCode } = runCli(['devices', '--json'], {
      cwd: tmpDir,
      env: { PATH: `${binDir}:${process.env.PATH || ''}` }
    });

    const payload = JSON.parse(stdout);
    expect(exitCode).toBe(0);
    expect(payload.devices).toHaveLength(2);
    expect(payload.devices[0].id).toBe('emulator-5554');
  });

  it('should deploy to a specific device only', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-deploy-device-'));
    const binDir = path.join(tmpDir, 'bin');
    const logPath = path.join(tmpDir, 'adb-invocations.log');
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), 'apk');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'DeployApp',
  appId: 'com.example.deployapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' }
};\n`
    );
    await fs.writeFile(
      path.join(binDir, 'adb'),
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${logPath}"
if [ "$1" = "version" ]; then
  printf 'Android Debug Bridge version 1.0.41\\n'
  exit 0
fi
if [ "$1" = "devices" ]; then
  printf 'List of devices attached\\nemulator-5554\\tdevice\\npixel-usb\\tdevice\\n'
  exit 0
fi
if [ "$1" = "-s" ] && [ "$3" = "install" ]; then
  printf 'Success\\n'
  exit 0
fi
if [ "$1" = "-s" ] && [ "$3" = "shell" ]; then
  printf 'Starting\\n'
  exit 0
fi
if [ "$1" = "-s" ] && [ "$3" = "logcat" ]; then
  exit 0
fi
exit 0
`
    );
    await fs.chmod(path.join(binDir, 'adb'), 0o755);

    const { stdout, exitCode } = runCli(['deploy', '--device', 'pixel-usb', '--launch'], {
      cwd: tmpDir,
      env: { PATH: `${binDir}:${process.env.PATH || ''}` }
    });

    const invocations = await fs.readFile(logPath, 'utf8');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Successfully deployed to pixel-usb');
    expect(invocations).toContain('-s pixel-usb install -r');
    expect(invocations).not.toContain('-s emulator-5554 install -r');
  });

  it('should serve daemon health and artifacts endpoints', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-daemon-'));
    await fs.mkdir(path.join(tmpDir, 'dist-electron'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'dist-electron', 'app.exe'), 'desktop');
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'DaemonApp',
  appId: 'com.example.daemonapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'capacitor' }
};\n`
    );

    const port = 49650 + Math.floor(Math.random() * 500);
    const child = spawn('node', [cliEntry, 'daemon', '--port', String(port)], {
      cwd: tmpDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });

    const ready = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes('Deploid daemon listening')) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
      child.on('exit', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });

    expect(ready).toBe(true);

    try {
      const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
      const health = await healthResponse.json() as { ok: boolean };
      expect(health.ok).toBe(true);

      const artifactsResponse = await fetch(`http://127.0.0.1:${port}/artifacts?cwd=${encodeURIComponent(tmpDir)}`);
      const payload = await artifactsResponse.json() as { ok: boolean; artifacts: Array<{ kind: string; exists: boolean }> };
      expect(payload.ok).toBe(true);
      expect(payload.artifacts.some((artifact) => artifact.kind === 'desktop' && artifact.exists)).toBe(true);
    } finally {
      child.kill('SIGTERM');
    }
  });

  it('should reject non-capacitor packaging in 2.0', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploid-test-'));
    await fs.writeFile(
      path.join(tmpDir, 'deploid.config.mjs'),
      `export default {
  appName: 'TestApp',
  appId: 'com.example.testapp',
  web: { framework: 'vite', buildCommand: 'npm run build', webDir: 'dist' },
  android: { packaging: 'tauri' }
};\n`
    );

    const { stderr, exitCode } = runCli(['package'], {
      cwd: tmpDir,
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('not supported in Deploid 2.0');
  });
});
