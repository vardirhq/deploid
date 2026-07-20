import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

type PublishTarget = 'github' | 'play' | 'all';
type BuildArtifactType = 'apk' | 'aab' | 'both';
type PlayReleaseStatus = 'draft' | 'inProgress' | 'halted' | 'completed';

interface PublishOptions {
  target?: PublishTarget;
  artifact?: string;
  notes?: string;
  notesFile?: string;
  tag?: string;
  releaseName?: string;
  draft?: boolean;
  latest?: boolean;
  dryRun?: boolean;
}

interface PipelineContext {
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  debug?: boolean;
  config: {
    appName: string;
    appId: string;
    android: {
      version?: { code?: number; name?: string };
      build?: { buildType?: BuildArtifactType };
    };
    publish?: {
      play?: {
        track?: 'internal' | 'alpha' | 'beta' | 'production';
        status?: PlayReleaseStatus;
        serviceAccountJson?: string;
      };
      github?: { repo?: string; draft?: boolean };
    };
  };
  cwd: string;
  publishOptions?: PublishOptions;
}

interface ResolvedArtifact {
  path: string;
  type: 'apk' | 'aab';
  size: number;
}

interface GithubRelease {
  id: number;
  html_url: string;
  upload_url: string;
  tag_name: string;
  assets?: Array<{ id: number; name: string }>;
}

const plugin = {
  name: 'publish',
  plan: () => [
    'Resolve release artifact and publish targets',
    'Create or update GitHub Releases when configured',
    'Upload APK/AAB to Play Console when configured'
  ],
  validate: async ({ cwd, config }: { cwd: string; config: PipelineContext['config'] }) => {
    const artifact = resolveArtifact({
      cwd,
      config,
      explicitArtifact: undefined,
      allowMissing: true
    });

    if (!artifact) {
      throw new Error('No release artifact found. Run "deploid build" first or pass --artifact <path>.');
    }

    if (!config.publish?.github?.repo && !config.publish?.play?.serviceAccountJson) {
      throw new Error('No publish target configured. Run "deploid release init" first.');
    }
  },
  run: runPublish
};

const require = createRequire(import.meta.url);

async function runPublish(ctx: PipelineContext): Promise<void> {
  const options = withDefaults(ctx);
  const targets = resolveTargets(ctx.config, options.target);
  const artifact = resolveArtifact({
    cwd: ctx.cwd,
    config: ctx.config,
    explicitArtifact: options.artifact
  });
  if (!artifact) {
    throw new Error('No publishable artifact found. Run "deploid build" first or pass --artifact <path>.');
  }
  const notes = resolveNotes(ctx.cwd, ctx.config, options);
  const versionName = ctx.config.android.version?.name || '0.0.0';
  const tag = options.tag || `v${versionName}`;
  const releaseName = options.releaseName || `${ctx.config.appName} ${versionName}`;

  if (options.dryRun) {
    printDryRun(ctx, { targets, artifact, notes, tag, releaseName, draft: options.draft });
    return;
  }

  for (const target of targets) {
    if (target === 'github') {
      await publishGithub(ctx, artifact, {
        notes,
        tag,
        releaseName,
        draft: options.draft,
        latest: options.latest
      });
      continue;
    }

    await publishPlay(ctx, artifact, { notes });
  }
}

function withDefaults(ctx: PipelineContext): Required<PublishOptions> {
  return {
    target: ctx.publishOptions?.target || 'all',
    artifact: ctx.publishOptions?.artifact || '',
    notes: ctx.publishOptions?.notes || '',
    notesFile: ctx.publishOptions?.notesFile || '',
    tag: ctx.publishOptions?.tag || '',
    releaseName: ctx.publishOptions?.releaseName || '',
    draft: Boolean(ctx.publishOptions?.draft ?? ctx.config.publish?.github?.draft ?? false),
    latest: Boolean(ctx.publishOptions?.latest ?? false),
    dryRun: Boolean(ctx.publishOptions?.dryRun)
  };
}

function resolveTargets(config: PipelineContext['config'], requested: PublishTarget): Array<'github' | 'play'> {
  if (requested === 'github') return ['github'];
  if (requested === 'play') return ['play'];

  const targets: Array<'github' | 'play'> = [];
  if (config.publish?.github?.repo) targets.push('github');
  if (config.publish?.play?.serviceAccountJson) targets.push('play');
  if (targets.length === 0) {
    throw new Error('No publish target configured. Add `publish.github` or `publish.play` in deploid.config.*.');
  }
  return targets;
}

function resolveArtifact(args: {
  cwd: string;
  config: PipelineContext['config'];
  explicitArtifact?: string;
  allowMissing?: boolean;
}): ResolvedArtifact | null {
  if (args.explicitArtifact) {
    const explicitPath = path.resolve(args.cwd, args.explicitArtifact);
    if (!fs.existsSync(explicitPath)) {
      throw new Error(`Artifact not found: ${args.explicitArtifact}`);
    }
    return toArtifact(explicitPath);
  }

  const buildType = args.config.android.build?.buildType || 'aab';
  const candidates = artifactCandidates(args.cwd, buildType);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return toArtifact(candidate);
    }
  }

  if (args.allowMissing) return null;
  throw new Error('No publishable artifact found. Expected a release AAB/APK or debug APK in android/app/build/outputs.');
}

function artifactCandidates(cwd: string, buildType: BuildArtifactType): string[] {
  const androidRoot = path.join(cwd, 'android', 'app', 'build', 'outputs');
  const aab = path.join(androidRoot, 'bundle', 'release', 'app-release.aab');
  const releaseApk = path.join(androidRoot, 'apk', 'release', 'app-release.apk');
  const debugApk = path.join(androidRoot, 'apk', 'debug', 'app-debug.apk');

  if (buildType === 'apk') return [releaseApk, debugApk, aab];
  if (buildType === 'both') return [aab, releaseApk, debugApk];
  return [aab, releaseApk, debugApk];
}

function toArtifact(filePath: string): ResolvedArtifact {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.apk' && ext !== '.aab') {
    throw new Error(`Unsupported artifact type: ${filePath}`);
  }
  return {
    path: filePath,
    type: ext.slice(1) as 'apk' | 'aab',
    size: fs.statSync(filePath).size
  };
}

function resolveNotes(cwd: string, config: PipelineContext['config'], options: Required<PublishOptions>): string {
  if (options.notes) return options.notes;
  if (options.notesFile) {
    const notesPath = path.resolve(cwd, options.notesFile);
    if (!fs.existsSync(notesPath)) {
      throw new Error(`Notes file not found: ${options.notesFile}`);
    }
    return fs.readFileSync(notesPath, 'utf8');
  }

  const version = config.android.version?.name || '0.0.0';
  return `Release ${version}\n\nPublished by Deploid for ${config.appName}.`;
}

function printDryRun(
  ctx: PipelineContext,
  details: {
    targets: Array<'github' | 'play'>;
    artifact: ResolvedArtifact;
    notes: string;
    tag: string;
    releaseName: string;
    draft: boolean;
  }
): void {
  ctx.logger.info(`publish dry-run: ${details.targets.join(', ')}`);
  ctx.logger.info(`artifact: ${path.relative(ctx.cwd, details.artifact.path)} (${details.artifact.type}, ${details.artifact.size} bytes)`);
  ctx.logger.info(`tag: ${details.tag}`);
  ctx.logger.info(`release: ${details.releaseName}`);
  ctx.logger.info(`draft: ${details.draft ? 'yes' : 'no'}`);
  if (details.targets.includes('github')) {
    ctx.logger.info(`github repo: ${ctx.config.publish?.github?.repo || 'missing'}`);
  }
  if (details.targets.includes('play')) {
    ctx.logger.info(`play track: ${ctx.config.publish?.play?.track || 'internal'}`);
    ctx.logger.info(`play status: ${ctx.config.publish?.play?.status || 'completed'}`);
  }
  ctx.logger.info(`notes preview: ${details.notes.split('\n').slice(0, 3).join(' | ')}`);
}

async function publishGithub(
  ctx: PipelineContext,
  artifact: ResolvedArtifact,
  options: { notes: string; tag: string; releaseName: string; draft: boolean; latest: boolean }
): Promise<void> {
  const repo = ctx.config.publish?.github?.repo;
  if (!repo) {
    throw new Error('GitHub publish requested, but `publish.github.repo` is missing.');
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error('GitHub publish requires GITHUB_TOKEN or GH_TOKEN.');
  }

  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid GitHub repo: ${repo}`);
  }

  const existingRelease = await getExistingGithubRelease(owner, name, options.tag, token);
  const release = existingRelease || await createGithubRelease(owner, name, token, options);

  await deleteExistingGithubAsset(owner, name, release, path.basename(artifact.path), token);
  await uploadGithubAsset(release, artifact, token);
  ctx.logger.info(`GitHub release published: ${release.html_url}`);
}

async function getExistingGithubRelease(owner: string, repo: string, tag: string, token: string): Promise<GithubRelease | null> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: githubHeaders(token)
  });
  if (response.status === 404) return null;
  await assertOk(response, 'Failed to look up existing GitHub release');
  return response.json() as Promise<GithubRelease>;
}

async function createGithubRelease(
  owner: string,
  repo: string,
  token: string,
  options: { notes: string; tag: string; releaseName: string; draft: boolean; latest: boolean }
): Promise<GithubRelease> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      tag_name: options.tag,
      name: options.releaseName,
      body: options.notes,
      draft: options.draft,
      make_latest: options.latest ? 'true' : 'false'
    })
  });
  await assertOk(response, 'Failed to create GitHub release');
  return response.json() as Promise<GithubRelease>;
}

async function deleteExistingGithubAsset(owner: string, repo: string, release: GithubRelease, assetName: string, token: string): Promise<void> {
  const matchingAsset = release.assets?.find((asset) => asset.name === assetName);
  if (!matchingAsset) return;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${matchingAsset.id}`, {
    method: 'DELETE',
    headers: githubHeaders(token)
  });
  if (response.status !== 204) {
    await assertOk(response, `Failed to delete existing GitHub asset ${assetName}`);
  }
}

async function uploadGithubAsset(release: GithubRelease, artifact: ResolvedArtifact, token: string): Promise<void> {
  const uploadUrl = release.upload_url.replace(/\{.*$/, '');
  const assetName = path.basename(artifact.path);
  const buffer = fs.readFileSync(artifact.path);
  const response = await fetch(`${uploadUrl}?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'content-type': artifact.type === 'aab' ? 'application/octet-stream' : 'application/vnd.android.package-archive',
      'content-length': String(buffer.byteLength)
    },
    body: buffer
  });
  await assertOk(response, `Failed to upload GitHub asset ${assetName}`);
}

async function publishPlay(
  ctx: PipelineContext,
  artifact: ResolvedArtifact,
  options: { notes: string }
): Promise<void> {
  const playConfig = ctx.config.publish?.play;
  if (!playConfig?.serviceAccountJson) {
    throw new Error('Play publish requested, but `publish.play.serviceAccountJson` is missing.');
  }

  if (!fs.existsSync(path.resolve(ctx.cwd, playConfig.serviceAccountJson))) {
    throw new Error(`Play service account file not found: ${playConfig.serviceAccountJson}`);
  }

  const { google } = require('googleapis') as { google: any };
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(ctx.cwd, playConfig.serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });
  const packageName = ctx.config.appId;
  const track = playConfig.track || 'internal';
  const status = playConfig.status || 'completed';

  const editInsert = await androidpublisher.edits.insert({
    packageName,
    requestBody: {}
  });
  const editId = editInsert.data.id;
  if (!editId) {
    throw new Error('Play publish failed to create an edit session.');
  }

  const uploadMedia = {
    mimeType: artifact.type === 'aab' ? 'application/octet-stream' : 'application/vnd.android.package-archive',
    body: fs.createReadStream(artifact.path)
  };

  let versionCode: string | undefined;
  if (artifact.type === 'aab') {
    const bundleResponse = await androidpublisher.edits.bundles.upload({
      packageName,
      editId,
      media: uploadMedia
    });
    versionCode = bundleResponse.data.versionCode ? String(bundleResponse.data.versionCode) : undefined;
  } else {
    const apkResponse = await androidpublisher.edits.apks.upload({
      packageName,
      editId,
      media: uploadMedia
    });
    versionCode = apkResponse.data.versionCode ? String(apkResponse.data.versionCode) : undefined;
  }

  if (!versionCode) {
    throw new Error('Play publish did not return a versionCode for the uploaded artifact.');
  }

  await androidpublisher.edits.tracks.update({
    packageName,
    editId,
    track,
    requestBody: {
      releases: [{
        status,
        versionCodes: [versionCode],
        releaseNotes: [{
          language: 'en-US',
          text: truncatePlayNotes(options.notes)
        }]
      }]
    }
  });

  await androidpublisher.edits.commit({
    packageName,
    editId
  });

  ctx.logger.info(`Play publish complete: ${track} track, ${status} release, versionCode ${versionCode}`);
}

function truncatePlayNotes(notes: string): string {
  return notes.slice(0, 500);
}

function githubHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'deploid'
  };
}

async function assertOk(response: Response, message: string): Promise<void> {
  if (response.ok) return;
  const body = await response.text();
  throw new Error(`${message}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
}

export default plugin;
export { plugin };