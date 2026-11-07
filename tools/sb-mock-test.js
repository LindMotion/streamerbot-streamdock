'use strict';

const net = require('net');
const crypto = require('crypto');
const { StreamerbotClient } = require('../LindMotion SB Plugin.sdPlugin/plugin/streamerbot/client');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function send(socket, text) {
  const payload = Buffer.from(text);
  const extra = payload.length < 126 ? 0 : 2;
  const header = Buffer.alloc(2 + extra);
  header[0] = 0x81;
  header[1] = extra ? 126 : payload.length;
  if (extra) header.writeUInt16BE(payload.length, 2);
  socket.write(Buffer.concat([header, payload]));
}

function readFrames(buffer, onText) {
  let buf = buffer;
  while (buf.length >= 2) {
    let len = buf[1] & 127;
    const masked = (buf[1] & 128) !== 0;
    let offset = 2;
    if (len === 126) {
      if (buf.length < 4) return buf;
      len = buf.readUInt16BE(2);
      offset = 4;
    }
    if (masked) offset += 4;
    if (buf.length < offset + len) return buf;
    const payload = Buffer.from(buf.subarray(offset, offset + len));
    if (masked) {
      const mask = buf.subarray(offset - 4, offset);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    buf = buf.subarray(offset + len);
    onText(payload.toString('utf8'));
  }
  return buf;
}

async function main() {
  const port = await new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let handshake = false;
      let buf = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        if (!handshake) {
          const text = chunk.toString('latin1');
          const key = text
            .split('\r\n')
            .find((l) => l.toLowerCase().startsWith('sec-websocket-key:'))
            ?.slice(19)
            .trim();
          const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
          socket.write(
            'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
              accept +
              '\r\n\r\n'
          );
          handshake = true;
          send(socket, JSON.stringify({
            request: 'Hello',
            info: { name: 'Streamer.bot', version: 'mock', os: 'windows' }
          }));
          const rest = text.indexOf('\r\n\r\n');
          buf = Buffer.from(chunk.subarray(rest + 4));
        } else buf = Buffer.concat([buf, chunk]);
        buf = readFrames(buf, (raw) => {
          const msg = JSON.parse(raw);
          if (msg.request === 'GetActions') {
            send(socket, JSON.stringify({
              status: 'ok',
              id: msg.id,
              count: 1,
              actions: [{ id: 'a1', name: 'Test Action', group: 'None', enabled: true }]
            }));
          } else if (msg.request === 'GetInfo') {
            send(socket, JSON.stringify({
              status: 'ok',
              id: msg.id,
              info: { name: 'Streamer.bot', version: 'mock' }
            }));
          } else if (msg.request === 'DoAction') {
            send(socket, JSON.stringify({ status: 'ok', id: msg.id }));
          } else {
            send(socket, JSON.stringify({ status: 'ok', id: msg.id }));
          }
        });
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

  const log = { info: () => {}, warn: () => {}, error: console.error, debug: () => {} };
  const sb = new StreamerbotClient({ log });
  sb.configure({ host: '127.0.0.1', port, password: '', autoConnect: true });
  const connected = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 4000);
    sb.on('connected', () => {
      clearTimeout(t);
      resolve();
    });
    sb.on('status', (s) => {
      if (s.state === 'disconnected' && s.lastError) {
        clearTimeout(t);
        reject(new Error(s.lastError));
      }
    });
  });
  sb.connect();
  await connected;
  if (!sb.findAction('Test Action')) throw new Error('GetActions did not populate');
  await sb.doAction({ id: 'a1', name: 'Test Action' });
  console.log('sb-mock-test ok', { port, actions: sb.actions.length, status: sb.status });
  sb.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
