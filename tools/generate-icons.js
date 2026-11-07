'use strict';

const fs = require('fs');
const path = require('path');
const { renderButton } = require('../LindMotion SB Plugin.sdPlugin/plugin/render/png');

const outDir = path.join(__dirname, '..', 'LindMotion SB Plugin.sdPlugin', 'imgs');
fs.mkdirSync(outDir, { recursive: true });

const icons = [
  ['plugin', 'SB', 'BOT', '#5b4dff'],
  ['category', 'SB', 'BOT', '#5b4dff'],
  ['connection', 'LINK', 'CONNECTION', '#2e7d32'],
  ['execute', 'GO', 'EXECUTE', '#1565c0'],
  ['execute-args', 'ARGS', 'WITH ARGS', '#0277bd'],
  ['execute-random', 'RND', 'RANDOM', '#6a1b9a'],
  ['execute-sequence', 'SEQ', 'SEQUENCE', '#00838f'],
  ['stream-start', 'LIVE', 'START', '#c62828'],
  ['stream-stop', 'STOP', 'STREAM', '#455a64'],
  ['record-start', 'REC', 'START', '#d32f2f'],
  ['record-stop', 'STOP', 'RECORD', '#546e7a'],
  ['scene', 'SCENE', 'CHANGE', '#ef6c00'],
  ['source', 'SRC', 'TOGGLE', '#f9a825'],
  ['mute-obs', 'MUTE', 'OBS MIC', '#ad1457'],
  ['shoutout', 'SO', 'SHOUTOUT', '#7b1fa2'],
  ['announce', 'ANN', 'ANNOUNCE', '#6a1b9a'],
  ['chat', 'CHAT', 'MESSAGE', '#00897b'],
  ['command', 'CMD', 'COMMAND', '#00695c'],
  ['mic', 'MIC', 'TOGGLE', '#2e7d32'],
  ['music', 'MUSIC', 'TOGGLE', '#1565c0'],
  ['soundboard', 'SFX', 'SOUNDBOARD', '#e65100'],
  ['preset', 'PRE', 'PRESET', '#4527a0'],
  ['status-stream', 'LIVE', 'STATUS', '#c62828'],
  ['status-record', 'REC', 'STATUS', '#b71c1c'],
  ['status-mic', 'MIC', 'STATUS', '#1b5e20'],
  ['status-viewers', 'VIEW', 'COUNTER', '#0d47a1']
];

for (const [name, title, subtitle, background] of icons) {
  const png = renderButton({ title, subtitle, background, scale: 3 });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, png);
  console.log('wrote', file, png.length);
}
