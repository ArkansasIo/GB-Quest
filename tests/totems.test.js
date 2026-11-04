import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/totems.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, Set, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQTotems; }
const plain = v => JSON.parse(JSON.stringify(v));
const BUFFS = ['fortify', 'burning', 'might', 'regen', 'frostbite', 'focus', 'thornskin', 'shocked', 'haste', 'bless', 'sundered', 'doomed'];
const STATS = ['resist', 'hp', 'block', 'heal', 'dmg', 'critdmg', 'fire', 'cold', 'lightning', 'radiant'];

test('five elements, each with a tank, dps and healer effect', () => {
  const T = load();
  assert.deepEqual(plain(T.TOTEM_IDS), ['flame', 'frost', 'storm', 'earth', 'spirit']);
  const names = new Set();
  for (const e of Object.values(T.TOTEM_ELEMENTS)) {
    assert.deepEqual(Object.keys(e.roles).sort(), ['dps', 'healer', 'tank']);
    for (const r of Object.values(e.roles)) {
      assert.ok(!names.has(r.name), `unique ${r.name}`); names.add(r.name);
      for (const b of [...(r.self || []), ...(r.party || []), ...(r.foes || [])]) assert.ok(BUFFS.includes(b), `${r.name} buff ${b}`);
    }
    assert.ok(e.roles.tank.temp > 0, 'tanks get temp HP');
    assert.ok(e.roles.dps.pulse, 'dps totems pulse damage');
    assert.ok(e.roles.healer.heal > 0, 'healer totems heal');
  }
  assert.equal(names.size, 15);
});

test('totem weapons are one-handed simple weapons of the totem family', () => {
  const T = load();
  assert.equal(Object.keys(T.TOTEM_WEAPONS).length, 5);
  for (const [id, w] of Object.entries(T.TOTEM_WEAPONS)) {
    assert.equal(w.fam, 'totem'); assert.equal(w.cat, 'simple'); assert.ok(!w.props.includes('2'), 'one-handed');
    assert.equal(T.totemOf(id), w.element);
  }
  assert.equal(T.totemOf('longbrand'), null);
  assert.equal(T.TOTEM_WEAPONS.flametotem.type, 'fire');
});

test('role passives scale with gear tier', () => {
  const T = load();
  assert.deepEqual(plain(T.rolePassive('flame', 'tank', 3)), [['resist', 3], ['hp', 17], ['fire', 5]]);
  assert.deepEqual(plain(T.rolePassive('flame', 'dps', 3)), [['dmg', 5], ['fire', 12]]);
  assert.deepEqual(plain(T.rolePassive('flame', 'healer', 3)), [['heal', 12], ['fire', 6]]);
  assert.deepEqual(plain(T.rolePassive('earth', 'tank', 8)), [['resist', 4], ['hp', 37], ['block', 3]]);
  assert.deepEqual(plain(T.rolePassive('earth', 'dps', 1)), [['dmg', 3], ['critdmg', 10]]);
  assert.deepEqual(plain(T.rolePassive('frost', 'oddrole', 1)), plain(T.rolePassive('frost', 'dps', 1)), 'unknown roles fight as dps');
  for (const e of T.TOTEM_IDS) for (const r of T.TOTEM_ROLES) for (const [k, v] of T.rolePassive(e, r, 20)) { assert.ok(STATS.includes(k), k); assert.ok(v > 0); }
  assert.deepEqual(plain(T.rolePassive('nope', 'tank', 1)), []);
});

test('plant plans: rounds, heal growth and uses per battle', () => {
  const T = load();
  const p = T.plantPlan('spirit', 'healer', 4, 3);
  assert.equal(p.name, 'ANCESTRAL MEND'); assert.equal(p.heal, 16); assert.equal(p.rounds, 3); assert.equal(p.uses, 1);
  assert.deepEqual(plain(p.party), ['regen', 'bless']);
  assert.equal(T.plantPlan('spirit', 'healer', 10, 5).rounds, 4);
  assert.equal(T.plantPlan('spirit', 'healer', 10, 5).uses, 2, 'legendary totems plant twice');
  const d = T.plantPlan('storm', 'dps', 1, 0);
  assert.equal(d.pulse, '2d6'); assert.equal(d.dt, 'lightning'); assert.equal(d.heal, 0); assert.equal(d.temp, 0);
  assert.equal(T.plantPlan('earth', 'tank', 1, 0).temp, 20);
  assert.equal(T.plantPlan('nope', 'tank', 1, 0), null);
  assert.equal(T.totemDesc('frosttotem'), 'FROST TOTEM. PLANT (bonus): TANK GLACIER WALL, DPS BLIZZARD, HEALER SNOWMELT.');
});
