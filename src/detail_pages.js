'use strict';
(() => {
// ================================================================ DETAIL PAGES (MAIN MENU > DETAILS)
// A hub of in-depth pages for the character and gear systems:
//   * STAT BREAKDOWN: every substat with each source it comes from (item affixes, gems, runes, tier implicits,
//     awakening, armour sets, ascension, companion bond, talents, boons, buffs, other) and the final value
//     after attribute bonuses and caps; plus a CORE page (HP, AC, accuracy, initiative, attributes, saves).
//   * GEAR OVERVIEW: every equipment slot with item level, rarity, durability, awakening stars, gems and runes.
//     A opens ITEM DETAIL: OVERVIEW / STATS / SOCKETS & AWAKENING / VALUE pages (LEFT/RIGHT).
//   * PROGRESS SUMMARY: every progression system on one page each (character, gear, collections, endgame).
// Pure helpers are exported as GBQDetails for tests; the game wiring runs only inside the game.

const SOURCE_ORDER = ['affix', 'gem', 'rune', 'tier', 'awaken', 'set', 'ascension', 'bond', 'talent', 'boon', 'buff', 'other'];
const SOURCE_NAME = { affix: 'ITEM AFFIXES', gem: 'GEMS', rune: 'RUNES', tier: 'TIER IMPLICIT', awaken: 'AWAKENING', set: 'ARMOUR SETS', ascension: 'ASCENSION', bond: 'COMPANION BOND', talent: 'TALENTS', boon: 'MYTHIC BOONS', buff: 'BUFFS', other: 'OTHER' };
// merge [{source, stat, value}] into { stat: { total, parts: [[source, value]] } }, adding 'other' so parts sum to the real total
function breakdown(rows, totals) {
  const out = {};
  for (const { source, stat, value } of rows) {
    if (!value) continue;
    const o = out[stat] || (out[stat] = { total: 0, parts: {} });
    o.parts[source] = (o.parts[source] || 0) + value; o.total += value;
  }
  for (const [stat, t] of Object.entries(totals || {})) {
    const o = out[stat] || (out[stat] = { total: 0, parts: {} }), diff = Math.round((t - o.total) * 100) / 100;
    if (Math.abs(diff) >= 0.01) { o.parts.other = (o.parts.other || 0) + diff; o.total = t; }
  }
  for (const o of Object.values(out)) o.parts = SOURCE_ORDER.filter(s => o.parts[s]).map(s => [s, Math.round(o.parts[s] * 100) / 100]);
  return out;
}
const pct = (v, max) => Math.max(0, Math.min(100, Math.round(100 * v / Math.max(1, max))));

if (typeof globalThis !== 'undefined') globalThis.GBQDetails = { SOURCE_ORDER, SOURCE_NAME, breakdown, pct };

// ---------------------------------------------------------------- game wiring
if (typeof window === 'undefined' || typeof derive !== 'function' || typeof SLOTS === 'undefined') return;

const entries = obj => Array.isArray(obj) ? obj : Object.entries(obj || {});
function statRows(c) {
  const rows = [], add = (source, list, mul = 1) => { for (const [stat, v] of entries(list)) rows.push({ source, stat, value: (Number(v) || 0) * mul }); };
  for (const slot of SLOTS) {
    const it = c.eq[slot]; if (!it) continue;
    add('affix', it.affixes || []);
    if (typeof gemAffixes === 'function') add('gem', gemAffixes(it));
    if (typeof runeAffixes === 'function') add('rune', runeAffixes(it));
    if (typeof tierImplicit === 'function') add('tier', tierImplicit(it));
    if (typeof awakenAffixes === 'function') add('awaken', awakenAffixes(it));
  }
  if (typeof armorSetBonus === 'function') add('set', armorSetBonus(c));
  for (const k in c.ascSub || {}) rows.push({ source: 'ascension', stat: k, value: c.ascSub[k] * ((typeof AFFIX_K !== 'undefined' && AFFIX_K[k]) || 1) });
  for (const k in c.bond || {}) rows.push({ source: 'bond', stat: k, value: c.bond[k] * ((typeof AFFIX_K !== 'undefined' && AFFIX_K[k]) || 1) });
  if (typeof TALENT_TREES !== 'undefined') for (const tree of TALENT_TREES) for (const t of tree.nodes) if ((c.talents || []).includes(t.id)) add('talent', t.mods);
  if (typeof MYTHIC_BOONS !== 'undefined') for (const b of c.boons || []) { const bo = MYTHIC_BOONS.find(x => x.id === b); if (bo) add('boon', bo.sub); }
  for (const bf of c.buffs || []) { const def = typeof BUFFS !== 'undefined' && BUFFS[bf.id]; if (def && def.mods) add('buff', def.mods, bf.stacks || 1); }
  return rows;
}
const subName = k => (typeof SUBSTATS !== 'undefined' && SUBSTATS[k] ? SUBSTATS[k].name : k.toUpperCase());
const subUnit = k => (typeof SUBSTATS !== 'undefined' && SUBSTATS[k] && SUBSTATS[k].unit === '%' ? '%' : '');
const signed = v => `${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
// final values after attributes and caps, where derive() reports them
function finalValue(D, k) {
  const direct = { crit: D.crit, critdmg: D.critdmg, dodge: D.dodge, block: D.block, leech: D.leech, haste: D.haste, resist: D.resistAll };
  return direct[k] != null ? direct[k] : null;
}

// ---- shared list chrome
function listChrome(scene, title, right) { fill(0, 0, W, H, 0); hdr(); text(title, 4, 13, 'gold', 1, 110); if (right) textR(right, 156, 13, 2); }
function footer(l, r) { fill(0, 135, W, 9, 0); text(l, 3, 136, 'gold'); if (r) textR(r, 157, 136, 2); }

class StatBreakdownScene extends ListScene {
  constructor() { super(6); this.page = 0; }
  data() {
    const D = derive(G), b = breakdown(statRows(G), D.sub || {});
    const keys = Object.keys(typeof SUBSTATS !== 'undefined' ? SUBSTATS : b).filter(k => b[k] && b[k].total || finalValue(D, k));
    return { D, b, keys };
  }
  items() { return this.page === 0 ? this.data().keys : ['HP', 'AC', 'ACCURACY', 'INITIATIVE', 'PROFICIENCY', 'ATTRIBUTES', 'SAVES']; }
  update() {
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { this.page ^= 1; this.i = this.top = 0; SFX.page(); return; }
    this.navList();
  }
  draw() {
    const { D, b, keys } = this.data();
    listChrome(this, this.page ? 'CORE STATS' : 'STAT BREAKDOWN', this.page ? 'PAGE 2/2' : `${keys.length} STATS`);
    const L = this.items();
    for (let r = 0; r < this.rows; r++) {
      const k = this.top + r, key = L[k]; if (key == null) break;
      const y = 23 + r * 10; if (k === this.i) fill(2, y - 1, 152, 10, 1);
      if (this.page === 0) { const f = finalValue(D, key), o = b[key]; text(subName(key), 6, y, 3, 1, 110); textR(`${f != null ? f : Math.round((o ? o.total : 0) * 10) / 10}${subUnit(key)}`, 152, y, 'gold'); }
      else { text(key, 6, y, 3); textR(this.coreValue(D, key), 152, y, 'gold'); }
    }
    this.scrollbar(155, 23, 59);
    frame(2, 84, 156, 50);
    const key = L[this.i]; if (key == null) return footer('B:BACK', 'SEL:PAGE');
    if (this.page === 0) {
      const o = b[key] || { parts: [] }, f = finalValue(D, key);
      text(`${subName(key)} SOURCES`, 6, 87, 'gold', 1, 154);
      const parts = o.parts.slice(0, 4);
      if (!parts.length) text('FROM ATTRIBUTES ONLY', 6, 97, 2);
      parts.forEach(([s, v], i) => { text(SOURCE_NAME[s], 6, 97 + i * 8, 2, 1, 110); textR(`${signed(v)}${subUnit(key)}`, 154, 97 + i * 8, 3); });
      if (o.parts.length > 4) text(`+${o.parts.length - 4} MORE`, 6, 128, 2);
      else if (f != null && Math.round(f) !== Math.round(o.total || 0)) text(`FINAL ${f}${subUnit(key)} (ATTRIBUTES/CAP)`, 6, 128, 'gold', 1, 154);
    } else this.coreDetail(D, key).forEach((l, i) => text(l, 6, 87 + i * 9, i ? 2 : 'gold', 1, 154));
    footer('B:BACK', this.page ? 'SEL:SUBSTATS' : 'SEL:CORE');
  }
  coreValue(D, k) {
    if (k === 'HP') return `${G.hp}/${D.hpMax}`;
    if (k === 'AC') return String(D.ac);
    if (k === 'ACCURACY') return signed(D.weapon ? D.weapon.hit : 0);
    if (k === 'INITIATIVE') return signed(D.init);
    if (k === 'PROFICIENCY') return signed(D.pb);
    if (k === 'ATTRIBUTES') return `${Object.keys(D.A).length}`;
    if (k === 'SAVES') return `${Object.keys(D.saves || {}).length}`;
    return '';
  }
  coreDetail(D, k) {
    const M = D.M || {};
    if (k === 'HP') return ['MAX HP', `LEVEL ${G.lvl}  CON ${signed(M.CON || 0)}`, `GEAR HP ${signed(D.sub && D.sub.hp || 0)}`, `HIT DICE ${G.hd || 0}/${D.hdMax}`];
    if (k === 'AC') return ['ARMOUR CLASS', `BASE ARMOUR + DEX`, `GEAR ARMOUR ${signed(D.sub && D.sub.acb || 0)}`, `BLOCK ${D.block}%  DODGE ${D.dodge}%`];
    if (k === 'ACCURACY') return ['WEAPON ACCURACY', `PROFICIENCY ${signed(D.pb)}`, `GEAR ${signed(D.sub && D.sub.hit || 0)}`, `CRIT ON ${D.critRange}+  ${D.crit}%`];
    if (k === 'INITIATIVE') return ['INITIATIVE', `DEX ${signed(M.DEX || 0)}  SPD ${signed(M.SPD || 0)}`, `HASTE ${D.haste}%`, 'HIGHER GOES FIRST'];
    if (k === 'PROFICIENCY') return ['PROFICIENCY BONUS', `CLASS LEVEL ${D.CL}`, '+1 EVERY 60 LEVELS PAST 20', ''];
    if (k === 'ATTRIBUTES') return [Object.entries(D.A).slice(0, 3).map(([a, v]) => `${a} ${v}`).join(' '), Object.entries(D.A).slice(3, 6).map(([a, v]) => `${a} ${v}`).join(' '), Object.entries(D.A).slice(6, 9).map(([a, v]) => `${a} ${v}`).join(' '), `PRIMARY ${CLASSES[G.cls].primary}`];
    if (k === 'SAVES') { const s = Object.entries(D.saves || {}); return ['SAVING THROWS', s.slice(0, 3).map(([a, v]) => `${a}${signed(v)}`).join(' '), s.slice(3, 6).map(([a, v]) => `${a}${signed(v)}`).join(' '), s.slice(6, 9).map(([a, v]) => `${a}${signed(v)}`).join(' ')]; }
    return [k];
  }
}

const durPct = it => { const m = Number(it.maxDur ?? it.maxDurability), d = Number(it.dur ?? it.durability); return Number.isFinite(m) && m > 0 && Number.isFinite(d) ? pct(d, m) : null; };
const stars = it => (it && it.awk && it.awk.stars) || 0;
const sockets = it => ({ gems: Array.isArray(it.sockets) ? it.sockets.filter(Boolean).length : 0, gemMax: typeof gemSocketCapacity === 'function' ? gemSocketCapacity(it) : 0,
  runes: Array.isArray(it.runeSockets) ? it.runeSockets.filter(Boolean).length : 0, runeMax: typeof runeSocketCapacity === 'function' ? runeSocketCapacity(it) : 0 });
const slotName = s => (typeof SLOT_NAME !== 'undefined' && SLOT_NAME[s]) || s.toUpperCase();

class GearOverviewScene extends ListScene {
  constructor() { super(7); }
  items() { return SLOTS.slice(); }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a')) { const it = G.eq[this.items()[this.i]]; if (it) { SFX.select(); push(new ItemDetailScene(it, this.items()[this.i])); } else SFX.error(); }
  }
  draw() {
    const L = this.items(), worn = L.filter(s => G.eq[s]), avg = worn.length ? Math.round(worn.reduce((a, s) => a + (G.eq[s].ilvl || 1), 0) / worn.length) : 0;
    listChrome(this, 'GEAR OVERVIEW', `${worn.length}/${L.length} ILVL ${avg}`);
    for (let r = 0; r < this.rows; r++) {
      const k = this.top + r, s = L[k]; if (!s) break;
      const it = G.eq[s], y = 23 + r * 10; if (k === this.i) fill(2, y - 1, 152, 10, 1);
      text(slotName(s).slice(0, 9), 6, y, 2);
      if (it) { fill(62, y + 1, 3, 6, rarityCol(it.rarity === undefined ? 1 : it.rarity)); text(it.name, 68, y, 3, 1, 128); const n = stars(it); if (n) textR('*'.repeat(n), 152, y, 'gold'); }
      else text('EMPTY', 68, y, 1);
    }
    this.scrollbar(155, 23, 69);
    frame(2, 94, 156, 40);
    const s = L[this.i], it = G.eq[s];
    if (!it) { text(`${slotName(s)}: NOTHING EQUIPPED`, 6, 98, 2, 1, 154); text('EQUIP FROM THE BAG OR GEAR', 6, 108, 2, 1, 154); return footer('B:BACK'); }
    const R0 = (typeof RARITY !== 'undefined' && RARITY[it.rarity]) || { name: '?' }, d = durPct(it), so = sockets(it);
    text(`${R0.name}  ILVL ${it.ilvl || 1}  ${typeof itemKeyStat === 'function' ? itemKeyStat(it) : ''}`, 6, 98, 'gold', 1, 154);
    text(`DUR ${d == null ? 'N/A' : d + '%'}  GEMS ${so.gems}/${so.gemMax}  RUNES ${so.runes}/${so.runeMax}`, 6, 108, d != null && d < 25 ? 'red' : 2, 1, 154);
    text(`AFFIXES ${(it.affixes || []).length}  AWAKENED ${stars(it) ? stars(it) + ' STAR' : 'NO'}`, 6, 118, 2, 1, 154);
    footer('A:ITEM DETAIL', 'B:BACK');
  }
}

class ItemDetailScene {
  constructor(it, slot) { this.opaque = true; this.it = it; this.slot = slot || (typeof itemSlot === 'function' ? itemSlot(it) : ''); this.page = 0; }
  pages() { return ['OVERVIEW', 'STATS', 'SOCKETS', 'VALUE']; }
  update() {
    const n = this.pages().length;
    if (P('b') || P('a')) { SFX.back(); removeScene(this); return; }
    if (nav('right') || P('select')) { this.page = (this.page + 1) % n; SFX.page(); }
    if (nav('left')) { this.page = (this.page + n - 1) % n; SFX.page(); }
  }
  lines() {
    const it = this.it, R0 = (typeof RARITY !== 'undefined' && RARITY[it.rarity]) || { name: '?' }, P0 = this.pages()[this.page];
    if (P0 === 'OVERVIEW') return [[R0.name, 'gold'], [`SLOT ${slotName(this.slot)}`], [`ITEM LEVEL ${it.ilvl || 1}  RANK ${it.rank || 1}`], [typeof itemKeyStat === 'function' ? itemKeyStat(it) : ''], [`UPGRADE +${Math.max(0, it.plus || 0)}`], [it.attune ? 'ATTUNEMENT REQUIRED' : 'NO ATTUNEMENT'], [it.legend ? `LEGENDARY: ${it.legend.name}` : (it.setId || it.set ? `SET ${String(it.setId || it.set).replace(/_/g, ' ')}` : 'NO SET')]];
    if (P0 === 'STATS') {
      const out = [['ITEM AFFIXES', 'gold']]; for (const [k, v] of it.affixes || []) out.push([`${subName(k)} +${v}${subUnit(k)}`]);
      if (!(it.affixes || []).length) out.push(['NONE', 1]);
      if (typeof tierImplicit === 'function') for (const [k, v] of tierImplicit(it)) out.push([`TIER ${subName(k)} +${v}`, 2]);
      return out;
    }
    if (P0 === 'SOCKETS') {
      const so = sockets(it), out = [['GEMS & RUNES', 'gold'], [`GEMS ${so.gems}/${so.gemMax}  RUNES ${so.runes}/${so.runeMax}`]];
      if (typeof gemAffixes === 'function') for (const [k, v] of Object.entries(gemAffixes(it))) out.push([`GEM ${subName(k)} +${v}`, 2]);
      if (typeof runeAffixes === 'function') for (const [k, v] of Object.entries(runeAffixes(it))) out.push([`RUNE ${subName(k)} +${v}`, 2]);
      const n = stars(it); out.push([n ? `AWAKENED ${'*'.repeat(n)} ${String(it.awk.path || '').toUpperCase()}` : 'NOT AWAKENED', n ? 'gold' : 2]);
      if (n && typeof awakenAffixes === 'function') for (const [k, v] of awakenAffixes(it)) out.push([`${subName(k)} +${v}${subUnit(k)}`, 3]);
      return out;
    }
    const d = durPct(it), score = typeof itemScore === 'function' ? Math.round(itemScore(G, it)) : 0;
    return [['VALUE & CONDITION', 'gold'], [`SELL ${fmt(Math.max(1, Math.floor((it.value || 1) / 4)))} G`], [`WORTH ${fmt(it.value || 0)} G`], [`ITEM SCORE ${score}`], [`DURABILITY ${d == null ? 'N/A' : d + '%'}`, d != null && d < 25 ? 'red' : 3], [it.fav ? 'FAVOURITE' : it.junk ? 'MARKED AS JUNK' : ''], [it.heirloom ? 'HEIRLOOM (ACCOUNT-WIDE)' : '']];
  }
  draw() {
    const it = this.it;
    fill(0, 0, W, H, 0); hdr();
    const ic = typeof itemIcon === 'function' ? itemIcon(it) : null;
    fill(4, 14, 18, 18, rarityCol(it.rarity === undefined ? 1 : it.rarity)); fill(5, 15, 16, 16, 0); if (ic && IMG[ic]) blit(sprFit(ic, 14), 6, 16);
    text(it.name, 26, 15, 'gold', 1, 156); text(`< ${this.pages()[this.page]} ${this.page + 1}/${this.pages().length} >`, 26, 24, 2, 1, 156);
    frame(2, 35, 156, 99);
    this.lines().filter(l => l[0]).slice(0, 10).forEach(([t, c], i) => text(t, 6, 39 + i * 9, c || 3, 1, 154));
    footer('L/R:PAGE', 'B:BACK');
  }
}

class ProgressSummaryScene {
  constructor() { this.opaque = true; this.page = 0; }
  pages() {
    const D = derive(G), xpNow = G.xp - (typeof xpForLevel === 'function' ? xpForLevel(G.lvl) : 0), xpNeed = typeof xpForLevel === 'function' ? xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)) - xpForLevel(G.lvl) : 1;
    const worn = SLOTS.map(s => G.eq[s]).filter(Boolean), awk = worn.filter(it => stars(it)).length;
    const relics = typeof WONDROUS !== 'undefined' ? ['relic', 'artifact'].map(k => { const ids = WONDROUS.filter(w => w.slot === k).map(w => w.id); const own = new Set([...(G.bag || []), ...worn, ...(G.bank || [])].filter(it => it && ids.includes(it.base)).map(it => it.base)); return `${own.size}/${ids.length}`; }) : ['-', '-'];
    const rift = G.rift || {}, season = G.season, tier = season && typeof seasonXp === 'function' ? Math.floor(seasonXp() / 1000) : 0;
    return [
      ['CHARACTER', [`${G.name}  LV ${G.lvl}/${LEVEL_CAP}`, `${CLASSES[G.cls].name}`, `XP ${pct(xpNow, xpNeed)}% TO NEXT LEVEL`, `HP ${G.hp}/${D.hpMax}  AC ${D.ac}`, `GOLD ${fmt(G.gold)}`, `TALENTS ${(G.talents || []).length}  SKILLS ${(G.activeSkills || []).length}`]],
      ['GEAR', [`EQUIPPED ${worn.length}/${SLOTS.length}`, `AVG ITEM LEVEL ${worn.length ? Math.round(worn.reduce((a, it) => a + (it.ilvl || 1), 0) / worn.length) : 0}`, `AWAKENED PIECES ${awk}`, `AWAKENING STONES ${G.inv.awk_stone || 0}`, `BAG ${G.bag.length}/${BAG_MAX}`, `SHARDS ${G.inv.shard || 0}  SCRAP ${G.inv.scrap || 0}`]],
      ['COLLECTIONS', [`RELICS FOUND ${relics[0]}`, `ARTIFACTS FOUND ${relics[1]}`, `ACHIEVEMENTS ${Object.keys(G.ach || G.achievements || {}).length}`, `TITLES ${Object.keys(G.titlesWon || {}).length}`, `GAMBLED ${(G.gamble && G.gamble.count) || 0}`, `RUNES SET ${Object.keys(G.skillRunes || {}).length}`]],
      ['ENDGAME', [`GREATER RIFT BEST ${rift.best || 0}`, `RIFTS CLOSED ${rift.closed || 0}  KEYS ${rift.keys || 0}`, `SEASON TIER ${Math.min(50, tier)}/50`, `DUNGEONS ${G.stats.dungeons || 0}  RAIDS ${G.stats.raids || 0}`, `BOSSES ${G.stats.worldBosses || 0}  DEATHS ${G.stats.deaths || 0}`, `DIFFICULTY ${typeof diffOf === 'function' ? diffOf().name : G.difficulty}`]],
    ];
  }
  update() {
    const n = 4;
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('right') || P('select') || nav('down')) { this.page = (this.page + 1) % n; SFX.page(); }
    if (nav('left') || nav('up')) { this.page = (this.page + n - 1) % n; SFX.page(); }
  }
  draw() {
    const pages = this.pages(), [title, lines] = pages[this.page];
    fill(0, 0, W, H, 0); hdr();
    text('PROGRESS SUMMARY', 4, 13, 'gold'); textR(`${this.page + 1}/${pages.length}`, 156, 13, 2);
    pages.forEach(([t], i) => { const x = 2 + i * 39; fill(x, 23, 38, 10, i === this.page ? 3 : 'rgba(28,24,62,.92)'); textC(t.slice(0, 6), x + 19, 24, i === this.page ? 0 : 2); });
    frame(2, 36, 156, 98);
    text(title, 6, 40, 'gold');
    lines.forEach((l, i) => text(l, 6, 52 + i * 12, 3, 1, 154));
    footer('L/R:PAGE', 'B:BACK');
  }
}

class DetailHubScene extends ListScene {
  constructor() { super(6); }
  items() { return [['STAT BREAKDOWN', 'Every stat and where it comes from.'], ['GEAR OVERVIEW', 'All slots, durability, sockets, stars.'], ['PROGRESS SUMMARY', 'Character, gear, collections, endgame.'], ['RELICS', 'The 42 relics.'], ['ARTIFACTS', 'The 42 artifacts.'], ['GEAR AWAKENING', 'Awaken weapons and armour.']]; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    SFX.select();
    const o = this.items()[this.i][0];
    if (o === 'STAT BREAKDOWN') push(new StatBreakdownScene());
    else if (o === 'GEAR OVERVIEW') push(new GearOverviewScene());
    else if (o === 'PROGRESS SUMMARY') push(new ProgressSummaryScene());
    else if (o === 'RELICS' && typeof RelicCodexScene === 'function') push(new RelicCodexScene('relic'));
    else if (o === 'ARTIFACTS' && typeof RelicCodexScene === 'function') push(new RelicCodexScene('artifact'));
    else if (o === 'GEAR AWAKENING' && typeof GearAwakenScene === 'function') push(new GearAwakenScene());
  }
  draw() {
    const L = this.items();
    listChrome(this, 'CHARACTER DETAILS', `${L.length} PAGES`);
    L.forEach(([n], k) => { const y = 25 + k * 12; if (k === this.i) fill(2, y - 2, 152, 11, 1); text(n, 8, y, 3); });
    frame(2, 100, 156, 34);
    wrap(L[this.i][1], 25).slice(0, 2).forEach((l, i) => text(l, 6, 105 + i * 10, 2, 1, 154));
    footer('A:OPEN', 'B:BACK');
  }
}
Object.assign(window, { StatBreakdownScene, GearOverviewScene, ItemDetailScene, ProgressSummaryScene, DetailHubScene });

// entry: MAIN MENU > DETAILS (right under CHARACTER)
if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('CHARACTER'); L.splice(at >= 0 ? at + 1 : 0, 0, 'DETAILS'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'DETAILS') { SFX.select(); return push(new DetailHubScene()); } return u0.apply(this, arguments); };
}
window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { DETAILS: 'Stat breakdown, gear overview, item detail and progress summary.' });
// other screens can open the item detail page for any item
window.openItemDetail = (it, slot) => it && push(new ItemDetailScene(it, slot));
})();
