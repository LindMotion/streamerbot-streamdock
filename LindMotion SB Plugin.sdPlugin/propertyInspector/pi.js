'use strict';

const PI = {
  ws: null,
  uuid: null,
  action: null,
  context: null,
  settings: {},
  global: { host: '127.0.0.1', port: 8080, password: '', autoConnect: true },
  actions: [],
  named: null,
  snapshot: null
};

function $(id) {
  return document.getElementById(id);
}

function send(event, payload) {
  if (!PI.ws || PI.ws.readyState !== 1) return;
  PI.ws.send(JSON.stringify({ event, context: PI.uuid, payload }));
}

function sendToPlugin(payload) {
  if (!PI.ws || PI.ws.readyState !== 1) return;
  PI.ws.send(
    JSON.stringify({
      event: 'sendToPlugin',
      action: PI.action,
      context: PI.uuid,
      payload
    })
  );
}

function setSettings(next) {
  PI.settings = { ...PI.settings, ...next };
  send('setSettings', PI.settings);
  sendToPlugin({ type: 'saveSettings', settings: PI.settings });
  renderPreview();
}

function visibleFor(action) {
  const map = {
    connection: ['section-connection'],
    execute: ['section-connection-mini', 'section-execute'],
    executeArgs: ['section-connection-mini', 'section-execute', 'section-args'],
    executeRandom: ['section-connection-mini', 'section-execute', 'section-random'],
    executeSequence: ['section-connection-mini', 'section-execute', 'section-sequence'],
    chatMessage: ['section-connection-mini', 'section-chat'],
    named: ['section-connection-mini', 'section-named'],
    status: ['section-connection-mini', 'section-status'],
    look: ['section-look']
  };
  return map[action] || map.named;
}

function actionKind(uuid) {
  if (!uuid) return 'named';
  if (uuid.endsWith('.connection')) return 'connection';
  if (uuid.endsWith('.execute')) return 'execute';
  if (uuid.endsWith('.executeArgs')) return 'executeArgs';
  if (uuid.endsWith('.executeRandom')) return 'executeRandom';
  if (uuid.endsWith('.executeSequence')) return 'executeSequence';
  if (uuid.endsWith('.chat.message')) return 'chatMessage';
  if (uuid.includes('.status.')) return 'status';
  return 'named';
}

function showSections(kind) {
  document.querySelectorAll('[data-section]').forEach((el) => el.classList.add('hidden'));
  for (const id of [...visibleFor(kind), 'section-look']) {
    const el = $(id);
    if (el) el.classList.remove('hidden');
  }
}

function statusClass(state) {
  return ['connected', 'disconnected', 'reconnecting', 'connecting', 'authenticating'].includes(state)
    ? state
    : 'disconnected';
}

function renderConnection(snapshot) {
  const state = snapshot?.state || 'disconnected';
  for (const id of ['conn-status', 'conn-status-mini']) {
    const el = $(id);
    if (!el) continue;
    el.className = `status ${statusClass(state)}`;
    const version = snapshot?.version || snapshot?.instance?.version;
    el.textContent = `${state.toUpperCase()}  ${snapshot?.host || ''}:${snapshot?.port || ''}${
      version ? `  v${version}` : ''
    }${snapshot?.lastError ? ` — ${snapshot.lastError}` : ''}`;
  }
  if ($('host')) $('host').value = PI.global.host || '127.0.0.1';
  if ($('port')) $('port').value = PI.global.port || 8080;
  if ($('password')) $('password').value = PI.global.password || '';
}

function renderActions(filter) {
  const q = (filter || $('action-search')?.value || '').toLowerCase();
  const group = $('action-group')?.value || '';
  const list = $('action-list');
  if (!list) return;
  list.innerHTML = '';
  const groups = new Set(['']);
  for (const action of PI.actions) {
    groups.add(action.group || 'None');
    const hay = `${action.name} ${action.group} ${action.id}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    if (group && (action.group || 'None') !== group) continue;
    const item = document.createElement('div');
    item.className = 'item' + (action.id === PI.settings.actionId ? ' active' : '');
    item.textContent = `${action.name}  [${action.group || 'None'}]`;
    item.onclick = () => {
      setSettings({ actionId: action.id, actionName: action.name, actionGroup: action.group || 'None' });
      renderActions(q);
    };
    list.appendChild(item);
  }
  const sel = $('action-group');
  if (sel) {
    const prev = sel.value || '';
    sel.innerHTML = '<option value="">All groups</option>';
    for (const g of [...groups].filter(Boolean).sort()) {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      sel.appendChild(opt);
    }
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }
  const note = $('action-refresh');
  if (note) {
    const last = PI.snapshot?.lastActionRefresh;
    if (last) note.textContent = `${last.count} actions · live update (${last.reason})`;
    else note.textContent = PI.actions.length ? `${PI.actions.length} actions` : 'No actions loaded';
  }
}

function renderNamed() {
  const box = $('named-info');
  if (!box) return;
  if (!PI.named) {
    box.textContent = '';
    return;
  }
  if (PI.named.found) {
    box.className = 'ok';
    box.textContent = `Bound to ${PI.named.found.name} (${PI.named.found.id})`;
  } else {
    box.className = 'warn';
    box.textContent = `Missing Streamer.bot action "${PI.named.expectedName}". Create it exactly, then refresh.`;
  }
  const args = PI.named.args || [];
  $('named-args').innerHTML = '';
  for (const key of args) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${key}</label><input data-arg="${key}" value="${PI.settings[key] || ''}">`;
    $('named-args').appendChild(row);
    row.querySelector('input').addEventListener('change', (e) => setSettings({ [key]: e.target.value }));
  }
}

function selectedActionLabel(list, settings) {
  if (!Array.isArray(list) || !list.length) return 'none';
  return list.map((a) => a.name || a.id).join(', ');
}

function renderLists() {
  if ($('random-list')) $('random-list').textContent = selectedActionLabel(PI.settings.randomActions, PI.settings);
  if ($('sequence-list')) {
    const seq = PI.settings.sequence || [];
    $('sequence-list').textContent = seq.length
      ? seq.map((s) => `${s.name || s.id}${s.delayMs ? ` (+${s.delayMs}ms)` : ''}`).join(' → ')
      : 'none';
  }
}

function renderPreview() {
  const preview = $('preview');
  if (!preview) return;
  preview.style.background = PI.settings.background || '#333';
  preview.textContent = PI.settings.buttonTitle || PI.settings.actionName || 'PREVIEW';
  if (PI.settings.customPng) {
    preview.style.backgroundImage = `url(${PI.settings.customPng})`;
    preview.style.backgroundSize = 'cover';
    preview.textContent = PI.settings.buttonTitle || '';
  } else {
    preview.style.backgroundImage = '';
  }
}

function fillSettings() {
  if ($('button-title')) $('button-title').value = PI.settings.buttonTitle || '';
  if ($('font-size')) $('font-size').value = PI.settings.fontSize || 12;
  if ($('background')) $('background').value = PI.settings.background || '#333333';
  if ($('args-text')) $('args-text').value = PI.settings.argsText || '';
  if ($('chat-message')) $('chat-message').value = PI.settings.message || '';
  if ($('chat-platform')) $('chat-platform').value = PI.settings.platform || 'twitch';
  if ($('chat-bot')) $('chat-bot').checked = PI.settings.bot !== false;
  renderActions();
  renderNamed();
  renderLists();
  renderPreview();
}

function currentActionSelection() {
  return PI.settings.actionId ? { id: PI.settings.actionId, name: PI.settings.actionName } : null;
}

function onMessage(msg) {
  if (msg.event === 'didReceiveSettings') {
    PI.settings = msg.payload?.settings || {};
    fillSettings();
  }
  if (msg.event === 'didReceiveGlobalSettings') {
    PI.global = { ...PI.global, ...(msg.payload?.settings || {}) };
    renderConnection({ state: 'disconnected', host: PI.global.host, port: PI.global.port });
  }
  if (msg.event === 'sendToPropertyInspector') {
    const p = msg.payload || {};
    if (p.global) PI.global = { ...PI.global, ...p.global };
    if (p.actions) PI.actions = p.actions;
    if (p.settings) PI.settings = p.settings;
    if (p.named !== undefined) PI.named = p.named;
    if (p.snapshot) PI.snapshot = p.snapshot;
    renderConnection(p.snapshot || PI.snapshot);
    fillSettings();
  }
}

function connect(port, uuid, registerEvent, info, actionInfo) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => connect(port, uuid, registerEvent, info, actionInfo), { once: true });
    return;
  }
  PI.uuid = uuid;
  try {
    const parsed = typeof actionInfo === 'string' ? JSON.parse(actionInfo) : actionInfo;
    PI.action = parsed?.action;
    PI.context = parsed?.context;
    PI.settings = parsed?.payload?.settings || {};
  } catch {
    PI.action = null;
  }
  showSections(actionKind(PI.action));
  PI.ws = new WebSocket(`ws://127.0.0.1:${port}`);
  PI.ws.onopen = () => {
    PI.ws.send(JSON.stringify({ event: registerEvent, uuid }));
    send('getSettings');
    send('getGlobalSettings');
    sendToPlugin({ type: 'refreshActions' });
  };
  PI.ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
}

window.connectElgatoStreamDeckSocket = connect;
window.connectStreamDockSocket = connect;

window.addEventListener('DOMContentLoaded', () => {
  $('save-connection')?.addEventListener('click', () => {
    const global = {
      host: $('host').value.trim() || '127.0.0.1',
      port: Number($('port').value || 8080),
      password: $('password').value,
      autoConnect: true
    };
    send('setGlobalSettings', global);
    sendToPlugin({ type: 'saveGlobal', ...global });
  });
  $('btn-connect')?.addEventListener('click', () => sendToPlugin({ type: 'connect' }));
  $('btn-disconnect')?.addEventListener('click', () => sendToPlugin({ type: 'disconnect' }));
  $('btn-refresh')?.addEventListener('click', () => sendToPlugin({ type: 'refreshActions' }));
  $('action-search')?.addEventListener('input', () => renderActions());
  $('action-group')?.addEventListener('change', () => renderActions());
  $('args-text')?.addEventListener('change', (e) => setSettings({ argsText: e.target.value }));
  $('chat-message')?.addEventListener('change', (e) => setSettings({ message: e.target.value }));
  $('chat-platform')?.addEventListener('change', (e) => setSettings({ platform: e.target.value }));
  $('chat-bot')?.addEventListener('change', (e) => setSettings({ bot: e.target.checked }));
  $('button-title')?.addEventListener('change', (e) => setSettings({ buttonTitle: e.target.value }));
  $('font-size')?.addEventListener('change', (e) => setSettings({ fontSize: Number(e.target.value || 12) }));
  $('background')?.addEventListener('change', (e) => setSettings({ background: e.target.value }));
  $('icon-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSettings({ customPng: reader.result });
    reader.readAsDataURL(file);
  });
  $('clear-icon')?.addEventListener('click', () => setSettings({ customPng: '' }));
  $('add-random')?.addEventListener('click', () => {
    const sel = currentActionSelection();
    if (!sel) return;
    const list = Array.isArray(PI.settings.randomActions) ? [...PI.settings.randomActions] : [];
    list.push(sel);
    setSettings({ randomActions: list });
    renderLists();
  });
  $('clear-random')?.addEventListener('click', () => {
    setSettings({ randomActions: [] });
    renderLists();
  });
  $('add-sequence')?.addEventListener('click', () => {
    const sel = currentActionSelection();
    if (!sel) return;
    const list = Array.isArray(PI.settings.sequence) ? [...PI.settings.sequence] : [];
    list.push({ ...sel, delayMs: Number($('seq-delay')?.value || 0), argsText: $('seq-args')?.value || '' });
    setSettings({ sequence: list });
    renderLists();
  });
  $('clear-sequence')?.addEventListener('click', () => {
    setSettings({ sequence: [] });
    renderLists();
  });
});
