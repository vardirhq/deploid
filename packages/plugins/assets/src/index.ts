// PipelineStep type definition
interface PipelineStep {
  (context: { logger: any; config: any; cwd: string }): Promise<void>;
}
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const assetsPlugin = (): PipelineStep => async ({ logger, config, cwd }: any) => {
  logger.info('assets-plugin: generating icons and assets');
  
  if (!config.assets?.source) {
    logger.warn('No assets.source configured, skipping asset generation');
    return;
  }

  const sourcePath = path.resolve(cwd, config.assets.source);
  const outputDir = path.resolve(cwd, config.assets.output || 'assets-gen');
  
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Source logo not found: ${sourcePath}\n` +
      `  Copy your app logo to that path then re-run: deploid assets\n` +
      `  Supported formats: SVG (recommended), PNG, JPEG`
    );
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    // Generate Android icons
    await generateAndroidIcons(sourcePath, outputDir, logger);
    
    // Generate PWA icons
    await generatePWAIcons(sourcePath, outputDir, logger);
    
    // Generate favicons
    await generateFavicons(sourcePath, outputDir, logger);
    
    logger.info('✅ Asset generation complete');
  } catch (error) {
    logger.error(`Asset generation failed: ${error}`);
  }
};

async function generateAndroidIcons(sourcePath: string, outputDir: string, logger: any): Promise<void> {
  const androidSizes = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const { name, size } of androidSizes) {
    const dir = path.join(outputDir, 'android', name);
    fs.mkdirSync(dir, { recursive: true });
    
    await sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));
    
    logger.debug(`Generated Android icon: ${name}/ic_launcher.png (${size}x${size})`);
  }
}

async function generatePWAIcons(sourcePath: string, outputDir: string, logger: any): Promise<void> {
  const pwaSizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of pwaSizes) {
    await sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, name));
    
    logger.debug(`Generated PWA icon: ${name} (${size}x${size})`);
  }
}

async function generateFavicons(sourcePath: string, outputDir: string, logger: any): Promise<void> {
  const faviconSizes = [16, 32, 48, 64];

  for (const size of faviconSizes) {
    await sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `favicon-${size}x${size}.png`));
    
    logger.debug(`Generated favicon: favicon-${size}x${size}.png`);
  }
}

export default assetsPlugin;
export { assetsPlugin };
