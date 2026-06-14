// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}
import { execa } from 'execa';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const runBuildAndroid: PipelineStep = async ({ logger, config, cwd, debug }: any) => {
  logger.info(`build-android: building APK/AAB for ${config.appName}`);
  
  if (debug) {
    logger.debugEnv();
    logger.debugStep('Initializing Android build process');
  }
  
  try {
    const androidPath = path.join(cwd, 'android');
    
    if (debug) {
      logger.debugFile('Checking Android project', androidPath, fs.existsSync(androidPath));
    }
    
    if (!fs.existsSync(androidPath)) {
      throw new Error('Android project not found. Run "deploid package" first.');
    }
    
    // Build debug APK
    logger.info('Building debug APK...');

    const javaHome = await resolveJavaHome(logger);
    const androidHome = resolveAndroidHome(cwd, androidPath, logger);
    ensureLocalProperties(androidPath, androidHome, logger);

    if (debug) {
      logger.debug(`Java Home: ${javaHome || 'using java from PATH'}`);
      logger.debug(`Android Home: ${androidHome}`);
      logger.debug(`Working Directory: ${androidPath}`);
    }
    
    if (debug) {
      logger.debugCommand('./gradlew', ['assembleDebug'], androidPath);
    }
    
    await execa('./gradlew', ['assembleDebug'], { 
      cwd: androidPath,
      stdio: 'inherit',
      env: buildAndroidEnv(javaHome, androidHome)
    });
    
    // Check if APK was generated
    const apkPath = path.join(androidPath, 'app/build/outputs/apk/debug/app-debug.apk');
    if (debug) {
      logger.debugFile('Checking for generated APK', apkPath, fs.existsSync(apkPath));
    }
    
    if (fs.existsSync(apkPath)) {
      logger.info(`✅ Debug APK generated: ${apkPath}`);
      if (debug) {
        const stats = fs.statSync(apkPath);
        logger.debug(`APK size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
    } else {
      logger.warn('Debug APK not found in expected location');
      if (debug) {
        logger.debug('Checking alternative APK locations...');
        const altPaths = [
          path.join(androidPath, 'app/build/outputs/apk/debug'),
          path.join(androidPath, 'app/build/outputs')
        ];
        altPaths.forEach(altPath => {
          if (fs.existsSync(altPath)) {
            logger.debug(`Found directory: ${altPath}`);
            const files = fs.readdirSync(altPath, { recursive: true });
            logger.debug(`Contents: ${JSON.stringify(files, null, 2)}`);
          }
        });
      }
    }
    
    // Build release AAB if signing is configured
    if (config.android.signing?.keystorePath) {
      logger.info('Building release AAB...');
      await execa('./gradlew', ['bundleRelease'], { 
        cwd: androidPath,
        stdio: 'inherit',
        env: buildAndroidEnv(javaHome, androidHome)
      });
      
      const aabPath = path.join(androidPath, 'app/build/outputs/bundle/release/app-release.aab');
      if (fs.existsSync(aabPath)) {
        logger.info(`✅ Release AAB generated: ${aabPath}`);
      } else {
        logger.warn('Release AAB not found in expected location');
      }
    } else {
      logger.info('No signing configured, skipping release build');
    }
    
    logger.info('✅ Android build complete');
  } catch (error) {
    logger.error(`Android build failed: ${error}`);
    throw error;
  }
};

const plugin = {
  name: 'build-android',
  requirements: ['java', 'android-sdk'],
  plan: () => ['Validate Android project', 'Build debug APK', 'Build signed release AAB (optional)'],
  validate: async ({ cwd }: any) => {
    const androidPath = path.join(cwd, 'android');
    if (!fs.existsSync(androidPath)) {
      throw new Error('Android project not found. Run "deploid package" first.');
    }
    await assertCommand('java', ['-version']);
    resolveAndroidHome(cwd, androidPath, console);
  },
  run: runBuildAndroid
};

const buildAndroidPlugin = (): PipelineStep => runBuildAndroid;


async function resolveJavaHome(logger: any): Promise<string | undefined> {
  const envJavaHome = process.env.JAVA_HOME;
  if (envJavaHome) {
    if (isValidJavaHome(envJavaHome)) {
      return envJavaHome;
    }
    logger.warn?.(`JAVA_HOME is set to ${envJavaHome}, but ${path.join(envJavaHome, 'bin', javaExecutableName())} does not exist. Falling back to java on PATH.`);
  }

  const javaPath = await findCommand('java');
  if (!javaPath) {
    throw new Error(
      'Java was not found. Install JDK 21+ and add it to PATH, or set JAVA_HOME.\n' +
      '  Download: https://adoptium.net/'
    );
  }

  const realJavaPath = fs.realpathSync(javaPath);
  const inferredJavaHome = path.dirname(path.dirname(realJavaPath));
  if (isValidJavaHome(inferredJavaHome)) {
    return inferredJavaHome;
  }

  logger.warn?.(`Could not infer JAVA_HOME from ${javaPath}; Gradle will use java from PATH.`);
  return undefined;
}

function resolveAndroidHome(cwd: string, androidPath: string, logger: any): string {
  const candidates = androidSdkCandidates(cwd, androidPath);
  const envAndroidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const envCandidate = envAndroidHome ? candidates.find((candidate) => candidate.path === envAndroidHome) : undefined;

  if (envCandidate?.exists) {
    assertWritableSdk(envCandidate.path);
    return envCandidate.path;
  }

  if (envAndroidHome) {
    logger.warn?.(`Android SDK environment points to ${envAndroidHome}, but that directory does not exist. Checking common SDK locations.`);
  }

  const detected = candidates.find((candidate) => candidate.exists);
  if (!detected) {
    const searched = candidates.map((candidate) => candidate.path).join(', ');
    throw new Error(`Android SDK not found. Set ANDROID_HOME/ANDROID_SDK_ROOT, create android/local.properties with sdk.dir, or install the SDK in one of: ${searched}.`);
  }

  assertWritableSdk(detected.path);
  return detected.path;
}

function androidSdkCandidates(cwd: string, androidPath: string): Array<{ path: string; exists: boolean }> {
  const localSdkDir = readLocalSdkDir(path.join(androidPath, 'local.properties')) || readLocalSdkDir(path.join(cwd, 'local.properties'));
  const home = os.homedir();
  const values = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    localSdkDir,
    home ? path.join(home, 'Android', 'Sdk') : undefined,
    '/opt/android-sdk',
    '/usr/lib/android-sdk'
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(values)).map((value) => ({ path: value, exists: fs.existsSync(value) }));
}

function ensureLocalProperties(androidPath: string, sdkPath: string, logger: any): void {
  const localPropertiesPath = path.join(androidPath, 'local.properties');
  const sdkLine = `sdk.dir=${escapePropertiesPath(sdkPath)}`;
  const existing = fs.existsSync(localPropertiesPath) ? fs.readFileSync(localPropertiesPath, 'utf8') : '';
  if (existing.includes(sdkLine)) return;

  const next = existing.match(/^sdk\.dir=/m)
    ? existing.replace(/^sdk\.dir=.*$/m, sdkLine)
    : `${existing}${existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''}${sdkLine}\n`;
  fs.writeFileSync(localPropertiesPath, next);
  logger.info?.(`Updated android/local.properties with detected Android SDK: ${sdkPath}`);
}

function readLocalSdkDir(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const line = fs.readFileSync(filePath, 'utf8').split('\n').find((entry) => entry.trim().startsWith('sdk.dir='));
  return line?.slice('sdk.dir='.length).trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\');
}

function assertWritableSdk(sdkPath: string): void {
  try {
    fs.accessSync(sdkPath, fs.constants.W_OK);
  } catch {
    throw new Error(`Android SDK at ${sdkPath} is not writable. Gradle may need to install build tools there; fix ownership/permissions or use a user-writable SDK path.`);
  }
}

function buildAndroidEnv(javaHome: string | undefined, androidHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome
  };
  if (javaHome) {
    env.JAVA_HOME = javaHome;
  } else {
    delete env.JAVA_HOME;
  }
  return env;
}

async function findCommand(command: string): Promise<string | undefined> {
  try {
    const result = await execa(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'pipe' });
    return result.stdout.split('\n').find((line) => line.trim().length > 0)?.trim();
  } catch {
    return undefined;
  }
}

function isValidJavaHome(javaHome: string): boolean {
  return fs.existsSync(path.join(javaHome, 'bin', javaExecutableName()));
}

function javaExecutableName(): string {
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function escapePropertiesPath(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

async function assertCommand(command: string, args: string[]): Promise<void> {
  try {
    await execa(command, args, { stdio: 'pipe' });
  } catch {
    throw new Error(`Required command not found: ${command}`);
  }
}

export default plugin;
export { buildAndroidPlugin, plugin };
