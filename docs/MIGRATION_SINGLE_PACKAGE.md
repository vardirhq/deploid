# Migrating to the single-package distribution

Starting with `@deploid/cli` 2.0.21, core and built-in workflow modules ship with the
CLI. New projects install only:

```bash
npm install --save-dev @deploid/cli
```

Remove direct dependencies on `@deploid/core` and built-in
`@deploid/plugin-*` packages. Keep `@deploid/plugin-storage` only when the
application uses its runtime storage API.

Update TypeScript imports:

```diff
- import type { DeploidConfig } from '@deploid/core';
+ import type { DeploidConfig } from '@deploid/cli';
```

Existing plugin commands and configuration keys remain unchanged. Custom plugins
should move their peer dependency and type imports from `@deploid/core` to
`@deploid/cli`.
