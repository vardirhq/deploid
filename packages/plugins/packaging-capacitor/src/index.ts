// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}
import { execa, execaCommand } from 'execa';
import fs from 'node:fs';
import path from 'node:path';

const runPackagingCapacitor: PipelineStep = async ({ logger, config, cwd }: any) => {
  logger.info(`packaging-capacitor: wrapping ${config.appName} for Android`);
  
  try {
    // Check if Capacitor is installed
    await checkCapacitorInstalled(logger);
    
    // Initialize Capacitor if needed
    await initializeCapacitor(cwd, config, logger);
    
    // Sync web assets
    await syncWebAssets(cwd, config, logger);
    
    // Add Android platform if not exists
    await addAndroidPlatform(cwd, logger);
    
    // Update Android configuration
    await updateAndroidConfig(cwd, config, logger);
    
    // Copy generated icons to Android project
    await copyAndroidIcons(cwd, config, logger);

    // Only install push-notifications if Firebase is explicitly configured
    if (config.firebase?.enabled) {
      await addPushNotificationsPlugin(cwd, logger);
    }
    
    logger.info('✅ Capacitor packaging complete');
  } catch (error) {
    logger.error(`Capacitor packaging failed: ${error}`);
    throw error;
  }
};

const plugin = {
  name: 'packaging-capacitor',
  requirements: ['npx'],
  plan: () => ['Initialize Capacitor', 'Sync web build', 'Add Android platform', 'Apply Android configuration'],
  validate: async ({ cwd }: any) => {
    await assertCommand('npm', ['--version']);
    await assertCommand('npx', ['--version']);
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project root');
    }
  },
  run: runPackagingCapacitor
};

const packagingCapacitor = (): PipelineStep => runPackagingCapacitor;

async function assertCommand(command: string, args: string[]): Promise<void> {
  try {
    await execa(command, args, { stdio: 'pipe' });
  } catch {
    throw new Error(
      `Required command not found: ${command}. ` +
      (command === 'npx' ? 'Make sure Node.js is installed and in PATH.' : '')
    );
  }
}

async function checkCapacitorInstalled(logger: any): Promise<void> {
  try {
    await execa('npx', ['@capacitor/cli', '--version'], { stdio: 'pipe' });
    logger.debug('Capacitor CLI found');
  } catch (error) {
    throw new Error('Capacitor CLI not available. Install @capacitor/cli in your project dependencies.');
  }
}

async function initializeCapacitor(cwd: string, config: any, logger: any): Promise<void> {
  const capacitorConfigPath = path.join(cwd, 'capacitor.config.json');
  
  if (!fs.existsSync(capacitorConfigPath)) {
    logger.info('Initializing Capacitor...');
    await execa('npx', ['@capacitor/cli', 'init', config.appName, config.appId], { 
      cwd, 
      stdio: 'inherit' 
    });
  } else {
    logger.debug('Capacitor already initialized');
  }
}

async function syncWebAssets(cwd: string, config: any, logger: any): Promise<void> {
  logger.info('Syncing web assets...');
  
  // First build the web app
  logger.info(`Building web app: ${config.web.buildCommand}`);
  await execaCommand(config.web.buildCommand, { cwd, stdio: 'inherit' });
  
  // Then sync with Capacitor
  await execa('npx', ['@capacitor/cli', 'sync'], { cwd, stdio: 'inherit' });
}

async function addAndroidPlatform(cwd: string, logger: any): Promise<void> {
  const androidPath = path.join(cwd, 'android');
  
  if (!fs.existsSync(androidPath)) {
    logger.info('Adding Android platform...');
    await execa('npx', ['@capacitor/cli', 'add', 'android'], { cwd, stdio: 'inherit' });
  } else {
    logger.debug('Android platform already exists');
  }
}

async function updateCapacitorConfig(cwd: string, config: any, logger: any): Promise<void> {
  const capacitorConfigPath = path.join(cwd, 'capacitor.config.json');
  
  if (fs.existsSync(capacitorConfigPath)) {
    try {
      const capacitorConfig = JSON.parse(fs.readFileSync(capacitorConfigPath, 'utf8'));
      let updated = false;
      
      if (capacitorConfig.appName !== config.appName) {
        capacitorConfig.appName = config.appName;
        updated = true;
        logger.debug(`Updating Capacitor appName: ${config.appName}`);
      }
      
      if (capacitorConfig.appId !== config.appId) {
        capacitorConfig.appId = config.appId;
        updated = true;
        logger.debug(`Updating Capacitor appId: ${config.appId}`);
      }
      
      if (updated) {
        fs.writeFileSync(capacitorConfigPath, JSON.stringify(capacitorConfig, null, 2) + '\n');
        logger.debug('Updated capacitor.config.json');
      }
    } catch (error) {
      logger.warn(`Failed to update capacitor.config.json: ${error}`);
    }
  }
}

async function updateAppMetadata(cwd: string, config: any, logger: any): Promise<void> {
  const androidDir = path.join(cwd, 'android');
  
  if (!fs.existsSync(androidDir)) {
    return;
  }
  
  // Update AndroidManifest.xml - app label and package name
  const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    let manifestUpdated = false;
    
    // Update android:label attribute in application tag
    if (manifestContent.includes('<application')) {
      // Check if label is set as a string resource (most common case)
      if (manifestContent.includes('android:label="@string/app_name"')) {
        // We'll update the string resource below, so no need to update manifest here
        logger.debug('App label uses string resource, will update strings.xml');
      } else if (manifestContent.match(/android:label="[^"]*"/)) {
        // Update direct label value if it exists
        manifestContent = manifestContent.replace(
          /android:label="[^"]*"/,
          `android:label="${config.appName}"`
        );
        manifestUpdated = true;
        logger.debug(`Updated android:label in AndroidManifest.xml: ${config.appName}`);
      } else {
        // Add label if it doesn't exist
        manifestContent = manifestContent.replace(
          /<application([^>]*)>/,
          `<application$1 android:label="${config.appName}">`
        );
        manifestUpdated = true;
        logger.debug(`Added android:label to AndroidManifest.xml: ${config.appName}`);
      }
    }
    
    // Update package name (appId) in manifest
    // Note: Changing package name creates a new app identity in Android
    if (manifestContent.includes('package=')) {
      const currentPackageMatch = manifestContent.match(/package="([^"]*)"/);
      if (currentPackageMatch && currentPackageMatch[1] !== config.appId) {
        manifestContent = manifestContent.replace(
          /package="[^"]*"/,
          `package="${config.appId}"`
        );
        manifestUpdated = true;
        logger.info(`Updated package name in AndroidManifest.xml: ${currentPackageMatch[1]} → ${config.appId}`);
        logger.warn('⚠️  Package name changed - this creates a new app identity. Existing installs will be treated as a different app.');
      }
    }
    
    // Write manifest back if it was updated
    if (manifestUpdated) {
      fs.writeFileSync(manifestPath, manifestContent);
    }
  }
  
  // Update build.gradle - applicationId
  const buildGradlePath = path.join(androidDir, 'app/build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Update applicationId in defaultConfig
    if (buildGradle.includes('applicationId')) {
      const currentAppIdMatch = buildGradle.match(/applicationId\s+"([^"]*)"/);
      if (currentAppIdMatch && currentAppIdMatch[1] !== config.appId) {
        buildGradle = buildGradle.replace(
          /applicationId\s+"[^"]*"/,
          `applicationId "${config.appId}"`
        );
        fs.writeFileSync(buildGradlePath, buildGradle);
        logger.info(`Updated applicationId in build.gradle: ${currentAppIdMatch[1]} → ${config.appId}`);
      }
    } else {
      // Add applicationId if it doesn't exist in defaultConfig
      if (buildGradle.includes('defaultConfig')) {
        buildGradle = buildGradle.replace(
          /(defaultConfig\s*\{[^}]*)/,
          `$1\n        applicationId "${config.appId}"`
        );
        fs.writeFileSync(buildGradlePath, buildGradle);
        logger.debug(`Added applicationId to build.gradle: ${config.appId}`);
      }
    }
  }
  
  // Update strings.xml - app_name (if it exists and wasn't already updated)
  const stringsPath = path.join(androidDir, 'app/src/main/res/values/strings.xml');
  if (fs.existsSync(stringsPath)) {
    let stringsContent = fs.readFileSync(stringsPath, 'utf8');
    
    if (stringsContent.includes('<string name="app_name">')) {
      stringsContent = stringsContent.replace(
        /<string name="app_name">[^<]*<\/string>/,
        `<string name="app_name">${config.appName}</string>`
      );
      fs.writeFileSync(stringsPath, stringsContent);
      logger.debug(`Updated app_name in strings.xml: ${config.appName}`);
    } else {
      // Add app_name if it doesn't exist
      if (stringsContent.includes('<resources>')) {
        stringsContent = stringsContent.replace(
          /<resources>/,
          `<resources>\n    <string name="app_name">${config.appName}</string>`
        );
        fs.writeFileSync(stringsPath, stringsContent);
        logger.debug(`Added app_name to strings.xml: ${config.appName}`);
      }
    }
  } else {
    // Create strings.xml if it doesn't exist
    const valuesDir = path.dirname(stringsPath);
    if (!fs.existsSync(valuesDir)) {
      fs.mkdirSync(valuesDir, { recursive: true });
    }
    const stringsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>
`;
    fs.writeFileSync(stringsPath, stringsContent);
    logger.debug(`Created strings.xml with app_name: ${config.appName}`);
  }
}

async function updateAndroidConfig(cwd: string, config: any, logger: any): Promise<void> {
  const androidManifestPath = path.join(cwd, 'android/app/src/main/AndroidManifest.xml');
  
  if (fs.existsSync(androidManifestPath)) {
    logger.info('Updating Android configuration...');
    
    // Update Capacitor config with app name and app ID
    await updateCapacitorConfig(cwd, config, logger);
    
    // Update app name and app ID in Android project files
    await updateAppMetadata(cwd, config, logger);
    
    // Update target SDK
    if (config.android.targetSdk) {
      const buildGradlePath = path.join(cwd, 'android/app/build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
        buildGradle = buildGradle.replace(
          /compileSdkVersion \d+/,
          `compileSdkVersion ${config.android.targetSdk}`
        );
        buildGradle = buildGradle.replace(
          /targetSdkVersion \d+/,
          `targetSdkVersion ${config.android.targetSdk}`
        );
        fs.writeFileSync(buildGradlePath, buildGradle);
        logger.debug(`Updated target SDK to ${config.android.targetSdk}`);
      }
    }
    
    // Update version info
    if (config.android.version) {
      const buildGradlePath = path.join(cwd, 'android/app/build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
        buildGradle = buildGradle.replace(
          /versionCode \d+/,
          `versionCode ${config.android.version.code}`
        );
        buildGradle = buildGradle.replace(
          /versionName "[^"]*"/,
          `versionName "${config.android.version.name}"`
        );
        fs.writeFileSync(buildGradlePath, buildGradle);
        logger.debug(`Updated version to ${config.android.version.name} (${config.android.version.code})`);
      }
    }
    
    // Ensure Android build defaults without pinning a machine-specific JDK path.
    const androidDir = path.join(cwd, 'android');
    if (fs.existsSync(androidDir)) {
      // Create gradle.properties with AndroidX and Gradle performance defaults.
      // JAVA_HOME is intentionally not pinned here; build commands resolve it from the environment/PATH.
      const gradlePropertiesPath = path.join(androidDir, 'gradle.properties');
      const gradleProperties = `# AndroidX configuration
android.useAndroidX=true
android.enableJetifier=true

# Gradle performance optimizations (ChatGPT recommendations)
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
`;
      writeFileIfChanged(gradlePropertiesPath, gradleProperties);
      logger.debug('Ensured gradle.properties with AndroidX configuration');
      
      // Create network security configuration for HTTPS/HTTP requests
      const networkSecurityConfigPath = path.join(androidDir, 'app/src/main/res/xml/network_security_config.xml');
      const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext traffic for localhost and development -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">192.168.1.1</domain>
        <domain includeSubdomains="true">192.168.0.1</domain>
    </domain-config>
    
    <!-- Allow external HTTPS domains for testing -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">httpbin.org</domain>
        <domain includeSubdomains="true">google.com</domain>
        <domain includeSubdomains="true">www.google.com</domain>
    </domain-config>
    
    <!-- Base configuration - allow all other domains -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>`;
      
      // Ensure xml directory exists
      const xmlDir = path.dirname(networkSecurityConfigPath);
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      writeFileIfChanged(networkSecurityConfigPath, networkSecurityConfig);
      logger.debug('Created network security configuration');
      
      // Update AndroidManifest.xml with network security config, display options, and additional permissions
      const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
      if (fs.existsSync(manifestPath)) {
        let manifestContent = fs.readFileSync(manifestPath, 'utf8');
        
        // Build application attributes
        const applicationAttrs: string[] = [];
        
        // Network security config
        if (!manifestContent.includes('android:networkSecurityConfig')) {
          applicationAttrs.push('android:networkSecurityConfig="@xml/network_security_config"');
          applicationAttrs.push('android:usesCleartextTraffic="true"');
        }
        
        // Performance options
        if (config.android.performance?.hardwareAccelerated !== undefined) {
          if (!manifestContent.includes('android:hardwareAccelerated')) {
            applicationAttrs.push(`android:hardwareAccelerated="${config.android.performance.hardwareAccelerated}"`);
          }
        }
        
        if (config.android.performance?.largeHeap !== undefined) {
          if (!manifestContent.includes('android:largeHeap')) {
            applicationAttrs.push(`android:largeHeap="${config.android.performance.largeHeap}"`);
          }
        }
        
        // Launch options
        if (config.android.launch?.allowBackup !== undefined) {
          if (!manifestContent.includes('android:allowBackup')) {
            applicationAttrs.push(`android:allowBackup="${config.android.launch.allowBackup}"`);
          }
        }
        
        // Apply application attributes
        if (applicationAttrs.length > 0) {
          const attrsString = '\n        ' + applicationAttrs.join('\n        ');
          manifestContent = manifestContent.replace(
            /<application([^>]*)>/,
            `<application$1${attrsString}>`
          );
        }
        
        // Update activity (main launcher activity) with display and launch options
        if (manifestContent.includes('<activity')) {
          // Find the main activity (usually has android.intent.action.MAIN)
          const activityPattern = /(<activity[^>]*android:name="[^"]*MainActivity[^"]*"[^>]*>)/;
          const activityMatch = manifestContent.match(activityPattern);
          
          if (activityMatch) {
            let activityTag = activityMatch[1];
            const activityAttrs: string[] = [];
            
            // Display options
            if (config.android.display?.fullscreen) {
              if (!activityTag.includes('android:theme')) {
                activityAttrs.push('android:theme="@android:style/Theme.NoTitleBar.Fullscreen"');
              }
            }
            
            if (config.android.display?.orientation) {
              const orientationMap: Record<string, string> = {
                'portrait': 'portrait',
                'landscape': 'landscape',
                'sensor': 'sensor',
                'sensorPortrait': 'sensorPortrait',
                'sensorLandscape': 'sensorLandscape',
                'fullSensor': 'fullSensor',
                'reversePortrait': 'reversePortrait',
                'reverseLandscape': 'reverseLandscape'
              };
              const orientation = orientationMap[config.android.display.orientation];
              if (orientation && !activityTag.includes('android:screenOrientation')) {
                activityAttrs.push(`android:screenOrientation="${orientation}"`);
              }
            }
            
            if (config.android.display?.windowSoftInputMode) {
              const inputModeMap: Record<string, string> = {
                'adjustResize': 'adjustResize',
                'adjustPan': 'adjustPan',
                'adjustNothing': 'adjustNothing'
              };
              const inputMode = inputModeMap[config.android.display.windowSoftInputMode];
              if (inputMode && !activityTag.includes('android:windowSoftInputMode')) {
                activityAttrs.push(`android:windowSoftInputMode="${inputMode}"`);
              }
            }
            
            // Launch options
            if (config.android.launch?.launchMode) {
              const launchModeMap: Record<string, string> = {
                'standard': 'standard',
                'singleTop': 'singleTop',
                'singleTask': 'singleTask',
                'singleInstance': 'singleInstance'
              };
              const launchMode = launchModeMap[config.android.launch.launchMode];
              if (launchMode && !activityTag.includes('android:launchMode')) {
                activityAttrs.push(`android:launchMode="${launchMode}"`);
              }
            }
            
            if (config.android.launch?.taskAffinity && !activityTag.includes('android:taskAffinity')) {
              activityAttrs.push(`android:taskAffinity="${config.android.launch.taskAffinity}"`);
            }
            
            // Apply activity attributes
            if (activityAttrs.length > 0) {
              const attrsString = '\n            ' + activityAttrs.join('\n            ');
              activityTag = activityTag.replace(/>$/, `${attrsString}>`);
              manifestContent = manifestContent.replace(activityPattern, activityTag);
            }
          }
        }
        
        // Add additional permissions before closing manifest tag (only if not already present)
        if (!manifestContent.includes('ACCESS_NETWORK_STATE')) {
          const additionalPermissions = `
    <!-- Additional permissions for network and device access -->
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />`;
          
          manifestContent = manifestContent.replace(
            /<\/manifest>/,
            `${additionalPermissions}\n<\/manifest>`
          );
        }
        
        writeFileIfChanged(manifestPath, manifestContent);
        logger.debug('Updated AndroidManifest.xml with display, launch, and performance options');
      }
      
      // Update app/build.gradle with build options
      const appBuildGradlePath = path.join(androidDir, 'app/build.gradle');
      if (fs.existsSync(appBuildGradlePath)) {
        let buildGradle = fs.readFileSync(appBuildGradlePath, 'utf8');
        
        // Add Java 21 configuration if not present
        if (!buildGradle.includes('sourceCompatibility')) {
          const javaConfig = `
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }`;
          
          // Insert before the closing brace of android block
          buildGradle = buildGradle.replace(
            /(\s+)(}\s*$)/m,
            `$1${javaConfig}$1$2`
          );
        } else {
          // Update existing Java version to 21
          buildGradle = buildGradle.replace(
            /sourceCompatibility JavaVersion\.VERSION_\d+/,
            'sourceCompatibility JavaVersion.VERSION_21'
          );
          buildGradle = buildGradle.replace(
            /targetCompatibility JavaVersion\.VERSION_\d+/,
            'targetCompatibility JavaVersion.VERSION_21'
          );
        }
        
        // Apply build options to buildTypes
        if (config.android.build) {
          // Find or create buildTypes block
          if (buildGradle.includes('buildTypes')) {
            // Update release buildType
            const releasePattern = /(buildTypes\s*\{[^}]*release\s*\{[^}]*)/;
            const releaseMatch = buildGradle.match(releasePattern);
            
            if (releaseMatch) {
              let releaseBlock = releaseMatch[1];
              const releaseAttrs: string[] = [];
              
              if (config.android.build.minifyEnabled !== undefined) {
                if (!releaseBlock.includes('minifyEnabled')) {
                  releaseAttrs.push(`minifyEnabled ${config.android.build.minifyEnabled}`);
                } else {
                  releaseBlock = releaseBlock.replace(
                    /minifyEnabled\s+\w+/,
                    `minifyEnabled ${config.android.build.minifyEnabled}`
                  );
                }
              }
              
              if (config.android.build.shrinkResources !== undefined) {
                if (!releaseBlock.includes('shrinkResources')) {
                  releaseAttrs.push(`shrinkResources ${config.android.build.shrinkResources}`);
                } else {
                  releaseBlock = releaseBlock.replace(
                    /shrinkResources\s+\w+/,
                    `shrinkResources ${config.android.build.shrinkResources}`
                  );
                }
              }
              
              if (config.android.build.enableProguard !== undefined) {
                if (!releaseBlock.includes('proguardFiles')) {
                  releaseAttrs.push(`proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`);
                }
              }
              
              if (releaseAttrs.length > 0) {
                releaseBlock += '\n            ' + releaseAttrs.join('\n            ');
                buildGradle = buildGradle.replace(releasePattern, releaseBlock);
              } else {
                buildGradle = buildGradle.replace(releasePattern, releaseBlock);
              }
            }
          }
          
          // Add multidex support if enabled
          if (config.android.build.enableMultidex) {
            if (!buildGradle.includes('multidex')) {
              // Add multidex dependency in dependencies block
              if (buildGradle.includes('dependencies {')) {
                buildGradle = buildGradle.replace(
                  /(dependencies\s*\{)/,
                  `$1\n    implementation 'androidx.multidex:multidex:2.0.1'`
                );
              }
              
              // Add multidex to defaultConfig
              if (buildGradle.includes('defaultConfig')) {
                if (!buildGradle.includes('multiDexEnabled')) {
                  buildGradle = buildGradle.replace(
                    /(defaultConfig\s*\{[^}]*)/,
                    `$1\n        multiDexEnabled true`
                  );
                }
              }
            }
          }
        }
        
        // Check if Firebase is configured and remove Google Services plugin if not
        const googleServicesJsonPath = path.join(androidDir, 'app/google-services.json');
        if (!fs.existsSync(googleServicesJsonPath)) {
          // Remove Google Services plugin application
          buildGradle = buildGradle.replace(/apply plugin: 'com\.google\.gms\.google-services'\n?/, '');
          
          // Remove Firebase dependencies
          buildGradle = buildGradle.replace(/\/\/ Firebase dependencies\n.*?implementation 'com\.google\.firebase:firebase-messaging:.*?'\n.*?implementation 'com\.google\.firebase:firebase-analytics:.*?'\n?/s, '');
          
          logger.debug('Removed Google Services plugin and Firebase dependencies (no google-services.json found)');
        }
        
        writeFileIfChanged(appBuildGradlePath, buildGradle);
        logger.debug('Updated app/build.gradle with build options');
      }
      
      // Update other build.gradle files (just Java version)
      const otherBuildGradleFiles = [
        path.join(androidDir, 'capacitor-cordova-android-plugins/build.gradle'),
        path.join(androidDir, 'app/capacitor.build.gradle')
      ];
      
      for (const buildGradlePath of otherBuildGradleFiles) {
        if (fs.existsSync(buildGradlePath)) {
          let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
          
          // Add Java 21 configuration if not present
          if (!buildGradle.includes('sourceCompatibility')) {
            const javaConfig = `
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }`;
            
            // Insert before the closing brace of android block
            buildGradle = buildGradle.replace(
              /(\s+)(}\s*$)/m,
              `$1${javaConfig}$1$2`
            );
          } else {
            // Update existing Java version to 21
            buildGradle = buildGradle.replace(
              /sourceCompatibility JavaVersion\.VERSION_\d+/,
              'sourceCompatibility JavaVersion.VERSION_21'
            );
            buildGradle = buildGradle.replace(
              /targetCompatibility JavaVersion\.VERSION_\d+/,
              'targetCompatibility JavaVersion.VERSION_21'
            );
          }
          
          writeFileIfChanged(buildGradlePath, buildGradle);
          logger.debug(`Updated Java version to 21 in ${path.basename(buildGradlePath)}`);
        }
      }
      
      // Update Gradle version to support Java 25
      const rootBuildGradlePath = path.join(androidDir, 'build.gradle');
      if (fs.existsSync(rootBuildGradlePath)) {
        let rootBuildGradle = fs.readFileSync(rootBuildGradlePath, 'utf8');
        
        // Update Gradle version to 8.12.0 which works with Java 21
        rootBuildGradle = rootBuildGradle.replace(
          /classpath 'com\.android\.tools\.build:gradle:\d+\.\d+\.\d+'/,
          "classpath 'com.android.tools.build:gradle:8.12.0'"
        );
        
        writeFileIfChanged(rootBuildGradlePath, rootBuildGradle);
        logger.debug('Updated Gradle version to 8.12.0 for Java 21 support');
      }
      
      // Update Gradle wrapper to support Java 25
      const gradleWrapperPropertiesPath = path.join(androidDir, 'gradle/wrapper/gradle-wrapper.properties');
      if (fs.existsSync(gradleWrapperPropertiesPath)) {
        let gradleWrapperProperties = fs.readFileSync(gradleWrapperPropertiesPath, 'utf8');
        
        // Update Gradle wrapper to 8.13 which works with Java 21
        gradleWrapperProperties = gradleWrapperProperties.replace(
          /distributionUrl=.*gradle-[\d\.]+-all\.zip/,
          'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-all.zip'
        );
        
        writeFileIfChanged(gradleWrapperPropertiesPath, gradleWrapperProperties);
        logger.debug('Updated Gradle wrapper to 8.13 for Java 21 support');
      }
    }
  }
}

async function copyAndroidIcons(cwd: string, config: any, logger: any): Promise<void> {
  const assetsGenPath = path.join(cwd, config.assets?.output || 'assets-gen');
  const androidIconsPath = path.join(assetsGenPath, 'android');
  const androidResPath = path.join(cwd, 'android/app/src/main/res');
  
  if (!fs.existsSync(androidIconsPath)) {
    logger.debug('No generated Android icons found, skipping icon copy');
    return;
  }
  
  if (!fs.existsSync(androidResPath)) {
    logger.debug('Android project not found, skipping icon copy');
    return;
  }
  
  logger.info('Copying generated icons to Android project...');
  
  try {
    // Copy icons from assets-gen/android to android/app/src/main/res
    const iconDirs = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
    
    for (const dir of iconDirs) {
      const sourceDir = path.join(androidIconsPath, dir);
      const targetDir = path.join(androidResPath, dir);
      
      if (fs.existsSync(sourceDir)) {
        // Ensure target directory exists
        fs.mkdirSync(targetDir, { recursive: true });
        
        // Copy ic_launcher.png
        const sourceIcon = path.join(sourceDir, 'ic_launcher.png');
        const targetIcon = path.join(targetDir, 'ic_launcher.png');
        
        if (fs.existsSync(sourceIcon)) {
          fs.copyFileSync(sourceIcon, targetIcon);
          logger.debug(`Copied icon: ${dir}/ic_launcher.png`);
        }
        
        // Also copy as ic_launcher_foreground.png for adaptive icons
        const targetForegroundIcon = path.join(targetDir, 'ic_launcher_foreground.png');
        if (fs.existsSync(sourceIcon)) {
          fs.copyFileSync(sourceIcon, targetForegroundIcon);
          logger.debug(`Copied foreground icon: ${dir}/ic_launcher_foreground.png`);
        }
      }
    }
    
    logger.info('✅ Android icons copied successfully');
  } catch (error) {
    logger.warn(`Failed to copy Android icons: ${error}`);
  }
}

function detectPkgManager(cwd: string): { cmd: string; args: string[] } {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return { cmd: 'pnpm', args: ['add'] };
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return { cmd: 'yarn', args: ['add'] };
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) return { cmd: 'bun', args: ['add'] };
  return { cmd: 'npm', args: ['install'] };
}

async function addPushNotificationsPlugin(cwd: string, logger: any): Promise<void> {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const alreadyInstalled = Boolean(
    packageJson.dependencies?.['@capacitor/push-notifications'] ||
    packageJson.devDependencies?.['@capacitor/push-notifications']
  );
  if (alreadyInstalled) {
    logger.debug('@capacitor/push-notifications already installed');
    return;
  }

  logger.info('Adding push notifications plugin...');
  const pkg = detectPkgManager(cwd);
  try {
    await execa(pkg.cmd, [...pkg.args, '@capacitor/push-notifications'], { cwd, stdio: 'inherit' });
    logger.info('✅ Push notifications plugin added');
  } catch (error) {
    logger.warn(`Failed to add push notifications plugin: ${error}`);
    logger.info(`Add it manually: ${pkg.cmd} ${pkg.args.join(' ')} @capacitor/push-notifications`);
  }
}

async function addDeploymentScripts(cwd: string, config: any, logger: any): Promise<void> {
  const packageJsonPath = path.join(cwd, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Add deployment scripts if they don't exist
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      const deploymentScripts = {
        'deploy:phone': 'adb install -r android/app/build/outputs/apk/debug/app-debug.apk',
        'deploy:phone-force': 'adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk',
        'deploy:uninstall': `adb uninstall ${config.appId}`,
        'deploy:list': 'adb devices',
        'deploy:logcat': `adb logcat | grep -i "${config.appName}"`,
        'deploy:clean': `adb shell pm clear ${config.appId}`
      };
      
      // Only add scripts that don't already exist
      for (const [scriptName, scriptCommand] of Object.entries(deploymentScripts)) {
        if (!packageJson.scripts[scriptName]) {
          packageJson.scripts[scriptName] = scriptCommand;
        }
      }
      
      // Write updated package.json
      writeFileIfChanged(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      logger.debug('Ensured deployment scripts in package.json');
      
    } catch (error) {
      logger.warn(`Could not add deployment scripts: ${error}`);
    }
  }
}

export default plugin;
export { packagingCapacitor, plugin };

function writeFileIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf8');
    if (current === content) return;
  }
  fs.writeFileSync(filePath, content);
}
