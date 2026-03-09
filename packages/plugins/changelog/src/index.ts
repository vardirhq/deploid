import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

interface ChangelogOptions {
  version?: string;
  notesFile?: string;
  changelogFile?: string;
  fromGit?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

interface PipelineContext {
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  config: {
    appName: string;
    android: {
      version?: { code?: number; name?: string };
    };
  };
  cwd: string;
  changelogOptions?: ChangelogOptions;
}

interface ChangelogPlan {
  version: string;
  date: string;
  notesPath: string;
  changelogPath: string;
  commits: string[];
  entry: string;
}

const plugin = {
  name: 'changelog',
  plan: () => [
    'Resolve release version and source notes',
    'Optionally collect commit subjects since the latest tag',
    'Create or prepend a CHANGELOG.md entry for the release'
  ],
  run: runChangelog
};

async function runChangelog(ctx: PipelineContext): Promise<void> {
  const plan = buildPlan(ctx);

  if (ctx.changelogOptions?.dryRun) {
    if (ctx.changelogOptions?.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      ctx.logger.info(`changelog dry-run: ${plan.version}`);
      ctx.logger.info(`notes: ${path.relative(ctx.cwd, plan.notesPath)}`);
      ctx.logger.info(`changelog: ${path.relative(ctx.cwd, plan.changelogPath)}`);
      ctx.logger.info(`commit entries: ${plan.commits.length}`);
    }
    return;
  }

  writeChangelog(plan.changelogPath, plan.version, plan.entry);
  ctx.logger.info(`Updated ${path.relative(ctx.cwd, plan.changelogPath)} for ${plan.version}.`);
}

function buildPlan(ctx: PipelineContext): ChangelogPlan {
  const options = ctx.changelogOptions || {};
  const version = options.version || ctx.config.android.version?.name || readPackageVersion(path.join(ctx.cwd, 'package.json')) || '0.0.0';
  const date = new Date().toISOString().slice(0, 10);
  const notesPath = path.join(ctx.cwd, options.notesFile || 'RELEASE_NOTES.md');
  const changelogPath = path.join(ctx.cwd, options.changelogFile || 'CHANGELOG.md');
  const notesBody = resolveNotesBody(notesPath, ctx.config.appName, version, ctx.config.android.version?.code || 1);
  const commits = options.fromGit ? collectGitCommits(ctx.cwd) : [];
  const entry = renderEntry(version, date, notesBody, commits);

  return {
    version,
    date,
    notesPath,
    changelogPath,
    commits,
    entry
  };
}

function resolveNotesBody(notesPath: string, appName: string, version: string, versionCode: number): string {
  if (!fs.existsSync(notesPath)) {
    const content = `# ${appName} ${version}\n\n- Android versionCode: ${versionCode}\n- Release date: ${new Date().toISOString().slice(0, 10)}\n\n## Highlights\n\n- \n\n## Fixes\n\n- \n`;
    fs.writeFileSync(notesPath, content);
  }

  const notes = fs.readFileSync(notesPath, 'utf8').trim();
  const lines = notes.split('\n');
  if (lines[0]?.startsWith('# ')) {
    return lines.slice(1).join('\n').trim();
  }
  return notes;
}

function collectGitCommits(cwd: string): string[] {
  const lastTag = spawnSync('git', ['describe', '--tags', '--abbrev=0'], { cwd, encoding: 'utf8' });
  const range = lastTag.status === 0 && lastTag.stdout.trim() ? `${lastTag.stdout.trim()}..HEAD` : 'HEAD';
  const result = spawnSync('git', ['log', '--pretty=format:%s', range], { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);
}

function renderEntry(version: string, date: string, notesBody: string, commits: string[]): string {
  const sections = [`## [${version}] - ${date}`, '', notesBody.trim()];
  if (commits.length > 0) {
    sections.push('', '### Commits', '', ...commits);
  }
  return `${sections.join('\n').trim()}\n`;
}

function writeChangelog(changelogPath: string, version: string, entry: string): void {
  const header = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n';
  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(changelogPath, `${header}\n${entry}`);
    return;
  }

  const existing = fs.readFileSync(changelogPath, 'utf8');
  if (existing.includes(`## [${version}]`)) {
    return;
  }

  const normalized = existing.startsWith('# Changelog') ? existing : `${header}\n${existing}`;
  const insertIndex = normalized.indexOf('\n\n') + 2;
  const nextContent = `${normalized.slice(0, insertIndex)}\n${entry}\n${normalized.slice(insertIndex).trimStart()}`;
  fs.writeFileSync(changelogPath, nextContent);
}

function readPackageVersion(packageJsonPath: string): string | null {
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return pkg.version || null;
  } catch {
    return null;
  }
}

export default plugin;
export { plugin };
