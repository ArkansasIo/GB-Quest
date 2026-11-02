// ================================================================ PROFESSION PERK TREES
// A commander-style skill grid for every profession (modelled on naval-MMO captain trees):
//   * 4 tiers x 6 perks. A tier-N perk costs N points.
//   * Up to 21 points per profession: 1 at skill 1, then +1 every 36 skill ranks (21 at 720).
//   * To learn a tier-N perk you must own at least one perk in tier N-1.
//   * All 60 points' worth of perks cannot be owned at once, so every build is a choice.
//   * Perks are kept until a full reset (100 G per point spent) refunds them all.
// Perks stack with the older yield / efficiency / mastery rank branches.

const PERK_MAX = 21;
const PERK_TIER_COST = [1, 2, 3, 4];
const GATHER_PROFS = ['herb', 'mining', 'forestry', 'hidecraft', 'fish', 'salvaging', 'relic', 'cultivation', 'beast_lore'];

// effect key -> [label, how a value reads]
const PERK_FX = {
  double: ['DOUBLE', v => `${Math.round(v * 100)}% chance to double the haul`],
  rare: ['RARE FIND', v => `${Math.round(v * 100)}% chance of a bonus rare material`],
  xp: ['STUDY', v => `+${Math.round(v * 100)}% chance to gain a skill rank`],
  gold: ['CONTRACTS', v => `+${Math.round(v * 100)}% gold from work orders and quests`],
  pxp: ['VETERAN', v => `+${v} hero XP every time you gather or craft`],
  respawn: ['SWIFT', v => `nodes regrow ${Math.round(v * 100)}% faster`],
  check: ['KEEN EYE', v => `+${v} to gathering checks`],
  save: ['THRIFT', v => `${Math.round(v * 100)}% chance to keep the materials`],
  extra: ['MASTERWORK', v => `${Math.round(v * 100)}% chance of one extra item`],
};

// [name, effect, value] per tier. Gathering and crafting professions share a shape.
const PERK_GATHER = [
  [['KEEN EYE', 'check', 2], ['QUICK HANDS', 'respawn', 0.15], ['APPRENTICE', 'xp', 0.10], ['FIELD PACK', 'gold', 0.05], ['STEADY PACE', 'pxp', 5], ['LUCKY FIND', 'rare', 0.02]],
  [['BOUNTIFUL', 'double', 0.08], ['TRAINED EYE', 'check', 3], ['JOURNEYMAN', 'xp', 0.15], ['TRADER', 'gold', 0.10], ['PATHFINDER', 'respawn', 0.25], ['PROSPECTOR', 'rare', 0.04]],
  [['RICH HARVEST', 'double', 0.12], ['EXPERT', 'xp', 0.20], ['WILD LUCK', 'rare', 0.06], ['GUILD CONTRACTS', 'gold', 0.15], ['SEASONED', 'pxp', 15], ['DEEP SENSE', 'check', 5]],
  [['GRAND HARVEST', 'double', 0.20], ['GRANDMASTER', 'xp', 0.30], ['TREASURE SENSE', 'rare', 0.10], ['MERCHANT PRINCE', 'gold', 0.25], ['ENDLESS FIELDS', 'respawn', 0.50], ['LIVING LEGEND', 'pxp', 30]],
];
const PERK_CRAFT = [
  [['CAREFUL MEASURE', 'save', 0.05], ['STEADY HANDS', 'extra', 0.05], ['APPRENTICE', 'xp', 0.10], ['SHOP FRONT', 'gold', 0.05], ['DILIGENT', 'pxp', 5], ['SCRAP SENSE', 'rare', 0.03]],
  [['FRUGAL', 'save', 0.10], ['FINE WORK', 'extra', 0.10], ['JOURNEYMAN', 'xp', 0.15], ['TRADER', 'gold', 0.10], ['DOUBLE BATCH', 'double', 0.05], ['RESIDUE', 'rare', 0.05]],
  [['NOTHING WASTED', 'save', 0.15], ['MASTERWORK', 'extra', 0.15], ['EXPERT', 'xp', 0.20], ['GUILD CONTRACTS', 'gold', 0.15], ['SEASONED', 'pxp', 15], ['GREAT BATCH', 'double', 0.10]],
  [['PERFECT ECONOMY', 'save', 0.25], ['LEGENDARY WORK', 'extra', 0.25], ['GRANDMASTER', 'xp', 0.30], ['MERCHANT PRINCE', 'gold', 0.25], ['LIVING LEGEND', 'pxp', 30], ['ARTISAN DREAM', 'rare', 0.10]],
];
// each profession's bonus rare material and the flavour of its capstone
const PERK_RARE_ITEM = { herb: 'shard', mining: 'shard', forestry: 'shard', hidecraft: 'shard', fish: 'shard', salvaging: 'ember', relic: 'ember', cultivation: 'shard', beast_lore: 'shard', alch: 'shard', cook: 'shard', blacksmith: 'ember', armorsmith: 'ember', weaponsmith: 'ember' };
const PERK_FISH_NOTE = { respawn: v => `${Math.round(v * 100)}% better odds of big fish`, check: v => `bite window +${v * 2} frames` };

const PERK_TREES = {};
for (const k of Object.keys(PROFS)) {
  const shape = GATHER_PROFS.includes(k) ? PERK_GATHER : PERK_CRAFT;
  PERK_TREES[k] = shape.map((row, t) => row.map(([name, fx, v], c) => ({ id: `t${t}_${c}`, tier: t, cost: PERK_TIER_COST[t], name, fx, v })));
}
const perkDef = (k, id) => { const t = PERK_TREES[k]; if (!t) return null; const [a, b] = id.slice(1).split('_').map(Number); return t[a] && t[a][b] || null; };
function perkDesc(k, p) { return (k === 'fish' && PERK_FISH_NOTE[p.fx] ? PERK_FISH_NOTE[p.fx] : PERK_FX[p.fx][1])(p.v); }

function perkList(k) {
  if (!G.profPerks || typeof G.profPerks !== 'object') G.profPerks = {};
  if (!Array.isArray(G.profPerks[k])) G.profPerks[k] = [];
  G.profPerks[k] = G.profPerks[k].filter(id => perkDef(k, id));
  return G.profPerks[k];
}
const perkPoints = k => { const s = (G.prof && G.prof[k]) || 0; return s < 1 ? 0 : Math.min(PERK_MAX, 1 + Math.floor(s / 36)); };
const perkSpent = k => perkList(k).reduce((n, id) => n + perkDef(k, id).cost, 0);
const perkFree = k => Math.max(0, perkPoints(k) - perkSpent(k));
const perkTierOpen = (k, t) => t === 0 || perkList(k).some(id => perkDef(k, id).tier === t - 1);
const hasPerk = (k, id) => perkList(k).includes(id);
// summed value of one effect for a profession (0 when the player has no state yet)
function perkVal(k, fx) {
  if (!G || !G.profPerks || !Array.isArray(G.profPerks[k])) return 0;
  let v = 0; for (const id of G.profPerks[k]) { const p = perkDef(k, id); if (p && p.fx === fx) v += p.v; } return v;
}
function learnPerk(k, id) {
  const p = perkDef(k, id);
  if (!p) return 'Unknown perk.';
  if (hasPerk(k, id)) return 'You already know this perk.';
  if ((k === 'armorsmith' || k === 'weaponsmith') && G.lvl < 20) return `${PROFS[k]} unlocks at player level 20.`;
  if (!perkTierOpen(k, p.tier)) return `Learn a tier ${p.tier} perk first.`;
  if (perkFree(k) < p.cost) return `Needs ${p.cost} points. Raise ${PROFS[k]} to earn more (1 per 36 ranks).`;
  perkList(k).push(id);
  return null;
}
const perkResetCost = k => perkSpent(k) * 100;
function resetPerks(k) {
  const spent = perkSpent(k); if (!spent) return 'No perks to reset.';
  const cost = perkResetCost(k); if (G.gold < cost) return `Reset costs ${cost} G.`;
  G.gold -= cost; G.profPerks[k] = []; return null;
}
// hero XP and the rare bonus material for one gather/craft action; returns extra toast text
function perkAfterWork(k) {
  const bits = [];
  const px = perkVal(k, 'pxp'); if (px > 0) gainXP(G, px);
  if (R() < perkVal(k, 'rare')) { const it = PERK_RARE_ITEM[k] || 'shard'; addItem(it, 1); bits.push(`+1 ${(ITEMS[it] && ITEMS[it].name) || it}`); }
  return bits.join(' ');
}

// ---------------------------------------------------------------- the grid scene
class PerkTreeScene {
  constructor(start) {
    this.opaque = true; this.ids = Object.keys(PROFS);
    this.pi = Math.max(0, this.ids.indexOf(start || 'herb')); this.r = 0; this.c = 0; this.msg = ''; this.confirm = false;
  }
  key() { return this.ids[this.pi]; }
  update() {
    const k = this.key();
    if (P('select')) { this.pi = (this.pi + 1) % this.ids.length; this.msg = ''; this.confirm = false; SFX.page(); return; }
    if (P('b')) { if (this.confirm) { this.confirm = false; this.msg = ''; SFX.back(); return; } SFX.back(); removeScene(this); return; }
    if (P('start')) {
      if (!perkSpent(k)) { this.msg = 'NO PERKS TO RESET.'; SFX.error(); return; }
      if (!this.confirm) { this.confirm = true; this.msg = `RESET FOR ${perkResetCost(k)} G? START`; SFX.cursor(); return; }
      const e = resetPerks(k); this.confirm = false;
      if (e) { this.msg = e.toUpperCase(); SFX.error(); } else { this.msg = 'PERKS REFUNDED.'; SFX.confirm(); saveGame(); }
      return;
    }
    if (nav('left')) { this.c = (this.c + 5) % 6; SFX.cursor(); }
    if (nav('right')) { this.c = (this.c + 1) % 6; SFX.cursor(); }
    if (nav('up')) { this.r = (this.r + 3) % 4; SFX.cursor(); }
    if (nav('down')) { this.r = (this.r + 1) % 4; SFX.cursor(); }
    if (P('a')) {
      const p = PERK_TREES[k][this.r][this.c];
      if (hasPerk(k, p.id)) { this.msg = 'ALREADY LEARNED.'; SFX.error(); return; }
      const e = learnPerk(k, p.id);
      if (e) { this.msg = e.toUpperCase(); SFX.error(); }
      else { this.msg = `LEARNED ${p.name}!`; SFX.levelup(); checkAchievements(); saveGame(); }
    }
  }
  draw() {
    const k = this.key(), tree = PERK_TREES[k];
    fill(0, 0, W, H, 0);
    fill(0, 0, W, 11, 3); textC(`< ${PROFS[k]} >`, 80, 1, 'gold');
    text(`SKILL ${G.prof[k] || 0}`, 3, 13, 2);
    textR(`POINTS ${perkFree(k)}/${perkPoints(k)}`, 157, 13, perkFree(k) ? 'gold' : 2);
    tree.forEach((row, t) => {
      const y = 24 + t * 20, open = perkTierOpen(k, t);
      text(String(t + 1), 2, y + 5, open ? 3 : 1);
      row.forEach((p, c) => {
        const x = 11 + c * 25, own = hasPerk(k, p.id), can = !own && open && perkFree(k) >= p.cost;
        fill(x, y, 22, 18, own ? 'gold' : can ? 1 : 2);
        fill(x + 1, y + 1, 20, 16, own ? 'gold' : 0);
        const icon = IMG[`pp_${p.fx}`] ? spr(`pp_${p.fx}`, 16, 16, own || can ? undefined : { ghost: true }) : null;
        if (icon) blit(icon, x + 3, y + 1);
        if (!open) { ctx.globalAlpha = 0.45; fill(x + 1, y + 1, 20, 16, 2); ctx.globalAlpha = 1; }
        if (t === this.r && c === this.c) { const o = 3; fill(x - 1, y - 1, 24, 1, o); fill(x - 1, y + 18, 24, 1, o); fill(x - 1, y - 1, 1, 20, o); fill(x + 22, y - 1, 1, 20, o); }
      });
    });
    const p = tree[this.r][this.c], own = hasPerk(k, p.id), open = perkTierOpen(k, p.tier);
    frame(1, 104, 158, 39);
    text(p.name.slice(0, 16), 5, 107, own ? 'gold' : 3);
    textR(own ? 'LEARNED' : `${p.cost} PT${p.cost > 1 ? 'S' : ''}`, 155, 107, own ? 'gold' : open ? 2 : 1);
    text(wrap(perkDesc(k, p), 25).slice(0, 2).join('\n'), 5, 116, 2);
    if (this.msg) text(this.msg.slice(0, 25), 5, 134, this.msg.startsWith('LEARNED') || this.msg.startsWith('PERKS') ? 'green' : 'red');
    else text(open ? 'A:LEARN SEL:JOB ST:RESET' : `NEEDS A TIER ${p.tier} PERK`, 5, 134, 1);
  }
}
