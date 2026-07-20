const els = Object.fromEntries([
  'projectList', 'addProject', 'changeProject', 'refresh', 'projectTitle', 'projectPath',
  'readinessIcon', 'readinessText', 'healthPill', 'pipeline', 'targetList', 'activityView',
  'artifactsView', 'devicesView', 'copyLogs', 'clearLogs', 'actionTitle', 'actionDescription',
  'commandText', 'copyCommand', 'actionSummary', 'blocker', 'run', 'stop', 'toast'
].map((id) => [id, document.getElementById(id)]));

const RECENT_PROJECTS_KEY = 'deploid.desktop.projects.v1';
const MAX_PROJECTS = 7;
const logEntries = [];
let cwd = '';
let overview = null;
let command = 'doctor --summary';
let running = false;

const STAGES = [
  { id: 'build', title: 'Build', icon: '✓' },
  { id: 'package', title: 'Package', icon: '◇' },
  { id: 'sign', title: 'Sign', icon: '✎' },
  { id: 'publish', title: 'Publish', icon: '↑' }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function stripAnsi(value) {
  return String(value).replace(/\u001b\[[0-9;]*m/g, '');
}

function shortPath(value, length = 42) {
  if (!value || value.length <= length) return value || '';
  return `…${value.slice(-(length - 1))}`;
}

function readProjects() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || '[]');
    return Array.isArray(value) ? value.filter((entry) => entry?.cwd) : [];
  } catch {
    return [];
  }
}

function rememberProject(projectCwd, name) {
  const projects = readProjects().filter((entry) => entry.cwd !== projectCwd);
  projects.unshift({ cwd: projectCwd, name: name || projectCwd.split(/[\\/]/).pop() || 'Project' });
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
  renderProjects();
}

function renderProjects() {
  const projects = readProjects();
  els.projectList.innerHTML = projects.map((project) => `
    <button class="project-button ${project.cwd === cwd ? 'active' : ''}" data-cwd="${escapeHtml(project.cwd)}" type="button">
      <span class="project-icon">D</span>
      <span class="project-copy"><span class="project-name">${escapeHtml(project.name)}</span><span class="project-path">${escapeHtml(shortPath(project.cwd, 28))}</span></span>
      <span class="project-dot"></span>
    </button>
  `).join('');
  els.projectList.querySelectorAll('[data-cwd]').forEach((button) => {
    button.addEventListener('click', () => selectProject(button.dataset.cwd));
  });
}

function doctorChecks() {
  return overview?.doctor?.checks || [];
}

function checkStatus(pattern) {
  const matches = doctorChecks().filter((check) => pattern.test(check.id || '') || pattern.test(check.title || ''));
  if (!matches.length) return null;
  if (matches.some((check) => check.status === 'fail')) return 'fail';
  if (matches.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

function getStageStates() {
  if (!overview) return STAGES.map((stage) => ({ ...stage, state: 'pending', label: 'Pending' }));
  const hasArtifact = overview.artifacts?.length > 0;
  const hasPackage = overview.presence?.android || overview.presence?.electron;
  const signing = checkStatus(/sign/i);
  const publish = checkStatus(/publish|github|play/i);
  return [
    { ...STAGES[0], state: hasArtifact ? 'complete' : 'ready', label: hasArtifact ? 'Complete' : 'Ready' },
    { ...STAGES[1], state: hasPackage ? 'complete' : 'ready', label: hasPackage ? 'Complete' : 'Ready' },
    { ...STAGES[2], state: signing === 'fail' ? 'blocked' : signing === 'pass' ? 'complete' : 'ready', label: signing === 'fail' ? 'Blocked' : signing === 'pass' ? 'Complete' : 'Ready' },
    { ...STAGES[3], state: publish === 'fail' ? 'blocked' : publish === 'pass' ? 'ready' : 'pending', label: publish === 'fail' ? 'Blocked' : publish === 'pass' ? 'Ready' : 'Pending' }
  ];
}

function renderPipeline() {
  els.pipeline.innerHTML = getStageStates().map((stage) => `
    <div class="stage ${stage.state}">
      <div class="stage-badge">${stage.icon}</div>
      <div><div class="stage-title">${stage.title}</div><div class="stage-state">${stage.label}</div></div>
    </div>
  `).join('');
}

function artifactFor(type) {
  return overview?.artifacts?.find((artifact) => artifact.type === type) || null;
}

function targetCard(type, title, icon) {
  const artifact = artifactFor(type);
  const isAndroid = type === 'android';
  const present = isAndroid ? overview?.presence?.android : overview?.presence?.electron;
  const signingBlocked = isAndroid && checkStatus(/sign/i) === 'fail';
  const status = signingBlocked ? 'Needs signing' : artifact ? 'Ready' : present ? 'Configured' : 'Not configured';
  const statusClass = signingBlocked || !present ? 'warn' : '';
  const artifactLabel = artifact?.label || (present ? 'No build artifact yet' : 'Run packaging setup');
  const subtitle = isAndroid ? 'APK / AAB' : 'AppImage / DMG / EXE';
  return `
    <div class="target-card">
      <div class="target-title"><div class="target-logo">${icon}</div><div><div class="target-name">${title}</div><div class="target-subtitle">${subtitle}</div></div></div>
      <div><div class="cell-label">Artifact</div><div class="cell-value" title="${escapeHtml(artifact?.path || '')}">${escapeHtml(artifactLabel)}</div></div>
      <div><div class="cell-label">Status</div><div class="target-status ${statusClass}">${escapeHtml(status)}</div></div>
      <button class="ghost-button artifact-detail" type="button" ${artifact ? `data-path="${escapeHtml(artifact.path)}"` : 'disabled'}>Reveal</button>
    </div>
  `;
}

function renderTargets() {
  if (!overview) {
    els.targetList.innerHTML = '<div class="empty-state">Choose a project to inspect Android and desktop targets.</div>';
    return;
  }
  els.targetList.innerHTML = targetCard('android', 'Android', 'A') + targetCard('desktop', 'Desktop', '▦');
  els.targetList.querySelectorAll('[data-path]').forEach((button) => {
    button.addEventListener('click', () => window.deploidStudio.revealArtifact(cwd, button.dataset.path));
  });
}

function renderReadiness() {
  const checks = doctorChecks();
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  els.readinessText.innerHTML = `<strong>${passed} of ${checks.length}</strong> checks passed`;
  els.readinessIcon.textContent = failed ? '!' : '✓';
  els.healthPill.textContent = !overview ? 'No project' : failed ? `${failed} blocker${failed === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'Ready';
  els.healthPill.className = `status-pill ${failed || warnings || !overview ? 'warn' : ''}`;
}

function chooseAction() {
  if (!overview) return {
    title: 'Inspect project', description: 'Run Deploid Doctor to find blockers and prepare the safest next command.', command: 'doctor --summary', button: 'Run doctor'
  };
  const checks = doctorChecks();
  if (!overview.presence?.config) return {
    title: 'Initialize project', description: 'Create the Deploid configuration and establish the project workflow.', command: 'init', button: 'Initialize project'
  };
  if (checks.some((check) => check.status === 'fail' && /sign/i.test(`${check.id} ${check.title}`))) return {
    title: 'Configure signing', description: 'Prepare signing and release metadata before producing a publishable Android artifact.', command: 'release init', button: 'Set up release'
  };
  if (!overview.presence?.android) return {
    title: 'Package Android', description: 'Generate and synchronize the native Android project from the current web build.', command: 'package', button: 'Package Android'
  };
  if (!overview.artifacts?.length) return {
    title: 'Build artifacts', description: 'Compile the configured targets and collect their output artifacts.', command: 'build', button: 'Build project'
  };
  return {
    title: 'Run release', description: 'Build, package, sign, and publish the configured release artifacts.', command: 'ship --patch', button: 'Run release'
  };
}

function renderActionPanel() {
  const action = chooseAction();
  command = action.command;
  els.actionTitle.textContent = action.title;
  els.actionDescription.textContent = action.description;
  els.commandText.textContent = `deploid ${command}`;
  els.run.textContent = `▶ ${action.button}`;
  els.run.disabled = running;
  const stages = getStageStates();
  els.actionSummary.innerHTML = stages.map((stage) => `
    <div class="summary-row ${stage.state === 'complete' || stage.state === 'ready' ? 'done' : stage.state}">
      <span class="summary-icon">${stage.state === 'complete' ? '✓' : stage.state === 'blocked' ? '!' : '·'}</span>
      <span>${stage.title}</span><span class="summary-state">${stage.label}</span>
    </div>
  `).join('');
  const issue = doctorChecks().find((check) => check.status === 'fail') || doctorChecks().find((check) => check.status === 'warn');
  els.blocker.style.display = issue || !overview ? 'block' : 'none';
  if (issue) els.blocker.innerHTML = `<strong>${escapeHtml(issue.title || 'Needs attention')}</strong>${escapeHtml(issue.message || issue.details || 'Review this check before releasing.')}`;
}

function renderArtifacts() {
  const artifacts = overview?.artifacts || [];
  els.artifactsView.innerHTML = artifacts.length ? artifacts.map((artifact) => `
    <div class="data-row"><strong>${escapeHtml(artifact.label)}</strong><span>${escapeHtml(artifact.path)}</span><span>${escapeHtml(artifact.size)}</span></div>
  `).join('') : '<div class="empty-state">No build artifacts detected yet.</div>';
}

function renderDevices() {
  const devices = overview?.devices?.entries || [];
  els.devicesView.innerHTML = devices.length ? devices.map((device) => `
    <div class="data-row"><strong>${escapeHtml(device.id)}</strong><span>Android Debug Bridge</span><span>${escapeHtml(device.status)}</span></div>
  `).join('') : `<div class="empty-state">${overview?.devices?.available ? 'ADB is ready, but no Android devices are connected.' : 'ADB is not available on this computer.'}</div>`;
}

function renderOverview() {
  els.projectTitle.textContent = overview?.projectName || 'Choose a project';
  els.projectPath.textContent = overview ? `${overview.cwd}${overview.version ? `  ·  v${overview.version}` : ''}` : 'Add a project folder to begin';
  renderProjects();
  renderReadiness();
  renderPipeline();
  renderTargets();
  renderArtifacts();
  renderDevices();
  renderActionPanel();
}

function renderLogs() {
  els.activityView.innerHTML = logEntries.length ? logEntries.map((entry) => `
    <div class="log-line ${entry.kind}"><span class="log-time">${entry.time}</span><span class="log-kind">${entry.kind.toUpperCase()}</span><span class="log-message">${escapeHtml(entry.message)}</span></div>
  `).join('') : '<div class="empty-state">Command activity will appear here.</div>';
  els.activityView.scrollTop = els.activityView.scrollHeight;
}

function appendLog(kind, message) {
  const clean = stripAnsi(message).trimEnd();
  for (const line of clean.split('\n')) {
    if (!line && clean) continue;
    logEntries.push({ kind, message: line || message, time: new Date().toLocaleTimeString([], { hour12: false }) });
  }
  renderLogs();
}

async function refreshOverview() {
  if (!cwd) return renderOverview();
  els.refresh.textContent = '…';
  try {
    overview = await window.deploidStudio.getProjectOverview(cwd);
    rememberProject(cwd, overview.projectName);
  } catch (error) {
    appendLog('stderr', error.message || 'Could not inspect this project.');
    overview = null;
  } finally {
    els.refresh.textContent = '↻';
    renderOverview();
  }
}

async function selectProject(projectCwd) {
  cwd = projectCwd;
  overview = null;
  renderOverview();
  await refreshOverview();
}

async function chooseProject() {
  const folder = await window.deploidStudio.chooseProject(cwd);
  if (folder) await selectProject(folder);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast('Clipboard unavailable');
  }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1600);
}

els.addProject.addEventListener('click', chooseProject);
els.changeProject.addEventListener('click', chooseProject);
els.refresh.addEventListener('click', refreshOverview);
els.copyCommand.addEventListener('click', () => copyText(`deploid ${command}`, 'Command copied'));
els.copyLogs.addEventListener('click', () => copyText(logEntries.map((entry) => entry.message).join('\n'), 'Activity copied'));
els.clearLogs.addEventListener('click', () => { logEntries.length = 0; renderLogs(); });
els.stop.addEventListener('click', () => window.deploidStudio.stopCommand());

els.run.addEventListener('click', async () => {
  if (!cwd) return chooseProject();
  try {
    running = true;
    els.run.disabled = true;
    els.stop.disabled = false;
    await window.deploidStudio.runCommand(cwd, command);
  } catch (error) {
    appendLog('stderr', error.message || 'Command failed.');
  }
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.panel-view').forEach((view) => view.classList.toggle('active', view.id === `${tab.dataset.tab}View`));
  });
});

window.deploidStudio.onLog(({ kind, message }) => appendLog(kind, message));
window.deploidStudio.onState((state) => {
  running = state.running;
  els.run.disabled = state.running;
  els.stop.disabled = !state.running;
  if (!state.running) refreshOverview();
});

renderProjects();
renderLogs();
renderOverview();
window.deploidStudio.getDefaultCwd().then((defaultCwd) => {
  const remembered = readProjects()[0]?.cwd;
  selectProject(remembered || defaultCwd);
});
