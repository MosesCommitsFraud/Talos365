// Erzeugt die Ribbon-Icons (Talos-Zeichen: zwei Segel über einer Welle) als PNG,
// ohne externe Abhängigkeiten.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BLUE = [0x3d, 0x87, 0xcb]; // Talos-Blau

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

// Geometrie im 32er-Raster des Talos-SVGs (viewBox 0 0 32 32)
function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

// Welle: M4 24 Q10 20 16 24 Q22 28 28 24 als Punktfolge
const wave = [];
const quad = (p0, p1, p2) => {
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    wave.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
};
quad([4, 24], [10, 20], [16, 24]);
quad([16, 24], [22, 28], [28, 24]);
function nearWave(x, y, half) {
  for (let i = 1; i < wave.length; i++) {
    const [ax, ay] = wave[i - 1], [bx, by] = wave[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const ex = ax + t * dx - x, ey = ay + t * dy - y;
    if (ex * ex + ey * ey <= half * half) return true;
  }
  return false;
}

// Deckkraft eines Punkts im 32er-Raster
function alphaAt(x, y) {
  if (inTriangle(x, y, [16, 4], [16, 22], [6, 22])) return 1;
  if (nearWave(x, y, 1.25)) return 1;
  if (inTriangle(x, y, [16, 8], [16, 22], [24, 22])) return 0.6;
  return 0;
}

function png(size) {
  // Kleine Icons bekommen etwas mehr Rand-Zoom, damit das Zeichen die Fläche füllt.
  const scale = 32 / size;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let a = 0;
      for (let i = 0; i < SS; i++)
        for (let j = 0; j < SS; j++) a += alphaAt((x + (i + 0.5) / SS) * scale, (y + (j + 0.5) / SS) * scale);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = BLUE[0];
      raw[o + 1] = BLUE[1];
      raw[o + 2] = BLUE[2];
      raw[o + 3] = Math.round((255 * a) / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "web", "public", "assets");
for (const size of [16, 32, 64, 80]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png(size));
}
console.log("Icons erzeugt in", outDir);
