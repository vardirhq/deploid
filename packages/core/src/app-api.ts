import { createContext, runPipeline, type PipelineContext } from './pipeline.js';
import { loadConfig } from './config.js';
import { loadPlugin } from './plugin-loader.js';
import type { DeploidConfig } from './types.js';

export interface CommandRunOptions {
  cwd?: string;
  config?: DeploidConfig;
  debug?: boolean;
  contextExtras?: Record<string, unknown>;
}

export interface DoctorRunOptions extends CommandRunOptions {
  doctorOptions?: {
    json?: boolean;
    markdown?: boolean;
    ci?: boolean;
    summary?: boolean;
    verbose?: boolean;
    projectOnly?: boolean;
    fix?: boolean;
  };
}

export function createFallbackConfig(): DeploidConfig {
  return {
    appName: 'Deploid project',
    appId: 'dev.deploid.placeholder',
    web: { framework: 'static', buildCommand: 'echo "deploid"', webDir: 'public' },
    android: { packaging: 'capacitor' }
  };
}

export async function loadConfigOptional(cwd: string = process.cwd(), fallback: DeploidConfig = createFallbackConfig()): Promise<DeploidConfig> {
  try {
    return await loadConfig(cwd);
  } catch {
    return fallback;
  }
}

export async function runPluginCommand(pluginName: string, options: CommandRunOptions = {}): Promise<PipelineContext> {
  const cwd = options.cwd || process.cwd();
  const config = options.config || await loadConfig(cwd);
  const ctx = createContext(cwd, config, options.debug);

  if (options.contextExtras) {
    Object.assign(ctx as Record<string, unknown>, options.contextExtras);
  }

  const step = await loadPlugin(pluginName, config);
  await runPipeline(ctx, [step]);
  return ctx;
}

export async function runDoctorCommand(options: DoctorRunOptions = {}): Promise<PipelineContext> {
  const cwd = options.cwd || process.cwd();
  const config = options.config || await loadConfigOptional(cwd);
  return runPluginCommand('doctor', {
    cwd,
    config,
    debug: options.debug,
    contextExtras: {
      doctorOptions: options.doctorOptions || {}
    }
  });
}
