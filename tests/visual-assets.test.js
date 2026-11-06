import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateSync } from 'node:zlib';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = path => fs.existsSync(new URL('../' + path, import.meta.url));

function assertPng(path) {
  const data = fs.readFileSync(new URL('../' + path, import.meta.url));
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], path + ' must have a PNG signature');
  let offset = 8;
  let sawHeader = false;
  let sawEnd = false;
  const imageData = [];
  while (offset + 12 <= data.length) {
    const size = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + 12 + size <= data.length, path + ' has a truncated ' + type + ' chunk');
    if (type === 'IHDR') sawHeader = true;
    if (type === 'IDAT') imageData.push(data.subarray(offset + 8, offset + 8 + size));
    offset += 12 + size;
    if (type === 'IEND') { sawEnd = true; break; }
  }
  assert.ok(sawHeader, path + ' is missing IHDR');
  assert.ok(sawEnd && offset === data.length, path + ' is missing a clean IEND');
  assert.ok(imageData.length, path + ' is missing IDAT image data');
  assert.ok(inflateSync(Buffer.concat(imageData)).length > 0, path + ' has invalid compressed image data');
}

test('new HD art collections are indexed and present as PNG assets', () => {
  const names = JSON.parse(read('assets/index.json'));
  for (const name of ['gbq_master_catalog', 'gbq_ui_mockup_catalog']) {
    assert.ok(names.includes(name), name + ' must be in the asset catalog');
    assert.ok(exists('assets/' + name + '.png'), name + ' PNG must exist');
    assertPng('assets/' + name + '.png');
  }
});

test('Shadows shell layers the new UI mockup artwork into the bezel', () => {
  const css = read('client/theme-shadows.css');
  assert.match(css, /GBQ_UI_MOCKUP/);
  assert.match(css, /\.theme-shadows \.bezel::after/);
  assert.match(css, /pointer-events:none/);
});

test('standalone browser build embeds both catalog images as data URIs', () => {
  const build = read('tools/build.cjs');
  assert.match(build, /GBQ_MASTER_CATALOG/);
  assert.match(build, /GBQ_UI_MOCKUP/);
  assert.match(build, /gbq_master_catalog\.png/);
  assert.match(build, /gbq_ui_mockup_catalog\.png/);
  assert.match(build, /data:image\/png;base64,/);
});

test('itch.io release gate verifies artwork is embedded in the playable HTML', () => {
  const build = read('tools/build-itch.cjs');
  assert.match(build, /gbq_master_catalog/);
  assert.match(build, /gbq_ui_mockup_catalog/);
  assert.match(build, /GBQ_HD64_ATLASES/);
  assert.match(build, /Unresolved artwork placeholder/);
  assert.match(build, /embeddedPngs/);
});
