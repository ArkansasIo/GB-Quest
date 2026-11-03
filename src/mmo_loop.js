'use strict';
// ================================================================ MMO LOOP: bounties, weekly vault, login streak, season pass
// MAIN MENU > CHALLENGES. Everything here counts progress from the hero's existing G.stats counters
// (kills, elites, dungeons, quests, crafted, fish, world bosses, steps, keystones), measured from a
// baseline taken when a bounty, week or season starts. No battle or quest code needs to call in.
//   * BOUNTY BOARD: 3 daily and 3 weekly bounties, picked per hero and per day/week. Claim for gold,
//     XP, materials and season XP. New dailies at local midnight, weeklies on Monday.
//   * WEEKLY VAULT: clear dungeons (keystone runs count) to unlock 1 / 2 / 3 vault slots (1, 4, 8 clears).
//     Next week, choose ONE of that many items. Item level follows your level and best keystone.
//   * LOGIN STREAK: the first visit of each day pays a reward on a 7-day cycle; missing a day restarts it.
//   * SEASON PASS: quarterly seasons, 50 tiers of 1,000 season XP. Every tier has a free reward;
//     tiers 25 and 50 add a title. Unclaimed rewards are kept until the season ends.
// The pure rules are exported as GBQLoop for tests; the game wiring runs only inside the game.

// ---------------------------------------------------------------- calendar (local time)
const loopPad2 = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${loopPad2(d.getMonth() + 1)}-${loopPad2(d.getDate())}`;
// weeks start on Monday; the key is that Monday's date
function weekKeyOf(d = new Date()) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return dayKey(m); }
const prevDayKey = (d = new Date()) => { const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); return dayKey(y); };

// ---------------------------------------------------------------- deterministic picks
function loopHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seededRng(seed) { let a = typeof seed === 'number' ? seed >>> 0 : loopHash(String(seed)); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- bounties
// stat: the G.stats counter; day / week: targets; minLvl: hero level before it can roll
const BOUNTY_TYPES = [
  { id: 'kills', stat: 'kills', name: 'SLAY FOES', day: 20, week: 150 },
  { id: 'elites', stat: 'elites', name: 'DEFEAT ELITES', day: 3, week: 20 },
  { id: 'dungeons', stat: 'dungeons', name: 'CLEAR DUNGEONS', day: 1, week: 5 },
  { id: 'quests', stat: 'quests', name: 'FINISH QUESTS', day: 3, week: 15 },
  { id: 'crafted', stat: 'crafted', name: 'CRAFT ITEMS', day: 3, week: 20 },
  { id: 'fish', stat: 'fish', name: 'CATCH FISH', day: 5, week: 30 },
  { id: 'steps', stat: 'steps', name: 'TRAVEL', day: 400, week: 3000 },
  { id: 'bosses', stat: 'worldBosses', name: 'SLAY WORLD BOSSES', day: 1, week: 3, minLvl: 5 },
  { id: 'keys', stat: 'keystones', name: 'TIME KEYSTONES', day: 1, week: 3, minLvl: 8, weekOnly: true },
];
const BOUNTY_BY_ID = Object.fromEntries(BOUNTY_TYPES.map(b => [b.id, b]));
// three distinct bounties for a hero, period and level; base = the hero's stats right now
function rollBounties(seed, period, lvl, stats) {
  const pool = BOUNTY_TYPES.filter(b => (lvl || 1) >= (b.minLvl || 1) && (period === 'week' || !b.weekOnly)), rng = seededRng(`${seed}|${period}`), out = [];
  while (out.length < 3 && pool.length) { const b = pool.splice(Math.floor(rng() * pool.length), 1)[0]; out.push({ id: b.id, stat: b.stat, target: b[period], base: Math.max(0, Number(stats && stats[b.stat]) || 0), claimed: false }); }
  return out;
}
const bountyProgress = (b, stats) => Math.max(0, Math.min(b.target, (Number(stats && stats[b.stat]) || 0) - b.base));
const bountyDone = (b, stats) => bountyProgress(b, stats) >= b.target;
// gold, XP share of a level, materials and season XP for a claimed bounty
function bountyReward(period, lvl) {
  const L = Math.max(1, Math.min(720, Math.floor(Number(lvl) || 1))), week = period === 'week';
  return { gold: Math.round((40 + L * 15) * (week ? 6 : 1)), xpShare: week ? 0.5 : 0.12, mats: week ? { shard: 3, ember: 1 } : { scrap: 4 }, seasonXp: week ? 500 : 150 };
}

// ---------------------------------------------------------------- login streak
const LOGIN_REWARDS = [
  { day: 1, gold: 1, items: { potion: 2 } }, { day: 2, gold: 2, items: { scrap: 5 } }, { day: 3, gold: 2, items: { ration: 3 } },
  { day: 4, gold: 3, items: { shard: 2 } }, { day: 5, gold: 3, items: { greater: 2 } }, { day: 6, gold: 4, items: { shard: 3 } },
  { day: 7, gold: 6, items: { star_shard: 1, ember: 1 } },
];
// what today's visit does to a streak: { streak, reward } (reward null when already paid today)
function loginStep(state, today, yesterday) {
  const last = state && state.last, streak = Math.max(0, Math.floor(Number(state && state.streak) || 0));
  if (last === today) return { streak, reward: null };
  const next = last === yesterday ? streak + 1 : 1;
  return { streak: next, reward: LOGIN_REWARDS[(next - 1) % LOGIN_REWARDS.length] };
}
const loginGold = (reward, lvl) => Math.round(reward.gold * (25 + Math.max(1, lvl || 1) * 6));

// ---------------------------------------------------------------- weekly vault
const vaultSlots = runs => runs >= 8 ? 3 : runs >= 4 ? 2 : runs >= 1 ? 1 : 0;
const VAULT_STEPS = [1, 4, 8];
// item level of vault choices: your level, +2 per best keystone level timed that week
const vaultItemLevel = (lvl, bestKey) => Math.max(1, Math.min(720, Math.floor(Number(lvl) || 1) + 2 * Math.max(0, Math.floor(Number(bestKey) || 0))));
// vault rarity: rare, epic from a +5 key, legendary from +10
const vaultRarity = bestKey => bestKey >= 10 ? 5 : bestKey >= 5 ? 4 : 3;

// ---------------------------------------------------------------- season pass
const SEASON_NAMES = ['EMBERFALL', 'FROSTWAKE', 'GREENTIDE', 'SUNCROWN'];
const SEASON_TIERS = 50, SEASON_XP_PER_TIER = 1000, SEASON_EPOCH = 2026;
// seasons are calendar quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec
function seasonFor(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3), n = (d.getFullYear() - SEASON_EPOCH) * 4 + q + 1;
  const start = new Date(d.getFullYear(), q * 3, 1), end = new Date(d.getFullYear(), q * 3 + 3, 1);
  return { id: `S${n}`, number: n, name: `SEASON ${n}: ${SEASON_NAMES[q]}`, start: dayKey(start), ends: dayKey(end), daysLeft: Math.max(0, Math.ceil((end - d) / 864e5)) };
}
// season XP from each counter (bounties and keystones add theirs as bonus XP)
const SEASON_WEIGHTS = { kills: 2, elites: 10, dungeons: 120, raids: 300, trials: 150, quests: 40, worldBosses: 150, crafted: 8, fish: 4, steps: 0.05 };
function seasonXpFrom(stats, base, bonus) {
  let xp = Math.max(0, Math.floor(Number(bonus) || 0));
  for (const [k, w] of Object.entries(SEASON_WEIGHTS)) xp += Math.max(0, (Number(stats && stats[k]) || 0) - (Number(base && base[k]) || 0)) * w;
  return Math.floor(xp);
}
const seasonTier = xp => Math.min(SEASON_TIERS, Math.floor(Math.max(0, xp) / SEASON_XP_PER_TIER));
// the free reward of a tier (1-50) for a hero level
function seasonReward(tier, lvl) {
  const L = Math.max(1, Math.min(720, Math.floor(Number(lvl) || 1))), t = Math.max(1, Math.min(SEASON_TIERS, Math.floor(tier)));
  if (t === 50) return { gold: 200 * (10 + L), gear: { rarity: 5, kind: 'wondrous', base: 'saints_token' }, title: 'season_champion', label: 'LEGENDARY TRINKET + TITLE' };
  if (t === 25) return { gold: 80 * (10 + L), items: { star_shard: 1 }, title: 'season_veteran', label: 'TITLE + STAR SHARD' };
  if (t % 10 === 0) return { gold: 40 * (10 + L), gear: { rarity: 4 }, label: 'EPIC ITEM' };
  if (t % 5 === 0) return { gold: 25 * (10 + L), items: { ember: 1, shard: 2 }, label: 'EMBER + SHARDS' };
  if (t % 2 === 0) return { gold: 15 * (10 + L), items: { scrap: 6 }, label: 'GOLD + SCRAP' };
  return { gold: 12 * (10 + L), items: { potion: 2 }, label: 'GOLD + POTIONS' };
}
const SEASON_TITLES = { season_veteran: { name: 'SEASON VETERAN', how: 'Reach season pass tier 25.' }, season_champion: { name: 'SEASON CHAMPION', how: 'Reach season pass tier 50.' } };

if (typeof globalThis !== 'undefined') globalThis.GBQLoop = {
  dayKey, weekKeyOf, prevDayKey, loopHash, seededRng, BOUNTY_TYPES, rollBounties, bountyProgress, bountyDone, bountyReward,
  LOGIN_REWARDS, loginStep, loginGold, vaultSlots, VAULT_STEPS, vaultItemLevel, vaultRarity,
  SEASON_TIERS, SEASON_XP_PER_TIER, seasonFor, SEASON_WEIGHTS, seasonXpFrom, seasonTier, seasonReward, SEASON_TITLES,
};

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof makeItem === 'function' && typeof G !== 'undefined') {
  const STAT_KEYS = ['kills', 'elites', 'dungeons', 'raids', 'trials', 'quests', 'worldBosses', 'crafted', 'fish', 'steps', 'keystones', 'bounties'];
  const snap = () => Object.fromEntries(STAT_KEYS.map(k => [k, Number(G.stats[k]) || 0]));
  const heroSeed = () => `${G.slot}|${G.name}|${G.created || 0}`;
  const levelSpan = c => Math.max(1, xpForLevel(Math.min(LEVEL_CAP, c.lvl + 1)) - xpForLevel(c.lvl));
  const giveItems = items => { for (const [k, n] of Object.entries(items || {})) if (ITEMS[k]) addItem(k, n); };
  const itemsText = items => Object.entries(items || {}).filter(([k]) => ITEMS[k]).map(([k, n]) => `${n} ${ITEMS[k].name}`).join(', ');

  // titles from the season pass join the title list
  if (typeof TITLES !== 'undefined') for (const [id, t] of Object.entries(SEASON_TITLES)) if (!TITLES.some(x => x.id === 't_' + id)) TITLES.push({ id: 't_' + id, name: t.name, how: t.how, ok: g => !!(g.titlesWon && g.titlesWon[id]) });

  // create or roll over the loop state; safe to call often
  function ensureLoop() {
    if (!G || !G.stats) return;
    for (const k of STAT_KEYS) G.stats[k] = Number(G.stats[k]) || 0;
    const now = new Date(), today = dayKey(now), week = weekKeyOf(now), L = G.loop = G.loop && typeof G.loop === 'object' ? G.loop : {};
    if (!L.daily || L.daily.day !== today) L.daily = { day: today, list: rollBounties(heroSeed() + today, 'day', G.lvl, G.stats) };
    if (!L.weekly || L.weekly.week !== week) {
      // close the old week: unlock its vault for this week
      if (L.weekly && L.week) {
        const runs = Math.max(0, G.stats.dungeons - (L.week.base || 0)), slots = vaultSlots(runs);
        if (slots) { const ilvl = vaultItemLevel(G.lvl, L.week.bestKey), rar = vaultRarity(L.week.bestKey || 0); L.vault = { week, from: L.weekly.week, ilvl, items: Array.from({ length: slots }, (_, i) => makeItem({ lvl: ilvl, rarity: rar, ...(i === 0 && typeof smartKind === 'function' ? smartKind(G) : {}) })), claimed: false }; }
      }
      L.weekly = { week, list: rollBounties(heroSeed() + week, 'week', G.lvl, G.stats) };
      L.week = { key: week, base: G.stats.dungeons, bestKey: 0 };
    }
    L.week ||= { key: week, base: G.stats.dungeons, bestKey: 0 };
    // season
    const s = seasonFor(now);
    if (!G.season || G.season.id !== s.id) G.season = { id: s.id, base: snap(), bonus: 0, claimed: [] };
    G.titlesWon ||= {};
    // login streak
    const step = loginStep(L.login, today, prevDayKey(now));
    if (step.reward) {
      L.login = { last: today, streak: step.streak };
      const gold = loginGold(step.reward, G.lvl); G.gold += gold; G.stats.goldEarned = (G.stats.goldEarned || 0) + gold; giveItems(step.reward.items); G.season.bonus += 50;
      toast(`LOGIN DAY ${step.streak}`, `${fmt(gold)} G + ${itemsText(step.reward.items)}`.slice(0, 26), 'item_coin', 'coin');
    }
  }
  const seasonXp = () => G.season ? seasonXpFrom(G.stats, G.season.base, G.season.bonus) : 0;
  function addSeasonXp(n) { ensureLoop(); G.season.bonus += Math.max(0, Math.floor(n) || 0); }
  function claimBounty(period, i) {
    ensureLoop(); const list = (period === 'week' ? G.loop.weekly : G.loop.daily).list, b = list[i];
    if (!b) return 'No such bounty.'; if (b.claimed) return 'Already claimed.'; if (!bountyDone(b, G.stats)) return 'Not finished yet.';
    const r = bountyReward(period, G.lvl); b.claimed = true; G.gold += r.gold; G.stats.goldEarned = (G.stats.goldEarned || 0) + r.gold; giveItems(r.mats);
    gainXP(G, Math.round(levelSpan(G) * r.xpShare)); G.stats.bounties++; addSeasonXp(r.seasonXp);
    return null;
  }
  function claimSeasonTier(t) {
    ensureLoop(); if (t > seasonTier(seasonXp())) return 'Tier not reached yet.'; if (G.season.claimed.includes(t)) return 'Already claimed.';
    const r = seasonReward(t, G.lvl); G.season.claimed.push(t); G.gold += r.gold; giveItems(r.items);
    if (r.gear) addGear(makeItem({ lvl: G.lvl, ...r.gear }));
    if (r.title) G.titlesWon[r.title] = true;
    return null;
  }
  Object.assign(window, { ensureLoop, claimBounty, claimSeasonTier, addSeasonXp, seasonXp });

  // poll twice a second while a hero is loaded (day/week rollover, login reward)
  { let n = 0; const t0 = tick; window.tick = tick = function () { const r = t0(); if (G && ++n % 30 === 0) { try { ensureLoop(); if (typeof keystonePoll === 'function') keystonePoll(); if (typeof polishPoll === 'function') polishPoll(); for (const h of window.LOOP_HOOKS || []) h(); } catch (e) { console.warn('loop poll', e); } } return r; }; }

  // ---------------------------------------------------------------- menus (MAIN MENU > CHALLENGES)
  function bountyLine(b) { const t = BOUNTY_BY_ID[b.id], p = bountyProgress(b, G.stats); return `${b.claimed ? '# ' : bountyDone(b, G.stats) ? '! ' : ''}${t.name} ${fmt(p)}/${fmt(b.target)}`.slice(0, 24); }
  function bountyBoard() {
    ensureLoop(); const L = G.loop, rows = [...L.daily.list.map((b, i) => ['day', i, b]), ...L.weekly.list.map((b, i) => ['week', i, b])];
    choose(rows.map(([p, , b]) => `${p === 'day' ? 'D' : 'W'} ${bountyLine(b)}`), k => {
      if (k < 0) return; const [p, i, b] = rows[k], r = bountyReward(p, G.lvl);
      if (b.claimed) { SFX.error(); return say('Already claimed. New bounties ' + (p === 'day' ? 'tomorrow.' : 'on Monday.'), bountyBoard); }
      if (!bountyDone(b, G.stats)) return say([`${BOUNTY_BY_ID[b.id].name}: ${fmt(bountyProgress(b, G.stats))} of ${fmt(b.target)}.`, `Reward: ${fmt(r.gold)} G, XP, ${itemsText(r.mats)}, ${r.seasonXp} season XP.`], bountyBoard);
      const why = claimBounty(p, i); SFX[why ? 'error' : 'confirm'](); saveGame();
      say(why || [`Bounty complete!`, `${fmt(r.gold)} G, XP, ${itemsText(r.mats)}`, `+${r.seasonXp} season XP.`], bountyBoard);
    }, 'D: DAILY  W: WEEKLY  !: CLAIM');
  }
  function weeklyVault() {
    ensureLoop(); const L = G.loop, runs = Math.max(0, G.stats.dungeons - L.week.base), slots = vaultSlots(runs), next = VAULT_STEPS.find(s => s > runs);
    const status = [`THIS WEEK: ${runs} DUNGEON CLEAR${runs === 1 ? '' : 'S'}`, `SLOTS UNLOCKED: ${slots}/3${next ? ` (NEXT AT ${next})` : ''}`, `BEST KEYSTONE: +${L.week.bestKey || 0}`, `ITEM LEVEL NEXT WEEK: ${vaultItemLevel(G.lvl, L.week.bestKey)}`];
    if (L.vault && !L.vault.claimed) {
      const its = L.vault.items;
      return choose(its.map(it => `${it.name.slice(0, 16)} IL${it.ilvl}`).concat(['LATER']), k => {
        if (k < 0 || k >= its.length) return;
        choose(['TAKE THIS ONE', 'BACK'], y => { if (y !== 0) return weeklyVault(); addGear(its[k]); L.vault.claimed = true; SFX.chest(); saveGame(); say([`You took ${its[k].name}.`, 'The vault refills next week.']); }, itemDesc(its[k]).slice(0, 60));
      }, `VAULT: CHOOSE 1 OF ${its.length}`);
    }
    say(['WEEKLY VAULT', ...status, 'Clear 1 / 4 / 8 dungeons for 1 / 2 / 3 choices. Open it next week.']);
  }
  function loginStreak() {
    ensureLoop(); const l = G.loop.login || { streak: 0 };
    say([`LOGIN STREAK: DAY ${l.streak}`, ...LOGIN_REWARDS.map(r => `${(l.streak - 1) % 7 + 1 === r.day ? '> ' : '  '}DAY ${r.day}: ${fmt(loginGold(r, G.lvl))} G, ${itemsText(r.items)}`), 'Come back tomorrow to keep the streak.']);
  }
  function seasonPass() {
    ensureLoop(); const s = seasonFor(), xp = seasonXp(), tier = seasonTier(xp), open = [];
    for (let t = 1; t <= tier; t++) if (!G.season.claimed.includes(t)) open.push(t);
    const rows = Array.from({ length: SEASON_TIERS }, (_, i) => i + 1);
    choose([open.length ? `CLAIM ALL (${open.length})` : 'NOTHING TO CLAIM', ...rows.map(t => `${G.season.claimed.includes(t) ? '#' : t <= tier ? '!' : ' '}T${t} ${seasonReward(t, G.lvl).label}`.slice(0, 24))], k => {
      if (k < 0) return;
      if (k === 0) { if (!open.length) return say(`${fmt(xp % SEASON_XP_PER_TIER)}/${SEASON_XP_PER_TIER} XP to tier ${Math.min(SEASON_TIERS, tier + 1)}.`, seasonPass); open.forEach(claimSeasonTier); SFX.levelup(); saveGame(); return say([`Claimed ${open.length} tier${open.length === 1 ? '' : 's'}.`, 'Gear is in your bag; titles are under TITLES.'], seasonPass); }
      const t = rows[k - 1], why = claimSeasonTier(t); SFX[why ? 'error' : 'confirm'](); if (!why) saveGame();
      say(why ? [`TIER ${t}: ${seasonReward(t, G.lvl).label}`, why] : `Claimed tier ${t}.`, seasonPass);
    }, `${s.name.slice(0, 22)} T${tier} ${fmt(xp)}XP ${s.daysLeft}D`);
  }
  window.challengesMenu = function () {
    ensureLoop();
    const ready = [...G.loop.daily.list, ...G.loop.weekly.list].filter(b => !b.claimed && bountyDone(b, G.stats)).length, vault = G.loop.vault && !G.loop.vault.claimed;
    const opts = [`BOUNTY BOARD${ready ? ` (${ready}!)` : ''}`, ...(typeof worldQuestsMenu === 'function' ? ['WORLD QUESTS'] : []), `WEEKLY VAULT${vault ? ' (!)' : ''}`, 'KEYSTONES', 'SEASON PASS', 'LOGIN STREAK', 'BACK'];
    choose(opts, k => { const o = opts[k] || ''; if (o.startsWith('BOUNTY')) bountyBoard(); else if (o.startsWith('WEEKLY')) weeklyVault(); else if (o === 'KEYSTONES') keystoneMenu(); else if (o === 'WORLD QUESTS') worldQuestsMenu(); else if (o === 'SEASON PASS') seasonPass(); else if (o === 'LOGIN STREAK') loginStreak(); }, 'CHALLENGES');
  };
}
