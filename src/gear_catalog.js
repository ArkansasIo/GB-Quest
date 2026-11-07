'use strict';
// ================================================================ AELMOOR GEAR EXPANSION
// Original weapon and armour bases. These extend the existing loot pools;
// all item creation, rarity rolls, affixes, durability, sockets and saves
// continue to use the shared inventory/equipment pipeline.
const AELMOOR_WEAPON_EXPANSION = {
  dawncleaver: { name: 'DAWNCLEAVER', dmg: '1d8', type: 'radiant', cat: 'martial', props: 'v', fam: 'sword', icon: 'wi_sword_3', cost: 950 },
  kingsfall: { name: 'KINGSFALL', dmg: '1d10', type: 'slashing', cat: 'martial', props: 'hv', fam: 'sword', icon: 'wi_sword_4', cost: 1450 },
  gravewhisper: { name: 'GRAVEWHISPER', dmg: '1d6', type: 'necrotic', cat: 'martial', props: 'f', fam: 'dagger', icon: 'wi_dagger_3', cost: 820 },
  moonshard: { name: 'MOONSHARD', dmg: '1d8', type: 'cold', cat: 'martial', props: 'f', fam: 'dagger', icon: 'wi_dagger_4', cost: 1100 },
  embermaul: { name: 'EMBERMAUL', dmg: '2d6', type: 'fire', cat: 'martial', props: 'h2', fam: 'hammer', icon: 'wi_hammer_3', cost: 1250 },
  titanwake: { name: 'TITANWAKE', dmg: '1d12', type: 'thunder', cat: 'martial', props: 'h2', fam: 'axe', icon: 'wi_axe_4', cost: 1600 },
  skybreaker: { name: 'SKYBREAKER', dmg: '1d10', type: 'lightning', cat: 'martial', props: 'h2', fam: 'polearm', icon: 'wi_polearm_3', cost: 1350 },
  briarshot: { name: 'BRIARSHOT', dmg: '1d8', type: 'piercing', cat: 'martial', props: 'r2', fam: 'bow', icon: 'wi_bow_3', cost: 980 },
  starfall: { name: 'STARFALL', dmg: '1d10', type: 'force', cat: 'martial', props: 'r2', fam: 'crossbow', icon: 'wi_crossbow_3', cost: 1180 },
  stormglass: { name: 'STORMGLASS', dmg: '1d8', type: 'lightning', cat: 'simple', props: 'lr', fam: 'wand', icon: 'wi_wand_3', cost: 900 },
  wintertide: { name: 'WINTERTIDE', dmg: '1d8', type: 'cold', cat: 'martial', props: 'v', fam: 'staff', icon: 'wi_staff_3', cost: 1050 },
  sunspire: { name: 'SUNSPIRE', dmg: '1d10', type: 'radiant', cat: 'martial', props: 'v', fam: 'staff', icon: 'wi_staff_4', cost: 1420 },
  duskfang: { name: 'DUSKFANG', dmg: '1d8', type: 'necrotic', cat: 'martial', props: 'f', fam: 'sword', icon: 'wi_sword_5', cost: 1320 },
  worldroot: { name: 'WORLDROOT', dmg: '1d8', type: 'bludgeoning', cat: 'martial', props: 'v', fam: 'mace', icon: 'wi_mace_3', cost: 880 },
  voidreaver: { name: 'VOIDREAVER', dmg: '2d6', type: 'force', cat: 'martial', props: 'h2', fam: 'scythe', icon: 'wi_scythe_4', cost: 1750 },
  runebinder: { name: 'RUNEBINDER', dmg: '1d8', type: 'psychic', cat: 'simple', props: 'l', fam: 'grimoire', icon: 'wi_grimoire_5', cost: 1550 }
};
const AELMOOR_ARMOUR_EXPANSION = {
  dawnforged: { name: 'DAWNFORGED CUIRASS', ac: 18, dexMax: 0, type: 'heavy', icon: 'ne_heavyarmor_5', cost: 1800 },
  graveveil: { name: 'GRAVEVEIL RAIMENT', ac: 12, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_5', cost: 1450 },
  frostbound: { name: 'FROSTBOUND MAIL', ac: 16, dexMax: 2, type: 'medium', icon: 'ne_mediumarmor_5', cost: 1650 },
  ashentyrant: { name: 'ASHEN TYRANT PLATE', ac: 18, dexMax: 0, type: 'heavy', icon: 'ne_heavyarmor_4', cost: 1950 },
  voidstalker: { name: 'VOIDSTALKER LEATHERS', ac: 12, dexMax: null, type: 'light', icon: 'ne_lightarmor_4', cost: 1550 },
  stormcaller: { name: 'STORMCALLER VESTMENTS', ac: 13, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_3', cost: 1500 },
  thornheart: { name: 'THORNHEART HIDE', ac: 13, dexMax: null, type: 'light', icon: 'ne_lightarmor_2', cost: 1480 },
  ironclad: { name: 'IRONCLAD BULWARK', ac: 18, dexMax: 0, type: 'heavy', icon: 'ne_heavyarmor_3', cost: 2050 },
  starfall: { name: 'STARFALL BATTLE ROBE', ac: 12, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_1', cost: 1720 },
  eclipse: { name: 'ECLIPSE REAVER ARMOUR', ac: 17, dexMax: 0, type: 'heavy', icon: 'ne_heavyarmor_2', cost: 2100 },
  emberguard: { name: 'EMBERGUARD SCALE', ac: 15, dexMax: 2, type: 'medium', icon: 'ne_mediumarmor_4', cost: 1580 },
  moonwoven: { name: 'MOONWOVEN SILKS', ac: 11, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_0', cost: 1380 }
};
if (typeof WEAPONS !== 'undefined') Object.assign(WEAPONS, AELMOOR_WEAPON_EXPANSION);
if (typeof ARMORS !== 'undefined') {
  Object.assign(ARMORS, AELMOOR_ARMOUR_EXPANSION);
  for (const key of Object.keys(AELMOOR_ARMOUR_EXPANSION)) {
    const item = ARMORS[key];
    item.aclass = item.type === 'light' ? 'leather' : item.type === 'medium' ? 'mail' : item.type === 'heavy' ? 'plate' : 'cloth';
  }
}
if (typeof globalThis !== 'undefined') globalThis.GBQGearCatalog = {
  weapons: AELMOOR_WEAPON_EXPANSION,
  armour: AELMOOR_ARMOUR_EXPANSION,
  weaponCount: Object.keys(AELMOOR_WEAPON_EXPANSION).length,
  armourCount: Object.keys(AELMOOR_ARMOUR_EXPANSION).length
};
