'use strict';
// ================================================================ FALLEN LEGENDS: NAMED WEAPONS, ARMOUR AND RELICS
// Original named gear in a grim, mournful dark-fantasy style: every piece is the last trace of someone who fell,
// told in one line of lore. Each item has a signature built from real affixes (lucky-hit effects act as its
// "weapon skill"), so everything listed here works in battle through the existing affix pipeline.
//   41 items: 16 weapons, 8 armours, 8 relics/talismans and 3 new three-piece legendary sets (9 pieces).
// Entries use the same shape as NAMED_ITEMS in items.js and drop through namedPoolFor / makeNamed:
//   src.act  arc boss of that act         src.raid  a boss of that raid     src.tower  a tower boss on that floor
//   src.cat  shared pool (world, dungeon, trial)                            src.minLvl  minimum foe level
// Affix values are the item-level-20 baseline; makeNamed scales them with item level and clamps to each cap.

const FALLEN_LEGENDS = [
  // ---- legendary set: THE LAST VIGIL (The Drowned Cathedral)
  { id: 'n_fl_vigilbell', name: 'TOLLING VIGIL', kind: 'weapon', base: 'flail', rarity: 6, setId: 'last_vigil', affixes: [['radiant', 14], ['lhStun', 3], ['heal', 4]], lore: 'Each toll is a name the sea took.', src: { raid: 'rd_cathedral' } },
  { id: 'n_fl_vigilshroud', name: 'SHROUD OF THE LAST VIGIL', kind: 'armor', base: 'banded_mail', rarity: 6, setId: 'last_vigil', affixes: [['hp', 70], ['resist', 8], ['healRecv', 6]], lore: 'Barnacles grew over the prayers sewn inside.', src: { raid: 'rd_cathedral' } },
  { id: 'n_fl_vigilhood', name: "DROWNED PENITENT'S HOOD", kind: 'wondrous', base: 'coif', rarity: 6, setId: 'last_vigil', affixes: [['wisdom', 2], ['lifeRegen', 4], ['resCold', 6]], lore: 'They knelt until the tide came in. They knelt after.', src: { raid: 'rd_cathedral' } },
  // ---- legendary set: BARROW OATH (The Barrow Kings)
  { id: 'n_fl_barrowblade', name: 'OATH OF THE BARROW KINGS', kind: 'weapon', base: 'claymore', rarity: 7, setId: 'barrow_oath', affixes: [['critdmg', 40], ['dmgElite', 12], ['lhBleed', 3]], lore: 'Seven kings swore on this blade. Seven lie beneath it.', src: { raid: 'rd_barrowkings' } },
  { id: 'n_fl_barrowplate', name: 'GRAVE-CROWNED PLATE', kind: 'armor', base: 'milanese_plate', rarity: 7, setId: 'barrow_oath', affixes: [['hp', 120], ['drElite', 3], ['acb', 2]], lore: 'It still expects to be buried.', src: { raid: 'rd_barrowkings' } },
  { id: 'n_fl_barrowhelm', name: 'HELM OF THE UNRESTING KING', kind: 'wondrous', base: 'armet', rarity: 7, setId: 'barrow_oath', affixes: [['strength', 2], ['lifeOnKill', 10], ['ccReduce', 6]], lore: 'The visor will not open. Do not ask what looks out.', src: { raid: 'rd_barrowkings' } },
  // ---- legendary set: ASHEN ECLIPSE (The Eclipse Court)
  { id: 'n_fl_eclipseglaive', name: "ECLIPSE-WIDOW'S GLAIVE", kind: 'weapon', base: 'naginata', rarity: 8, setId: 'ashen_eclipse', affixes: [['necrotic', 18], ['crit', 6], ['lhBlind', 2]], lore: 'She cut the sun from the sky to keep him in the dark.', src: { raid: 'rd_x9' } },
  { id: 'n_fl_eclipsemail', name: 'LAMELLAR OF THE CINDER COURT', kind: 'armor', base: 'do_maru', rarity: 8, setId: 'ashen_eclipse', affixes: [['hp', 110], ['resShadow', 4], ['dodge', 4]], lore: 'Every plate was a courtier. None were spared.', src: { raid: 'rd_x9' } },
  { id: 'n_fl_eclipsetear', name: 'TEAR OF THE DIMMED SUN', kind: 'wondrous', base: 'drop_earring', rarity: 8, setId: 'ashen_eclipse', affixes: [['critdmg', 30], ['luck', 2], ['lhVuln', 2]], lore: 'Hold it to the light and the light goes out.', src: { raid: 'rd_x9' } },

  // ---- weapons
  { id: 'n_fl_mournbrand', name: 'MOURNBRAND', kind: 'weapon', base: 'longsword', rarity: 5, affixes: [['lifeOnHit', 6], ['lhBleed', 4], ['dmgBleeding', 10]], lore: 'Forged to weep for its victims, since its owner would not.', src: { act: 2 } },
  { id: 'n_fl_pilgrimstaff', name: "THE PALE PILGRIM'S STAFF", kind: 'weapon', base: 'quarterstaff', rarity: 5, affixes: [['heal', 6], ['wisdom', 2], ['lhHeal', 4]], lore: 'It walked to the end of the world. It came back alone.', src: { act: 4 } },
  { id: 'n_fl_cinderwake', name: 'CINDERWAKE', kind: 'weapon', base: 'broad_axe', rarity: 5, affixes: [['fire', 16], ['lhBurn', 4], ['dmgBurning', 10]], lore: 'Where it falls, nothing grows for a hundred years.', src: { act: 5 } },
  { id: 'n_fl_witchmoth', name: 'WITCHMOTH SICKLE', kind: 'weapon', base: 'war_scythe', rarity: 5, affixes: [['poisonDmg', 16], ['lhPoison', 4], ['dmgPoisoned', 10]], lore: 'Moths gather where it has cut. They are hungry.', src: { act: 6 } },
  { id: 'n_fl_gallowsong', name: 'GALLOWSONG', kind: 'weapon', base: 'halberd', rarity: 6, affixes: [['dmgInjured', 14], ['lhExecute', 2], ['hit', 1]], lore: 'Hangmen hum while they work. This hums back.', src: { act: 7 } },
  { id: 'n_fl_quietheir', name: 'THE QUIET HEIR', kind: 'weapon', base: 'rapier', rarity: 6, affixes: [['crit', 7], ['critdmg', 30], ['dexterity', 2]], lore: 'The prince never spoke. His blade said enough.', src: { act: 9 } },
  { id: 'n_fl_houndfang', name: "STARVED HOUND'S FANG", kind: 'weapon', base: 'stiletto', rarity: 5, affixes: [['haste', 8], ['lhBleed', 4], ['leech', 3]], lore: 'It belonged to a dog that outlived its whole kingdom.', src: { cat: 'world' } },
  { id: 'n_fl_blightroot', name: 'BLIGHTROOT CUDGEL', kind: 'weapon', base: 'club', rarity: 4, affixes: [['hp', 30], ['lhWeaken', 4]], lore: 'A branch from the tree that ate the village.', src: { cat: 'dungeon' } },
  { id: 'n_fl_lanternless', name: 'LANTERNLESS', kind: 'weapon', base: 'heavy_crossbow', rarity: 6, affixes: [['dmgRanged', 14], ['lhBlind', 4], ['crit', 5]], lore: 'Made for hunting in the dark, by something that lived there.', src: { cat: 'trial' } },
  { id: 'n_fl_colossus', name: 'THE WEEPING COLOSSUS', kind: 'weapon', base: 'maul', rarity: 6, affixes: [['overpower', 20], ['lhStun', 4], ['strength', 2]], lore: "A giant's knucklebone, still clenched.", src: { raid: 'rd_stormhall' } },
  { id: 'n_fl_krakengut', name: 'KRAKEN-GUT STRING', kind: 'weapon', base: 'longbow', rarity: 6, affixes: [['lightning', 16], ['lhStun', 3], ['dmgRanged', 10]], lore: 'Strung with something that was still twitching.', src: { raid: 'rd_kraken' } },
  { id: 'n_fl_duskmourne', name: 'DUSKMOURNE', kind: 'weapon', base: 'katana', rarity: 7, affixes: [['crit', 6], ['critdmg', 35], ['lhVuln', 3]], lore: 'Its smith died at sunset. It has waited for one since.', src: { tower: 40 } },
  { id: 'n_fl_hymnofash', name: 'HYMN OF ASH', kind: 'weapon', base: 'sceptre', rarity: 7, affixes: [['dmgSpell', 14], ['intelligence', 2], ['cdr', 3]], lore: 'The choir burned singing. The song stayed in the metal.', src: { raid: 'rd_x8' } },
  { id: 'n_fl_gravemother', name: "GRAVEMOTHER'S GRIMOIRE", kind: 'weapon', base: 'bloodgrimoire', rarity: 7, affixes: [['necrotic', 16], ['leech', 3], ['dmgSpell', 10]], lore: 'Written in blood, for a child that never woke.', src: { cat: 'world', minLvl: 120 } },
  { id: 'n_fl_saintsbane', name: 'SAINTSBANE', kind: 'weapon', base: 'estoc', rarity: 8, affixes: [['necrotic', 18], ['dmgElite', 14], ['lhExecute', 2]], lore: 'It killed the last god who still listened.', src: { raid: 'rd_pantheon' } },
  { id: 'n_fl_firstlance', name: "THE FIRST KNIGHT'S LANCE", kind: 'weapon', base: 'lance', rarity: 8, affixes: [['physDmg', 18], ['overpower', 20], ['dmgHealthy', 12]], lore: 'The knight fell. The lance kept riding.', src: { raid: 'rd_x12' } },

  // ---- armour
  { id: 'n_fl_ashcloth', name: "PILGRIM'S ASHCLOTH", kind: 'armor', base: 'runevestment', rarity: 5, affixes: [['resist', 6], ['heal', 4], ['lifeRegen', 4]], lore: 'Grey with the dust of every road.', src: { act: 3 } },
  { id: 'n_fl_firstknight', name: 'HUSK OF THE FIRST KNIGHT', kind: 'armor', base: 'plate_armor', rarity: 6, affixes: [['hp', 80], ['dr', 2], ['ccReduce', 6]], lore: 'Empty for centuries. Still standing guard.', src: { act: 8 } },
  { id: 'n_fl_wolfskin', name: 'WOLFSKIN OF THE LAST HUNT', kind: 'armor', base: 'hide_armor', rarity: 5, affixes: [['dodge', 5], ['lifeOnKill', 10]], lore: 'The wolf won. The hunter wore it home anyway.', src: { cat: 'world' } },
  { id: 'n_fl_carrionmail', name: "CARRION KNIGHT'S MAIL", kind: 'armor', base: 'chainmail', rarity: 5, affixes: [['thorns', 10], ['drMelee', 3]], lore: 'Crows nest in it between wars.', src: { cat: 'dungeon' } },
  { id: 'n_fl_thornbride', name: 'THORNWED BRIDAL MAIL', kind: 'armor', base: 'brigandine', rarity: 6, affixes: [['thorns', 14], ['hp', 60], ['lhBleed', 3]], lore: 'She married the Thorn Court. It never let go.', src: { raid: 'rd_thorncourt' } },
  { id: 'n_fl_namelessveil', name: 'VEIL OF THE NAMELESS QUEEN', kind: 'armor', base: 'archmantle', rarity: 7, affixes: [['dodge', 5], ['dmgSpell', 12], ['resShadow', 4]], lore: 'No one remembers her face. The veil made sure.', src: { raid: 'rd_x6' } },
  { id: 'n_fl_starlesswatch', name: 'ARMOUR OF THE STARLESS WATCH', kind: 'armor', base: 'gothic_plate', rarity: 7, affixes: [['hp', 120], ['resist', 8], ['resShadow', 4]], lore: 'With no stars to steer by, the watch stood still.', src: { raid: 'rd_x17' } },
  { id: 'n_fl_brokenoath', name: 'BULWARK OF THE BROKEN OATH', kind: 'armor', base: 'tower_shield', rarity: 8, affixes: [['block', 6], ['acb', 2], ['drElite', 3]], lore: 'It held the gate nine days after its knight fell.', src: { raid: 'rd_x11' } },

  // ---- relics and talismans
  { id: 'n_fl_pilgrimbell', name: "CRACKED PILGRIM'S BELL", kind: 'wondrous', base: 'charm', rarity: 5, affixes: [['xp', 8], ['mf', 15]], lore: 'It rings once for every soul that turned back.', src: { act: 1 } },
  { id: 'n_fl_cinderlocket', name: "CINDER-SAINT'S LOCKET", kind: 'wondrous', base: 'pendant', rarity: 6, affixes: [['fire', 12], ['resFire', 6], ['barrierGen', 6]], lore: "A saint's last coal, still glowing for her.", src: { act: 10 } },
  { id: 'n_fl_exileboots', name: 'BOOTS OF THE LONG EXILE', kind: 'wondrous', base: 'poulaines', rarity: 6, affixes: [['moveSpeed', 6], ['haste', 6], ['dodge', 3]], lore: 'Every road leads away from home.', src: { act: 11 } },
  { id: 'n_fl_betrothed', name: 'RING OF THE DROWNED BETROTHED', kind: 'wondrous', base: 'ring', rarity: 6, affixes: [['healRecv', 8], ['lifeRegen', 4]], lore: 'Found on a finger. Only ever on a finger.', src: { cat: 'trial' } },
  { id: 'n_fl_hangedknot', name: "THE HANGED MAN'S KNOT", kind: 'wondrous', base: 'gorget', rarity: 5, affixes: [['dmgInjured', 10], ['lhExecute', 1]], lore: 'Untie it and someone, somewhere, falls.', src: { cat: 'dungeon' } },
  { id: 'n_fl_gravedigger', name: "GRAVEDIGGER'S GLOVES", kind: 'wondrous', base: 'gloves', rarity: 5, affixes: [['gf', 20], ['lifeOnKill', 8]], lore: 'Calloused from a thousand graves. Most were honest.', src: { cat: 'world' } },
  { id: 'n_fl_blindoracle', name: 'EYE OF THE BLIND ORACLE', kind: 'wondrous', base: 'circlet', rarity: 7, affixes: [['luck', 2], ['crit', 5], ['mf', 20]], lore: 'She saw everything once. She chose not to.', src: { tower: 60 } },
  { id: 'n_fl_unburied', name: 'SIGIL OF THE UNBURIED', kind: 'wondrous', base: 'torc', rarity: 8, affixes: [['allStats', 1], ['resist', 8], ['lifeOnKill', 12]], lore: 'For those the earth refused to keep.', src: { raid: 'rd_worldbreaker' } },
];

// three-piece legendary sets, same shape as LEGENDARY_SET_DEFS in armory.js (two- and three-piece bonuses)
const FALLEN_LEGEND_SETS = {
  last_vigil: { name: 'LAST VIGIL', pieces: ['n_fl_vigilbell', 'n_fl_vigilshroud', 'n_fl_vigilhood'], two: [['hp', 70], ['resist', 8]], three: [['heal', 15], ['lhChill', 6]] },
  barrow_oath: { name: 'BARROW OATH', pieces: ['n_fl_barrowblade', 'n_fl_barrowplate', 'n_fl_barrowhelm'], two: [['hp', 90], ['drElite', 6]], three: [['dmgElite', 25], ['lifeOnKill', 20]] },
  ashen_eclipse: { name: 'ASHEN ECLIPSE', pieces: ['n_fl_eclipseglaive', 'n_fl_eclipsemail', 'n_fl_eclipsetear'], two: [['necrotic', 20], ['crit', 6]], three: [['critdmg', 60], ['lhBlind', 6]] },
};

if (typeof globalThis !== 'undefined') globalThis.GBQFallenLegends = { FALLEN_LEGENDS, FALLEN_LEGEND_SETS };

// browser build: join the named-item drop pools and the legendary set list
if (typeof NAMED_ITEMS !== 'undefined' && typeof NAMED_BY_ID !== 'undefined') {
  for (const n of FALLEN_LEGENDS) if (!NAMED_BY_ID[n.id]) { NAMED_ITEMS.push(n); NAMED_BY_ID[n.id] = n; }
}
if (typeof LEGENDARY_SET_DEFS !== 'undefined') {
  for (const [id, set] of Object.entries(FALLEN_LEGEND_SETS)) if (!LEGENDARY_SET_DEFS[id]) LEGENDARY_SET_DEFS[id] = set;
}
