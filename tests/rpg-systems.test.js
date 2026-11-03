import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = (file, name) => { const c = { Math, Number, String, Object, Array, Set, Date, globalThis: null }; c.globalThis = c; vm.runInNewContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), c); return c[name]; };
const plain = v => JSON.parse(JSON.stringify(v));
const L = load('mmo_loop.js', 'GBQLoop'), K = load('keystones.js', 'GBQKeystones'), P = load('polish.js', 'GBQPolish');

// ---------------------------------------------------------------- calendar and bounties
test('day and week keys use local dates; weeks start on Monday', () => {
  assert.equal(L.dayKey(new Date(2026, 10, 2)), '2026-11-02');
  assert.equal(L.weekKeyOf(new Date(2026, 10, 2)), '2026-11-02', 'a Monday is its own week');
  assert.equal(L.weekKeyOf(new Date(2026, 10, 8)), '2026-11-02', 'Sunday belongs to the week before');
  assert.equal(L.weekKeyOf(new Date(2026, 10, 9)), '2026-11-09');
  assert.equal(L.prevDayKey(new Date(2026, 2, 1)), '2026-02-28');
});

test('bounties: three distinct, stable per seed, gated by level, measured from a baseline', () => {
  const stats = { kills: 100, quests: 7 };
  const a = L.rollBounties('hero|2026-11-02', 'day', 1, stats), b = L.rollBounties('hero|2026-11-02', 'day', 1, stats);
  assert.equal(a.length, 3); assert.equal(new Set(a.map(x => x.id)).size, 3); assert.deepEqual(plain(a), plain(b));
  assert.ok(a.every(x => !['bosses', 'keys'].includes(x.id)), 'level 1 never rolls boss or keystone bounties');
  for (let i = 0; i < 40; i++) assert.ok(L.rollBounties('s' + i, 'day', 50, {}).every(x => x.id !== 'keys'), 'keystone bounties are weekly only');
  const kill = { id: 'kills', stat: 'kills', target: 20, base: 100 };
  assert.equal(L.bountyProgress(kill, { kills: 112 }), 12); assert.equal(L.bountyDone(kill, { kills: 112 }), false);
  assert.equal(L.bountyProgress(kill, { kills: 500 }), 20); assert.equal(L.bountyDone(kill, { kills: 120 }), true);
  assert.equal(L.bountyProgress(kill, { kills: 50 }), 0);
  assert.deepEqual(plain(L.bountyReward('day', 1)), { gold: 55, xpShare: 0.12, mats: { scrap: 4 }, seasonXp: 150 });
  assert.equal(L.bountyReward('week', 1).gold, 330);
});

test('login streak grows on consecutive days, restarts after a gap and cycles every 7 days', () => {
  assert.equal(L.loginStep(null, '2026-11-02', '2026-11-01').streak, 1);
  assert.equal(L.loginStep({ last: '2026-11-01', streak: 4 }, '2026-11-02', '2026-11-01').streak, 5);
  assert.equal(L.loginStep({ last: '2026-10-30', streak: 4 }, '2026-11-02', '2026-11-01').streak, 1);
  const same = L.loginStep({ last: '2026-11-02', streak: 3 }, '2026-11-02', '2026-11-01');
  assert.equal(same.reward, null); assert.equal(same.streak, 3);
  assert.equal(L.loginStep({ last: '2026-11-01', streak: 7 }, '2026-11-02', '2026-11-01').reward.day, 1);
  assert.equal(L.loginStep({ last: '2026-11-01', streak: 6 }, '2026-11-02', '2026-11-01').reward.day, 7);
  assert.equal(L.loginGold(L.LOGIN_REWARDS[0], 1), 31);
});

test('weekly vault: 1/4/8 clears unlock 1/2/3 choices; keys raise item level and rarity', () => {
  assert.deepEqual([0, 1, 3, 4, 7, 8, 20].map(L.vaultSlots), [0, 1, 1, 2, 2, 3, 3]);
  assert.equal(L.vaultItemLevel(30, 0), 30); assert.equal(L.vaultItemLevel(30, 10), 50); assert.equal(L.vaultItemLevel(719, 10), 720);
  assert.deepEqual([0, 4, 5, 9, 10].map(L.vaultRarity), [3, 3, 4, 4, 5]);
});

test('seasons are calendar quarters with 50 tiers of 1,000 XP', () => {
  const s = L.seasonFor(new Date(2026, 10, 2));
  assert.equal(s.id, 'S4'); assert.equal(s.name, 'SEASON 4: SUNCROWN'); assert.equal(s.start, '2026-10-01'); assert.equal(s.ends, '2027-01-01'); assert.equal(s.daysLeft, 60);
  assert.equal(L.seasonFor(new Date(2027, 0, 1)).id, 'S5');
  assert.equal(L.seasonXpFrom({ kills: 110, dungeons: 3, steps: 1000 }, { kills: 100, dungeons: 1, steps: 0 }, 150), 150 + 20 + 240 + 50);
  assert.equal(L.seasonXpFrom({ kills: 5 }, { kills: 10 }, 0), 0, 'never negative');
  assert.deepEqual([0, 999, 1000, 24999, 50000, 99999].map(L.seasonTier), [0, 0, 1, 24, 50, 50]);
  assert.match(L.seasonReward(50, 10).label, /TRINKET/); assert.equal(L.seasonReward(50, 10).title, 'season_champion');
  assert.equal(L.seasonReward(25, 10).title, 'season_veteran');
  assert.deepEqual(plain(L.seasonReward(20, 10).gear), { rarity: 4 });
  for (let t = 1; t <= 50; t++) assert.ok(L.seasonReward(t, 1).gold > 0, 'tier ' + t);
});

// ---------------------------------------------------------------- keystones
test('keystone affixes: fortified/tyrannical alternate weekly from +2, rotating affixes at +4 and +7', () => {
  assert.equal(K.weekIndex('2026-01-05'), 0); assert.equal(K.weekIndex('2026-11-02'), 43);
  assert.deepEqual(plain(K.weeklyAffixes('2026-01-05', 2)), ['fortified']);
  assert.deepEqual(plain(K.weeklyAffixes('2026-01-12', 2)), ['tyrannical']);
  const seven = K.weeklyAffixes('2026-11-02', 7);
  assert.equal(seven.length, 3); assert.equal(new Set(seven).size, 3);
  assert.equal(K.weeklyAffixes('2026-11-02', 4).length, 2);
  for (const id of seven) assert.ok(K.KEY_AFFIXES[id]);
});

test('keystone scaling: +8% a level, affixes apply to trash or bosses', () => {
  assert.equal(K.keyScale(1), 1); assert.equal(K.keyScale(2), 1.08); assert.equal(K.keyScale(10), 1.999);
  assert.deepEqual(plain(K.foeMultipliers(2, ['fortified'], false)), { hp: 1.296, dmg: 1.188 });
  assert.deepEqual(plain(K.foeMultipliers(2, ['fortified'], true)), { hp: 1.08, dmg: 1.08 });
  assert.deepEqual(plain(K.foeMultipliers(2, ['tyrannical', 'bolstered'], true)), { hp: 1.544, dmg: 1.242 });
  assert.deepEqual(plain(K.startEffects(['raging', 'fortified', 'swift'])), [{ buff: 'might', rounds: 3 }, { buff: 'haste', rounds: 1 }]);
});

test('keystone results: timed runs upgrade +1/+2/+3, late or failed runs drop a level (never below +2)', () => {
  assert.equal(K.timeLimit(6), 570);
  assert.deepEqual(plain(K.runResult(5, 300, 570)), { timed: true, change: 3, level: 8 });
  assert.deepEqual(plain(K.runResult(5, 450, 570)), { timed: true, change: 2, level: 7 });
  assert.deepEqual(plain(K.runResult(5, 570, 570)), { timed: true, change: 1, level: 6 });
  assert.deepEqual(plain(K.runResult(5, 571, 570)), { timed: false, change: -1, level: 4 });
  assert.equal(K.runResult(2, 999, 570).level, 2); assert.equal(K.runResult(30, 1, 570).level, 30);
  assert.deepEqual(plain(K.failResult(2)), { timed: false, change: -1, level: 2, failed: true });
  assert.deepEqual(plain(K.keyLoot(2, 10, true)), { count: 1, ilvl: 14, rarity: 3 });
  assert.deepEqual(plain(K.keyLoot(12, 30, true)), { count: 3, ilvl: 54, rarity: 5 });
  assert.equal(K.keyLoot(12, 30, false).count, 1);
  assert.equal(K.fmtClock(570), '9:30'); assert.equal(K.fmtClock(-5), '0:00');
});

test('keystone dungeons stay near the hero level and change after each run', () => {
  const ds = [{ id: 'a', lvl: 5 }, { id: 'b', lvl: 8 }, { id: 'c', lvl: 30 }];
  for (let i = 0; i < 20; i++) { const d = K.pickKeyDungeon(ds, 5, () => i / 20, 'a'); assert.equal(d.id, 'b'); }
  assert.equal(K.pickKeyDungeon(ds, 1, () => 0.5).id, 'a', 'too low for all: the easiest one');
});

// ---------------------------------------------------------------- polish
test('rested XP: 5% of a level per 8 hours, capped at 1.5 levels, doubles XP until spent', () => {
  assert.equal(P.restedGain(8, 1000), 50); assert.equal(P.restedGain(-3, 1000), 0);
  assert.equal(P.addRested(1400, 500, 1000), 1500, 'capped');
  assert.deepEqual(plain(P.spendRested(100, 250)), { total: 200, bonus: 100, pool: 150 });
  assert.deepEqual(plain(P.spendRested(100, 30)), { total: 130, bonus: 30, pool: 0 });
  assert.deepEqual(plain(P.spendRested(100, 0)), { total: 100, bonus: 0, pool: 0 });
});

test('gear score adds item level, rarity and +bonus over equipped items', () => {
  assert.equal(P.gearItemScore({ ilvl: 100, rarity: 0, plus: 0 }), 100);
  assert.equal(P.gearItemScore({ ilvl: 100, rarity: 5, plus: 3 }), 172);
  assert.equal(P.gearScore({ weapon: { ilvl: 100, rarity: 5, plus: 3 }, head: { ilvl: 50, rarity: 2, plus: -1 }, ring1: null }), 172 + 62);
  assert.equal(P.gearScore(null), 0);
});

test('transmog looks fit only the same kind and slot; cost scales with level', () => {
  assert.equal(P.appearanceKey({ kind: 'weapon', base: 'katana' }), 'weapon:katana'); assert.equal(P.appearanceKey({}), null);
  assert.equal(P.lookFits('head', 'head', 'wondrous', 'wondrous'), true);
  assert.equal(P.lookFits('head', 'feet', 'wondrous', 'wondrous'), false);
  assert.equal(P.lookFits('weapon', 'weapon', 'weapon', 'armor'), false);
  assert.equal(P.transmogCost(40), 200);
});

test('wardrobe collection includes every held source and does not duplicate appearances', () => {
  const wardrobe = { 'weapon:shortsword': 1 };
  const sources = [
    [{ kind: 'weapon', base: 'shortsword' }, { kind: 'armor', base: 'leather' }],
    [{ kind: 'wondrous', base: 'ring_of_warding' }],
    [{ kind: 'weapon', base: 'longbow' }]
  ];
  const result = P.collectAppearances(wardrobe, sources);
  assert.equal(result.added, 3);
  assert.deepEqual(plain(result.wardrobe), {
    'weapon:shortsword': 1, 'armor:leather': 1,
    'wondrous:ring_of_warding': 1, 'weapon:longbow': 1
  });
  assert.equal(P.collectAppearances(result.wardrobe, sources).added, 0);
});

test('transmog appearance must be unlocked, same-kind, same-slot and distinct from the base item', () => {
  const item = { kind: 'weapon', base: 'iron_sword' };
  const wardrobe = { 'weapon:steel_sword': 1, 'armor:steel_helm': 1 };
  const slotOf = x => x.kind === 'weapon' ? 'weapon' : x.base.includes('helm') ? 'head' : 'chest';
  assert.equal(P.validAppearance(item, { kind: 'weapon', base: 'steel_sword' }, wardrobe, slotOf), true);
  assert.equal(P.validAppearance(item, { kind: 'weapon', base: 'unknown_sword' }, wardrobe, slotOf), false);
  assert.equal(P.validAppearance(item, { kind: 'armor', base: 'steel_helm' }, wardrobe, slotOf), false);
  assert.equal(P.validAppearance({ kind: 'armor', base: 'iron_chest' }, { kind: 'armor', base: 'steel_helm' }, wardrobe, slotOf), false, 'same kind but different slot is rejected');
  assert.equal(P.validAppearance(item, { kind: 'weapon', base: 'iron_sword' }, wardrobe, slotOf), false);
});
