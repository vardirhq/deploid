// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}

const debugNetwork = (): PipelineStep => async ({ logger, config, cwd }: any) => {
  logger.info('🔍 Network debugging tools added to your project')
  
  // Create network debug component
  const debugComponent = `import { useState } from 'react'

export const NetworkDebug = () => {
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const testNetwork = async () => {
    setIsLoading(true)
    setTestResult('Testing network connectivity...\\n')
    
    try {
      // Test 1: Basic fetch to a reliable public API
      try {
        setTestResult(prev => prev + \`🔄 Testing API endpoint: https://httpbin.org/get\\n\`)
        const response = await fetch('https://httpbin.org/get', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        setTestResult(prev => prev + \`✅ API Health Check: \${response.status} \${response.statusText}\\n\`)
      } catch (apiError) {
        const error = apiError as Error
        setTestResult(prev => prev + \`❌ API Test Failed:\\n\`)
        setTestResult(prev => prev + \`   Error: \${error.message}\\n\`)
        setTestResult(prev => prev + \`   Type: \${error.constructor.name}\\n\`)
        throw apiError
      }
      
      // Test 2: Check if we can reach a reliable domain
      try {
        setTestResult(prev => prev + \`🔄 Testing domain: https://www.google.com/\\n\`)
        const pingResponse = await fetch('https://www.google.com/', {
          method: 'HEAD',
        })
        
        setTestResult(prev => prev + \`✅ Domain Reachable: \${pingResponse.status}\\n\`)
      } catch (domainError) {
        const error = domainError as Error
        setTestResult(prev => prev + \`❌ Domain Test Failed:\\n\`)
        setTestResult(prev => prev + \`   Error: \${error.message}\\n\`)
        setTestResult(prev => prev + \`   Type: \${error.constructor.name}\\n\`)
        throw domainError
      }
      
      // Test 3: Check localStorage availability
      try {
        localStorage.setItem('test', 'value')
        const retrieved = localStorage.getItem('test')
        localStorage.removeItem('test')
        setTestResult(prev => prev + \`✅ localStorage: Working (\${retrieved === 'value' ? 'OK' : 'FAIL'})\\n\`)
      } catch (error) {
        setTestResult(prev => prev + \`❌ localStorage: \${error}\\n\`)
      }
      
      // Test 4: Check user agent
      setTestResult(prev => prev + \`📱 User Agent: \${navigator.userAgent}\\n\`)
      
    } catch (error) {
      const err = error as Error
      setTestResult(prev => prev + \`❌ Network Error Details:\\n\`)
      setTestResult(prev => prev + \`   Error Type: \${err.constructor.name}\\n\`)
      setTestResult(prev => prev + \`   Error Message: \${err.message}\\n\`)
      setTestResult(prev => prev + \`   Error Stack: \${err.stack}\\n\`)
      setTestResult(prev => prev + \`   Full Error: \${JSON.stringify(error, null, 2)}\\n\`)
      
      // Additional debugging info
      setTestResult(prev => prev + \`\\n🔍 Debug Information:\\n\`)
      setTestResult(prev => prev + \`   Online Status: \${navigator.onLine}\\n\`)
      setTestResult(prev => prev + \`   Connection Type: \${(navigator as any).connection?.effectiveType || 'unknown'}\\n\`)
      setTestResult(prev => prev + \`   User Agent: \${navigator.userAgent}\\n\`)
      setTestResult(prev => prev + \`   Current URL: \${window.location.href}\\n\`)
      setTestResult(prev => prev + \`   Protocol: \${window.location.protocol}\\n\`)
      setTestResult(prev => prev + \`   Host: \${window.location.host}\\n\`)
      
      // Network-specific debugging
      setTestResult(prev => prev + \`\\n🌐 Network Analysis:\\n\`)
      setTestResult(prev => prev + \`   Is Localhost: \${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'}\\n\`)
      setTestResult(prev => prev + \`   Is HTTPS: \${window.location.protocol === 'https:'}\\n\`)
      setTestResult(prev => prev + \`   Is Android: \${navigator.userAgent.includes('Android')}\\n\`)
      setTestResult(prev => prev + \`   Is WayDroid: \${navigator.userAgent.includes('WayDroid')}\\n\`)
      
      // Try alternative endpoints
      setTestResult(prev => prev + \`\\n🔄 Testing Alternative Endpoints:\\n\`)
      
      // Test localhost HTTP instead of external HTTPS
      try {
        setTestResult(prev => prev + \`   Testing localhost HTTP...\\n\`)
        const localResponse = await fetch('http://localhost:3000', { method: 'HEAD' })
        setTestResult(prev => prev + \`   ✅ Localhost HTTP: \${localResponse.status}\\n\`)
      } catch (localError) {
        setTestResult(prev => prev + \`   ❌ Localhost HTTP failed: \${(localError as Error).message}\\n\`)
      }
      
      // Test if we can reach the current domain
      try {
        setTestResult(prev => prev + \`   Testing current domain...\\n\`)
        const currentResponse = await fetch(window.location.origin, { method: 'HEAD' })
        setTestResult(prev => prev + \`   ✅ Current domain: \${currentResponse.status}\\n\`)
      } catch (currentError) {
        setTestResult(prev => prev + \`   ❌ Current domain failed: \${(currentError as Error).message}\\n\`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-white font-bold mb-2">Network Debug</h3>
      <button 
        onClick={testNetwork}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test Network'}
      </button>
      <pre className="text-green-400 text-xs mt-2 whitespace-pre-wrap">
        {testResult}
      </pre>
    </div>
  )
}`

  // Write debug component to project
  const fs = await import('fs')
  const path = await import('path')
  
  const debugPath = path.join(cwd, 'src/components/NetworkDebug.tsx')
  const debugDir = path.dirname(debugPath)
  
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true })
  }
  
  fs.writeFileSync(debugPath, debugComponent)
  logger.info('✅ Network debug component created')
  
  // Create troubleshooting guide
  const troubleshootingGuide = `# Android Build Troubleshooting Guide

## Common Issues and Solutions

### 1. APK Crashes Immediately
**Cause**: Missing Capacitor plugins for browser APIs
**Solution**: 
- Add \`@capacitor/clipboard\` for clipboard functionality
- Replace \`navigator.clipboard\` with \`Clipboard.write()\`
- Add other Capacitor plugins as needed

### 2. Login/API Connection Issues
**Cause**: Network security configuration or HTTPS issues
**Solution**:
- Check network security config in \`android/app/src/main/res/xml/network_security_config.xml\`
- Verify API base URL in environment variables
- Test with NetworkDebug component

### 3. Build Failures
**Cause**: Java/Gradle version incompatibility
**Solution**:
- Ensure Java 21 is installed and set in \`gradle.properties\`
- Use Gradle 8.13 and AGP 8.12.0
- Check \`ANDROID_HOME\` environment variable

### 4. Performance Issues
**Cause**: Gradle not optimized
**Solution**:
- Enable parallel builds: \`org.gradle.parallel=true\`
- Enable caching: \`org.gradle.caching=true\`
- Increase heap size: \`org.gradle.jvmargs=-Xmx4g\`

## Debugging Steps

1. **Check Network Connectivity**:
   - Use NetworkDebug component in your app
   - Test API endpoints manually
   - Verify SSL certificates

2. **Check Build Logs**:
   - Look for Java version errors
   - Check Gradle daemon issues
   - Verify Android SDK location

3. **Test in Browser First**:
   - Ensure web app works in browser
   - Check for JavaScript errors
   - Verify API calls work

## Environment Setup

### Required Software:
- Java 17+ (JDK; JAVA_HOME can be inferred from PATH)
- Android SDK (API 34)
- Gradle 8.13
- Node.js 18+

### Environment Variables:
\`\`\`bash
# Optional if java is already on PATH
export JAVA_HOME="$(dirname $(dirname $(readlink -f $(which java))))"
export ANDROID_HOME=~/Android/Sdk
\`\`\`

### Gradle Configuration:
\`\`\`properties
# Prefer JAVA_HOME or java on PATH instead of pinning org.gradle.java.home
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g
\`\`\`
`

  const guidePath = path.join(cwd, 'ANDROID_TROUBLESHOOTING.md')
  fs.writeFileSync(guidePath, troubleshootingGuide)
  logger.info('✅ Troubleshooting guide created')
}

export default debugNetwork;
export { debugNetwork };
