import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { hasRuntimeAsset } from '../../../../../tests/runtime-assets.js';

const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));
const J = (() => { const c = { Math, Number, String, Object, Array, Set, JSON, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('jobs.js'), c); return c.GBQJobs; })();
// the core rules with the new jobs and races loaded on top (top-level const/let become context globals)
const R = (() => { const c = { Math, Number, String, Object, Array, Set, JSON, console, globalThis: null }; c.globalThis = c; vm.runInNewContext([src('data_rules.js'), src('jobs_data.js')].join('\n').replace(/^(const|let) /gm, 'var '), c); return c; })();

const NEW_JOBS = ['ronin', 'shinobi', 'bladedancer', 'wyrmlancer', 'corsair', 'beastcaller', 'puppeteer', 'dreadknight', 'voidhunter', 'scalesage', 'stormcaller'];
const NEW_RACES = ['hornfolk', 'felinar', 'pipkin', 'lunari', 'wolfkin', 'starkin'];

test('11 new jobs join the class list with valid gear, saves and subclasses', () => {
  assert.equal(R.CLASS_ORDER.length, 27);
  for (const id of NEW_JOBS) {
    const c = R.CLASSES[id]; assert.ok(c, id); assert.ok(R.CLASS_ORDER.includes(id));
    for (const g of c.gear) assert.ok(R.WEAPONS[g] || R.ARMORS[g], `${id} gear ${g}`);
    assert.equal(c.subs.length, 2); for (const f of c.features) assert.ok(R.FEATURE_NAME[f[1]], `${id} feature ${f[1]}`);
    for (const a of c.armor) assert.ok(['light', 'medium', 'heavy', 'shield'].includes(a));
    assert.ok(J.JOB_ABILITIES[id] && J.JOB_ABILITIES[id].length >= 2, `${id} has job abilities`);
    assert.ok(J.SUPPORT_TRAITS[id], `${id} has support traits`);
  }
  for (const id of R.CLASS_ORDER) assert.ok(J.SUPPORT_TRAITS[id], `support traits for ${id}`);
});

test('new casters get spells; new races are playable', () => {
  const known = cls => R.SPELLS.filter(s => s.cls.includes(cls)).length;
  assert.ok(known('scalesage') >= 12); assert.ok(known('stormcaller') >= 8); assert.ok(known('dreadknight') >= 2);
  assert.equal(Object.keys(R.SPECIES).length, 15);
  for (const sp of NEW_RACES) { const s = R.SPECIES[sp]; assert.ok(s && s.name && s.desc); assert.equal(Object.values(s.asi).reduce((a, b) => a + b, 0), 3); }
});

test('job snapshots keep progress apart; fresh jobs start at level 1', () => {
  const hero = { cls: 'warden', lvl: 40, xp: 9000, base: { STR: 17 }, sub: 'champ', talents: ['a'], talentPts: 1, arts: ['x'], hotbar: ['y'], pending: { asi: 0, sub: false, boon: 0 }, eq: { weapon: 1 } };
  const snap = J.jobSnapshot(hero);
  assert.equal(snap.lvl, 40); assert.equal(snap.eq, undefined, 'gear is shared, not per job');
  snap.talents.push('b'); assert.deepEqual(hero.talents, ['a'], 'snapshots are copies');
  const fresh = J.freshJob({ DEX: 16 });
  J.jobRestore(hero, fresh); assert.equal(hero.lvl, 1); assert.equal(hero.xp, 0); assert.equal(hero.sub, null); assert.deepEqual(plain(hero.base), { DEX: 16 }); assert.equal(hero.hotbar.length, 0);
  J.jobRestore(hero, J.jobSnapshot({ ...snap, talents: ['a'] })); assert.equal(hero.lvl, 40); assert.deepEqual(plain(hero.talents), ['a']);
  assert.equal(J.jobLevelOf({ cls: 'ronin', lvl: 7, jobs: { warden: { lvl: 40 } } }, 'warden'), 40);
  assert.equal(J.jobLevelOf({ cls: 'ronin', lvl: 7, jobs: {} }, 'ronin'), 7); assert.equal(J.jobLevelOf({ cls: 'ronin', lvl: 7 }, 'shinobi'), 1);
});

test('support job: opens at 18, half the main level, capped by its own level', () => {
  assert.equal(J.supportLevel(17, 99), 0); assert.equal(J.supportLevel(18, 99), 9); assert.equal(J.supportLevel(60, 99), 30);
  assert.equal(J.supportLevel(60, 12), 12, 'never above the support job\'s own level'); assert.equal(J.supportLevel(40, 0), 1);
  assert.deepEqual(plain(J.supportBonus('ronin', 9)), [['crit', 1], ['critdmg', 3]]);
  assert.deepEqual(plain(J.supportBonus('ronin', 30)), [['crit', 3], ['critdmg', 9]]);
  assert.deepEqual(plain(J.supportBonus('warden', 720)), [['hp', 120], ['block', 8]], 'capped');
  assert.deepEqual(plain(J.supportBonus('nojob', 30)), []);
});

test('job abilities unlock by level; support adds its own up to the support level', () => {
  const ids = l => plain(l.map(a => a.id));
  assert.deepEqual(ids(J.jobAbilityList('wyrmlancer', 1)), ['jump']);
  assert.deepEqual(ids(J.jobAbilityList('wyrmlancer', 30)), ['jump', 'callwyvern', 'ancientcircle']);
  const l = J.jobAbilityList('ronin', 40, 'shinobi', 20); assert.deepEqual(ids(l), ['meikyo', 'thirdeye', 'paperimage', 'shuriken']);
  assert.ok(l.filter(a => a.sup).every(a => a.from === 'shinobi'));
  assert.deepEqual(ids(J.jobAbilityList('warden', 40, 'ronin', 9)), ['meikyo'], 'core classes gain new-job abilities as support');
  assert.deepEqual(ids(J.jobAbilityList('ronin', 40, 'ronin', 20)), ['meikyo', 'thirdeye'], 'no doubling');
});

test('racial traits', () => {
  assert.deepEqual(plain(J.raceBonus('felinar', 5)), [['dodge', 5]]);
  assert.deepEqual(plain(J.raceBonus('hornfolk', 10)), [['hp', 14]]); assert.deepEqual(plain(J.raceBonus('hornfolk', 720)), [['hp', 150]]);
  assert.deepEqual(plain(J.raceBonus('wolfkin', 1)), [['crit', 4], ['critdmg', 15]]); assert.deepEqual(plain(J.raceBonus('hearthkin', 1)), []);
  assert.ok(J.RACE_ABILITIES.hornfolk && J.RACE_ABILITIES.starkin);
});

test('monster jobs: only ordinary humanoid-type foes, each with its effect', () => {
  const foe = (o = {}) => ({ name: 'BANDIT', fam: 'humanoid', ac: 12, hit: 4, maxhp: 100, hp: 100, xp: 10, spells: [], attacks: [{ dice: '2d8+2', hit: 4 }], ...o });
  assert.equal(J.rollMonsterJob(foe(), 0.1, 0), 'hexer'); assert.equal(J.rollMonsterJob(foe(), 0.9, 0), null);
  assert.equal(J.rollMonsterJob(foe({ boss: true }), 0.1, 0), null); assert.equal(J.rollMonsterJob(foe({ fam: 'beast' }), 0.1, 0), null);
  assert.equal(J.rollMonsterJob(foe({ side: 'party' }), 0.1, 0), null); assert.equal(J.rollMonsterJob(foe({ job: 'brute' }), 0.1, 0), null, 'never twice');
  const g = J.applyMonsterJob(foe(), 'guardian'); assert.equal(g.ac, 15); assert.equal(g.maxhp, 130); assert.equal(g.hp, 130); assert.equal(g.name, 'BANDIT GUARDIAN'); assert.equal(g.xp, 12);
  const h = J.applyMonsterJob(foe(), 'hexer'); assert.equal(h.maxhp, 85); assert.ok(h.spells.includes('emberdart') && h.spells.includes('lance'));
  const a = J.applyMonsterJob(foe(), 'archer'); assert.equal(a.hit, 6); assert.equal(a.attacks[0].hit, 6);
  const b = J.applyMonsterJob(foe(), 'brute', { diceAvg: () => 10, dmgDice: v => `d${v}` }); assert.equal(b.ac, 11); assert.equal(b.attacks[0].dice, 'd13');
  assert.equal(J.applyMonsterJob(foe(), 'mender').mender, true);
  for (const s of J.applyMonsterJob(foe(), 'hexer').spells) assert.ok(R.SPELLS.find(x => x.id === s), `monster spell ${s} exists`);
});

test('asset pack: scene choice, battle bg cycle and art names exist', () => {
  const c = { Math, Object, Array, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('asset_pack.js'), c); const A = c.GBQAssetPack;
  assert.equal(A.apSceneFor('field', [{ boss: true }], false, false), 'ap_scene_boss_fight');
  assert.equal(A.apSceneFor('dungeon', [{}], false, false), 'ap_scene_dungeon'); assert.equal(A.apSceneFor('field', [{}], true, false), 'ap_scene_dungeon');
  assert.equal(A.apSceneFor('field', [{}], false, true), 'ap_scene_city'); assert.equal(A.apSceneFor('field', [{}], false, false), 'ap_scene_wilderness');
  assert.equal(A.nextBattleBg('clean'), 'painted'); assert.equal(A.nextBattleBg('painted'), 'scenes'); assert.equal(A.nextBattleBg('scenes'), 'clean');
  const has = hasRuntimeAsset;
  for (const n of [...Object.values(A.AP_ITEM_ART), ...Object.values(A.AP_GEM_ART), 'ap_scene_boss_fight', 'ap_scene_dungeon', 'ap_scene_city', 'ap_scene_wilderness']) assert.ok(has(n), n);
});

test('asset pack: monster art by family, stable faces, rarity rings exist', () => {
  const c = { Math, Object, Array, String, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('asset_pack.js'), c); const A = c.GBQAssetPack;
  const has = hasRuntimeAsset;
  for (const L of Object.values(A.AP_MONSTERS)) for (const n of L) assert.ok(has(n), n);
  for (const n of A.AP_PORTRAITS) assert.ok(has(n), n);
  for (let t = 0; t < 9; t++) assert.ok(has(`au_rframe_${t}`));
  assert.equal(A.apMonsterArt('plant', 'x'), null, 'families without pack art keep theirs');
  let hits = 0; for (let i = 0; i < 200; i++) if (A.apMonsterArt('beast', 'wolf|' + i)) hits++;
  assert.ok(hits > 60 && hits < 140, 'about half of a family uses the pack art');
  assert.equal(A.apMonsterArt('beast', 'wolf|7'), A.apMonsterArt('beast', 'wolf|7'));
  assert.equal(A.apPortraitFor('ELDER MAE'), A.apPortraitFor('ELDER MAE')); assert.equal(A.apPortraitFor(''), null);
});

test('pixel packs: index sprites exist, aliases point at real art, monster picks are stable', () => {
  const idx = (() => { const c = {}; vm.runInNewContext(src('pack_index.js').replace(/^const PACK_INDEX/m, 'globalThis.PACK_INDEX'), Object.assign(c, { globalThis: c })); return c.PACK_INDEX; })();
  const has = hasRuntimeAsset;
  for (const L of [...Object.values(idx.items), ...Object.values(idx.monsters)]) for (const n of L) assert.ok(has(n), n);
  for (const [old, pk] of Object.entries(idx.alias)) { assert.ok(has(pk), pk); assert.ok(has(old), `alias target ${old} is a real game sprite`); }
  assert.equal(idx.items.sword.length, 11, '11 sword tiers');
  const c = { Math, Object, String, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('pack_art.js'), c); const P = c.GBQPackArt;
  assert.equal(P.nextArtMode('classic'), 'nes'); assert.equal(P.nextArtMode('nes'), 'packs'); assert.equal(P.nextArtMode('packs'), 'classic');
  assert.equal(P.packMonsterFor('plant', 'x', idx.monsters), null);
  let n = 0; for (let i = 0; i < 300; i++) if (P.packMonsterFor('undead', 'z|' + i, idx.monsters)) n++;
  assert.ok(n > 60 && n < 140, 'about a third of a family');
});

test('8-bit MMO UI: theme cycle and a layout that keeps frames apart', () => {
  const c = { Math, Object, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('ui_mmo.js'), c); const U = c.GBQUiMmo;
  assert.equal(U.nextUiTheme('mmo'), 'mu'); assert.equal(U.nextUiTheme('mu'), 'classic'); assert.equal(U.nextUiTheme('diablo'), 'blackbird'); assert.equal(U.nextUiTheme('blackbird'), 'mmo'); assert.equal(U.nextUiTheme('mmo', -1), 'blackbird');
  const L = U.MMO_LAYOUT;
  assert.ok(L.unit.x + L.unit.w < L.map.x, 'unit frame and minimap do not touch');
  assert.ok(L.toastY > L.map.y + L.map.s + 8 && L.bannerY > L.toastY + 25, 'toasts and banners sit below the frames');
  assert.ok(L.hotbar.x + L.hotbar.slots * L.hotbar.step < 160 - 2 * L.hud.orbR - 4, 'hotbar fits between the orbs');
});

test('spell levels 1-9 spread across character levels 1-720', () => {
  const W = (() => { const c = { Math, Number, Object, Array, String, JSON, console, globalThis: null }; c.globalThis = c; vm.runInNewContext([src('data_rules.js'), src('data_world.js')].join('\n').replace(/^(const|let) /gm, 'var '), c); return c; })();
  const maxSpell = L => { const S = W.spellCasterLevel(L); return W.FULL_SLOTS[S - 1].length; };
  assert.deepEqual(plain(W.SPELL_UNLOCK.map(maxSpell)), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'each unlock level opens its spell level');
  for (let k = 1; k < 9; k++) assert.equal(maxSpell(W.SPELL_UNLOCK[k] - 1), k, `spell level ${k + 1} not before level ${W.SPELL_UNLOCK[k]}`);
  assert.equal(W.spellCasterLevel(720), 17); assert.equal(W.spellCasterLevel(9999), 17); assert.equal(W.spellCasterLevel(0), 1);
  let last = 0; for (let L = 1; L <= 720; L++) { const s = W.spellCasterLevel(L); assert.ok(s >= last); last = s; }
});

test('necromancer army: grows to 9 (6 warriors, 2 mages, golem), sacrifice trades minions for stats', () => {
  const c = { Math, Object, Array, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('necro_army.js'), c); const A = c.GBQArmy;
  assert.equal(A.armySize(1), 2); assert.equal(A.armySize(28), 9); assert.equal(A.armySize(720), 9);
  const full = plain(A.armyFor(30));
  assert.equal(full.length, 9); assert.equal(full.filter(m => m.kind === 'warrior').length, 6); assert.equal(full.filter(m => m.kind === 'mage').length, 2); assert.equal(full[8].kind, 'golem');
  assert.equal(A.armyFor(30, {}, 3).length, 3, 'support job raises up to 3');
  const noW = plain(A.armyFor(30, { warrior: 'sacrifice' })); assert.equal(noW.length, 3); assert.ok(noW.every(m => m.kind !== 'warrior'));
  assert.deepEqual(plain(A.sacrificeBonus({ warrior: 'sacrifice' }, 30)), [['crit', 8], ['critdmg', 20]]);
  assert.deepEqual(plain(A.sacrificeBonus({}, 30)), []);
  assert.equal(plain(A.armyFor(30, { golem: 'iron', mage: 'cold' }))[8].variant, 'iron');
});

test('npc AI: schedules, utility choices, steering and barks', () => {
  const c = { Math, Object, String, Number, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('npc_ai.js'), c); const N = c.GBQNpcAI;
  assert.equal(N.dayPhase(3), 'night'); assert.equal(N.dayPhase(7), 'dawn'); assert.equal(N.dayPhase(12), 'day'); assert.equal(N.dayPhase(20), 'evening');
  const folk = { name: 'TOWNSMAN BOB' }, smith = { name: 'BLACKSMITH', svc: 'blacksmith' };
  assert.equal(N.leashOf(smith), 1, 'service NPCs stay by their counter'); assert.ok(N.leashOf(folk) >= 3);
  const base = { hour: 12, raining: false, heroDist: 9, greetedAgo: 99999, nearNpc: false, homeDist: 0 };
  assert.equal(N.bestNpcAction(N.scoreNpcActions(folk, { ...base, heroDist: 1 })), 'greet', 'greets a nearby hero');
  assert.equal(N.bestNpcAction(N.scoreNpcActions(folk, { ...base, homeDist: 9 })), 'return', 'comes back inside the leash');
  assert.equal(N.bestNpcAction(N.scoreNpcActions(folk, { ...base, heroDist: 1, greetedAgo: 10 })) === 'greet', false, 'no greeting spam');
  assert.ok(['sleep', 'shelter'].includes(N.bestNpcAction(N.scoreNpcActions(folk, { ...base, hour: 2 }))), 'townsfolk sleep at night');
  assert.deepEqual(plain(N.stepToward([0, 0], [3, 1], () => false)), [1, 0, 'right']);
  assert.deepEqual(plain(N.stepToward([0, 0], [3, 1], (x, y) => x === 1 && y === 0)), [0, 1, 'down'], 'steers around');
  assert.equal(N.stepToward([0, 0], [1, 0], () => true), null);
  assert.ok(N.npcBark({ action: 'greet', hour: 12, heroName: 'ZED', heroLvl: 5, talks: 9 }, 0.9).length > 0);
  assert.ok(/Zzz|yawn|Shh/.test(N.npcBark({ action: 'sleep', hour: 2 }, 0.1)));
});

test('throne-style systems: weapon mastery, amitoi expeditions, day and night', () => {
  const c = { Math, Object, Array, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('tnl_systems.js'), c); const T = c.GBQTnl;
  const m = { lvl: 1, xp: 0 }; assert.equal(T.masteryAdd(m, T.masteryXpFor(1)), 1); assert.equal(m.lvl, 2);
  const big = { lvl: 1, xp: 0 }; T.masteryAdd(big, 1e9); assert.equal(big.lvl, 30, 'caps at 30'); assert.equal(big.xp, 0);
  assert.equal(T.masteryRank(9), 'NOVICE'); assert.equal(T.masteryRank(10), 'ADEPT'); assert.equal(T.masteryRank(30), 'MASTER');
  assert.deepEqual(plain(T.masteryBonus('sword', 1)), []); { const d = l => T.masteryBonus('dagger', l)[1][1]; assert.ok(d(10) - d(9) > 2 * (d(9) - d(8)), 'specialization rank is a bigger step'); }
  for (const f of T.MASTERY_FAMS) assert.equal(T.masteryBonus(f, 30).length, 2);
  const a = plain(T.expeditionReward('short', 1, 10, 42)), b = plain(T.expeditionReward('long', 1, 10, 42));
  assert.deepEqual(a, plain(T.expeditionReward('short', 1, 10, 42)), 'same seed, same haul'); assert.ok(b.gold > a.gold * 5 && b.mats > a.mats, 'longer trips bring more');
  assert.ok(T.expeditionReward('short', 10, 10, 42).gold > a.gold, 'pet level helps');
  assert.equal(T.amitoiLevel(0), 1); assert.equal(T.amitoiLevel(1e9), 10);
  assert.equal(T.isNight(23), true); assert.equal(T.isNight(3), true); assert.equal(T.isNight(12), false);
});

test('guild conquest: stone owners, waves, taxes and counterattack timing', () => {
  const c = { Math, Object, Array, String, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('guild_war.js'), c); const Q = c.GBQConquest;
  assert.ok(Q.AI_GUILDS.includes(Q.startingOwner('hollowmere'))); assert.equal(Q.startingOwner('hollowmere'), Q.startingOwner('hollowmere'));
  const stone = plain(Q.challengeWaves('stone')); assert.equal(stone.length, 3); assert.ok(stone[2].boss);
  const castle = plain(Q.challengeWaves('castle')); assert.equal(castle[0].name, 'GATE'); assert.equal(castle[2].name, 'CASTLE LORD');
  assert.equal(Q.stoneTax(10, 1), 150); assert.equal(Q.stoneTax(10, 30), 150 * 7, 'taxes build up to 7 days'); assert.equal(Q.stoneTax(10, 0), 0);
  assert.ok(Q.castleTax(10, 1) > Q.stoneTax(10, 1) * 3);
  assert.equal(Q.counterDue(1000, 0, 500), true); assert.equal(Q.counterDue(1000, 900, 500), false);
  assert.equal(Q.CASTLE_NEEDS, 3);
});

test('extras: gem drop odds and tiers, gem shop prices', () => {
  const c = { Math, Object, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('extras.js'), c); const X = c.GBQExtras;
  assert.ok(X.GEM_DROP.boss > X.GEM_DROP.elite && X.GEM_DROP.elite > X.GEM_DROP.normal);
  assert.equal(X.gemTierFor(1), 1); assert.equal(X.gemTierFor(100), 5); assert.equal(X.gemTierFor(720), 9);
  assert.ok(X.gemPrice(3) > X.gemPrice(2) && X.gemPrice(2) > X.gemPrice(1));
});

test('action-RPG gear: aspects, greater affixes, tempering and masterwork', () => {
  const c = { Math, Object, Array, String, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('aspects_data.js') + '\n' + src('d4_gear.js'), c); const A = c.GBQAspects;
  assert.ok(A.ASPECT_IDS.length >= 160, 'every family of aspect');
  for (const id of A.ASPECT_IDS) { const t = A.ASPECTS[id].desc(A.ASPECTS[id].hi); assert.ok(t && !/undefined|NaN/.test(t), id); }
  for (const id of ['executioner', 'stormshard', 'corpseburst', 'bulwark', 'fortune']) assert.ok(A.ASPECTS[id], `old aspect ${id} still exists`);
  for (const kind of ['weapon', 'armor', 'wondrous']) { const a = A.rollAspect(kind, 5, 0.5, 0); assert.ok(A.fitsKind(a.id, kind)); assert.equal(a.val, A.ASPECTS[a.id].lo + Math.round(0) || a.val); }
  const lo = A.rollAspect('weapon', 5, 0, 0), hi = A.rollAspect('weapon', 8, 0, 1); assert.equal(lo.id, hi.id); assert.ok(hi.val > lo.val, 'better rarity and roll, better aspect');
  assert.deepEqual(plain(A.rollGreater(3, 5, [0.9, 0.01, 0.9, 0])), [1]);
  assert.deepEqual(plain(A.rollGreater(3, 7, [0.9, 0.9, 0.9, 0.5])), [1], 'ancestral items always get one');
  assert.ok(A.temperValue('hp', 600) > A.temperValue('hp', 1));
  assert.deepEqual(plain(A.masterworkAffixes([['dmg', 20], ['hp', 100]], 4, [1])), [['dmg', 24], ['hp', 150]]);
  assert.ok(A.masterworkCost(11, 100).gold > A.masterworkCost(0, 100).gold * 10);
  assert.equal(A.TEMPER_MAX, 2); assert.equal(A.MW_MAX, 12);
});

test('guide: every topic listed and pages wrap to the dialogue box', () => {
  const c = { Math, String, Object, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('guide.js'), c); const Gd = c.GBQGuide;
  assert.ok(Gd.GUIDE_TOPICS.length >= 13); assert.ok(Gd.GUIDE_TOPICS.includes('ASPECT CODEX'));
  const pages = plain(Gd.guidePages(['one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty']));
  for (const pg of pages) for (const line of pg.split(' ')) assert.ok(line.length <= 25);
  assert.ok(pages.length >= 2, 'long text spans several pages');
});
