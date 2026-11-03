'use strict';
// ================================================================ CHARACTER POLISH: rested XP, transmog wardrobe, gear score
//   * RESTED XP: time away builds a rested pool (5% of a level per 8 hours, up to 1.5 levels). While it
//     lasts, XP you earn is doubled and the bonus is taken from the pool. A long rest also adds 4% of a level
//     (at most once an hour).
//   * WARDROBE (MAIN MENU > WARDROBE): every weapon, armour and wondrous base you have held is collected as an
//     appearance. Give an equipped item the look of any collected appearance for the same slot; its stats
//     stay. Restoring the original look is free.
//   * GEAR SCORE: one number for your equipped gear (item level, rarity and +bonus), shown on the paper doll.
// Pure rules are exported as GBQPolish for tests; the game wiring runs only inside the game.

const RESTED_PER_HOUR = 0.05 / 8, RESTED_CAP = 1.5, REST_BONUS = 0.04;
// rested XP gained over some hours away, for a level span (XP from this level to the next)
const restedGain = (hours, span) => Math.max(0, Math.floor(Math.max(0, Number(hours) || 0) * RESTED_PER_HOUR * span));
const restedCap = span => Math.floor(span * RESTED_CAP);
const addRested = (pool, gain, span) => Math.min(restedCap(span), Math.max(0, Math.floor(pool || 0)) + Math.max(0, Math.floor(gain || 0)));
// XP actually granted: the base amount plus a matching bonus drawn from the pool
function spendRested(amount, pool) { const a = Math.max(0, Math.floor(amount || 0)), p = Math.max(0, Math.floor(pool || 0)), bonus = Math.min(a, p); return { total: a + bonus, bonus, pool: p - bonus }; }

// gear score: per item, item level x (1 + 12% per rarity tier) + 4 per +bonus
const gearItemScore = it => !it || !it.ilvl ? 0 : Math.round(it.ilvl * (1 + 0.12 * Math.max(0, it.rarity || 0)) + 4 * Math.max(0, it.plus || 0));
const gearScore = eq => Object.values(eq || {}).reduce((a, it) => a + gearItemScore(it), 0);

// appearances: one per kind + base; a look fits when the slot matches
const appearanceKey = it => it && it.kind && it.base ? `${it.kind}:${it.base}` : null;
const lookFits = (itemSlotName, lookSlotName, itemKind, lookKind) => itemKind === lookKind && itemSlotName === lookSlotName;
const collectAppearances = (wardrobe, sources) => {
  const out = wardrobe && typeof wardrobe === 'object' ? wardrobe : {};
  let added = 0;
  for (const source of sources || []) for (const it of source || []) {
    const key = appearanceKey(it);
    if (key && ['weapon', 'armor', 'wondrous'].includes(it.kind) && !out[key]) { out[key] = 1; added++; }
  }
  return { wardrobe: out, added };
};
const validAppearance = (item, look, wardrobe, slotOf) => {
  if (!item || !look || !look.kind || !look.base || item.kind !== look.kind || item.base === look.base) return false;
  const key = appearanceKey(look);
  return !!(key && wardrobe && wardrobe[key] && lookFits(slotOf(item), slotOf(look), item.kind, look.kind));
};
const PAPERDOLL_VISUAL_SLOTS = Object.freeze({
  head: { x: 76, y: 14 }, neck: { x: 87, y: 20 }, back: { x: 94, y: 27 },
  armor: { x: 76, y: 29 }, hands: { x: 61, y: 35 }, weapon: { x: 57, y: 44 },
  offhand: { x: 95, y: 44 }, waist: { x: 76, y: 42 }, legs: { x: 76, y: 49 },
  feet: { x: 76, y: 55 }, artifact: { x: 94, y: 16 }, relic: { x: 57, y: 16 },
});
const paperDollVisuals = eq => Object.keys(PAPERDOLL_VISUAL_SLOTS)
  .filter(slot => eq && eq[slot])
  .map(slot => ({ slot, item: eq[slot], anchor: PAPERDOLL_VISUAL_SLOTS[slot] }));
const WORLD_GEAR_ICON_SLOTS = Object.freeze([
  { slot: 'head', x: 2, y: 1, size: 6 },
  { slot: 'weapon', x: 0, y: 10, size: 6 },
  { slot: 'armor', x: 9, y: 17, size: 6 },
  { slot: 'offhand', x: 18, y: 10, size: 6 },
]);
const worldGearVisuals = eq => WORLD_GEAR_ICON_SLOTS
  .filter(v => eq && eq[v.slot])
  .map(v => ({ ...v, item: eq[v.slot] }));
const transmogCost = lvl => 5 * Math.max(1, Math.floor(Number(lvl) || 1));

if (typeof globalThis !== 'undefined') globalThis.GBQPolish = { restedGain, restedCap, addRested, spendRested, gearItemScore, gearScore, appearanceKey, lookFits, collectAppearances, validAppearance, paperDollVisuals, PAPERDOLL_VISUAL_SLOTS, worldGearVisuals, WORLD_GEAR_ICON_SLOTS, transmogCost, REST_BONUS };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof makeItem === 'function' && typeof itemSlot === 'function') {
  const span = c => Math.max(1, xpForLevel(Math.min(LEVEL_CAP, c.lvl + 1)) - xpForLevel(c.lvl));
  const baseName = (kind, base) => { try { return kind === 'weapon' ? WEAPONS[base].name : kind === 'armor' ? ARMORS[base].name : WONDROUS.find(w => w.id === base).name; } catch (e) { return base.toUpperCase(); } };
  const lookSlot = (kind, base) => itemSlot({ kind, base });
  window.gearScoreOf = c => gearScore(c && c.eq);

  // rested pool from time away
  { const ls0 = loadSlot; loadSlot = function (i) {
      const ok = ls0(i); if (!ok) return ok;
      const hours = G.saved ? (Date.now() - G.saved) / 36e5 : 0, before = G.rested || 0;
      G.rested = addRested(before, restedGain(hours, span(G)), span(G));
      if (G.rested > before + 0) toast('WELL RESTED', `+${fmt(G.rested - before)} BONUS XP`, 'item_coin', 'confirm');
      return ok;
    }; }
  { const lr0 = longRest; longRest = function (c) {
      const r = lr0.apply(this, arguments);
      if (G && c === G && Date.now() - (G.restedAt || 0) > 36e5) { G.restedAt = Date.now(); G.rested = addRested(G.rested, Math.floor(span(G) * REST_BONUS), span(G)); }
      return r;
    }; }
  { const gx0 = gainXP; gainXP = function (c, amount) {
      if (G && c === G && G.rested > 0 && amount > 0) { const s = spendRested(amount, G.rested); G.rested = s.pool; amount = s.total; }
      return gx0(c, amount);
    }; }

  // wardrobe: collect every base the hero holds (polled by mmo_loop.js)
  window.polishPoll = function () {
    if (!G) return; G.wardrobe = G.wardrobe && typeof G.wardrobe === 'object' ? G.wardrobe : {};
    const stashTabs = G.stash && Array.isArray(G.stash.tabs) ? G.stash.tabs : [];
    const collected = collectAppearances(G.wardrobe, [Object.values(G.eq || {}), G.bag || [], G.bank || [], ...stashTabs]);
    G.wardrobe = collected.wardrobe;
  };
  // a transmogged item shows its look's icon
  const appearanceOf = it => it && validAppearance(it, it.tmog, G && G.wardrobe, lookSlot) ? it.tmog : null;
  { const ic0 = itemIcon; itemIcon = function (it) { const look = appearanceOf(it); if (look) { try { return ic0(Object.assign({}, it, { base: look.base })); } catch (e) { /* fall through */ } } return ic0(it); }; }
  { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it), look = appearanceOf(it); return look ? `LOOKS LIKE ${baseName(it.kind, look.base)}. ${s}` : s; }; }

  window.wardrobeMenu = function () {
    polishPoll();
    const slots = SLOTS.filter(s => G.eq[s] && ['weapon', 'armor', 'wondrous'].includes(G.eq[s].kind));
    if (!slots.length) return say('Equip something first.');
    choose(slots.map(s => `${SLOT_NAME[s].slice(0, 9)} ${(G.eq[s].tmog ? '*' : '') + baseName(G.eq[s].kind, G.eq[s].tmog ? G.eq[s].tmog.base : G.eq[s].base)}`.slice(0, 24)), k => {
      if (k < 0) return; const it = G.eq[slots[k]], mySlot = itemSlot(it);
      const looks = Object.keys(G.wardrobe).map(key => key.split(':')).filter(([kind, base]) => validAppearance(it, { kind, base }, G.wardrobe, lookSlot));
      const cost = transmogCost(G.lvl), opts = [...(it.tmog ? ['RESTORE ORIGINAL LOOK'] : []), ...looks.map(([kind, base]) => baseName(kind, base).slice(0, 20))];
      if (!opts.length) return say(['No other looks collected for this slot yet.', 'Every item you pick up adds its look to your wardrobe.'], window.wardrobeMenu);
      choose(opts, j => {
        if (j < 0) return window.wardrobeMenu();
        if (it.tmog && j === 0) { delete it.tmog; SFX.equip(); saveGame(); return say(`${it.name} looks like itself again.`, window.wardrobeMenu); }
        const [kind, base] = looks[j - (it.tmog ? 1 : 0)];
        if (G.gold < cost) { SFX.error(); return say(`A new look costs ${fmt(cost)} G.`, window.wardrobeMenu); }
        G.gold -= cost; it.tmog = { kind, base }; SFX.equip(); saveGame(); say(`${it.name} now looks like ${baseName(kind, base)}.`, window.wardrobeMenu);
      }, `NEW LOOK ${fmt(cost)} G. ${Object.keys(G.wardrobe).length} LOOKS`);
    }, `WARDROBE: ${Object.keys(G.wardrobe).length} LOOKS COLLECTED`);
  };
  // gear score and rested pool on the paper doll
  if (typeof PaperDoll !== 'undefined') { const d0 = PaperDoll.prototype.draw; PaperDoll.prototype.draw = function () {
      d0.apply(this, arguments);
      // Small equipment markers on the central portrait; the full slot list remains around it.
      for (const visual of paperDollVisuals(G.eq)) {
        const icon = itemIcon(visual.item);
        if (icon && IMG[icon]) blit(sprFit(icon, 8), visual.anchor.x, visual.anchor.y);
      }
      // one line under ATTUNED, above the info frame
      text(`GS ${fmt(gearScore(G.eq))}${G.rested > 0 ? `  RESTED ${Math.round(G.rested / span(G) * 100)}%` : ''}`, 24, 108, 'gold');
    }; }
}
