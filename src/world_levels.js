'use strict';
// ================================================================ WORLD LEVEL 1-9
// The open world grows more dangerous as the hero grows. Separate from DIFFICULTY (data_world.js), which
// scales every fight; WORLD LEVEL only touches the open world (never dungeons, raids, trials or towers).
//   * Each world level adds monster levels and raises XP, gold and loot from open-world fights.
//   * To unlock the next world level: reach its hero level, then defeat its ASCENSION WARDEN
//     (MAIN MENU > WORLD LV > ASCENSION TRIAL). Winning moves you up to the new level.
//   * You can choose any world level you have unlocked, up or down, outside instances.
// Pure rules are exported as GBQWorldLevels for tests; the game wiring runs only inside the game.

(() => { // own scope: the game loads every module as a classic script sharing one global scope
const WORLD_LEVELS = Object.freeze([
  { n: 1, name: 'KINDLED',   req: 1,   lvl: 0,  xp: 1.00, gold: 1.00, loot: 1.00, warden: 'HEARTH WARDEN' },
  { n: 2, name: 'AWAKENED',  req: 20,  lvl: 2,  xp: 1.10, gold: 1.10, loot: 1.05, warden: 'THORN SENTINEL' },
  { n: 3, name: 'STIRRING',  req: 40,  lvl: 4,  xp: 1.20, gold: 1.20, loot: 1.10, warden: 'MIREWATCH KEEPER' },
  { n: 4, name: 'RESTLESS',  req: 80,  lvl: 7,  xp: 1.35, gold: 1.30, loot: 1.20, warden: 'GALEBORN HERALD' },
  { n: 5, name: 'SHADOWED',  req: 140, lvl: 10, xp: 1.50, gold: 1.45, loot: 1.30, warden: 'DUSKVEIL REAVER' },
  { n: 6, name: 'BLIGHTED',  req: 220, lvl: 14, xp: 1.70, gold: 1.60, loot: 1.45, warden: 'ROTBLOOM TYRANT' },
  { n: 7, name: 'SUNDERED',  req: 320, lvl: 18, xp: 1.90, gold: 1.80, loot: 1.60, warden: 'RIFTSCAR TITAN' },
  { n: 8, name: 'FORSAKEN',  req: 450, lvl: 23, xp: 2.20, gold: 2.00, loot: 1.80, warden: 'HOLLOW HAND' },
  { n: 9, name: 'ECLIPSED',  req: 600, lvl: 30, xp: 2.50, gold: 2.30, loot: 2.00, warden: 'THE LAST EMBER' },
]);
const WL_MAX = WORLD_LEVELS.length, WL_LEVEL_CAP = 720;
const wlClamp = n => Math.max(1, Math.min(WL_MAX, Math.floor(Number(n) || 1)));
const wlDef = n => WORLD_LEVELS[wlClamp(n) - 1];

// save state: { worldLevel, worldLevelMax } on the hero; repairs missing or broken values
function normWorldLevel(c) {
  const o = c && typeof c === 'object' ? c : {};
  o.worldLevelMax = wlClamp(o.worldLevelMax);
  o.worldLevel = Math.min(o.worldLevelMax, wlClamp(o.worldLevel));
  return o;
}
// the next world level, if the hero's level allows its trial: { ok, def, why }
function ascensionCheck(c) {
  const o = normWorldLevel(c), next = WORLD_LEVELS[o.worldLevelMax];
  if (!next) return { ok: false, def: null, why: 'You have reached the highest world level.' };
  if ((Number(o.lvl) || 1) < next.req) return { ok: false, def: next, why: `WORLD LEVEL ${next.n} opens at hero level ${next.req}.` };
  return { ok: true, def: next, why: '' };
}
// after the warden falls: unlock and move to the new level
function ascend(c) {
  const chk = ascensionCheck(c); if (!chk.ok) return false;
  c.worldLevelMax = chk.def.n; c.worldLevel = chk.def.n; return true;
}
function setWorldLevel(c, n) {
  const o = normWorldLevel(c), want = Number(n);
  if (!Number.isInteger(want) || want < 1 || want > o.worldLevelMax) return false;
  o.worldLevel = want; return true;
}
const wlMonsterLevel = (base, n) => Math.max(1, Math.min(WL_LEVEL_CAP, Math.round(Number(base) || 1) + wlDef(n).lvl));
// the warden fights at the new level's hero requirement plus its monster bonus
const wardenLevel = def => Math.min(WL_LEVEL_CAP, def.req + def.lvl);

if (typeof globalThis !== 'undefined') globalThis.GBQWorldLevels = { WORLD_LEVELS, WL_MAX, wlDef, normWorldLevel, ascensionCheck, ascend, setWorldLevel, wlMonsterLevel, wardenLevel };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof rollEncounter === 'function' && typeof zoneLevel === 'function') {
  const openWorld = z => !!(G && !G.inst && z && !z.town);
  const cur = () => normWorldLevel(G).worldLevel;

  // open-world monsters are higher level (rares in world_quests.js use zoneLevel too)
  { const zl0 = zoneLevel; zoneLevel = function (z) { const L = zl0.apply(this, arguments); return openWorld(z) && cur() > 1 ? wlMonsterLevel(L, cur()) : L; }; }
  // and pay more: XP and gold on the monster, loot through rollDrops
  { const re0 = rollEncounter; rollEncounter = function (zoneDef) {
      const foes = re0.apply(this, arguments);
      try {
        const n = openWorld(zoneDef) ? cur() : 1, d = wlDef(n);
        if (n > 1) for (const f of foes || []) { if (f.wl) continue; f.wl = n; f.xp = Math.round((f.xp || 1) * d.xp); f.gold = Math.round((f.gold || 0) * d.gold); }
      } catch (e) { /* keep the encounter */ }
      return foes;
    }; }
  if (typeof rollDrops === 'function') { const rd0 = rollDrops; rollDrops = function (f, ctx) {
      if (f && f.wl > 1) { ctx = Object.assign({}, ctx || {}); ctx.loot = (ctx.loot || 1) * wlDef(f.wl).loot; }
      return rd0.call(this, f, ctx);
    }; }

  function ascensionTrial() {
    const chk = ascensionCheck(G);
    if (!chk.ok) { SFX.error(); return say(chk.why, worldLevelMenu); }
    if (G.inst) return say('Leave the instance first.');
    const def = chk.def, zone = ZONE_BY_ID[G.map];
    const fam = zone && BIOMES[zone.biome] ? BIOMES[zone.biome].fam : [];
    const elites = BESTIARY.filter(b => b.rank === 'elite'), local = elites.filter(b => fam.includes(b.fam));
    const base = local[0] || elites[0] || BESTIARY[0];
    const w = makeMonster(base, wardenLevel(def), G.difficulty);
    w.elite = true; w.wl = def.n; w.name = def.warden.slice(0, 16);
    w.maxhp = Math.round(w.maxhp * 3); w.hp = w.maxhp; w.xp = Math.round((w.xp || 1) * 4); w.gold = Math.round((w.gold || 0) * 4);
    say([`ASCENSION TRIAL: WORLD LEVEL ${def.n} ${def.name}`, `${def.warden} (level ${wardenLevel(def)}) bars the way.`, 'Defeat it to raise the world level.'], () => startBattle([w], {
      onEnd: r => {
        if (r === 'win' && ascend(G)) {
          G.stats.worldLevel = Math.max(G.stats.worldLevel || 0, G.worldLevelMax);
          toast(`WORLD LEVEL ${def.n}`, def.name, 'px_crown', 'achievement');
          say([`The world darkens: WORLD LEVEL ${def.n} ${def.name}.`, `Monsters +${def.lvl} levels. XP x${def.xp}, gold x${def.gold}, loot x${def.loot}.`, 'Change it any time in MAIN MENU > WORLD LV.']);
          if (typeof saveGame === 'function') saveGame();
        }
        return defaultBattleEnd(r);
      },
    }));
  }

  function worldLevelMenu() {
    const o = normWorldLevel(G), chk = ascensionCheck(G);
    const opts = WORLD_LEVELS.map(d => `${d.n === o.worldLevel ? '>' : ' '}${d.n} ${d.name}${d.n > o.worldLevelMax ? ` (LV${d.req})` : ''}`);
    const trial = chk.def ? `ASCENSION TRIAL${chk.ok ? ' (!)' : ''}` : null;
    if (trial) opts.push(trial);
    opts.push('BACK');
    const d = wlDef(o.worldLevel);
    choose(opts, k => {
      const sel = opts[k];
      if (!sel || sel === 'BACK') return;
      if (sel === trial) return ascensionTrial();
      const n = k + 1, def = wlDef(n);
      if (n > o.worldLevelMax) { SFX.error(); return say([`WORLD LEVEL ${n} is locked.`, `Reach hero level ${def.req}, then win the ASCENSION TRIAL.`], worldLevelMenu); }
      if (G.inst) return say('You cannot change the world level inside an instance.');
      setWorldLevel(G, n); SFX.confirm(); if (typeof saveGame === 'function') saveGame();
      say([`WORLD LEVEL ${n} ${def.name}.`, `Monsters +${def.lvl} levels. XP x${def.xp}, gold x${def.gold}, loot x${def.loot}.`], worldLevelMenu);
    }, `WORLD LV ${o.worldLevel}/${o.worldLevelMax} ${d.name}: MOBS +${d.lvl}`);
  }
  window.worldLevelMenu = worldLevelMenu;

  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { 'WORLD LV': 'World level 1-9: tougher open world, better rewards.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () {
      const L = i0.apply(this, arguments); if (!G) return L;
      const at = L.indexOf('MORPH'), label = ascensionCheck(G).ok ? 'WORLD LV (!)' : 'WORLD LV';
      L.splice(at >= 0 ? at + 1 : Math.max(0, L.indexOf('MOUNTS')), 0, label); return L;
    };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () {
      if (P('a') && (this.items()[this.i] || '').replace(' (!)', '') === 'WORLD LV') { SFX.select(); return worldLevelMenu(); }
      return u0.apply(this, arguments);
    };
  }
}
})();
