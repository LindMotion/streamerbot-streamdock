'use strict';

const fs = require('fs');
const path = require('path');

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function createLogger(dir) {
  const logDir = dir || path.join(__dirname, 'log');
  const file = path.join(logDir, `${stamp()}.log`);
  let ready = false;

  function ensure() {
    if (ready) return;
    try {
      fs.mkdirSync(logDir, { recursive: true });
      ready = true;
    } catch {
      ready = false;
    }
  }

  function write(level, args) {
    const line = `${new Date().toISOString()} [${level}] ${args
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ')}\n`;
    ensure();
    if (!ready) return;
    try {
      fs.appendFileSync(file, line, 'utf8');
    } catch {
      /* ignore disk errors */
    }
    if (level === 'ERROR') console.error(line.trimEnd());
    else console.log(line.trimEnd());
  }

  return {
    info: (...args) => write('INFO', args),
    warn: (...args) => write('WARN', args),
    error: (...args) => write('ERROR', args),
    debug: (...args) => {
      if (process.env.SD_DEBUG === '1') write('DEBUG', args);
    }
  };
}

module.exports = { createLogger };
