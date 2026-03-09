// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string; deployOptions?: { force?: boolean; launch?: boolean; device?: string; bootEmulator?: string; logs?: boolean; logFilter?: string } }): Promise<void>;
}
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';

const runDeployAndroid: PipelineStep = async ({ logger, config, cwd, deployOptions }: any) => {
  logger.info(`deploy-android: deploying ${config.appName} to Android target(s)`);
  
  try {
    await checkAdbInstalled(logger);

    const apkPath = path.join(cwd, 'android/app/build/outputs/apk/debug/app-debug.apk');
    if (!fs.existsSync(apkPath)) {
      logger.error('APK not found. Run "deploid build" first.');
      throw new Error('APK not found');
    }

    logger.info(`APK found: ${apkPath}`);

    if (deployOptions?.bootEmulator) {
      await bootEmulator(deployOptions.bootEmulator, logger);
    }

    const devices = await listConnectedDevices(logger);
    if (devices.length === 0) {
      logger.warn('No Android devices connected.');
      logger.info('To connect a device:');
      logger.info('  1. Connect via USB and enable USB debugging');
      logger.info('  2. Or boot an emulator: deploid deploy --boot-emulator <avd-name>');
      logger.info('  3. Or enable ADB over WiFi: adb tcpip 5555 && adb connect <device-ip>');
      return;
    }

    const targetDevices = resolveTargetDevices(devices, deployOptions?.device);

    for (const device of targetDevices) {
      await deployToDevice(device, apkPath, config, logger, deployOptions);
    }

    logger.info('✅ Android deployment complete');
  } catch (error) {
    logger.error(`Android deployment failed: ${error}`);
    throw error;
  }
};

const plugin = {
  name: 'deploy-android',
  requirements: ['adb'],
  plan: () => ['Verify adb availability', 'Optionally boot emulator and wait for device', 'Find built APK', 'Install APK on selected Android device(s)'],
  validate: async ({ cwd }: any) => {
    await assertCommand('adb', ['version']);
    const apkPath = path.join(cwd, 'android/app/build/outputs/apk/debug/app-debug.apk');
    if (!fs.existsSync(apkPath)) {
      throw new Error('APK not found. Run "deploid build" first.');
    }
  },
  run: runDeployAndroid
};

const deployAndroid = (): PipelineStep => runDeployAndroid;

async function assertCommand(command: string, args: string[]): Promise<void> {
  try {
    await execa(command, args, { stdio: 'pipe' });
  } catch {
    throw new Error(`Required command not found: ${command}`);
  }
}

async function checkAdbInstalled(logger: any): Promise<void> {
  try {
    await execa('adb', ['version'], { stdio: 'pipe' });
    logger.debug('ADB found');
  } catch (error) {
    logger.error('ADB not found. Please install Android SDK Platform Tools.');
    logger.info('Install instructions:');
    logger.info('  - Arch: sudo pacman -S android-tools');
    logger.info('  - Ubuntu: sudo apt install android-tools-adb');
    logger.info('  - macOS: brew install android-platform-tools');
    throw error;
  }
}

async function listConnectedDevices(logger: any): Promise<string[]> {
  try {
    const { stdout } = await execa('adb', ['devices'], { stdio: 'pipe' });
    const lines = stdout
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('List of devices'));
    const devices = lines
      .map((line: string) => {
        const [id, state] = line.split('\t');
        return state === 'device' ? id : '';
      })
      .filter((id: string) => id);
    
    logger.info(`Found ${devices.length} connected device(s): ${devices.join(', ')}`);
    return devices;
  } catch (error) {
    logger.error('Failed to list devices');
    throw error;
  }
}

function resolveTargetDevices(devices: string[], requestedDevice?: string): string[] {
  if (!requestedDevice) {
    return devices;
  }

  if (!devices.includes(requestedDevice)) {
    throw new Error(`Requested device "${requestedDevice}" is not connected. Available devices: ${devices.join(', ')}`);
  }

  return [requestedDevice];
}

async function bootEmulator(avdName: string, logger: any): Promise<void> {
  logger.info(`Booting emulator: ${avdName}`);

  try {
    const subprocess = execa('emulator', ['-avd', avdName], {
      detached: true,
      stdio: 'ignore'
    });
    subprocess.unref?.();
  } catch (error) {
    throw new Error(`Failed to launch emulator "${avdName}": ${error}`);
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const devices = await listConnectedDevicesSilently();
    const emulatorId = devices.find((device) => device.startsWith('emulator-'));
    if (emulatorId) {
      logger.info(`Emulator ready: ${emulatorId}`);
      return;
    }
    await delay(2000);
  }

  throw new Error(`Timed out waiting for emulator "${avdName}" to boot.`);
}

async function listConnectedDevicesSilently(): Promise<string[]> {
  try {
    const { stdout } = await execa('adb', ['devices'], { stdio: 'pipe' });
    return stdout
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('List of devices'))
      .map((line: string) => {
        const [id, state] = line.split('\t');
        return state === 'device' ? id : '';
      })
      .filter((id: string) => id);
  } catch {
    return [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }

  const maybe = error as { shortMessage?: string; stderr?: string; stdout?: string; message?: string };
  return [maybe.shortMessage, maybe.stderr, maybe.stdout, maybe.message].filter(Boolean).join('\n');
}

async function deployToDevice(
  deviceId: string,
  apkPath: string,
  config: any,
  logger: any,
  deployOptions?: { force?: boolean; launch?: boolean; device?: string; bootEmulator?: string; logs?: boolean; logFilter?: string }
): Promise<void> {
  try {
    logger.info(`Deploying to device: ${deviceId}`);

    await execa('adb', ['-s', deviceId, 'install', '-r', apkPath], { stdio: 'pipe' });
    logger.info(`✅ Successfully deployed to ${deviceId}`);

    if (deployOptions?.launch) {
      try {
        await execa('adb', ['-s', deviceId, 'shell', 'am', 'start', '-n', `${config.appId}/.MainActivity`], { stdio: 'pipe' });
        logger.info(`🚀 Launched ${config.appName} on ${deviceId}`);
        if (deployOptions.logs) {
          await tailLogs(deviceId, config, logger, deployOptions.logFilter);
        }
      } catch (error) {
        logger.warn(`Could not launch app on ${deviceId}: ${error}`);
      }
    }
    return;
  } catch (error: unknown) {
    const errorText = getErrorText(error);
    const signatureMismatch = errorText.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE');

    if (signatureMismatch && deployOptions?.force) {
      logger.warn(`Signature mismatch detected on ${deviceId}. Attempting uninstall/reinstall because --force was provided.`);
      await execa('adb', ['-s', deviceId, 'uninstall', config.appId], { stdio: 'pipe' });
      await execa('adb', ['-s', deviceId, 'install', apkPath], { stdio: 'pipe' });
      logger.info(`✅ Successfully reinstalled ${config.appName} on ${deviceId}`);

      if (deployOptions.launch) {
        try {
          await execa('adb', ['-s', deviceId, 'shell', 'am', 'start', '-n', `${config.appId}/.MainActivity`], { stdio: 'pipe' });
          logger.info(`🚀 Launched ${config.appName} on ${deviceId}`);
          if (deployOptions.logs) {
            await tailLogs(deviceId, config, logger, deployOptions.logFilter);
          }
        } catch (launchError) {
          logger.warn(`Could not launch app on ${deviceId}: ${launchError}`);
        }
      }
      return;
    }

    if (signatureMismatch) {
      logger.error(
        `Signature mismatch on ${deviceId}. Existing app signature differs from this build.\n` +
        `Run "deploid deploy --force" to uninstall/reinstall automatically, or run:\n` +
        `  adb -s ${deviceId} uninstall ${config.appId}`
      );
    }

    logger.error(`Failed to deploy to ${deviceId}: ${error}`);
    throw error;
  }
}

async function tailLogs(deviceId: string, config: any, logger: any, filter?: string): Promise<void> {
  const effectiveFilter = filter || config.appId || config.appName;
  logger.info(`Streaming logs from ${deviceId} (filter: ${effectiveFilter})`);
  await execa('adb', ['-s', deviceId, 'logcat', '-c'], { stdio: 'pipe' });
  await execa('adb', ['-s', deviceId, 'logcat', effectiveFilter + ':V', '*:S'], { stdio: 'inherit' });
}

export default plugin;
export { deployAndroid, plugin };
