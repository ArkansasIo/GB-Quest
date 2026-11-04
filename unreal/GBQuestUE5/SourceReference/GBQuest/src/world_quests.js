'use strict';
// ================================================================ WORLD QUESTS, RARE SPAWNS AND INVASIONS
// MAIN MENU > CHALLENGES > WORLD QUESTS.
//   * WORLD QUESTS: 4 a day in zones near your level: SLAY (defeat 12 foes there), ELITES (defeat 2 elites there)
//     or HUNT (defeat that zone's rare). They complete and pay out on their own; they expire at midnight.
//   * RARES: every outdoor zone has one named rare elite a day (6% of encounters there until it falls). Rares hit
//     harder, give 5x XP and always drop an epic item.
//   * INVASIONS: every 4 hours one zone near your level is invaded: half its encounters are tougher INVADERS.
//     Defeat 15 for the invasion chest.
// Pure rules are exported as GBQWorld for tests; the game wiring runs only inside the game.

const WQ_TYPES = {
  slay: { name: 'SLAY', target: 12, desc: z => `Defeat 12 foes in ${z}.` },
  elites: { name: 'ELITES', target: 2, desc: z => `Defeat 2 elites in ${z}.` },
  rare: { name: 'HUNT', target: 1, desc: z => `Defeat the rare in ${z}.` },
};
const RARE_ADJ = ['GNASHING', 'ASHEN', 'HOLLOW-EYED', 'IRONHIDE', 'SHRIEKING', 'GILDED', 'BLIGHTED', 'MOONLIT', 'RAVENOUS', 'ANCIENT', 'SPLINTERED', 'DREAD'];
const RARE_TITLE = ['THE UNBOWED', 'THE HUNGRY', 'THE LOST', 'OF THE MARSH', 'THE PALE', 'THE RED', 'THE OLD', 'THE QUIET'];
const INVASION_HOURS = 4, INVASION_GOAL = 15, RARE_CHANCE = 0.06;
function wqHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// outdoor zones a hero of this level should visit (nearest ones when nothing fits)
function zonesNear(zones, lvl) {
  const out = zones.filter(z => !z.town && z.lvl && z.lvl[0] <= lvl + 4 && z.lvl[1] >= lvl - 12);
  return out.length ? out : zones.filter(z => !z.town && z.lvl).sort((a, b) => Math.abs(a.lvl[0] - lvl) - Math.abs(b.lvl[0] - lvl)).slice(0, 4);
}
function rollWorldQuests(day, zones, lvl) {
  const pool = zonesNear(zones, lvl).slice(), out = [], types = Object.keys(WQ_TYPES);
  let h = wqHash(day + '|' + lvl);
  while (out.length < 4 && pool.length) { const z = pool.splice(h % pool.length, 1)[0]; h = wqHash(h + z.id); const type = types[h % types.length]; out.push({ id: `${day}:${z.id}`, zone: z.id, type, target: WQ_TYPES[type].target, progress: 0, done: false }); }
  return out;
}
const rareName = (day, zoneId) => { const h = wqHash(day + '#' + zoneId); return { adj: RARE_ADJ[h % RARE_ADJ.length], title: RARE_TITLE[(h >>> 8) % RARE_TITLE.length] }; };
// the invaded zone for a moment in time: { window, zone, endsAt }
function invasionAt(date, zones, lvl) {
  const t = date instanceof Date ? date.getTime() : Number(date), w = Math.floor(t / (INVASION_HOURS * 36e5)), pool = zonesNear(zones, lvl);
  return pool.length ? { window: w, zone: pool[wqHash('inv' + w) % pool.length].id, endsAt: (w + 1) * INVASION_HOURS * 36e5 } : null;
}
// count what one won battle does for a quest
function questProgress(q, zoneId, foes) {
  if (q.done || q.zone !== zoneId) return 0;
  if (q.type === 'slay') return foes.length;
  if (q.type === 'elites') return foes.filter(f => f.elite || f.rare).length;
  if (q.type === 'rare') return foes.filter(f => f.rare === zoneId).length;
  return 0;
}
const wqReward = (type, lvl) => ({ gold: Math.round((30 + lvl * 12) * (type === 'rare' ? 2 : 1)), xpShare: type === 'rare' ? 0.25 : 0.15, rarity: type === 'slay' ? 2 : 3, seasonXp: 120 });

if (typeof globalThis !== 'undefined') globalThis.GBQWorld = { WQ_TYPES, zonesNear, rollWorldQuests, rareName, invasionAt, questProgress, wqReward, INVASION_GOAL, RARE_CHANCE };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof rollEncounter === 'function' && typeof ZONES !== 'undefined') {
  const day = () => (typeof dayKey === 'function' ? dayKey() : new Date().toISOString().slice(0, 10));
  const zoneName = id => (ZONE_BY_ID[id] || { name: id }).name;
  const span = () => Math.max(1, xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)) - xpForLevel(G.lvl));
  function W() {
    const d = day(), w = G.wq = G.wq && typeof G.wq === 'object' ? G.wq : {};
    if (w.day !== d) { w.day = d; w.list = rollWorldQuests(d, ZONES, G.lvl); w.rares = {}; }
    const inv = invasionAt(new Date(), ZONES, G.lvl);
    if (inv && (!w.invasion || w.invasion.window !== inv.window)) w.invasion = { window: inv.window, zone: inv.zone, endsAt: inv.endsAt, kills: 0, claimed: false };
    return w;
  }
  (window.LOOP_HOOKS ||= []).push(() => { if (G) W(); });

  // rares and invaders appear in ordinary encounters
  { const re0 = rollEncounter; rollEncounter = function (zoneDef, opts) {
      const foes = re0.apply(this, arguments); if (!G || G.inst || !zoneDef || zoneDef.town) return foes;
      const w = W();
      if (!w.rares[zoneDef.id] && R() < RARE_CHANCE) {
        const fam = BIOMES[zoneDef.biome] && BIOMES[zoneDef.biome].fam || [], pool = BESTIARY.filter(b => fam.includes(b.fam)), base = pool.length ? pool[wqHash(day() + zoneDef.id) % pool.length] : BESTIARY[0];
        const f = makeMonster(base, zoneLevel(zoneDef) + 3, G.difficulty), n = rareName(day(), zoneDef.id);
        f.rare = zoneDef.id; f.elite = true; f.maxhp = Math.round(f.maxhp * 2.5); f.hp = f.maxhp; f.xp = (f.xp || 1) * 5; f.gold = (f.gold || 1) * 4;
        f.name = `${n.adj} ${f.name}`.slice(0, 16); f.rareTitle = `${n.adj} ${base.name} ${n.title}`;
        toast('RARE SPOTTED', f.rareTitle.slice(0, 24), 'px_skull', 'boss_appear');
        return [f];
      }
      if (w.invasion && w.invasion.zone === zoneDef.id && Date.now() < w.invasion.endsAt && R() < 0.5)
        for (const f of foes) { f.invader = true; f.maxhp = Math.round(f.maxhp * 1.3); f.hp = f.maxhp; f.xp = Math.round((f.xp || 1) * 1.5); f.name = ('INVADER ' + f.name).slice(0, 16); }
      return foes;
    }; }

  function pay(type, label) {
    const r = wqReward(type, G.lvl); G.gold += r.gold; G.stats.goldEarned = (G.stats.goldEarned || 0) + r.gold;
    gainXP(G, Math.round(span() * r.xpShare)); addGear(makeItem({ lvl: G.lvl + 1, rarity: r.rarity, ...(typeof smartKind === 'function' ? smartKind(G) : {}) }));
    if (typeof addSeasonXp === 'function') addSeasonXp(r.seasonXp);
    toast('WORLD QUEST DONE', label.slice(0, 24), 'item_chest', 'quest_done'); chatLog('quest', 'QUEST', `World quest complete: ${label}. +${fmt(r.gold)} G, XP and an item.`);
  }
  { const f0 = Battle.prototype.finish; Battle.prototype.finish = function (result) {
      try {
        if (result === 'win' && G && !G.inst && ZONE_BY_ID[G.map]) {
          const w = W(), zone = G.map, foes = this.foes || [];
          for (const q of w.list) { const n = questProgress(q, zone, foes); if (n) { q.progress = Math.min(q.target, q.progress + n); if (q.progress >= q.target && !q.done) { q.done = true; pay(q.type, `${WQ_TYPES[q.type].name}: ${zoneName(q.zone)}`); } } }
          for (const f of foes) if (f.rare) { w.rares[f.rare] = true; addGear(makeItem({ lvl: (f.lvl || G.lvl) + 2, rarity: 4, boss: true })); chatLog('loot', 'LOOT', `${f.rareTitle || f.name} is slain! It drops an epic item.`); }
          const inv = w.invasion, invaders = foes.filter(f => f.invader).length;
          if (inv && invaders && !inv.claimed) { inv.kills += invaders; if (inv.kills >= INVASION_GOAL) { inv.claimed = true; for (let i = 0; i < 2; i++) addGear(makeItem({ lvl: G.lvl + 2, rarity: 3 })); G.gold += 100 + G.lvl * 25; toast('INVASION REPELLED', zoneName(inv.zone).slice(0, 22), 'px_crown', 'act_complete'); } }
        }
      } catch (e) { console.warn('world quests', e); }
      return f0.apply(this, arguments);
    }; }

  window.worldQuestsMenu = function () {
    const w = W(), inv = w.invasion, mins = inv ? Math.max(0, Math.round((inv.endsAt - Date.now()) / 6e4)) : 0;
    const rows = w.list.map(q => `${q.done ? '# ' : ''}${WQ_TYPES[q.type].name} ${zoneName(q.zone).slice(0, 12)} ${q.progress}/${q.target}`.slice(0, 22));
    const invRow = inv ? `INVADED ${zoneName(inv.zone).slice(0, 9)} ${inv.claimed ? 'DONE' : `${Math.min(inv.kills, INVASION_GOAL)}/${INVASION_GOAL}`}` : 'NO INVASION';
    choose([...rows, invRow, 'RARES TODAY', 'BACK'], k => {
      if (k < 0) return;
      if (k < w.list.length) { const q = w.list[k], z = ZONE_BY_ID[q.zone]; return say([`${WQ_TYPES[q.type].name}: ${zoneName(q.zone)} (LV ${z.lvl[0]}-${z.lvl[1]})`, WQ_TYPES[q.type].desc(zoneName(q.zone)), q.done ? 'Complete.' : `${q.progress}/${q.target}. Ends at midnight.`, q.type === 'rare' ? `Today: ${rareName(day(), q.zone).adj} ... ${rareName(day(), q.zone).title}` : ''], window.worldQuestsMenu); }
      if (k === w.list.length) return say(inv ? [`${zoneName(inv.zone)} is under attack!`, `Half its encounters are INVADERS. Defeat ${INVASION_GOAL} for the invasion chest.`, inv.claimed ? 'Repelled. Next invasion soon.' : `${Math.min(inv.kills, INVASION_GOAL)}/${INVASION_GOAL}. ${mins} min left.`] : 'All quiet.', window.worldQuestsMenu);
      if (k === w.list.length + 1) { const near = zonesNear(ZONES, G.lvl).slice(0, 6); return say(near.map(z => `${w.rares[z.id] ? '# ' : ''}${zoneName(z.id).slice(0, 12)}: ${rareName(day(), z.id).adj}`), window.worldQuestsMenu); }
    }, `WORLD QUESTS ${w.list.filter(q => q.done).length}/${w.list.length}`);
  };
}
