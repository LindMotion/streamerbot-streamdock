'use strict';

const zlib = require('zlib');
const crypto = require('crypto');

const SIZE = 144;

const GLYPHS = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  ':': ['00000', '00100', '00000', '00000', '00000', '00100', '00000'],
  '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  '%': ['10001', '00010', '00100', '01000', '10001', '00000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111']
};

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const dest = y * (width * 4 + 1);
    raw[dest] = 0;
    rgba.copy(raw, dest + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function parseHex(color) {
  const hex = String(color || '#222222').replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fill(rgba, width, height, color) {
  const [r, g, b] = parseHex(color);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  }
}

function rect(rgba, width, height, x, y, w, h, color, radius = 0) {
  const [r, g, b] = parseHex(color);
  const x2 = Math.min(width, x + w);
  const y2 = Math.min(height, y + h);
  const rr = Math.max(0, radius);
  for (let py = Math.max(0, y); py < y2; py++) {
    for (let px = Math.max(0, x); px < x2; px++) {
      if (rr) {
        const dx = Math.min(px - x, x2 - 1 - px);
        const dy = Math.min(py - y, y2 - 1 - py);
        if (dx < rr && dy < rr) {
          const cx = rr - dx;
          const cy = rr - dy;
          if (cx * cx + cy * cy > rr * rr) continue;
        }
      }
      const o = (py * width + px) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
}

function drawGlyph(rgba, width, height, x, y, ch, color, scale) {
  const [r, g, b] = parseHex(color);
  const glyph = GLYPHS[String(ch).toUpperCase()] || GLYPHS['?'];
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 5; col++) {
      if (bits[col] !== '1') continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = x + col * scale + sx;
          const py = y + row * scale + sy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const o = (py * width + px) * 4;
          rgba[o] = r;
          rgba[o + 1] = g;
          rgba[o + 2] = b;
          rgba[o + 3] = 255;
        }
      }
    }
  }
}

function measure(text, scale) {
  const chars = String(text || '');
  const gap = Math.max(1, scale);
  return chars.length * (5 * scale + gap) - gap;
}

function wrapText(text, scale, maxWidth) {
  const words = String(text || '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measure(next, scale) <= maxWidth || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
    if (lines.length >= 4) break;
  }
  if (current && lines.length < 5) lines.push(current);
  return lines.slice(0, 5);
}

function drawText(rgba, width, height, text, y, color, scale, align = 'center') {
  const lines = String(text || '')
    .toUpperCase()
    .split('\n')
    .slice(0, 5);
  const gap = Math.max(1, scale);
  const lineH = 7 * scale + gap;
  lines.forEach((line, i) => {
    const tw = measure(line, scale);
    let x = 8;
    if (align === 'center') x = Math.max(4, Math.floor((width - tw) / 2));
    if (align === 'right') x = Math.max(4, width - tw - 8);
    for (let c = 0; c < line.length; c++) {
      drawGlyph(rgba, width, height, x + c * (5 * scale + gap), y + i * lineH, line[c], color, scale);
    }
  });
}

function renderButton({
  width = SIZE,
  height = SIZE,
  background = '#222222',
  accent = null,
  title = '',
  subtitle = '',
  titleColor = '#ffffff',
  scale = 3
} = {}) {
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, width, height, '#07070a');
  rect(rgba, width, height, 3, 3, width - 6, height - 6, background, 18);
  if (accent) rect(rgba, width, height, 3, 3, width - 6, 12, accent, 0);
  const titleScale = String(title).replace(/\s+/g, '').length > 8 ? Math.max(2, scale - 1) : scale;
  if (title) {
    const lines = wrapText(title, titleScale, width - 16);
    const blockH = lines.length * (7 * titleScale + titleScale);
    const y = subtitle ? 36 : Math.max(28, Math.floor((height - blockH) / 2) - (accent ? 4 : 0));
    drawText(rgba, width, height, lines.join('\n'), y, titleColor, titleScale, 'center');
  }
  if (subtitle) drawText(rgba, width, height, subtitle, 104, '#f0f0f0', 2, 'center');
  return encodePng(width, height, rgba);
}

function toDataUrl(pngBuffer) {
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

function hashImage(dataUrl) {
  return crypto.createHash('sha1').update(String(dataUrl)).digest('hex');
}

module.exports = {
  SIZE,
  encodePng,
  renderButton,
  toDataUrl,
  hashImage,
  parseHex
};
