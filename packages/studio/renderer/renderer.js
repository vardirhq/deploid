const cwdInput = document.getElementById('cwd');
const pickButton = document.getElementById('pick');
const runButton = document.getElementById('run');
const stopButton = document.getElementById('stop');
const cmdInput = document.getElementById('cmd');
const recentWrap = document.getElementById('recentWrap');
const statusPill = document.getElementById('statusPill');
const status = document.getElementById('status');
const runStateTitle = document.getElementById('runStateTitle');
const projectTitle = document.getElementById('projectTitle');
const projectSubtitle = document.getElementById('projectSubtitle');
const metaStatus = document.getElementById('metaStatus');
const metaArtifacts = document.getElementById('metaArtifacts');
const metaDevices = document.getElementById('metaDevices');
const workflowGrid = document.getElementById('workflowGrid');
const blockersList = document.getElementById('blockersList');
const quickActionsWrap = document.getElementById('quickActions');
const artifactsList = document.getElementById('artifactsList');
const devicesList = document.getElementById('devicesList');
const logFilter = document.getElementById('logFilter');
const copyLogsButton = document.getElementById('copyLogs');
const clearLogsButton = document.getElementById('clearLogs');
const kpiTask = document.getElementById('kpiTask');
const kpiRuns = document.getElementById('kpiRuns');
const kpiResult = document.getElementById('kpiResult');
const logs = document.getElementById('logs');

const RECENT_CWDS_KEY = 'deploidStudio.recentCwds';
const MAX_RECENT_CWDS = 5;

const WORKFLOW_ACTIONS = {
  init: 'init',
  build: 'package',
  release: 'doctor --fix',
  deploy: 'deploy',
  desktop: 'electron'
};

const ACTION_LIBRARY = [
  {
    key: 'doctor --summary',
    title: 'Refresh readiness',
    description: 'Re-run doctor and rebuild the dashboard state.',
    intent: 'primary'
  },
  {
    key: 'doctor --fix',
    title: 'Apply safe fixes',
    description: 'Create missing scaffolding and templates where doctor can do so safely.',
    intent: 'secondary'
  },
  {
    key: 'assets',
    title: 'Generate assets',
    description: 'Create icons and generated image assets from your configured source.',
    intent: 'secondary'
  },
  {
    key: 'package',
    title: 'Package native shell',
    description: 'Sync the web app into Capacitor and generate the Android project.',
    intent: 'secondary'
  },
  {
    key: 'build',
    title: 'Build Android output',
    description: 'Compile the APK/AAB artifacts available for deploy or release.',
    intent: 'secondary'
  },
  {
    key: 'deploy',
    title: 'Deploy to device',
    description: 'Install the latest debug build on connected Android devices.',
    intent: 'secondary'
  },
  {
    key: 'logs',
    title: 'Tail device logs',
    description: 'Stream device logs when you are in a troubleshooting loop.',
    intent: 'secondary'
  }
];

const logEntries = [];
let runCount = 0;
let selectedCommand = 'doctor --summary';
let currentRunHadError = false;
let currentOverview = null;

function emptyState(message) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = message;
  return div;
}

function appendLog(kind, text) {
  logEntries.push({ kind, text });
  renderLogs();
}

function renderLogs() {
  const filter = logFilter.value;
  logs.textContent = logEntries
    .filter((entry) => filter === 'all' || entry.kind === filter)
    .map((entry) => entry.text)
    .join('');
  logs.scrollTop = logs.scrollHeight;
}

function getRecentCwds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_CWDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string' && entry.length > 0) : [];
  } catch {
    return [];
  }
}

function saveRecentCwds(cwds) {
  localStorage.setItem(RECENT_CWDS_KEY, JSON.stringify(cwds.slice(0, MAX_RECENT_CWDS)));
}

function addRecentCwd(cwd) {
  const next = [cwd, ...getRecentCwds().filter((entry) => entry !== cwd)];
  saveRecentCwds(next);
  renderRecentCwds();
}

function renderRecentCwds() {
  const recents = getRecentCwds();
  recentWrap.innerHTML = '';
  for (const cwd of recents) {
    const button = document.createElement('button');
    button.className = 'ghost recent-pill';
    button.type = 'button';
    button.textContent = cwd.length > 36 ? `...${cwd.slice(-36)}` : cwd;
    button.title = cwd;
    button.addEventListener('click', () => {
      cwdInput.value = cwd;
      refreshOverview();
    });
    recentWrap.appendChild(button);
  }
}

function setSelectedCommand(command) {
  selectedCommand = command;
  cmdInput.value = command;
  kpiTask.textContent = command;
  for (const button of quickActionsWrap.querySelectorAll('[data-command]')) {
    button.style.outline = button.dataset.command === command ? '2px solid rgba(255,255,255,0.38)' : 'none';
  }
}

function setRunningState(running) {
  if (running) {
    statusPill.textContent = 'Running';
    statusPill.className = 'status-chip running';
    runStateTitle.textContent = 'Task in progress';
    status.textContent = `Running "${selectedCommand}" in the selected project.`;
  } else {
    statusPill.textContent = 'Ready';
    statusPill.className = 'status-chip';
    runStateTitle.textContent = currentOverview?.doctor?.ok ? 'Project looks healthy' : 'Action still needed';
    status.textContent = currentOverview
      ? 'Dashboard refreshed from project state.'
      : 'Choose a project and Studio will pull readiness, blockers, and quick actions automatically.';
  }
  runButton.disabled = running;
}

function setErrorState(message) {
  statusPill.textContent = 'Needs attention';
  statusPill.className = 'status-chip error';
  runStateTitle.textContent = 'Last command needs attention';
  status.textContent = message;
}

function renderWorkflowGrid(workflows = []) {
  workflowGrid.innerHTML = '';
  if (!workflows.length) {
    workflowGrid.appendChild(emptyState('Select a project to populate the workflow board.'));
    return;
  }

  for (const workflow of workflows) {
    const card = document.createElement('div');
    card.className = 'workflow-card';
    const command = WORKFLOW_ACTIONS[workflow.id] || 'doctor --summary';
    card.innerHTML = `
      <div class="workflow-top">
        <div class="workflow-name">${workflow.title}</div>
        <div class="workflow-score">${workflow.score}%</div>
      </div>
      <div class="workflow-state">${workflow.status.toUpperCase()}</div>
      <div class="workflow-note">${workflow.nextAction || 'No blockers detected for this workflow.'}</div>
      <button class="primary workflow-action" data-command="${command}">Run ${command}</button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      setSelectedCommand(command);
    });
    workflowGrid.appendChild(card);
  }
}

function renderBlockers(checks = []) {
  blockersList.innerHTML = '';
  const issues = checks.filter((check) => check.status !== 'pass').slice(0, 8);
  if (!issues.length) {
    blockersList.appendChild(emptyState('Doctor is not reporting active blockers or warnings.'));
    return;
  }

  for (const check of issues) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-top">
        <div class="list-title">${check.title}</div>
        <div class="badge ${check.status}">${check.status}</div>
      </div>
      <div>${check.message}</div>
      ${check.details ? `<div class="artifact-path">${check.details}</div>` : ''}
    `;
    blockersList.appendChild(item);
  }
}

function computeRecommendedActions(overview) {
  const checks = overview?.doctor?.checks || [];
  const actions = [];

  if (checks.some((check) => check.id === 'deploid-config' && check.status !== 'pass')) actions.push('init');
  if (checks.some((check) => check.id === 'assets-source' && check.status !== 'pass')) actions.push('doctor --fix');
  if (checks.some((check) => check.id === 'capacitor-config' && check.status !== 'pass')) actions.push('package');
  if (checks.some((check) => check.id === 'android-project' && check.status !== 'pass')) actions.push('package');
  if (checks.some((check) => check.id === 'android-signing' && check.status !== 'pass')) actions.push('doctor --fix');
  if (overview?.devices?.count > 0) actions.push('deploy');

  actions.push('doctor --summary', 'assets', 'build', 'logs');
  return [...new Set(actions)].slice(0, 6);
}

function renderQuickActions(overview) {
  quickActionsWrap.innerHTML = '';
  const recommended = computeRecommendedActions(overview);
  const items = ACTION_LIBRARY.filter((action) => recommended.includes(action.key));

  for (const action of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-action';
    button.dataset.command = action.key;
    button.innerHTML = `<div>${action.title}</div><small>${action.description}</small>`;
    button.addEventListener('click', () => setSelectedCommand(action.key));
    quickActionsWrap.appendChild(button);
  }
  if (!items.length) {
    quickActionsWrap.appendChild(emptyState('No quick actions available until a project overview is loaded.'));
  } else if (!selectedCommand || !recommended.includes(selectedCommand)) {
    setSelectedCommand(items[0].key);
  }
}

function renderArtifacts(artifacts = []) {
  artifactsList.innerHTML = '';
  if (!artifacts.length) {
    artifactsList.appendChild(emptyState('No APK, AAB, or desktop output is available yet.'));
    return;
  }

  for (const artifact of artifacts) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-top">
        <div class="list-title">${artifact.label}</div>
        <div class="badge pass">${artifact.size}</div>
      </div>
      <div class="artifact-path">${artifact.path}</div>
    `;
    artifactsList.appendChild(item);
  }
}

function renderDevices(overview) {
  devicesList.innerHTML = '';
  const entries = overview?.devices?.entries || [];
  const presence = overview?.presence || {};

  const presenceItem = document.createElement('div');
  presenceItem.className = 'list-item';
  presenceItem.innerHTML = `
    <div class="list-top">
      <div class="list-title">Project surface</div>
      <div class="badge ${presence.config ? 'pass' : 'warn'}">${presence.config ? 'ready' : 'missing config'}</div>
    </div>
    <div class="device-line">Config: ${presence.config ? 'yes' : 'no'} · Capacitor: ${presence.capacitor ? 'yes' : 'no'} · Android: ${presence.android ? 'yes' : 'no'} · Electron: ${presence.electron ? 'yes' : 'no'}</div>
  `;
  devicesList.appendChild(presenceItem);

  if (!overview?.devices?.available) {
    devicesList.appendChild(emptyState('ADB is not available in this environment.'));
    return;
  }

  if (!entries.length) {
    devicesList.appendChild(emptyState('ADB is available, but no Android devices are connected.'));
    return;
  }

  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-top">
        <div class="list-title">${entry.id}</div>
        <div class="badge ${entry.status === 'device' ? 'pass' : 'warn'}">${entry.status}</div>
      </div>
      <div class="device-line">ADB target state for deploy/log workflows.</div>
    `;
    devicesList.appendChild(item);
  }
}

function renderOverview(overview) {
  currentOverview = overview;

  if (!overview) {
    projectTitle.textContent = 'Deploid Studio';
    projectSubtitle.textContent = 'Pick a project folder to turn this into a workflow dashboard.';
    metaStatus.textContent = 'No project';
    metaArtifacts.textContent = '0';
    metaDevices.textContent = '0';
    renderWorkflowGrid();
    renderBlockers();
    renderQuickActions(null);
    renderArtifacts();
    renderDevices(null);
    return;
  }

  projectTitle.textContent = overview.projectName || 'Deploid project';
  projectSubtitle.textContent = overview.doctor?.ok
    ? 'This project is in a healthy state. Use the workflow board to keep moving without dropping into the terminal.'
    : `Studio found ${overview.doctor?.totals?.fail || 0} blockers and ${overview.doctor?.totals?.warn || 0} warnings that should shape your next move.`;
  metaStatus.textContent = overview.doctor?.ok ? 'Healthy' : 'Action needed';
  metaArtifacts.textContent = String((overview.artifacts || []).length);
  metaDevices.textContent = String(overview.devices?.count || 0);

  renderWorkflowGrid(overview.doctor?.workflows || []);
  renderBlockers(overview.doctor?.checks || []);
  renderQuickActions(overview);
  renderArtifacts(overview.artifacts || []);
  renderDevices(overview);
}

async function refreshOverview() {
  const cwd = cwdInput.value.trim();
  if (!cwd) {
    renderOverview(null);
    return;
  }

  try {
    const overview = await window.deploidStudio.getProjectOverview(cwd);
    renderOverview(overview);
  } catch {
    renderOverview(null);
  }
}

runButton.addEventListener('click', async () => {
  const cwd = cwdInput.value.trim();
  if (!cwd) {
    setErrorState('Choose a project folder before running an action.');
    appendLog('system', 'Choose a project folder before running an action.\n');
    return;
  }

  const command = cmdInput.value || selectedCommand;
  try {
    addRecentCwd(cwd);
    runCount += 1;
    currentRunHadError = false;
    kpiRuns.textContent = String(runCount);
    kpiResult.textContent = 'Running';
    setRunningState(true);
    await window.deploidStudio.runCommand(cwd, command);
  } catch (error) {
    kpiResult.textContent = 'Failed';
    setErrorState(error.message);
    appendLog('stderr', `Error: ${error.message}\n`);
  }
});

stopButton.addEventListener('click', async () => {
  await window.deploidStudio.stopCommand();
});

window.deploidStudio.onLog((entry) => {
  if (entry.kind === 'stderr') currentRunHadError = true;
  appendLog(entry.kind, entry.message);
});

window.deploidStudio.onState((state) => {
  setRunningState(state.running);
  if (!state.running) {
    kpiResult.textContent = currentRunHadError ? 'Warning' : 'Success';
    refreshOverview();
  }
});

logFilter.addEventListener('change', renderLogs);

clearLogsButton.addEventListener('click', () => {
  logEntries.length = 0;
  renderLogs();
});

copyLogsButton.addEventListener('click', async () => {
  const text = logs.textContent || '';
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Activity copied to clipboard.';
  } catch {
    status.textContent = 'Unable to copy logs from this environment.';
  }
});

window.deploidStudio.getDefaultCwd().then((cwd) => {
  if (!cwdInput.value) cwdInput.value = cwd;
  addRecentCwd(cwd);
  renderRecentCwds();
  refreshOverview();
});

pickButton.addEventListener('click', async () => {
  const folder = await window.deploidStudio.chooseProject(cwdInput.value.trim());
  if (!folder) return;
  cwdInput.value = folder;
  addRecentCwd(folder);
  refreshOverview();
});

renderRecentCwds();
renderOverview(null);
