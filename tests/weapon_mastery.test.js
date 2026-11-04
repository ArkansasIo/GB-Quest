import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));
const M = (() => { const c = { Math, Number, String, Object, Array, Set, JSON, globalThis: null }; c.globalThis = c; vm.runInNewContext(src('weapon_mastery.js'), c); return c.GBQWeaponMastery; })();
// game data: every class (base + jobs), weapon families, buffs and substats
const R = (() => {
  const c = { Math, Number, String, Object, Array, Set, JSON, console, globalThis: null }; c.globalThis = c;
  vm.runInNewContext([src('data_rules.js'), src('jobs_data.js'), src('data_world.js')].join('\n').replace(/^(const|let) /gm, 'var '), c);
  return c;
})();
const ARMORY_FAMS = ['sword', 'axe', 'mace', 'hammer', 'dagger', 'polearm', 'staff', 'wand', 'bow', 'crossbow', 'thrown', 'scythe', 'grimoire', 'fist', 'totem'];
const fresh = () => M.wmNew();

test('every weapon family in the armoury has six arts, six branches and a 60-node board', () => {
  assert.deepEqual([...M.WM_FAMS].sort(), [...ARMORY_FAMS].sort());
  for (const f of M.WM_FAMS) {
    const F = M.WM_FAMILIES[f];
    assert.equal(F.arts.length, 6, f); assert.equal(F.branches.length, 6, f);
    assert.equal(M.wmNodes(f).length, 60, f);
    assert.equal(M.wmNodes(f).reduce((s, n) => s + n.max * n.cost, 0), 312, `${f}: a full board costs more than 200 points`);
    assert.equal(new Set(F.branches.map(b => b[2])).size, 6, `${f}: six different traits`);
  }
});

test('every class has its own signature weapon and art', () => {
  assert.equal(R.CLASS_ORDER.length, 27);
  for (const cls of R.CLASS_ORDER) {
    const s = M.WM_CLASS_WEAPONS[cls]; assert.ok(s, cls);
    assert.ok(M.WM_FAMILIES[s.fam], `${cls} family ${s.fam}`);
    assert.ok(M.WM_ARTS[M.wmSigId(cls)], `${cls} art`);
  }
  const names = Object.values(M.WM_CLASS_WEAPONS).map(s => s.weapon), arts = Object.values(M.WM_CLASS_WEAPONS).map(s => s.art.name);
  assert.equal(new Set(names).size, names.length, 'weapon names are unique'); assert.equal(new Set(arts).size, arts.length, 'art names are unique');
});

test('arts, capstones and themes only use effects and stats the game has', () => {
  const dts = ['fire', 'cold', 'lightning', 'force', 'thunder', 'radiant', 'necrotic', 'poison', 'psychic', 'acid', 'piercing'];
  for (const a of Object.values(M.WM_ARTS)) {
    if (a.rider) assert.ok(R.BUFFS[a.rider], `${a.id} rider ${a.rider}`);
    if (a.selfBuff) assert.ok(R.BUFFS[a.selfBuff], `${a.id} buff ${a.selfBuff}`);
    if (a.kind === 'casting') { assert.ok(dts.includes(a.dt), `${a.id} dt`); assert.ok(a.atk || a.save, `${a.id} resolves`); assert.match(a.dice, /^\d+d\d+$/); }
    else { assert.equal(a.bonus.length, 3, a.id); assert.ok(!a.drain && !a.heal && !a.dice, `${a.id}: casting-only fields on a physical art`); }
    assert.ok(a.cd >= 1 && a.desc && a.name, a.id);
  }
  for (const f of M.WM_FAMS) for (const br of M.WM_FAMILIES[f].branches) {
    const [theme, , , , art, mods] = br, A = M.WM_FAMILIES[f].arts[art];
    assert.ok(M.WM_THEMES[theme], `${f} theme ${theme}`); assert.ok(A, `${f} capstone art ${art}`);
    if (mods.rider) assert.ok(R.BUFFS[mods.rider], `${f} ${br[3]} rider`);
    if (mods.selfBuff) assert.ok(R.BUFFS[mods.selfBuff], `${f} ${br[3]} buff`);
    if (A.kind === 'physical') assert.ok(!mods.dice && !mods.drain && !mods.heal, `${f} ${br[3]}: casting change on a physical art`);
    else assert.ok(!mods.bonus, `${f} ${br[3]}: weapon dice on a casting art`);
  }
  for (const t of Object.values(M.WM_THEMES)) for (const k of [...t.inner, ...t.mid, ...t.deep, ...t.trait.map(x => x[0])]) assert.ok(R.SUBSTATS[k], `stat ${k}`);
  for (const k of Object.keys(M.WM_STEP)) assert.ok(R.SUBSTATS[k], `step ${k}`);
});

test('weapon skill runs 1-720 and sets the mastery cap; skill 720 allows mastery 200', () => {
  assert.equal(M.wmMasteryCap(1), 1); assert.equal(M.wmMasteryCap(36), 10); assert.equal(M.wmMasteryCap(720), 200); assert.equal(M.wmMasteryCap(9999), 200);
  const st = fresh(); assert.equal(M.wmAddSkillXp(st, M.wmSkillXpFor(1)), 1); assert.equal(st.sl, 2);
  M.wmAddSkillXp(st, 1e12); assert.equal(st.sl, 720); assert.equal(st.sx, 0);
  for (let L = 2; L < 720; L++) assert.ok(M.wmSkillXpFor(L) > M.wmSkillXpFor(L - 1), 'skill levels get dearer');
});

test('mastery is its own grind, held back by weapon skill, with banked XP', () => {
  const st = fresh(); st.sl = 36;                                             // cap 10
  M.wmAddMasteryXp(st, 1e12); assert.equal(st.ml, 10, 'stops at the cap');
  assert.equal(st.mx, M.wmMasteryXpFor(10), 'banks one level');
  st.sl = 720; M.wmAddMasteryXp(st, 0); assert.equal(st.ml, 11, 'banked XP pays out when the cap rises');
  M.wmAddMasteryXp(st, 1e12); assert.equal(st.ml, 200); assert.equal(st.mx, 0);
  const low = fresh(); M.wmAddSkillXp(low, 1e12); assert.equal(low.ml, 1, 'skill alone does not raise mastery');
});

test('battle XP: more for elites and bosses, +25% with the class weapon', () => {
  const one = M.wmBattleXp([{ lvl: 10 }], 10, false), elite = M.wmBattleXp([{ lvl: 10, elite: true }], 10, false), boss = M.wmBattleXp([{ lvl: 10, boss: true }], 10, false);
  assert.ok(elite.skill > one.skill && boss.skill > elite.skill); assert.ok(boss.mastery >= one.mastery * 20);
  const sig = M.wmBattleXp([{ lvl: 10 }], 10, true); assert.equal(sig.skill, Math.round(one.skill * 1.25)); assert.equal(sig.mastery, Math.round(one.mastery * 1.25));
  assert.deepEqual(plain(M.wmBattleXp([], 10, false)), { skill: 0, mastery: 0 });
});

test('circle board: points, branch milestones, ring gates and capstones', () => {
  const st = fresh(); st.sl = 720; st.ml = 39;
  assert.equal(M.wmPoints(st), 39);
  assert.equal(M.wmCanSpend(st, 'sword', 'b1r0n0').ok, false, 'branch 2 opens at 40');
  assert.equal(M.wmCanSpend(st, 'sword', 'b0r1n0').ok, false, 'middle ring needs 6 in the branch');
  for (let r = 0; r < 5; r++) assert.ok(M.wmSpend(st, 'sword', 'b0r0n0').ok);
  assert.equal(M.wmSpend(st, 'sword', 'b0r0n0').ok, false, 'max rank 5');
  assert.ok(M.wmSpend(st, 'sword', 'b0r0n1').ok); assert.equal(M.wmBranchSpent(st.board, 0), 6);
  assert.ok(M.wmCanSpend(st, 'sword', 'b0r1n0').ok, '6 points open the middle ring');
  assert.equal(M.wmCanSpend(st, 'sword', 'b0r2n0').ok, false, 'deep ring needs 14');
  for (let r = 0; r < 5; r++) M.wmSpend(st, 'sword', 'b0r1n0'); for (let r = 0; r < 3; r++) M.wmSpend(st, 'sword', 'b0r0n2');
  assert.equal(M.wmBranchSpent(st.board, 0), 14); assert.ok(M.wmSpend(st, 'sword', 'b0r2n0').ok); assert.equal(M.wmSpent(st.board), 16, 'deep ranks cost 2');
  assert.equal(M.wmCanSpend(st, 'sword', 'b0r3n0').ok, false, 'capstone needs 24');
  for (let r = 0; r < 5; r++) M.wmSpend(st, 'sword', 'b0r0n3'); for (let r = 0; r < 3; r++) M.wmSpend(st, 'sword', 'b0r1n1');
  assert.equal(M.wmBranchSpent(st.board, 0), 24);
  assert.ok(M.wmSpend(st, 'sword', 'b0r3n0').ok, '24 spent opens the capstone'); assert.equal(M.wmPoints(st), 39 - 29);
  const arts = M.wmArtsFor(st, 'sword', 'warden'), strike = arts.find(a => a.id === 'wm_sword_0');
  assert.equal(strike.hits, 2, 'RIPOSTE MASTER: SWORD STRIKE hits twice'); assert.equal(M.WM_ARTS.wm_sword_0.hits, undefined, 'base art untouched');
  assert.ok(M.wmBonus(st, 'sword').length > 0);
});

test('a maxed weapon can fill only part of its board', () => {
  const st = fresh(); st.sl = 720; st.ml = 200;
  for (let pass = 0; pass < 6; pass++) for (const n of M.wmNodes('bow')) while (M.wmSpend(st, 'bow', n.id).ok);
  assert.equal(M.wmSpent(st.board), 200); assert.equal(M.wmPoints(st), 0);
  assert.ok(M.wmNodes('bow').some(n => (st.board[n.id] || 0) < n.max), 'nodes left over');
});

test('traits: one per branch, on at its milestone and full at mastery 200', () => {
  assert.deepEqual([...M.WM_BRANCH_UNLOCK], [1, 40, 80, 120, 160, 200]);
  const t1 = M.wmTraits('staff', 1), t80 = M.wmTraits('staff', 80), t200 = M.wmTraits('staff', 200);
  assert.equal(t1.length, 6); assert.deepEqual(plain(t1.map(t => t.open)), [true, false, false, false, false, false]);
  assert.equal(t80.filter(t => t.open).length, 3); assert.equal(t200.filter(t => t.open).length, 6);
  for (const t of t200) assert.deepEqual(plain(t.stats), plain(t.full));
  assert.ok(M.wmTraitStats('staff', 200).length > M.wmTraitStats('staff', 1).length);
});

test('weapon arts unlock with weapon skill; signature art only for its class and family', () => {
  const st = fresh();
  assert.deepEqual(plain(M.wmArtsFor(st, 'dagger', 'shade').map(a => a.id)), ['wm_dagger_0']);
  st.sl = 299; assert.equal(M.wmArtsFor(st, 'dagger', 'shade').length, 3);
  st.sl = 300; assert.ok(M.wmArtsFor(st, 'dagger', 'shade').some(a => a.id === 'wm_sig_shade'));
  assert.ok(!M.wmArtsFor(st, 'dagger', 'warden').some(a => a.sig), 'other classes do not get it');
  assert.ok(!M.wmArtsFor(st, 'sword', 'shade').some(a => a.sig), 'only with the class weapon');
  st.sl = 720; assert.equal(M.wmArtsFor(st, 'dagger', 'shade').length, 7);
});

test('respec is free for small boards, then costs gold that scales with hero level', () => {
  const st = fresh(); st.sl = 720; st.ml = 50;
  for (let r = 0; r < 5; r++) M.wmSpend(st, 'axe', 'b0r0n0');
  assert.equal(M.wmRespecCost(st, 100), 0);
  for (let r = 0; r < 5; r++) M.wmSpend(st, 'axe', 'b0r0n1'); M.wmSpend(st, 'axe', 'b0r0n2');
  assert.ok(M.wmRespecCost(st, 100) > 0); assert.ok(M.wmRespecCost(st, 600) > M.wmRespecCost(st, 100));
  M.wmRespec(st); assert.equal(M.wmSpent(st.board), 0); assert.equal(M.wmPoints(st), 50);
});

test('saved progress is cleaned up: clamped levels, closed branches and overspent boards', () => {
  const st = M.wmNorm({ sl: 99999, ml: 500, sx: -5, mx: 'x', board: { b0r0n0: 9, b5r0n0: 2, nope: 3 } });
  assert.equal(st.sl, 720); assert.equal(st.ml, 200); assert.equal(st.sx, 0); assert.equal(st.mx, 0);
  M.wmTrim(st, 'mace'); assert.deepEqual(plain(st.board), { b0r0n0: 5, b5r0n0: 2 });
  const low = M.wmNorm({ sl: 36, ml: 3, board: { b0r0n0: 5 } }); M.wmTrim(low, 'mace'); assert.deepEqual(plain(low.board), {}, 'overspent board is refunded');
  const closed = M.wmNorm({ sl: 100, ml: 20, board: { b1r0n0: 1, b0r0n1: 2 } }); M.wmTrim(closed, 'mace'); assert.deepEqual(plain(closed.board), { b0r0n1: 2 });
  assert.equal(M.wmFromOldMastery(1), 1); assert.equal(M.wmFromOldMastery(30), 233);
});
