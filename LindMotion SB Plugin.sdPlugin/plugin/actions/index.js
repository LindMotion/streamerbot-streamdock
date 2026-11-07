'use strict';

const { ACTIONS, NAMED_ACTIONS, COLORS } = require('../constants');
const { applyAppearance } = require('./appearance');
const { renderButton, toDataUrl } = require('../render/png');

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const text = String(raw).trim();
  if (!text) return {};
  if (text.startsWith('{')) {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('args JSON must be an object');
    return obj;
  }
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function collectNamedArgs(settings, argKeys) {
  const args = {};
  for (const key of argKeys) {
    if (settings[key] !== undefined && settings[key] !== '') args[key] = settings[key];
  }
  return args;
}

function statusPng(title, subtitle, background) {
  return toDataUrl(renderButton({ title, subtitle, background, scale: 3 }));
}

function registerActions(sd, sb, getGlobal, log) {
  const keys = new Map();
  const piContext = { action: null, context: null };
  const status = {
    streaming: null,
    recording: null,
    microphone: null,
    viewers: null,
    viewersAvailable: false
  };
  let viewerTimer = null;

  function getKey(context) {
    return keys.get(context);
  }

  function upsert(msg) {
    const prev = keys.get(msg.context) || {};
    const next = {
      uuid: msg.action,
      context: msg.context,
      settings: { ...(prev.settings || {}), ...(msg.payload?.settings || {}) }
    };
    keys.set(msg.context, next);
    return next;
  }

  function sendPi(payload) {
    if (!piContext.context) return;
    sd.sendToPropertyInspector(piContext.action, piContext.context, payload);
  }

  function connectionPayload() {
    return {
      type: 'connection',
      global: getGlobal(),
      snapshot: sb.snapshot(),
      actions: sb.actions.map((a) => ({
        id: a.id,
        name: a.name,
        group: a.group || 'None',
        enabled: a.enabled !== false
      }))
    };
  }

  function rematchStoredAction(entry) {
    if (!entry || (!entry.id && !entry.name)) return { entry, changed: false };
    const found = (entry.id && sb.findAction(entry.id)) || (entry.name && sb.findAction(entry.name));
    if (!found) return { entry, changed: false };
    if (found.id === entry.id && found.name === entry.name) return { entry, changed: false };
    return { entry: { ...entry, id: found.id, name: found.name }, changed: true };
  }

  function rematchList(list) {
    if (!Array.isArray(list) || !list.length) return { list, changed: false };
    let changed = false;
    const next = list.map((item) => {
      const result = rematchStoredAction(item);
      if (result.changed) changed = true;
      return result.entry;
    });
    return { list: next, changed };
  }

  function rematchKeyActions() {
    for (const key of keys.values()) {
      const settings = { ...key.settings };
      let changed = false;
      if (settings.actionId || settings.actionName) {
        const result = rematchStoredAction({ id: settings.actionId, name: settings.actionName });
        if (result.changed) {
          settings.actionId = result.entry.id;
          settings.actionName = result.entry.name;
          changed = true;
        }
      }
      const random = rematchList(settings.randomActions);
      if (random.changed) {
        settings.randomActions = random.list;
        changed = true;
      }
      const sequence = rematchList(settings.sequence);
      if (sequence.changed) {
        settings.sequence = sequence.list.map((step, i) => ({
          ...settings.sequence[i],
          ...step
        }));
        changed = true;
      }
      if (!changed) continue;
      key.settings = settings;
      sd.setSettings(key.context, settings);
    }
  }

  function namedInfo(uuid) {
    const spec = NAMED_ACTIONS[uuid];
    if (!spec) return null;
    const found = sb.findAction(spec.name);
    return {
      expectedName: spec.name,
      args: spec.args,
      found: found ? { id: found.id, name: found.name, group: found.group || 'None' } : null
    };
  }

  function refreshPi() {
    if (!piContext.context) return;
    const key = getKey(piContext.context);
    sendPi({
      ...connectionPayload(),
      type: 'state',
      action: piContext.action,
      settings: key?.settings || {},
      named: namedInfo(piContext.action),
      status
    });
  }

  async function runDoAction(context, action, args) {
    try {
      await sb.doAction(action, args);
      sd.showOk(context);
    } catch (err) {
      log.error('action failed', err.message);
      sd.showAlert(context);
    }
  }

  function paintConnection(key) {
    const snap = sb.snapshot();
    const map = {
      connected: { title: 'CONNECTED', background: COLORS.connected, subtitle: `${snap.host}:${snap.port}` },
      connecting: { title: 'CONNECTING', background: COLORS.reconnecting, subtitle: `${snap.host}:${snap.port}` },
      authenticating: { title: 'AUTH', background: COLORS.reconnecting, subtitle: 'password' },
      reconnecting: { title: 'RECONNECT', background: COLORS.reconnecting, subtitle: snap.lastError || 'wait' },
      disconnected: { title: 'OFFLINE', background: COLORS.disconnected, subtitle: snap.lastError || 'offline' }
    };
    const vis = map[snap.state] || map.disconnected;
    applyAppearance(sd, key.context, key.settings, vis);
  }

  function paintStatusKeys() {
    for (const key of keys.values()) {
      if (key.uuid === ACTIONS.connection) paintConnection(key);
      if (key.uuid === ACTIONS.statusStreaming) {
        const live = status.streaming === true;
        const unknown = status.streaming === null;
        applyAppearance(sd, key.context, key.settings, {
          title: unknown ? 'STREAM' : live ? 'LIVE' : 'OFFLINE',
          subtitle: unknown ? 'NO DATA' : live ? 'ON AIR' : 'OFF',
          background: unknown ? COLORS.offline : live ? COLORS.live : COLORS.offline
        });
      }
      if (key.uuid === ACTIONS.statusRecording) {
        const rec = status.recording === true;
        const unknown = status.recording === null;
        applyAppearance(sd, key.context, key.settings, {
          title: unknown ? 'RECORD' : rec ? 'REC' : 'IDLE',
          subtitle: unknown ? 'NO DATA' : rec ? 'RECORDING' : 'STOPPED',
          background: unknown ? COLORS.offline : rec ? COLORS.recording : COLORS.offline
        });
      }
      if (key.uuid === ACTIONS.statusMicrophone) {
        const muted = status.microphone;
        const unknown = muted === null;
        applyAppearance(sd, key.context, key.settings, {
          title: unknown ? 'MIC' : muted ? 'MUTED' : 'LIVE MIC',
          subtitle: unknown ? 'LAST KNOWN' : muted ? 'RED' : 'OPEN',
          background: unknown ? COLORS.offline : muted ? COLORS.muted : COLORS.unmuted
        });
      }
      if (key.uuid === ACTIONS.statusViewers) {
        const label = status.viewersAvailable && status.viewers !== null ? String(status.viewers) : 'N/A';
        applyAppearance(sd, key.context, key.settings, {
          title: 'VIEWERS',
          subtitle: label,
          background: COLORS.viewers
        });
      }
    }
  }

  function paintKey(key) {
    if (!key) return;
    if (
      key.uuid === ACTIONS.connection ||
      key.uuid === ACTIONS.statusStreaming ||
      key.uuid === ACTIONS.statusRecording ||
      key.uuid === ACTIONS.statusMicrophone ||
      key.uuid === ACTIONS.statusViewers
    ) {
      paintStatusKeys();
      return;
    }
    const spec = NAMED_ACTIONS[key.uuid];
    const titles = {
      [ACTIONS.execute]: { title: key.settings.actionName || 'EXECUTE', background: COLORS.execute },
      [ACTIONS.executeArgs]: { title: key.settings.actionName || 'ARGS', background: '#0277bd' },
      [ACTIONS.executeRandom]: { title: 'RANDOM', background: '#6a1b9a' },
      [ACTIONS.executeSequence]: { title: 'SEQUENCE', background: '#00838f' },
      [ACTIONS.chatMessage]: { title: 'CHAT', background: '#00897b' }
    };
    if (spec) {
      applyAppearance(sd, key.context, key.settings, {
        title: key.settings.buttonTitle || spec.name.replace(/^D6 /, ''),
        background: '#3949ab'
      });
      return;
    }
    applyAppearance(sd, key.context, key.settings, titles[key.uuid] || { title: 'SB', background: '#333' });
  }

  function neededEvents() {
    const events = { OBS: new Set(), Kick: new Set(), Twitch: new Set() };
    for (const key of keys.values()) {
      if (key.uuid === ACTIONS.statusStreaming) {
        events.OBS.add('StreamingStarted');
        events.OBS.add('StreamingStopped');
        events.OBS.add('Connected');
        events.OBS.add('Disconnected');
      }
      if (key.uuid === ACTIONS.statusRecording) {
        events.OBS.add('RecordingStarted');
        events.OBS.add('RecordingStopped');
      }
      if (key.uuid === ACTIONS.statusMicrophone) {
        events.OBS.add('Event');
      }
      if (key.uuid === ACTIONS.statusViewers) {
        events.Kick.add('ViewerCountUpdate');
        events.Twitch.add('PresentViewers');
        events.Twitch.add('BroadcastUpdate');
      }
    }
    const out = {};
    for (const [source, set] of Object.entries(events)) {
      if (set.size) out[source] = [...set];
    }
    return out;
  }

  function syncSubscriptions() {
    sb.setWantedEvents(neededEvents());
    const needViewers = [...keys.values()].some((k) => k.uuid === ACTIONS.statusViewers);
    if (needViewers && !viewerTimer) {
      const tick = async () => {
        if (sb.status !== 'connected') return;
        try {
          const viewers = await sb.getActiveViewers();
          status.viewers = viewers.length;
          status.viewersAvailable = true;
          paintStatusKeys();
        } catch (err) {
          log.warn('GetActiveViewers failed', err.message);
        }
      };
      tick();
      viewerTimer = setInterval(tick, 15000);
    }
    if (!needViewers && viewerTimer) {
      clearInterval(viewerTimer);
      viewerTimer = null;
    }
  }

  sd.on('willAppear', (msg) => {
    const key = upsert(msg);
    log.info('willAppear', key.uuid, key.context);
    paintKey(key);
    syncSubscriptions();
  });

  sd.on('willDisappear', (msg) => {
    sd.clearImageHash(msg.context);
    keys.delete(msg.context);
    syncSubscriptions();
  });

  sd.on('didReceiveSettings', (msg) => {
    const key = upsert(msg);
    paintKey(key);
    if (piContext.context === msg.context) refreshPi();
  });

  sd.on('propertyInspectorDidAppear', (msg) => {
    piContext.action = msg.action;
    piContext.context = msg.context;
    upsert(msg);
    refreshPi();
  });

  sd.on('propertyInspectorDidDisappear', () => {
    piContext.action = null;
    piContext.context = null;
  });

  sd.on('sendToPlugin', async (msg) => {
    const payload = msg.payload || {};
    const key = keys.get(msg.context) || upsert(msg);
    try {
      if (payload.type === 'saveGlobal') {
        const next = {
          ...getGlobal(),
          host: String(payload.host || '127.0.0.1').trim(),
          port: Number(payload.port || 8080),
          password: String(payload.password || ''),
          autoConnect: payload.autoConnect !== false
        };
        sd.setGlobalSettings(next);
        sb.configure(next);
        if (next.autoConnect !== false) sb.connect();
        return;
      }
      if (payload.type === 'connect') {
        sb.configure(getGlobal());
        sb.connect();
        return;
      }
      if (payload.type === 'disconnect') {
        sb.disconnect();
        return;
      }
      if (payload.type === 'refreshActions') {
        if (sb.status === 'connected') await sb.refreshActions();
        refreshPi();
        return;
      }
      if (payload.type === 'saveSettings') {
        key.settings = { ...key.settings, ...(payload.settings || {}) };
        sd.setSettings(msg.context, key.settings);
        paintKey(key);
        refreshPi();
        return;
      }
      if (payload.type === 'preview') {
        paintKey(key);
      }
    } catch (err) {
      log.error('sendToPlugin failed', err.message);
      sendPi({ type: 'error', message: err.message });
    }
  });

  sd.on('keyUp', async (msg) => {
    const key = upsert(msg);
    const settings = key.settings;
    const uuid = key.uuid;
    try {
      if (uuid === ACTIONS.connection) {
        if (sb.status === 'connected') sb.disconnect();
        else {
          sb.configure(getGlobal());
          sb.connect();
        }
        return;
      }
      if (uuid === ACTIONS.execute) {
        if (!settings.actionId && !settings.actionName) throw new Error('select a Streamer.bot action');
        await runDoAction(key.context, { id: settings.actionId, name: settings.actionName });
        return;
      }
      if (uuid === ACTIONS.executeArgs) {
        if (!settings.actionId && !settings.actionName) throw new Error('select a Streamer.bot action');
        const args = parseArgs(settings.argsText);
        await runDoAction(key.context, { id: settings.actionId, name: settings.actionName }, args);
        return;
      }
      if (uuid === ACTIONS.executeRandom) {
        const list = Array.isArray(settings.randomActions) ? settings.randomActions.filter((a) => a.id || a.name) : [];
        if (!list.length) throw new Error('add at least one action');
        const pick = list[Math.floor(Math.random() * list.length)];
        await runDoAction(key.context, pick);
        return;
      }
      if (uuid === ACTIONS.executeSequence) {
        const list = Array.isArray(settings.sequence) ? settings.sequence.filter((a) => a.id || a.name) : [];
        if (!list.length) throw new Error('add at least one action');
        for (const step of list) {
          await sb.doAction({ id: step.id, name: step.name }, parseArgs(step.argsText || ''));
          const delay = Number(step.delayMs || 0);
          if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        }
        sd.showOk(key.context);
        return;
      }
      if (uuid === ACTIONS.chatMessage) {
        await sb.sendMessage({
          platform: settings.platform || 'twitch',
          message: settings.message || '',
          bot: settings.bot !== false,
          internal: settings.internal === true
        });
        sd.showOk(key.context);
        return;
      }
      if (uuid === ACTIONS.chatCommand) {
        const spec = NAMED_ACTIONS[uuid];
        const args = collectNamedArgs(settings, spec.args);
        try {
          await sb.doNamedAction(spec.name, args, settings.actionId);
        } catch (err) {
          const command = settings.command || args.command;
          if (!command) throw err;
          log.warn('named command action missing, sending chat text', err.message);
          await sb.sendMessage({
            platform: settings.platform || 'twitch',
            message: command,
            bot: settings.bot !== false
          });
        }
        sd.showOk(key.context);
        return;
      }
      if (uuid === ACTIONS.statusStreaming || uuid === ACTIONS.statusRecording || uuid === ACTIONS.statusViewers) {
        return;
      }
      if (uuid === ACTIONS.statusMicrophone || uuid === ACTIONS.obsMuteMic || uuid === ACTIONS.audioToggleMic) {
        const spec = NAMED_ACTIONS[uuid] || NAMED_ACTIONS[ACTIONS.obsMuteMic];
        await sb.doNamedAction(spec.name, {}, settings.actionId);
        if (status.microphone === null) status.microphone = true;
        else status.microphone = !status.microphone;
        paintStatusKeys();
        sd.showOk(key.context);
        return;
      }
      const spec = NAMED_ACTIONS[uuid];
      if (spec) {
        const args = collectNamedArgs(settings, spec.args);
        await sb.doNamedAction(spec.name, args, settings.actionId);
        sd.showOk(key.context);
        return;
      }
    } catch (err) {
      log.error('keyUp failed', uuid, err.message);
      sd.showAlert(key.context);
    }
  });

  sb.on('status', () => {
    paintStatusKeys();
    refreshPi();
  });
  sb.on('actions', () => {
    rematchKeyActions();
    for (const key of keys.values()) paintKey(key);
    refreshPi();
  });
  sb.on('connected', () => {
    syncSubscriptions();
    refreshPi();
  });
  sb.on('event', (msg) => {
    const source = msg.event?.source;
    const type = msg.event?.type;
    const data = msg.data || {};
    if (source === 'OBS' && type === 'StreamingStarted') status.streaming = true;
    if (source === 'OBS' && type === 'StreamingStopped') status.streaming = false;
    if (source === 'OBS' && type === 'RecordingStarted') status.recording = true;
    if (source === 'OBS' && type === 'RecordingStopped') status.recording = false;
    if (source === 'OBS' && type === 'Disconnected') {
      status.streaming = false;
      status.recording = false;
    }
    if (source === 'Kick' && type === 'ViewerCountUpdate') {
      const count = data.viewerCount ?? data.viewers ?? data.count;
      if (typeof count === 'number') {
        status.viewers = count;
        status.viewersAvailable = true;
      }
    }
    if (source === 'Twitch' && (type === 'PresentViewers' || type === 'BroadcastUpdate')) {
      const count = data.viewerCount ?? data.viewers ?? data.viewer_count;
      if (typeof count === 'number') {
        status.viewers = count;
        status.viewersAvailable = true;
      }
    }
    if (source === 'OBS' && type === 'Event') {
      const raw = JSON.stringify(data).toLowerCase();
      if (raw.includes('mute')) {
        if (raw.includes('"inputmuted":true') || raw.includes('"muted":true')) status.microphone = true;
        if (raw.includes('"inputmuted":false') || raw.includes('"muted":false')) status.microphone = false;
      }
    }
    paintStatusKeys();
  });
}

module.exports = { registerActions };
