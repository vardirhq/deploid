export type PackagingEngine = 'capacitor' | 'tauri' | 'twa';
export type ScreenOrientation = 'portrait' | 'landscape' | 'sensor' | 'sensorPortrait' | 'sensorLandscape' | 'fullSensor' | 'reversePortrait' | 'reverseLandscape';
export type LaunchMode = 'standard' | 'singleTop' | 'singleTask' | 'singleInstance';
export type StatusBarStyle = 'light' | 'dark' | 'auto';
export type WindowSoftInputMode = 'adjustResize' | 'adjustPan' | 'adjustNothing';

export interface DeploidConfig {
  appName: string;
  appId: string;
  web: {
    framework: 'vite' | 'next' | 'cra' | 'static';
    buildCommand: string;
    webDir: string;
    pwa?: { manifest?: string; serviceWorker?: boolean };
  };
  android: {
    packaging: PackagingEngine;
    targetSdk?: number;
    minSdk?: number;
    permissions?: string[];
    signing?: {
      keystorePath?: string;
      alias?: string;
      storePasswordEnv?: string;
      keyPasswordEnv?: string;
    };
    version?: { code: number; name: string };
    display?: {
      fullscreen?: boolean;
      immersive?: boolean;
      orientation?: ScreenOrientation;
      statusBarStyle?: StatusBarStyle;
      statusBarHidden?: boolean;
      navigationBarHidden?: boolean;
      windowSoftInputMode?: WindowSoftInputMode;
    };
    launch?: {
      launchMode?: LaunchMode;
      taskAffinity?: string;
      allowBackup?: boolean;
      allowClearUserData?: boolean;
    };
    build?: {
      enableProguard?: boolean;
      enableMultidex?: boolean;
      minifyEnabled?: boolean;
      shrinkResources?: boolean;
      buildType?: 'apk' | 'aab' | 'both';
    };
    performance?: {
      hardwareAccelerated?: boolean;
      largeHeap?: boolean;
    };
  };
  assets?: { source: string; output?: string };
  publish?: {
    play?: {
      track?: 'internal' | 'alpha' | 'beta' | 'production';
      status?: 'draft' | 'inProgress' | 'halted' | 'completed';
      serviceAccountJson?: string;
    };
    github?: { repo: string; draft?: boolean };
  };
  plugins?: string[];
}

export interface DeploidPlugin {
  name: string;
  requirements?: string[];
  validate?: (ctx: { cwd: string; config: DeploidConfig; logger: { info: (msg: string) => void } }) => Promise<void>;
  plan?: (ctx: { cwd: string; config: DeploidConfig }) => Promise<string[]> | string[];
  run: (ctx: { cwd: string; config: DeploidConfig; logger: unknown; debug?: boolean }) => Promise<void>;
}