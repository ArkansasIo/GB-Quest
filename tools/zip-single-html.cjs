const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inflateRawSync } = require('node:zlib');

const [sourceDir, targetPath, maxFilesText] = process.argv.slice(2);
const maxFiles = Number(maxFilesText);
const source = path.join(sourceDir || '', 'index.html');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(path.relative(sourceDir, full).split(path.sep).join('/'));
  }
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

if (!sourceDir || !targetPath || !Number.isInteger(maxFiles) || maxFiles < 1) {
  throw new Error('Usage: node zip-single-html.cjs <source-dir> <zip-path> <max-files>');
}
walk(sourceDir);
if (!files.includes('index.html')) throw new Error('Missing index.html in itch.io release folder.');
if (files.length > maxFiles) throw new Error('itch.io file limit exceeded: ' + files.length + ' > ' + maxFiles);
if (files.length !== 1 || files[0] !== 'index.html') throw new Error('Standalone release must contain only index.html: ' + files.join(', '));

const data = fs.readFileSync(source);
if (data.length <= 100_000 || data.length > 200 * 1024 * 1024) {
  throw new Error('Standalone HTML size is outside itch.io limits: ' + data.length + ' bytes.');
}
fs.mkdirSync(path.dirname(targetPath), { recursive: true });

if (process.platform === 'win32') {
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  const command = "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath " + quote(source) +
    ' -DestinationPath ' + quote(targetPath) + ' -CompressionLevel Optimal -Force';
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('PowerShell ZIP packaging failed with status ' + result.status);
} else {
  const script = String.raw`import pathlib, sys, zipfile
source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    archive.write(source, 'index.html')
with zipfile.ZipFile(target) as archive:
    assert archive.namelist() == ['index.html'], f'unexpected ZIP entries: {archive.namelist()}'
    assert archive.testzip() is None, 'ZIP CRC check failed'`;
  let result;
  for (const command of ['python3', 'python']) {
    result = spawnSync(command, ['-c', script, source, targetPath], { stdio: 'inherit' });
    if (!result.error && result.status === 0) break;
    if (command === 'python' || result.error && result.error.code !== 'ENOENT') {
      throw result.error || new Error(command + ' ZIP packaging failed with status ' + result.status);
    }
  }
  if (!result || result.error || result.status !== 0) throw new Error('Python 3 is required to create the itch.io ZIP.');
}

const archive = fs.readFileSync(targetPath);
let endOffset = -1;
for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset--) {
  if (archive.readUInt32LE(offset) === 0x06054b50) { endOffset = offset; break; }
}
if (endOffset < 0 || archive.readUInt16LE(endOffset + 10) !== 1) throw new Error('ZIP must contain exactly one central-directory entry.');
const centralOffset = archive.readUInt32LE(endOffset + 16);
if (archive.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error('ZIP central directory is invalid.');
const entryNameLength = archive.readUInt16LE(centralOffset + 28);
const entryName = archive.toString('utf8', centralOffset + 46, centralOffset + 46 + entryNameLength);
if (entryName !== 'index.html') throw new Error('Unexpected ZIP entry: ' + entryName);
const method = archive.readUInt16LE(centralOffset + 10);
const compressedSize = archive.readUInt32LE(centralOffset + 20);
const uncompressedSize = archive.readUInt32LE(centralOffset + 24);
const localOffset = archive.readUInt32LE(centralOffset + 42);
const localNameLength = archive.readUInt16LE(localOffset + 26);
const localExtraLength = archive.readUInt16LE(localOffset + 28);
const bodyOffset = localOffset + 30 + localNameLength + localExtraLength;
const body = archive.subarray(bodyOffset, bodyOffset + compressedSize);
const extracted = method === 8 ? inflateRawSync(body) : method === 0 ? body : null;
if (!extracted || extracted.length !== uncompressedSize || !extracted.equals(data) || crc32(extracted) !== archive.readUInt32LE(centralOffset + 16)) {
  throw new Error('ZIP entry failed decompression or CRC validation.');
}
console.log('Created and verified ' + targetPath + ' (' + (archive.length / 1024 / 1024).toFixed(2) + ' MiB; root entry index.html).');
