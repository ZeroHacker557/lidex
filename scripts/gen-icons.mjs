// PWA ikonkalarini yaratish (tashqi kutubxonasiz): node scripts/gen-icons.mjs
// Lidex belgisi (web/src/shared/ui.tsx Logo) brend gradiyenti ustida, 4x4 supersampling bilan.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT = resolve(import.meta.dirname, '../web/public');
const C1 = [0x5b, 0x5b, 0xf6];
const C2 = [0x9b, 0x5c, 0xf6];

// ---------- PNG ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Shakllar (Logo: viewBox 24) ----------
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Logo ichidami (x, y — 24 birlikda) */
function inLogo(x, y) {
  const half = 2.6 / 2;
  let d = Math.min(segDist(x, y, 6, 4, 6, 17.5), segDist(x, y, 8.5, 20, 19, 20));
  if (x <= 8.5 && y >= 17.5) d = Math.min(d, Math.abs(Math.hypot(x - 8.5, y - 17.5) - 2.5));
  return d <= half || Math.hypot(x - 17, y - 7) <= 2.6;
}
/** Yumaloq kvadrat ichidami (0..1 koordinatalarda) */
function inRoundRect(u, v, r) {
  const cx = Math.min(Math.max(u, r), 1 - r);
  const cy = Math.min(Math.max(v, r), 1 - r);
  return Math.hypot(u - cx, v - cy) <= r;
}

function render(size, { radius, logoScale }) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          if (radius > 0 && !inRoundRect(u, v, radius)) continue;
          bg++;
          // Logo markazda: 24 birlik -> logoScale ulush
          const lx = 12 + ((u - 0.5) * 24) / logoScale;
          const ly = 12 + ((v - 0.5) * 24) / logoScale;
          if (inLogo(lx, ly)) fg++;
        }
      }
      const n = SS * SS;
      const t = (px + py) / (2 * size); // diagonal gradiyent
      const base = C1.map((c, i) => c + (C2[i] - c) * t);
      const f = bg ? fg / bg : 0;
      const i = (py * size + px) * 4;
      out[i] = Math.round(base[0] + (255 - base[0]) * f);
      out[i + 1] = Math.round(base[1] + (255 - base[1]) * f);
      out[i + 2] = Math.round(base[2] + (255 - base[2]) * f);
      out[i + 3] = Math.round((bg / n) * 255);
    }
  }
  return png(size, out);
}

const files = [
  ['icon-192.png', 192, { radius: 0.22, logoScale: 0.62 }],
  ['icon-512.png', 512, { radius: 0.22, logoScale: 0.62 }],
  // Android adaptiv ikonka: to'liq fon, belgi xavfsiz zonada (markaziy 80%)
  ['icon-maskable-512.png', 512, { radius: 0, logoScale: 0.5 }],
  // iOS burchaklarni o'zi yumaloqlaydi
  ['apple-touch-icon.png', 180, { radius: 0, logoScale: 0.6 }],
];
for (const [name, size, opts] of files) {
  writeFileSync(resolve(OUT, name), render(size, opts));
  console.log('✓', name);
}
