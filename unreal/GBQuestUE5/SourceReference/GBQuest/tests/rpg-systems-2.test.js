import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = (file, name) => { const c = { Math, Number, String, Object, Array, Set, Date, JSON, Infinity, globalThis: null }; c.globalThis = c; vm.runInNewContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), c); return c[name]; };
const plain = v => JSON.parse(JSON.stringify(v));
const D = load('durability.js', 'GBQDurability'), Gd = load('guild_prog.js', 'GBQGuild'), Wq = load('world_quests.js', 'GBQWorld'), Lo = load('loadouts.js', 'GBQLoadouts');

test('durability: maxima by kind and rarity, broken at 0, death costs 10%', () => {
  assert.equal(D.maxDurability({ kind: 'weapon', rarity: 0 }), 60); assert.equal(D.maxDurability({ kind: 'armor', rarity: 5 }), 110);
  assert.equal(D.maxDurability({ kind: 'wondrous', rarity: 2 }), 56); assert.equal(D.maxDurability({ kind: 'potion' }), 0);
  assert.equal(D.maxDurability({ kind: 'weapon', rarity: 0, durMult: 1.35 }), 81);
  assert.equal(D.isBroken({ maxDur: 60, dur: 0 }), true); assert.equal(D.isBroken({ maxDur: 60, dur: 1 }), false); assert.equal(D.isBroken({ kind: 'weapon' }), false, 'untracked gear is never broken');
  assert.equal(D.lossOnDeath({ maxDur: 85 }), 9);
});

test('repair cost grows with damage, item level and rarity', () => {
  assert.equal(D.repairCostOf({ maxDur: 60, dur: 60, ilvl: 10 }), 0);
  assert.equal(D.repairCostOf({ maxDur: 60, dur: 0, ilvl: 1, rarity: 0 }), 15);
  assert.equal(D.repairCostOf({ maxDur: 60, dur: 0, ilvl: 100, rarity: 4 }), 495);
  assert.ok(D.repairCostOf({ maxDur: 60, dur: 30, ilvl: 50, rarity: 2 }) < D.repairCostOf({ maxDur: 60, dur: 0, ilvl: 50, rarity: 2 }));
});

test('crafting quality: odds rise with skill; quality scales stats within caps', () => {
  assert.deepEqual(plain(D.qualityOdds(0)), { masterwork: 0.02, superior: 0.08, fine: 0.25 });
  const top = D.qualityOdds(720); assert.ok(Math.abs(top.masterwork - 0.15) < 1e-9 && Math.abs(top.superior - 0.3) < 1e-9 && Math.abs(top.fine - 0.4) < 1e-9);
  assert.equal(D.rollQuality(0, 0.01).id, 'masterwork'); assert.equal(D.rollQuality(0, 0.05).id, 'superior'); assert.equal(D.rollQuality(0, 0.2).id, 'fine'); assert.equal(D.rollQuality(0, 0.9).id, 'standard');
  assert.equal(D.rollQuality(720, 0.4).id, 'superior', 'skilled crafters roll better'); assert.equal(D.rollQuality(0, 0.4).id, 'standard');
  assert.deepEqual(plain(D.qualityAffixes([['hp', 100], ['crit', 48]], D.QUALITY[3], { hp: 99999, crit: 50 })), [['hp', 135], ['crit', 50]]);
});

test('guild levels, perks, bank tabs and repair discounts', () => {
  assert.deepEqual([1, 2, 3, 10, 25].map(Gd.guildXpFor), [0, 1000, 3031, 33635, 161562]);
  assert.equal(Gd.guildLevelOf(0), 1); assert.equal(Gd.guildLevelOf(999), 1); assert.equal(Gd.guildLevelOf(1000), 2); assert.equal(Gd.guildLevelOf(1e9), 25);
  assert.deepEqual(plain(Gd.perkStats(3)), [['xp', 5], ['gf', 5]]);
  assert.deepEqual([1, 4, 8, 20].map(Gd.repairDiscount), [0, 0.1, 0.25, 0.5]);
  assert.deepEqual([1, 5, 10].map(Gd.bankTabs), [1, 2, 3]);
  assert.equal(Gd.guildXpFrom({ kills: 110, dungeons: 3 }, { kills: 100, dungeons: 1 }), 20 + 300);
  assert.equal(Gd.memberDays('2026-11-01', '2026-11-03'), 2); assert.equal(Gd.memberDays('2026-10-01', '2026-11-03'), 7); assert.equal(Gd.memberDays(null, '2026-11-03'), 0);
});

test('guild XP levels up and logs perks; the bank refuses soulbound items and locked tabs', () => {
  const r = Gd.addGuildXp(null, 3100, 'note');
  assert.equal(r.guild.level, 3); assert.equal(r.leveled, true); assert.deepEqual(plain(r.unlocked.map(p => p.id)), ['fast_track', 'cash_flow']);
  assert.ok(r.guild.log.includes('PERK: FAST TRACK'));
  let g = Gd.normalizeGuild(null, 'Lanterns');
  assert.equal(Gd.depositItem(g, 1, { name: 'x' }).ok, false, 'tab 2 locked at level 1');
  assert.equal(Gd.depositItem(g, 0, { name: 'h', heirloom: 'hl_helm', bound: true }).ok, false);
  const d = Gd.depositItem(g, 0, { name: 'Sword' }); assert.equal(d.ok, true); g = d.guild;
  const w = Gd.withdrawItem(g, 0, 0); assert.equal(w.item.name, 'Sword'); assert.equal(w.guild.bank[0].length, 0);
  assert.equal(Gd.withdrawItem(w.guild, 0, 0).ok, false);
});

test('world quests: four per day near the hero, stable, progress by zone and type', () => {
  const zones = [{ id: 'a', lvl: [1, 5] }, { id: 'b', lvl: [3, 8] }, { id: 'c', lvl: [6, 12] }, { id: 'd', lvl: [10, 15] }, { id: 'e', lvl: [40, 50] }, { id: 'town', lvl: [1, 60], town: true }];
  const q = Wq.rollWorldQuests('2026-11-02', zones, 6);
  assert.equal(q.length, 4); assert.deepEqual(plain(q), plain(Wq.rollWorldQuests('2026-11-02', zones, 6)));
  assert.ok(q.every(x => !['e', 'town'].includes(x.zone)), 'only zones near level 6');
  assert.equal(new Set(q.map(x => x.zone)).size, 4);
  assert.deepEqual(plain(Wq.zonesNear(zones, 100).map(z => z.id)), ['e', 'd', 'c', 'b'], 'nothing fits: nearest zones');
  const foes = [{ elite: false }, { elite: true }, { rare: 'a' }];
  assert.equal(Wq.questProgress({ zone: 'a', type: 'slay' }, 'a', foes), 3); assert.equal(Wq.questProgress({ zone: 'a', type: 'elites' }, 'a', foes), 2);
  assert.equal(Wq.questProgress({ zone: 'a', type: 'rare' }, 'a', foes), 1); assert.equal(Wq.questProgress({ zone: 'b', type: 'slay' }, 'a', foes), 0);
  assert.equal(Wq.questProgress({ zone: 'a', type: 'slay', done: true }, 'a', foes), 0);
});

test('rares and invasions are deterministic; invasions rotate every 4 hours', () => {
  assert.deepEqual(plain(Wq.rareName('2026-11-02', 'a')), plain(Wq.rareName('2026-11-02', 'a')));
  const zones = [{ id: 'a', lvl: [1, 5] }, { id: 'b', lvl: [3, 8] }, { id: 'c', lvl: [2, 9] }];
  const t = Date.UTC(2026, 10, 2, 13), i1 = Wq.invasionAt(t, zones, 5), i2 = Wq.invasionAt(t + 60e3, zones, 5), i3 = Wq.invasionAt(t + 4 * 36e5, zones, 5);
  assert.equal(i1.zone, i2.zone); assert.equal(i1.window + 1, i3.window); assert.equal(i1.endsAt - Math.floor(t / 144e5) * 144e5, 144e5);
  assert.deepEqual(plain(Wq.wqReward('rare', 10)), { gold: 300, xpShare: 0.25, rarity: 3, seasonXp: 120 });
});

test('dual spec: the second spec starts with every point refunded and stays in step', () => {
  const hero = { talents: ['a', 'b'], talentPts: 1, activeSkills: ['x'], passiveSkills: ['y', 'z'], skillPts: 0, arts: ['art1'], hotbar: ['basic_attack'] };
  const a = Lo.specOf(hero), b = Lo.blankSpecFrom(a);
  assert.deepEqual(plain(b), { talents: [], talentPts: 3, activeSkills: [], passiveSkills: [], skillPts: 3, arts: ['art1'], hotbar: [] });
  assert.deepEqual(plain(Lo.totals(a)), plain(Lo.totals(b)));
  const later = Lo.topUp(b, 5, 4); assert.equal(later.talentPts, 5); assert.equal(later.skillPts, 4);
  const h2 = Lo.applySpec({}, a); assert.deepEqual(plain(h2.talents), ['a', 'b']); h2.talents.push('c'); assert.equal(a.talents.length, 2, 'copies, not shared arrays');
});

test('equipment sets: save by uid and find each piece; hotbar pins come first', () => {
  const eq = { weapon: { uid: 1 }, head: { uid: 2 } }, set = Lo.setFromEq(eq);
  assert.deepEqual(plain(set), { weapon: 1, head: 2 });
  const plan = Lo.planSet({ weapon: 1, head: 3, feet: 4, legs: 9, hands: 2 }, eq, [{ uid: 3 }], [{ uid: 4 }]);
  assert.deepEqual(plain(plan), { weapon: { uid: 1, where: 'worn' }, head: { uid: 3, where: 'bag' }, feet: { uid: 4, where: 'bank' }, legs: { uid: 9, where: null }, hands: { uid: 2, where: 'eq' } });
  const e = [{ id: 'basic_attack' }, { id: 'fire' }, { id: 'heal' }, { id: 'ice' }];
  assert.deepEqual(plain(Lo.orderHotbar(e, ['ice', 'nope', 'fire']).map(x => x.id)), ['ice', 'fire', 'basic_attack', 'heal']);
});
