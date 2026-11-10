'use strict';
(() => {
// ================================================================ RIFTS & GREATER RIFTS (MAIN MENU > RIFTS)
// Diablo-style rifts, fought from the RIFTS page as a chain of battles.
//   * NORMAL RIFT (free): every pack comes from a random biome. Slain foes fill the PROGRESS bar
//     (normal 5%, elite 18%, boss 30%). At 100% the RIFT GUARDIAN appears; beat it to close the rift
//     for gold, XP, an item and a GREATER RIFT KEY.
//   * GREATER RIFT (1 key): choose any level from 1 up to your best + 1. Foes get x1.12 HP and x1.07
//     damage per level and +1 foe level per 5 levels. The 15:00 timer starts at the first pack. Close it
//     in time to unlock the next levels (+1, +2 under 80% of the timer, +3 under 60%); late runs still
//     pay out, but less, and unlock nothing. A wipe costs 30 seconds and heals the party to half.
//   * PYLONS: after a pack, 20% chance of HEALING (full heal), POWER (next pack -30% HP) or SPEED (-20 s).
//   * Rewards scale with level: gold, XP, awakening stones and an item whose rarity rises with level.
//   * LEADERBOARD: your 10 best greater rifts (level, then time), and your best per class.
// Pure rules are exported as GBQRifts for tests; the game wiring runs only inside the game.

const GR_TIME = 15 * 60;            // seconds
const GR_MAX = 150;
const PROGRESS = { normal: 5, elite: 18, boss: 30 };
const DEATH_PENALTY = 30;
const PYLONS = {
  heal: { name: 'HEALING PYLON', desc: 'The party is fully healed.' },
  power: { name: 'POWER PYLON', desc: 'The next pack has 30% less HP.' },
  speed: { name: 'SPEED PYLON', desc: 'The rift timer gains 20 seconds.' },
};

const grMult = level => { const L = Math.max(1, Math.min(GR_MAX, Math.floor(level))); return { hp: Math.pow(1.12, L - 1), dmg: Math.pow(1.07, L - 1), lvlBonus: Math.floor(L / 5) }; };
const foeProgress = f => f && f.boss ? PROGRESS.boss : f && f.elite ? PROGRESS.elite : PROGRESS.normal;
// result of a finished greater rift: how many levels it unlocks
function grResult(elapsed, limit = GR_TIME) {
  const t = elapsed / limit;
  return t <= 0.6 ? { timed: true, unlock: 3 } : t <= 0.8 ? { timed: true, unlock: 2 } : t <= 1 ? { timed: true, unlock: 1 } : { timed: false, unlock: 0 };
}
// rewards: kind 'normal' | 'greater'
function riftRewards(kind, level, heroLvl, timed = true) {
  const L = Math.max(1, Math.min(720, Math.floor(heroLvl) || 1));
  if (kind === 'normal') return { gold: 60 + L * 12, xpShare: 0.15, stones: 1, shards: 2, keys: 1, rarity: L >= 30 ? 4 : 3 };
  const g = Math.max(1, Math.min(GR_MAX, Math.floor(level))), k = timed ? 1 : 0.5;
  return { gold: Math.round((100 + L * 15) * (1 + g / 10) * k), xpShare: (0.2 + g * 0.01) * k, stones: Math.max(1, Math.round((1 + Math.floor(g / 5)) * k)), shards: Math.max(1, Math.round((2 + Math.floor(g / 3)) * k)), keys: 0,
    rarity: !timed ? 3 : g >= 40 ? 6 : g >= 25 ? 5 : g >= 10 ? 4 : 3 };
}
const maxUnlocked = best => Math.max(1, Math.min(GR_MAX, (best || 0) + 1));
// keep the 10 best runs: higher level first, then faster
function addToBoard(board, run) {
  const out = (board || []).concat([run]).sort((a, b) => b.level - a.level || a.time - b.time);
  return out.slice(0, 10);
}
const fmtTime = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function normRift(r) {
  const o = r && typeof r === 'object' ? r : {};
  return { keys: Math.max(0, Math.floor(Number(o.keys) || 0)), best: Math.max(0, Math.floor(Number(o.best) || 0)), bestByClass: o.bestByClass && typeof o.bestByClass === 'object' ? o.bestByClass : {},
    board: Array.isArray(o.board) ? o.board.slice(0, 10) : [], closed: Math.max(0, Math.floor(Number(o.closed) || 0)), active: o.active && typeof o.active === 'object' ? o.active : null, pick: Math.max(1, Math.floor(Number(o.pick) || 1)) };
}

if (typeof globalThis !== 'undefined') globalThis.GBQRifts = { GR_TIME, GR_MAX, PROGRESS, PYLONS, DEATH_PENALTY, grMult, foeProgress, grResult, riftRewards, maxUnlocked, addToBoard, fmtTime, normRift };

// ---------------------------------------------------------------- game wiring
if (typeof window === 'undefined' || typeof startBattle !== 'function' || typeof makeMonster !== 'function') return;

// normalise once, then always hand back the same object (callers mutate it)
const RF = () => { const r = G.rift; if (!r || typeof r.keys !== 'number' || !Array.isArray(r.board) || !r.bestByClass) G.rift = normRift(r); return G.rift; };
const scaleDice = (dice, m) => typeof diceAvg === 'function' && typeof dmgDice === 'function' ? dmgDice(Math.max(1, Math.round(diceAvg(dice) * m))) : dice;
const runSeconds = a => a ? (a.startedAt ? (Date.now() - a.startedAt) / 1000 : 0) + (a.penalty || 0) - (a.bonus || 0) : 0;
// biomes that can spawn monsters (they need both monster families and variants)
const biomes = () => { const L = typeof BIOMES !== 'undefined' && typeof BIOME_VARIANT !== 'undefined' ? Object.keys(BIOMES).filter(k => BIOMES[k] && Array.isArray(BIOMES[k].fam) && Array.isArray(BIOME_VARIANT[k])) : []; return L.length ? L : ['meadow']; };

function scaleFoes(foes, a) {
  if (a.kind !== 'greater') return foes;
  const m = grMult(a.level);
  for (const f of foes) {
    f.maxhp = Math.round(f.maxhp * m.hp * (a.power ? 0.7 : 1)); f.hp = f.maxhp;
    (f.attacks || []).forEach(x => { if (x.dice) x.dice = scaleDice(x.dice, m.dmg); });
    f.name = (`GR${a.level} ` + f.name).slice(0, 16);
  }
  return foes;
}
function foeLevel(a) { return Math.min(720, G.lvl + (a.kind === 'greater' ? grMult(a.level).lvlBonus : 0)); }
function makePack(a) {
  const biome = pick(biomes()), lvl = foeLevel(a);
  let table = []; try { table = typeof spawnTable === 'function' ? spawnTable(biome, lvl) : []; } catch (e) { table = []; }
  const src = table.length ? table : BESTIARY.filter(x => x.rank === 'normal'), n = R() < 0.35 ? 3 : 2, foes = [];
  for (let i = 0; i < n; i++) foes.push(makeMonster(pick(src), Math.max(1, lvl - (i ? 1 : 0)), G.difficulty));
  if (R() < 0.22) { const el = BESTIARY.filter(b => b.rank === 'elite'); if (el.length) foes[0] = makeMonster(pick(el), lvl + 1, G.difficulty); }
  a.biome = biome;
  if (a.power && a.kind !== 'greater') for (const f of foes) { f.maxhp = Math.round(f.maxhp * 0.7); f.hp = f.maxhp; }
  return scaleFoes(foes, a);
}
function makeGuardian(a) {
  const lvl = foeLevel(a) + 2;
  const bossKeys = typeof MONSTERS !== 'undefined' ? Object.keys(MONSTERS).filter(k => MONSTERS[k].boss) : [];
  let g;
  try { g = bossKeys.length ? makeMonster({ unique: pick(bossKeys) }, lvl, G.difficulty) : null; } catch (e) { g = null; }
  if (!g) { g = makeMonster(pick(BESTIARY.filter(b => b.rank === 'elite').concat(BESTIARY).slice(0, 40)), lvl, G.difficulty); g.maxhp *= 5; g.hp = g.maxhp; g.boss = true; }
  g.name = 'RIFT GUARDIAN'; g.boss = true;
  return scaleFoes([g], a);
}
function healParty(frac) {
  const all = [G, ...(G.companions || [])];
  for (const c of all) { const D = derive(c); c.hp = Math.max(c.hp, Math.min(D.hpMax, Math.round(D.hpMax * frac))); }
}
function grantRewards(rw, label) {
  G.gold += rw.gold; addItem('awk_stone', rw.stones); if (rw.shards) addItem('shard', rw.shards);
  const xp = Math.round(Math.max(1, xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)) - xpForLevel(G.lvl)) * rw.xpShare);
  if (typeof gainXP === 'function' && xp > 0) gainXP(G, xp);
  let it = null;
  try { it = makeItem({ lvl: G.lvl, rarity: rw.rarity }); if (G.bag.length < BAG_MAX) G.bag.push(it); else it = null; } catch (e) { it = null; }
  const lines = [label, `+${fmt(rw.gold)} G  +${rw.stones} AWAKENING STONE${rw.stones > 1 ? 'S' : ''}`, rw.shards ? `+${rw.shards} GLIMMER SHARDS (GAMBLER)` : '', xp ? `+${fmt(xp)} XP` : ''];
  if (it) lines.push(`ITEM: ${it.name}`); else lines.push('BAG FULL - NO ITEM');
  if (rw.keys) lines.push(`+${rw.keys} GREATER RIFT KEY`);
  return lines.filter(Boolean);
}

function fightPack(scene) {
  const r = RF(), a = r.active; if (!a) return;
  if (a.kind === 'greater' && !a.startedAt) a.startedAt = Date.now();
  const guardian = a.progress >= 100, foes = guardian ? makeGuardian(a) : makePack(a), worth = foes.reduce((s, f) => s + foeProgress(f), 0);
  a.power = false;
  startBattle(foes, { onEnd: result => {
    const r2 = RF(), a2 = r2.active; if (!a2) return;
    if (result === 'win') {
      a2.packs = (a2.packs || 0) + 1;
      if (guardian) return closeRift();
      a2.progress = Math.min(100, (a2.progress || 0) + worth);
      if (R() < 0.2) { const id = pick(Object.keys(PYLONS)); a2.pylon = id; if (id === 'heal') healParty(1); if (id === 'power') a2.power = true; if (id === 'speed') a2.bonus = (a2.bonus || 0) + 20; }
      else a2.pylon = null;
    } else if (result === 'lose') {
      a2.deaths = (a2.deaths || 0) + 1; healParty(0.5);
      if (a2.kind === 'greater') a2.penalty = (a2.penalty || 0) + DEATH_PENALTY;
    }
    saveGame();
  } });
}
function closeRift() {
  const r = RF(), a = r.active; if (!a) return;
  r.active = null; r.closed++;
  if (G.stats) G.stats.rifts = (G.stats.rifts || 0) + 1;
  let lines;
  if (a.kind === 'normal') {
    const rw = riftRewards('normal', 1, G.lvl); r.keys += rw.keys;
    lines = grantRewards(rw, 'RIFT CLOSED');
    if (typeof addSeasonXp === 'function') addSeasonXp(80);
  } else {
    const time = runSeconds(a), res = grResult(time), rw = riftRewards('greater', a.level, G.lvl, res.timed);
    lines = [`GREATER RIFT ${a.level} ${res.timed ? 'TIMED' : 'TOO SLOW'}: ${fmtTime(time)}`, ...grantRewards(rw, res.timed ? `UNLOCKED UP TO LEVEL ${Math.min(GR_MAX, a.level + res.unlock)}` : 'NO NEW LEVELS UNLOCKED')];
    if (res.timed) {
      r.best = Math.max(r.best, Math.min(GR_MAX - 1, a.level + res.unlock - 1));
      r.bestByClass[G.cls] = Math.max(r.bestByClass[G.cls] || 0, a.level);
      r.board = addToBoard(r.board, { level: a.level, time: Math.round(time), cls: G.cls, name: G.name, date: new Date().toISOString().slice(0, 10) });
      r.pick = Math.min(maxUnlocked(r.best), a.level + 1);
    }
    if (typeof addSeasonXp === 'function') addSeasonXp(res.timed ? 120 + 10 * a.level : 60);
  }
  saveGame(); SFX.act_complete ? SFX.act_complete() : SFX.confirm();
  say(lines);
}

class RiftScene {
  constructor() { this.opaque = true; this.i = 0; RF(); }
  opts() { const r = RF(); return r.active ? ['FIGHT', 'ABANDON'] : ['NORMAL RIFT', 'GREATER RIFT', 'LEADERBOARD']; }
  update() {
    const r = RF(), a = r.active, opts = this.opts();
    if (this.i >= opts.length) this.i = 0;
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('up')) { this.i = (this.i + opts.length - 1) % opts.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % opts.length; SFX.cursor(); }
    if (!a && opts[this.i] === 'GREATER RIFT') {
      const max = maxUnlocked(r.best);
      if (nav('left')) { r.pick = Math.max(1, r.pick - 1); SFX.cursor(); }
      if (nav('right')) { r.pick = Math.min(max, r.pick + 1); SFX.cursor(); }
    }
    if (!P('a')) return;
    const o = opts[this.i];
    if (o === 'FIGHT') { SFX.select(); return fightPack(this); }
    if (o === 'ABANDON') return choose(['ABANDON RIFT', 'KEEP GOING'], k => { if (k === 0) { r.active = null; saveGame(); SFX.back(); } }, a.kind === 'greater' ? 'The key is lost.' : 'Progress is lost.');
    if (o === 'NORMAL RIFT') { SFX.select(); r.active = { kind: 'normal', level: 0, progress: 0, packs: 0 }; saveGame(); this.i = 0; return; }
    if (o === 'GREATER RIFT') {
      if (r.keys < 1) { SFX.error(); return say(['A GREATER RIFT needs a key.', 'Close a NORMAL RIFT to earn one.']); }
      r.keys--; SFX.select(); r.active = { kind: 'greater', level: Math.min(r.pick, maxUnlocked(r.best)), progress: 0, packs: 0, startedAt: 0, penalty: 0, bonus: 0 }; saveGame(); this.i = 0; return;
    }
    if (o === 'LEADERBOARD') { SFX.select(); return push(new RiftBoardScene()); }
  }
  draw() {
    const r = RF(), a = r.active;
    fill(0, 0, W, H, 0); hdr();
    text('RIFTS', 4, 13, 'gold'); textR(`KEYS ${r.keys}  BEST GR${r.best}`, 156, 13, 2);
    frame(2, 23, 156, 52);
    if (!a) {
      text('Random packs fill the bar.', 6, 26, 3, 1, 154);
      text('At 100% the GUARDIAN comes.', 6, 35, 3, 1, 154);
      text(`GREATER RIFT LEVEL < ${r.pick} >`, 6, 46, 'gold', 1, 154);
      const m = grMult(r.pick); text(`FOES HP x${m.hp.toFixed(1)} DMG x${m.dmg.toFixed(1)}`, 6, 55, 2, 1, 154);
      text(`TIMER ${fmtTime(GR_TIME)}  CLOSED ${r.closed}`, 6, 64, 2, 1, 154);
    } else {
      const t = runSeconds(a), left = GR_TIME - t;
      text(a.kind === 'greater' ? `GREATER RIFT ${a.level}` : 'NORMAL RIFT', 6, 27, 'gold');
      if (a.kind === 'greater') textR(a.startedAt ? fmtTime(left) : fmtTime(GR_TIME), 154, 27, left < 0 ? 'red' : left < 120 ? 'gold' : 3);
      text('PROGRESS', 6, 38, 2); textR(`${Math.floor(a.progress)}%`, 154, 38, 3);
      fill(6, 48, 146, 6, 2); fill(6, 48, Math.round(146 * Math.min(100, a.progress) / 100), 6, a.progress >= 100 ? 'red' : 'gold');
      text(a.progress >= 100 ? 'THE RIFT GUARDIAN WAITS' : `PACKS ${a.packs || 0}  DEATHS ${a.deaths || 0}`, 6, 56, a.progress >= 100 ? 'red' : 2, 1, 154);
      if (a.pylon) text(PYLONS[a.pylon].name, 6, 65, 'green', 1, 154);
    }
    const opts = this.opts();
    opts.forEach((o, k) => { const y = 80 + k * 12; if (k === this.i) fill(4, y - 1, 152, 11, 1); text(o === 'FIGHT' && a && a.progress >= 100 ? 'FIGHT THE GUARDIAN' : o, 8, y + 1, k === this.i ? 'gold' : 3); });
    fill(0, 135, W, 9, 0);
    text(a ? 'A:SELECT' : 'A:ENTER', 3, 136, 'gold'); textR(!a && opts[this.i] === 'GREATER RIFT' ? 'L/R:LEVEL' : 'B:BACK', 157, 136, 2);
  }
}
class RiftBoardScene {
  constructor() { this.opaque = true; }
  update() { if (P('b') || P('a')) { SFX.back(); removeScene(this); } }
  draw() {
    const r = RF();
    fill(0, 0, W, H, 0); hdr();
    text('GREATER RIFT BOARD', 4, 13, 'gold');
    frame(2, 23, 156, 110);
    if (!r.board.length) { textC('NO TIMED RUNS YET', 80, 70, 2); }
    r.board.forEach((e, k) => {
      const y = 27 + k * 10;
      text(`${String(k + 1).padStart(2, ' ')} GR${e.level}`, 6, y, k === 0 ? 'gold' : 3);
      text(String(e.name || '').slice(0, 8), 62, y, 3); textR(fmtTime(e.time), 154, y, 2);
    });
    fill(0, 135, W, 9, 0); text('B:BACK', 3, 136, 2);
    const cls = Object.entries(r.bestByClass).sort((a, b) => b[1] - a[1])[0];
    if (cls) textR(`BEST ${String(CLASSES[cls[0]] ? CLASSES[cls[0]].name : cls[0]).slice(0, 8)} GR${cls[1]}`, 157, 136, 'gold');
  }
}
window.RiftScene = RiftScene; window.RiftBoardScene = RiftBoardScene;

if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('ACTIVITY FINDER'); L.splice(at >= 0 ? at + 1 : L.length, 0, 'RIFTS'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'RIFTS') { SFX.select(); return push(new RiftScene()); } return u0.apply(this, arguments); };
}
window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { RIFTS: 'Normal and greater rifts: progress bar, guardian, timer, leaderboard.' });
})();
