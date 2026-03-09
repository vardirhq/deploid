const cwd = process.argv[2] || process.cwd();
const baseUrl = process.argv[3] || 'http://127.0.0.1:4949';

const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
const artifacts = await fetch(`${baseUrl}/artifacts?cwd=${encodeURIComponent(cwd)}`).then((response) => response.json());
const doctor = await fetch(`${baseUrl}/doctor`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    cwd,
    doctorOptions: {
      summary: true,
      projectOnly: true
    }
  })
}).then((response) => response.json());

console.log(JSON.stringify({ health, artifacts, doctor }, null, 2));
