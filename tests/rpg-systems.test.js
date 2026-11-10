import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = (file, name) => { const c = { Math, Number, String, Object, Array, Set, Date, globalThis: null }; c.globalThis = c; vm.runInNewContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), c); return c[name]; };
const plain = v => JSON.parse(JSON.stringify(v));
const L = load('mmo_loop.js', 'GBQLoop'), K = load('keystones.js', 'GBQKeystones'), P = load('polish.js', 'GBQPolish');
const HD = load('hd_character_art.js', 'GBQHDCharacterArt');

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
  assert.equal(K.seasonalAffixForWeek('2026-01-05'), 'cinderbound');
  assert.equal(K.seasonalAffixForWeek('2026-04-06'), 'permafrost');
  assert.equal(K.seasonalAffixForWeek('2026-07-06'), 'overgrown');
  assert.equal(K.seasonalAffixForWeek('2026-10-05'), 'eclipsed');
  for (const [week, id] of [['2026-01-05','cinderbound'],['2026-04-06','permafrost'],['2026-07-06','overgrown'],['2026-10-05','eclipsed']]) {
    assert.ok(K.weeklyAffixes(week, 10).includes(id));
    assert.ok(K.KEY_AFFIXES[id]);
  }
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

test('paper doll visual markers are derived from equipped slots only', () => {
  const eq = {
    head: { kind: 'armor', base: 'iron_helm' },
    weapon: { kind: 'weapon', base: 'longsword' },
    ring1: { kind: 'wondrous', base: 'silver_ring' },
    offhand: { kind: 'armor', base: 'shield' }
  };
  const visuals = P.paperDollVisuals(eq);
  assert.deepEqual(plain(visuals.map(x => x.slot)), ['head', 'weapon', 'offhand']);
  assert.ok(visuals.every(x => Number.isInteger(x.anchor.x) && Number.isInteger(x.anchor.y)));
  assert.deepEqual(plain(P.paperDollVisuals({})), []);
});

test('world avatar gear markers only include the supported visible slots', () => {
  const eq = {
    head: { kind: 'armor', base: 'iron_helm' },
    weapon: { kind: 'weapon', base: 'longsword' },
    armor: { kind: 'armor', base: 'iron_chest' },
    offhand: { kind: 'armor', base: 'shield' },
    ring1: { kind: 'wondrous', base: 'silver_ring' }
  };
  const visuals = P.worldGearVisuals(eq);
  assert.deepEqual(plain(visuals.map(x => x.slot)), ['head', 'weapon', 'armor', 'offhand']);
  assert.ok(visuals.every(x => x.size > 0 && x.x >= 0 && x.y >= 0));
  assert.deepEqual(plain(P.worldGearVisuals({})), []);
});

test('animated walker gear layers resolve compact visible equipment slots', () => {
  const eq = {
    head: { kind: 'armor', base: 'iron_helm' },
    weapon: { kind: 'weapon', base: 'longsword' },
    armor: { kind: 'armor', base: 'iron_chest' },
    offhand: { kind: 'armor', base: 'shield' },
    ring1: { kind: 'wondrous', base: 'silver_ring' }
  };
  const visuals = P.walkerGearVisuals(eq);
  assert.deepEqual(plain(visuals.map(x => x.slot)), ['head', 'weapon', 'armor', 'offhand']);
  assert.ok(visuals.every(x => x.size === 4 && x.x >= 0 && x.y >= 0 && x.x + x.size <= 16 && x.y + x.size <= 16));
  assert.deepEqual(plain(P.walkerGearVisuals({})), []);
});

test('HD character frame paths validate all runtime dimensions', () => {
  assert.equal(HD.framePath('assets_hd64/animations/frames', 'warrior', 'SSS', 'SE', 'attack', 5),
    'assets_hd64/animations/frames/warrior/SSS/SE/attack/frame_005.png');
  assert.equal(HD.framePath('frames', '../mage', 'F', 'S', 'idle', 0), null);
  assert.equal(HD.framePath('frames', 'mage', 'F', 'S', 'teleport', 0), null);
  assert.equal(HD.framePath('frames', 'mage', 'F', 'S', 'idle', -1), null);
  assert.equal(HD.framePath('frames', 'mage', 'F', 'S', 'idle', 1.5), null);
});

test('HD runtime maps existing equipped catalog IDs to visual overlay slots', () => {
  const visualMap = { records: [
    { catalogId: 'weapon:longsword', slot: 'main_hand', visualItemId: 'iron_sword' },
    { catalogId: 'armor:plate-armor', slot: 'chest', visualItemId: 'iron_plate' },
    { catalogId: 'armor:shield', slot: 'off_hand', visualItemId: 'iron_shield' }
  ] };
  const resolved = HD.resolveEquipment({ cls: 'fighter', eq: {
    weapon: { kind: 'weapon', base: 'longsword', itemLevel: 120 },
    armor: { kind: 'armor', base: 'plate-armor' },
    offhand: { kind: 'armor', base: 'shield' },
    ring1: { kind: 'wondrous', base: 'silver_ring' }
  } }, visualMap, 'SS');
  assert.equal(resolved.archetype, 'warrior');
  assert.equal(resolved.rank, 'SS');
  assert.deepEqual(plain(resolved.equipment), {
    main_hand: 'iron_sword', chest: 'iron_plate', off_hand: 'iron_shield'
  });
});

test('HD runtime uses unlocked appearance base without changing equipped item data', () => {
  const visualMap = { records: [
    { catalogId: 'weapon:longsword', slot: 'main_hand', visualItemId: 'iron_sword' },
    { catalogId: 'weapon:dagger', slot: 'main_hand', visualItemId: 'paired_daggers' }
  ] };
  const equipped = { kind: 'weapon', base: 'longsword', tmog: { kind: 'weapon', base: 'dagger' }, itemLevel: 720 };
  const resolved = HD.resolveEquipment({ cls: 'wizard', eq: { weapon: equipped } }, visualMap, 'SSS');
  assert.equal(resolved.archetype, 'mage');
  assert.deepEqual(plain(resolved.equipment), { main_hand: 'paired_daggers' });
  assert.equal(equipped.base, 'longsword');
  assert.equal(equipped.itemLevel, 720);
});

test('HD animation state resolver maps combat and movement states', () => {
  assert.equal(HD.animationForState('moving'), 'walk');
  assert.equal(HD.animationForState('sprinting'), 'run');
  assert.equal(HD.animationForState('casting'), 'cast');
  assert.equal(HD.animationForState('blocking'), 'block');
  assert.equal(HD.animationForState('hurt'), 'hit');
  assert.equal(HD.animationForState('dying'), 'death');
  assert.equal(HD.animationForState('unknown'), 'idle');
});

test('HD runtime normalizes world directions into eight-way sprite directions', () => {
  assert.equal(HD.directionForInput('down'), 'S');
  assert.equal(HD.directionForInput('up'), 'N');
  assert.equal(HD.directionForInput('left'), 'W');
  assert.equal(HD.directionForInput('right'), 'E');
  assert.equal(HD.directionForInput('northwest'), 'NW');
  assert.equal(HD.directionForInput('unknown'), 'S');
});

test('HD runtime supplies visual families for unmapped legacy equipment IDs', () => {
  const resolved = HD.resolveEquipment({ cls: 'warlock', eq: {
    weapon: { kind: 'weapon', base: 'emberwand' },
    armor: { kind: 'armor', base: 'travelrobe' },
    offhand: { kind: 'armor', base: 'tower-shield' }
  } }, { records: [] }, 'A');
  assert.equal(resolved.archetype, 'summoner');
  assert.deepEqual(plain(resolved.equipment), {
    main_hand: 'oak_staff', chest: 'arcane_robe', off_hand: 'iron_shield'
  });
});

test('HD frame presenter returns cached canvases without blocking the draw caller', async () => {
  let resolveFrame;
  let calls = 0;
  const presenter = HD.createFramePresenter({ renderCharacter: () => {
    calls++;
    return new Promise(resolve => { resolveFrame = resolve; });
  }});
  const character = { id: 'hero-1', cls: 'fighter', eq: {} };
  const spec = { state: 'moving', direction: 'down', frame: 0 };
  assert.equal(presenter.request(character, spec), null);
  assert.equal(presenter.request(character, spec), null);
  assert.equal(calls, 1, 'same frame should only start one async composition');
  const canvas = { width: 64, height: 64 };
  resolveFrame(canvas);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(presenter.request(character, spec), canvas);
  assert.equal(presenter.getReady(), canvas);
});

test('HD frame presenter discards stale results after a newer frame is requested', async () => {
  const pending = [];
  const presenter = HD.createFramePresenter({ renderCharacter: () => new Promise(resolve => pending.push(resolve)) });
  const character = { id: 'hero-2', cls: 'mage', eq: {} };
  presenter.request(character, { state: 'idle', direction: 'down', frame: 0 });
  presenter.request(character, { state: 'moving', direction: 'right', frame: 1 });
  const oldCanvas = { id: 'old' }, newCanvas = { id: 'new' };
  pending[0](oldCanvas);
  pending[1](newCanvas);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(presenter.getReady(), newCanvas);
});

test('HD frame presenter suppresses repeated failed asset requests until cleared', async () => {
  let calls = 0;
  const presenter = HD.createFramePresenter({ renderCharacter: () => {
    calls++;
    return Promise.reject(new Error('missing generated assets'));
  }});
  const character = { id: 'hero-3', cls: 'fighter', eq: {} };
  const spec = { state: 'idle', direction: 'down', frame: 0 };
  assert.equal(presenter.request(character, spec), null);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(presenter.request(character, spec), null);
  assert.equal(calls, 1);
  presenter.clear();
  assert.equal(presenter.request(character, spec), null);
  assert.equal(calls, 2);
});

test('HD frame presenter retains recent animation frames for instant reuse', async () => {
  const calls = [];
  const presenter = HD.createFramePresenter({ renderCharacter: (_character, spec) => {
    calls.push(spec.frame);
    return Promise.resolve({ frame: spec.frame });
  }}, { maxEntries: 3 });
  const character = { id: 'hero-cache', cls: 'ranger', eq: {} };
  const frame = n => ({ state: 'moving', direction: 'down', frame: n });
  assert.equal(presenter.request(character, frame(0)), null);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(presenter.request(character, frame(0)), { frame: 0 });
  assert.equal(presenter.request(character, frame(1)), null);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(presenter.request(character, frame(1)), { frame: 1 });
  assert.deepEqual(presenter.request(character, frame(0)), { frame: 0 }, 'previously prepared frame is immediately reusable');
  assert.deepEqual(calls, [0, 1]);
  assert.equal(presenter.cacheSize(), 2);
});

test('battle renderer connects combat events to HD character animation clips', () => {
  const source = fs.readFileSync(new URL('../src/combat.js', import.meta.url), 'utf8');
  assert.match(source, /function battleHDFrame\(/);
  assert.match(source, /state: 'attack', until: frameN \+ 12/);
  assert.match(source, /state: 'cast', until: frameN \+ 20/);
  assert.match(source, /state: 'hit', until: frameN \+ 16/);
  assert.match(source, /battleHDFrame\(c, 'death'/);
  assert.match(source, /battleHDFrame\(c, pose/);
  assert.match(source, /else blit\(s, px - s\.width \/ 2 \+ lx/);
});
