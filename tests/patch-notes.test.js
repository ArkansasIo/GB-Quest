import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const notes = require('../tools/patch-notes.cjs');
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('patch notes are valid, newest first, and the game copy is up to date', () => {
  const data = notes.load();
  const vs = data.releases.map(r => r.version.split('.').map(Number));
  for (let i = 1; i < vs.length; i++) assert.ok(vs[i - 1].join() !== vs[i].join() && (vs[i - 1][0] - vs[i][0] || vs[i - 1][1] - vs[i][1] || vs[i - 1][2] - vs[i][2]) > 0, 'newest first');
  for (const r of data.releases) for (const s of r.sections) { assert.ok(s.name && s.notes.length); for (const n of s.notes) assert.equal(typeof n, 'string'); }
  assert.equal(read('src/patch_notes.js').replace(/\r/g, ''), notes.render(data), 'run node tools/patch-notes.cjs');
});

test('the game, package and metadata versions match the newest patch notes', () => {
  const v = notes.load().releases[0].version;
  assert.match(read('src/data_world.js'), new RegExp(`version: '${v.replace(/\./g, '\\.')}'`));
  assert.equal(JSON.parse(read('package.json')).version, v);
  assert.equal(JSON.parse(read('game-metadata.json')).version, v);
});

test('release notes render as Markdown with every note', () => {
  const data = notes.load(), r = data.releases[0], md = notes.markdown(data, r.version);
  assert.ok(md.startsWith(`## v${r.version}`));
  for (const s of r.sections) for (const n of s.notes) assert.ok(md.includes(n));
});
