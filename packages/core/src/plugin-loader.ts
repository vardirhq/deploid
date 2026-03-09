import { PipelineStep } from './pipeline.js';
import { DeploidConfig, DeploidPlugin } from './types.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadPlugin(pluginName: string, config: DeploidConfig): Promise<PipelineStep> {
  // Keep config in signature for future plugin selection hooks.
  void config;

  const packageName = `@deploid/plugin-${pluginName}`;

  // First resolve plugin as an installed package.
  try {
    return instantiatePlugin(await import(packageName), pluginName);
  } catch {
    // Fall through to monorepo/dev fallback.
  }

  // Fallback for monorepo/dev usage when packages are built locally.
  const localPluginPath = new URL(`../../plugins/${pluginName}/dist/index.js`, import.meta.url).pathname;
  if (existsSync(localPluginPath)) {
    return instantiatePlugin(await import(localPluginPath), pluginName);
  }

  const workspacePluginPath = path.resolve(process.cwd(), 'packages', 'plugins', pluginName, 'dist', 'index.js');
  if (existsSync(workspacePluginPath)) {
    return instantiatePlugin(await import(pathToFileURL(workspacePluginPath).href), pluginName);
  }

  throw new Error(`Plugin "${pluginName}" not found. Expected package "${packageName}".`);
}

export async function loadPluginsFromConfig(config: DeploidConfig): Promise<PipelineStep[]> {
  const steps: PipelineStep[] = [];
  
  // Load plugins based on config
  if (config.assets?.source) {
    steps.push(await loadPlugin('assets', config));
  }
  
  // Load packaging plugin based on android.packaging
  const packagingPlugin = `packaging-${config.android.packaging}`;
  steps.push(await loadPlugin(packagingPlugin, config));
  
  return steps;
}

function instantiatePlugin(mod: Record<string, unknown>, pluginName: string): PipelineStep {
  if (mod.default && isPluginObject(mod.default)) {
    return wrapPlugin(mod.default);
  }

  if (typeof mod.default === 'function') {
    return (mod.default as () => PipelineStep)();
  }

  const candidates = [
    pluginName.replace(/-/g, ''),
    `${pluginName.replace(/-/g, '')}Plugin`,
    pluginName
  ];

  for (const key of candidates) {
    const value = mod[key];
    if (value && isPluginObject(value)) {
      return wrapPlugin(value);
    }
    if (typeof value === 'function') {
      return (value as () => PipelineStep)();
    }
  }

  throw new Error(`Plugin "${pluginName}" has no callable export.`);
}

function isPluginObject(value: unknown): value is DeploidPlugin {
  return typeof value === 'object' && value !== null && 'run' in value && typeof (value as { run: unknown }).run === 'function';
}

function wrapPlugin(plugin: DeploidPlugin): PipelineStep {
  return async (ctx) => {
    if (plugin.plan) {
      const plan = await plugin.plan({ cwd: ctx.cwd, config: ctx.config });
      if (ctx.debug && plan.length) {
        ctx.logger.debugStep(`plugin ${plugin.name} plan`, plan);
      }
    }

    if (plugin.validate) {
      await plugin.validate({ cwd: ctx.cwd, config: ctx.config, logger: ctx.logger });
    }

    await plugin.run(ctx);
  };
}
