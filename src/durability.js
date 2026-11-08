'use strict';
// ================================================================ DURABILITY, REPAIR AND CRAFTING QUALITY
//   * DURABILITY: weapons, armour and wondrous pieces have durability (60 + 10 per rarity tier for weapons and
//     armour, 40 + 8 per tier for wondrous items). Winning a battle wears the weapon and one random piece by 1;
//     dying costs every equipped item 10% of its maximum. At 0 an item is BROKEN and gives no stats until repaired.
//   * REPAIR: MERCHANT > REPAIR ALL (cost by item level, rarity and damage; guild perks discount it), or use a
//     REPAIR KIT (sold by merchants) anywhere to restore 50% to everything equipped.
//   * CRAFTING QUALITY: crafted gear rolls STANDARD, FINE (+10%), SUPERIOR (+20%) or MASTERWORK (+35%) stats and
//     durability. Better crafting skill raises the odds.
// Pure rules are exported as GBQDurability for tests; the game wiring runs only inside the game.

const DUR_KINDS = ['weapon', 'armor', 'wondrous'];
const maxDurability = it => !it || !DUR_KINDS.includes(it.kind) ? 0 : Math.round((it.kind === 'wondrous' ? 40 + 8 * (it.rarity || 0) : 60 + 10 * (it.rarity || 0)) * (it.durMult || 1));
const isBroken = it => !!it && it.maxDur > 0 && it.dur <= 0;
// gold to fix one item: per missing point, scaled by item level and rarity
const repairCostOf = it => !it || !(it.maxDur > 0) ? 0 : Math.ceil(Math.max(0, it.maxDur - Math.max(0, it.dur)) * (1 + Math.floor((it.ilvl || 1) / 10)) * (1 + 0.5 * (it.rarity || 0)) / 4);
const lossOnDeath = it => Math.ceil((it.maxDur || 0) * 0.1);
const QUALITY = [
  { id: 'standard', name: '', mult: 1, dur: 1 },
  { id: 'fine', name: 'FINE', mult: 1.1, dur: 1.1 },
  { id: 'superior', name: 'SUPERIOR', mult: 1.2, dur: 1.2 },
  { id: 'masterwork', name: 'MASTERWORK', mult: 1.35, dur: 1.35 },
];
// odds rise with crafting skill (0-720): masterwork 2% -> 15%, superior 8% -> 30%, fine 25% -> 40%
function qualityOdds(skill) { const t = Math.max(0, Math.min(1, (Number(skill) || 0) / 720)); return { masterwork: 0.02 + 0.13 * t, superior: 0.08 + 0.22 * t, fine: 0.25 + 0.15 * t }; }
function rollQuality(skill, r) {
  const o = qualityOdds(skill), x = Number(r);
  if (x < o.masterwork) return QUALITY[3];
  if (x < o.masterwork + o.superior) return QUALITY[2];
  if (x < o.masterwork + o.superior + o.fine) return QUALITY[1];
  return QUALITY[0];
}
// scaled affix values for a quality (caps by stat maximum)
const qualityAffixes = (affixes, q, caps) => (affixes || []).map(([k, v]) => [k, Math.min(caps && caps[k] ? caps[k] : Infinity, Math.max(1, Math.round(v * q.mult)))]);

if (typeof globalThis !== 'undefined') globalThis.GBQDurability = { maxDurability, isBroken, repairCostOf, lossOnDeath, QUALITY, qualityOdds, rollQuality, qualityAffixes };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof derive === 'function' && typeof Battle !== 'undefined') {
  ITEMS.repair_kit = ITEMS.repair_kit || { name: 'REPAIR KIT', icon: 'ne_tool_1', type: 'use', price: 120, rarity: 3, desc: 'Restores 50% durability to all equipped gear.' };
  const CRAFT_PROFS = ['blacksmith', 'armorsmith', 'weaponsmith', 'tailoring', 'leatherwork', 'jewelcraft', 'enchanting'];
  const caps = () => Object.fromEntries(Object.entries(SUBSTATS).map(([k, s]) => [k, s.max]));
  function ensureDur(it) { if (it && DUR_KINDS.includes(it.kind) && !(it.maxDur > 0)) { it.maxDur = maxDurability(it); it.dur = it.maxDur; } return it; }
  const holders = () => G ? [G, ...(G.companions || [])] : [];
  const discount = () => typeof guildPerkValue === 'function' ? guildPerkValue('repair') : 0;
  window.repairTotal = () => { let n = 0; for (const c of holders()) for (const it of Object.values(c.eq || {})) if (it) { ensureDur(it); n += repairCostOf(it); } return Math.ceil(n * (1 - discount())); };
  function wear(it, n, who) {
    ensureDur(it); if (!(it && it.maxDur > 0) || it.dur <= 0) return;
    const before = it.dur; it.dur = Math.max(0, it.dur - n);
    if (it.dur === 0) toast('ITEM BROKEN', `${it.name.slice(0, 20)}`, 'ne_tool_1', 'error');
    else if (before > it.maxDur * 0.2 && it.dur <= it.maxDur * 0.2 && who === G) toast('LOW DURABILITY', it.name.slice(0, 20), 'ne_tool_1', 'error');
  }
  // broken items are left out while stats are worked out
  { const d0 = derive; derive = function (c) {
      const eq = c && c.eq, off = [];
      if (eq) for (const s in eq) if (isBroken(eq[s])) { off.push([s, eq[s]]); delete eq[s]; }
      try { return d0.apply(this, arguments); } finally { for (const [s, it] of off) eq[s] = it; }
    }; }
  // wear: a won battle costs the weapon and one random piece 1 point each
  { const f0 = Battle.prototype.finish; Battle.prototype.finish = function (result) {
      if (result === 'win') for (const u of this.party || []) {
        const c = u && u.ch; if (!c || !c.eq) continue;
        if (c.eq.weapon) wear(c.eq.weapon, 1, c);
        const pieces = Object.entries(c.eq).filter(([s, it]) => it && s !== 'weapon' && DUR_KINDS.includes(it.kind));
        if (pieces.length) wear(pieces[Math.floor(R() * pieces.length)][1], 1, c);
      }
      return f0.apply(this, arguments);
    }; }
  // death: 10% of maximum from everything equipped
  { const w0 = onPartyWipe; onPartyWipe = function () { for (const c of holders()) for (const it of Object.values(c.eq || {})) if (it) { ensureDur(it); wear(it, lossOnDeath(it), c); } return w0.apply(this, arguments); }; }
  // new gear starts at full durability; crafted gear rolls a quality
  { const ag0 = addGear; addGear = function (it) {
      ensureDur(it);
      if (it && it.crafted && !it.quality && DUR_KINDS.includes(it.kind)) {
        const skill = Math.max(0, ...CRAFT_PROFS.map(p => (G && G.prof && G.prof[p]) || 0)), q = rollQuality(skill, R());
        it.quality = q.id;
        if (q.mult > 1) { it.affixes = qualityAffixes(it.affixes, q, caps()); it.durMult = q.dur; it.maxDur = maxDurability(it); it.dur = it.maxDur; it.value = Math.round((it.value || 1) * q.mult); it.name = `${q.name} ${it.name}`.slice(0, 26); }
        if (q.id === 'masterwork') toast('MASTERWORK!', it.name.slice(0, 22), 'item_chest', 'achievement');
      }
      return ag0.apply(this, arguments);
    }; }
  { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it); if (!it || !DUR_KINDS.includes(it.kind)) return s; ensureDur(it); return `${isBroken(it) ? 'BROKEN! ' : ''}DUR ${it.dur}/${it.maxDur}. ${s}`; }; }

  function repairAll(fromKit) {
    let fixed = 0;
    for (const c of holders()) for (const it of Object.values(c.eq || {})) if (it && it.maxDur > 0 && it.dur < it.maxDur) { it.dur = fromKit ? Math.min(it.maxDur, it.dur + Math.ceil(it.maxDur / 2)) : it.maxDur; fixed++; }
    return fixed;
  }
  window.repairMenu = function () {
    const cost = repairTotal();
    if (!cost) return say('Your gear is in perfect condition.');
    choose([`REPAIR ALL ${fmt(cost)} G`, 'LEAVE'], k => {
      if (k !== 0) return; if (G.gold < cost) { SFX.error(); return say(`Repairs cost ${fmt(cost)} G. You have ${fmt(G.gold)} G.`); }
      G.gold -= cost; const n = repairAll(false); SFX.craft(); saveGame(); say(`Repaired ${n} item${n === 1 ? '' : 's'} for ${fmt(cost)} G.${discount() ? ` Guild discount ${Math.round(discount() * 100)}%.` : ''}`);
    }, `${discount() ? `GUILD DISCOUNT ${Math.round(discount() * 100)}%. ` : ''}Equipped gear and companions.`);
  };
  // repair kits from the bag
  if (typeof InventoryScene !== 'undefined') { const u0 = InventoryScene.prototype.useMenu; InventoryScene.prototype.useMenu = function (k) {
      if (k !== 'repair_kit') return u0.call(this, k);
      if (!(G.inv.repair_kit > 0)) return; if (!repairTotal()) return this.flash('NOTHING TO REPAIR');
      takeItem('repair_kit'); const n = repairAll(true); SFX.craft(); this.flash(`REPAIRED ${n} ITEMS (+50%)`);
    }; }
}
