import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const load = (file, name) => { const c = { Math, Object, Array, String, Number, globalThis: null }; c.globalThis = c; vm.runInNewContext(src(file), c); return c[name]; };
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

test('taxonomy: weapons read CLASS > SUBCLASS > TYPE > SUBTYPE with stats that grow over 23 tiers', () => {
  const X = load('gear_taxonomy.js', 'GBQTaxonomy');
  const sword = X.weaponTaxonomy({ fam: 'sword', subclassName: 'SWORD', props: 'v', tier: 5, material: { name: 'DUSKIRON', type: 'SHADOWED' } });
  assert.equal(X.taxonomyLine(sword), 'MELEE > SWORD > VERSATILE > DUSKIRON');
  assert.deepEqual(Array.from(sword.stats, s => s[0]), ['strength', 'dmgMelee', 'dmg', 'necrotic'], 'attribute, class stat, grip stat, material element');
  const bow = X.weaponTaxonomy({ fam: 'bow', props: 'r2', tier: 23, material: { name: 'WORLDROOT', type: 'DIVINE' } });
  assert.equal(bow.cls, 'RANGED'); assert.equal(bow.type, 'TWO-HANDED'); assert.ok(bow.stats.some(([k]) => k === 'radiant'));
  assert.equal(X.weaponTaxonomy({ fam: 'grimoire', props: 'l', tier: 1 }).cls, 'CASTER');
  const low = X.weaponTaxonomy({ fam: 'axe', props: '', tier: 1 }), high = X.weaponTaxonomy({ fam: 'axe', props: '', tier: 23 });
  for (let i = 0; i < low.stats.length; i++) assert.ok(high.stats[i][1] > low.stats[i][1], `stat ${low.stats[i][0]} grows with tier`);
  // every weapon subclass belongs to exactly one class
  const fams = Object.values(X.TAX_WEAPON_CLASS).flatMap(c => c.fams);
  assert.equal(fams.length, 14); assert.equal(new Set(fams).size, 14);
});

test('taxonomy: armour classes, the 7 categories, 28 named types, shields and material resistances', () => {
  const X = load('gear_taxonomy.js', 'GBQTaxonomy');
  const helm = X.armourTaxonomy({ aclass: 'plate', slot: 'head', tier: 10, material: { name: 'MOONSILVER', type: 'LUNAR' } });
  assert.equal(X.taxonomyLine(helm), 'PLATE > HELM > GREATHELM > MOONSILVER');
  assert.deepEqual(Array.from(helm.stats, s => s[0]), ['strength', 'hpPct', 'resShadow']);
  const boots = X.armourTaxonomy({ aclass: 'cloth', slot: 'feet', tier: 3, material: { name: 'SILK', type: '' } });
  assert.equal(boots.type, 'SLIPPERS'); assert.ok(boots.stats.some(([k]) => k === 'moveSpeed') && boots.stats.some(([k]) => k === 'resist'));
  const shield = X.armourTaxonomy({ aclass: 'shield', slot: 'armor', name: 'TOWER SHIELD', tier: 8 });
  assert.equal(shield.cls, 'SHIELD'); assert.equal(shield.subclass, 'TOWER'); assert.ok(shield.stats.some(([k]) => k === 'block'));
  let types = 0; for (const [cls, row] of Object.entries(X.TAX_PIECE_TYPES)) { assert.equal(Object.keys(row).length, 7, `${cls} names all 7 categories`); types += 7; }
  assert.equal(types, 28);
  assert.equal(X.traitStats('VOLATILE')[1], 'resFire'); assert.equal(X.traitStats('nothing')[0], 'physDmg');
});

test('skill cores: 14 weapon skills, 8 armour passives, ranks 1-5 and resonance', () => {
  const C = load('skill_cores.js', 'GBQSkillCores');
  assert.equal(Object.keys(C.WEAPON_CORES).length, 14); assert.equal(Object.keys(C.ARMOUR_CORES).length, 8);
  assert.equal(C.coreDefinition('sword_r2').name, 'BLADE DANCE'); assert.equal(C.coreDefinition('feet_r5').kind, 'armour');
  assert.equal(C.coreDefinition('sword_r6'), null); assert.equal(C.coreDefinition('nope_r1'), null);
  const swordSlot = C.coreSlotOf({ kind: 'weapon', fam: 'sword' }), axeSlot = C.coreSlotOf({ kind: 'weapon', fam: 'axe' });
  assert.equal(C.effectiveRank(C.coreDefinition('sword_r2'), swordSlot), 3, 'resonates in its own subclass');
  assert.equal(C.effectiveRank(C.coreDefinition('sword_r2'), axeSlot), 2);
  assert.deepEqual({ ...C.coreSlotOf({ kind: 'armor', armourType: 'shield' }) }, { kind: 'armour', key: 'offhand' });
  assert.deepEqual({ ...C.coreSlotOf({ kind: 'wondrous', slot: 'feet' }) }, { kind: 'armour', key: 'feet' });
  assert.equal(C.coreSlotOf({ kind: 'wondrous', slot: 'ring1' }), null, 'jewelry has no core socket');
  const sk1 = C.weaponCoreSkill(C.coreDefinition('hammer_r1'), 1, 1), sk5 = C.weaponCoreSkill(C.coreDefinition('hammer_r5'), 6, 200);
  assert.ok(sk1.aoe && sk1.rider === 'prone'); assert.ok(parseInt(sk5.dice) > parseInt(sk1.dice)); assert.ok(sk5.cd < sk1.cd);
  assert.deepEqual(Array.from(C.armourCoreStats(C.coreDefinition('armor_r2'), 3), x => [...x]), [['dr', 6], ['hpPct', 9]]);
});

test('skill cores: socket, swap, remove, combine and drops keep the inventory consistent', () => {
  const C = load('skill_cores.js', 'GBQSkillCores');
  const hero = { cores: {} }, sword = { kind: 'weapon' }, slot = C.coreSlotOf({ kind: 'weapon', fam: 'sword' });
  assert.ok(C.addCore(hero, 'sword_r1', 4)); assert.ok(C.addCore(hero, 'axe_r1'));
  assert.equal(C.socketCore(hero, sword, slot, 'feet_r1').ok, false, 'unknown to the hero / wrong kind');
  assert.ok(C.addCore(hero, 'feet_r1'));
  assert.match(C.socketCore(hero, sword, slot, 'feet_r1').reason, /Armour cores/);
  assert.ok(C.socketCore(hero, sword, slot, 'sword_r1').ok); assert.equal(sword.core, 'sword_r1'); assert.equal(hero.cores.sword_r1, 3);
  const swap = C.socketCore(hero, sword, slot, 'axe_r1'); assert.equal(swap.returned, 'sword_r1'); assert.equal(hero.cores.sword_r1, 4); assert.equal(hero.cores.axe_r1, undefined);
  assert.ok(C.unsocketCore(hero, sword).ok); assert.equal(sword.core, null); assert.equal(hero.cores.axe_r1, 1);
  assert.equal(C.unsocketCore(hero, sword).ok, false);
  assert.equal(C.combineCores(hero, 'sword_r1').core, 'sword_r2'); assert.equal(hero.cores.sword_r1, 1); assert.equal(hero.cores.sword_r2, 1);
  assert.equal(C.combineCores(hero, 'sword_r1').ok, false, 'needs three');
  hero.cores.sword_r5 = 3; assert.equal(C.combineCores(hero, 'sword_r5').ok, false, 'max rank');
  assert.ok(C.coreDropChance({ boss: true }) > C.coreDropChance({ elite: true }) && C.coreDropChance({ elite: true }) > C.coreDropChance({}));
  const drop = C.rollCoreDrop(seq([0.1, 0.99]), { boss: true }); assert.ok(C.coreDefinition(drop)); assert.ok(C.coreDefinition(drop).rank >= 2, 'bosses drop higher ranks');
  assert.ok(C.forgeCost(60) > C.forgeCost(1));
});
