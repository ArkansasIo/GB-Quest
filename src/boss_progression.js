// Boss progression, first-clear rewards and collection journal data.
'use strict';
const BOSS_TOKEN_REWARDS = Object.freeze({ world: 1, dungeon: 2, trial: 2, tower: 2, arc: 4, raid: 6 });
const BOSS_RANK_BANDS = Object.freeze([
  ['F', 1], ['E', 41], ['D', 81], ['C', 121], ['B', 201], ['A', 301], ['S', 421], ['SS', 541], ['SSS', 641],
]);
function bossDifficultyRank(boss) {
  const level = Math.max(1, Number(boss && boss.lvl) || 1);
  let rank = 'F';
  for (const [name, min] of BOSS_RANK_BANDS) if (level >= min) rank = name;
  return rank;
}
function ensureBossProgress(state) {
  if (!state || typeof state !== 'object') throw new TypeError('A game state is required.');
  const p = state.bossProgress && typeof state.bossProgress === 'object' ? state.bossProgress : {};
  p.clears = p.clears && typeof p.clears === 'object' ? p.clears : {};
  p.named = p.named && typeof p.named === 'object' ? p.named : {};
  state.bossProgress = p;
  state.bossTokens = Math.max(0, Math.floor(Number(state.bossTokens) || 0));
  return p;
}
function recordBossProgress(state, boss, now = Date.now()) {
  if (!boss || typeof boss.id !== 'string' || !boss.id) return { ok: false, reason: 'unknown_boss' };
  const p = ensureBossProgress(state);
  const old = p.clears[boss.id] || { kills: 0, firstClear: 0, lastKill: 0 };
  const first = !old.firstClear;
  const next = { kills: Math.max(0, Number(old.kills) || 0) + 1, firstClear: first ? now : old.firstClear, lastKill: now };
  p.clears[boss.id] = next;
  state.bossKills ||= {};
  state.bossKills[boss.id] = now;
  if (!first) return { ok: true, firstClear: false, record: next, reward: null };
  const category = BOSS_TOKEN_REWARDS[boss.cat] == null ? 'world' : boss.cat;
  const tokens = BOSS_TOKEN_REWARDS[category];
  const gold = Math.max(100, Math.round(500 + Math.max(1, Number(boss.lvl) || 1) * 25));
  state.bossTokens += tokens;
  state.gold = Math.max(0, Number(state.gold) || 0) + gold;
  return { ok: true, firstClear: true, record: next, reward: { tokens, gold, rank: bossDifficultyRank(boss) } };
}
function recordBossNamedDiscovery(state, namedId) {
  if (!state || typeof namedId !== 'string' || !namedId) return false;
  const p = ensureBossProgress(state);
  p.named[namedId] = Math.max(0, Number(p.named[namedId]) || 0) + 1;
  return true;
}
function bossProgressSummary(state, bosses) {
  const p = ensureBossProgress(state), rows = (Array.isArray(bosses) ? bosses : []).map(b => {
    const v = p.clears[b.id] || {};
    return { id: b.id, name: b.name, category: b.cat, where: b.where, level: b.lvl, rank: bossDifficultyRank(b),
      kills: Math.max(0, Number(v.kills) || 0), firstClear: Number(v.firstClear) || 0, lastKill: Number(v.lastKill) || 0 };
  });
  const cleared = rows.filter(b => b.firstClear).length;
  return { total: rows.length, cleared, remaining: rows.length - cleared, percent: rows.length ? Math.floor(cleared * 100 / rows.length) : 0, rows };
}
const GBQBossProgression = Object.freeze({ tokenRewards: BOSS_TOKEN_REWARDS, rankBands: BOSS_RANK_BANDS, rank: bossDifficultyRank,
  ensure: ensureBossProgress, record: recordBossProgress, discoverNamed: recordBossNamedDiscovery, summary: bossProgressSummary });
globalThis.GBQBossProgression = GBQBossProgression;
