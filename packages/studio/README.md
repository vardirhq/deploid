# Deploid Studio

This workspace contains the retired experimental Studio prototype. It is private and is
not published to npm.

The supported Deploid product is the `@deploid/cli` package. Any future GUI should be
distributed as a standalone desktop application (for example AppImage, DMG, and Windows
installer) and use the CLI or its local daemon/API as the workflow engine.

For local development of the retained prototype:

```bash
pnpm --filter @deploid/studio dev
```
