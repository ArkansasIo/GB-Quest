'use strict';
(() => { // own scope: every module loads as a classic script sharing one global scope
// ================================================================ GEAR AWAKENING (MAIN MENU > GEAR AWAKENING)
// Every weapon, armour and shield can be AWAKENED, star by star, into a stronger form of itself.
//   * STARS: 1-5. The cap depends on rarity: poor/common 1, uncommon 2, rare 3, epic 4, legendary+ 5.
//     Each star also needs a hero level: 1 / 10 / 25 / 45 / 70.
//   * PATH: the first star chooses the item's path (weapons and armour have their own). Every star adds the
//     path's stats; star III unlocks the path's AWAKENED TRAIT and star V its TRANSCENDENT TRAIT.
//   * BASE: weapons gain +DAMAGE% per star; armour gains MAX HP per star and +1 ARMOUR at stars II and IV.
//   * Values scale with item level (x(1 + ilvl/60)), so an awakened high-level item stays relevant.
//   * COST per star n: gold 60*n^2*(1+ilvl/10), AWAKENING STONES 2n-1, GLIMMER SHARDS n-2 from star III,
//     one EMBER SOUL at star V. Awakening never fails.
//   * STONES come from salvaging uncommon+ weapons and armour (+1, +2 for epic+, plus half the stones an
//     awakened item cost), or TRANSMUTE: 6 scrap + 1 shard + 50 G -> 1 stone.
//   * REFORGE changes an awakened item's path for gold and keeps its stars.
// Pure rules are exported as GBQGearAwaken for tests; the game wiring runs only inside the game.

const GA_MAX_STARS = 5;
const GA_STAR_CAP = [1, 1, 2, 3, 4, 5, 5, 5, 5];          // by rarity index
const GA_STAR_LEVEL = [1, 10, 25, 45, 70];                 // hero level needed for star n (index n-1)
const GA_STAR_NAME = ['I', 'II', 'III', 'IV', 'V'];
const GA_TRANSMUTE = { scrap: 6, shard: 1, gold: 50 };

// Each path: per-star stats ([stat, base value per star]; 'f' marks values scaled by item level),
// then the star III trait and the star V trait (flat stats, also level-scaled where marked).
const GA_PATHS = {
  weapon: {
    ember: { name: 'EMBER', desc: 'Burning edge. Fire damage climbs with every star.',
      per: [['fire', 6, 'f']], t3: { name: 'KINDLED', stats: [['crit', 3]], desc: '+3% crit chance.' },
      t5: { name: 'INFERNO HEART', stats: [['fire', 25, 'f'], ['critdmg', 20, 'f']], desc: 'Large fire and crit damage boost.' } },
    frost: { name: 'FROST', desc: 'Rime-bitten steel. Cold damage and a steady hand.',
      per: [['cold', 6, 'f']], t3: { name: 'GLACIAL', stats: [['hit', 1]], desc: '+1 accuracy.' },
      t5: { name: 'WINTER CROWN', stats: [['cold', 25, 'f'], ['block', 5]], desc: 'Large cold damage boost and +5% block.' } },
    storm: { name: 'STORM', desc: 'Crackling charge. Shock damage and quicker strikes.',
      per: [['lightning', 5, 'f'], ['haste', 1]], t3: { name: 'ARCING', stats: [['haste', 3]], desc: '+3% haste.' },
      t5: { name: 'TEMPEST', stats: [['lightning', 25, 'f'], ['haste', 5]], desc: 'Large shock damage and +5% haste.' } },
    void: { name: 'VOID', desc: 'Hungering dark. Shadow damage that drinks life.',
      per: [['necrotic', 5, 'f']], t3: { name: 'DEVOURING', stats: [['leech', 2]], desc: '+2% lifesteal.' },
      t5: { name: 'ABYSS MAW', stats: [['necrotic', 25, 'f'], ['leech', 3]], desc: 'Large shadow damage and +3% lifesteal.' } },
    dawn: { name: 'DAWN', desc: 'Sunlit blade. Holy damage and keen strikes.',
      per: [['radiant', 5, 'f']], t3: { name: 'HALLOWED', stats: [['crit', 2], ['heal', 5]], desc: '+2% crit, +5% healing.' },
      t5: { name: 'SOLAR JUDGE', stats: [['radiant', 25, 'f'], ['crit', 4]], desc: 'Large holy damage and +4% crit.' } },
    titan: { name: 'TITAN', desc: 'Raw might. Bigger hits and brutal crits.',
      per: [['critdmg', 6, 'f']], t3: { name: 'CRUSHING', stats: [['dmg', 6, 'f']], desc: 'Extra damage %.' },
      t5: { name: 'WORLD SPLITTER', stats: [['critdmg', 30, 'f'], ['hit', 1]], desc: 'Huge crit damage and +1 accuracy.' } },
  },
  armor: {
    bulwark: { name: 'BULWARK', desc: 'Unyielding plate. Block more blows.',
      per: [['block', 2]], t3: { name: 'BASTION', stats: [['acb', 1]], desc: '+1 armour.' },
      t5: { name: 'LIVING FORTRESS', stats: [['acb', 1], ['block', 6]], desc: '+1 armour and +6% block.' } },
    warding: { name: 'WARDING', desc: 'Runed lining. Resist every element.',
      per: [['resist', 2]], t3: { name: 'SPELLBANE', stats: [['resist', 3]], desc: '+3% resist all.' },
      t5: { name: 'NULL AEGIS', stats: [['resist', 6], ['hp', 20, 'f']], desc: '+6% resist all and max HP.' } },
    vigor: { name: 'VIGOR', desc: 'Heartwood weave. More life and stronger healing.',
      per: [['hp', 10, 'f'], ['heal', 2]], t3: { name: 'EVERGREEN', stats: [['heal', 6]], desc: '+6% healing.' },
      t5: { name: 'WORLDTREE SAP', stats: [['hp', 50, 'f'], ['leech', 2]], desc: 'Large max HP and +2% lifesteal.' } },
    shadow: { name: 'SHADOW', desc: 'Gloom-dyed leather. Slip past attacks.',
      per: [['dodge', 2]], t3: { name: 'UMBRAL STEP', stats: [['haste', 3]], desc: '+3% haste.' },
      t5: { name: 'NIGHT VEIL', stats: [['dodge', 6], ['crit', 3]], desc: '+6% dodge and +3% crit.' } },
    thorn: { name: 'THORN', desc: 'Barbed mail. Attackers bleed for it.',
      per: [['thorns', 6, 'f']], t3: { name: 'BRIAR SKIN', stats: [['acb', 1]], desc: '+1 armour.' },
      t5: { name: 'IRON BRAMBLE', stats: [['thorns', 30, 'f'], ['resist', 4]], desc: 'Large thorns and +4% resist all.' } },
  },
};

const gaFamily = it => it && it.kind === 'weapon' ? 'weapon' : it && it.kind === 'armor' ? 'armor' : null;
const gaCanAwaken = it => !!gaFamily(it);
const gaScale = it => 1 + Math.max(1, Number(it && it.ilvl) || 1) / 60;
const gaState = it => { const a = it && it.awk; return { stars: Math.max(0, Math.min(GA_MAX_STARS, Math.floor(Number(a && a.stars) || 0))), path: a && a.path || null }; };
const gaCap = it => GA_STAR_CAP[Math.max(0, Math.min(GA_STAR_CAP.length - 1, Number(it && it.rarity) || 0))];
const gaPath = it => { const f = gaFamily(it), s = gaState(it); return f && s.path ? GA_PATHS[f][s.path] || null : null; };
const gaVal = (it, v, scaled) => Math.max(1, Math.round(scaled ? v * gaScale(it) : v));

// All stats an item gets from its awakening, at `stars` (defaults to its current stars), as [[stat, value]].
function gaStats(it, stars, pathId) {
  const fam = gaFamily(it); if (!fam) return [];
  const st = gaState(it), n = stars == null ? st.stars : stars, pid = pathId || st.path;
  if (!n) return [];
  const out = {}, add = (k, v) => { out[k] = (out[k] || 0) + v; };
  if (fam === 'weapon') add('dmg', gaVal(it, 4 * n, true));
  else { add('hp', gaVal(it, 8 * n, true)); if (n >= 2) add('acb', 1); if (n >= 4) add('acb', 1); }
  const p = pid && GA_PATHS[fam][pid];
  if (p) {
    for (const [k, v, f] of p.per) add(k, gaVal(it, v * n, f === 'f'));
    if (n >= 3) for (const [k, v, f] of p.t3.stats) add(k, gaVal(it, v, f === 'f'));
    if (n >= 5) for (const [k, v, f] of p.t5.stats) add(k, gaVal(it, v, f === 'f'));
  }
  return Object.entries(out);
}
// Cost of the NEXT star (n = current stars + 1).
function gaCost(it, n) {
  const k = n == null ? gaState(it).stars + 1 : n, lv = Math.max(1, Number(it && it.ilvl) || 1);
  return { gold: Math.round(60 * k * k * (1 + lv / 10)), stone: 2 * k - 1, shard: k >= 3 ? k - 2 : 0, ember: k >= 5 ? 1 : 0 };
}
function gaSpentStones(it) { let s = 0; for (let k = 1; k <= gaState(it).stars; k++) s += gaCost(it, k).stone; return s; }
const gaReforgeCost = it => Math.round(200 * Math.max(1, gaState(it).stars) * (1 + Math.max(1, Number(it && it.ilvl) || 1) / 10));
// Why the next star can't be taken (null when it can). inv: { awk_stone, shard, ember }, gold, heroLvl.
function gaBlock(it, heroLvl, inv, gold) {
  if (!gaCanAwaken(it)) return 'Only weapons and armour can be awakened.';
  const s = gaState(it), n = s.stars + 1, cap = gaCap(it);
  if (s.stars >= GA_MAX_STARS) return 'Fully awakened.';
  if (n > cap) return `This rarity awakens to ${GA_STAR_NAME[cap - 1]} stars at most.`;
  if (heroLvl < GA_STAR_LEVEL[n - 1]) return `Star ${GA_STAR_NAME[n - 1]} needs hero level ${GA_STAR_LEVEL[n - 1]}.`;
  const c = gaCost(it, n), have = inv || {};
  if ((have.awk_stone || 0) < c.stone) return `Needs ${c.stone} awakening stones (you have ${have.awk_stone || 0}).`;
  if ((have.shard || 0) < c.shard) return `Needs ${c.shard} glimmer shards.`;
  if ((have.ember || 0) < c.ember) return `Needs ${c.ember} ember soul.`;
  if ((gold || 0) < c.gold) return `Needs ${c.gold} G.`;
  return null;
}
// Apply one star (pure: returns the new awk state). pathId is required for the first star.
function gaNext(it, pathId) {
  const s = gaState(it), fam = gaFamily(it);
  const path = s.path || pathId;
  if (!fam || !path || !GA_PATHS[fam][path]) throw new Error('awakening needs a valid path');
  return { stars: s.stars + 1, path };
}
const gaStarText = it => { const n = gaState(it).stars; return n ? '*'.repeat(n) : ''; };

if (typeof globalThis !== 'undefined') globalThis.GBQGearAwaken = {
  GA_PATHS, GA_STAR_CAP, GA_STAR_LEVEL, GA_MAX_STARS, GA_TRANSMUTE, gaStats, gaCost, gaBlock, gaNext, gaState, gaCap, gaSpentStones, gaReforgeCost, gaCanAwaken, gaStarText,
};

// ---------------------------------------------------------------- game wiring
if (typeof window === 'undefined' || typeof ITEMS === 'undefined' || typeof SUBSTATS === 'undefined') return;

ITEMS.awk_stone = { name: 'AWAKENING STONE', icon: 'ne_gem_6', type: 'mat', price: 40, desc: 'Wakes the power sleeping in weapons and armour.' };
window.awakenAffixes = it => gaStats(it);
window.gaStarText = gaStarText;

// stats: fold awakening into the gear affix totals
if (typeof gearAffixes === 'function') {
  const g0 = gearAffixes;
  gearAffixes = function (c) {
    const s = g0.apply(this, arguments);
    for (const slot of SLOTS) { const it = c && c.eq && c.eq[slot]; if (!it || !gaState(it).stars) continue; for (const [k, v] of gaStats(it)) s[k] = (s[k] || 0) + v; }
    return s;
  };
}
// upgrade arrows and gear score see awakened items as stronger
if (typeof itemScore === 'function') { const s0 = itemScore; itemScore = function (c, it) { return s0.apply(this, arguments) + gaState(it).stars * 12; }; }
// salvage: stones from uncommon+ weapons/armour, plus half the stones an awakened item cost
window.SALVAGE_EXTRAS = (window.SALVAGE_EXTRAS || []).concat(it => gaCanAwaken(it) ? { awk_stone: (it.rarity >= 2 ? 1 : 0) + (it.rarity >= 4 ? 1 : 0) + Math.floor(gaSpentStones(it) / 2) } : null);

const statLine = ([k, v]) => `${(SUBSTATS[k] ? SUBSTATS[k].name : k.toUpperCase())} +${v}${SUBSTATS[k] && SUBSTATS[k].unit === '%' ? '%' : ''}`;
// every weapon and armour piece you carry: equipped first
function gaPieces() {
  const out = [];
  for (const slot of SLOTS) { const it = G.eq[slot]; if (gaCanAwaken(it)) out.push({ it, eq: slot }); }
  for (const it of G.bag || []) if (gaCanAwaken(it)) out.push({ it, eq: null });
  return out;
}
function payStar(it, pathId) {
  const why = gaBlock(it, G.lvl, G.inv, G.gold); if (why) { SFX.error(); return say(why); }
  const c = gaCost(it);
  G.gold -= c.gold; G.inv.awk_stone -= c.stone; if (c.shard) G.inv.shard -= c.shard; if (c.ember) G.inv.ember -= c.ember;
  it.awk = gaNext(it, pathId);
  const D = derive(G); G.hp = Math.min(G.hp, D.hpMax);
  saveGame(); SFX.act_complete ? SFX.act_complete() : SFX.confirm();
  const p = gaPath(it), n = it.awk.stars;
  toast(`AWAKENED ${GA_STAR_NAME[n - 1]}`, `${it.name}`, itemIcon(it), 'buff');
  if (n === 3 || n === 5) say([`${p.name} ${n === 3 ? 'AWAKENED TRAIT' : 'TRANSCENDENT TRAIT'}:`, `${(n === 3 ? p.t3 : p.t5).name}`, (n === 3 ? p.t3 : p.t5).desc]);
}

class GearAwakenScene extends ListScene {
  constructor() { super(6); }
  items() { return gaPieces(); }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { // transmute
      const T = GA_TRANSMUTE;
      if ((G.inv.scrap || 0) < T.scrap || (G.inv.shard || 0) < T.shard || G.gold < T.gold) { SFX.error(); return say([`TRANSMUTE: ${T.scrap} scrap + ${T.shard} shard + ${T.gold} G`, 'makes 1 awakening stone.', `You have ${G.inv.scrap || 0} scrap, ${G.inv.shard || 0} shard.`]); }
      G.inv.scrap -= T.scrap; G.inv.shard -= T.shard; G.gold -= T.gold; addItem('awk_stone', 1); saveGame(); SFX.buy(); return toast('TRANSMUTED', '+1 AWAKENING STONE', ITEMS.awk_stone.icon, 'confirm');
    }
    const row = this.items()[this.i]; if (!row) return;
    const it = row.it, st = gaState(it), fam = gaFamily(it);
    if (P('start') && st.stars) { // reforge path
      const cost = gaReforgeCost(it), ids = Object.keys(GA_PATHS[fam]).filter(k => k !== st.path);
      return choose([...ids.map(k => GA_PATHS[fam][k].name), 'CANCEL'], k => {
        if (k < 0 || k >= ids.length) return;
        if (G.gold < cost) { SFX.error(); return say(`Reforging costs ${cost} G.`); }
        G.gold -= cost; it.awk = { stars: st.stars, path: ids[k] }; saveGame(); SFX.confirm(); toast('REFORGED', GA_PATHS[fam][ids[k]].name + ' PATH', itemIcon(it), 'confirm');
      }, `REFORGE PATH: ${cost} G (stars kept)`);
    }
    if (!P('a')) return;
    const why = gaBlock(it, G.lvl, G.inv, G.gold); if (why) { SFX.error(); return say(why); }
    if (st.path) return payStar(it);
    const ids = Object.keys(GA_PATHS[fam]);
    choose([...ids.map(k => GA_PATHS[fam][k].name), 'CANCEL'], k => {
      if (k < 0 || k >= ids.length) return;
      const p = GA_PATHS[fam][ids[k]];
      choose([`AWAKEN AS ${p.name}`, 'BACK'], j => { if (j === 0) payStar(it, ids[k]); }, p.desc);
    }, 'CHOOSE A PATH (can reforge later)');
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const L = this.items();
    text('GEAR AWAKENING', 4, 13, 'gold'); textR(`STONES ${G.inv.awk_stone || 0}`, 156, 13, 2);
    if (!L.length) { textC('NO WEAPONS OR ARMOUR.', 80, 60, 2); textC('B  BACK', 80, 136, 2); return; }
    for (let r = 0; r < this.rows; r++) {
      const k = this.top + r, row = L[k]; if (!row) break;
      const it = row.it, y = 23 + r * 10, sel = k === this.i, st = gaState(it), cap = gaCap(it);
      if (sel) fill(2, y - 1, 152, 10, 1);
      const ic = itemIcon(it); if (ic && IMG[ic]) blit(sprFit(ic, 8), 4, y); else fill(5, y + 1, 6, 6, rarityCol(it.rarity || 1));
      text(it.name, 15, y, row.eq ? 'gold' : 3, 1, 118);
      // stars: filled up to current, dim up to the rarity cap
      for (let s = 0; s < cap; s++) fill(122 + s * 6, y + 2, 4, 4, s < st.stars ? 'gold' : 2);
    }
    this.scrollbar(155, 23, 59);
    const row = L[this.i], it = row && row.it; if (!it) return;
    const st = gaState(it), p = gaPath(it), cap = gaCap(it), next = st.stars < cap ? st.stars + 1 : 0;
    frame(2, 84, 156, 50);
    text(`${st.stars ? GA_STAR_NAME[st.stars - 1] : '-'} / ${GA_STAR_NAME[cap - 1]}  ${p ? p.name : 'NO PATH'}`, 6, 87, 'gold', 1, 154);
    text(row.eq ? 'EQUIPPED' : 'IN BAG', 154 - (row.eq ? 48 : 36), 87, 2);
    const now = gaStats(it).slice(0, 2).map(statLine);
    text(now.length ? now.join('  ') : 'NOT AWAKENED', 6, 97, 3, 1, 154);
    if (next) {
      const c = gaCost(it, next), lvlOk = G.lvl >= GA_STAR_LEVEL[next - 1];
      const gain = gaStats(it, next, st.path || Object.keys(GA_PATHS[gaFamily(it)])[0]);
      const before = Object.fromEntries(gaStats(it)), diff = gain.map(([k, v]) => [k, v - (before[k] || 0)]).filter(([, v]) => v > 0).slice(0, 2);
      text(st.path ? `NEXT: ${diff.map(statLine).join(' ') || '-'}` : `NEXT: ${statLine(diff[0] || ['dmg', 0])} + PATH`, 6, 107, 2, 1, 154);
      const parts = [`${c.stone}ST`, c.shard ? `${c.shard}SH` : '', c.ember ? `${c.ember}EM` : '', `${c.gold}G`].filter(Boolean).join(' ');
      text(lvlOk ? `COST ${parts}` : `NEEDS HERO LV ${GA_STAR_LEVEL[next - 1]}`, 6, 117, lvlOk ? 3 : 'red', 1, 154);
      if (next === 3 || next === 5) { const t = p ? (next === 3 ? p.t3 : p.t5) : null; text(t ? `UNLOCKS ${t.name}` : `STAR ${GA_STAR_NAME[next - 1]} UNLOCKS A TRAIT`, 6, 126, 'gold', 1, 154); }
    } else text(st.stars >= GA_MAX_STARS ? 'FULLY AWAKENED' : 'RARITY CAP REACHED', 6, 112, 'gold');
    fill(0, 135, W, 9, 0);
    text(st.stars ? 'A:STAR ST:PATH' : 'A:AWAKEN', 3, 136, 'gold'); textR('SEL:STONE', 157, 136, 2);
  }
}
window.GearAwakenScene = GearAwakenScene;

// item detail line and main-menu entry
if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('ARMOURY'); L.splice(at >= 0 ? at + 1 : L.length, 0, 'GEAR AWAKENING'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'GEAR AWAKENING') { SFX.select(); return push(new GearAwakenScene()); } return u0.apply(this, arguments); };
}
window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { 'GEAR AWAKENING': 'Awaken weapons and armour: 5 stars, 11 paths, traits at III and V.' });
})();
