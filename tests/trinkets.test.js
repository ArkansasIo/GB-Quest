import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/trinkets.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQTrinkets; }
const plain = v => JSON.parse(JSON.stringify(v));

test('eight trinket types, each granting a known buff', () => {
  const t = load(), buffs = ['might', 'focus', 'fortify', 'regen', 'haste', 'thornskin', 'bless', 'foresight'];
  assert.equal(Object.keys(t.TRINKET_TYPES).length, 8);
  assert.deepEqual(plain(Object.values(t.TRINKET_TYPES).map(x => x.buff)).sort(), buffs.slice().sort());
  for (const x of Object.values(t.TRINKET_TYPES)) { assert.ok(x.rounds >= 1); assert.ok(['save', 'init'].includes(x.bonus)); }
});

test('rarity extends the effect: +1 round at rare, +1 more at legendary', () => {
  const t = load();
  assert.deepEqual([0, 2, 3, 4, 5, 8].map(r => t.trinketRounds('war_horn', r)), [3, 3, 4, 4, 5, 5]);
  assert.equal(t.trinketRounds('quicksilver', 0), 1);
  assert.equal(t.trinketRounds('nope', 5), 0);
});

test('only the two trinket slots trigger, and unknown items are ignored', () => {
  const t = load();
  const eq = { trinket1: { base: 'war_horn', rarity: 3, name: 'HORN' }, trinket2: { base: 'owl_feather', rarity: 0 }, ring1: { base: 'lucky_coin', rarity: 8 }, neck: { base: 'amulet' } };
  assert.deepEqual(plain(t.trinketEffects(eq)), [
    { slot: 'trinket1', type: 'war_horn', buff: 'might', rounds: 4, name: 'HORN' },
    { slot: 'trinket2', type: 'owl_feather', buff: 'foresight', rounds: 1, name: 'OWL FEATHER' },
  ]);
  assert.deepEqual(plain(t.trinketEffects({ trinket1: { base: 'amulet' } })), []);
  assert.deepEqual(plain(t.trinketEffects(null)), []);
});

test('trinket text names the effect and its length', () => {
  const t = load();
  assert.equal(t.trinketDesc('quicksilver', 0), 'BATTLE START: HASTED: extra attack, +2 AC FOR 1 RND.');
  assert.equal(t.trinketDesc('lucky_coin', 7), 'BATTLE START: FOCUSED: +15% crit chance FOR 5 RNDS.');
  assert.equal(t.trinketDesc('nope', 1), '');
});
