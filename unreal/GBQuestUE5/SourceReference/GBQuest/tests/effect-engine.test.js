import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Loads the real buff and condition tables with the effect engine, as the game does (classic scripts sharing a scope).
const ctx = { console };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['data_rules.js', 'data_world.js', 'effect_engine.js']) vm.runInContext(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
const BUFFS = vm.runInContext('BUFFS', ctx), CONDITIONS = vm.runInContext('CONDITIONS', ctx), E = ctx.GBQEffects;
const on = (id, extra = {}) => ({ id, rounds: 3, stacks: 1, ...extra });

test('every buff, debuff and condition has a name and a description', () => {
  for (const [id, def] of Object.entries(BUFFS)) {
    assert.ok(def.name, `${id} has no name`);
    assert.ok(typeof def.desc === 'string' && def.desc.length > 8, `${id} has no description`);
  }
  for (const [id, def] of Object.entries(CONDITIONS)) assert.ok(def.name && def.desc, `condition ${id} needs a name and description`);
});

test('every numeric effect uses a key the engine knows, and flags/dice/once use known kinds', () => {
  for (const [id, def] of Object.entries(BUFFS)) {
    for (const k of Object.keys(def.mods || {})) assert.ok(k in E.MOD_KEYS, `${id}.mods.${k} is not applied by the effect engine`);
    for (const k of Object.keys(def.dice || {})) assert.ok(['hit', 'saves'].includes(k), `${id}.dice.${k}`);
    for (const k of Object.keys(def.once || {})) assert.ok(['hit', 'saves'].includes(k), `${id}.once.${k}`);
    for (const k of Object.keys(def.flags || {})) assert.ok(['attackAdv', 'attackedDis', 'saveAdv'].includes(k), `${id}.flags.${k}`);
    if (def.tick) assert.ok(def.tick.healPct > 0 || (/^\d+d\d+$/.test(def.tick.dice) && def.tick.type), `${id}.tick`);
  }
});

test('generated descriptions state the numbers the engine applies', () => {
  assert.equal(BUFFS.haste.desc, '+2 AC, 1 extra attack per attack action, 25% chance of an extra action each turn.');
  assert.equal(BUFFS.focus.desc, '+15% critical chance.');
  assert.equal(BUFFS.shocked.desc, '-10% dodge, 10% more damage taken.');
  assert.equal(BUFFS.inspired.desc, '+3 to the next attack roll or saving throw.');
  assert.match(BUFFS.frostbite.desc, /stacks up to 3/);
});

test('mods sum across effects and multiply by stacks', () => {
  const m = E.mods([on('haste'), on('sundered', { stacks: 3 }), on('frenzy', { stacks: 2 }), on('might')], BUFFS);
  assert.equal(m.acb, 2 - 6);
  assert.equal(m.dmg, 20 + 15);
  assert.equal(m.haste, 25 + 20);
  assert.equal(m.extraAttack, 1);
  assert.deepEqual({ ...E.mods([on('doomed'), on('bane')], BUFFS) }, { saves: -4, hit: -4 });
  assert.deepEqual({ ...E.mods([on('unknown_effect'), on('stunned')], BUFFS) }, {});
});

test("a hero's saved buffs skip the keys derive() already counts, but not the rest", () => {
  const saved = [on('haste', { persist: true }), on('vulnerable', { persist: true })];
  assert.deepEqual({ ...E.mods(saved, BUFFS, true) }, { extraAttack: 1, takenPct: 25 }, 'AC and haste come from derive for heroes');
  assert.equal(E.mods(saved, BUFFS, false).acb, 2, 'monsters and companions have no derive: count everything');
  assert.equal(E.mods([on('haste')], BUFFS, true).acb, 2, 'a buff gained in battle counts for heroes');
});

test('dice, one-shot bonuses and flags', () => {
  assert.deepEqual([...E.dice([on('bless')], BUFFS, 'hit')], ['1d4']);
  assert.deepEqual([...E.dice([on('bless')], BUFFS, 'saves')], ['1d4']);
  assert.deepEqual(JSON.parse(JSON.stringify(E.onceBonuses([on('inspired'), on('bless')], BUFFS, 'hit'))), [{ id: 'inspired', value: 3 }]);
  assert.equal(E.flag([on('foresight')], BUFFS, 'saveAdv'), true);
  assert.equal(E.flag([on('trueveil')], BUFFS, 'saveAdv'), false);
  assert.equal(E.flag([on('trueveil')], BUFFS, 'attackedDis'), true);
});

test('combat caps keep percentages in range', () => {
  assert.equal(E.cap('haste', -40), 0);
  assert.equal(E.cap('dodge', 500), E.CAPS.dodge);
  assert.equal(E.cap('resist', -30), -30, 'negative resistance (more damage) is allowed');
  assert.equal(E.cap('resist', 200), E.CAPS.resist);
});

test('combat.js applies effects through the engine, not per-effect special cases', () => {
  const src = fs.readFileSync(new URL('../src/combat.js', import.meta.url), 'utf8');
  for (const id of ['might', 'weakened', 'bless', 'inspired', 'doomed', 'bane', 'haste', 'frostbite', 'sundered', 'slowed', 'thornskin', 'foresight', 'focus', 'fortify', 'shocked']) {
    assert.doesNotMatch(src, new RegExp(`(hasEff|effOf)\\([a-z]+, '${id}'\\)`), `combat.js still special-cases ${id}`);
  }
  assert.doesNotMatch(src, /e\.id === 'haste'|e\.id === 'frostbite'|e\.id === 'sundered'|e\.id === 'slowed'/);
  const build = fs.readFileSync(new URL('../tools/build.cjs', import.meta.url), 'utf8');
  assert.match(build, /'rules', 'effect_engine', 'combat'/, 'the engine must load before combat.js');
});
