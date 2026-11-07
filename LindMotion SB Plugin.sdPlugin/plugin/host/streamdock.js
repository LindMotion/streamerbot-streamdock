'use strict';

const { EventEmitter } = require('events');
const { WebSocketClient } = require('./websocket');
const { hashImage } = require('../render/png');

class StreamDock extends EventEmitter {
  constructor({ log } = {}) {
    super();
    this.log = log || console;
    this.ws = null;
    this.port = null;
    this.pluginUUID = null;
    this.registerEvent = null;
    this.info = null;
    this.imageHash = new Map();
  }

  parseArgs(argv = process.argv) {
    const args = argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      const key = args[i];
      const val = args[i + 1];
      if (key === '-port') this.port = val;
      else if (key === '-pluginUUID') this.pluginUUID = val;
      else if (key === '-registerEvent') this.registerEvent = val;
      else if (key === '-info') {
        try {
          this.info = JSON.parse(val);
        } catch (err) {
          this.log.warn('failed to parse -info', err.message);
        }
      } else continue;
      i += 1;
    }
    if (!this.port && argv[3]) this.port = argv[3];
    if (!this.pluginUUID && argv[5]) this.pluginUUID = argv[5];
    if (!this.registerEvent && argv[7]) this.registerEvent = argv[7];
    if (!this.info && argv[9]) {
      try {
        this.info = JSON.parse(argv[9]);
      } catch {
        /* ignore */
      }
    }
  }

  connect() {
    this.parseArgs();
    if (!this.port || !this.pluginUUID || !this.registerEvent) {
      this.log.error('missing host launch args', {
        port: this.port,
        pluginUUID: this.pluginUUID,
        registerEvent: this.registerEvent,
        argv: process.argv
      });
      return;
    }
    const url = `ws://127.0.0.1:${this.port}`;
    this.log.info('connecting to Control Deck', url, this.pluginUUID);
    this.ws = new WebSocketClient(url);
    this.ws.on('open', () => {
      this.send({ event: this.registerEvent, uuid: this.pluginUUID });
      this.log.info('registered with Control Deck');
      this.emit('connected');
    });
    this.ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      this.log.debug('recv', msg.event, msg.action || '', msg.context || '');
      this.emit(msg.event, msg);
      this.emit('message', msg);
    });
    this.ws.on('error', (err) => this.log.error('host websocket error', err.message));
    this.ws.on('close', () => {
      this.log.warn('host websocket closed');
      this.emit('disconnected');
      process.exit(0);
    });
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return;
    try {
      this.ws.send(JSON.stringify(obj));
    } catch (err) {
      this.log.error('host send failed', err.message);
    }
  }

  setTitle(context, title, target = 0) {
    this.send({ event: 'setTitle', context, payload: { title: title || '', target } });
  }

  setImage(context, image, target = 0, state) {
    const key = `${context}:${target}:${state ?? 'all'}`;
    const hash = hashImage(image || '');
    if (this.imageHash.get(key) === hash) return false;
    this.imageHash.set(key, hash);
    const payload = { image, target };
    if (state !== undefined) payload.state = state;
    this.send({ event: 'setImage', context, payload });
    return true;
  }

  clearImageHash(context) {
    for (const key of [...this.imageHash.keys()]) {
      if (key.startsWith(`${context}:`)) this.imageHash.delete(key);
    }
  }

  setState(context, state) {
    this.send({ event: 'setState', context, payload: { state } });
  }

  setSettings(context, settings) {
    this.send({ event: 'setSettings', context, payload: settings || {} });
  }

  getSettings(context) {
    this.send({ event: 'getSettings', context });
  }

  setGlobalSettings(settings) {
    this.send({ event: 'setGlobalSettings', context: this.pluginUUID, payload: settings || {} });
  }

  getGlobalSettings() {
    this.send({ event: 'getGlobalSettings', context: this.pluginUUID });
  }

  showAlert(context) {
    this.send({ event: 'showAlert', context });
  }

  showOk(context) {
    this.send({ event: 'showOk', context });
  }

  sendToPropertyInspector(action, context, payload) {
    this.send({ event: 'sendToPropertyInspector', action, context, payload });
  }

  logMessage(message) {
    this.send({ event: 'logMessage', payload: { message: String(message) } });
  }
}

module.exports = { StreamDock };
