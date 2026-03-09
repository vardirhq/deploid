// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}

import * as fs from 'node:fs';
import * as path from 'node:path';

function getCapacitorPreferencesRange(packageJson: any): string {
  const sources = [
    packageJson?.dependencies?.['@capacitor/core'],
    packageJson?.devDependencies?.['@capacitor/core']
  ];

  const combined = sources.filter((value) => typeof value === 'string').join(' ');
  const majorMatch = combined.match(/[6-8]/);
  if (!majorMatch) {
    return '^8.0.0';
  }
  return `^${majorMatch[0]}.0.0`;
}

const storagePlugin = (): PipelineStep => async ({ logger, config, cwd }: any) => {
  logger.info('storage-plugin: setting up cross-platform storage utilities');
  
  const templatesDir = path.join(__dirname, '..', 'templates');
  const srcDir = path.join(cwd, 'src');
  const libDir = path.join(srcDir, 'lib');
  
  // Ensure lib directory exists
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  // Copy storage utilities
  const storageFiles = [
    'storage.ts',
    'secureStorage.ts', 
    'storageMigration.ts'
  ];
  
  for (const file of storageFiles) {
    const sourcePath = path.join(templatesDir, file);
    const targetPath = path.join(libDir, file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      logger.debug(`Copied storage utility: ${file}`);
    } else {
      logger.warn(`Storage template not found: ${file}`);
    }
  }
  
  // Update package.json with required dependencies
  const packageJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add storage dependencies
    const storageDeps = {
      '@capacitor/preferences': getCapacitorPreferencesRange(packageJson)
    };
    
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    Object.assign(packageJson.dependencies, storageDeps);
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    logger.info('Added storage dependencies to package.json');
  }
  
  // Create storage documentation
  const docsPath = path.join(cwd, 'STORAGE_GUIDE.md');
  const docsContent = `# Cross-Platform Storage Guide

## 🎯 Overview

This project includes cross-platform storage utilities that work seamlessly across web browsers and native mobile apps.

## 📦 What's Included

- **\`src/lib/storage.ts\`** - Main storage utility
- **\`src/lib/secureStorage.ts\`** - Secure storage for sensitive data
- **\`src/lib/storageMigration.ts\`** - Migration utilities

## 🚀 Quick Start

### Basic Usage

\`\`\`typescript
import { crossPlatformStorage } from './lib/storage'

// Store data
await crossPlatformStorage.set('theme', 'dark')
await crossPlatformStorage.set('userPreferences', { notifications: true })

// Retrieve data
const theme = await crossPlatformStorage.get('theme')
const preferences = await crossPlatformStorage.get('userPreferences')
\`\`\`

### Secure Storage

\`\`\`typescript
import { secureStorageUtil } from './lib/secureStorage'

// Store sensitive data
await secureStorageUtil.set('authToken', 'secret-token')
await secureStorageUtil.set('userData', { id: '123', email: 'user@example.com' })

// Retrieve sensitive data
const token = await secureStorageUtil.get('authToken')
const user = await secureStorageUtil.get('userData')
\`\`\`

## 🔄 Migration from localStorage

If you have existing localStorage usage, use the migration utilities:

\`\`\`typescript
import { migrateStorageData } from './lib/storageMigration'

// Run migration on app startup
migrateStorageData()
\`\`\`

## 🌐 Environment Detection

The storage system automatically detects the environment:

- **Web**: Uses localStorage/sessionStorage
- **Native (Capacitor)**: Uses Capacitor Preferences
- **Secure Storage**: Uses encrypted storage on device

## 🔒 Security Best Practices

### Data Classification

**Public Data (crossPlatformStorage):**
- ✅ Theme preferences
- ✅ Locale settings  
- ✅ UI state
- ✅ Non-sensitive user preferences

**Sensitive Data (secureStorageUtil):**
- 🔒 Auth tokens
- 🔒 User session data
- 🔒 API keys
- 🔒 Personal settings

### Best Practices

1. **Never store auth tokens in localStorage**
2. **Use HTTP-only cookies for refresh tokens**
3. **Store access tokens in memory only**
4. **Use secure storage for sensitive native data**
5. **Clear storage on logout**

## 📱 Native App Benefits

- **Encrypted storage** on device
- **Cross-platform** (iOS/Android)
- **Automatic backup** (iOS)
- **Secure enclave** (iOS)

## 🧪 Testing

\`\`\`typescript
// Test storage availability
crossPlatformStorage.isAvailable() // Should return true

// Test secure storage
secureStorageUtil.isAvailable() // Should return true
\`\`\`

## 🔧 Advanced Usage

### Custom Storage Keys

\`\`\`typescript
// Add custom keys to StorageKey type
type CustomStorageKey = 'myApp:settings' | 'myApp:cache'

// Use with type safety
await crossPlatformStorage.set('myApp:settings', settings)
\`\`\`

### Error Handling

\`\`\`typescript
try {
  const data = await crossPlatformStorage.get('importantData')
  if (data) {
    // Use data
  }
} catch (error) {
  console.error('Storage error:', error)
  // Handle fallback
}
\`\`\`

## 📚 Examples

### Theme Provider

\`\`\`typescript
import { crossPlatformStorage } from '../lib/storage'

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light')
  
  useEffect(() => {
    const loadTheme = async () => {
      const stored = await crossPlatformStorage.get('theme')
      if (stored) setTheme(stored)
    }
    loadTheme()
  }, [])
  
  const setTheme = async (newTheme) => {
    setTheme(newTheme)
    await crossPlatformStorage.set('theme', newTheme)
  }
  
  // ... rest of component
}
\`\`\`

### Auth Provider

\`\`\`typescript
import { secureStorageUtil } from '../lib/secureStorage'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = await secureStorageUtil.get('user')
      if (storedUser) setUser(storedUser)
    }
    loadUser()
  }, [])
  
  const login = async (credentials) => {
    const user = await authenticate(credentials)
    setUser(user)
    await secureStorageUtil.set('user', user)
  }
  
  // ... rest of component
}
\`\`\`

## 🆘 Troubleshooting

### Common Issues

1. **Storage not available**: Check if running in supported environment
2. **Type errors**: Ensure StorageKey types are properly defined
3. **Migration issues**: Run migration utilities on app startup

### Debug Mode

\`\`\`typescript
// Enable debug logging
localStorage.setItem('storage:debug', 'true')
\`\`\`

## 📖 Further Reading

- [Capacitor Preferences Documentation](https://capacitorjs.com/docs/apis/preferences)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [React Native Secure Storage](https://github.com/oblador/react-native-keychain)
`;

  fs.writeFileSync(docsPath, docsContent);
  logger.info('Created storage documentation: STORAGE_GUIDE.md');
  
  logger.info('✅ Cross-platform storage utilities installed');
  logger.info('📖 See STORAGE_GUIDE.md for usage instructions');
};

export default storagePlugin;
export { storagePlugin };
