import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Online heroes are stored with their real job. The realm server must accept every job and use its primary stat in combat.
const ctx = { console, window: {} };
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data_rules.js', 'jobs_data.js']) vm.runInContext(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const CLASSES = JSON.parse(vm.runInContext('JSON.stringify(CLASSES)', ctx));
const server = fs.readFileSync(new URL('../backend/mmorpg-server.cjs', import.meta.url), 'utf8');
const JOB_IDS = server.match(/const JOB_IDS = new Set\(\[([^\]]*)\]/)[1].match(/'([a-z]+)'/g).map(x => x.slice(1, -1));
const start = server.indexOf('const PRIMARY_ATTRIBUTE = Object.freeze(');
const PRIMARY = vm.runInNewContext('(' + server.slice(server.indexOf('{', start), server.indexOf('});', start) + 1) + ')');
const ATTRIBUTES = vm.runInNewContext(server.match(/const ATTRIBUTES = (\[[^\]]*\])/)[1]);

test('the realm server accepts every job in the game', () => {
  assert.deepEqual([...JOB_IDS].sort(), Object.keys(CLASSES).sort());
});

test('each job fights with its own primary stat, which players can raise', () => {
  for (const [id, job] of Object.entries(CLASSES)) {
    assert.equal(PRIMARY[id], job.primary.toLowerCase(), id);
    assert.ok(ATTRIBUTES.includes(PRIMARY[id]), `${id}: ${PRIMARY[id]} can't be allocated`);
  }
  for (const legacy of ['warrior', 'mage', 'ranger', 'cleric', 'rogue', 'adventurer']) assert.ok(PRIMARY[legacy], legacy);
});

test('the account panel sends the job, and only falls back to a legacy class for old servers', () => {
  const client = fs.readFileSync(new URL('../client/mmorpg-account.js', import.meta.url), 'utf8');
  assert.match(client, /post\(job\)/);
  assert.match(client, /invalid_character'\) return \(await post\(legacyClass\)\)/);
  const trade = fs.readFileSync(new URL('../client/mmorpg-trade.js', import.meta.url), 'utf8');
  assert.match(trade, /function classOptions\(\)/);
});
