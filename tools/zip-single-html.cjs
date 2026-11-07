const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync, inflateRawSync } = require('node:zlib');

const [sourceDir, targetPath, maxFilesText] = process.argv.slice(2);
const maxFiles = Number(maxFilesText);
const source = path.join(sourceDir, 'index.html');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(path.relative(sourceDir, full).split(path.sep).join('/'));
  }
}

if (!sourceDir || !targetPath || !Number.isInteger(maxFiles) || maxFiles < 1) {
  throw new Error('Usage: node zip-single-html.cjs <source-dir> <zip-path> <max-files>');
}
walk(sourceDir);
if (!files.includes('index.html')) throw new Error('Missing index.html in itch.io release folder.');
if (files.length > maxFiles) throw new Error('itch.io file limit exceeded: ' + files.length + ' > ' + maxFiles);
if (files.length !== 1 || files[0] !== 'index.html') throw new Error('Standalone release must contain only index.html: ' + files.join(', '));

const data = fs.readFileSync(source, 'utf8');
if (Buffer.byteLength(data, 'utf8') <= 100_000) throw new Error('Standalone game HTML is unexpectedly small.');
const uncompressed = Buffer.from(data, 'utf8');
const compressed = deflateRawSync(uncompressed, { level: 9 });
let crc = 0xffffffff;
for (const byte of uncompressed) {
  crc ^= byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
}
crc = (crc ^ 0xffffffff) >>> 0;

const name = Buffer.from('index.html');
const date = new Date();
const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
const dosDate = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
const local = Buffer.alloc(30 + name.length);
local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(uncompressed.length, 22);
local.writeUInt16LE(name.length, 26); name.copy(local, 30);

const central = Buffer.alloc(46 + name.length);
central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
central.writeUInt16LE(8, 10); central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14);
central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20);
central.writeUInt32LE(uncompressed.length, 24); central.writeUInt16LE(name.length, 28); name.copy(central, 46);

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(local.length + compressed.length, 16);
const archive = Buffer.concat([local, compressed, central, end]);

const endOffset = archive.length - 22;
const centralOffset = archive.readUInt32LE(endOffset + 16);
if (archive.readUInt32LE(endOffset) !== 0x06054b50 || archive.readUInt32LE(centralOffset) !== 0x02014b50) {
  throw new Error('Generated ZIP directory is invalid.');
}
const localOffset = archive.readUInt32LE(centralOffset + 42);
const nameLength = archive.readUInt16LE(localOffset + 26);
const extraLength = archive.readUInt16LE(localOffset + 28);
const compressedLength = archive.readUInt32LE(localOffset + 18);
const bodyOffset = localOffset + 30 + nameLength + extraLength;
const extracted = inflateRawSync(archive.subarray(bodyOffset, bodyOffset + compressedLength));
if (archive.toString('utf8', centralOffset + 46, centralOffset + 46 + archive.readUInt16LE(centralOffset + 28)) !== 'index.html' ||
    extracted.length !== uncompressed.length || Buffer.compare(extracted, uncompressed) !== 0) {
  throw new Error('Generated ZIP integrity check failed.');
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, archive);
console.log('Created ' + targetPath + ' (' + (archive.length / 1024 / 1024).toFixed(2) + ' MiB, ' + files.length + ' file; limit ' + maxFiles + ')');
