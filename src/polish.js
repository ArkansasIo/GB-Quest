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
const transmogCost = lvl => 5 * Math.max(1, Math.floor(Number(lvl) || 1));

if (typeof globalThis !== 'undefined') globalThis.GBQPolish = { restedGain, restedCap, addRested, spendRested, gearItemScore, gearScore, appearanceKey, lookFits, transmogCost, REST_BONUS };

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
    const seen = it => { const k = appearanceKey(it); if (k && !G.wardrobe[k] && ['weapon', 'armor', 'wondrous'].includes(it.kind)) G.wardrobe[k] = 1; };
    Object.values(G.eq || {}).forEach(seen); (G.bag || []).forEach(seen); (G.bank || []).forEach(seen);
  };
  // a transmogged item shows its look's icon
  { const ic0 = itemIcon; itemIcon = function (it) { if (it && it.tmog && it.tmog.base) { try { return ic0(Object.assign({}, it, { base: it.tmog.base })); } catch (e) { /* fall through */ } } return ic0(it); }; }
  { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it); return it && it.tmog ? `LOOKS LIKE ${baseName(it.kind, it.tmog.base)}. ${s}` : s; }; }

  window.wardrobeMenu = function () {
    polishPoll();
    const slots = SLOTS.filter(s => G.eq[s] && ['weapon', 'armor', 'wondrous'].includes(G.eq[s].kind));
    if (!slots.length) return say('Equip something first.');
    choose(slots.map(s => `${SLOT_NAME[s].slice(0, 9)} ${(G.eq[s].tmog ? '*' : '') + baseName(G.eq[s].kind, G.eq[s].tmog ? G.eq[s].tmog.base : G.eq[s].base)}`.slice(0, 24)), k => {
      if (k < 0) return; const it = G.eq[slots[k]], mySlot = itemSlot(it);
      const looks = Object.keys(G.wardrobe).map(key => key.split(':')).filter(([kind, base]) => base !== it.base && lookFits(mySlot, lookSlot(kind, base), it.kind, kind));
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
      // one line under ATTUNED, above the info frame
      text(`GS ${fmt(gearScore(G.eq))}${G.rested > 0 ? `  RESTED ${Math.round(G.rested / span(G) * 100)}%` : ''}`, 24, 108, 'gold');
    }; }
}
