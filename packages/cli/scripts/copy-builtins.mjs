import { access, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outputRoot = path.join(repoRoot, 'packages', 'cli', 'dist', 'internal');
const modules = [
  [
    "core",
    "packages/core/dist"
  ],
  [
    "plugins/artifacts",
    "packages/plugins/artifacts/dist"
  ],
  [
    "plugins/assets",
    "packages/plugins/assets/dist"
  ],
  [
    "plugins/build-android",
    "packages/plugins/build-android/dist"
  ],
  [
    "plugins/changelog",
    "packages/plugins/changelog/dist"
  ],
  [
    "plugins/ci-init",
    "packages/plugins/ci-init/dist"
  ],
  [
    "plugins/debug-network",
    "packages/plugins/debug-network/dist"
  ],
  [
    "plugins/deploy-android",
    "packages/plugins/deploy-android/dist"
  ],
  [
    "plugins/doctor",
    "packages/plugins/doctor/dist"
  ],
  [
    "plugins/packaging-capacitor",
    "packages/plugins/packaging-capacitor/dist"
  ],
  [
    "plugins/packaging-electron",
    "packages/plugins/packaging-electron/dist"
  ],
  [
    "plugins/prepare-ios",
    "packages/plugins/prepare-ios/dist"
  ],
  [
    "plugins/publish",
    "packages/plugins/publish/dist"
  ],
  [
    "plugins/release-init",
    "packages/plugins/release-init/dist"
  ],
  [
    "plugins/version",
    "packages/plugins/version/dist"
  ]
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const [target, source] of modules) {
  const sourcePath = path.join(repoRoot, source);
  const targetPath = path.join(outputRoot, target);
  await access(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
}
