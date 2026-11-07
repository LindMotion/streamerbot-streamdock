'use strict';

const fs = require('fs');
const path = require('path');
const { renderButton, toDataUrl, hashImage } = require('../LindMotion SB Plugin.sdPlugin/plugin/render/png');
const { authString } = require('../LindMotion SB Plugin.sdPlugin/plugin/streamerbot/client');
const { ACTIONS, NAMED_ACTIONS } = require('../LindMotion SB Plugin.sdPlugin/plugin/constants');
const manifest = require('../LindMotion SB Plugin.sdPlugin/manifest.json');

const png = renderButton({ title: 'LIVE', subtitle: 'ON AIR', background: '#c62828' });
if (png[0] !== 137 || png[1] !== 80) throw new Error('PNG signature missing');
const url = toDataUrl(png);
if (!url.startsWith('data:image/png;base64,')) throw new Error('data url failed');
if (hashImage(url) === hashImage(url + 'x')) throw new Error('hash collision');

const auth = authString('secret', 'c2FsdA==', 'Y2hhbGxlbmdl');
if (typeof auth !== 'string' || auth.length < 20) throw new Error('auth string failed');

const uuids = manifest.Actions.map((a) => a.UUID);
if (!uuids.includes(ACTIONS.execute)) throw new Error('execute UUID missing from manifest');
for (const uuid of Object.keys(NAMED_ACTIONS)) {
  if (!uuids.includes(uuid)) throw new Error(`manifest missing ${uuid}`);
}

const imgs = path.join(__dirname, '..', 'LindMotion SB Plugin.sdPlugin', 'imgs');
for (const action of manifest.Actions) {
  const icon = path.join(__dirname, '..', 'LindMotion SB Plugin.sdPlugin', action.Icon);
  if (!fs.existsSync(icon)) throw new Error(`missing icon ${action.Icon}`);
}

console.log('selftest ok', {
  pngBytes: png.length,
  actions: manifest.Actions.length,
  imgs: fs.readdirSync(imgs).length,
  authLength: auth.length
});
