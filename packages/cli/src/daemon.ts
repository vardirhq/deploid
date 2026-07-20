import http from 'node:http';
import { inspectArtifacts, listAndroidDevices, loadConfigOptional, runDoctorCommand, runPluginCommand, type ArtifactRecord } from '#core';

interface DaemonOptions {
  host?: string;
  port?: number;
  token?: string;
  debug?: boolean;
}

interface JsonRequest {
  cwd?: string;
  doctorOptions?: Record<string, unknown>;
  pluginName?: string;
  contextExtras?: Record<string, unknown>;
  debug?: boolean;
}

export async function startDaemon(options: DaemonOptions = {}): Promise<void> {
  const host = options.host || '127.0.0.1';
  const port = options.port || 4949;
  const token = options.token;

  const server = http.createServer(async (req, res) => {
    try {
      if (token && req.headers.authorization !== `Bearer ${token}`) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
      }

      const url = new URL(req.url || '/', `http://${host}:${port}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, service: 'deploid-daemon' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/config') {
        const cwd = url.searchParams.get('cwd') || process.cwd();
        const config = await loadConfigOptional(cwd);
        sendJson(res, 200, { ok: true, cwd, config });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/artifacts') {
        const cwd = url.searchParams.get('cwd') || process.cwd();
        const config = await loadConfigOptional(cwd);
        const kind = url.searchParams.get('kind') || 'all';
        const artifacts = inspectArtifacts(cwd, config).filter((artifact: ArtifactRecord) => kind === 'all' || artifact.kind === kind);
        sendJson(res, 200, { ok: true, cwd, artifacts });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/devices') {
        const devices = listAndroidDevices();
        sendJson(res, 200, { ok: true, devices });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/doctor') {
        const body = await readJsonBody(req);
        const cwd = body.cwd || process.cwd();
        const captured = await captureConsole(async () => {
          await runDoctorCommand({
            cwd,
            debug: options.debug || body.debug,
            doctorOptions: {
              ...(body.doctorOptions || {}),
              json: true
            }
          });
        });
        const report = captured.stdout ? JSON.parse(captured.stdout) : null;
        sendJson(res, 200, { ok: true, cwd, report, logs: captured.stderr });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/plugin') {
        const body = await readJsonBody(req);
        if (!body.pluginName) {
          sendJson(res, 400, { ok: false, error: 'pluginName is required' });
          return;
        }

        const cwd = body.cwd || process.cwd();
        const pluginName = body.pluginName;
        const captured = await captureConsole(async () => {
          await runPluginCommand(pluginName, {
            cwd,
            debug: options.debug || body.debug,
            contextExtras: body.contextExtras || {}
          });
        });
        sendJson(res, 200, {
          ok: true,
          cwd,
          pluginName,
          stdout: captured.stdout,
          stderr: captured.stderr
        });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  const resolvedPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Deploid daemon listening on http://${host}:${resolvedPort}`);
}

async function readJsonBody(req: http.IncomingMessage): Promise<JsonRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonRequest;
}

async function captureConsole(run: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];

  console.log = (...args: unknown[]) => { stdout.push(args.map(formatValue).join(' ')); };
  console.warn = (...args: unknown[]) => { stderr.push(args.map(formatValue).join(' ')); };
  console.error = (...args: unknown[]) => { stderr.push(args.map(formatValue).join(' ')); };

  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    await run();
    return {
      stdout: stdout.join('\n').trim(),
      stderr: stderr.join('\n').trim()
    };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    process.exitCode = previousExitCode;
  }
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}
