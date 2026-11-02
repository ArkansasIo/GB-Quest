import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/heirlooms.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, Set, Date, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQHeirlooms; }
const plain = v => JSON.parse(JSON.stringify(v));

test('the heirloom set covers nine distinct equipment slots', () => {
  const h = load();
  assert.equal(h.HEIRLOOM_PIECES.length, 9);
  assert.deepEqual(plain(h.HEIRLOOM_PIECES.map(p => p.slot)).sort(), ['armor', 'back', 'feet', 'hands', 'head', 'legs', 'neck', 'waist', 'weapon']);
  assert.equal(new Set(h.HEIRLOOM_PIECES.map(p => p.id)).size, 9);
  assert.deepEqual(Object.keys(h.HEIRLOOM_WEAPONS), ['blade', 'mace', 'staff', 'bow', 'dagger', 'fist']);
});

test('heirlooms are usable at level 1 and scale with the hero up to 720', () => {
  const h = load(), one = h.heirloomStats('hl_helm', 1), mid = h.heirloomStats('hl_helm', 120), top = h.heirloomStats('hl_helm', 720);
  assert.equal(one.ilvl, 1); assert.equal(one.plus, 1);
  assert.deepEqual(plain(one.affixes), [['crit', 1], ['resist', 1]]);
  assert.ok(mid.affixes[1][1] > one.affixes[1][1] && top.affixes[1][1] > mid.affixes[1][1], 'stats grow with level');
  assert.equal(top.ilvl, 720); assert.equal(top.plus, 3); assert.equal(mid.plus, 1); assert.equal(h.heirloomPlus(241), 2);
  assert.equal(h.heirloomStats('hl_helm', 9999).ilvl, 720, 'clamped');
  assert.equal(h.heirloomStats('hl_helm', 0).ilvl, 1);
  assert.equal(h.heirloomStat('crit', 720), 50, 'capped at the stat maximum');
  assert.equal(h.heirloomStats('nope', 5), null);
});

test('heirloom XP bonuses stay fixed while other stats scale', () => {
  const h = load();
  for (const lvl of [1, 300, 720]) assert.deepEqual(plain(h.heirloomStats('hl_cloak', lvl).affixes.find(([s]) => s === 'xp')), ['xp', 5]);
});

test('heirlooms stay weaker than epic drops of the same level', () => {
  const h = load();
  // gen.js epic roll at its minimum: k * (1 + lvl/12) * (0.6 + 4 * 0.25) * 0.7 = k * (1 + lvl/12) * 1.12
  for (const lvl of [1, 60, 240, 720]) for (const [stat, k] of [['hp', 5], ['dmg', 3]]) assert.ok(h.heirloomStat(stat, lvl) <= Math.round(k * (1 + lvl / 12) * 1.12), `${stat} @ ${lvl}`);
});

test('weapon styles change the weapon stats', () => {
  const h = load();
  assert.deepEqual(plain(h.heirloomStats('hl_weapon', 10, 'staff').affixes.map(([s]) => s)), ['dmg', 'heal']);
  assert.deepEqual(plain(h.heirloomStats('hl_weapon', 10, 'dagger').affixes.map(([s]) => s)), ['crit', 'critdmg']);
  assert.deepEqual(plain(h.heirloomStats('hl_weapon', 10).affixes.map(([s]) => s)), ['dmg', 'crit']);
});

test('each class gets a sensible default weapon style and chest weight', () => {
  const h = load();
  const cases = [['warden', { weapons: 'martial', caster: null }, 'blade'], ['shade', { weapons: 'finesse', caster: null }, 'dagger'], ['arcanist', { weapons: 'simple', caster: 'full' }, 'staff'],
    ['pactbound', { weapons: 'simple', caster: 'pact' }, 'staff'], ['chaplain', { weapons: 'simple', caster: 'full' }, 'mace'], ['strider', { weapons: 'martial', caster: 'half' }, 'bow'], ['ascetic', { weapons: 'simple', caster: null }, 'fist']];
  for (const [id, cls, want] of cases) assert.equal(h.defaultWeaponStyle(id, cls), want, id);
  assert.equal(h.heaviestArmor(['light', 'medium', 'heavy', 'shield']), 'heavy');
  assert.equal(h.heaviestArmor(['light']), 'light');
  assert.equal(h.heaviestArmor([]), 'cloth');
});

test('set bonus steps in at 2, 4, 6 and 9 pieces and scales its health with level', () => {
  const h = load(), sum = (list, stat) => list.filter(([s]) => s === stat).reduce((a, [, v]) => a + v, 0);
  assert.deepEqual(plain(h.heirloomSetBonus(1, 10)), []);
  assert.equal(sum(h.heirloomSetBonus(2, 10), 'xp'), 10);
  assert.equal(sum(h.heirloomSetBonus(4, 10), 'hp'), 10);
  assert.equal(sum(h.heirloomSetBonus(4, 100), 'hp'), 55);
  assert.equal(sum(h.heirloomSetBonus(6, 10), 'dmg'), 10);
  const full = h.heirloomSetBonus(9, 1);
  assert.equal(sum(full, 'xp'), 30); assert.equal(sum(full, 'gf'), 15); assert.equal(sum(full, 'crit'), 3);
});

test('the account collection unlocks every piece, sanitises input and records summons', () => {
  const h = load();
  const fresh = h.normalizeCollection(null);
  assert.equal(fresh.unlocked.length, 9); assert.equal(fresh.summons, 0);
  const odd = h.normalizeCollection({ unlocked: ['hl_helm', 'junk'], summons: '3', heroes: { '0:Ana': true, bad: 'x' } });
  assert.equal(odd.unlocked.length, 9); assert.equal(odd.summons, 3); assert.deepEqual(plain(odd.heroes), { '0:Ana': true });
  const after = h.recordSummon(odd, '1:Bo', 1234);
  assert.equal(after.summons, 4); assert.equal(after.firstSummonAt, 1234); assert.equal(after.heroes['1:Bo'], true);
  assert.equal(odd.summons, 3, 'input not mutated');
  assert.deepEqual(plain(h.normalizeCollection([1, 2])).unlocked.length, 9);
});

test('copies are found on the hero, in bags, in the bank and on companions', () => {
  const h = load(), helm = { heirloom: 'hl_helm' }, boots = { heirloom: 'hl_boots' }, cloak = { heirloom: 'hl_cloak' }, belt = { heirloom: 'hl_belt' };
  const comp = { name: 'CINDER', eq: { feet: boots }, bag: [] };
  const hero = { eq: { head: helm, weapon: { kind: 'weapon' } }, bag: [cloak, { kind: 'armor' }], bank: [belt], companions: [comp] };
  const copies = h.heirloomCopies(hero);
  assert.deepEqual(plain(copies.map(c => [c.item.heirloom, c.where])), [['hl_helm', 'eq'], ['hl_cloak', 'bag'], ['hl_boots', 'eq'], ['hl_belt', 'bank']]);
  assert.equal(copies[2].holder, comp);
  assert.equal(h.hasHeirloom(hero, 'hl_belt'), true); assert.equal(h.hasHeirloom(hero, 'hl_legs'), false);
  assert.equal(h.equippedHeirloomCount(hero), 1); assert.equal(h.equippedHeirloomCount(comp), 1);
  assert.deepEqual(plain(h.heirloomCopies(null)), []);
});
