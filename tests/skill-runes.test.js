import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/skill_runes.js', import.meta.url), 'utf8');
function load() { const c = { Math, Number, String, Object, Array, RegExp, globalThis: null }; c.globalThis = c; vm.runInNewContext(source, c); return c.GBQSkillRunes; }
const rules = fs.readFileSync(new URL('../src/data_rules.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../src/data_world.js', import.meta.url), 'utf8');
const skillIds = [...rules.matchAll(/\{ id: '([a-z_]+)', name: '[^']+', effect: '[a-z]+', level: \d+, classes:/g)].map(m => m[1]);
const KINDS = ['buffSelf', 'buffParty', 'buffTarget', 'debuffTarget', 'debuffFoes', 'healSelf', 'healParty', 'healTarget', 'extraHit', 'summon', 'echo'];

test('every active skill has three runes with known effects', () => {
  const A = load();
  assert.ok(skillIds.length >= 8);
  for (const id of skillIds) {
    const runes = A.SKILL_RUNES[id]; assert.ok(runes && runes.length === 3, `${id} has 3 runes`);
    const ids = new Set();
    for (const r of runes) {
      assert.ok(!ids.has(r.id)); ids.add(r.id);
      assert.ok(r.name.length <= 13 && r.desc);
      for (const fx of r.fx) {
        assert.ok(KINDS.includes(fx.k), `${id}.${r.id} kind ${fx.k}`);
        if (fx.id) assert.match(rules, new RegExp(`\\b${fx.id}: *\\{`), `${id}.${r.id}: effect ${fx.id} exists`);
      }
    }
  }
});

test('runes unlock at skill level +5, +15 and +30', () => {
  const A = load();
  assert.equal(A.runeUnlockLevel(3, 0), 8); assert.equal(A.runeUnlockLevel(3, 2), 33);
  assert.equal(A.runesUnlocked(3, 7), 0); assert.equal(A.runesUnlocked(3, 8), 1); assert.equal(A.runesUnlocked(3, 18), 2); assert.equal(A.runesUnlocked(3, 40), 3);
  assert.equal(A.activeRune('power_strike', 3, 40, 'sunder').id, 'sunder');
  assert.equal(A.activeRune('power_strike', 3, 10, 'bloodletting'), null); // still locked
  assert.equal(A.activeRune('power_strike', 3, 40, 'nope'), null);
  assert.equal(A.activeRune('unknown', 3, 40, 'sunder'), null);
});
