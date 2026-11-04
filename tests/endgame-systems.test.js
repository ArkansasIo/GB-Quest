import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = (file, key) => { const context = { Math, Number, String, Object, Array, Set, Date, globalThis: null }; context.globalThis = context; vm.runInNewContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context); return context[key]; };
const plain = v => JSON.parse(JSON.stringify(v));
const H = 3600 * 1000;

test('dungeon tokens refill one per 2 hours up to 10', () => {
  const T = load('tnl_extras.js', 'GBQTnlx');
  assert.deepEqual(plain(T.regenTokens({ n: 3, last: 0 }, H)), { n: 3, last: 0 });
  assert.deepEqual(plain(T.regenTokens({ n: 3, last: 0 }, 5 * H)), { n: 5, last: 4 * H }, 'the remainder carries over');
  assert.equal(T.regenTokens({ n: 9, last: 0 }, 100 * H).n, 10);
  assert.equal(T.nextTokenIn({ n: 3, last: 0 }, H), H);
  assert.equal(T.clearMarks(35, true), 13); assert.equal(T.clearMarks(35, false), 2);
});

test('contract board: six distinct offers, stable per day and hero', () => {
  const T = load('tnl_extras.js', 'GBQTnlx');
  const a = T.contractOffers('2026-11-03', 'HERO', 20), b = T.contractOffers('2026-11-03', 'HERO', 20);
  assert.equal(a.length, 6); assert.equal(new Set(a).size, 6); assert.deepEqual(plain(a), plain(b));
  assert.ok(!T.contractOffers('2026-11-03', 'HERO', 1).includes('delve2'), 'level-gated contracts stay off low boards');
  for (const id of a) assert.ok(T.contractDef(id));
  assert.equal(T.contractReward('delve', 10).coins, 12); assert.equal(T.contractReward('cull', 10).coins, 6);
});

test('gear traits: costs, values and totals', () => {
  const T = load('tnl_extras.js', 'GBQTnlx');
  assert.equal(T.unlockCost([]), 1); assert.equal(T.unlockCost([{}, {}]), 3); assert.equal(T.upgradeCost(4), 5);
  assert.equal(T.traitValue('bossdmg', 3), 12); assert.equal(T.traitValue('leech', 5), 3);
  const items = [{ traits: [{ id: 'crit', r: 2 }, { id: 'bossdmg', r: 1 }] }, { traits: [{ id: 'crit', r: 1 }] }, null];
  assert.deepEqual(plain(T.traitTotals(items)), { crit: 4.5, bossdmg: 4 });
  const t = T.rollTrait([{ id: 'crit' }], () => 0); assert.notEqual(t.id, 'crit'); assert.equal(t.r, 1);
  assert.equal(T.rollTrait(T.TRAIT_IDS.map(id => ({ id })), () => 0), null);
});

test('codex pages and bonuses', () => {
  const T = load('tnl_extras.js', 'GBQTnlx');
  const cx = { fam: { beast: 30, undead: 29, giant: 99 }, dg: { dg_a: 1, dg_b: 1, dg_c: 1 } };
  const p = T.codexPages(cx); assert.deepEqual(plain(p.fams), ['beast', 'giant']); assert.equal(p.total, 5);
  assert.deepEqual(plain(T.codexBonus(cx)), { crit: 1, hp: 55, mf: 6, dmg: 2, heal: 2 });
  assert.deepEqual(plain(T.codexBonus({})), {});
});

test('field events open 12 of every 30 minutes in a zone near the hero', () => {
  const T = load('tnl_extras.js', 'GBQTnlx');
  const e = T.eventSlot(T.EVENT_EVERY * 10 + 60000); assert.equal(e.slot, 10); assert.ok(e.open); assert.equal(e.left, T.EVENT_OPEN - 60000);
  assert.ok(!T.eventSlot(T.EVENT_EVERY * 10 + T.EVENT_OPEN + 1).open);
  const zones = [{ id: 'town', lvl: [1, 99], town: true }, { id: 'low', lvl: [1, 5] }, { id: 'mid', lvl: [18, 24] }, { id: 'high', lvl: [60, 70] }];
  assert.equal(T.eventZone(3, zones, 30), 'mid');
  assert.ok(['low', 'mid'].includes(T.eventZone(3, zones, 20)), 'the window reaches 15 levels below and 5 above');
  assert.ok(['low', 'mid', 'high'].includes(T.eventZone(3, zones, 500)), 'falls back to the nearest zones');
});

test('dread sigils: scaling, banes by tier, rewards', () => {
  const Dr = load('dread.js', 'GBQDread');
  assert.equal(Dr.sigilScale(1), 1); assert.equal(Dr.sigilScale(11), Math.round(Math.pow(1.07, 10) * 1000) / 1000);
  assert.deepEqual([1, 14, 15, 40].map(Dr.baneCount), [1, 1, 2, 3]);
  const sg = Dr.rollSigil(40, ['dg_a', 'dg_b'], () => 0.3);
  assert.equal(sg.neg.length, 3); assert.equal(new Set(sg.neg).size, 3); assert.ok(Dr.BOON_IDS.includes(sg.pos)); assert.ok(['dg_a', 'dg_b'].includes(sg.dungeon));
  assert.ok(Dr.sigilFoeMult({ tier: 1, neg: ['hardened'] }).hp > Dr.sigilFoeMult({ tier: 1, neg: [] }).hp);
  const rw = Dr.sigilRewards({ tier: 20, pos: 'bountiful', neg: [] }, 30, () => 0.99);
  assert.equal(rw.items, 3); assert.equal(rw.ilvl, 90); assert.equal(rw.rarity, 4); assert.equal(rw.next, 23);
});

test('the pit: timer, unlocks and shards', () => {
  const Dr = load('dread.js', 'GBQDread');
  assert.equal(Dr.pitLimit(4), 330);
  assert.deepEqual(plain(Dr.pitResult(10, 100, 330)), { timed: true, unlock: 13 });
  assert.deepEqual(plain(Dr.pitResult(10, 250, 330)), { timed: true, unlock: 12 });
  assert.deepEqual(plain(Dr.pitResult(10, 400, 330)), { timed: false, unlock: 10 });
  assert.equal(Dr.pitResult(150, 1, 330).unlock, 150);
  assert.equal(Dr.pitShards(20, true), 7); assert.equal(Dr.pitShards(20, false), 1);
});

test('shard exchange rate and the endless horde', () => {
  const Dr = load('dread.js', 'GBQDread');
  assert.equal(Dr.SCRAP_PER_SHARD, 4);
  assert.equal(Dr.hordeScale(1), 1); assert.equal(Dr.hordeScale(10), 2.08);
  assert.equal(Dr.hordeAether(3), 25);
  const offer = Dr.hordeOffer(['might', 'fortify'], () => 0); assert.equal(offer.length, 3); assert.ok(!offer.includes('might'));
  assert.deepEqual(plain(Dr.hordeChest(250, 20)), { items: 4, gold: 1000, rarity: 4 });
});
