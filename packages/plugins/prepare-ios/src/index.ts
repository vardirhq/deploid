// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';

const prepareIos = (): PipelineStep => async ({ logger, config, cwd }: any) => {
  logger.info(`prepare-ios: setting up iOS project for ${config.appName}`);
  
  try {
    // Check if Capacitor is installed
    await checkCapacitorInstalled(logger);
    
    // Add iOS platform if not exists
    await addIosPlatform(cwd, logger);
    
    // Configure iOS project
    await configureIosProject(cwd, config, logger);
    
    // Generate iOS assets
    await generateIosAssets(cwd, config, logger);
    
    // Create handoff documentation
    await createHandoffDocs(cwd, config, logger);
    
    logger.info('✅ iOS project preparation complete');
    logger.info('📱 Next steps:');
    logger.info('  1. Transfer the project to a Mac');
    logger.info('  2. Run: cd ios && pod install');
    logger.info('  3. Open App.xcworkspace in Xcode');
    logger.info('  4. Set signing team and build');
  } catch (error) {
    logger.error(`iOS preparation failed: ${error}`);
    throw error;
  }
};

function detectPkgManager(cwd: string): { cmd: string; args: string[] } {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return { cmd: 'pnpm', args: ['add'] };
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return { cmd: 'yarn', args: ['add'] };
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) return { cmd: 'bun', args: ['add'] };
  return { cmd: 'npm', args: ['install'] };
}

async function checkCapacitorInstalled(logger: any): Promise<void> {
  try {
    await execa('npx', ['@capacitor/cli', '--version'], { stdio: 'pipe' });
    logger.debug('Capacitor CLI found');
  } catch {
    throw new Error(
      'Capacitor CLI not found. Install it in your project:\n' +
      '  npm install @capacitor/cli @capacitor/core\n' +
      'or run `deploid init` to set everything up.'
    );
  }
}

async function addIosPlatform(cwd: string, logger: any): Promise<void> {
  const iosPath = path.join(cwd, 'ios');

  if (!fs.existsSync(iosPath)) {
    logger.info('Installing iOS platform...');
    const pkg = detectPkgManager(cwd);

    try {
      await execa(pkg.cmd, [...pkg.args, '@capacitor/ios'], { cwd, stdio: 'inherit' });
      logger.debug('Installed @capacitor/ios package');
    } catch (error) {
      logger.warn('Failed to install @capacitor/ios package, continuing...');
    }

    try {
      await execa('npx', ['@capacitor/cli', 'add', 'ios'], { cwd, stdio: 'inherit' });
      logger.info('✅ iOS platform added');
    } catch (error) {
      logger.error('Failed to add iOS platform. Try manually:');
      logger.info(`  ${pkg.cmd} ${pkg.args.join(' ')} @capacitor/ios`);
      logger.info('  npx cap add ios');
      throw error;
    }
  } else {
    logger.debug('iOS platform already exists');
  }
}

async function configureIosProject(cwd: string, config: any, logger: any): Promise<void> {
  const iosPath = path.join(cwd, 'ios');
  
  if (fs.existsSync(iosPath)) {
    logger.info('Configuring iOS project...');
    
    // Update Info.plist
    await updateInfoPlist(iosPath, config, logger);
    
    // Create entitlements file
    await createEntitlements(iosPath, config, logger);
    
    // Update Podfile
    await updatePodfile(iosPath, config, logger);
    
    // Create xcconfig files
    await createXcconfigs(iosPath, config, logger);
    
    // Update Capacitor config
    await updateCapacitorConfig(cwd, config, logger);
  }
}

async function updateInfoPlist(iosPath: string, config: any, logger: any): Promise<void> {
  const infoPlistPath = path.join(iosPath, 'App/App/Info.plist');
  
  if (fs.existsSync(infoPlistPath)) {
    let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Update bundle identifier
    infoPlist = infoPlist.replace(
      /<key>CFBundleIdentifier<\/key>\s*<string>.*?<\/string>/,
      `<key>CFBundleIdentifier</key><string>${config.appId}</string>`
    );
    
    // Update display name
    infoPlist = infoPlist.replace(
      /<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/,
      `<key>CFBundleDisplayName</key><string>${config.appName}</string>`
    );
    
    // Update version
    if (config.android.version) {
      infoPlist = infoPlist.replace(
        /<key>CFBundleShortVersionString<\/key>\s*<string>.*?<\/string>/,
        `<key>CFBundleShortVersionString</key><string>${config.android.version.name}</string>`
      );
      infoPlist = infoPlist.replace(
        /<key>CFBundleVersion<\/key>\s*<string>.*?<\/string>/,
        `<key>CFBundleVersion</key><string>${config.android.version.code}</string>`
      );
    }
    
    // Add URL schemes
    const urlSchemes = `
    <key>CFBundleURLTypes</key>
    <array>
      <dict>
        <key>CFBundleURLSchemes</key>
        <array>
          <string>${config.appId.split('.').pop()}</string>
        </array>
      </dict>
    </array>`;
    
    if (!infoPlist.includes('CFBundleURLTypes')) {
      infoPlist = infoPlist.replace('</dict>', `${urlSchemes}\n</dict>`);
    }
    
    // Add privacy descriptions
    const privacyDescriptions = `
    <key>NSCameraUsageDescription</key>
    <string>Camera access is required to scan documents and take photos.</string>
    <key>NSPhotoLibraryUsageDescription</key>
    <string>Photo library access is needed to save and select images.</string>
    <key>NSMicrophoneUsageDescription</key>
    <string>Microphone access is required for voice notes and audio features.</string>`;
    
    if (!infoPlist.includes('NSCameraUsageDescription')) {
      infoPlist = infoPlist.replace('</dict>', `${privacyDescriptions}\n</dict>`);
    }
    
    // Add ATS configuration for development
    const atsConfig = `
    <key>NSAppTransportSecurity</key>
    <dict>
      <key>NSAllowsArbitraryLoads</key>
      <true/>
      <key>NSExceptionDomains</key>
      <dict>
        <key>localhost</key>
        <dict>
          <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
          <true/>
        </dict>
        <key>192.168.0.0</key>
        <dict>
          <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
          <true/>
        </dict>
      </dict>
    </dict>`;
    
    if (!infoPlist.includes('NSAppTransportSecurity')) {
      infoPlist = infoPlist.replace('</dict>', `${atsConfig}\n</dict>`);
    }
    
    fs.writeFileSync(infoPlistPath, infoPlist);
    logger.debug('Updated Info.plist');
  }
}

async function createEntitlements(iosPath: string, config: any, logger: any): Promise<void> {
  const entitlementsPath = path.join(iosPath, 'App/App/App.entitlements');
  
  const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Enable these capabilities in Xcode when needed -->
  <!-- <key>aps-environment</key><string>development</string> -->
  <!-- <key>keychain-access-groups</key><array><string>\$(AppIdentifierPrefix)${config.appId}</string></array> -->
  <!-- <key>com.apple.developer.app-groups</key><array><string>group.${config.appId}</string></array> -->
</dict>
</plist>`;
  
  fs.writeFileSync(entitlementsPath, entitlements);
  logger.debug('Created App.entitlements');
}

async function updatePodfile(iosPath: string, config: any, logger: any): Promise<void> {
  const podfilePath = path.join(iosPath, 'Podfile');
  
  const podfile = `platform :ios, '13.0'
use_frameworks! :linkage => :static

target 'App' do
  pod 'Capacitor', :path => '../node_modules/@capacitor/ios'
  pod 'CapacitorCordova', :path => '../node_modules/@capacitor/ios'
  
  # Add Capacitor plugins here as needed
  # pod 'CapacitorCamera', :path => '../node_modules/@capacitor/camera'
  # pod 'CapacitorPushNotifications', :path => '../node_modules/@capacitor/push-notifications'
  # pod 'CapacitorLocalNotifications', :path => '../node_modules/@capacitor/local-notifications'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
      config.build_settings['SWIFT_VERSION'] = '5.10'
      config.build_settings['ENABLE_BITCODE'] = 'NO'
    end
  end
end`;
  
  fs.writeFileSync(podfilePath, podfile);
  logger.debug('Updated Podfile');
}

async function createXcconfigs(iosPath: string, config: any, logger: any): Promise<void> {
  const configDir = path.join(iosPath, 'Config');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Debug.xcconfig
  const debugXcconfig = `// Debug.xcconfig
SWIFT_VERSION = 5.10
IPHONEOS_DEPLOYMENT_TARGET = 13.0
PRODUCT_BUNDLE_IDENTIFIER = ${config.appId}
CURRENT_PROJECT_VERSION = ${config.android.version?.code || 1}
MARKETING_VERSION = ${config.android.version?.name || '1.0.0'}
GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1
OTHER_SWIFT_FLAGS = -D DEBUG`;
  
  fs.writeFileSync(path.join(configDir, 'Debug.xcconfig'), debugXcconfig);
  
  // Release.xcconfig
  const releaseXcconfig = `// Release.xcconfig
SWIFT_VERSION = 5.10
IPHONEOS_DEPLOYMENT_TARGET = 13.0
PRODUCT_BUNDLE_IDENTIFIER = ${config.appId}
CURRENT_PROJECT_VERSION = ${config.android.version?.code || 1}
MARKETING_VERSION = ${config.android.version?.name || '1.0.0'}
GCC_PREPROCESSOR_DEFINITIONS = RELEASE=1`;
  
  fs.writeFileSync(path.join(configDir, 'Release.xcconfig'), releaseXcconfig);
  
  logger.debug('Created xcconfig files');
}

async function updateCapacitorConfig(cwd: string, config: any, logger: any): Promise<void> {
  const capacitorConfigPath = path.join(cwd, 'capacitor.config.ts');
  
  if (fs.existsSync(capacitorConfigPath)) {
    let capacitorConfig = fs.readFileSync(capacitorConfigPath, 'utf8');
    
    // Add iOS configuration if not present
    if (!capacitorConfig.includes('ios:')) {
      const iosConfig = `
  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
    scheme: 'https',
    allowsLinkPreview: false,
    prefersLargeTitles: false,
    scrollEnabled: true
  },`;
      
      capacitorConfig = capacitorConfig.replace(
        /(\s+)(}\s*;?\s*$)/m,
        `$1${iosConfig}$1$2`
      );
      
      fs.writeFileSync(capacitorConfigPath, capacitorConfig);
      logger.debug('Updated Capacitor config with iOS settings');
    }
  }
}

async function generateIosAssets(cwd: string, config: any, logger: any): Promise<void> {
  logger.info('Generating iOS assets...');
  
  // This would integrate with the assets plugin
  // For now, we'll create placeholder asset structure
  const iosPath = path.join(cwd, 'ios');
  const assetsPath = path.join(iosPath, 'App/App/Assets.xcassets');
  
  if (!fs.existsSync(assetsPath)) {
    fs.mkdirSync(assetsPath, { recursive: true });
  }
  
  // Create AppIcon.appiconset structure
  const appIconPath = path.join(assetsPath, 'AppIcon.appiconset');
  if (!fs.existsSync(appIconPath)) {
    fs.mkdirSync(appIconPath, { recursive: true });
    
    const contentsJson = {
      images: [
        { size: "20x20", idiom: "iphone", scale: "2x", filename: "Icon-App-20x20@2x.png" },
        { size: "20x20", idiom: "iphone", scale: "3x", filename: "Icon-App-20x20@3x.png" },
        { size: "29x29", idiom: "iphone", scale: "2x", filename: "Icon-App-29x29@2x.png" },
        { size: "29x29", idiom: "iphone", scale: "3x", filename: "Icon-App-29x29@3x.png" },
        { size: "40x40", idiom: "iphone", scale: "2x", filename: "Icon-App-40x40@2x.png" },
        { size: "40x40", idiom: "iphone", scale: "3x", filename: "Icon-App-40x40@3x.png" },
        { size: "60x60", idiom: "iphone", scale: "2x", filename: "Icon-App-60x60@2x.png" },
        { size: "60x60", idiom: "iphone", scale: "3x", filename: "Icon-App-60x60@3x.png" },
        { size: "20x20", idiom: "ipad", scale: "1x", filename: "Icon-App-20x20@1x.png" },
        { size: "20x20", idiom: "ipad", scale: "2x", filename: "Icon-App-20x20@2x.png" },
        { size: "29x29", idiom: "ipad", scale: "1x", filename: "Icon-App-29x29@1x.png" },
        { size: "29x29", idiom: "ipad", scale: "2x", filename: "Icon-App-29x29@2x.png" },
        { size: "40x40", idiom: "ipad", scale: "1x", filename: "Icon-App-40x40@1x.png" },
        { size: "40x40", idiom: "ipad", scale: "2x", filename: "Icon-App-40x40@2x.png" },
        { size: "76x76", idiom: "ipad", scale: "1x", filename: "Icon-App-76x76@1x.png" },
        { size: "76x76", idiom: "ipad", scale: "2x", filename: "Icon-App-76x76@2x.png" },
        { size: "83.5x83.5", idiom: "ipad", scale: "2x", filename: "Icon-App-83.5x83.5@2x.png" },
        { size: "1024x1024", idiom: "ios-marketing", scale: "1x", filename: "Icon-App-1024x1024@1x.png" }
      ],
      info: { author: "xcode", version: 1 }
    };
    
    fs.writeFileSync(
      path.join(appIconPath, 'Contents.json'),
      JSON.stringify(contentsJson, null, 2)
    );
    
    logger.debug('Created AppIcon.appiconset structure');
  }
  
  logger.info('✅ iOS assets structure created');
  logger.info('📝 Note: You\'ll need to add actual icon files to ios/App/App/Assets.xcassets/AppIcon.appiconset/');
}

async function createHandoffDocs(cwd: string, config: any, logger: any): Promise<void> {
  const docsPath = path.join(cwd, 'docs');
  
  if (!fs.existsSync(docsPath)) {
    fs.mkdirSync(docsPath, { recursive: true });
  }
  
  const handoffDoc = `# iOS Build Handoff Guide

This document provides step-by-step instructions for building and distributing your iOS app on macOS.

## Prerequisites

- **macOS** with Xcode 15.0 or later
- **Apple Developer Account** (for distribution)
- **CocoaPods** installed

## Setup Steps

### 1. Install Dependencies

\`\`\`bash
# Install CocoaPods (if not already installed)
sudo gem install cocoapods

# Navigate to iOS directory
cd ios

# Install iOS dependencies
pod install
\`\`\`

### 2. Open Project in Xcode

\`\`\`bash
# Open the workspace (NOT the .xcodeproj file)
open App.xcworkspace
\`\`\`

### 3. Configure Signing

1. In Xcode, select the **App** project in the navigator
2. Select the **App** target
3. Go to **Signing & Capabilities** tab
4. Set your **Team** (Apple Developer Account)
5. Ensure **Automatically manage signing** is checked
6. Verify the **Bundle Identifier** matches: \`${config.appId}\`

### 4. Build and Archive

1. Select **Any iOS Device (arm64)** as the destination
2. Go to **Product** → **Archive**
3. Wait for the build to complete
4. The **Organizer** window will open

### 5. Distribute

#### For TestFlight (Recommended for testing)

1. In the Organizer, select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Select **Upload**
5. Follow the upload process
6. Go to [App Store Connect](https://appstoreconnect.apple.com) to manage your build

#### For Ad Hoc Distribution

1. In the Organizer, select your archive
2. Click **Distribute App**
3. Choose **Ad Hoc**
4. Select devices for testing
5. Export the .ipa file

## Troubleshooting

### Common Issues

#### "No matching provisioning profile found"
- Ensure your Apple Developer Account has the correct certificates
- Check that the Bundle ID is registered in your developer account
- Try refreshing provisioning profiles in Xcode

#### "CocoaPods not found"
\`\`\`bash
sudo gem install cocoapods
cd ios && pod install
\`\`\`

#### "Build failed with Swift version"
- Ensure Xcode is up to date
- Check that the Swift version in xcconfig files matches your Xcode version

#### "Missing team"
- Add your Apple ID in Xcode Preferences → Accounts
- Ensure you have the correct role in your Apple Developer Account

### Build Settings

The project is configured with:
- **iOS Deployment Target**: 13.0
- **Swift Version**: 5.10
- **Bundle ID**: ${config.appId}
- **Version**: ${config.android.version?.name || '1.0.0'}
- **Build Number**: ${config.android.version?.code || 1}

## Next Steps

1. **Test on device**: Install via TestFlight or direct installation
2. **Submit for review**: Use App Store Connect to submit for App Store review
3. **Monitor**: Use App Store Connect analytics to track app performance

## Support

For issues with this build process:
- Check [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)
- Review [Apple Developer documentation](https://developer.apple.com/documentation/)
- Check Xcode console for detailed error messages
`;
  
  fs.writeFileSync(path.join(docsPath, 'IOS_HANDBOOK.md'), handoffDoc);
  logger.info('📖 Created iOS handoff documentation');
}

export default prepareIos;
export { prepareIos };
