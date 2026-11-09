#!/usr/bin/env node
'use strict';
// Convert uncompressed or RLE true-colour TGA images to RGBA PNG without dependencies.
const fs = require('node:fs');
const zlib = require('node:zlib');

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function convert(input, output) {
  const src = fs.readFileSync(input);
  if (src.length < 18) throw new Error('TGA header is truncated');
  const idLength = src[0], type = src[2], width = src.readUInt16LE(12), height = src.readUInt16LE(14), bits = src[16], descriptor = src[17];
  if (![2, 10].includes(type) || ![24, 32].includes(bits) || !width || !height) throw new Error(`Unsupported TGA format (${type}, ${bits} bit)`);
  const bytesPerPixel = bits / 8, pixels = Buffer.alloc(width * height * 4);
  let offset = 18 + idLength, pixelIndex = 0;
  const readPixel = () => {
    if (offset + bytesPerPixel > src.length) throw new Error('TGA pixels are truncated');
    const b = src[offset++], g = src[offset++], r = src[offset++], a = bytesPerPixel === 4 ? src[offset++] : 255;
    return [r, g, b, a];
  };
  const putPixel = rgba => {
    const row = Math.floor(pixelIndex / width), col = pixelIndex % width;
    const x = descriptor & 0x10 ? width - 1 - col : col;
    const y = descriptor & 0x20 ? row : height - 1 - row;
    pixels.set(rgba, (y * width + x) * 4); pixelIndex++;
  };
  if (type === 2) while (pixelIndex < width * height) putPixel(readPixel());
  else while (pixelIndex < width * height) {
    if (offset >= src.length) throw new Error('TGA RLE data is truncated');
    const packet = src[offset++], count = (packet & 0x7f) + 1;
    if (pixelIndex + count > width * height) throw new Error('TGA RLE packet exceeds image bounds');
    if (packet & 0x80) { const color = readPixel(); for (let i = 0; i < count; i++) putPixel(color); }
    else for (let i = 0; i < count; i++) putPixel(readPixel());
  }
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(output, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })), pngChunk('IEND')]));
}

if (process.argv.length !== 4) {
  console.error('Usage: node tools/convert_tga.cjs <input.tga> <output.png>');
  process.exitCode = 2;
} else {
  try { convert(process.argv[2], process.argv[3]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
