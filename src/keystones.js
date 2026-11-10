'use strict';
// ================================================================ KEYSTONES: timed, scaling dungeon runs (Mythic+ style)
// MAIN MENU > CHALLENGES > KEYSTONES. A keystone names a dungeon and a level (+2 and up).
//   * Foes get +8% HP and damage per level above +1, plus the week's affixes:
//       +2  FORTIFIED (trash +20% HP, +10% dmg) or TYRANNICAL (bosses +30% HP, +15% dmg), alternating weekly
//       +4  one rotating affix, +7 a second: RAGING, BRAMBLED, WARDED, SWIFT or BOLSTERED
//   * The timer starts when you arrive. Clear the final boss in time to upgrade the key (+1, +2 under 80%
//     of the timer, +3 under 60%) and earn a bonus chest; finish late and the key drops a level. Leaving
//     or wiping fails the run and also drops the key a level (never below +2).
//   * Every finished run moves the key to a new dungeon. Timed runs count for the weekly vault, keystone
//     bounties and the season pass.
// Pure rules are exported as GBQKeystones for tests; the game wiring runs only inside the game.

const KEY_MIN = 2, KEY_MAX = 30;
const KEY_AFFIXES = {
  fortified: { name: 'FORTIFIED', desc: 'Trash +20% HP and +10% damage.', trash: { hp: 1.2, dmg: 1.1 } },
  tyrannical: { name: 'TYRANNICAL', desc: 'Bosses +30% HP and +15% damage.', boss: { hp: 1.3, dmg: 1.15 } },
  raging: { name: 'RAGING', desc: 'Foes start battles MIGHTY (+15% damage) for 3 rounds.', start: { buff: 'might', rounds: 3 } },
  brambled: { name: 'BRAMBLED', desc: 'Foes have THORNSKIN all battle.', start: { buff: 'thornskin', rounds: 99 } },
  warded: { name: 'WARDED', desc: 'Foes start FORTIFIED (+25% resist) for 2 rounds.', start: { buff: 'fortify', rounds: 2 } },
  swift: { name: 'SWIFT', desc: 'Foes start HASTED for 1 round.', start: { buff: 'haste', rounds: 1 } },
  bolstered: { name: 'BOLSTERED', desc: 'All foes +10% HP.', all: { hp: 1.1 } },
};
const ROTATING = ['raging', 'brambled', 'warded', 'swift', 'bolstered'];
const SEASONAL_AFFIXES = ['cinderbound', 'permafrost', 'overgrown', 'eclipsed'];
const seasonalAffixForWeek = weekKey => { const month = Math.max(1, Math.min(12, Number(String(weekKey).split('-')[1]) || 1)); return SEASONAL_AFFIXES[Math.floor((month - 1) / 3)]; };
Object.assign(KEY_AFFIXES, {
  cinderbound: { name: 'CINDERBOUND', desc: 'Season of Emberfall: all foes +12% HP and +8% damage; foes begin MIGHTY.', all: { hp: 1.12, dmg: 1.08 }, start: { buff: 'might', rounds: 2 } },
  permafrost: { name: 'PERMAFROST', desc: 'Season of Frostwake: all foes +12% HP and begin FORTIFIED.', all: { hp: 1.12, dmg: 1.04 }, start: { buff: 'fortify', rounds: 2 } },
  overgrown: { name: 'OVERGROWN', desc: 'Season of Greentide: all foes +10% HP and begin with THORNSKIN.', all: { hp: 1.10, dmg: 1.06 }, start: { buff: 'thornskin', rounds: 3 } },
  eclipsed: { name: 'ECLIPSED', desc: 'Season of Suncrown: all foes +8% HP and +12% damage; foes begin HASTED.', all: { hp: 1.08, dmg: 1.12 }, start: { buff: 'haste', rounds: 2 } },
});
// a week number from a 'YYYY-MM-DD' Monday key (days since 2026-01-05, a Monday, / 7)
const weekIndex = weekKey => Math.floor((Date.UTC(...String(weekKey).split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v))) - Date.UTC(2026, 0, 5)) / 6048e5);
function weeklyAffixes(weekKey, level) {
  const w = weekIndex(weekKey), n = ((w % ROTATING.length) + ROTATING.length) % ROTATING.length, out = [];
  if (level >= 2) out.push(((w % 2) + 2) % 2 === 0 ? 'fortified' : 'tyrannical');
  if (level >= 4) out.push(ROTATING[n]);
  if (level >= 7) out.push(ROTATING[(n + 2) % ROTATING.length]);
  if (level >= 10) out.push(seasonalAffixForWeek(weekKey));
  return out;
}
const keyScale = level => Math.round(Math.pow(1.08, Math.max(0, Math.min(KEY_MAX, level) - 1)) * 1000) / 1000;
// HP and damage multipliers for one foe on a key
function foeMultipliers(level, affixes, boss) {
  let hp = keyScale(level), dmg = keyScale(level);
  for (const id of affixes || []) {
    const a = KEY_AFFIXES[id]; if (!a) continue;
    const part = a.all || (boss ? a.boss : a.trash);
    if (part) { hp *= part.hp || 1; dmg *= part.dmg || 1; }
  }
  return { hp: Math.round(hp * 1000) / 1000, dmg: Math.round(dmg * 1000) / 1000 };
}
const startEffects = affixes => (affixes || []).map(id => KEY_AFFIXES[id] && KEY_AFFIXES[id].start).filter(Boolean);
// seconds on the timer: 2 minutes plus 75 seconds a room
const timeLimit = rooms => 120 + 75 * Math.max(1, Math.floor(Number(rooms) || 1));
// result of a finished run: timed?, how many levels up or down, the new key level
function runResult(level, elapsed, limit) {
  const timed = elapsed <= limit, up = !timed ? -1 : elapsed <= limit * 0.6 ? 3 : elapsed <= limit * 0.8 ? 2 : 1;
  return { timed, change: up, level: Math.max(KEY_MIN, Math.min(KEY_MAX, level + up)) };
}
const failResult = level => ({ timed: false, change: -1, level: Math.max(KEY_MIN, level - 1), failed: true });
// bonus chest: more and better items for higher keys; one item when late
function keyLoot(level, dungeonLvl, timed) {
  return { count: timed ? Math.min(3, 1 + Math.floor(level / 5)) : 1, ilvl: Math.max(1, Math.min(720, Math.floor(dungeonLvl) + 2 * level)), rarity: level >= 12 ? 5 : level >= 7 ? 4 : 3 };
}
// a dungeon near the hero's level (never the one just run)
function pickKeyDungeon(dungeons, heroLvl, rnd, avoid) {
  const near = dungeons.filter(d => d.lvl <= heroLvl + 3 && d.id !== avoid);
  const pool = near.length ? near : dungeons.filter(d => d.id !== avoid).sort((a, b) => a.lvl - b.lvl).slice(0, 1);
  return pool[Math.floor(rnd() * pool.length) % pool.length] || dungeons[0];
}
const fmtClock = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

if (typeof globalThis !== 'undefined') globalThis.GBQKeystones = { KEY_MIN, KEY_MAX, KEY_AFFIXES, SEASONAL_AFFIXES, seasonalAffixForWeek, weekIndex, weeklyAffixes, keyScale, foeMultipliers, startEffects, timeLimit, runResult, failResult, keyLoot, pickKeyDungeon, fmtClock };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof enterInstance === 'function' && typeof DUNGEONS !== 'undefined') {
  const thisWeek = () => (typeof weekKeyOf === 'function' ? weekKeyOf() : '2026-01-05');
  const dungeonDef = id => DUNGEONS.find(d => d.id === id);
  const K = () => (G.keystone = G.keystone && typeof G.keystone === 'object' ? G.keystone : { dungeon: null, level: 0, best: {}, run: null });
  const activeRun = () => { const k = G && G.keystone, r = k && k.run; return r && r.entered && !r.done && G.inst && G.inst.kind === 'dungeon' && G.inst.def.id === r.dungeon ? r : null; };
  const scaleDice = (dice, m) => typeof diceAvg === 'function' && typeof dmgDice === 'function' ? dmgDice(diceAvg(dice) * m) : dice;

  function grantKey(level, avoid) { const k = K(), d = pickKeyDungeon(DUNGEONS, G.lvl, R, avoid); k.dungeon = d.id; k.level = Math.max(KEY_MIN, level); return d; }

  // foes in a keystone dungeon: level scaling and stat affixes
  { const fm0 = applyFloorMod; applyFloorMod = function (foes, mod) {
      const out = fm0(foes, mod), r = activeRun(); if (!r) return out;
      for (const f of foes) {
        const m = foeMultipliers(r.level, r.affixes, !!f.boss);
        f.maxhp = Math.round(f.maxhp * m.hp); f.hp = f.maxhp;
        (f.attacks || []).forEach(a => { if (a.dice) a.dice = scaleDice(a.dice, m.dmg); });
        f.name = (`+${r.level} ` + f.name).slice(0, 16);
      }
      return out;
    }; }
  // battle-start affixes on foes
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.call(this); const r = activeRun(); if (!r) return;
      for (const e of startEffects(r.affixes)) if (BUFFS[e.buff]) for (const u of this.foes) addEffect(u, { id: e.buff, rounds: e.rounds });
    }; }

  function finishRun(r, result) {
    const k = K(), def = dungeonDef(r.dungeon) || { name: 'DUNGEON', lvl: G.lvl }, elapsed = (Date.now() - r.start) / 1000;
    r.done = true; k.run = null;
    const lines = [];
    if (result.timed) {
      k.best[r.dungeon] = Math.max(k.best[r.dungeon] || 0, r.level); G.stats.keystones = (G.stats.keystones || 0) + 1;
      if (G.loop && G.loop.week) G.loop.week.bestKey = Math.max(G.loop.week.bestKey || 0, r.level);
      lines.push(`+${r.level} ${def.name} TIMED!`, `${fmtClock(elapsed)} of ${fmtClock(r.limit)}. Key +${result.change}.`);
    } else lines.push(result.failed ? `+${r.level} ${def.name} FAILED.` : `+${r.level} ${def.name} OUT OF TIME.`, result.failed ? 'You left or fell. The key drops a level.' : `${fmtClock(elapsed)} of ${fmtClock(r.limit)}. The key drops a level.`);
    if (!result.failed) {
      const loot = keyLoot(r.level, def.lvl, result.timed);
      for (let i = 0; i < loot.count; i++) addGear(makeItem({ lvl: loot.ilvl, rarity: loot.rarity, boss: true }));
      lines.push(`Bonus chest: ${loot.count} item${loot.count > 1 ? 's' : ''}, item level ${loot.ilvl}.`);
      if (typeof addSeasonXp === 'function') addSeasonXp(result.timed ? 100 + 20 * r.level : 40);
    }
    const next = grantKey(result.level, r.dungeon);
    lines.push(`New key: +${k.level} ${next.name}.`);
    saveGame(); toast(result.timed ? 'KEYSTONE TIMED' : 'KEYSTONE DEPLETED', `+${r.level} ${def.name}`.slice(0, 22), 'item_key', result.timed ? 'act_complete' : 'error');
    say(lines);
  }
  // called by the loop poll (mmo_loop.js) twice a second
  window.keystonePoll = function () {
    const k = G && G.keystone, r = k && k.run; if (!r || r.done) return;
    if (!r.entered) {
      if (G.inst && G.inst.kind === 'dungeon' && G.inst.def.id === r.dungeon) { r.entered = true; r.start = Date.now(); r.base = G.stats.dungeons; r.limit = timeLimit(G.inst.map.roomCount || (G.inst.map.rooms || []).length); toast(`+${r.level} KEYSTONE`, `TIMER ${fmtClock(r.limit)}`, 'item_key', 'stairs'); }
      else if (Date.now() - r.asked > 20000) k.run = null; // never arrived: the key is not spent
      return;
    }
    if (G.stats.dungeons > r.base) return finishRun(r, runResult(r.level, (Date.now() - r.start) / 1000, r.limit));
    if (!G.inst || G.inst.def.id !== r.dungeon) return finishRun(r, failResult(r.level));
  };
  // timer on the field
  if (typeof Field !== 'undefined') { const d0 = Field.prototype.draw; Field.prototype.draw = function () {
      d0.apply(this, arguments); const r = activeRun(); if (!r) return;
      const left = r.limit - (Date.now() - r.start) / 1000;
      // top-left: the minimap owns the top-right corner
      fill(1, 12, 56, 9, 0); text(`+${r.level} ${left >= 0 ? fmtClock(left) : '-' + fmtClock(-left)}`, 3, 13, left >= 0 ? (left < 60 ? 'gold' : 3) : 'red');
    }; }

  window.keystoneMenu = function () {
    const k = K();
    if (!k.dungeon) return choose(['GET A +2 KEYSTONE', 'BACK'], i => { if (i !== 0) return; const d = grantKey(KEY_MIN); SFX.chest(); saveGame(); say([`You receive a +2 keystone: ${d.name}.`, 'Open KEYSTONES again to start it.']); }, 'KEYSTONES: timed, scaling dungeons');
    const def = dungeonDef(k.dungeon), aff = weeklyAffixes(thisWeek(), k.level), m = foeMultipliers(k.level, [], false);
    const info = [`+${k.level} ${def.name} (LV ${def.lvl})`, `FOES +${Math.round((m.hp - 1) * 100)}% HP AND DAMAGE`, `AFFIXES: ${aff.map(a => KEY_AFFIXES[a].name).join(', ') || 'NONE'}`, ...aff.map(a => KEY_AFFIXES[a].desc), `BEST HERE: +${k.best[k.dungeon] || 0}`];
    choose(['START RUN', 'KEY DETAILS', 'BACK'], i => {
      if (i === 1) return say(info, window.keystoneMenu);
      if (i !== 0) return;
      if (G.inst) { SFX.error(); return say('Leave your current instance first.'); }
      if (G.ghost) { SFX.error(); return say('Recover your body first.'); }
      k.run = { dungeon: k.dungeon, level: k.level, affixes: aff, asked: Date.now(), entered: false, done: false };
      while (scenes.length > 1 && scenes[scenes.length - 1] !== currentField()) scenes.pop();
      enterInstance('dungeon', def, 1, Math.max(1, Math.min(4, typeof fieldPartySize === 'function' ? fieldPartySize() : 1)));
    }, `+${k.level} ${def.name.slice(0, 14)} ${aff.map(a => KEY_AFFIXES[a].name.slice(0, 4)).join(' ')}`);
  };
}
