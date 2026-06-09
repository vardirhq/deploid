# 🚀 Deploid Quick Start Guide

Get your web app running on Android in minutes!

## Prerequisites

- **Node.js 18+**
- **Java 21** (OpenJDK)
- **Android SDK** (API 34)

### Install Java 21
```bash
# Arch Linux
sudo pacman -S jdk21-openjdk

# Ubuntu/Debian
sudo apt install openjdk-21-jdk

# macOS
brew install openjdk@21
```

### Install Android SDK
1. Download [Android Studio](https://developer.android.com/studio)
2. Install Android SDK (API 34)
3. Set environment variables:
```bash
export ANDROID_HOME=~/Android/Sdk
# Optional if java is already on PATH
export JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

## Quick Start

### 1. Initialize Your Project
```bash
# In your web app directory
deploid init

# This creates deploid.config.ts and installs dependencies
```

### 2. Generate Assets
```bash
# Creates all required icons and screenshots
deploid assets
```

### 3. Package for Android
```bash
# Wraps your web app for Android using Capacitor
deploid package
```

### 4. Build APK
```bash
# Creates debug APK for testing
deploid build
```

### 5. Test Your App
```bash
# Install on device/emulator
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or use Waydroid
waydroid app install android/app/build/outputs/apk/debug/app-debug.apk
```

## Troubleshooting

### App Crashes Immediately
```bash
# Add debugging tools
deploid debug

# This creates NetworkDebug component to test connectivity
```

### Build Failures
```bash
# Check Java version
java -version  # Should show Java 21

# Check Android SDK
ls $ANDROID_HOME  # Should show SDK contents

# Clean and rebuild
cd android
./gradlew clean
./gradlew assembleDebug
```

### Network/Login Issues
1. Use the NetworkDebug component (added by `deploid debug`)
2. Check API base URL in environment variables
3. Verify network security configuration

## Next Steps

### For Production
1. **Set up signing**: Create Android keystore
2. **Build release**: Generate signed AAB for Play Store
3. **Distribution**: Upload manually (publish automation is not implemented in 2.0)

### For Development
- Use `deploid debug` to add network testing tools
- Check `docs/ANDROID_TROUBLESHOOTING.md` for detailed solutions
- Test in browser first, then on Android

## Commands Reference

| Command | Description |
|---------|-------------|
| `deploid init` | Setup project configuration |
| `deploid assets` | Generate icons and screenshots |
| `deploid package` | Wrap app for Android |
| `deploid build` | Build APK/AAB |
| `deploid debug` | Add debugging tools |
| `deploid publish` | Not implemented in 2.0 |

## Need Help?

- 📚 **Full Documentation**: See `docs/` folder
- 🔧 **Troubleshooting**: Run `deploid debug` and check `ANDROID_TROUBLESHOOTING.md`
- 🐛 **Issues**: Check build logs and network connectivity

---

**Happy building! 🚀**
