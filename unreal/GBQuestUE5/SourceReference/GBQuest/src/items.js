'use strict';
// ================================================================ ITEMS: rarity 1-9, medieval arms & armour, item ranks,
// named items, titles, and the loot / drop table system.
// Loaded after gen.js. Old saves stay valid: rarity indices 0-5 keep their meaning, old weapon/armour keys remain.

// ---------------------------------------------------------------- 9 rarity tiers (index 0-8 = tier 1-9)
RARITY.length = 0;
RARITY.push(
  { id: 'poor', n: 1, name: 'POOR', plus: -1, tag: '.', color: '#9d9d9d', value: 0.3, affixes: 0, maxPlus: 0 },
  { id: 'common', n: 2, name: 'COMMON', plus: 0, tag: ' ', color: '#ffffff', value: 1, affixes: 0, maxPlus: 1 },
  { id: 'uncommon', n: 3, name: 'UNCOMMON', plus: 1, tag: '+', color: '#1eff00', value: 5, affixes: 1, maxPlus: 2 },
  { id: 'rare', n: 4, name: 'RARE', plus: 2, tag: '*', color: '#0070dd', value: 20, affixes: 2, maxPlus: 3, attune: true },
  { id: 'epic', n: 5, name: 'EPIC', plus: 3, tag: '#', color: '#a335ee', value: 80, affixes: 3, maxPlus: 4, attune: true },
  { id: 'legendary', n: 6, name: 'LEGENDARY', plus: 3, tag: '!', color: '#ff8000', value: 300, affixes: 4, maxPlus: 5, attune: true },
  { id: 'mythic', n: 7, name: 'MYTHIC', plus: 4, tag: '%', color: '#e6264d', value: 900, affixes: 5, maxPlus: 6, attune: true },
  { id: 'ancestral', n: 8, name: 'ANCESTRAL', plus: 5, tag: '&', color: '#e6cc80', value: 2500, affixes: 6, maxPlus: 8, attune: true },
  { id: 'divine', n: 9, name: 'DIVINE', plus: 6, tag: '@', color: '#7fffd4', value: 8000, affixes: 7, maxPlus: 10, attune: true },
);
MAX_PLUS.length = 0; RARITY.forEach(r => MAX_PLUS.push(r.maxPlus));
const RARITY_GATE = [0, 0, 0, 0, 5, 8, 40, 100, 250]; // minimum item level for each tier to roll

// ---------------------------------------------------------------- item ranks (by item level): base-stat steps
// 23 gear tiers over item levels 1-720. Each tier adds flat weapon damage (+1.5 per tier) and,
// slowly, armour AC (+1 per 4 tiers, capped at +5) so d20 accuracy stays bounded.
const GEAR_TIER_NAMES = ['CRUDE', 'IRONBOUND', 'STEEL', 'TEMPERED', 'SILVERED', 'DUSKSTEEL', 'RUNEFORGED', 'MOONSILVER',
  'EMBERSTEEL', 'STORMFORGED', 'STARMETAL', 'DRAGONBONE', 'ADAMANT', 'ASTRAL', 'ABYSSAL', 'CELESTIAL', 'PRIMORDIAL',
  'ETERNAL', 'MYTHFORGED', 'WORLDSTONE', 'GODSTEEL', 'AETHERIC', 'DAWNFORGED'];
const GEAR_TIER_MIN = [1, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100, 125, 150, 180, 215, 255, 300, 350, 405, 465, 530, 600, 670];
const ITEM_RANKS = GEAR_TIER_NAMES.map((name, i) => ({ n: i + 1, min: GEAR_TIER_MIN[i], max: (GEAR_TIER_MIN[i + 1] || 721) - 1, name,
  dmg: Math.floor(i * 1.5), ac: Math.min(5, Math.floor(i / 4)) }));
const GEAR_TIERS = ITEM_RANKS;
const ROMAN = (() => { const r = ['']; for (let n = 1; n <= 30; n++) { let s = '', x = n; for (const [v, l] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (x >= v) { s += l; x -= v; } r.push(s); } return r; })();
const tierDmg = it => (ITEM_RANKS[(it && it.rank || 1) - 1] || ITEM_RANKS[0]).dmg;
const tierAC = it => (ITEM_RANKS[(it && it.rank || 1) - 1] || ITEM_RANKS[0]).ac;
// re-tier every owned item from its item level (saves from the old 7-rank scheme)
function retierGear() {
  const fix = it => { if (it && it.ilvl && (it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'wondrous')) { it.ilvl = clampGearLevel(it.ilvl); it.rank = rankFor(it.ilvl).n; applyGearProgression(it); } };
  if (!G) return;
  [G, ...(G.companions || []), ...(G.bench || [])].forEach(c => { Object.values(c.eq || {}).forEach(fix); (c.bag || []).forEach(fix); });
  const st = G.stash; if (st && Array.isArray(st.tabs)) st.tabs.forEach(t => (t.items || t || []).forEach && (t.items || t).forEach(fix));
}
const rankFor = ilvl => ITEM_RANKS.filter(r => ilvl >= r.min).pop() || ITEM_RANKS[0];
const ADVENTURER_RANKS = Object.freeze(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
const GEAR_STAR_MAX = 12;
const GEAR_ITEM_LEVEL_MAX = 720;
const clampGearLevel = value => Math.max(1, Math.min(GEAR_ITEM_LEVEL_MAX, Math.floor(Number(value) || 1)));
function gearProgressionFor(ilvl, rarity = 0) {
  const level = clampGearLevel(ilvl);
  // 720 item levels are evenly distributed over 9 ranks x 12 stars.
  const step = Math.min(107, Math.floor(((level - 1) * 108) / GEAR_ITEM_LEVEL_MAX));
  const rankIndex = Math.floor(step / GEAR_STAR_MAX);
  const starLevel = (step % GEAR_STAR_MAX) + 1;
  const gearLevel = Math.min(9999, Math.max(1, Math.round(1 + ((level - 1) / 719) * 9998)));
  const rarityIndex = Math.max(0, Math.min(8, Math.floor(Number(rarity) || 0)));
  const basePower = 1 + ((level - 1) / 719) * 999998;
  const powerLevel = Math.min(999999, Math.max(1, Math.round(basePower * (1 + rarityIndex * 0.003 + (starLevel - 1) * 0.001))));
  return { gearLevel, powerLevel, adventurerRank: ADVENTURER_RANKS[rankIndex], rankIndex: rankIndex + 1, starLevel };
}
function applyGearProgression(item) {
  if (!item || !['weapon', 'armor', 'wondrous'].includes(item.kind)) return item;
  const p = gearProgressionFor(item.ilvl, item.rarity);
  item.gearLevel = p.gearLevel;
  item.powerLevel = p.powerLevel;
  item.adventurerRank = p.adventurerRank;
  item.rankIndex = p.rankIndex;
  item.starLevel = p.starLevel;
  return item;
}
const formatGearLevel = item => String(Math.max(1, Math.min(9999, Math.floor(Number(item && item.gearLevel) || 1)))).padStart(4, '0');
const formatPowerLevel = item => String(Math.max(1, Math.min(999999, Math.floor(Number(item && item.powerLevel) || 1)))).padStart(6, '0');


// ---------------------------------------------------------------- the medieval armoury
// props: l light, f finesse, t thrown, v versatile (vdmg), h heavy, 2 two-handed, r ranged. fam = art family.
const WPN = (name, dmg, type, cat, props, fam, cost, extra = {}) => ({ name, dmg, type, cat, props, fam, icon: { sword: 'item_iron_sword', dagger: 'item_dagger', axe: 'px_axe', mace: 'px_mace', polearm: 'px_spear', bow: 'px_bow', crossbow: 'px_bow', staff: 'px_staff', wand: 'px_staff', thrown: 'item_dagger' }[fam] || 'item_iron_sword', cost, ...extra });
Object.assign(WEAPONS, {
  // swords
  arming_sword: WPN('ARMING SWORD', '1d8', 'slashing', 'martial', 'v', 'sword', 15, { vdmg: '1d10' }),
  longsword: WPN('LONGSWORD', '1d8', 'slashing', 'martial', 'v', 'sword', 15, { vdmg: '1d10' }),
  bastard_sword: WPN('BASTARD SWORD', '1d10', 'slashing', 'martial', 'v', 'sword', 30, { vdmg: '1d12' }),
  broadsword: WPN('BROADSWORD', '1d8', 'slashing', 'martial', '', 'sword', 20),
  falchion: WPN('FALCHION', '1d8', 'slashing', 'martial', '', 'sword', 18),
  messer: WPN('MESSER', '1d8', 'slashing', 'martial', '', 'sword', 16),
  scimitar: WPN('SCIMITAR', '1d6', 'slashing', 'martial', 'fl', 'sword', 25),
  sabre: WPN('SABRE', '1d8', 'slashing', 'martial', 'f', 'sword', 25),
  rapier: WPN('RAPIER', '1d8', 'piercing', 'martial', 'f', 'sword', 25),
  estoc: WPN('ESTOC', '1d10', 'piercing', 'martial', 'h2', 'sword', 40),
  gladius: WPN('GLADIUS', '1d6', 'piercing', 'martial', 'l', 'sword', 10),
  spatha: WPN('SPATHA', '1d8', 'slashing', 'martial', '', 'sword', 15),
  shamshir: WPN('SHAMSHIR', '1d8', 'slashing', 'martial', 'f', 'sword', 30),
  tulwar: WPN('TULWAR', '1d8', 'slashing', 'martial', '', 'sword', 20),
  jian: WPN('JIAN', '1d8', 'slashing', 'martial', 'f', 'sword', 30),
  dao: WPN('DAO', '1d8', 'slashing', 'martial', '', 'sword', 20),
  katana: WPN('KATANA', '1d8', 'slashing', 'martial', 'fv', 'sword', 60, { vdmg: '1d10' }),
  tachi: WPN('TACHI', '1d10', 'slashing', 'martial', 'v', 'sword', 60, { vdmg: '1d12' }),
  wakizashi: WPN('WAKIZASHI', '1d6', 'slashing', 'martial', 'fl', 'sword', 30),
  claymore: WPN('CLAYMORE', '2d6', 'slashing', 'martial', 'h2', 'sword', 50),
  zweihander: WPN('ZWEIHANDER', '2d6', 'slashing', 'martial', 'h2', 'sword', 60),
  flamberge: WPN('FLAMBERGE', '2d6', 'slashing', 'martial', 'h2', 'sword', 70),
  khopesh: WPN('KHOPESH', '1d8', 'slashing', 'martial', '', 'sword', 25),
  // daggers
  dagger: WPN('DAGGER', '1d4', 'piercing', 'simple', 'flt', 'dagger', 2),
  rondel: WPN('RONDEL DAGGER', '1d4', 'piercing', 'simple', 'fl', 'dagger', 4),
  stiletto: WPN('STILETTO', '1d4', 'piercing', 'simple', 'fl', 'dagger', 5),
  misericorde: WPN('MISERICORDE', '1d6', 'piercing', 'martial', 'fl', 'dagger', 8),
  dirk: WPN('DIRK', '1d4', 'piercing', 'simple', 'flt', 'dagger', 3),
  seax: WPN('SEAX', '1d6', 'slashing', 'simple', 'l', 'dagger', 5),
  baselard: WPN('BASELARD', '1d6', 'piercing', 'martial', 'fl', 'dagger', 8),
  kukri: WPN('KUKRI', '1d6', 'slashing', 'martial', 'l', 'dagger', 8),
  tanto: WPN('TANTO', '1d4', 'piercing', 'simple', 'fl', 'dagger', 6),
  katar: WPN('KATAR', '1d6', 'piercing', 'martial', 'fl', 'dagger', 10),
  sai: WPN('SAI', '1d4', 'piercing', 'simple', 'fl', 'dagger', 4),
  // axes
  hand_axe: WPN('HAND AXE', '1d6', 'slashing', 'simple', 'lt', 'axe', 5),
  bearded_axe: WPN('BEARDED AXE', '1d8', 'slashing', 'martial', 'v', 'axe', 12, { vdmg: '1d10' }),
  battle_axe: WPN('BATTLE AXE', '1d8', 'slashing', 'martial', 'v', 'axe', 10, { vdmg: '1d10' }),
  dane_axe: WPN('DANE AXE', '1d12', 'slashing', 'martial', 'h2', 'axe', 30),
  broad_axe: WPN('BROAD AXE', '1d10', 'slashing', 'martial', 'h2', 'axe', 25),
  francisca: WPN('FRANCISCA', '1d6', 'slashing', 'martial', 'lt', 'thrown', 8),
  sagaris: WPN('SAGARIS', '1d8', 'slashing', 'martial', '', 'axe', 12),
  // maces, hammers, flails, picks
  club: WPN('CLUB', '1d4', 'bludgeoning', 'simple', 'l', 'mace', 1),
  mace: WPN('MACE', '1d6', 'bludgeoning', 'simple', '', 'mace', 5),
  flanged_mace: WPN('FLANGED MACE', '1d8', 'bludgeoning', 'martial', '', 'mace', 15),
  morning_star: WPN('MORNING STAR', '1d8', 'piercing', 'martial', '', 'mace', 15),
  flail: WPN('FLAIL', '1d8', 'bludgeoning', 'martial', '', 'mace', 10),
  war_flail: WPN('WAR FLAIL', '2d6', 'bludgeoning', 'martial', 'h2', 'mace', 30),
  war_hammer: WPN('WAR HAMMER', '1d8', 'bludgeoning', 'martial', 'v', 'mace', 15, { vdmg: '1d10' }),
  maul: WPN('MAUL', '2d6', 'bludgeoning', 'martial', 'h2', 'mace', 10),
  lucerne_hammer: WPN('LUCERNE HAMMER', '1d10', 'piercing', 'martial', 'h2', 'polearm', 35),
  war_pick: WPN('WAR PICK', '1d8', 'piercing', 'martial', '', 'mace', 5),
  horsemans_pick: WPN("HORSEMAN'S PICK", '1d8', 'piercing', 'martial', 'v', 'mace', 12, { vdmg: '1d10' }),
  quarterstaff: WPN('QUARTERSTAFF', '1d6', 'bludgeoning', 'simple', 'v', 'staff', 1, { vdmg: '1d8' }),
  // polearms
  spear: WPN('SPEAR', '1d6', 'piercing', 'simple', 'tv', 'polearm', 1, { vdmg: '1d8' }),
  pike: WPN('PIKE', '1d10', 'piercing', 'martial', 'h2', 'polearm', 5),
  glaive: WPN('GLAIVE', '1d10', 'slashing', 'martial', 'h2', 'polearm', 20),
  halberd: WPN('HALBERD', '1d10', 'slashing', 'martial', 'h2', 'polearm', 20),
  bardiche: WPN('BARDICHE', '1d12', 'slashing', 'martial', 'h2', 'polearm', 25),
  guisarme: WPN('GUISARME', '1d10', 'slashing', 'martial', 'h2', 'polearm', 18),
  partisan: WPN('PARTISAN', '1d10', 'piercing', 'martial', 'h2', 'polearm', 20),
  ranseur: WPN('RANSEUR', '2d4', 'piercing', 'martial', 'h2', 'polearm', 20),
  voulge: WPN('VOULGE', '2d4', 'slashing', 'martial', 'h2', 'polearm', 15),
  billhook: WPN('BILLHOOK', '1d10', 'slashing', 'martial', 'h2', 'polearm', 12),
  lance: WPN('LANCE', '1d12', 'piercing', 'martial', 'h', 'polearm', 10),
  trident: WPN('TRIDENT', '1d6', 'piercing', 'martial', 'tv', 'polearm', 5, { vdmg: '1d8' }),
  naginata: WPN('NAGINATA', '1d10', 'slashing', 'martial', 'h2', 'polearm', 30),
  guandao: WPN('GUANDAO', '1d12', 'slashing', 'martial', 'h2', 'polearm', 35),
  war_scythe: WPN('WAR SCYTHE', '2d4', 'slashing', 'martial', 'h2', 'polearm', 18),
  // bows, crossbows, slings, thrown
  shortbow: WPN('SHORTBOW', '1d6', 'piercing', 'simple', 'r2', 'bow', 25),
  longbow: WPN('LONGBOW', '1d8', 'piercing', 'martial', 'rh2', 'bow', 50),
  composite_bow: WPN('COMPOSITE BOW', '1d8', 'piercing', 'martial', 'r2', 'bow', 75),
  yumi: WPN('YUMI', '1d8', 'piercing', 'martial', 'rh2', 'bow', 60),
  light_crossbow: WPN('LIGHT CROSSBOW', '1d8', 'piercing', 'simple', 'r2', 'crossbow', 25),
  heavy_crossbow: WPN('HEAVY CROSSBOW', '1d10', 'piercing', 'martial', 'rh2', 'crossbow', 50),
  arbalest: WPN('ARBALEST', '1d12', 'piercing', 'martial', 'rh2', 'crossbow', 90),
  hand_crossbow: WPN('HAND CROSSBOW', '1d6', 'piercing', 'martial', 'rl', 'crossbow', 75),
  sling: WPN('SLING', '1d4', 'bludgeoning', 'simple', 'r', 'thrown', 1),
  javelin: WPN('JAVELIN', '1d6', 'piercing', 'simple', 't', 'thrown', 1),
  throwing_knife: WPN('THROWING KNIVES', '1d4', 'piercing', 'simple', 'rfl', 'thrown', 3),
  chakram: WPN('CHAKRAM', '1d6', 'slashing', 'martial', 'rfl', 'thrown', 10),
  // caster foci
  rod: WPN('ROD', '1d6', 'bludgeoning', 'simple', '', 'wand', 10, { focus: true }),
  wand: WPN('WAND', '1d4', 'bludgeoning', 'simple', 'l', 'wand', 10, { focus: true }),
  sceptre: WPN('SCEPTRE', '1d6', 'bludgeoning', 'simple', '', 'wand', 25, { focus: true }),
  crozier: WPN('CROZIER', '1d6', 'bludgeoning', 'simple', 'v', 'staff', 20, { vdmg: '1d8', focus: true }),
});
// original fantasy weapons keep their families for art
Object.assign(WEAPONS.cudgel, { fam: 'mace' }); Object.assign(WEAPONS.knife, { fam: 'dagger' }); Object.assign(WEAPONS.hatchet, { fam: 'axe' }); Object.assign(WEAPONS.shortspear, { fam: 'polearm' });
Object.assign(WEAPONS.walkstaff, { fam: 'staff' }); Object.assign(WEAPONS.knobmace, { fam: 'mace' }); Object.assign(WEAPONS.huntbow, { fam: 'bow' }); Object.assign(WEAPONS.boltcaster, { fam: 'crossbow' });
for (const k of ['longbrand', 'widesword', 'needleblade']) WEAPONS[k].fam = 'sword'; WEAPONS.crescent.fam = 'dagger'; WEAPONS.cleaver.fam = 'axe';
for (const k of ['stonemaul', 'ironhammer']) WEAPONS[k].fam = 'mace'; WEAPONS.poleblade.fam = 'polearm'; WEAPONS.greatbow.fam = 'bow';

const ARM = (name, ac, dexMax, type, cost, extra = {}) => ({ name, ac, dexMax, type, icon: type === 'light' ? 'item_leather_armor' : type === 'shield' ? 'icon_0_1' : 'icon_0_2', cost, ...extra });
Object.assign(ARMORS, {
  gambeson: ARM('GAMBESON', 11, null, 'light', 5), leather_jerkin: ARM('LEATHER JERKIN', 11, null, 'light', 10), cuir_bouilli: ARM('CUIR BOUILLI', 12, null, 'light', 40),
  brigandine_vest: ARM('JACK OF PLATES', 12, null, 'light', 50), silk_robe: ARM('SILKEN ROBE', 11, null, 'light', 30),
  hide_armor: ARM('HIDE ARMOUR', 12, 2, 'medium', 10), chain_shirt: ARM('CHAIN SHIRT', 13, 2, 'medium', 50), ring_mail: ARM('RING MAIL', 13, 2, 'medium', 30),
  scale_mail: ARM('SCALE MAIL', 14, 2, 'medium', 50, { stealthDis: true }), lamellar: ARM('LAMELLAR', 14, 2, 'medium', 80), brigandine: ARM('BRIGANDINE', 14, 2, 'medium', 120),
  breastplate: ARM('BREASTPLATE', 14, 2, 'medium', 400), coat_of_plates: ARM('COAT OF PLATES', 15, 2, 'medium', 600, { stealthDis: true }), do_maru: ARM('DO-MARU', 15, 2, 'medium', 700),
  half_plate: ARM('HALF PLATE', 15, 2, 'medium', 750, { stealthDis: true }),
  chainmail: ARM('CHAINMAIL HAUBERK', 16, 0, 'heavy', 75, { stealthDis: true, str: 13 }), banded_mail: ARM('BANDED MAIL', 17, 0, 'heavy', 200, { stealthDis: true, str: 15 }),
  splint_mail: ARM('SPLINT MAIL', 17, 0, 'heavy', 200, { stealthDis: true, str: 15 }), o_yoroi: ARM('O-YOROI', 17, 0, 'heavy', 900, { stealthDis: true, str: 14 }),
  plate_armor: ARM('PLATE ARMOUR', 18, 0, 'heavy', 1500, { stealthDis: true, str: 15 }), gothic_plate: ARM('GOTHIC PLATE', 18, 0, 'heavy', 2500, { stealthDis: true, str: 15 }),
  milanese_plate: ARM('MILANESE PLATE', 18, 0, 'heavy', 2500, { stealthDis: true, str: 15 }), maximilian_plate: ARM('FLUTED PLATE', 19, 0, 'heavy', 6000, { stealthDis: true, str: 16 }),
  round_shield: ARM('ROUND SHIELD', 2, null, 'shield', 10), heater_shield: ARM('HEATER SHIELD', 2, null, 'shield', 15), kite_shield: ARM('KITE SHIELD', 2, null, 'shield', 20),
  targe: ARM('TARGE', 2, null, 'shield', 12), scutum: ARM('SCUTUM', 2, null, 'shield', 25), pavise: ARM('PAVISE', 3, null, 'shield', 40, { str: 15 }), tower_shield: ARM('TOWER SHIELD', 3, null, 'shield', 50, { str: 15 }),
});
// more wondrous pieces (head, neck, back, hands, waist, legs, feet)
WONDROUS.push(
  { id: 'great_helm', name: 'GREAT HELM', slot: 'head', bonus: 'ac' }, { id: 'bascinet', name: 'BASCINET', slot: 'head', bonus: 'ac' }, { id: 'sallet', name: 'SALLET', slot: 'head', bonus: 'init' },
  { id: 'barbute', name: 'BARBUTE', slot: 'head', bonus: 'save' }, { id: 'armet', name: 'ARMET', slot: 'head', bonus: 'ac' }, { id: 'kettle_hat', name: 'KETTLE HAT', slot: 'head', bonus: 'hp' },
  { id: 'nasal_helm', name: 'NASAL HELM', slot: 'head', bonus: 'hit' }, { id: 'coif', name: 'MAIL COIF', slot: 'head', bonus: 'save' }, { id: 'kabuto', name: 'KABUTO', slot: 'head', bonus: 'abil' },
  { id: 'gorget', name: 'GORGET', slot: 'neck', bonus: 'ac' }, { id: 'torc', name: 'TORC', slot: 'neck', bonus: 'abil' },
  { id: 'tabard', name: 'TABARD', slot: 'back', bonus: 'hp' }, { id: 'surcoat', name: 'SURCOAT', slot: 'back', bonus: 'save' }, { id: 'pauldrons', name: 'PAULDRONS', slot: 'back', bonus: 'ac' },
  { id: 'mitten_gauntlets', name: 'MITTEN GAUNTLETS', slot: 'hands', bonus: 'ac' }, { id: 'vambraces', name: 'VAMBRACES', slot: 'hands', bonus: 'hit' }, { id: 'bracers', name: 'BRACERS', slot: 'hands', bonus: 'init' },
  { id: 'baldric', name: 'BALDRIC', slot: 'waist', bonus: 'hit' }, { id: 'faulds', name: 'FAULDS', slot: 'waist', bonus: 'ac' },
  { id: 'chausses', name: 'CHAUSSES', slot: 'legs', bonus: 'hp' }, { id: 'cuisses', name: 'CUISSES', slot: 'legs', bonus: 'ac' },
  { id: 'poulaines', name: 'POULAINES', slot: 'feet', bonus: 'init' }, { id: 'riding_boots', name: 'RIDING BOOTS', slot: 'feet', bonus: 'save' },
  // earrings (EARRINGS slot)
  { id: 'earring', name: 'EARRINGS', slot: 'ear', bonus: 'init' }, { id: 'ear_cuff', name: 'EAR CUFF', slot: 'ear', bonus: 'save' }, { id: 'drop_earring', name: 'DROP EARRINGS', slot: 'ear', bonus: 'abil' },
);
WONDROUS.forEach(w => { if (!w.icon) w.icon = { head: 'item_iron_helm', neck: 'px_orb', back: 'icon_0_2', hands: 'icon_0_1', waist: 'icon_1_4', legs: 'icon_0_2', feet: 'item_boots', ring: 'icon_0_5' }[w.slot] || 'icon_0_5'; });
Object.assign(WONDROUS_ART, { great_helm: 'heavyarmor', bascinet: 'heavyarmor', sallet: 'mediumarmor', barbute: 'heavyarmor', armet: 'heavyarmor', kettle_hat: 'mediumarmor', nasal_helm: 'mediumarmor', coif: 'mediumarmor', kabuto: 'heavyarmor',
  gorget: 'amulet', torc: 'amulet', tabard: 'lightarmor', surcoat: 'lightarmor', pauldrons: 'heavyarmor', mitten_gauntlets: 'glove', vambraces: 'glove', bracers: 'glove', baldric: 'belt', faulds: 'belt', chausses: 'mediumarmor', cuisses: 'heavyarmor', poulaines: 'boots', riding_boots: 'boots', earring: 'ring', ear_cuff: 'ring', drop_earring: 'amulet' });

// ---------------------------------------------------------------- named (unique) items
// fixed name, base, rarity, affixes and a line of lore; each has drop sources (boss ids or categories)
const NAMED_ITEMS = [
  // act signatures (arc bosses)
  { id: 'n_gruk_crown', name: "GRUK'S IRON CROWN", kind: 'wondrous', base: 'great_helm', rarity: 5, affixes: [['hp', 30], ['acb', 1]], lore: 'Too big for any goblin. He wore it anyway.', src: { act: 1 } },
  { id: 'n_mirewarden', name: 'MIREWARDEN', kind: 'weapon', base: 'trident', rarity: 5, affixes: [['crit', 6], ['hit', 1]], lore: 'Still dripping with marsh water.', src: { act: 2 } },
  { id: 'n_rimefang', name: 'RIMEFANG', kind: 'weapon', base: 'katana', rarity: 5, affixes: [['crit', 8], ['critdmg', 25]], lore: 'Frost forms on the blade even in summer.', src: { act: 3 } },
  { id: 'n_sandking', name: "SANDKING'S SCIMITAR", kind: 'weapon', base: 'scimitar', rarity: 5, affixes: [['haste', 10], ['gf', 20]], lore: 'Every grain of the desert answers it.', src: { act: 4 } },
  { id: 'n_emberheart', name: 'EMBERHEART PLATE', kind: 'armor', base: 'gothic_plate', rarity: 5, affixes: [['hp', 60], ['resist', 10]], lore: 'Forged in a volcano, cooled in dragon blood.', src: { act: 5 } },
  { id: 'n_thornveil', name: 'THORNVEIL', kind: 'wondrous', base: 'cloak', rarity: 5, affixes: [['dodge', 6], ['thorns', 8]], lore: 'The forest lent it thorns.', src: { act: 6 } },
  { id: 'n_skyshard', name: 'SKYSHARD BOW', kind: 'weapon', base: 'composite_bow', rarity: 5, affixes: [['hit', 2], ['crit', 6]], lore: 'Its arrows fall like stars.', src: { act: 7 } },
  { id: 'n_rimequeen', name: "THE RIME QUEEN'S BAND", kind: 'wondrous', base: 'band', rarity: 5, affixes: [['dmg', 15], ['resist', 1]], lore: 'Cold as her heart, bright as her crown.', src: { act: 8 } },
  { id: 'n_duskreaver', name: 'DUSKREAVER', kind: 'weapon', base: 'dane_axe', rarity: 6, affixes: [['critdmg', 40], ['leech', 4]], lore: 'It drinks the last light of evening.', src: { act: 9 } },
  { id: 'n_voidplate', name: 'VOIDWOVEN MAIL', kind: 'armor', base: 'splint_mail', rarity: 6, affixes: [['hp', 90], ['acb', 2]], lore: 'Links of nothing, bound by will.', src: { act: 10 } },
  { id: 'n_lanternkeeper', name: 'LANTERNKEEPER', kind: 'weapon', base: 'crozier', rarity: 6, affixes: [['dmg', 25], ['heal', 3]], lore: 'It holds a flame from the first lantern.', src: { act: 11 } },
  { id: 'n_codexblade', name: 'BLADE OF THE CODEX', kind: 'weapon', base: 'zweihander', rarity: 7, affixes: [['critdmg', 60], ['hit', 3], ['leech', 5]], lore: 'Every school of magic, written in steel.', src: { act: 12 } },
  // raids
  { id: 'n_bonelord', name: "BONELORD'S MANTLE", kind: 'wondrous', base: 'pauldrons', rarity: 6, setId: 'crypt_warden', affixes: [['acb', 2], ['hp', 50]], lore: 'Stitched from the crypt kings.', src: { raid: 'rd_crypt' } },
  { id: 'n_forgefire', name: 'FORGEFIRE MAUL', kind: 'weapon', base: 'maul', rarity: 6, setId: 'forgefire', affixes: [['critdmg', 45], ['dmg', 10]], lore: 'The heart of embers beats inside it.', src: { raid: 'rd_forge' } },
  { id: 'n_glacier', name: 'GLACIER AEGIS', kind: 'armor', base: 'tower_shield', rarity: 6, setId: 'rime_throne', affixes: [['acb', 3], ['resist', 15]], lore: 'A slab of the Rime Throne itself.', src: { raid: 'rd_palace' } },
  { id: 'n_longnight', name: 'THE LONG NIGHT', kind: 'weapon', base: 'flamberge', rarity: 7, setId: 'long_night', affixes: [['critdmg', 70], ['crit', 8], ['leech', 6]], lore: 'Dawn never came for its last owner.', src: { raid: 'rd_dusk' } },
  { id: 'n_drowned', name: 'DROWNED CROWN', kind: 'wondrous', base: 'circlet', rarity: 7, affixes: [['dmg', 35], ['resist', 2]], lore: 'Pulled from the sea floor, still singing.', src: { raid: 'rd_x1' } },
  { id: 'n_choir', name: 'ABYSSAL CHOIR', kind: 'wondrous', base: 'torc', rarity: 7, affixes: [['dmg', 40], ['heal', 4]], lore: 'You can hear them if you hold it close.', src: { raid: 'rd_x2' } },
  { id: 'n_winds', name: 'THRONE OF WINDS', kind: 'weapon', base: 'yumi', rarity: 8, affixes: [['hit', 4], ['crit', 10], ['haste', 15]], lore: 'The wind itself draws the string.', src: { raid: 'rd_x3' } },
  { id: 'n_starfall', name: 'STARFALL', kind: 'weapon', base: 'bastard_sword', rarity: 8, affixes: [['critdmg', 90], ['hit', 4], ['leech', 7]], lore: 'It fell burning from the sky.', src: { raid: 'rd_x4' } },
  { id: 'n_ascendant', name: 'THE ASCENDANT', kind: 'armor', base: 'maximilian_plate', rarity: 8, affixes: [['hp', 200], ['acb', 4], ['resist', 20]], lore: 'Worn by the first who climbed to the top.', src: { raid: 'rd_x5' } },
  // additional legendary raid-set pieces
  { id: 'n_cryptseal', name: 'SEAL OF THE DEEP CRYPT', kind: 'wondrous', base: 'torc', rarity: 6, setId: 'crypt_warden', affixes: [['resist', 12], ['hp', 80]], lore: 'The dead obey its quiet command.', src: { raid: 'rd_crypt' } },
  { id: 'n_cryptwarden', name: 'CRYPT WARDEN PLATE', kind: 'armor', base: 'splint_mail', rarity: 7, setId: 'crypt_warden', affixes: [['hp', 140], ['acb', 2], ['resist', 12]], lore: 'The last shield between the living and the crypt.', src: { raid: 'rd_crypt' } },
  { id: 'n_forgeheart', name: 'HEART OF THE FORGE', kind: 'armor', base: 'maximilian_plate', rarity: 7, setId: 'forgefire', affixes: [['hp', 160], ['fire', 20], ['thorns', 20]], lore: 'Still warm after a thousand winters.', src: { raid: 'rd_forge' } },
  { id: 'n_embergrip', name: 'EMBERGRIP', kind: 'wondrous', base: 'vambraces', rarity: 6, setId: 'forgefire', affixes: [['dmg', 28], ['fire', 18]], lore: 'The forge answers its wearer.', src: { raid: 'rd_forge' } },
  { id: 'n_frostmantle', name: 'MANTLE OF THE RIME THRONE', kind: 'wondrous', base: 'pauldrons', rarity: 7, setId: 'rime_throne', affixes: [['cold', 24], ['resist', 18], ['hp', 100]], lore: 'A blizzard follows every footstep.', src: { raid: 'rd_palace' } },
  { id: 'n_icebound', name: 'ICEBOUND OATH', kind: 'weapon', base: 'longsword', rarity: 7, setId: 'rime_throne', affixes: [['cold', 28], ['crit', 8], ['hit', 3]], lore: 'Its edge remembers the first frost.', src: { raid: 'rd_palace' } },
  { id: 'n_duskguard', name: 'DUSKGUARD', kind: 'armor', base: 'plate_armor', rarity: 7, setId: 'long_night', affixes: [['hp', 150], ['crit', 6], ['resist', 14]], lore: 'Armour for the final watch.', src: { raid: 'rd_dusk' } },
  { id: 'n_voidedge', name: 'VOID EDGE', kind: 'wondrous', base: 'gorget', rarity: 7, setId: 'long_night', affixes: [['critdmg', 55], ['leech', 8], ['crit', 8]], lore: 'The night cuts both ways.', src: { raid: 'rd_dusk' } },
  // tower
  { id: 'n_spirekey', name: 'KEY OF THE SPIRE', kind: 'wondrous', base: 'pendant', rarity: 6, affixes: [['gf', 30], ['mf', 30]], lore: 'Opens doors that are not there.', src: { tower: 50 } },
  { id: 'n_hundred', name: 'CROWN OF A HUNDRED', kind: 'wondrous', base: 'kabuto', rarity: 8, affixes: [['hp', 250], ['resist', 3], ['acb', 3]], lore: 'For those who stood on the hundredth floor.', src: { tower: 100 } },
  // world bosses (shared pool)
  { id: 'n_wanderer', name: "WANDERER'S BOOTS", kind: 'wondrous', base: 'riding_boots', rarity: 5, affixes: [['haste', 12], ['dodge', 5]], lore: 'They know every road in Valendria.', src: { cat: 'world' } },
  { id: 'n_bloodfang', name: 'BLOODFANG', kind: 'weapon', base: 'kukri', rarity: 5, affixes: [['leech', 5], ['crit', 6]], lore: 'Bitten into a hundred hides.', src: { cat: 'world' } },
  { id: 'n_oathkeeper', name: 'OATHKEEPER', kind: 'weapon', base: 'longsword', rarity: 6, affixes: [['hit', 2], ['resist', 2], ['heal', 2]], lore: 'It will not be drawn for a lie.', src: { cat: 'world' } },
  { id: 'n_gilded', name: 'GILDED GAUNTLETS', kind: 'wondrous', base: 'mitten_gauntlets', rarity: 5, affixes: [['gf', 40], ['acb', 1]], lore: 'Every punch pays.', src: { cat: 'world' } },
  { id: 'n_hearthguard', name: 'HEARTHGUARD', kind: 'armor', base: 'kite_shield', rarity: 5, affixes: [['acb', 2], ['hp', 40]], lore: 'The shield of a village that never fell.', src: { cat: 'world' } },
  { id: 'n_godslayer', name: 'GODSLAYER', kind: 'weapon', base: 'guandao', rarity: 8, affixes: [['critdmg', 120], ['dmg', 25], ['hit', 5]], lore: 'Nobody remembers which god.', src: { cat: 'world', minLvl: 200 } },
  // dungeons / trials (shared pools)
  { id: 'n_keepers', name: "KEEPER'S RONDEL", kind: 'weapon', base: 'rondel', rarity: 4, affixes: [['crit', 5], ['hit', 1]], lore: 'Every dungeon keeper carries one.', src: { cat: 'dungeon' } },
  { id: 'n_delver', name: "DELVER'S LANTERN BELT", kind: 'wondrous', base: 'baldric', rarity: 4, affixes: [['mf', 15], ['hp', 20]], lore: 'A hook for a lantern, a pouch for loot.', src: { cat: 'dungeon' } },
  { id: 'n_gauntlet', name: 'GAUNTLET OF STEEL', kind: 'wondrous', base: 'vambraces', rarity: 6, affixes: [['hit', 3], ['haste', 10]], lore: 'Won, not given.', src: { cat: 'trial' } },
  { id: 'n_champion', name: "CHAMPION'S TABARD", kind: 'wondrous', base: 'tabard', rarity: 6, affixes: [['hp', 80], ['resist', 2]], lore: 'The arena crowd still chants the name.', src: { cat: 'trial' } },
  // divine (very rare, endgame)
  { id: 'n_ember_codex', name: 'THE EMBER CODEX', kind: 'weapon', base: 'sceptre', rarity: 8, affixes: [['dmg', 80], ['crit', 12], ['heal', 6], ['resist', 3]], lore: 'The book itself, bound into a sceptre.', src: { cat: 'arc', minLvl: 300 } },
  { id: 'n_first_lantern', name: 'THE FIRST LANTERN', kind: 'wondrous', base: 'amulet', rarity: 8, affixes: [['hp', 400], ['heal', 8], ['resist', 25], ['mf', 50]], lore: 'Light before the Pact.', src: { tower: 100, minLvl: 500 } },
];
const NAMED_BY_ID = Object.fromEntries(NAMED_ITEMS.map(n => [n.id, n]));

function makeNamed(id, lvl) {
  const n = NAMED_BY_ID[id]; if (!n) return null;
  const it = makeItem({ kind: n.kind, base: n.base, rarity: n.rarity, lvl: Math.max(lvl, n.src.minLvl || 1) });
  it.name = n.name; it.named = n.id; it.lore = n.lore; if (n.setId) it.setId = n.setId;
  const scale = 1 + Math.max(0, it.ilvl - 20) / 60;
  it.affixes = n.affixes.map(([k, v]) => [k, SUBSTATS[k] ? Math.min(SUBSTATS[k].max, Math.round(v * scale)) : v]).filter(([k]) => SUBSTATS[k]);
  it.value = Math.round(it.value * 3);
  return it;
}

// ---------------------------------------------------------------- rarity roll, item ranks and makeItem upgrades
rollRarity = function (lvl, mfPct = 0, boss = false, diffLoot = 1, floor = 0) {
  const luck = (1 + mfPct / 100) * diffLoot, x = R() / luck;
  // cumulative chances, highest tier first; bosses shift everything up two tiers' worth
  const CH = boss ? [0.0008, 0.004, 0.02, 0.08, 0.3, 1] : [0.00005, 0.0003, 0.0015, 0.006, 0.025, 0.08, 0.27, 0.76, 1];
  const TIERS = boss ? [8, 7, 6, 5, 4, 3] : [8, 7, 6, 5, 4, 3, 2, 1, 0];
  let t = 0; for (let i = 0; i < CH.length; i++) if (x < CH[i]) { t = TIERS[i]; break; }
  while (t > 0 && lvl < RARITY_GATE[t]) t--;
  return Math.max(t, floor);
};
{
  const make0 = makeItem;
  makeItem = function (opts = {}) {
    const it = make0(opts);
    it.rank = rankFor(it.ilvl).n;
    // extra affixes for the new top tiers (mythic+)
    const want = RARITY[it.rarity].affixes;
    if ((it.affixes || []).length < want) {
      const have = new Set(it.affixes.map(a => a[0])), pool = AFFIX_POOL.filter(a => !have.has(a));
      while (it.affixes.length < want && pool.length) { const s = pool.splice(Math.floor(R() * pool.length), 1)[0], k = AFFIX_K[s] || 1; it.affixes.push([s, Math.min(SUBSTATS[s].max, Math.max(1, Math.round(k * (1 + it.ilvl / 12) * (0.6 + it.rarity * 0.25))))]); }
    }
    if (it.rarity >= 6 && !it.legend && !it.named) it.name = pick({ 6: ['MYTHIC', 'FABLED'], 7: ['ANCESTRAL', 'ELDER'], 8: ['DIVINE', 'GODFORGED'] }[it.rarity]) + ' ' + itemBaseName(it).replace(/^(WORN |FINE |MASTER )/, '');
    return it;
  };
}
// art: new weapons use their family; new armours their type
{
  const n0 = nesItemIcon;
  nesItemIcon = function (it) {
    if (!artOn()) return null;
    if (it.kind === 'weapon' && WEAPONS[it.base] && WEAPONS[it.base].fam && !WEAPON_ART[it.base]) return tierPick(WEAPONS[it.base].fam, Math.min(5, it.rarity), it.base);
    return n0(Object.assign({}, it, { rarity: Math.min(5, it.rarity) }));
  };
}
const rankText = it => `T${it.rank || rankFor(it.ilvl || 1).n} ${(ITEM_RANKS[(it.rank || rankFor(it.ilvl || 1).n) - 1] || ITEM_RANKS[0]).name}`;

// ---------------------------------------------------------------- rarity for every item: consumables and materials too
for (const k in ITEMS) { const it = ITEMS[k]; if (it.rarity == null) it.rarity = it.type === 'junk' ? 0 : it.price >= 500 ? 5 : it.price >= 150 ? 4 : it.price >= 50 ? 3 : it.price >= 10 ? 2 : 1; }
Object.assign(ITEMS, {
  hide: { name: 'THICK HIDE', icon: 'ne_leather_0', type: 'mat', price: 4, rarity: 1, desc: 'From beasts. Sells well.' },
  bone_dust: { name: 'BONE DUST', icon: 'px_bone', type: 'mat', price: 5, rarity: 1, desc: 'From the undead.' },
  essence: { name: 'ELEMENTAL ESSENCE', icon: 'ne_gem_0', type: 'mat', price: 12, rarity: 2, desc: 'From elementals.' },
  sap: { name: 'LIVING SAP', icon: 'ne_wood_0', type: 'mat', price: 6, rarity: 1, desc: 'From plants.' },
  ooze: { name: 'OOZE GEL', icon: 'ne_reagent_0', type: 'mat', price: 6, rarity: 1, desc: 'From slimes.' },
  brimstone: { name: 'BRIMSTONE', icon: 'ne_ore_1', type: 'mat', price: 15, rarity: 2, desc: 'From fiends.' },
  drake_scale: { name: 'DRAKE SCALE', icon: 'ne_leather_1', type: 'mat', price: 40, rarity: 3, desc: 'From dragons.' },
  iron_ore: { name: 'IRON ORE', icon: 'ne_ore_0', type: 'mat', price: 5, rarity: 1, desc: 'From constructs and miners.' },
  silk: { name: 'SPIDER SILK', icon: 'ne_reagent_1', type: 'mat', price: 8, rarity: 2, desc: 'From spiders and fey.' },
  star_shard: { name: 'STAR SHARD', icon: 'ne_gem_2', type: 'mat', price: 200, rarity: 5, desc: 'Dropped by great bosses.' },
  boss_sigil: { name: 'BOSS SIGIL', icon: 'ne_relic_2', type: 'key', price: 50, rarity: 4, desc: 'Proof of a boss kill. Collectors pay well.' },
});

// ---------------------------------------------------------------- LOOT TABLES
// family -> materials; rank -> gear chance/count/rarity floor; boss category -> guaranteed drops + named pools
const FAMILY_MATS = { beast: ['hide'], undead: ['bone_dust'], elemental: ['essence'], plant: ['sap', 'peacebloom'], slime: ['ooze'], fiend: ['brimstone'], demon: ['brimstone'], dragon: ['drake_scale', 'hide'],
  construct: ['iron_ore', 'scrap'], humanoid: ['scrap', 'iron_ore'], fey: ['silk', 'sap'], aberration: ['ooze', 'essence'], giant: ['hide', 'iron_ore'], monstrosity: ['hide', 'silk'], celestial: ['essence', 'star_shard'] };
const LOOT_TABLES = {
  // per foe rank: chance of a gear drop, how many, minimum rarity, gold multiplier, material chance, consumable chance
  normal: { gear: 0.16, count: 1, floor: 0, gold: 1, mats: 0.35, cons: 0.12 },
  elite: { gear: 0.6, count: 1, floor: 2, gold: 2.5, mats: 0.8, cons: 0.3 },
  champion: { gear: 1, count: 2, floor: 2, gold: 4, mats: 1, cons: 0.5 },
  // per boss category: guaranteed gear, rarity floor, chance of a named item, bonus loot
  world: { gear: 1, count: 2, floor: 3, named: 0.12, gold: 8, sigil: 1, star: 0.1 },
  arc: { gear: 1, count: 3, floor: 4, named: 1, gold: 12, sigil: 1, star: 0.3 },
  dungeon: { gear: 1, count: 1, floor: 3, named: 0.08, gold: 5, sigil: 0.5, star: 0.02 },
  raid: { gear: 1, count: 2, floor: 4, named: 0.25, gold: 10, sigil: 1, star: 0.2 },
  trial: { gear: 1, count: 1, floor: 4, named: 0.15, gold: 8, sigil: 1, star: 0.1 },
  tower: { gear: 1, count: 2, floor: 3, named: 0.2, gold: 9, sigil: 1, star: 0.15 },
};
const CONSUMABLE_TABLE = [['potion', 40], ['ration', 20], ['antitoxin', 10], ['ether', 10], ['greater', 12], ['superior', 5], ['supreme', 1]];
const weighted = tbl => { const tot = tbl.reduce((a, [, w]) => a + w, 0); let x = R() * tot; for (const [k, w] of tbl) { if ((x -= w) < 0) return k; } return tbl[0][0]; };
function namedPoolFor(f) {
  const B = f.bossId && BOSS_BY_ID[f.bossId]; if (!B) return [];
  return NAMED_ITEMS.filter(n => {
    const s = n.src; if (s.minLvl && f.lvl < s.minLvl) return false;
    if (s.act && B.cat === 'arc') return B.act === s.act;
    if (s.raid) return B.where === s.raid;
    if (s.tower) return B.cat === 'tower' && B.floor === s.tower;
    return s.cat === B.cat;
  });
}
// smart loot: bias gear toward things this hero can use
function smartKind(c) {
  const cls = CLASSES[c.cls], r = R();
  if (r < 0.35) return { kind: 'wondrous' };
  if (r < 0.65) { const ok = Object.keys(WEAPONS).filter(k => { const w = WEAPONS[k]; return cls.weapons === 'martial' || w.cat === 'simple' || (cls.weapons === 'finesse' && w.props.includes('f')); }); return { kind: 'weapon', base: pick(ok) }; }
  const ok = Object.keys(ARMORS).filter(k => cls.armor.includes(ARMORS[k].type)); return ok.length ? { kind: 'armor', base: pick(ok) } : { kind: 'wondrous' };
}
// resolve the drops of one defeated foe
function rollDrops(f, ctx = {}) {
  const c = ctx.hero || G, D = derive(c), diffLoot = ctx.loot || 1, out = { items: [], gold: 0, mats: {}, cons: [], runes: [] };
  const B = f.bossId && BOSS_BY_ID[f.bossId];
  const T = B ? LOOT_TABLES[B.cat] || LOOT_TABLES.world : f.elite ? LOOT_TABLES.elite : f.champion ? LOOT_TABLES.champion : LOOT_TABLES.normal;
  // gear
  const gearRoll = T.gear * diffLoot * (1 + D.mf / 200);
  if (R() < gearRoll) for (let i = 0; i < T.count + (B && R() < 0.5 * diffLoot ? 1 : 0); i++) {
    const smart = R() < 0.7 ? smartKind(c) : {};
    out.items.push(makeItem({ ...smart, lvl: f.lvl, mf: D.mf, boss: !!B, loot: diffLoot, rarity: rollRarity(f.lvl, D.mf, !!B, diffLoot, T.floor) }));
  }
  // named
  if (B && T.named) { const pool = namedPoolFor(f); if (pool.length && R() < T.named * diffLoot) { const n = pick(pool); out.items.push(makeNamed(n.id, f.lvl)); } }
  // boss rune rewards (the reward roll is separate from gear and named drops)
  if (B && typeof rollBossRuneDrops === 'function') out.runes = rollBossRuneDrops(B, f.lvl, R);
  // gold
  out.gold = Math.round((f.gold || 0) * (T.gold || 1) * (1 + D.gf / 100));
  // materials by family
  const fam = f.fam || 'beast', mats = FAMILY_MATS[fam] || ['scrap'];
  if (R() < (T.mats ?? 1)) { const k = pick(mats); if (ITEMS[k]) out.mats[k] = (out.mats[k] || 0) + 1 + (f.elite || B ? 1 + Math.floor(R() * 2) : 0); }
  if (B && T.sigil && R() < T.sigil) out.mats.boss_sigil = 1;
  if (B && T.star && R() < T.star) out.mats.star_shard = 1;
  // consumables
  if (R() < (T.cons ?? 0.25)) out.cons.push(weighted(CONSUMABLE_TABLE));
  // monster-specific junk drop (legacy uniques)
  const tpl = MONSTERS[f.uniqueKey]; if (tpl && tpl.drop && ITEMS[tpl.drop] && R() < 0.5) out.mats[tpl.drop] = (out.mats[tpl.drop] || 0) + 1;
  return out;
}
// what a foe can drop, for the bestiary / debug
function dropTableFor(f) {
  const B = f.bossId && BOSS_BY_ID[f.bossId], T = B ? LOOT_TABLES[B.cat] : f.elite ? LOOT_TABLES.elite : LOOT_TABLES.normal;
  return { gearChance: T.gear, count: T.count, minRarity: RARITY[T.floor].name, runeChance: B && BOSS_RUNE_DROP_CHANCE ? BOSS_RUNE_DROP_CHANCE[B.cat] : 0, named: B ? namedPoolFor(f).map(n => n.name) : [], mats: (FAMILY_MATS[f.fam] || ['scrap']).map(k => ITEMS[k] && ITEMS[k].name) };
}

// ---------------------------------------------------------------- TITLES (earned, pick one to wear)
const TITLES = [
  { id: 't_wanderer', name: 'THE WANDERER', how: 'Start your journey.', ok: g => true },
  { id: 't_blooded', name: 'THE BLOODED', how: 'Win 25 battles.', ok: g => g.stats.kills >= 25 },
  { id: 't_slayer', name: 'MONSTER SLAYER', how: 'Defeat 500 foes.', ok: g => g.stats.kills >= 500 },
  { id: 't_kingslayer', name: 'KINGSLAYER', how: 'Defeat an arc boss.', ok: g => g.stats.arcBosses >= 1 },
  { id: 't_hunter', name: 'BOSS HUNTER', how: 'Defeat 10 world bosses.', ok: g => g.stats.worldBosses >= 10 },
  { id: 't_delver', name: 'THE DELVER', how: 'Clear 5 dungeons.', ok: g => g.stats.dungeons >= 5 },
  { id: 't_raider', name: 'RAIDER', how: 'Clear a raid.', ok: g => g.stats.raids >= 1 },
  { id: 't_champion', name: 'CHAMPION', how: 'Complete a trial.', ok: g => g.stats.trials >= 1 },
  { id: 't_climber', name: 'SPIRE CLIMBER', how: 'Reach tower floor 25.', ok: g => g.towerBest >= 25 },
  { id: 't_hundred', name: 'OF THE HUNDRED', how: 'Reach tower floor 100.', ok: g => g.towerBest >= 100 },
  { id: 't_hero', name: 'HERO OF AELMOOR', how: 'Reach level 20.', ok: g => g.lvl >= 20 },
  { id: 't_ascended', name: 'THE ASCENDED', how: 'Reach level 100.', ok: g => g.lvl >= 100 },
  { id: 't_mythic', name: 'MYTHBORN', how: 'Reach level 360.', ok: g => g.lvl >= 360 },
  { id: 't_eternal', name: 'THE ETERNAL', how: 'Reach level 720.', ok: g => g.lvl >= 720 },
  { id: 't_lucky', name: 'FORTUNE\'S FAVOURITE', how: 'Roll 20 natural 20s.', ok: g => g.stats.nat20 >= 20 },
  { id: 't_rich', name: 'THE GILDED', how: 'Earn 100,000 gold.', ok: g => g.stats.goldEarned >= 100000 },
  { id: 't_legend', name: 'LEGEND-TOUCHED', how: 'Find a legendary item.', ok: g => g.stats.legendaries >= 1 },
  { id: 't_collector', name: 'THE COLLECTOR', how: 'Find 5 named items.', ok: g => Object.keys(g.named || {}).length >= 5 },
  { id: 't_angler', name: 'MASTER ANGLER', how: 'Catch 50 fish.', ok: g => g.stats.fish >= 50 },
  { id: 't_survivor', name: 'DEATH-DEFIER', how: 'Stabilise 10 times.', ok: g => g.stats.stabilized >= 10 },
  { id: 't_nightmare', name: 'NIGHTMARE WALKER', how: 'Win on difficulty 5+.', ok: g => g.stats.diff5 >= 1 },
  { id: 't_apocalypse', name: 'END OF DAYS', how: 'Win on difficulty 9.', ok: g => g.stats.diff9 >= 1 },
];
const titlesEarned = g => TITLES.filter(t => { try { return t.ok(g); } catch (e) { return false; } });
const titleOf = g => { const t = TITLES.find(x => x.id === g.title); return t ? t.name : null; };
class TitleScene extends ListScene {
  constructor() { super(9); }
  items() { return TITLES; }
  update() {
    this.navList(); if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a')) { const t = TITLES[this.i]; if (!titlesEarned(G).includes(t)) { SFX.error(); return; } G.title = G.title === t.id ? null : t.id; SFX.confirm(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); const got = new Set(titlesEarned(G).map(t => t.id));
    textC(`TITLES ${got.size}/${TITLES.length}`, 80, 13, 3);
    TITLES.slice(this.top, this.top + this.rows).forEach((t, j) => { const i = this.top + j, y = 24 + j * 10; if (i === this.i) fill(2, y - 1, 152, 10, 1); if (t.icon && IMG[t.icon]) blit(spr(t.icon, 8, 8, { ghost: !got.has(t.id) }), 4, y); text((G.title === t.id ? '> ' : '') + t.name, 14, y, got.has(t.id) ? 3 : 1); });
    this.scrollbar(156, 23, 92); frame(1, 116, 158, 27); const t = TITLES[this.i];
    text(t.how, 5, 120, 2); text(got.has(t.id) ? (G.title === t.id ? 'WORN. A: REMOVE' : 'A: WEAR THIS TITLE') : 'LOCKED', 5, 131, got.has(t.id) ? 'gold' : 1);
  }
}

for (const k in ITEMS) if (!ITEMS[k].icon0) ITEMS[k].icon0 = ITEMS[k].icon;

// ---------------------------------------------------------------- icons for everything (tools/gen_newart.py)
{
  // assets load after this script runs, so check the asset list, not IMG
  const NAMES = new Set(Object.keys(window.GB_ASSETS || {}).concat(window.ASSET_NAMES || [])), has = n => NAMES.size ? NAMES.has(n) : true;
  for (const k in BUFFS) if (has('bf_' + k)) BUFFS[k].icon = 'bf_' + k;
  for (const k in CONDITIONS) if (has('cd_' + k) && CONDITIONS[k] && typeof CONDITIONS[k] === 'object') CONDITIONS[k].icon = 'cd_' + k;
  if (typeof ACTIVE_SKILLS !== 'undefined') ACTIVE_SKILLS.forEach(s => { if (has('sk_' + s.id)) s.icon = 'sk_' + s.id; });
  if (typeof PASSIVE_SKILLS !== 'undefined') PASSIVE_SKILLS.forEach(s => { if (has('ps_' + s.id)) s.icon = 'ps_' + s.id; });
  if (typeof TALENT_TREES !== 'undefined') TALENT_TREES.forEach(t => t.nodes.forEach(n => { if (has('tl_' + n.id)) n.icon = 'tl_' + n.id; }));
  ACHIEVEMENTS.forEach(a => { if (has('ac_' + a.id)) a.icon = 'ac_' + a.id; });
  TITLES.forEach(t => { if (has('tt_' + t.id)) t.icon = 'tt_' + t.id; });
  for (const s of SLOTS) if (has('sl_' + s)) SLOT_ICON[s] = 'sl_' + s;
  const icon0 = itemIcon;
  itemIcon = function (it) { if (it && it.named && IMG['nn_' + it.named]) return 'nn_' + it.named; return icon0(it); };
}
const effectIcon = id => { const n = (BUFFS[id] && BUFFS[id].icon) || 'cd_' + id; return IMG[n] ? n : null; };

// ---------------------------------------------------------------- gear tier effects (tiers 1-23)
// 1) implicit stats: every weapon / armour / trinket carries stats that grow with its tier.
// 2) tier powers: the weapon (or caster offhand) tier power procs from ANY damage you deal:
//    weapon attacks, spells, class abilities and skills. Armour tiers carry a guard power that
//    procs when you are hit. Chance: 8% + 0.6% per tier (power) and 6% + 0.5% per tier (guard).
const TIER_IMPLICIT = {
  weapon: t => [['dmg', 2 + t * 3], ...(t >= 4 ? [['crit', Math.min(15, Math.floor(t / 2))]] : []), ...(t >= 10 ? [['critdmg', (t - 9) * 6]] : []), ...(t >= 16 ? [['hit', Math.min(4, t - 15)]] : [])],
  armor: t => [['hp', 4 + t * 6], ...(t >= 3 ? [['resist', Math.min(20, Math.floor(t * 0.8))]] : []), ...(t >= 8 ? [['block', Math.min(15, t - 7)]] : []), ...(t >= 14 ? [['thorns', (t - 13) * 4]] : [])],
  wondrous: t => [['heal', 2 + t * 2], ...(t >= 3 ? [['xp', t]] : []), ...(t >= 6 ? [['haste', Math.min(15, Math.floor(t / 2))]] : []), ...(t >= 12 ? [['mf', t * 2]] : [])],
};
function tierImplicit(it) { if (!it || !it.rank) return []; const f = TIER_IMPLICIT[it.kind]; return f ? f(it.rank) : []; }

// eff: dmg [dice, type, all?], debuff id, heal dice (self or party), buff id, drain, echo
const TIER_POWERS = [
  { name: 'BRUTE FORCE', dmg: ['1d4', 'bludgeoning'] },
  { name: 'BITE OF IRON', dmg: ['1d6', 'piercing'] },
  { name: 'KEEN EDGE', debuff: 'bleeding' },
  { name: 'TEMPERED BLOW', dmg: ['1d10', 'slashing'] },
  { name: 'SILVER BANE', dmg: ['2d6', 'radiant'], bane: ['undead', 'fiend'] },
  { name: 'DUSK CUT', debuff: 'weakened' },
  { name: 'RUNE BURST', dmg: ['2d8', 'force'] },
  { name: 'MOONLIGHT', heal: '2d8' },
  { name: 'EMBER BRAND', dmg: ['2d6', 'fire'], debuff: 'burning' },
  { name: 'STORM CALL', dmg: ['3d8', 'lightning'], debuff: 'shocked' },
  { name: 'STARFALL', dmg: ['3d10', 'radiant'] },
  { name: "DRAGON'S BREATH", dmg: ['2d10', 'fire', true] },
  { name: 'ADAMANT SUNDER', dmg: ['2d10', 'force'], debuff: 'sundered' },
  { name: 'ASTRAL RIFT', debuff: 'vulnerable', dmg: ['2d12', 'force'] },
  { name: 'ABYSSAL DRAIN', dmg: ['4d8', 'necrotic'], drain: 0.5 },
  { name: 'CELESTIAL HYMN', heal: '3d8', party: true },
  { name: 'PRIMORDIAL QUAKE', dmg: ['4d10', 'bludgeoning', true], debuff: 'slowed' },
  { name: 'ETERNAL ECHO', echo: 0.6 },
  { name: 'MYTHIC HASTE', buff: 'haste', dmg: ['4d10', 'force'] },
  { name: 'WORLDBREAKER', dmg: ['6d10', 'force'], debuff: 'sundered' },
  { name: 'GODSTRIKE', dmg: ['6d12', 'radiant'], debuff: 'doomed' },
  { name: 'AETHER STORM', dmg: ['6d10', 'lightning', true], debuff: 'shocked' },
  { name: 'DAWNBREAK', dmg: ['8d12', 'radiant', true], heal: '4d10', party: true },
];
const TIER_GUARDS = ['fortify', 'regen', 'thornskin', 'barrier', 'ac'];
const tierPower = it => it && it.rank ? TIER_POWERS[Math.min(23, it.rank) - 1] : null;
const tierGuard = it => it && it.rank ? { name: `${(ITEM_RANKS[it.rank - 1] || ITEM_RANKS[0]).name} GUARD`, buff: TIER_GUARDS[it.rank % 5] } : null;
function tierPowerText(it) {
  if (!it) return '';
  if (it.kind === 'weapon' || (it.kind === 'wondrous' && it.slot === 'offhand')) { const p = tierPower(it); if (!p) return ''; const bits = [];
    if (p.dmg) bits.push(`+${p.dmg[0]} ${p.dmg[1]}${p.dmg[2] ? ' to all' : ''}`); if (p.debuff) bits.push(BUFFS[p.debuff] ? BUFFS[p.debuff].name : p.debuff);
    if (p.heal) bits.push(`heal ${p.heal}${p.party ? ' party' : ''}`); if (p.buff) bits.push(BUFFS[p.buff].name); if (p.drain) bits.push('drain'); if (p.echo) bits.push('echo hit');
    return `${p.name}: ${bits.join(', ')}`; }
  if (it.kind === 'armor') { const g = tierGuard(it); return `${g.name}: ${BUFFS[g.buff].name} when hit`; }
  return '';
}
function powerSource(ch) {
  const w = ch.eq && ch.eq.weapon, o = ch.eq && ch.eq.offhand;
  const ow = o && o.kind === 'wondrous' ? o : null;
  return (w && ow) ? ((w.rank || 1) >= (ow.rank || 1) ? w : ow) : (w || ow);
}
function gearTierProc(battle, src, tgt, dealt) {
  if (!src || !isChar(src) || !tgt || tgt.side !== 'foe') return;
  const it = powerSource(src.ch), p = tierPower(it); if (!p) return;
  if (R() * 100 >= 8 + it.rank * 0.6) return;
  const notes = [];
  const scale = 1 + Math.max(0, (src.ch.lvl || 1) - 20) / 120;
  if (p.dmg) {
    const targets = p.dmg[2] ? battle.enemiesOf(src).filter(alive) : [tgt];
    let total = 0;
    for (const t of targets) { let d = Math.round(roll(p.dmg[0]).total * scale); if (p.bane && p.bane.includes(t.fam)) d *= 2; total += battle.applyDamage(src, t, d, p.dmg[1], { proc: true, magic: true }) || d; }
    notes.push(`${p.dmg[2] ? 'ALL FOES' : tgt.name} +${total} ${p.dmg[1].toUpperCase()}`);
    if (p.drain) battle.heal(src, Math.ceil(total * p.drain));
  }
  if (p.echo) { const d = Math.max(1, Math.round(dealt * p.echo)); battle.applyDamage(src, tgt, d, 'force', { proc: true, magic: true }); notes.push(`ECHO +${d}`); }
  if (p.debuff && alive(tgt) && !(tgt.condImm || []).includes(p.debuff)) { addEffect(tgt, { id: p.debuff, rounds: 3, lvl: src.ch.lvl, src: src.id }); notes.push(BUFFS[p.debuff].name); }
  if (p.heal) { const who = p.party ? battle.party.filter(u => isChar(u) && alive(u)) : [src]; for (const u of who) battle.heal(u, Math.round(roll(p.heal).total * scale)); notes.push(p.party ? 'PARTY HEALED' : 'HEALED'); }
  if (p.buff) { addEffect(src, { id: p.buff, rounds: 3 }); notes.push(BUFFS[p.buff].name); }
  battle.pushNote(`${p.name}! ${notes.join(' ')}`.slice(0, 60));
  if (src.ch === G) G.stats.tierProcs = (G.stats.tierProcs || 0) + 1;
}
function gearTierGuard(battle, tgt) {
  if (!isChar(tgt)) return;
  const it = tgt.ch.eq && tgt.ch.eq.armor, g = tierGuard(it); if (!g) return;
  if (hasEff(tgt, g.buff) || R() * 100 >= 6 + it.rank * 0.5) return;
  const e = { id: g.buff, rounds: 2 };
  if (g.buff === 'barrier') e.pool = 5 + it.rank * 4;
  addEffect(tgt, e);
  battle.pushNote(`${tgt.name}: ${g.name} - ${BUFFS[g.buff].name}!`.slice(0, 60));
}
