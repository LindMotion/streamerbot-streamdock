'use strict';

const { StreamDock } = require('./host/streamdock');
const { StreamerbotClient } = require('./streamerbot/client');
const { createLogger } = require('./log');
const { registerActions } = require('./actions');
const { DEFAULT_GLOBAL } = require('./constants');

const log = createLogger();

process.on('uncaughtException', (err) => {
  try {
    log.error('uncaught', err);
  } catch {
    console.error(err);
  }
});
process.on('unhandledRejection', (err) => {
  try {
    log.error('unhandledRejection', err);
  } catch {
    console.error(err);
  }
});
const sd = new StreamDock({ log });
const sb = new StreamerbotClient({ log });

let globalSettings = { ...DEFAULT_GLOBAL };

function getGlobal() {
  return { ...globalSettings };
}

registerActions(sd, sb, getGlobal, log);

let gotGlobal = false;

sd.on('connected', () => {
  sd.getGlobalSettings();
  setTimeout(() => {
    if (gotGlobal) return;
    log.warn('no global settings yet; using defaults');
    sb.configure(globalSettings);
    if (globalSettings.autoConnect !== false) sb.connect();
  }, 2000);
});

sd.on('didReceiveGlobalSettings', (msg) => {
  gotGlobal = true;
  globalSettings = { ...DEFAULT_GLOBAL, ...(msg.payload?.settings || {}) };
  log.info('global settings', {
    host: globalSettings.host,
    port: globalSettings.port,
    hasPassword: Boolean(globalSettings.password)
  });
  sb.configure(globalSettings);
  if (globalSettings.autoConnect !== false && sb.status !== 'connected' && sb.status !== 'connecting') {
    sb.connect();
  }
});

log.info('Lindmotion Streamer.bot plugin starting', process.argv.slice(2));
sd.connect();
