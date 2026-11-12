'use strict';
(() => {
// ================================================================ GAMBLER & LOOT FILTER
// GAMBLER (MAIN MENU > GAMBLER): spend GLIMMER SHARDS on an item of the slot you pick; its rarity is a roll.
//   * Odds: uncommon 55%, rare 30%, epic 11%, legendary 3.5%, mythic 0.5% (mythic from hero level 40,
//     legendary from 8, epic from 5, following the rarity gates).
//   * PITY: 20 gambles in a row without a legendary or better makes the next one legendary.
//   * Cost per slot (x(1 + level/20)): armour pieces and jewellery 6-10, weapons 8, relics 20, artifacts 25.
//   * Shards come from salvaging rare+ gear and from rifts.
// LOOT FILTER (MAIN MENU > LOOT FILTER): new gear below the chosen rarity is salvaged or sold as it drops.
//   Never filtered: favourites, heirlooms, relics, artifacts, awakened items, set pieces and epic+ gear.
// Pure rules are exported as GBQGambler for tests; the game wiring runs only inside the game.

// rarity index (items.js: 0 poor, 1 common, 2 uncommon, 3 rare, 4 epic, 5 legendary, 6 mythic), chance
const GAMBLE_ODDS = [[6, 0.005], [5, 0.035], [4, 0.11], [3, 0.30], [2, 0.55]];
const GAMBLE_GATE = { 6: 40, 5: 8, 4: 5, 3: 1, 2: 1 }; // hero level each rarity needs (RARITY_GATE)
const LEGENDARY = 5;
const PITY = 20;
const FILTER_LEVELS = [
  { id: 'off', name: 'OFF', keep: 0 },
  { id: 'common', name: 'COMMON+', keep: 1 },
  { id: 'uncommon', name: 'UNCOMMON+', keep: 2 },
  { id: 'rare', name: 'RARE+', keep: 3 },
];
const FILTER_ACTIONS = ['salvage', 'sell'];
const FILTER_MAX_KEEP = 3; // the filter never asks for more than rare; epic (4) and better are never filtered

const gambleCost = (base, heroLvl) => Math.round(base * (1 + Math.floor(Math.max(1, Number(heroLvl) || 1) / 20)));
// roll a rarity with u in [0,1); sinceLegendary = gambles since the last legendary+
function gambleRarity(u, heroLvl, sinceLegendary = 0) {
  const L = Math.max(1, Number(heroLvl) || 1);
  if (sinceLegendary >= PITY - 1 && L >= GAMBLE_GATE[LEGENDARY]) return LEGENDARY;
  let acc = 0;
  for (const [r0, p] of GAMBLE_ODDS) { acc += p; if (u < acc) { let r = r0; while (r > 2 && L < GAMBLE_GATE[r]) r--; return r; } }
  return 2;
}
// what the loot filter does with an item: 'keep' | 'salvage' | 'sell'
function filterDecision(it, filter) {
  const f = filter || {}, lvl = FILTER_LEVELS.find(x => x.id === f.level) || FILTER_LEVELS[0];
  if (!it || lvl.keep <= 0) return 'keep';
  if (!['weapon', 'armor', 'wondrous'].includes(it.kind)) return 'keep';
  if (it.fav || it.heirloom || it.awk && it.awk.stars || it.setId || it.set || it.locked) return 'keep';
  if (it.kind === 'wondrous' && /^(relic|artifact)_/.test(String(it.base || ''))) return 'keep';
  const r = Number(it.rarity) || 0;
  if (r >= Math.min(lvl.keep, FILTER_MAX_KEEP) || r >= 4) return 'keep';
  return FILTER_ACTIONS.includes(f.action) ? f.action : 'salvage';
}
function normFilter(f) { const o = f && typeof f === 'object' ? f : {}; return { level: FILTER_LEVELS.some(x => x.id === o.level) ? o.level : 'off', action: FILTER_ACTIONS.includes(o.action) ? o.action : 'salvage', count: Math.max(0, Math.floor(Number(o.count) || 0)), gold: Math.max(0, Math.floor(Number(o.gold) || 0)) }; }

if (typeof globalThis !== 'undefined') globalThis.GBQGambler = { GAMBLE_ODDS, GAMBLE_GATE, PITY, LEGENDARY, FILTER_LEVELS, FILTER_ACTIONS, gambleCost, gambleRarity, filterDecision, normFilter };

// ---------------------------------------------------------------- game wiring
if (typeof window === 'undefined' || typeof makeItem !== 'function' || typeof WONDROUS === 'undefined') return;

const SLOT_COST = { weapon: 8, armor: 6, head: 6, neck: 10, ear: 10, back: 6, hands: 6, waist: 6, legs: 6, feet: 6, ring: 10, trinket: 10, relic: 20, artifact: 25 };
const SLOT_LABEL = { weapon: 'WEAPON', armor: 'CHEST / SHIELD', head: 'HEAD', neck: 'AMULET', ear: 'EARRINGS', back: 'CLOAK', hands: 'GLOVES', waist: 'BELT', legs: 'LEGS', feet: 'BOOTS', ring: 'RING', trinket: 'TRINKET', relic: 'RELIC', artifact: 'ARTIFACT' };
function gambleSlots() {
  const have = new Set(WONDROUS.map(w => w.slot));
  return Object.keys(SLOT_COST).filter(k => k === 'weapon' || k === 'armor' || have.has(k));
}
const GS = () => { if (!G.gamble || typeof G.gamble.count !== 'number') G.gamble = { count: 0, since: 0, best: 0 }; return G.gamble; };
const LF = () => { if (!G.lootFilter || typeof G.lootFilter.count !== 'number') G.lootFilter = normFilter(G.lootFilter); return G.lootFilter; };

function gamble(slot) {
  const cost = gambleCost(SLOT_COST[slot], G.lvl), g = GS();
  if ((G.inv.shard || 0) < cost) { SFX.error(); return say([`${SLOT_LABEL[slot]} costs ${cost} glimmer shards.`, `You have ${G.inv.shard || 0}. Salvage rare gear or run rifts.`]); }
  if (G.bag.length >= BAG_MAX) { SFX.error(); return say('Your bag is full.'); }
  const rarity = gambleRarity(R(), G.lvl, g.since);
  let it;
  if (slot === 'weapon' || slot === 'armor') it = makeItem({ kind: slot, lvl: G.lvl, rarity });
  else { const pool = WONDROUS.filter(w => w.slot === slot); it = makeItem({ kind: 'wondrous', base: pick(pool).id, lvl: G.lvl, rarity }); }
  G.inv.shard -= cost; g.count++; g.best = Math.max(g.best, it.rarity); g.since = it.rarity >= LEGENDARY ? 0 : g.since + 1;
  G.bag.push(it); if (it.rarity >= 4) G.stats.epics = (G.stats.epics || 0) + 1;
  saveGame(); (it.rarity >= LEGENDARY ? SFX.jackpot : it.rarity >= 4 ? SFX.chest : SFX.gamble)();
  const R0 = RARITY[it.rarity] || RARITY[2];
  toast(R0.name, it.name, itemIcon(it), 'confirm');
  if (typeof chatLog === 'function') chatLog('loot', 'GAMBLER', `You gamble [${it.name}] (${R0.name}) for ${cost} shards.`);
}

class GamblerScene extends ListScene {
  constructor() { super(7); }
  items() { return gambleSlots(); }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { SFX.select(); return push(new LootFilterScene()); }
    if (P('a')) { const s = this.items()[this.i]; if (s) gamble(s); }
  }
  draw() {
    const L = this.items(), g = GS();
    fill(0, 0, W, H, 0); hdr();
    text('GAMBLER', 4, 13, 'gold'); textR(`SHARDS ${G.inv.shard || 0}`, 156, 13, 2);
    for (let r = 0; r < this.rows; r++) {
      const k = this.top + r, s = L[k]; if (!s) break;
      const y = 23 + r * 10, cost = gambleCost(SLOT_COST[s], G.lvl), can = (G.inv.shard || 0) >= cost;
      if (k === this.i) fill(2, y - 1, 152, 10, 1);
      text(SLOT_LABEL[s], 6, y, 3); textR(`${cost}`, 140, y, can ? 'gold' : 2);
      if (IMG.ne_gem_1) blit(sprFit('ne_gem_1', 8), 143, y);
    }
    this.scrollbar(155, 23, 69);
    frame(2, 94, 156, 40);
    text('ODDS  RARE 30%  EPIC 11%', 6, 97, 2, 1, 154);
    text(`LEGENDARY 3.5%${G.lvl >= 40 ? '  MYTHIC 0.5%' : ''}`, 6, 106, G.lvl >= 8 ? 'gold' : 2, 1, 154);
    text(`PITY ${g.since}/${PITY}  GAMBLED ${g.count}`, 6, 115, 3, 1, 154);
    text(g.best ? `BEST ${(RARITY[g.best] || RARITY[2]).name}` : 'NO GAMBLES YET', 6, 123, g.best >= LEGENDARY ? 'gold' : 2, 1, 154);
    fill(0, 135, W, 9, 0); text('A:GAMBLE', 3, 136, 'gold'); textR('SEL:LOOT FILTER', 157, 136, 2);
  }
}
class LootFilterScene {
  constructor() { this.opaque = true; this.i = 0; }
  update() {
    const f = LF();
    if (P('b') || P('a') && this.i === 2) { SFX.back(); removeScene(this); saveGame(); return; }
    if (nav('up')) { this.i = (this.i + 2) % 3; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % 3; SFX.cursor(); }
    const step = nav('right') || P('a') ? 1 : nav('left') ? -1 : 0;
    if (!step) return;
    if (this.i === 0) { const k = FILTER_LEVELS.findIndex(x => x.id === f.level); f.level = FILTER_LEVELS[(k + step + FILTER_LEVELS.length) % FILTER_LEVELS.length].id; SFX.toggle(); }
    if (this.i === 1) { f.action = f.action === 'salvage' ? 'sell' : 'salvage'; SFX.toggle(); }
  }
  draw() {
    const f = LF(), lvl = FILTER_LEVELS.find(x => x.id === f.level) || FILTER_LEVELS[0];
    fill(0, 0, W, H, 0); hdr();
    text('LOOT FILTER', 4, 13, 'gold');
    const rows = [['KEEP', lvl.name], ['OTHERS', f.action === 'sell' ? 'AUTO-SELL' : 'AUTO-SALVAGE'], ['DONE', '']];
    rows.forEach(([k, v], i) => { const y = 26 + i * 13; if (i === this.i) fill(2, y - 2, 156, 12, 1); text(k, 8, y, 3); if (v) textR(`< ${v} >`, 152, y, 'gold'); });
    frame(2, 66, 156, 68);
    text(lvl.keep ? `Drops below ${(RARITY[lvl.keep] || RARITY[1]).name}` : 'Every drop goes to your bag.', 6, 70, 3, 1, 154);
    if (lvl.keep) text(f.action === 'sell' ? 'are sold for gold.' : 'become materials.', 6, 79, 3, 1, 154);
    text('NEVER FILTERED: FAVOURITES,', 6, 92, 2, 1, 154);
    text('HEIRLOOMS, RELICS, ARTIFACTS,', 6, 101, 2, 1, 154);
    text('AWAKENED, SETS AND EPIC+', 6, 110, 2, 1, 154);
    text(`FILTERED ${f.count}  GOLD ${fmt(f.gold)}`, 6, 122, 'gold', 1, 154);
    fill(0, 135, W, 9, 0); text('L/R:CHANGE', 3, 136, 'gold'); textR('B:DONE', 157, 136, 2);
  }
}
window.GamblerScene = GamblerScene; window.LootFilterScene = LootFilterScene;

// the filter: wrap addGear (loot, chests, mail-to-bag) so filtered drops never reach the bag
if (typeof addGear === 'function') {
  const ag0 = addGear;
  addGear = function (it) {
    if (!G || !it) return ag0.apply(this, arguments);
    const f = LF(), d = filterDecision(it, f);
    if (d === 'keep') return ag0.apply(this, arguments);
    f.count++;
    if (d === 'sell') { const v = Math.max(1, Math.floor((it.value || 1) / 4)); G.gold += v; f.gold += v; if (typeof chatLog === 'function') chatLog('loot', 'FILTER', `Sold [${it.name}] for ${v} G.`); }
    else { const y = typeof salvageYield === 'function' ? salvageYield(it) : { scrap: 1 }; for (const k in y) addItem(k, y[k]); if (typeof chatLog === 'function') chatLog('loot', 'FILTER', `Salvaged [${it.name}].`); }
    return true;
  };
}

if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('CRAFTING'); L.splice(at >= 0 ? at + 1 : L.length, 0, 'GAMBLER', 'LOOT FILTER'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () {
    if (P('a')) { const o = this.items()[this.i]; if (o === 'GAMBLER') { SFX.select(); return push(new GamblerScene()); } if (o === 'LOOT FILTER') { SFX.select(); return push(new LootFilterScene()); } }
    return u0.apply(this, arguments);
  };
}
window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { GAMBLER: 'Spend glimmer shards on gear of a chosen slot. Pity at 20.', 'LOOT FILTER': 'Auto-salvage or sell drops below a rarity.' });
})();
