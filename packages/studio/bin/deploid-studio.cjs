#!/usr/bin/env node
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawn } = require('node:child_process');

const electronPath = require('electron');
const appMain = join(__dirname, '..', 'dist', 'main.js');

if (!existsSync(appMain)) {
  console.error('Deploid Studio is not built yet. Run: pnpm --filter @deploid/studio build');
  process.exit(1);
}

const child = spawn(electronPath, [appMain, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    DEPLOID_STUDIO_LAUNCH_CWD: process.cwd()
  }
});

child.on('exit', (code) => process.exit(code ?? 0));
