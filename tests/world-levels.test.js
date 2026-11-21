import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// WORLD LEVEL 1-9 (src/world_levels.js): rules, then the open-world wiring with stub encounter functions.
const src = f => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const pure = (() => { const c = {}; c.globalThis = c; vm.createContext(c); vm.runInContext(src('world_levels.js'), c); return c.GBQWorldLevels; })();

test('nine world levels that only ever get harder and pay more', () => {
  const L = pure.WORLD_LEVELS;
  assert.equal(L.length, 9);
  assert.equal(new Set(L.map(d => d.name)).size, 9, 'unique names');
  L.forEach((d, i) => {
    assert.equal(d.n, i + 1);
    assert.ok(d.warden && d.warden.length <= 16, `${d.name} warden name fits`);
    assert.ok(d.req <= 720 && pure.wardenLevel(d) <= 720, `${d.name} within the level cap`);
    if (i) for (const k of ['req', 'lvl', 'xp', 'gold', 'loot']) assert.ok(d[k] > L[i - 1][k], `${d.name} ${k} rises`);
  });
  assert.deepEqual([L[0].lvl, L[0].xp, L[0].gold, L[0].loot], [0, 1, 1, 1], 'level 1 changes nothing');
});

test('unlocking: hero level first, then the trial; choose any unlocked level', () => {
  const hero = { lvl: 19 };
  pure.normWorldLevel(hero);
  assert.deepEqual([hero.worldLevel, hero.worldLevelMax], [1, 1]);
  assert.equal(pure.ascensionCheck(hero).ok, false, 'level 19 is too low for world level 2');
  assert.equal(pure.ascend(hero), false);
  hero.lvl = 20;
  assert.equal(pure.ascensionCheck(hero).def.n, 2);
  assert.equal(pure.ascend(hero), true);
  assert.deepEqual([hero.worldLevel, hero.worldLevelMax], [2, 2]);
  assert.equal(pure.ascend(hero), false, 'world level 3 needs hero level 40');
  assert.equal(pure.setWorldLevel(hero, 1), true); assert.equal(hero.worldLevel, 1);
  assert.equal(pure.setWorldLevel(hero, 3), false, 'locked level refused');
  assert.equal(pure.setWorldLevel(hero, 2.5), false);
  const top = { lvl: 720 }; for (let i = 0; i < 20; i++) pure.ascend(top);
  assert.equal(top.worldLevelMax, 9); assert.equal(pure.ascensionCheck(top).def, null);
  const broken = pure.normWorldLevel({ worldLevel: 7, worldLevelMax: 'x' });
  assert.deepEqual([broken.worldLevel, broken.worldLevelMax], [1, 1], 'a broken save is repaired');
  assert.equal(pure.wlMonsterLevel(715, 9), 720, 'monster level capped');
});

test('open-world encounters scale with the world level; instances and towns do not', () => {
  const c = { console }; c.globalThis = c; c.window = c; vm.createContext(c);
  vm.runInContext(`
    var G = { lvl: 100, worldLevel: 4, worldLevelMax: 4, inst: null, stats: {} };
    var zoneLevel = z => z.lvl[0];
    var rollEncounter = z => [{ lvl: zoneLevel(z), xp: 100, gold: 50 }];
    var seenLoot = null; var rollDrops = (f, ctx) => { seenLoot = ctx && ctx.loot; return { gold: 0 }; };
  `, c);
  vm.runInContext(src('world_levels.js'), c);
  const run = code => vm.runInContext(code, c);
  const wild = '({ id: "w", lvl: [30, 34] })', town = '({ id: "t", town: true, lvl: [30, 34] })';
  const f = run(`rollEncounter(${wild})[0]`);
  assert.deepEqual([f.lvl, f.xp, f.gold, f.wl], [37, 135, 65, 4], 'world level 4: +7 levels, XP x1.35, gold x1.3');
  run('rollDrops(rollEncounter(' + wild + ')[0], { loot: 2 })');
  assert.equal(run('seenLoot'), 2 * 1.2, 'loot x1.2 on top of difficulty');
  assert.deepEqual([...run(`(f => [f.lvl, f.xp, f.wl])(rollEncounter(${town})[0])`)], [30, 100, undefined], 'towns unchanged');
  run('G.inst = { kind: "dungeon" }');
  assert.deepEqual([...run(`(f => [f.lvl, f.xp, f.wl])(rollEncounter(${wild})[0])`)], [30, 100, undefined], 'instances unchanged');
  run('G.inst = null; G.worldLevel = 1');
  assert.equal(run(`rollEncounter(${wild})[0].lvl`), 30, 'world level 1 unchanged');
});

test('world levels load after the encounter wrappers and appear in the guide', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), at = f => html.indexOf(`src="src/${f}.js"`);
  assert.ok(at('world_levels') > at('systems') && at('world_levels') > at('tnl_systems') && at('world_levels') > at('world_quests'));
  const order = fs.readFileSync(new URL('../tools/build.cjs', import.meta.url), 'utf8').match(/const ORDER = \[([^\]]+)\]/)[1];
  assert.ok(order.indexOf("'world_levels'") > order.indexOf("'tnl_systems'"));
  assert.match(src('guide.js'), /WORLD LEVEL 1-9/);
});
