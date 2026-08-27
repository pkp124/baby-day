import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function icon(x, y, s) {
  const cx = s / 2;
  const cy = s / 2 + s * 0.02;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bg = [28, 23, 18, 255];
  const disc = s * 0.38;
  const inner = s * 0.17;
  if (dist < inner) return [243, 234, 223, 255];
  if (dist < disc) return [224, 122, 95, 255];
  const corner = s * 0.18;
  const inRoundRect =
    x > corner && x < s - corner || y > corner && y < s - corner ||
    Math.min(
      Math.hypot(x - corner, y - corner),
      Math.hypot(x - (s - corner), y - corner),
      Math.hypot(x - corner, y - (s - corner)),
      Math.hypot(x - (s - corner), y - (s - corner)),
    ) <= corner;
  return inRoundRect ? bg : [0, 0, 0, 0];
}

mkdirSync("public", { recursive: true });
writeFileSync("public/icon-192.png", png(192, icon));
writeFileSync("public/icon-512.png", png(512, icon));
writeFileSync("public/apple-touch-icon.png", png(180, icon));
console.log("wrote icons");
