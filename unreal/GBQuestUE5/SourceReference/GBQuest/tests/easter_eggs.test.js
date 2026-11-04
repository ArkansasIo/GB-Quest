import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/easter_eggs.js', import.meta.url), 'utf8');
function makeApi() { const context = { globalThis: {}, Date, gainXP: (s, xp) => { s.xp = (s.xp || 0) + xp; }, saveGame: () => true, toast: () => {} }; vm.runInNewContext(source, context); return context.globalThis.GBQEasterEggs; }
test('hidden sequences award rewards once and persist discoveries', () => {
  const api = makeApi(), state = { gold: 0, inv: {}, stats: {} };
  let result;
  for (const key of ['up','up','down','down','left','right','left','right','b','a']) result = api.feed(state, key) || result;
  assert.equal(result.ok, true);
  assert.equal(state.easterEggs.konami_legacy.foundAt > 0, true);
  assert.equal(state.gold, 1337);
  assert.equal(state.bossTokens, 1);
  assert.equal(state.xp, 2500);
  assert.equal(api.discover(state, api.definitions[0]).duplicate, true);
  assert.equal(state.gold, 1337);
});
test('all secrets appear in archive and unknown keys do not award rewards', () => {
  const api = makeApi(), state = {};
  assert.equal(api.feed(state, 'select'), null);
  const summary = api.summary(state);
  assert.equal(summary.total, 4);
  assert.equal(summary.discovered, 0);
});
