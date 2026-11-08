import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const importer = fs.readFileSync(path.join(root, 'tools/import_itch_asset_pack.py'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/asset_pack.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/ITCH_ASSET_SOURCES.md'), 'utf8');

test('itch.io importer records source, licence, hashes and review status', () => {
  assert.match(importer, /--source-url/);
  assert.match(importer, /--license/);
  assert.match(importer, /sha256/);
  assert.match(importer, /review_required/);
  assert.match(importer, /PurePosixPath/);
});

test('only small standalone equipment and item PNGs are eligible for automatic use', () => {
  assert.match(importer, /category in \{"weapons", "armor", "items"\} and max\(dims\) <= 64/);
  assert.match(importer, /readiness = "ready" if ready_icon else "review"/);
  assert.match(runtime, /function itchPackPick\(category, identity\)/);
  assert.match(runtime, /includes\(\`_\$\{category\}_ready_\`\)/);
  assert.match(runtime, /itchPackPick\('weapons'/);
  assert.match(runtime, /itchPackPick\('armor'/);
  assert.match(runtime, /itchPackPick\('items'/);
});

test('itch.io source guide distinguishes free samplers from licence approval', () => {
  assert.match(docs, /check each product page/i);
  assert.match(docs, /must obtain each ZIP from itch\.io/i);
  assert.match(docs, /Sprite sheets larger than 128 px/i);
});
