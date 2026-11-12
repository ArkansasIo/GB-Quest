'use strict';
// ================================================================ HEIRLOOMS: account-wide set gear from level 1
// LANTERNBORN HEIRLOOMS is a fourteen-piece set that belongs to the ACCOUNT, not to one hero:
//   gear      weapon (six styles), chest, helm, cloak, gloves, belt, leggings, boots
//   jewellery amulet, two rings, earrings
//   trinkets  two trinkets (battle-start effects from trinkets.js)
//   * BUYING: each piece is bought once with gold from a merchant (MERCHANT > HEIRLOOMS). A purchase
//     unlocks the piece for the whole account, so every hero on this device, in every save slot,
//     can then summon a copy for free from MAIN MENU > HEIRLOOMS, starting at level 1.
//   * Copies scale with the wearer: item level = hero level (1-720), so they never need replacing
//     while levelling. Stats are deliberately below good drops of the same level.
//   * The chest adapts to the hero's heaviest armour proficiency and the weapon comes in six styles.
//     Any class can wear the other pieces; they count toward their own set, not the armour-weight sets.
//   * The built-in bonus of the bases (saves, initiative, accuracy) is capped for heirlooms as a whole
//     at +1 / +2 / +3 (by level), so fourteen pieces cannot stack +40 to every save.
//   * Copies are soulbound: no auction, trade or salvage, and they sell for 0 G. Lose one and you
//     can summon it again. One copy of each piece per hero.
//   * Wearing 2 / 4 / 6 / 9 / 12 / 14 pieces grants the set bonus (XP first, like classic heirlooms).
// The pure rules (catalog, scaling, collection, prices, set bonus) are exported as GBQHeirlooms for
// tests; the game wiring below them runs only inside the game.

const HEIRLOOM_SET = { id: 'lanternborn', name: 'LANTERNBORN HEIRLOOMS', storeKey: 'gbq2_heirlooms' };
// two stats per piece; 'fixed' stats do not scale with level (keeps XP bonuses sane).
// Bases are chosen for their small built-in bonus (save / init / hit), not the level-scaled HP of
// kettle hats, amulets and chausses, so a full set does not multiply a level-1 hero's health.
// price: gold, paid once per account at a merchant
const HEIRLOOM_PIECES = [
  { id: 'hl_weapon', name: 'WEAPON', slot: 'weapon', kind: 'weapon', stats: ['dmg', 'crit'], price: 2000 },
  { id: 'hl_chest', name: 'CHEST', slot: 'armor', kind: 'armor', stats: ['hp', 'resist'], price: 1500 },
  { id: 'hl_helm', name: 'HELM', slot: 'head', kind: 'wondrous', base: 'circlet', stats: ['crit', 'resist'], price: 750 },
  { id: 'hl_cloak', name: 'CLOAK', slot: 'back', kind: 'wondrous', base: 'cloak', stats: ['dodge'], fixed: [['xp', 5]], price: 750 },
  { id: 'hl_gloves', name: 'GLOVES', slot: 'hands', kind: 'wondrous', base: 'bracers', stats: ['hit', 'critdmg'], price: 750 },
  { id: 'hl_belt', name: 'BELT', slot: 'waist', kind: 'wondrous', base: 'baldric', stats: ['haste', 'block'], price: 750 },
  { id: 'hl_legs', name: 'LEGGINGS', slot: 'legs', kind: 'wondrous', base: 'leggings', stats: ['hp', 'dodge'], price: 750 },
  { id: 'hl_boots', name: 'BOOTS', slot: 'feet', kind: 'wondrous', base: 'boots', stats: ['haste', 'resist'], price: 750 },
  // jewellery
  { id: 'hl_amulet', name: 'AMULET', slot: 'neck', kind: 'wondrous', base: 'pendant', stats: ['dmg'], fixed: [['xp', 5]], price: 1000, group: 'jewel' },
  { id: 'hl_ring1', name: 'RING', slot: 'ring', kind: 'wondrous', base: 'ring', stats: ['crit', 'dmg'], price: 1200, group: 'jewel' },
  { id: 'hl_ring2', name: 'BAND', slot: 'ring', kind: 'wondrous', base: 'band', stats: ['leech', 'resist'], price: 1200, group: 'jewel' },
  { id: 'hl_earrings', name: 'EARRINGS', slot: 'ear', kind: 'wondrous', base: 'earring', stats: ['crit', 'dodge'], price: 1000, group: 'jewel' },
  // trinkets (effects in trinkets.js: war horn = MIGHTY, lucky coin = FOCUSED at battle start)
  { id: 'hl_trinket1', name: 'WAR HORN', slot: 'trinket', kind: 'wondrous', base: 'war_horn', stats: ['dmg'], price: 2500, group: 'trinket' },
  { id: 'hl_trinket2', name: 'LUCKY COIN', slot: 'trinket', kind: 'wondrous', base: 'lucky_coin', stats: ['crit'], price: 2500, group: 'trinket' },
];
const heirloomPrice = id => (HEIRLOOM_BY_ID[id] || {}).price || 0;
const HEIRLOOM_BY_ID = Object.fromEntries(HEIRLOOM_PIECES.map(p => [p.id, p]));
// weapon styles: base weapon, display name and a replacement stat pair for casters
const HEIRLOOM_WEAPONS = {
  blade: { base: 'arming_sword', name: 'BLADE' },
  mace: { base: 'mace', name: 'MACE', stats: ['dmg', 'radiant'] },
  staff: { base: 'quarterstaff', name: 'STAFF', stats: ['dmg', 'heal'] },
  bow: { base: 'shortbow', name: 'LONGSHOT', stats: ['hit', 'crit'] },
  dagger: { base: 'dagger', name: 'FANG', stats: ['crit', 'critdmg'] },
  fist: { base: 'cestus', name: 'KNUCKLES', stats: ['haste', 'dmg'] },
};
// chest base by heaviest armour proficiency; cloth is wearable by everyone
const HEIRLOOM_CHESTS = { heavy: { base: 'chainmail', name: 'PLATE' }, medium: { base: 'chain_shirt', name: 'MAIL' }, light: { base: 'leather_jerkin', name: 'JERKIN' }, cloth: { base: 'travelrobe', name: 'ROBE' } };
// set bonus by equipped count; 'perLevel' values scale with the wearer's level
const HEIRLOOM_SET_BONUS = [
  { need: 2, stats: [['xp', 10]] },
  { need: 4, stats: [['xp', 10], ['resist', 3]], perLevel: [['hp', 5, 0.5]] },
  { need: 6, stats: [['dmg', 10], ['heal', 10]] },
  { need: 9, stats: [['xp', 10], ['gf', 15], ['mf', 15], ['crit', 3]] },
  { need: 12, stats: [['critdmg', 15], ['leech', 2]] },
  { need: 14, stats: [['dmg', 10], ['haste', 5]] },
];
// mirrors gen.js AFFIX_K / data_world.js SUBSTATS caps so the rules work outside the game too
const HL_AFFIX_K = { crit: 1.2, critdmg: 5, dodge: 0.8, block: 1.2, haste: 1.2, dmg: 3, heal: 3, resist: 1.2, hp: 5, hit: 0.2, radiant: 4, xp: 1.5, leech: 0.4 };
const HL_CAPS = { crit: 50, critdmg: 300, dodge: 40, block: 40, haste: 50, dmg: 500, heal: 200, resist: 60, hp: 99999, hit: 30, radiant: 300, xp: 200, leech: 20 };
const HL_LEVEL_MAX = 720;

const clampHeirloomLevel = lvl => Math.max(1, Math.min(HL_LEVEL_MAX, Math.floor(Number(lvl) || 1)));
// stat value at a hero level: about an uncommon/rare roll, below epic drops of the same level
function heirloomStat(stat, lvl) {
  const L = clampHeirloomLevel(lvl), k = HL_AFFIX_K[stat] || 1;
  return Math.max(1, Math.min(HL_CAPS[stat] || 9999, Math.round(k * (1 + L / 12) * 1.1)));
}
// +1 at level 1, one more every 240 levels, +3 at most. The same number caps the combined built-in
// save / init / hit / ... bonus of all equipped heirlooms (per bonus kind).
const heirloomPlus = lvl => Math.min(3, 1 + Math.floor((clampHeirloomLevel(lvl) - 1) / 240));
const heirloomBonusCap = heirloomPlus;
function heirloomStats(pieceId, lvl, style) {
  const p = HEIRLOOM_BY_ID[pieceId]; if (!p) return null;
  const stats = p.kind === 'weapon' && style && HEIRLOOM_WEAPONS[style] && HEIRLOOM_WEAPONS[style].stats || p.stats;
  return { ilvl: clampHeirloomLevel(lvl), plus: heirloomPlus(lvl), affixes: [...stats.map(s => [s, heirloomStat(s, lvl)]), ...(p.fixed || []).map(([s, v]) => [s, v])] };
}
// weapon style that suits a class definition ({ weapons, caster }) and class id
function defaultWeaponStyle(clsId, cls) {
  if (!cls) return 'blade';
  if (clsId === 'ascetic') return 'fist';
  if (clsId === 'strider') return 'bow';
  if (clsId === 'chaplain' || clsId === 'cantor') return 'mace';
  if (cls.weapons === 'finesse') return 'dagger';
  if (cls.caster === 'full' || cls.caster === 'pact') return 'staff';
  return cls.weapons === 'martial' ? 'blade' : 'mace';
}
const heaviestArmor = profs => ['heavy', 'medium', 'light'].find(t => (profs || []).includes(t)) || 'cloth';
function heirloomSetBonus(count, lvl) {
  const out = [], L = clampHeirloomLevel(lvl);
  for (const tier of HEIRLOOM_SET_BONUS) if (count >= tier.need) {
    out.push(...tier.stats.map(([s, v]) => [s, v]));
    for (const [s, base, per] of tier.perLevel || []) out.push([s, Math.round(base + per * L)]);
  }
  return out;
}
// ---------------------------------------------------------------- account collection
// { v, unlocked: [pieceIds], spent, summons, firstSummonAt, heroes: { "slot:name": true } }.
// v1 (the first release) unlocked the original nine pieces for free; collections saved by it keep them.
function normalizeCollection(raw) {
  const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const unlocked = new Set(Array.isArray(c.unlocked) ? c.unlocked.filter(id => HEIRLOOM_BY_ID[id]) : []);
  return {
    v: 2, unlocked: HEIRLOOM_PIECES.map(p => p.id).filter(id => unlocked.has(id)),
    spent: Math.max(0, Math.floor(Number(c.spent) || 0)),
    summons: Math.max(0, Math.floor(Number(c.summons) || 0)),
    firstSummonAt: Number(c.firstSummonAt) || null,
    heroes: c.heroes && typeof c.heroes === 'object' && !Array.isArray(c.heroes) ? Object.fromEntries(Object.entries(c.heroes).filter(([, v]) => v === true).slice(0, 200)) : {},
  };
}
// buy (unlock) a piece for the account: { ok, collection, gold } or { ok: false, error }
function buyHeirloom(collection, pieceId, gold) {
  const c = normalizeCollection(collection), p = HEIRLOOM_BY_ID[pieceId];
  if (!p) return { ok: false, error: 'No such heirloom.' };
  if (c.unlocked.includes(pieceId)) return { ok: false, error: 'Your account already owns that heirloom.' };
  const have = Math.max(0, Math.floor(Number(gold) || 0));
  if (have < p.price) return { ok: false, error: `It costs ${p.price} G. You have ${have} G.` };
  c.unlocked = HEIRLOOM_PIECES.map(x => x.id).filter(id => id === pieceId || c.unlocked.includes(id));
  c.spent += p.price;
  return { ok: true, collection: c, gold: have - p.price, cost: p.price };
}
function recordSummon(collection, heroKey, now) {
  const c = normalizeCollection(collection);
  c.summons++; if (!c.firstSummonAt) c.firstSummonAt = now || Date.now();
  if (heroKey) c.heroes[String(heroKey).slice(0, 40)] = true;
  return c;
}
// every heirloom copy a hero holds: equipped, in the bag, in the bank, or on companions
function heirloomCopies(hero) {
  const out = [];
  if (!hero) return out;
  const scan = (list, where, holder) => { for (const it of list || []) if (it && it.heirloom) out.push({ item: it, where, holder }); };
  const holders = [hero, ...(hero.companions || []), ...(hero.bench || [])];
  for (const h of holders) { scan(Object.values(h.eq || {}), 'eq', h); scan(h.bag, 'bag', h); }
  scan(hero.bank, 'bank', hero);
  return out;
}
const hasHeirloom = (hero, pieceId) => heirloomCopies(hero).some(c => c.item.heirloom === pieceId);
const equippedHeirloomCount = c => Object.values(c && c.eq || {}).filter(it => it && it.heirloom).length;

if (typeof globalThis !== 'undefined') globalThis.GBQHeirlooms = {
  HEIRLOOM_SET, HEIRLOOM_PIECES, HEIRLOOM_WEAPONS, HEIRLOOM_CHESTS, HEIRLOOM_SET_BONUS,
  heirloomStat, heirloomPlus, heirloomBonusCap, heirloomStats, defaultWeaponStyle, heaviestArmor, heirloomSetBonus,
  heirloomPrice, normalizeCollection, buyHeirloom, recordSummon, heirloomCopies, hasHeirloom, equippedHeirloomCount,
};

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof makeItem === 'function' && typeof ARMORS !== 'undefined') {
  const loadHeirloomCollection = () => normalizeCollection(store.get(HEIRLOOM_SET.storeKey));
  const saveHeirloomCollection = c => store.set(HEIRLOOM_SET.storeKey, c);
  const heroKey = () => G ? `${G.slot}:${String(G.name || '').slice(0, 24)}` : '';
  const styleOf = it => Object.keys(HEIRLOOM_WEAPONS).find(k => HEIRLOOM_WEAPONS[k].base === it.base) || 'blade';
  const chestFor = c => HEIRLOOM_CHESTS[heaviestArmor(CLASSES[c.cls] && CLASSES[c.cls].armor)];

  // rescale one copy to a level; keeps uid, base and style
  function syncHeirloom(it, lvl) {
    const st = heirloomStats(it.heirloom, lvl, it.kind === 'weapon' ? styleOf(it) : null); if (!st) return it;
    it.ilvl = st.ilvl; it.plus = st.plus; it.affixes = st.affixes.map(a => a.slice());
    it.rank = rankFor(it.ilvl).n; applyGearProgression(it);
    it.rarity = 7; it.value = 0; it.attune = false; it.bound = true; delete it.junk;
    return it;
  }
  // equipped copies scale to their wearer; carried or banked copies to the hero
  function syncAllHeirlooms() {
    if (!G) return;
    for (const { item, where, holder } of heirloomCopies(G)) syncHeirloom(item, where === 'eq' ? holder.lvl : G.lvl);
  }
  function makeHeirloom(pieceId, c, style) {
    const p = HEIRLOOM_BY_ID[pieceId]; if (!p) return null;
    const it = { uid: ITEM_UID++, kind: p.kind, heirloom: p.id, setId: HEIRLOOM_SET.id, rarity: 7, affixes: [], bound: true };
    if (p.kind === 'weapon') {
      const s = HEIRLOOM_WEAPONS[style] ? style : defaultWeaponStyle(c.cls, CLASSES[c.cls]);
      it.base = HEIRLOOM_WEAPONS[s].base; it.name = `LANTERNBORN ${HEIRLOOM_WEAPONS[s].name}`;
    } else if (p.kind === 'armor') {
      const ch = chestFor(c); it.base = ch.base; it.name = `LANTERNBORN ${ch.name}`;
    } else {
      // no it.slot / it.aclass on purpose: the slot comes from the base (itemSlot), and armory.js only
      // treats pieces with an explicit slot as CLOTH/LEATHER/MAIL/PLATE pieces. Heirlooms carry their own
      // set bonus instead, so a level-1 hero is not handed a full weight-class set on top of it.
      it.base = p.base; it.name = `LANTERNBORN ${p.name}`;
    }
    it.lore = 'Heirloom. Scales with your level. Shared by every hero on this account.';
    return syncHeirloom(it, c.lvl);
  }
  // summon one piece into the bag (and equip it when the slot is free). Returns an error string or null.
  function summonHeirloom(pieceId, opts = {}) {
    if (!G) return 'No hero loaded.';
    const col = loadHeirloomCollection();
    if (!col.unlocked.includes(pieceId)) return 'That heirloom is not unlocked.';
    if (hasHeirloom(G, pieceId)) return 'You already have that heirloom.';
    if (typeof BAG_MAX !== 'undefined' && G.bag.length >= BAG_MAX) return 'Your bag is full.';
    const it = makeHeirloom(pieceId, G, opts.style);
    G.bag.push(it);
    // equip straight away; whatever was in the slot goes to the bag (equipItem refuses only on a real conflict).
    // Rings and trinkets have two slots: use an empty one, else one that is not holding another heirloom.
    if (opts.equip !== false) { const slots = slotsFor(it), want = slots.find(s => !G.eq[s]) || slots.find(s => !G.eq[s].heirloom) || slots[0]; equipItem(G, it, G.bag, want); }
    saveHeirloomCollection(recordSummon(col, heroKey()));
    return null;
  }
  // summon and equip every unlocked piece this hero is missing; replaced gear goes to the bag
  function summonHeirloomSet() {
    const got = [], failed = [], owned = loadHeirloomCollection().unlocked;
    for (const p of HEIRLOOM_PIECES) { if (!owned.includes(p.id) || hasHeirloom(G, p.id)) continue; const why = summonHeirloom(p.id); (why ? failed : got).push(why ? `${p.name}: ${why}` : p.name); }
    return { got, failed, locked: HEIRLOOM_PIECES.length - owned.length };
  }
  // pay with this hero's gold; the piece unlocks for every hero on the account
  function buyHeirloomForAccount(pieceId) {
    if (!G) return 'No hero loaded.';
    const r = buyHeirloom(loadHeirloomCollection(), pieceId, G.gold);
    if (!r.ok) return r.error;
    G.gold = r.gold; saveHeirloomCollection(r.collection); saveGame();
    return null;
  }
  // swap the heirloom weapon's style in place (wherever it is)
  function restyleHeirloomWeapon(style) {
    const copy = heirloomCopies(G).find(c => c.item.heirloom === 'hl_weapon');
    if (!copy) return summonHeirloom('hl_weapon', { style });
    const fresh = makeHeirloom('hl_weapon', copy.holder, style);
    fresh.uid = copy.item.uid; Object.keys(copy.item).forEach(k => delete copy.item[k]); Object.assign(copy.item, fresh);
    if (copy.where === 'eq') { const why = canEquip(copy.holder, copy.item); if (why) { delete copy.holder.eq.weapon; G.bag.push(copy.item); return why; } }
    return null;
  }
  // return a copy to the collection (removes it from this hero)
  function returnHeirloom(it) {
    for (const h of [G, ...(G.companions || []), ...(G.bench || [])]) {
      for (const s of Object.keys(h.eq || {})) if (h.eq[s] === it) delete h.eq[s];
      for (const list of [h.bag, h === G ? G.bank : null]) if (Array.isArray(list)) { const i = list.indexOf(it); if (i >= 0) list.splice(i, 1); }
    }
  }
  Object.assign(window, { syncAllHeirlooms, summonHeirloom, summonHeirloomSet, buyHeirloomForAccount, restyleHeirloomWeapon, returnHeirloom, loadHeirloomCollection });

  // ---------------------------------------------------------------- hooks
  // set bonus rides on the armour-set hook that derive() already reads
  { const sb0 = armorSetBonus; armorSetBonus = function (c) { const out = sb0(c); const n = equippedHeirloomCount(c); return n >= 2 ? out.concat(heirloomSetBonus(n, c.lvl)) : out; }; }
  // the built-in save / init / hit / ... bonus of heirloom bases counts once for the whole set, capped by level.
  // (Same rule as rules.js for everything else: each wondrous item adds max(1, plus) to its bonus kind.)
  {
    wondrousBonus = function (c, kind) {
      let normal = 0, heir = 0;
      for (const slot of SLOTS) {
        const it = c.eq[slot]; if (!it || it.kind !== 'wondrous') continue;
        const w = WONDROUS.find(x => x.id === it.base); if (!w || w.bonus !== kind) continue;
        if (it.heirloom) heir += Math.max(1, it.plus); else normal += Math.max(1, it.plus);
      }
      return normal + Math.min(heir, heirloomBonusCap(c.lvl));
    };
  }
  // copies follow the hero's level
  { const gx0 = gainXP; gainXP = function (c, amount) { const before = c.lvl, r = gx0(c, amount); if (c.lvl !== before) syncAllHeirlooms(); return r; }; }
  { const ls0 = loadSlot; loadSlot = function (i) { const ok = ls0(i); if (ok) syncAllHeirlooms(); return ok; }; }
  // equipping onto a companion rescales the copy to that companion
  { const eq0 = equipItem; equipItem = function (c, it, bag, want) { if (it && it.heirloom) syncHeirloom(it, c.lvl); const why = eq0(c, it, bag, want); if (!why && G && c !== G) for (const { item, where } of heirloomCopies(G)) if (where !== 'eq') syncHeirloom(item, G.lvl); return why; }; }
  // soulbound: no auction house, no salvage
  if (typeof Market !== 'undefined' && Market.post) { const post0 = Market.post.bind(Market); Market.post = function (src, price) { if (src && src.item && src.item.heirloom) return Promise.resolve('Heirlooms are soulbound.'); return post0(src, price); }; }
  { const sv0 = salvage; salvage = function (it) { if (it && it.heirloom) return {}; return sv0(it); }; }
  // inventory: heirlooms get their own short menu instead of sell / salvage / auction / upgrade
  if (typeof InventoryScene !== 'undefined') {
    const gm0 = InventoryScene.prototype.gearMenu;
    InventoryScene.prototype.gearMenu = function (e) {
      if (!e || !e.heirloom) return gm0.call(this, e);
      if (this.mode === 'sell') return this.flash('HEIRLOOMS ARE SOULBOUND');
      const opts = ['EQUIP', 'COMPARE', ...(e.kind === 'weapon' ? ['CHANGE STYLE'] : []), 'RETURN TO COLLECTION', 'BACK'];
      choose(opts, k => {
        const o = opts[k] || 'BACK';
        if (o === 'EQUIP') { const why = equipItem(G, e, G.bag); SFX[why ? 'error' : 'equip'](); this.flash(why || `EQUIPPED ${e.name}`); }
        else if (o === 'COMPARE') push(new CompareScene(e));
        else if (o === 'CHANGE STYLE') heirloomStyleMenu();
        else if (o === 'RETURN TO COLLECTION') choose(['RETURN IT', 'KEEP IT'], y => { if (y !== 0) return; returnHeirloom(e); SFX.confirm(); this.flash('RETURNED. SUMMON IT ANY TIME.'); }, 'Summon it again from MENU > HEIRLOOMS.');
      }, e.name.slice(0, 24));
    };
  }
  // item text says it is an heirloom
  { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it); return it && it.heirloom ? `HEIRLOOM (SCALES TO LV ${it.ilvl}). ${s}` : s; }; }

  function heirloomStyleMenu(after) {
    const keys = Object.keys(HEIRLOOM_WEAPONS), cur = heirloomCopies(G).find(c => c.item.heirloom === 'hl_weapon');
    choose(keys.map(k => `${cur && styleOf(cur.item) === k ? '> ' : ''}${HEIRLOOM_WEAPONS[k].name} (${WEAPONS[HEIRLOOM_WEAPONS[k].base].name})`), k => {
      if (k < 0) return; const why = restyleHeirloomWeapon(keys[k]); SFX[why ? 'error' : 'equip'](); if (why) say(why); else toast('HEIRLOOM', `${HEIRLOOM_WEAPONS[keys[k]].name} STYLE`, 'item_chest', 'equip');
      if (after) after();
    }, 'Choose a weapon style');
  }

  // ---------------------------------------------------------------- MAIN MENU > HEIRLOOMS
  // MAIN MENU > HEIRLOOMS summons what the account owns; MERCHANT > HEIRLOOMS ({ vendor: true }) sells pieces.
  class HeirloomScene extends ListScene {
    constructor(opts = {}) { super(9); this.vendor = !!opts.vendor; syncAllHeirlooms(); }
    items() { return ['SET', ...HEIRLOOM_PIECES.map(p => p.id)]; }
    missing() { const owned = loadHeirloomCollection().unlocked; return HEIRLOOM_PIECES.filter(p => !owned.includes(p.id)); }
    buy(p, after) {
      choose([`BUY FOR ${fmt(p.price)} G`, 'NOT NOW'], k => {
        if (k !== 0) return;
        const why = buyHeirloomForAccount(p.id); SFX[why ? 'error' : 'buy']();
        if (why) return say(why);
        toast('HEIRLOOM', `${p.name} UNLOCKED`, 'item_coin', 'buy');
        if (after) after();
      }, `${p.name}: unlocks for every hero on this account. You have ${fmt(G.gold)} G.`);
    }
    update() {
      this.navList();
      if (P('b')) { SFX.back(); removeScene(this); return; }
      if (!P('a')) return;
      const id = this.items()[this.i];
      if (id === 'SET') {
        if (this.vendor) {
          const miss = this.missing(), total = miss.reduce((a, p) => a + p.price, 0);
          if (!miss.length) { SFX.error(); return say('Your account owns every heirloom.'); }
          return choose([`BUY ALL ${miss.length} FOR ${fmt(total)} G`, 'NOT NOW'], k => {
            if (k !== 0) return;
            if (G.gold < total) { SFX.error(); return say(`That costs ${fmt(total)} G. You have ${fmt(G.gold)} G.`); }
            for (const p of miss) buyHeirloomForAccount(p.id);
            SFX.heirloom_unlock(); say([`Unlocked ${miss.length} heirlooms for your account.`, 'Summon them from MENU > HEIRLOOMS.']);
          }, 'Unlock every missing piece for the whole account.');
        }
        const r = summonHeirloomSet();
        if (!r.got.length && !r.failed.length) { SFX.error(); return say(r.locked ? ['Nothing to summon.', `${r.locked} pieces are not unlocked yet.`, 'Buy them from a merchant: HEIRLOOMS.'] : 'You already carry every heirloom.'); }
        SFX[r.got.length ? 'levelup' : 'error'](); saveGame();
        return say([r.got.length ? `Summoned ${r.got.length}: ${r.got.join(', ')}.` : 'Nothing summoned.', ...r.failed.slice(0, 2), 'They are equipped. Your old gear is in your bag.', ...(r.locked ? [`${r.locked} more can be bought from a merchant.`] : [])]);
      }
      const p = HEIRLOOM_BY_ID[id], copy = heirloomCopies(G).find(c => c.item.heirloom === id);
      if (!loadHeirloomCollection().unlocked.includes(id)) {
        if (this.vendor) return this.buy(p);
        SFX.error(); return say([`${p.name} is not unlocked.`, `A merchant sells it for ${fmt(p.price)} G.`, 'Visit a merchant and choose HEIRLOOMS.']);
      }
      if (this.vendor && !copy) return choose(['SUMMON IT NOW', 'LATER'], k => { if (k === 0) this.summon(p); }, `Your account owns the ${p.name}.`);
      if (this.vendor) return say(`Your account owns the ${p.name}, and this hero carries it.`);
      if (copy && !this.vendor) {
        const opts = [...(p.kind === 'weapon' ? ['CHANGE STYLE'] : []), copy.where === 'eq' ? 'ALREADY EQUIPPED' : 'EQUIP NOW', 'BACK'];
        return choose(opts, k => {
          const o = opts[k];
          if (o === 'CHANGE STYLE') heirloomStyleMenu(() => saveGame());
          if (o === 'EQUIP NOW') { const bag = copy.where === 'bank' ? G.bank : G.bag, why = equipItem(G, copy.item, bag); SFX[why ? 'error' : 'equip'](); if (why) say(why); else saveGame(); }
        }, `${copy.item.name} is ${copy.where === 'eq' ? (copy.holder === G ? 'equipped' : 'on ' + copy.holder.name) : 'in your ' + copy.where}.`);
      }
      this.summon(p);
    }
    // summon one owned piece (the weapon asks for a style first)
    summon(p) {
      const go = style => { const why = summonHeirloom(p.id, { style }); SFX[why ? 'error' : 'levelup'](); if (why) say(why); else { saveGame(); toast('HEIRLOOM', `${p.name} SUMMONED`, 'item_chest', 'chest'); } };
      if (p.kind === 'weapon') { const keys = Object.keys(HEIRLOOM_WEAPONS), def = defaultWeaponStyle(G.cls, CLASSES[G.cls]); return choose(keys.map(k => `${HEIRLOOM_WEAPONS[k].name}${k === def ? ' (SUGGESTED)' : ''}`), k => { if (k >= 0) go(keys[k]); }, 'Choose a weapon style'); }
      go();
    }
    draw() {
      fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3); textC(this.vendor ? 'HEIRLOOM VENDOR' : 'HEIRLOOMS', 80, 1, 'gold');
      const n = equippedHeirloomCount(G), list = this.items(), owned = loadHeirloomCollection().unlocked;
      list.slice(this.top, this.top + this.rows).forEach((id, j) => {
        const i = this.top + j, y = 14 + j * 10; if (i === this.i) fill(2, y - 1, 152, 10, 1);
        if (id === 'SET') {
          if (this.vendor) { const miss = this.missing(); text('BUY ALL MISSING', 5, y, 'gold'); textR(miss.length ? fmt(miss.reduce((a, p) => a + p.price, 0)) + 'G' : 'OWNED', 152, y, 2); }
          else { text('SUMMON FULL SET', 5, y, 'gold'); textR(`${heirloomCopies(G).length}/${owned.length}`, 152, y, 2); }
          return;
        }
        const p = HEIRLOOM_BY_ID[id], copy = heirloomCopies(G).find(c => c.item.heirloom === id), own = owned.includes(id);
        text(p.name, 5, y, own ? (copy ? 3 : 2) : 1);
        const tag = !own ? (this.vendor ? fmt(p.price) + 'G' : 'LOCKED') : this.vendor ? 'OWNED' : copy ? (copy.where === 'eq' ? 'WORN' : copy.where.toUpperCase()) : 'SUMMON';
        textR(tag, 152, y, !own ? (this.vendor && G.gold >= p.price ? 'gold' : 1) : copy && copy.where === 'eq' ? 'green' : 2);
      });
      this.scrollbar(156, 13, 90);
      frame(1, 105, 158, 38);
      if (this.vendor) {
        const p = HEIRLOOM_BY_ID[list[this.i]];
        text(`GOLD ${fmt(G.gold)}  OWNED ${owned.length}/${HEIRLOOM_PIECES.length}`.slice(0, 25), 5, 107, 'gold');
        text(p ? `${p.name}: ${p.group === 'trinket' ? 'BATTLE-START BUFF' : p.group === 'jewel' ? 'JEWELLERY' : 'GEAR'}`.slice(0, 25) : 'UNLOCK EVERY MISSING PIECE', 5, 116, 2);
        text('BUY ONCE: ALL HEROES', 5, 125, 2); text('SUMMON FROM MENU>HEIRLOOMS', 5, 134, 1);
        return;
      }
      text(`SET ${n}/${HEIRLOOM_PIECES.length}  ITEM LV ${G.lvl}`, 5, 107, n >= 2 ? 'gold' : 2);
      const next = HEIRLOOM_SET_BONUS.find(t => n < t.need), totals = {};
      for (const [s, v] of heirloomSetBonus(n, G.lvl)) totals[s] = (totals[s] || 0) + v;
      const have = Object.entries(totals), short = { xp: 'XP', hp: 'HP', resist: 'RES', dmg: 'DMG', heal: 'HEAL', gf: 'GOLD', mf: 'MF', crit: 'CRIT', critdmg: 'CDMG', leech: 'LEECH', haste: 'HASTE' };
      text(have.length ? have.map(([s, v]) => `${short[s] || s.toUpperCase()}+${v}`).join(' ').slice(0, 25) : 'NO SET BONUS YET', 5, 116, have.length ? 'green' : 1);
      text(next ? `${next.need}PC: ${heirloomSetBonus(next.need, G.lvl).slice(-2).map(([s, v]) => `${SUBSTATS[s].name.slice(0, 5)}+${v}`).join(' ')}`.slice(0, 25) : 'FULL SET BONUS ACTIVE', 5, 125, next ? 2 : 'gold');
      text('SHARED BY ALL YOUR HEROES', 5, 134, 1);
    }
  }
  window.HeirloomScene = HeirloomScene;
}
