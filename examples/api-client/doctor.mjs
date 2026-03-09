import { runDoctorCommand } from '../../packages/core/dist/index.js';

const cwd = process.argv[2] || process.cwd();

await runDoctorCommand({
  cwd,
  doctorOptions: {
    json: true,
    summary: true
  }
});
