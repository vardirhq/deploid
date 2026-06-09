# Android Build Troubleshooting Guide

This guide covers common issues when building Android apps with Deploid and their solutions.

## 🚨 Common Issues

### 1. APK Crashes Immediately on Launch

**Symptoms**: App opens then immediately closes
**Cause**: Missing Capacitor plugins for browser APIs

**Solution**:
```bash
# Install required Capacitor plugins
npm install @capacitor/clipboard

# Update your code to use Capacitor APIs
// Instead of: navigator.clipboard.writeText(text)
// Use: Clipboard.write({ string: text })
```

**Code Changes**:
```typescript
// Before (causes crash)
navigator.clipboard.writeText(text)

// After (works in Capacitor)
import { Clipboard } from '@capacitor/clipboard'
Clipboard.write({ string: text })
```

### 2. Login/API Connection Issues

**Symptoms**: App opens but can't connect to backend API
**Cause**: Network security configuration or HTTPS issues

**Solution**:
```bash
# Add network debugging tools
deploid debug

# This creates NetworkDebug component to test connectivity
```

**Manual Fix**:
1. Check `android/app/src/main/res/xml/network_security_config.xml`
2. Verify API base URL in environment variables
3. Test with NetworkDebug component

### 3. Build Failures

**Symptoms**: Gradle build fails with Java/Gradle errors
**Cause**: Java/Gradle version incompatibility

**Solution**:
```bash
# Ensure Java 17+ is installed
sudo pacman -S jdk21-openjdk

# Set environment variables
# Optional if java is already on PATH
export JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"
export ANDROID_HOME=~/Android/Sdk

# Clean and rebuild
cd android
./gradlew clean
./gradlew assembleDebug
```

**Gradle Configuration** (auto-applied by Deploid):
```properties
# gradle.properties
# Deploid does not pin org.gradle.java.home; it uses JAVA_HOME or java on PATH
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g
```

### 4. Performance Issues

**Symptoms**: Build takes 5+ minutes
**Cause**: Gradle not optimized

**Solution** (auto-applied by Deploid):
```properties
# gradle.properties
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
```

## 🔧 Debugging Steps

### 1. Check Network Connectivity
```bash
# Add debugging tools to your project
deploid debug

# This creates NetworkDebug component
# Add it to your login page to test API connectivity
```

### 2. Check Build Logs
Look for these common errors:
- `Unsupported class file major version 69` → Java version issue
- `SDK location not found` → ANDROID_HOME not set
- `AAPT2 daemon startup failed` → Clean build and retry

### 3. Test in Browser First
```bash
# Ensure web app works in browser
npm run dev

# Check for JavaScript errors
# Verify API calls work
# Test localStorage functionality
```

## 🛠️ Environment Setup

### Required Software:
- **Java 17+** (JDK) - `sudo pacman -S jdk21-openjdk`
- **Android SDK** (API 34) - Install via Android Studio
- **Gradle 8.13** - Auto-managed by Deploid
- **Node.js 18+** - For web development

### Environment Variables:
```bash
# Optional if java is already on PATH
export JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### Verify Installation:
```bash
# Check Java version
java -version  # Should show Java 21

# Check Android SDK
ls $ANDROID_HOME  # Should show SDK contents

# Check Gradle
cd android && ./gradlew --version  # Should show Gradle 8.13
```

## 📱 Testing Your APK

### 1. Install APK
```bash
# Install on device/emulator
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or use Waydroid
waydroid app install android/app/build/outputs/apk/debug/app-debug.apk
```

### 2. Check Logs
```bash
# Android logs
adb logcat | grep -i "your-app-name"

# Waydroid logs
waydroid logcat
```

### 3. Test Network Connectivity
- Use the NetworkDebug component
- Check API endpoints manually
- Verify SSL certificates

## 🚀 Best Practices

### 1. Development Workflow
```bash
# 1. Develop and test in browser
npm run dev

# 2. Build web assets
npm run build

# 3. Package for Android
deploid package

# 4. Build APK
deploid build

# 5. Test and debug
deploid debug
```

### 2. Code Considerations
- Use Capacitor plugins instead of browser APIs
- Handle network errors gracefully
- Test localStorage functionality
- Avoid hardcoded URLs

### 3. Performance Optimization
- Enable Gradle parallel builds
- Use build caching
- Increase heap size for large projects
- Clean build when switching Java versions

## 🆘 Getting Help

If you're still having issues:

1. **Check the logs**: Look for specific error messages
2. **Use debugging tools**: Run `deploid debug` to add network testing
3. **Test incrementally**: Start with a simple app, then add complexity
4. **Verify environment**: Ensure all required software is installed correctly

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Gradle Plugin](https://developer.android.com/studio/build)
- [Java Compatibility Matrix](https://docs.gradle.org/current/userguide/compatibility.html)
