// ================================================================ ARMOURY: armour classes, armour categories, weapon subclasses
// ARMOUR CLASSES (weight): CLOTH < LEATHER < MAIL < PLATE. 5e proficiencies gate them:
//   cloth = anyone, leather = light, mail = medium, plate = heavy armour proficiency.
// 7 ARMOUR CATEGORIES (piece slots): HELM, CLOAK, CHEST, GLOVES, BELT, LEGGINGS, BOOTS. Every piece
//   in those slots has a weight class. Each piece adds class implicit stats (scaling with gear tier),
//   and wearing 4 / 7 pieces of one class grants a set bonus. AC from sets is capped at +2.
// 14 WEAPON SUBCLASSES: SWORD AXE MACE HAMMER DAGGER POLEARM STAFF WAND BOW CROSSBOW THROWN FIST SCYTHE GRIMOIRE,
//   each with a signature implicit (stacks with the tier implicit).

const ARMOR_CLASSES = {
  cloth: { name: 'CLOTH', prof: null, desc: 'Robes and silks. Healing and spell damage.' },
  leather: { name: 'LEATHER', prof: 'light', desc: 'Supple hide. Dodge and critical strikes.' },
  mail: { name: 'MAIL', prof: 'medium', desc: 'Linked rings and scales. Health, accuracy and resistance.' },
  plate: { name: 'PLATE', prof: 'heavy', desc: 'Forged plate. Health, block and thorns.' },
};
const ACLASS_ORDER = ['cloth', 'leather', 'mail', 'plate'];
const ARMOR_CATEGORIES = [
  { slot: 'head', name: 'HELM' }, { slot: 'back', name: 'CLOAK' }, { slot: 'armor', name: 'CHEST' }, { slot: 'hands', name: 'GLOVES' },
  { slot: 'waist', name: 'BELT' }, { slot: 'legs', name: 'LEGGINGS' }, { slot: 'feet', name: 'BOOTS' },
];
const PIECE_SLOTS = ARMOR_CATEGORIES.map(c => c.slot);
const TYPE_ACLASS = { cloth: 'cloth', light: 'leather', medium: 'mail', heavy: 'plate' };

// cloth chest armour (AC 10/11/12 + full DEX), wearable by every class
Object.assign(ARMORS, {
  travelrobe: { name: 'TRAVEL ROBE', ac: 10, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_0', cost: 5 },
  silkrobe: { name: 'SILK ROBE', ac: 11, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_1', cost: 60 },
  runevestment: { name: 'RUNE VESTMENT', ac: 11, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_3', cost: 300, spellward: true },
  archmantle: { name: 'ARCH MANTLE', ac: 12, dexMax: null, type: 'cloth', icon: 'ne_lightarmor_5', cost: 1200 },
});
for (const k in ARMORS) { const a = ARMORS[k]; if (TYPE_ACLASS[a.type]) a.aclass = TYPE_ACLASS[a.type]; }

// 12 weapon subclasses
Object.assign(WEAPONS, {
  cestus: { name: 'CESTUS', dmg: '1d4', type: 'bludgeoning', cat: 'simple', props: 'l', fam: 'fist', icon: 'ne_glove_0', cost: 2 },
  ironknuckle: { name: 'IRON KNUCKLES', dmg: '1d6', type: 'bludgeoning', cat: 'simple', props: 'l', fam: 'fist', icon: 'ne_glove_2', cost: 8 },
  tigerclaw: { name: 'TIGER CLAWS', dmg: '1d6', type: 'slashing', cat: 'martial', props: 'fl', fam: 'fist', icon: 'ne_glove_4', cost: 25 },
  dragonfist: { name: 'DRAGON GAUNTLET', dmg: '1d8', type: 'bludgeoning', cat: 'martial', props: 'f', fam: 'fist', icon: 'ne_glove_5', cost: 120 },
});
// scythes, grimoires and more wands
Object.assign(WEAPONS, {
  gravescythe: { name: 'GRAVE SCYTHE', dmg: '1d8', type: 'slashing', cat: 'simple', props: '2', fam: 'scythe', icon: 'wi_scythe_0', cost: 20 },
  reaperscythe: { name: "REAPER'S SCYTHE", dmg: '1d10', type: 'slashing', cat: 'martial', props: 'h2', fam: 'scythe', icon: 'wi_scythe_1', cost: 60 },
  harvestmoon: { name: 'HARVEST MOON', dmg: '2d6', type: 'slashing', cat: 'martial', props: 'h2', fam: 'scythe', icon: 'wi_scythe_2', cost: 240 },
  soulreaper: { name: 'SOUL REAPER', dmg: '2d6', type: 'necrotic', cat: 'martial', props: 'h2', fam: 'scythe', icon: 'wi_scythe_3', cost: 900 },
  primergrimoire: { name: 'PRIMER GRIMOIRE', dmg: '1d4', type: 'force', cat: 'simple', props: 'l', fam: 'grimoire', icon: 'wi_grimoire_0', cost: 15 },
  ashengrimoire: { name: 'GRIMOIRE OF ASHES', dmg: '1d6', type: 'fire', cat: 'simple', props: 'l', fam: 'grimoire', icon: 'wi_grimoire_1', cost: 80 },
  bloodgrimoire: { name: 'BLOOD GRIMOIRE', dmg: '1d6', type: 'necrotic', cat: 'simple', props: 'l', fam: 'grimoire', icon: 'wi_grimoire_2', cost: 220 },
  stargrimoire: { name: 'STAR GRIMOIRE', dmg: '1d8', type: 'radiant', cat: 'simple', props: 'l', fam: 'grimoire', icon: 'wi_grimoire_3', cost: 800 },
  voidcodex: { name: 'VOID CODEX', dmg: '1d8', type: 'psychic', cat: 'simple', props: 'l', fam: 'grimoire', icon: 'wi_grimoire_4', cost: 1600 },
  emberwand: { name: 'EMBER WAND', dmg: '1d6', type: 'fire', cat: 'simple', props: 'lr', fam: 'wand', icon: 'wi_wand_0', cost: 40 },
  frostwand: { name: 'FROST WAND', dmg: '1d6', type: 'cold', cat: 'simple', props: 'lr', fam: 'wand', icon: 'wi_wand_1', cost: 40 },
  bonewand: { name: 'BONE WAND', dmg: '1d6', type: 'necrotic', cat: 'simple', props: 'lr', fam: 'wand', icon: 'wi_wand_2', cost: 60 },
  stormwand: { name: 'STORM WAND', dmg: '1d8', type: 'lightning', cat: 'simple', props: 'lr', fam: 'wand', icon: 'wi_wand_3', cost: 200 },
  dawnwand: { name: 'DAWN WAND', dmg: '1d8', type: 'radiant', cat: 'simple', props: 'lr', fam: 'wand', icon: 'wi_wand_4', cost: 600 },
});
for (const k in WEAPONS) { const w = WEAPONS[k]; if (/HAMMER|MAUL/.test(w.name) && (w.fam === 'mace' || !w.fam)) w.fam = 'hammer'; if (!w.fam) w.fam = w.props.includes('r') ? 'bow' : w.type === 'piercing' ? 'polearm' : w.type === 'slashing' ? 'sword' : 'mace'; }
const WEAPON_CLASSES = {
  sword: { name: 'SWORD', stats: t => [['crit', 2 + Math.floor(t / 6)], ['hit', t >= 12 ? 1 : 0]], desc: 'Balanced: crit chance and accuracy.' },
  axe: { name: 'AXE', stats: t => [['critdmg', 10 + t * 2]], desc: 'Brutal: critical damage.' },
  mace: { name: 'MACE', stats: t => [['dmg', 4 + t], ['radiant', t >= 8 ? 4 + t : 0]], desc: 'Crushing: damage, holy damage at higher tiers.' },
  hammer: { name: 'HAMMER', stats: t => [['dmg', 6 + Math.floor(t * 1.5)], ['critdmg', 8 + t]], desc: 'Heavy: big damage and crit damage.' },
  dagger: { name: 'DAGGER', stats: t => [['crit', 4 + Math.floor(t / 5)], ['critdmg', 6 + t]], desc: 'Swift: high crit chance and crit damage.' },
  polearm: { name: 'POLEARM', stats: t => [['dmg', 3 + t], ['block', 2 + Math.floor(t / 6)]], desc: 'Reach: damage and block.' },
  staff: { name: 'STAFF', stats: t => [['heal', 6 + t * 2], ['fire', 4 + t], ['cold', 4 + t], ['lightning', 4 + t]], desc: 'Arcane focus: healing and elemental damage.' },
  wand: { name: 'WAND', stats: t => [['necrotic', 6 + t * 2], ['radiant', 6 + t * 2], ['crit', 2]], desc: 'Channel: shadow and holy damage.' },
  bow: { name: 'BOW', stats: t => [['hit', 1 + (t >= 10 ? 1 : 0)], ['crit', 2 + Math.floor(t / 8)]], desc: 'Ranged: accuracy and crit chance.' },
  crossbow: { name: 'CROSSBOW', stats: t => [['critdmg', 18 + t * 3]], desc: 'Ranged: heavy critical damage.' },
  thrown: { name: 'THROWN', stats: t => [['haste', 4 + Math.floor(t / 4)], ['crit', 2]], desc: 'Quick: haste and crit chance.' },
  scythe: { name: 'SCYTHE', stats: t => [['critdmg', 12 + t * 2], ['necrotic', 6 + t * 2], ['leech', Math.min(8, 1 + Math.floor(t / 4))]], desc: 'Reaping: crit damage, shadow damage and lifesteal.' },
  grimoire: { name: 'GRIMOIRE', stats: t => [['dmg', 3 + t], ['fire', 5 + t * 2], ['cold', 5 + t * 2], ['lightning', 5 + t * 2], ['necrotic', 5 + t * 2], ['radiant', 5 + t * 2]], desc: 'Spellbook: damage and every elemental school.' },
  fist: { name: 'FIST', stats: t => [['haste', 6 + Math.floor(t / 3)], ['dodge', 2 + Math.floor(t / 6)]], desc: 'Martial: haste and dodge.' },
};
const ARMOR_CLASS_STATS = {
  cloth: t => [['heal', 2 + t], ['dmg', 1 + Math.floor(t / 2)]],
  leather: t => [['dodge', Math.min(8, 1 + Math.floor(t / 4))], ['crit', 1 + Math.floor(t / 6)]],
  mail: t => [['hp', 3 + t * 3], ['resist', 1 + Math.floor(t / 3)]],
  plate: t => [['hp', 5 + t * 4], ['block', Math.min(8, 1 + Math.floor(t / 4))], ['thorns', t * 2]],
};
const ARMOR_SETS = {
  cloth: { 4: [['dmg', 10], ['heal', 15]], 7: [['haste', 10], ['dmg', 10]] },
  leather: { 4: [['crit', 5]], 7: [['dodge', 6], ['critdmg', 25]] },
  mail: { 4: [['resist', 6]], 7: [['hp', 60], ['hit', 1]] },
  plate: { 4: [['acb', 1]], 7: [['acb', 1], ['block', 8]] },
};
const pieceClass = it => !it ? null : it.kind === 'armor' ? (ARMORS[it.base] && ARMORS[it.base].aclass) || null : it.kind === 'wondrous' && PIECE_SLOTS.includes(it.slot) ? (it.aclass || 'cloth') : null;
function armorSetCounts(c) { const n = { cloth: 0, leather: 0, mail: 0, plate: 0 }; for (const s of PIECE_SLOTS) { const k = pieceClass(c.eq && c.eq[s]); if (k) n[k]++; } return n; }
function armorSetBonus(c) {
  const out = [], n = armorSetCounts(c);
  for (const k of ACLASS_ORDER) for (const need of [4, 7]) if (n[k] >= need) out.push(...ARMOR_SETS[k][need]);
  return out;
}
const canWearClass = (c, k) => { const p = ARMOR_CLASSES[k].prof; return !p || CLASSES[c.cls].armor.includes(p); };
const bestWearable = c => ACLASS_ORDER.filter(k => canWearClass(c, k)).pop() || 'cloth';

// implicit stats: gear tier (items.js) + weapon subclass + armour class
{
  const ti0 = tierImplicit;
  tierImplicit = function (it) {
    const out = ti0(it).slice(), t = (it && it.rank) || 1;
    if (it && it.kind === 'weapon' && WEAPONS[it.base]) { const wc = WEAPON_CLASSES[WEAPONS[it.base].fam]; if (wc) out.push(...wc.stats(t).filter(([, v]) => v > 0)); }
    const pc = pieceClass(it); if (pc && it.kind === 'wondrous') out.push(...ARMOR_CLASS_STATS[pc](t));
    return out;
  };
}
// new wondrous pieces roll a weight class (60% your best wearable class: smart loot)
{
  const mk0 = makeItem;
  makeItem = function (opts = {}) {
    const it = mk0(opts);
    if (it.kind === 'wondrous' && PIECE_SLOTS.includes(it.slot) && !it.aclass) {
      it.aclass = opts.aclass || (G && R() < 0.6 ? bestWearable(G) : pick(ACLASS_ORDER));
      if (!it.named && !it.legend) it.name = `${ARMOR_CLASSES[it.aclass].name} ${it.name}`.replace(/^(\w+) (\+\d+) /, '$2 $1 ').slice(0, 26);
    }
    return it;
  };
}
// proficiency gate for armour weight classes
{
  const ce0 = canEquip;
  canEquip = function (c, it) {
    if (it && it.kind === 'armor' && ARMORS[it.base] && ARMORS[it.base].type === 'cloth') {
      if (it.attune) { const n = SLOTS.filter(s => c.eq[s] && c.eq[s].attune && !slotsFor(it).includes(s)).length; if (n >= MAX_ATTUNE) return 'Attuned to 3 items already.'; }
      return null;
    }
    const pc = pieceClass(it);
    if (pc && it.kind === 'wondrous' && !canWearClass(c, pc)) return `${CLASSES[c.cls].name} can't wear ${ARMOR_CLASSES[pc].name.toLowerCase()} pieces.`;
    return ce0(c, it);
  };
}
// item key stat shows the weight class / weapon subclass
{
  const ks0 = itemKeyStat;
  itemKeyStat = function (it) {
    const s = ks0(it);
    if (it.kind === 'weapon' && WEAPONS[it.base]) { const wc = WEAPON_CLASSES[WEAPONS[it.base].fam]; return wc ? `${wc.name} ${s}` : s; }
    const pc = pieceClass(it); return pc ? `${ARMOR_CLASSES[pc].name} ${s}` : s;
  };
}

// ---------------------------------------------------------------- armoury screen (CHARACTER > ARMOURY)
class ArmoryScene {
  constructor() { this.opaque = true; this.tab = 0; this.i = 0; }
  update() {
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('left') || P('right') || P('select')) { this.tab = (this.tab + 1) % 2; this.i = 0; SFX.page(); }
    const n = this.tab === 0 ? 4 : 12;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    textC(this.tab === 0 ? '< ARMOUR CLASSES >' : '< WEAPON SUBCLASSES >', 80, 1, 'gold');
    if (this.tab === 0) {
      const n = armorSetCounts(G);
      ACLASS_ORDER.forEach((k, i) => { const y = 15 + i * 11, ok = canWearClass(G, k); if (i === this.i) fill(1, y - 1, 158, 11, 1); text(ARMOR_CLASSES[k].name, 5, y, ok ? 3 : 1); textR(`${n[k]}/7 ${ok ? 'OK' : 'NO'}`, 155, y, ok ? 'green' : 'red'); });
      const k = ACLASS_ORDER[this.i], sets = ARMOR_SETS[k];
      frame(1, 62, 158, 81);
      text(wrap(ARMOR_CLASSES[k].desc, 25).slice(0, 2).join('\n'), 5, 65, 3);
      text(`PER PIECE: ${ARMOR_CLASS_STATS[k](1).map(([s]) => SUBSTATS[s].name.slice(0, 6)).join(' ')}`.slice(0, 25), 5, 85, 2);
      text(`4 SET: ${sets[4].map(([s, v]) => `${SUBSTATS[s].name.slice(0, 6)}+${v}`).join(' ')}`.slice(0, 25), 5, 96, n[k] >= 4 ? 'gold' : 2);
      text(`7 SET: ${sets[7].map(([s, v]) => `${SUBSTATS[s].name.slice(0, 6)}+${v}`).join(' ')}`.slice(0, 25), 5, 106, n[k] >= 7 ? 'gold' : 2);
      text('HELM CLOAK CHEST GLOVES', 5, 120, 1); text('BELT LEGGINGS BOOTS', 5, 129, 1);
    } else {
      const keys = Object.keys(WEAPON_CLASSES), top = Math.max(0, Math.min(this.i - 3, keys.length - 7));
      const cur = G.eq.weapon && WEAPONS[G.eq.weapon.base] && WEAPONS[G.eq.weapon.base].fam;
      keys.slice(top, top + 7).forEach((k, j) => { const i = top + j, y = 15 + j * 10; if (i === this.i) fill(1, y - 1, 158, 10, 1); text(WEAPON_CLASSES[k].name, 5, y, k === cur ? 'gold' : 3); textR(`${Object.values(WEAPONS).filter(w => w.fam === k).length} KINDS`, 155, y, 2); });
      const k = keys[this.i];
      frame(1, 88, 158, 55);
      text(wrap(WEAPON_CLASSES[k].desc, 25).slice(0, 2).join('\n'), 5, 91, 3);
      text(WEAPON_CLASSES[k].stats(10).filter(([, v]) => v > 0).map(([s, v]) => `${SUBSTATS[s].name.slice(0, 6)}+${v}`).join(' ').slice(0, 25), 5, 111, 2);
      text('(VALUES AT TIER 10)', 5, 121, 1);
    }
  }
}
