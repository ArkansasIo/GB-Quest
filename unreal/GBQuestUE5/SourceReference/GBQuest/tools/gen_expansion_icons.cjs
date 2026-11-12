const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');
const SIZE = 32;
const SET = [
  ['#55c8d6', '#247b9a', 'wave'], ['#ff7842', '#be332b', 'dragon'],
  ['#ffab4f', '#ce512f', 'flame'], ['#bb8cff', '#7042bc', 'book'],
  ['#9edb73', '#43844c', 'lantern'], ['#76e4f2', '#397fbb', 'crystal'],
  ['#b5e7ff', '#557fb6', 'crown'], ['#d598ff', '#784bc3', 'tower'],
  ['#fa637d', '#a82956', 'moon'], ['#ffb254', '#b74732', 'spire'],
  ['#c3d3e6', '#667b9d', 'shield'], ['#b293e5', '#604681', 'eye'],
  ['#b2df72', '#538b55', 'flower'],
  ['#e8c060', '#8a6a2c', 'gear'], ['#5fe0c8', '#1f6f8a', 'fin'],
  ['#f2cc78', '#a0602c', 'hourglass'], ['#c8d8ff', '#5060b0', 'star'],
  ['#ff9fd8', '#8c3c8c', 'mask'], ['#d8e0e8', '#5c6878', 'sword'],
  ['#ffd860', '#c06020', 'sun'],
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const name = Buffer.from(type), body = Buffer.concat([name, data]), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]);
}
function png(pixels) {
  const rows = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * (SIZE * 4 + 1) + 1 + x * 4, p = pixels[y][x];
    rows[i] = p[0]; rows[i + 1] = p[1]; rows[i + 2] = p[2]; rows[i + 3] = p[3];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function rgb(hex) { return [...hex.matchAll(/[a-f\d]{2}/gi)].map(m => parseInt(m[0], 16)).concat(255); }
function render(index, light, shade, motif) {
  const px = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [0, 0, 0, 0]));
  const ink = rgb('#171421'), gold = rgb('#e8c875'), hi = rgb(light), low = rgb(shade), white = rgb('#fff0c6');
  const dot = (x, y, c) => { if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) px[y][x] = c; };
  const box = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) dot(xx, yy, c); };
  // A common stepped heraldic shield keeps all expansion marks visually related.
  const widths = [8, 11, 13, 14, 14, 13, 12, 11, 9, 7, 4, 1];
  for (let r = 0; r < widths.length; r++) {
    const y = 4 + r * 2, w = widths[r], x = 16 - w;
    box(x, y, w * 2, 2, ink);
    if (r < 10) box(x + 2, y + 1, w * 2 - 4, 1, gold);
  }
  for (let y = 7; y < 25; y++) {
    const w = 10 + Math.floor(Math.min(y - 7, 24 - y) * 0.38);
    box(16 - w, y, w * 2, 1, y < 16 ? low : shade === '#ff7842' ? rgb('#82302f') : rgb('#30233f'));
  }
  // Motifs use crisp, integer pixel blocks so they stay legible at 8-16 px.
  if (motif === 'wave') {
    for (let y = 13; y <= 20; y += 4) for (let x = 8; x < 24; x += 8) { box(x, y, 5, 2, hi); box(x + 3, y + 2, 3, 1, white); }
    box(13, 9, 6, 2, gold); box(15, 7, 2, 2, white);
  } else if (motif === 'dragon') {
    box(10, 14, 12, 5, hi); box(18, 11, 7, 5, hi); box(22, 10, 4, 3, white); box(24, 11, 1, 1, ink);
    box(8, 10, 7, 5, low); box(10, 9, 3, 2, hi); box(14, 18, 3, 5, low); box(20, 18, 3, 5, low); box(24, 14, 4, 2, gold);
  } else if (motif === 'flame') {
    box(14, 9, 4, 3, white); box(12, 12, 8, 4, hi); box(10, 16, 12, 6, low); box(13, 18, 6, 4, gold); box(15, 18, 3, 4, white);
  } else if (motif === 'book') {
    box(8, 11, 7, 12, gold); box(17, 11, 7, 12, gold); box(9, 12, 5, 9, low); box(18, 12, 5, 9, hi); box(15, 11, 2, 13, white);
    box(11, 14, 3, 1, white); box(19, 14, 3, 1, white); box(11, 17, 3, 1, gold); box(19, 17, 3, 1, gold); box(14, 7, 4, 2, white);
  } else if (motif === 'lantern') {
    box(11, 9, 10, 2, gold); box(13, 11, 6, 2, white); box(12, 13, 8, 8, hi); box(14, 14, 4, 6, white); box(10, 21, 12, 2, gold); box(14, 23, 4, 2, white);
    box(15, 5, 2, 4, gold);
  } else if (motif === 'crystal') {
    box(14, 8, 4, 3, white); box(11, 11, 10, 3, hi); box(9, 14, 14, 5, hi); box(11, 19, 10, 3, low); box(14, 22, 4, 2, gold);
    box(14, 12, 2, 8, white); box(18, 14, 2, 4, low);
  } else if (motif === 'crown') {
    box(9, 15, 14, 7, gold); box(10, 17, 12, 3, hi); box(8, 12, 3, 5, white); box(14, 9, 4, 7, white); box(21, 12, 3, 5, white);
    box(11, 22, 10, 2, gold); box(12, 18, 2, 2, low); box(18, 18, 2, 2, low);
  } else if (motif === 'tower') {
    box(12, 10, 8, 13, low); box(10, 14, 12, 9, hi); box(14, 7, 4, 3, white); box(8, 12, 4, 3, gold); box(20, 12, 4, 3, gold);
    box(14, 16, 4, 7, white); box(10, 22, 12, 2, gold); box(15, 5, 2, 2, white);
  } else if (motif === 'moon') {
    box(11, 9, 8, 2, white); box(9, 11, 10, 3, white); box(8, 14, 11, 5, hi); box(10, 19, 8, 3, hi); box(13, 22, 5, 2, gold);
    box(15, 10, 5, 3, low); box(17, 13, 4, 6, low); box(15, 19, 4, 3, low); box(21, 8, 2, 2, white);
  } else if (motif === 'spire') {
    box(13, 10, 6, 13, low); box(11, 13, 10, 10, hi); box(14, 6, 4, 4, white); box(15, 3, 2, 3, gold);
    box(9, 13, 3, 3, gold); box(20, 13, 3, 3, gold); box(14, 16, 4, 7, white); box(8, 23, 16, 2, gold);
  } else if (motif === 'shield') {
    box(11, 10, 10, 12, gold); box(13, 12, 6, 8, low); box(14, 13, 4, 6, hi); box(8, 13, 4, 3, white); box(20, 13, 4, 3, white);
    box(13, 21, 6, 3, gold); box(15, 15, 2, 6, white);
  } else if (motif === 'eye') {
    box(9, 13, 3, 2, gold); box(12, 11, 8, 2, hi); box(20, 13, 3, 2, gold); box(11, 15, 10, 4, white); box(13, 19, 6, 2, hi);
    box(15, 14, 4, 5, low); box(16, 15, 2, 3, white); box(16, 8, 2, 2, gold); box(16, 22, 2, 2, gold);
  } else if (motif === 'flower') {
    box(14, 9, 4, 4, white); box(10, 12, 4, 4, white); box(18, 12, 4, 4, white); box(12, 16, 8, 4, hi); box(14, 19, 4, 3, gold);
    box(15, 22, 2, 3, low); box(11, 21, 5, 2, hi); box(16, 23, 5, 2, hi); box(15, 13, 3, 3, gold);
  } else if (motif === 'gear') {
    box(13, 8, 6, 3, hi); box(13, 21, 6, 3, hi); box(8, 13, 3, 6, hi); box(21, 13, 3, 6, hi);
    box(10, 10, 12, 12, hi); box(13, 13, 6, 6, low); box(14, 14, 4, 4, gold); box(15, 15, 2, 2, ink); box(11, 11, 2, 2, white);
  } else if (motif === 'fin') {
    box(16, 7, 2, 3, white); box(14, 10, 5, 3, hi); box(12, 13, 8, 4, hi); box(10, 17, 12, 2, low);
    for (let x = 8; x < 24; x += 5) { box(x, 20, 4, 2, hi); box(x + 2, 22, 3, 1, white); } box(15, 11, 2, 5, white);
  } else if (motif === 'hourglass') {
    box(9, 8, 14, 2, gold); box(9, 22, 14, 2, gold); box(11, 10, 10, 3, white); box(13, 13, 6, 2, hi); box(15, 15, 2, 2, gold);
    box(13, 17, 6, 2, low); box(11, 19, 10, 3, hi); box(14, 20, 4, 2, gold);
  } else if (motif === 'star') {
    box(15, 7, 2, 5, white); box(15, 20, 2, 5, white); box(8, 15, 5, 2, white); box(19, 15, 5, 2, white);
    box(12, 12, 8, 8, hi); box(14, 14, 4, 4, white); box(10, 10, 2, 2, gold); box(20, 10, 2, 2, gold); box(10, 20, 2, 2, gold); box(20, 20, 2, 2, gold);
  } else if (motif === 'mask') {
    box(9, 11, 14, 8, hi); box(11, 19, 10, 3, hi); box(13, 22, 6, 2, low); box(11, 13, 4, 3, ink); box(17, 13, 4, 3, ink);
    box(12, 14, 2, 1, white); box(18, 14, 2, 1, white); box(8, 9, 3, 3, gold); box(21, 9, 3, 3, gold); box(14, 18, 4, 1, low);
  } else if (motif === 'sword') {
    box(15, 6, 2, 13, white); box(14, 7, 1, 11, hi); box(10, 18, 12, 2, gold); box(15, 20, 2, 4, low); box(14, 24, 4, 2, gold);
  } else if (motif === 'sun') {
    box(12, 12, 8, 8, gold); box(13, 13, 6, 6, white); box(15, 7, 2, 4, hi); box(15, 21, 2, 4, hi); box(7, 15, 4, 2, hi); box(21, 15, 4, 2, hi);
    box(9, 9, 2, 2, hi); box(21, 9, 2, 2, hi); box(9, 21, 2, 2, hi); box(21, 21, 2, 2, hi);
  }
  // Shared glint and numbered pip make the series readable as expansion marks.
  box(8, 6, 2, 2, white); box(22, 6, 2, 2, gold);
  const n = index + 1; box(13, 27, 6, 1, gold); if (n > 9) box(14, 27, 1, 2, white); else box(15, 27, 2, 2, white);
  return png(px);
}

const FROM = Number(process.argv[2] || 1); // `node gen_expansion_icons.cjs 14` writes only emblems 14 and up
SET.forEach(([light, shade, motif], index) => {
  if (index + 1 < FROM) return;
  fs.writeFileSync(path.join(OUT, `exp_icon_${index + 1}.png`), render(index, light, shade, motif));
});
console.log(`Generated ${SET.length} 32x32 expansion emblems.`);
