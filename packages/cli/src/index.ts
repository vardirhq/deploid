#!/usr/bin/env node
import { Command } from 'commander';
import { createContext, loadConfig, runPipeline, loadPlugin, runPluginCommand, runDoctorCommand } from '@deploid/core';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();
program
  .name('deploid')
  .description('Build -> package -> sign -> publish web apps to Android')
  .version(packageJson.version);

program
  .command('init')
  .description('Setup config and base folders')
  .option('-f, --framework <framework>', 'Web framework (vite|next|cra|static)', 'vite')
  .option('-p, --packaging <engine>', 'Android packaging engine (capacitor|tauri|twa)', 'capacitor')
  .option('--app-name <name>', 'App display name')
  .option('--app-id <id>', 'App ID / package ID (reverse-domain)')
  .option('--description <text>', 'Project description')
  .option('--author-name <name>', 'Author name')
  .option('--author-email <email>', 'Author email')
  .option('--assets-source <path>', 'Asset source path to store in config')
  .option('--force', 'Overwrite existing deploid.config.ts')
  .option('--all-plugins', 'Install all available plugins without prompts')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const { initProject } = await import('./init.js');
    await initProject(options);
  });

program
  .command('doctor')
  .description('Audit project, workflow, release, and tooling readiness')
  .option('--json', 'Output machine-readable JSON')
  .option('--markdown', 'Output a markdown report')
  .option('--ci', 'Output concise CI-friendly key=value lines')
  .option('--summary', 'Show only workflow summary and non-passing checks')
  .option('--verbose', 'Include passing checks and extra details')
  .option('--project-only', 'Skip environment/toolchain checks and inspect project files only')
  .option('--fix', 'Apply safe automatic fixes before re-running checks')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    await runDoctorCommand({
      cwd: process.cwd(),
      debug: options.debug,
      doctorOptions: {
      json: Boolean(options.json),
      markdown: Boolean(options.markdown),
      ci: Boolean(options.ci),
      summary: Boolean(options.summary),
      verbose: Boolean(options.verbose),
      projectOnly: Boolean(options.projectOnly),
      fix: Boolean(options.fix)
      }
    });
  });

program
  .command('daemon')
  .description('Run a local Deploid HTTP daemon for external apps')
  .option('--host <host>', 'Host interface to bind', '127.0.0.1')
  .option('--port <number>', 'Port to bind', (value) => Number.parseInt(value, 10), 4949)
  .option('--token <token>', 'Optional bearer token required for requests')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const { startDaemon } = await import('./daemon.js');
    await startDaemon({
      host: options.host,
      port: options.port,
      token: options.token,
      debug: options.debug
    });
  });

program
  .command('assets')
  .description('Generate icons and screenshots')
  .option('--source <path>', 'Override assets source for this run (e.g., public/logo.png)')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    const effectiveConfig = options.source
      ? { ...config, assets: { ...(config.assets ?? {}), source: options.source } }
      : config;

    if (options.source) {
      console.log(`Using assets source override: ${options.source}`);
    }

    await runPluginCommand('assets', {
      cwd: process.cwd(),
      config: effectiveConfig,
      debug: options.debug
    });
  });

const artifacts = program
  .command('artifacts')
  .description('Inspect and clean generated artifacts')
  .argument('[action]', 'Artifact action (list|inspect|clean)')
  .option('--list', 'List generated artifacts')
  .option('--inspect', 'Show detailed artifact metadata')
  .option('--clean', 'Remove generated artifacts')
  .option('--kind <kind>', 'Artifact kind (all|android-debug-apk|android-release-apk|android-release-aab|assets|desktop)', 'all')
  .option('--json', 'Emit machine-readable JSON')
  .option('--dry-run', 'Preview artifact cleanup without deleting files')
  .option('--debug', 'Enable debug logging')
  .action(async (action, options) => {
    const actions = [
      typeof action === 'string' && ['list', 'inspect', 'clean'].includes(action) ? action as 'list' | 'inspect' | 'clean' : null,
      options.list ? 'list' : null,
      options.inspect ? 'inspect' : null,
      options.clean ? 'clean' : null
    ].filter(Boolean) as Array<'list' | 'inspect' | 'clean'>;

    if (actions.length === 0) {
      artifacts.outputHelp();
      return;
    }

    if (actions.length > 1) {
      throw new Error('Choose only one of --list, --inspect, or --clean.');
    }

    await runArtifactsCommand(actions[0], options);
  });

program
  .command('package')
  .description('Wrap app for Android (Capacitor/Tauri/TWA)')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    if (config.android.packaging !== 'capacitor') {
      throw new Error(`Packaging engine "${config.android.packaging}" is not supported in Deploid 2.0. Use "capacitor".`);
    }
    await runPluginCommand(`packaging-${config.android.packaging}`, {
      cwd: process.cwd(),
      config,
      debug: options.debug
    });
  });

program
  .command('electron')
  .description('Setup Electron desktop packaging for Windows, macOS, and Linux')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('packaging-electron', {
      cwd: process.cwd(),
      config,
      debug: options.debug
    });
  });

program
  .command('build')
  .description('Build APK/AAB')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('build-android', {
      cwd: process.cwd(),
      config,
      debug: options.debug
    });
  });

program
  .command('version')
  .description('Sync semver, Android version metadata, and release notes scaffolding')
  .argument('[version]', 'Explicit semver version, e.g. 1.2.3')
  .option('--major', 'Bump major version')
  .option('--minor', 'Bump minor version')
  .option('--patch', 'Bump patch version')
  .option('--code <number>', 'Explicit Android versionCode', (value) => Number.parseInt(value, 10))
  .option('--no-sync-package', 'Do not update package.json version')
  .option('--notes-file <path>', 'Release notes scaffold file', 'RELEASE_NOTES.md')
  .option('--dry-run', 'Print the resolved version plan without writing files')
  .option('--json', 'Emit the dry-run plan as JSON')
  .option('--debug', 'Enable debug logging')
  .action(async (version, options) => {
    const config = await loadConfig();
    await runPluginCommand('version', {
      cwd: process.cwd(),
      config,
      debug: options.debug,
      contextExtras: {
        versionOptions: {
          version,
          major: Boolean(options.major),
          minor: Boolean(options.minor),
          patch: Boolean(options.patch),
          code: options.code,
          syncPackage: options.syncPackage,
          notesFile: options.notesFile,
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json)
        }
      }
    });
  });

program
  .command('changelog')
  .description('Create or update CHANGELOG.md entries from release notes and git history')
  .argument('[version]', 'Explicit version to write into the changelog')
  .option('--notes-file <path>', 'Release notes source file', 'RELEASE_NOTES.md')
  .option('--changelog-file <path>', 'Changelog target file', 'CHANGELOG.md')
  .option('--from-git', 'Include commit subjects since the latest git tag')
  .option('--dry-run', 'Print the resolved changelog plan without writing files')
  .option('--json', 'Emit the dry-run plan as JSON')
  .option('--debug', 'Enable debug logging')
  .action(async (version, options) => {
    const config = await loadConfig();
    await runPluginCommand('changelog', {
      cwd: process.cwd(),
      config,
      debug: options.debug,
      contextExtras: {
        changelogOptions: {
          version,
          notesFile: options.notesFile,
          changelogFile: options.changelogFile,
          fromGit: Boolean(options.fromGit),
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json)
        }
      }
    });
  });

program
  .command('ship')
  .description('Run the end-to-end Android release workflow')
  .argument('[version]', 'Optional version to pass through to `deploid version`')
  .option('--major', 'Bump major version before building')
  .option('--minor', 'Bump minor version before building')
  .option('--patch', 'Bump patch version before building')
  .option('--code <number>', 'Explicit Android versionCode for the version step', (value) => Number.parseInt(value, 10))
  .option('--notes-file <path>', 'Release notes file used by version/changelog/publish', 'RELEASE_NOTES.md')
  .option('--changelog-file <path>', 'Changelog target file', 'CHANGELOG.md')
  .option('--from-git', 'Include commit subjects when generating changelog')
  .option('--target <target>', 'Publish target (github|play|all)', 'all')
  .option('--artifact <path>', 'Artifact path override for publish')
  .option('--release-name <name>', 'GitHub release title override')
  .option('--tag <tag>', 'Git tag to publish or create on GitHub')
  .option('--draft', 'Create or keep the GitHub release as draft')
  .option('--latest', 'Mark the GitHub release as latest')
  .option('--no-doctor', 'Skip readiness checks before shipping')
  .option('--no-assets', 'Skip asset generation')
  .option('--no-package', 'Skip Android packaging')
  .option('--no-build', 'Skip Android build')
  .option('--no-changelog', 'Skip changelog generation')
  .option('--no-publish', 'Skip artifact publishing')
  .option('--dry-run', 'Print the workflow plan without executing commands')
  .option('--debug', 'Enable debug logging')
  .action(async (version, options) => {
    await runShipWorkflow(version, options);
  });

program
  .command('debug')
  .description('Add network debugging tools to your project')
  .action(async () => {
    const config = await loadConfig();
    await runPluginCommand('debug-network', {
      cwd: process.cwd(),
      config
    });
  });

program
  .command('deploy')
  .description('Deploy APK to connected Android devices')
  .option('-f, --force', 'Force install (overwrite existing app)')
  .option('-l, --launch', 'Launch app after installation')
  .option('-d, --device <id>', 'Deploy to a specific connected device/emulator')
  .option('--boot-emulator <avd>', 'Boot an Android emulator before deploying')
  .option('--logs', 'Tail app logs after launch')
  .option('--log-filter <tag>', 'Logcat filter/tag to use with --logs')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('deploy-android', {
      cwd: process.cwd(),
      config,
      debug: options.debug,
      contextExtras: {
        deployOptions: {
          force: Boolean(options.force),
          launch: Boolean(options.launch),
          device: options.device,
          bootEmulator: options.bootEmulator,
          logs: Boolean(options.logs),
          logFilter: options.logFilter
        }
      }
    });
  });

program
  .command('devices')
  .description('List connected Android devices')
  .option('--json', 'Output machine-readable JSON')
  .option('--boot <avd>', 'Boot an emulator before listing devices')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const { execa } = await import('execa');
    try {
      if (options.boot) {
        execa('emulator', ['-avd', options.boot], { detached: true, stdio: 'ignore' }).catch(() => undefined);
      }

      const { stdout } = await execa('adb', ['devices'], { stdio: 'pipe' });
      if (options.json) {
        const devices = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('List of devices'))
          .map((line) => {
            const [id, state] = line.split('\t');
            return { id, state };
          });
        console.log(JSON.stringify({ devices }, null, 2));
        return;
      }
      console.log(stdout);
    } catch (error) {
      console.error('❌ ADB not found. Please install Android SDK Platform Tools.');
      console.log('Install: sudo pacman -S android-tools');
    }
  });

program
  .command('logs')
  .description('View app logs from connected device')
  .option('-d, --device <id>', 'Read logs from a specific device/emulator')
  .option('--app-only', 'Filter logcat output to the current app id/tag')
  .option('--filter <tag>', 'Explicit logcat tag/filter to stream')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    const { execa } = await import('execa');
    try {
      const prefix = options.device ? ['-s', options.device] : [];
      const filter = options.filter || (options.appOnly ? config.appId : '');
      await execa('adb', [...prefix, 'logcat', '-c']);
      console.log(filter
        ? `Showing device logs with filter "${filter}"...`
        : `Showing device logs (filter manually for "${config.appName}")...`);
      await execa('adb', [...prefix, 'logcat', ...(filter ? [`${filter}:V`, '*:S'] : [])], { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Failed to view logs:', error);
    }
  });

program
  .command('uninstall')
  .description('Uninstall app from connected devices')
  .option('-d, --device <id>', 'Uninstall from a specific device/emulator')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    const { execa } = await import('execa');
    try {
      const prefix = options.device ? ['-s', options.device] : [];
      await execa('adb', [...prefix, 'uninstall', config.appId], { stdio: 'inherit' });
      console.log(`✅ Uninstalled ${config.appName}${options.device ? ` from ${options.device}` : ' from device'}`);
    } catch (error) {
      console.error('❌ Failed to uninstall:', error);
    }
  });

program
  .command('ios')
  .description('Prepare iOS project for Mac handoff')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('prepare-ios', {
      cwd: process.cwd(),
      config,
      debug: options.debug
    });
  });

program
  .command('ios:assets')
  .description('Generate iOS app icons and launch screens')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    throw new Error('`deploid ios:assets` is not implemented in Deploid 2.0 yet.');
  });

program
  .command('ios:handbook')
  .description('Generate iOS handoff documentation')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('prepare-ios', {
      cwd: process.cwd(),
      config,
      debug: options.debug
    });
  });

program
  .command('firebase')
  .description('Setup Firebase for push notifications')
  .option('--project-id <id>', 'Firebase project ID')
  .option('--auto-create', 'Auto-create Firebase project')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const { setupFirebase } = await import('./firebase.js');
    await setupFirebase(options);
  });

const plugin = program
  .command('plugin')
  .description('Manage Deploid plugins');

plugin
  .option('--list', 'List available plugins')
  .option('--install <plugin>', 'Install a specific plugin')
  .option('--remove <plugin>', 'Remove a plugin')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const { managePlugins } = await import('./plugin-manager.js');
    await managePlugins(options);
  });

plugin
  .command('init')
  .description('Scaffold a new Deploid plugin package')
  .argument('<name>', 'Plugin key or package suffix')
  .option('--dir <path>', 'Target directory for the plugin scaffold')
  .option('--force', 'Overwrite an existing target directory')
  .action(async (name, options) => {
    const { initPluginScaffold } = await import('./plugin-tools.js');
    await initPluginScaffold(name, options);
  });

plugin
  .command('validate')
  .description('Validate a Deploid plugin package scaffold')
  .argument('[path]', 'Plugin directory to validate', '.')
  .option('--json', 'Emit machine-readable validation output')
  .action(async (targetPath, options) => {
    const { validatePluginScaffold } = await import('./plugin-tools.js');
    await validatePluginScaffold(targetPath, options);
  });

const release = program
  .command('release')
  .description('Release workflow helpers');

release
  .command('init')
  .description('Scaffold signing, versioning, and publish config for release workflows')
  .option('-y, --yes', 'Apply recommended defaults without prompts')
  .option('--keystore-path <path>', 'Path to the Android release keystore', 'secrets/android-upload-keystore.jks')
  .option('--alias <name>', 'Android keystore alias')
  .option('--store-password-env <name>', 'Env var name for the keystore password', 'DEPLOID_ANDROID_STORE_PASSWORD')
  .option('--key-password-env <name>', 'Env var name for the key password', 'DEPLOID_ANDROID_KEY_PASSWORD')
  .option('--github-repo <owner/repo>', 'GitHub repository for release publishing')
  .option('--play-track <track>', 'Play Console track (internal|alpha|beta|production)', 'internal')
  .option('--play-service-account <path>', 'Path to the Play service account json', 'secrets/play-service-account.json')
  .option('--build-type <type>', 'Release artifact preference (apk|aab|both)', 'aab')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('release-init', {
      cwd: process.cwd(),
      config,
      debug: options.debug,
      contextExtras: {
        releaseInitOptions: {
          yes: Boolean(options.yes),
          keystorePath: options.keystorePath,
          alias: options.alias,
          storePasswordEnv: options.storePasswordEnv,
          keyPasswordEnv: options.keyPasswordEnv,
          githubRepo: options.githubRepo,
          playTrack: options.playTrack,
          playServiceAccount: options.playServiceAccount,
          buildType: options.buildType
        }
      }
    });
  });

const ci = program
  .command('ci')
  .description('CI/CD workflow generators');

ci
  .command('init')
  .description('Generate CI workflow scaffolding')
  .argument('<provider>', 'CI provider (github)')
  .option('--workflow-name <name>', 'GitHub Actions workflow name', 'Deploid Release')
  .option('--node-version <version>', 'Node.js version for CI', '20')
  .option('--java-version <version>', 'Java version for CI', '21')
  .option('--package-manager <name>', 'Package manager override (auto|npm|pnpm|yarn|bun)', 'auto')
  .option('--no-include-version', 'Do not run `deploid version --patch` in CI')
  .option('--force', 'Overwrite existing generated CI files')
  .option('--debug', 'Enable debug logging')
  .action(async (provider, options) => {
    const config = await loadConfig();
    await runPluginCommand('ci-init', {
      cwd: process.cwd(),
      config,
      debug: options.debug,
      contextExtras: {
        ciInitOptions: {
          provider,
          workflowName: options.workflowName,
          nodeVersion: options.nodeVersion,
          javaVersion: options.javaVersion,
          packageManager: options.packageManager,
          includeVersion: options.includeVersion,
          force: Boolean(options.force)
        }
      }
    });
  });

program
  .command('publish')
  .description('Upload to Play Store or GitHub')
  .option('--target <target>', 'Publish target (github|play|all)', 'all')
  .option('--artifact <path>', 'Artifact path override (APK or AAB)')
  .option('--notes <text>', 'Inline release notes')
  .option('--notes-file <path>', 'Path to release notes markdown/text file')
  .option('--tag <tag>', 'Git tag to publish or create on GitHub')
  .option('--release-name <name>', 'GitHub release title override')
  .option('--draft', 'Create or keep the GitHub release as draft')
  .option('--latest', 'Mark the GitHub release as latest')
  .option('--dry-run', 'Print the resolved publish plan without calling external APIs')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    const config = await loadConfig();
    await runPluginCommand('publish', {
      cwd: process.cwd(),
      config,
      debug: options.debug,
      contextExtras: {
        publishOptions: {
          target: options.target,
          artifact: options.artifact,
          notes: options.notes,
          notesFile: options.notesFile,
          tag: options.tag,
          releaseName: options.releaseName,
          draft: options.draft ? true : undefined,
          latest: options.latest ? true : undefined,
          dryRun: Boolean(options.dryRun)
        }
      }
    });
  });

interface ShipOptions {
  major?: boolean;
  minor?: boolean;
  patch?: boolean;
  code?: number;
  notesFile?: string;
  changelogFile?: string;
  fromGit?: boolean;
  target?: string;
  artifact?: string;
  releaseName?: string;
  tag?: string;
  draft?: boolean;
  latest?: boolean;
  doctor?: boolean;
  assets?: boolean;
  package?: boolean;
  build?: boolean;
  changelog?: boolean;
  publish?: boolean;
  dryRun?: boolean;
  debug?: boolean;
}

async function runArtifactsCommand(action: 'list' | 'inspect' | 'clean', options: {
  kind?: string;
  json?: boolean;
  dryRun?: boolean;
  debug?: boolean;
}): Promise<void> {
  const config = await loadConfig();
  await runPluginCommand('artifacts', {
    cwd: process.cwd(),
    config,
    debug: options.debug,
    contextExtras: {
      artifactOptions: {
        action,
        kind: options.kind,
        json: Boolean(options.json),
        dryRun: Boolean(options.dryRun)
      }
    }
  });
}

async function runShipWorkflow(version: string | undefined, options: ShipOptions): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig();
  const workflow: Array<{ label: string; command: string; run: () => Promise<void> }> = [];
  let currentConfig = config;

  if (options.doctor !== false) {
    workflow.push({
      label: 'Doctor',
      command: 'deploid doctor --summary',
      run: async () => {
        process.exitCode = 0;
        await runDoctorCommand({
          cwd,
          debug: options.debug,
          doctorOptions: { summary: true }
        });
        if (process.exitCode && process.exitCode !== 0) {
          process.exitCode = 1;
          throw new Error('Doctor found release blockers. Fix them or rerun with --no-doctor to skip.');
        }
        process.exitCode = 0;
      }
    });
  }

  if (options.assets !== false) {
    workflow.push({
      label: 'Assets',
      command: 'deploid assets',
      run: async () => {
        await runPluginCommand('assets', {
          cwd,
          config: currentConfig,
          debug: options.debug
        });
      }
    });
  }

  if (options.package !== false) {
    workflow.push({
      label: 'Package',
      command: `deploid package`,
      run: async () => {
        await runPluginCommand(`packaging-${currentConfig.android.packaging}`, {
          cwd,
          config: currentConfig,
          debug: options.debug
        });
      }
    });
  }

  const shouldVersion = Boolean(version || options.major || options.minor || options.patch || typeof options.code === 'number');
  if (shouldVersion) {
    workflow.push({
      label: 'Version',
      command: `deploid version ${version || [options.major && '--major', options.minor && '--minor', options.patch && '--patch'].filter(Boolean).join(' ')}`.trim(),
      run: async () => {
        await runPluginCommand('version', {
          cwd,
          config: currentConfig,
          debug: options.debug,
          contextExtras: {
            versionOptions: {
              version,
              major: Boolean(options.major),
              minor: Boolean(options.minor),
              patch: Boolean(options.patch),
              code: options.code,
              notesFile: options.notesFile,
              dryRun: false,
              json: false
            }
          }
        });
        currentConfig = await loadConfig(cwd);
      }
    });
  }

  if (options.build !== false) {
    workflow.push({
      label: 'Build',
      command: 'deploid build',
      run: async () => {
        await runPluginCommand('build-android', {
          cwd,
          config: currentConfig,
          debug: options.debug
        });
      }
    });
  }

  if (options.changelog !== false) {
    workflow.push({
      label: 'Changelog',
      command: `deploid changelog${options.fromGit ? ' --from-git' : ''}`,
      run: async () => {
        await runPluginCommand('changelog', {
          cwd,
          config: currentConfig,
          debug: options.debug,
          contextExtras: {
            changelogOptions: {
              version,
              notesFile: options.notesFile,
              changelogFile: options.changelogFile,
              fromGit: Boolean(options.fromGit),
              dryRun: false,
              json: false
            }
          }
        });
      }
    });
  }

  if (options.publish !== false) {
    workflow.push({
      label: 'Publish',
      command: `deploid publish --target ${options.target || 'all'}`,
      run: async () => {
        await runPluginCommand('publish', {
          cwd,
          config: currentConfig,
          debug: options.debug,
          contextExtras: {
            publishOptions: {
              target: options.target || 'all',
              artifact: options.artifact,
              notesFile: options.notesFile,
              releaseName: options.releaseName,
              tag: options.tag,
              draft: options.draft ? true : undefined,
              latest: options.latest ? true : undefined,
              dryRun: false
            }
          }
        });
      }
    });
  }

  if (options.dryRun) {
    console.log('Deploid Ship Plan');
    for (const [index, step] of workflow.entries()) {
      console.log(`${index + 1}. ${step.label}: ${step.command}`);
    }
    return;
  }

  for (const step of workflow) {
    console.log(`\n==> ${step.label}`);
    await step.run();
  }
}

await program.parseAsync();
