import { inspectArtifacts, loadConfigOptional } from '../../packages/core/dist/index.js';

const cwd = process.argv[2] || process.cwd();
const config = await loadConfigOptional(cwd);
const artifacts = inspectArtifacts(cwd, config);

console.log(JSON.stringify({ cwd, artifacts }, null, 2));
