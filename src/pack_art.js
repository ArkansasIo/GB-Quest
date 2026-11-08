'use strict';
// ================================================================ PIXEL PACKS ART MODE
// SETTINGS > ART cycles CLASSIC, NES and PIXEL PACKS (the default). PIXEL PACKS uses the third-party pixel-art packs
// converted by tools/gen_packs.py (PACK_INDEX in src/pack_index.js):
//   * gear icons: 11-tier weapons, shields, armour, helmets and boots; polearms, crossbows, staves, wands,
//     rings, gems, keys, coins, spellbooks and potions
//   * a third of each monster family's subtypes (and some bosses) use the packs' monsters
//   * world objects: trees, pines, forests and rocks for every biome; houses, inns, shops and temples in towns
//   * the DUNGEON theme's floor, walls, doors, torches, bones, coins and crates
//   * 18 townsfolk roles (guards, soldiers, mages, farmers...) walk with the packs' sprites
// Switching modes swaps sprites by name, so every screen picks the change up at once.

const PACK_MODE = 'packs';
function pkHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// a third of a family's subtypes get pack art; same subtype -> same sprite
const packMonsterFor = (fam, key, pools) => { const L = pools && pools[fam]; if (!L || !L.length) return null; const h = pkHash('pk|' + key); return h % 3 === 0 ? L[(h >>> 2) % L.length] : null; };
const nextArtMode = m => ({ classic: 'nes', nes: 'packs', packs: 'classic' })[m] || 'nes';

if (typeof globalThis !== 'undefined') globalThis.GBQPackArt = { packMonsterFor, nextArtMode, PACK_MODE };

if (typeof window !== 'undefined' && typeof PACK_INDEX !== 'undefined' && typeof IMG !== 'undefined') {
  const packOn = () => S.art === PACK_MODE;
  // the packs are the default look for players who have not picked CLASSIC
  if (!S.packsDefaulted) { S.packsDefaulted = true; if (S.art !== 'classic') S.art = PACK_MODE; try { if (typeof saveSettings === 'function') saveSettings(); } catch (e) {} }

  // item art lists (NES categories); helmets get their own list
  const NES0 = {}; for (const k of Object.keys(PACK_INDEX.items)) NES0[k] = (NES[k] || []).slice();
  NES0.helmet = (NES.heavyarmor || []).slice();
  const HELMS = ['helm', 'great_helm', 'bascinet', 'sallet', 'barbute', 'armet', 'kettle_hat', 'nasal_helm', 'circlet'];
  if (typeof WONDROUS_ART !== 'undefined') for (const k of HELMS) if (WONDROUS_ART[k]) WONDROUS_ART[k] = 'helmet';
  // monsters
  const mons = [];
  if (typeof BESTIARY !== 'undefined') for (const b of BESTIARY) if (!b.ccArt) { const n = packMonsterFor(b.fam, `${b.sub}|${b.variant}`, PACK_INDEX.monsters); if (n) mons.push([b, b.nspr, n]); }
  if (typeof BOSSES !== 'undefined') for (const b of BOSSES) if (b.cat !== 'arc' && ['dragon', 'fiend', 'undead', 'giant'].includes(b.fam)) { const L = PACK_INDEX.monsters[b.fam] || []; const h = pkHash('pkboss|' + b.id); if (L.length && h % 2 === 0) mons.push([b, b.nspr, L[(h >>> 1) % L.length]]); }
  // sprite aliases (old name -> pack sprite)
  const ORIG = {};
  let applied = null;
  window.applyPackArt = function () {
    const on = packOn() && !!IMG[Object.values(PACK_INDEX.alias)[0]];
    for (const [cat, list] of Object.entries(PACK_INDEX.items)) { const want = on && list.length ? list : NES0[cat]; NES[cat] = want.slice(); }
    for (const [b, base, pk] of mons) b.nspr = on ? pk : base;
    for (const [old, pk] of Object.entries(PACK_INDEX.alias)) {
      if (!(old in ORIG)) ORIG[old] = IMG[old] || null;
      if (on && IMG[pk]) IMG[old] = IMG[pk]; else if (ORIG[old]) IMG[old] = ORIG[old];
    }
    if (applied !== on && typeof clearCaches === 'function') clearCaches();
    applied = on;
  };
  // images arrive after the scripts run
  const first = Object.values(PACK_INDEX.alias)[0];
  const wait = setInterval(() => { if (IMG[first]) { clearInterval(wait); applyPackArt(); if (typeof applyArt === 'function') applyArt(); } }, 200);
  setTimeout(() => clearInterval(wait), 30000);
}
