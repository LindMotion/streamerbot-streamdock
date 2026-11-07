'use strict';

const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WebSocketClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = new URL(url);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.open = false;
    this.closed = false;
    this.key = crypto.randomBytes(16).toString('base64');
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.connect();
  }

  connect() {
    const port = Number(this.url.port || 80);
    this.socket = net.connect({ host: this.url.hostname, port });
    this.socket.setNoDelay(true);
    this.socket.once('connect', () => {
      const path = `${this.url.pathname || '/'}${this.url.search || ''}`;
      this.socket.write(
        `GET ${path} HTTP/1.1\r\n` +
          `Host: ${this.url.host}\r\n` +
          `Origin: http://${this.url.host}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${this.key}\r\n` +
          'Sec-WebSocket-Version: 13\r\n\r\n'
      );
    });
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (err) => this.emit('error', err));
    this.socket.on('close', () => this.finishClose());
  }

  get readyState() {
    if (this.closed) return 3;
    if (this.open) return 1;
    return 0;
  }

  send(data) {
    if (!this.open || this.closed) throw new Error('WebSocket is not open');
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    this.writeFrame(payload, 1);
  }

  close() {
    if (this.closed) return;
    if (this.open) this.writeFrame(Buffer.alloc(0), 8);
    this.socket.end();
  }

  onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    if (!this.open) {
      const end = this.buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const header = this.buffer.subarray(0, end).toString('latin1');
      const accept = crypto.createHash('sha1').update(this.key + GUID).digest('base64');
      const got = header
        .split('\r\n')
        .find((l) => l.toLowerCase().startsWith('sec-websocket-accept:'))
        ?.slice(21)
        .trim();
      if (!/^HTTP\/1\.1 101\b/.test(header) || got !== accept) {
        this.socket.destroy(new Error('WebSocket upgrade failed'));
        return;
      }
      this.open = true;
      this.buffer = this.buffer.subarray(end + 4);
      this.emit('open');
    }
    this.parseFrames();
  }

  parseFrames() {
    while (this.buffer.length >= 2) {
      const fin = (this.buffer[0] & 0x80) !== 0;
      const opcode = this.buffer[0] & 15;
      const masked = (this.buffer[1] & 128) !== 0;
      let len = this.buffer[1] & 127;
      let offset = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (masked) offset += 4;
      if (this.buffer.length < offset + len) return;
      let payload = Buffer.from(this.buffer.subarray(offset, offset + len));
      if (masked) {
        const mask = this.buffer.subarray(offset - 4, offset);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buffer = this.buffer.subarray(offset + len);
      if (opcode === 8) {
        this.socket.end();
        this.finishClose();
        return;
      }
      if (opcode === 9) {
        this.writeFrame(payload, 10);
        continue;
      }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 2) {
        this.fragments = [payload];
        this.fragmentOpcode = opcode;
      } else if (opcode === 0) {
        this.fragments.push(payload);
      } else {
        continue;
      }
      if (fin) {
        const data = Buffer.concat(this.fragments);
        this.fragments = [];
        const kind = this.fragmentOpcode;
        this.fragmentOpcode = 0;
        if (kind === 1 || kind === 2) this.emit('message', data.toString('utf8'));
      }
    }
  }

  writeFrame(payload, opcode) {
    const len = payload.length;
    const extra = len < 126 ? 0 : len <= 65535 ? 2 : 8;
    const header = Buffer.alloc(2 + extra + 4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | (extra ? (extra === 2 ? 126 : 127) : len);
    if (extra === 2) header.writeUInt16BE(len, 2);
    if (extra === 8) header.writeBigUInt64BE(BigInt(len), 2);
    const mask = crypto.randomBytes(4);
    mask.copy(header, 2 + extra);
    const body = Buffer.alloc(len);
    for (let i = 0; i < len; i++) body[i] = payload[i] ^ mask[i & 3];
    this.socket.write(Buffer.concat([header, body]));
  }

  finishClose() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.emit('close');
  }
}

module.exports = { WebSocketClient };
