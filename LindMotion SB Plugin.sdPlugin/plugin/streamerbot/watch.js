'use strict';

const fs = require('fs');
const path = require('path');

const WATCH_FILES = new Set(['actions.json', 'commands.json']);

function watchStreamerbotData(home, onChange, log) {
  const dataDir = path.join(home, 'data');
  const watchers = [];
  let timer = null;

  function fire(reason) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        onChange(reason);
      } catch (err) {
        log.warn('Streamer.bot data watch callback failed', err.message);
      }
    }, 400);
  }

  if (!fs.existsSync(dataDir)) {
    log.warn('Streamer.bot data folder not found, live file refresh disabled', dataDir);
    return () => {};
  }

  try {
    const dirWatch = fs.watch(dataDir, { persistent: false }, (_event, filename) => {
      const name = filename ? String(filename) : '';
      if (WATCH_FILES.has(name)) fire(name);
    });
    watchers.push(dirWatch);
    log.info('watching Streamer.bot data folder', dataDir);
  } catch (err) {
    log.warn('cannot watch Streamer.bot data folder', dataDir, err.message);
  }

  return () => {
    clearTimeout(timer);
    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch {
        /* ignore */
      }
    }
  };
}

module.exports = { watchStreamerbotData };
