'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { WebSocketClient } = require('../host/websocket');
const {
  DEFAULT_GLOBAL,
  STREAMERBOT_HOME,
  APPLICATION_EVENTS,
  APPLICATION_REFRESH_TYPES
} = require('../constants');
const { watchStreamerbotData } = require('./watch');

function authString(password, salt, challenge) {
  const secret = crypto.createHash('sha256').update(String(password) + String(salt), 'utf8').digest('base64');
  return crypto.createHash('sha256').update(secret + String(challenge), 'utf8').digest('base64');
}

class StreamerbotClient extends EventEmitter {
  constructor({ log } = {}) {
    super();
    this.log = log || console;
    this.settings = { ...DEFAULT_GLOBAL };
    this.ws = null;
    this.status = 'disconnected';
    this.lastError = '';
    this.info = null;
    this.actions = [];
    this.pending = new Map();
    this.reqId = 0;
    this.reconnectTimer = null;
    this.backoff = 1000;
    this.manualDisconnect = false;
    this.wantedEvents = {};
    this.session = null;
    this.refreshTimer = null;
    this.refreshing = false;
    this.lastActionRefresh = null;
    this.stopWatchFn = null;
  }

  configure(settings) {
    this.settings = {
      host: settings.host || '127.0.0.1',
      port: Number(settings.port || 8080),
      password: settings.password || '',
      autoConnect: settings.autoConnect !== false,
      dataPath: settings.dataPath || STREAMERBOT_HOME
    };
  }

  url() {
    return `ws://${this.settings.host}:${this.settings.port}/`;
  }

  setStatus(status, error) {
    this.status = status;
    if (error !== undefined) this.lastError = error || '';
    this.emit('status', this.snapshot());
  }

  snapshot() {
    return {
      state: this.status,
      host: this.settings.host,
      port: this.settings.port,
      lastError: this.lastError,
      instance: this.info || null,
      version: this.info?.version || '',
      actionCount: this.actions.length,
      lastActionRefresh: this.lastActionRefresh
    };
  }

  connect() {
    this.manualDisconnect = false;
    this.clearReconnect();
    this.closeSocket();
    this.setStatus('connecting', '');
    const url = this.url();
    this.log.info('connecting to Streamer.bot', url);
    try {
      this.ws = new WebSocketClient(url);
    } catch (err) {
      this.fail(err.message || String(err));
      return;
    }
    this.ws.on('open', () => this.log.info('Streamer.bot socket open, waiting for Hello'));
    this.ws.on('message', (raw) => this.onMessage(raw));
    this.ws.on('error', (err) => {
      this.log.error('Streamer.bot socket error', err.message);
      this.lastError = err.message;
    });
    this.ws.on('close', () => {
      this.log.warn('Streamer.bot socket closed');
      this.rejectAll('connection closed');
      if (this.manualDisconnect) {
        this.setStatus('disconnected');
        return;
      }
      this.scheduleReconnect();
    });
  }

  disconnect() {
    this.manualDisconnect = true;
    this.clearReconnect();
    this.clearRefresh();
    this.stopWatch();
    this.closeSocket();
    this.setStatus('disconnected', '');
  }

  closeSocket() {
    this.stopWatch();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.session = null;
  }

  startWatch() {
    this.stopWatch();
    const host = String(this.settings.host || '').toLowerCase();
    if (host !== '127.0.0.1' && host !== 'localhost') return;
    this.stopWatchFn = watchStreamerbotData(
      this.settings.dataPath || STREAMERBOT_HOME,
      (reason) => this.scheduleRefresh(`file:${reason}`),
      this.log
    );
  }

  stopWatch() {
    if (this.stopWatchFn) {
      try {
        this.stopWatchFn();
      } catch {
        /* ignore */
      }
      this.stopWatchFn = null;
    }
  }

  clearRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  scheduleRefresh(reason) {
    this.clearRefresh();
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (this.status !== 'connected') return;
      this.refreshActions(reason).catch((err) => this.log.warn('action refresh failed', err.message));
    }, 350);
  }

  scheduleReconnect() {
    this.setStatus('reconnecting', this.lastError || 'socket closed');
    this.clearReconnect();
    const wait = this.backoff;
    this.backoff = Math.min(30000, this.backoff * 2);
    this.log.info(`reconnect in ${wait}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manualDisconnect) this.connect();
    }, wait);
  }

  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  fail(message) {
    this.lastError = message;
    this.log.error('Streamer.bot error', message);
    this.rejectAll(message);
    this.scheduleReconnect();
  }

  onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.log.warn('non-json Streamer.bot message');
      return;
    }
    if (msg.request === 'Hello') {
      this.handleHello(msg);
      return;
    }
    if (msg.event && msg.event.source) {
      this.emit('event', msg);
      if (msg.event.source === 'Application' && APPLICATION_REFRESH_TYPES.has(msg.event.type)) {
        this.scheduleRefresh(msg.event.type);
      }
      return;
    }
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.status === 'error') {
        const err = msg.error || msg.message || 'Streamer.bot request failed';
        this.log.error('request error', msg.id, err);
        reject(new Error(err));
      } else resolve(msg);
    }
  }

  async handleHello(msg) {
    this.info = msg.info || null;
    this.session = msg.session || null;
    this.log.info('Hello from Streamer.bot', this.info?.version, this.info?.name);
    if (msg.authentication) {
      if (!this.settings.password) {
        this.fail('Streamer.bot requires a password');
        this.manualDisconnect = true;
        this.closeSocket();
        this.setStatus('disconnected', 'authentication required');
        return;
      }
      this.setStatus('authenticating');
      try {
        const authentication = authString(
          this.settings.password,
          msg.authentication.salt,
          msg.authentication.challenge
        );
        const res = await this.request({ request: 'Authenticate', authentication });
        if (res.status !== 'ok') throw new Error('authentication rejected');
      } catch (err) {
        this.fail(err.message);
        this.manualDisconnect = true;
        this.closeSocket();
        this.setStatus('disconnected', err.message);
        return;
      }
    }
    this.backoff = 1000;
    this.setStatus('connected', '');
    try {
      await this.refreshActions('hello');
      await this.applySubscriptions();
      const info = await this.request({ request: 'GetInfo' }).catch((err) => {
        this.log.warn('GetInfo failed', err.message);
        return null;
      });
      if (info?.info) this.info = info.info;
      this.log.info('Streamer.bot instance', {
        name: this.info?.name,
        version: this.info?.version,
        os: this.info?.os,
        source: this.info?.source
      });
    } catch (err) {
      this.log.warn('post-connect setup failed', err.message);
    }
    this.startWatch();
    this.emit('connected', this.snapshot());
  }

  nextId() {
    this.reqId += 1;
    return `d6:${Date.now()}:${this.reqId}`;
  }

  request(payload, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error('Streamer.bot is not connected'));
        return;
      }
      const id = payload.id || this.nextId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout waiting for ${payload.request}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });
      try {
        this.ws.send(JSON.stringify({ ...payload, id }));
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  rejectAll(message) {
    for (const [, p] of this.pending) p.reject(new Error(message));
    this.pending.clear();
  }

  async refreshActions(reason) {
    if (this.refreshing) {
      this.scheduleRefresh(reason || 'busy');
      return this.actions;
    }
    this.refreshing = true;
    try {
      const res = await this.request({ request: 'GetActions' });
      this.actions = Array.isArray(res.actions) ? res.actions : [];
      this.lastActionRefresh = {
        at: new Date().toISOString(),
        reason: reason || 'GetActions',
        count: this.actions.length
      };
      this.emit('actions', this.actions);
      this.log.info(`loaded ${this.actions.length} Streamer.bot actions`, reason || 'GetActions');
      return this.actions;
    } finally {
      this.refreshing = false;
    }
  }

  findAction(idOrName) {
    if (!idOrName) return null;
    const needle = String(idOrName).toLowerCase();
    return (
      this.actions.find((a) => a.id === idOrName) ||
      this.actions.find((a) => String(a.name).toLowerCase() === needle) ||
      null
    );
  }

  async doAction(action, args) {
    if (this.status !== 'connected') throw new Error('Streamer.bot is not connected');
    const payload = { request: 'DoAction', action: {} };
    if (action?.id) payload.action.id = action.id;
    if (action?.name) payload.action.name = action.name;
    if (args && Object.keys(args).length) payload.args = args;
    this.log.info('DoAction', payload.action, args || {});
    const res = await this.request(payload);
    if (res.status !== 'ok') throw new Error(res.error || 'DoAction failed');
    return res;
  }

  async doNamedAction(name, args, overrideId) {
    const found = overrideId ? this.findAction(overrideId) : this.findAction(name);
    if (!found && !name && !overrideId) throw new Error('no Streamer.bot action selected');
    if (!found && name && !overrideId) throw new Error(`missing Streamer.bot action "${name}"`);
    return this.doAction(
      found ? { id: found.id, name: found.name } : { id: overrideId, name },
      args
    );
  }

  async sendMessage({ platform, message, bot = true, internal = false }) {
    if (this.status !== 'connected') throw new Error('Streamer.bot is not connected');
    if (!message) throw new Error('message is empty');
    const res = await this.request({
      request: 'SendMessage',
      platform: platform || 'twitch',
      bot,
      internal,
      message
    });
    if (res.status !== 'ok') throw new Error(res.error || 'SendMessage failed');
    return res;
  }

  async getActiveViewers() {
    const res = await this.request({ request: 'GetActiveViewers' });
    return Array.isArray(res.viewers) ? res.viewers : [];
  }

  setWantedEvents(events) {
    this.wantedEvents = events || {};
    if (this.status === 'connected') this.applySubscriptions().catch((err) => this.log.warn(err.message));
  }

  mergeEvents(extra = {}) {
    const out = {};
    const sources = new Set([
      ...Object.keys(APPLICATION_EVENTS),
      ...Object.keys(this.wantedEvents || {}),
      ...Object.keys(extra)
    ]);
    for (const source of sources) {
      const names = new Set([
        ...(APPLICATION_EVENTS[source] || []),
        ...(this.wantedEvents[source] || []),
        ...(extra[source] || [])
      ]);
      if (names.size) out[source] = [...names];
    }
    return out;
  }

  async applySubscriptions() {
    const payload = this.mergeEvents();
    if (!Object.keys(payload).length) return;
    await this.request({ request: 'Subscribe', events: payload });
    this.log.info('subscribed', payload);
  }
}

module.exports = { StreamerbotClient, authString };
