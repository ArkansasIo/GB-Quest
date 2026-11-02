#!/usr/bin/env python3
"""Headless bug sweep for Lost Kingdom of Shadowbane Chronicles.

Drives the real game (dist/gbquest.html) in Chromium and exercises:
  every class x levels in auto-battles, all 90 zones, the world map at all zooms,
  every main-menu screen with input, dungeons/raids/trials/tower, all palettes and
  video/tile/art modes, save/load round trips, both audio engines, and the atlas.
Every step runs in try/catch; uncaught errors from the game loop are collected too.

  python3 tests/sweep.py [path/to/gbquest.html]      -> prints a report, exit 1 on failures
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'gbquest.html')

SWEEP = r"""
async () => {
  const fails = [], notes = [], bad = {}, losses = [], t0 = performance.now();
  // screen-text probe: anything drawn that contains undefined / NaN / null / [object
  const _text = text; let curStep = '';
  window.text = text = function (s, ...a) { const str = String(s); if (/undefined|NaN|\bnull\b|\[object/.test(str)) (bad[curStep + ' :: ' + (topScene() ? topScene().constructor.name : '') + ' :: ' + str.slice(0, 40)] = 1); return _text(s, ...a); };
  const scan = (o, path, out, depth = 0) => {
    if (depth > 6 || out.length > 5) return;
    if (typeof o === 'number' && !Number.isFinite(o)) out.push(path + '=' + o);
    else if (o === undefined) out.push(path + '=undefined');
    else if (o && typeof o === 'object') for (const k in o) scan(o[k], path + '.' + k, out, depth + 1);
  };
  const invariants = () => {
    if (!G) return null; const out = []; scan(JSON.parse(JSON.stringify(G, (k, v) => typeof v === 'number' && !Number.isFinite(v) ? 'NONFINITE:' + v : v)), 'G', out);
    const nf = JSON.stringify(G).match(/"NONFINITE[^"]*"/g); if (nf) out.push('non-finite: ' + nf.slice(0, 3));
    const D = derive(G); for (const k of ['ac', 'hpMax', 'init']) if (!Number.isFinite(D[k])) out.push('derive.' + k + '=' + D[k]);
    if (G.hp > D.hpMax) out.push(`hp ${G.hp} > max ${D.hpMax}`);
    if (G.hp < 0) out.push('hp < 0');
    return out.length ? out.join('; ') : null;
  };
  const step = (name, fn) => { curStep = name; try { const r = fn(); if (r) notes.push(name + ': ' + r); const v = invariants(); if (v) fails.push({ step: name, err: 'INVARIANT ' + v }); } catch (e) { fails.push({ step: name, err: String(e && e.stack || e).split('\n').slice(0, 4).join(' | ') }); } };
  const press = (b, n = 1) => { for (let i = 0; i < n; i++) { bDown(b); tick(); bUp(b); tick(); } };
  const run = n => { for (let i = 0; i < n; i++) tick(); render(); };
  const top = () => topScene() && topScene().constructor.name;
  const fresh = (cls = 'warden', species = 'hearthkin', bg = 'soldier', lvl = 1) => {
    reset(new Title()); G = newGameState({ name: 'SWEEP', cls, species, bg }); if (lvl > 1) gainXP(G, xpForLevel(lvl) - (G.xp || 0)); enterWorld(); run(5);
  };
  const waitBattle = () => { for (let i = 0; i < 400 && !scenes.some(s => s instanceof Battle); i++) tick(); return scenes.some(s => s instanceof Battle); };
  const stats = { battles: 0, won: 0, lost: 0, ticks: 0 };
  const autoFight = (maxT = 30000) => {
    if (!waitBattle()) return 'battle never started';
    stats.battles++; S.autoBattle = true; let t = 0;
    while (t < maxT && scenes.some(s => s instanceof Battle)) { tick(); t++; if (t % 40 === 0) { bDown('a'); tick(); bUp('a'); } if (t % 600 === 0) render(); }
    // clear post-battle popups (loot, level up, dialogs)
    stats.ticks += t; if (G.ghost) { stats.lost++; losses.push(curStep + ` (L${G.lvl} hp ${G.hp})`); } else stats.won++;
    for (let i = 0; i < 40 && !(topScene() instanceof Field); i++) { press('a'); run(6); }
    if (t >= maxT) return 'TIMEOUT after ' + t + ' ticks';
    if (!(topScene() instanceof Field)) return 'stuck in ' + top();
    return null;
  };
  const SPEC = Object.keys(SPECIES), BGS = Object.keys(BACKGROUNDS);

  // 1. boot + title
  step('boot', () => { reset(new Boot()); run(200); press('a'); run(60); return top(); });
  step('title-nav', () => { reset(new Title()); run(30); press('down', 3); press('up', 3); render(); });
  step('prologue', () => { reset(new Prologue(() => reset(new Title()))); for (let i = 0; i < 30; i++) press('a'); render(); });
  step('charcreate', () => { reset(new CharCreate(0)); for (const b of ['right', 'down', 'right', 'down', 'left', 'up']) { press(b); render(); } });

  // 2. every class at levels 1, 5, 20, 120: auto battle in its starting zone
  for (const [i, cls] of CLASS_ORDER.entries()) for (const lvl of [1, 5, 20, 120]) step(`battle ${cls} L${lvl}`, () => {
    fresh(cls, SPEC[i % SPEC.length], BGS[i % BGS.length], lvl);
    startBattle(rollEncounter(ZONE_BY_ID[G.map])); run(10);
    const r = autoFight(); if (r) return r;
    if (G.hp == null) return 'hp missing';
  });

  // 3. every zone: travel, walk, draw, then the world map at all zooms
  fresh('strider', 'thornelf', 'wanderer', 200);
  for (const z of ZONES) step('zone ' + z.id, () => {
    travelTo(z.id); run(30);
    if (!(topScene() instanceof Field)) { for (let i = 0; i < 10 && !(topScene() instanceof Field); i++) press('b'); }
    for (const d of ['up', 'right', 'down', 'left']) { bDown(d); run(20); bUp(d); }
    for (let i = 0; i < 10 && !(topScene() instanceof Field); i++) { press('b'); run(3); }
    if (waitBattle()) { const r = autoFight(); if (r) return r; }
    G.visited[z.id] = true; G.ghost = false;
  });
  step('worldmap all zooms', () => {
    reset(new Field()); const wm = new WorldMap(); push(wm);
    for (const z of ZONES) { wm.sel = z; for (const zoom of [0, 1, 2]) { wm.zoom = zoom; render(); } }
    wm.legend = true; render(); press('b', 4);
  });

  // 4. every main-menu screen with input
  fresh('arcanist', 'emberborn', 'scholar', 30);
  for (let k = 0; k < 20; k++) step('menu item ' + k, () => {
    reset(new Field()); run(2); push(new MainMenu()); const mm = topScene(); mm.i = k; const name = mm.items()[k];
    if (name.startsWith('SAVE & QUIT')) return;
    press('a'); run(4);
    for (const b of ['down', 'down', 'right', 'up', 'left', 'select', 'a', 'down', 'a']) { press(b); run(2); }
    for (let i = 0; i < 12 && !(topScene() instanceof Field); i++) { press('b'); run(2); }
    if (scenes.some(s => s instanceof Battle)) autoFight();
  });

  // 5. town services via direct menus
  for (const svc of ['vendor', 'inn', 'trainer', 'auction', 'mail', 'bank', 'guild', 'honor', 'lfg', 'difficulty', 'tower', 'trials', 'portal', 'server', 'stable', 'arena'])
    step('service ' + svc, () => {
      fresh('vanguard', 'stonekin', 'acolyte', 40); travelTo('ardenhold'); run(10);
      npcService({ svc, name: 'SWEEP NPC', x: G.x, y: G.y });
      run(4); for (const b of ['down', 'a', 'down', 'a']) { press(b); run(3); }
      for (let i = 0; i < 12 && !(topScene() instanceof Field); i++) { press('b'); run(2); }
      if (scenes.some(s => s instanceof Battle)) autoFight();
    });

  // 6. instances
  for (const d of DUNGEONS.slice(0, 22)) step('dungeon ' + d.id, () => {
    fresh('warden', 'stonekin', 'soldier', Math.max(5, d.lvl + 2)); enterInstance('dungeon', d, 1, 4); run(20);
    const p = G.inst && G.inst.map.pulls[0]; if (p) { fightPull(p); run(5); const r = autoFight(); if (r) return r; }
    for (let i = 0; i < 10 && !(topScene() instanceof Field); i++) press('b');
  });
  for (const d of RAIDS) step('raid ' + d.id, () => {
    fresh('chaplain', 'hearthkin', 'acolyte', d.lvl + 30); enterInstance('raid', d, 1, 12); run(20);
    const p = G.inst && G.inst.map.pulls[0]; if (p) { fightPull(p); run(5); const r = autoFight(60000); if (r) return r; }
  });
  for (const f of [1, 5, 10, 50, 100]) step('tower floor ' + f, () => {
    fresh('berserker', 'tuskborn', 'soldier', Math.min(720, f * 7 + 10)); enterInstance('tower', { id: 'tower', name: TOWER.name, lvl: TOWER.baseLvl, theme: 'void' }, f, 4); run(20);
    const p = G.inst && G.inst.map.pulls[0]; if (p) { fightPull(p); run(5); autoFight(60000); }
  });
  for (const t of TRIALS) step('trial ' + t.id, () => {
    fresh('shade', 'wispling', 'urchin', t.lvl + 5); enterInstance('trial', t, 1, 4); run(20);
    const p = G.inst && G.inst.map.pulls[0]; if (p) { fightPull(p); run(5); autoFight(60000); }
  });

  // 7. render modes
  fresh('cantor', 'twinblood', 'envoy', 12);
  for (const pal of PAL_ORDER) for (const video of ['gb', 'hd64']) for (const tiles of ['pixel', 'painted']) for (const art of ['nes', 'classic'])
    step(`render ${pal}/${video}/${tiles}/${art}`, () => {
      S.palette = pal; UI = PALS[pal]; S.video = video; S.tiles = tiles; S.art = art; applyArt(); clearCaches();
      reset(new Field()); run(3); startBattle(rollEncounter(ZONE_BY_ID[G.map])); run(30); render();
      scenes.length = 0; reset(new Field()); render();
    });
  S.palette = 'gbc'; UI = PALS.gbc; S.video = 'gb'; S.tiles = 'pixel'; S.art = 'nes'; applyArt(); clearCaches();

  // 8. save / load round trip, every slot
  for (const slot of [0, 1, 2]) step('save/load slot ' + slot, () => {
    fresh('verdant', 'burrowkin', 'wanderer', 25); G.slot = slot; G.gold = 4321; saveGame();
    const name = G.name; G = null; if (!loadSlot(slot)) return 'load failed';
    if (G.gold !== 4321 || G.name !== name) return 'mismatch ' + G.gold;
    enterWorld(); run(10);
  });

  // 9. audio engines
  for (const eng of ['chip', 'hd64']) step('audio ' + eng, () => {
    S.audio = eng; audioCtx(); for (const k of SFX_NAMES) SFX[k](); if (eng === 'hd64') for (const k of SFX64_ONLY) SFX[k]();
    for (const t of Object.keys(TRACKS)) { Music.cur = null; Music.play(t); for (let i = 0; i < 4; i++) Music.tick(); }
    Music.stop();
  });
  S.audio = 'chip';

  // 10. settings screen + sound test with input
  step('settings', () => { reset(new Field()); push(new SettingsScene()); for (let i = 0; i < 20; i++) { press('down'); press('right'); press('left'); render(); } press('b'); });
  step('profession perks', () => {
    fresh('warden', 'hearthkin', 'soldier', 1);
    if (Object.keys(PROFS).length !== 18) return 'profession count ' + Object.keys(PROFS).length;
    for (const r of RECIPES) { if (!PROFS[r.prof] || !ITEMS[r.makes] || Object.keys(r.needs).some(k => !ITEMS[k])) return 'bad recipe ' + r.id; }
    for (const k of Object.keys(PROFS)) { if (!PROFESSION_TREES[k] || !PROFESSION_QUESTS[k]) return 'missing data ' + k; if (PERK_TREES[k].length !== 4 || PERK_TREES[k].some(r => r.length !== 6)) return 'bad tree ' + k; }
    G.prof.herb = 1; if (perkPoints('herb') !== 1) return 'points at 1';
    if (!learnPerk('herb', 't1_0')) return 'tier gate missing';
    if (learnPerk('herb', 't0_0')) return 'tier 1 failed';
    G.prof.herb = 720; if (perkPoints('herb') !== 21) return 'points at 720';
    for (const id of ['t1_0', 't2_0', 't3_0', 't3_1', 't3_2', 't2_1']) learnPerk('herb', id);
    if (perkSpent('herb') > 21) return 'overspent ' + perkSpent('herb');
    if (!(perkVal('herb', 'double') > 0)) return 'no double value';
    push(new PerkTreeScene('herb')); for (const b of ['right', 'down', 'a', 'right', 'down', 'a', 'select', 'a', 'start', 'start']) { press(b); render(); }
    G.gold = 99999; const before = perkSpent('herb'); resetPerks('herb'); if (perkSpent('herb') !== 0 || before === 0) return 'reset failed';
    const z = ZONES.find(z => !z.town); G.map = z.id; for (let i = 0; i < 5; i++) gatherProfessionNode({ profession: 'herb', item: 'peacebloom', i: 0 });
    const r = RECIPES.find(r => r.skill <= 1); if (r) { for (const k in r.needs) addItem(k, 20); G.profPerks[r.prof] = []; G.prof[r.prof] = 720; for (const id of ['t0_0', 't1_0', 't2_0', 't3_0']) learnPerk(r.prof, id); craft(r); }
    render();
  });
  step('companions', () => {
    fresh('warden', 'hearthkin', 'soldier', 1); G.lvl = 40; G.gold = 99999; G.companions = []; G.bench = [];
    let n = 0; for (const d of COMPANION_DEFS) { const e = recruitCompanion(d.id); if (e) return d.id + ': ' + e; n++; }
    if (allCompanions().length !== n) return 'roster size';
    if (G.companions.length > companionMax()) return 'party over cap';
    if (!recruitCompanion(COMPANION_DEFS[0].id)) return 'duplicate recruit allowed';
    const c = G.companions[0]; c.affinity = 0; applyBond(c);
    const up = addAffinity(c, 50); if (!up || bondTier(c).name !== 'FRIEND') return 'bond tier';
    if (!(derive(c).hpMax > 0)) return 'derive with bond';
    const b = G.bench[0]; if (b) { benchCompanion(c); if (joinCompanion(b)) return 'join failed'; }
    for (const st of STANCES) { G.companions.forEach(x => x.stance = st); reset(new Field()); run(2); startBattle(rollEncounter(ZONE_BY_ID[G.map])); if (!waitBattle()) return 'no battle ' + st; const ab = S.autoBattle; S.autoBattle = true; for (let i = 0; i < 8000 && scenes.some(s => s instanceof Battle); i++) { tick(); if (i % 30 === 0) press('a'); } S.autoBattle = ab; if (scenes.some(s => s instanceof Battle)) return 'battle stuck ' + st; G.hp = derive(G).hpMax; }
    push(new CompanionScene()); for (const k of ['down', 'down', 'up']) { press(k); render(); }
    talkTo(G.companions[0]); addItem('ration', 2); giveGift(G.companions[0], 'ration');
    render();
  });
  step('gear tiers', () => {
    fresh('warden', 'hearthkin', 'soldier', 1);
    if (ITEM_RANKS.length !== 23 || rankFor(1).n !== 1 || rankFor(720).n !== 23 || rankFor(100).n !== 11) return 'tier table';
    for (let i = 1; i < 23; i++) if (ITEM_RANKS[i].min <= ITEM_RANKS[i - 1].min) return 'tiers not ascending';
    const w = makeItem({ kind: 'weapon', lvl: 700 }), a = makeItem({ kind: 'armor', lvl: 700 });
    if (w.rank !== 23 || a.rank !== 23) return 'item rank ' + w.rank;
    const d0 = derive(G).weapon.dmg; G.bag.push(w); equipItem(G, w, G.bag); const d1 = derive(G).weapon.dmg;
    if (!(d1 >= d0)) return 'tier damage';
    if (tierAC(a) > 5) return 'ac uncapped';
    retierGear(); render();
  });
  for (const cls of ['warden', 'arcanist', 'chaplain', 'shade', 'necromancer']) step('combat arts ' + cls, () => {
    fresh(cls, 'hearthkin', 'soldier', 25);
    const L = artLoadout(G); if (!L.length) return 'no arts';
    if (L.length > ART_MAX) return 'loadout over max';
    for (const a of ARTS) if (!ART_GROUPS[a.g]) return 'bad group ' + a.id;
    const w = makeItem({ kind: 'weapon', lvl: 600 }); G.bag.push(w); equipItem(G, w, G.bag); const ar = makeItem({ kind: 'armor', lvl: 600 }); G.bag.push(ar); equipItem(G, ar, G.bag);
    if (!tierPowerText(w) || !tierPowerText(ar)) return 'tier text';
    reset(new Field()); run(2); startBattle(rollEncounter(ZONE_BY_ID[G.map])); if (!waitBattle()) return 'no battle';
    const bt = scenes.find(s => s instanceof Battle);
    const me = bt.party.find(u => u.ch === G), foe = bt.foes[0];
    for (const a of L) { const st = artUse(bt, me, a, foe); if (!Array.isArray(st) || !st.length) return 'art steps ' + a.id; }
    const ab = S.autoBattle; S.autoBattle = true; for (let i = 0; i < 9000 && scenes.some(s => s instanceof Battle); i++) { tick(); if (i % 30 === 0) press('a'); } S.autoBattle = ab;
    if (scenes.some(s => s instanceof Battle)) return 'battle stuck';
    push(new ArtsScene()); for (const k of ['down', 'a', 'a', 'up']) { press(k); render(); }
  });
  step('materials and blueprints', () => {
    fresh('warden', 'hearthkin', 'soldier', 30);
    if (MATERIALS.length !== 90) return 'materials ' + MATERIALS.length;
    for (const m of MATERIALS) { if (!ITEMS[m.id] || m.grade < 1 || m.grade > 9 || m.tier < 1 || m.tier > 23 || m.lvl < 1 || m.lvl > 720) return 'bad mat ' + m.id; }
    for (const p of Object.keys(CRAFT_PLAN)) { const rs = RECIPES.filter(r => r.prof === p && r.tier); if (rs.length !== 23) return 'tiers ' + p; if (rs[22].skill < 600) return 'top skill ' + p; }
    const top = gatherMaterial('mining', 720, 720); if (!top || top.tier !== 23) return 'top gather';
    if (gatherMaterial('mining', 720, 1).slot !== 0) return 'skill gate';
    const r = RECIPES.find(r => r.id === 't_weaponsmith_10'); G.prof.weaponsmith = 720; G.smithPath = 'weaponsmith'; G.lvl = 40; G.blueprints.push(r.id); for (const k in r.needs) addItem(k, 30);
    const n0 = G.bag.length; const msg = craft(r); if (!/^Forged/.test(msg)) return 'forge: ' + msg; if (G.bag.length !== n0 + 1) return 'no gear';
    const g = G.bag[G.bag.length - 1]; if (g.rank !== 10) return 'forged tier ' + g.rank;
    const a = RECIPES.find(r => r.id === 't_alch_5'); G.prof.alch = 720; G.blueprints.push(a.id); for (const k in a.needs) addItem(k, 30); if (!/^Made/.test(craft(a))) return 'alch';
    push(new CraftScene()); for (const k of ['right', 'down', 'a', 'left', 'select', 'right', 'down', 'a']) { press(k); render(); }
  });
  step('armoury', () => {
    fresh('arcanist', 'hearthkin', 'soldier', 20);
    if (Object.keys(WEAPON_CLASSES).length !== 14 || ['scythe', 'grimoire', 'wand'].some(f => Object.values(WEAPONS).filter(w => w.fam === f).length < 4) || ARMOR_CATEGORIES.length !== 7 || ACLASS_ORDER.length !== 4) return 'counts';
    for (const k in WEAPONS) if (!WEAPON_CLASSES[WEAPONS[k].fam]) return 'weapon without subclass ' + k;
    const plate = makeItem({ kind: 'wondrous', base: 'gauntlets', lvl: 50, aclass: 'plate' }); if (!canEquip(G, plate)) return 'arcanist wore plate';
    const robe = makeItem({ kind: 'armor', base: 'silkrobe', lvl: 50 }); if (canEquip(G, robe)) return 'robe: ' + canEquip(G, robe);
    fresh('warden', 'hearthkin', 'soldier', 40);
    for (const [slot, base] of [['head', 'helm'], ['back', 'mantle'], ['hands', 'gauntlets'], ['waist', 'belt'], ['legs', 'greaves'], ['feet', null]]) {
      const w = WONDROUS.find(x => x.slot === slot && (!base || x.id === base)); if (!w) continue; const it = makeItem({ kind: 'wondrous', base: w.id, lvl: 60, aclass: 'plate' }); G.bag.push(it); const e = equipItem(G, it, G.bag); if (e) return slot + ': ' + e; }
    const ch = makeItem({ kind: 'armor', base: 'fullplate', lvl: 60 }); G.bag.push(ch); equipItem(G, ch, G.bag);
    const n = armorSetCounts(G); if (n.plate < 6) return 'plate count ' + n.plate;
    if (!armorSetBonus(G).length) return 'no set bonus';
    push(new ArmoryScene()); for (const k of ['down', 'down', 'right', 'down', 'up']) { press(k); render(); }
  });
  step('trading hub + direct trade', () => {
    fresh('warden', 'hearthkin', 'soldier', 10); G.gold = 100000;
    const wasOff = NET.offline; NET.offline = true;
    if (Market.mode() !== 'local') return 'mode ' + Market.mode();
    const L = Market.npcList(); if (L.length < 20) return 'npc listings';
    const it = makeItem({ kind: 'weapon', lvl: 10 }); G.bag.push(it);
    let err = null; Market.post({ item: it }, it.value * 3).then(e => err = e); if (G.ah.length !== 1) return 'post failed';
    addItem('iron_ore', 10); Market.post({ stack: { id: 'iron_ore', n: 10 } }, 500); if ((G.inv.iron_ore || 0) !== 0) return 'stack not removed';
    const g0 = G.gold; Market.buy(L[0]).then(e => err = e); if (G.gold >= g0) return 'buy did not charge';
    Market.cancel(G.ah[0]); G.stats.steps += 2000; Market.settleLocal();
    push(new MarketScene()); for (const k of ['right', 'down', 'select', 'down', 'select', 'select', 'a']) { press(k); render(); }
    // direct trade with a fake partner
    const sent = []; const room0 = NET.room; NET.room = { emit: (t, d) => { sent.push(d); return Promise.resolve(); }, on: () => {}, peers: () => [] };
    Trade.myPeer = 'me'; Trade.peerId = () => 'me';
    Trade.invite('p2', 'FRIEND'); const give = makeItem({ kind: 'armor', lvl: 5 }); G.bag.push(give); Trade.me.items.push(give); Trade.me.gold = 50; Trade.sync();
    const theirs = slimItem(makeItem({ kind: 'weapon', lvl: 30 }));
    Trade.onMsg({ peer: 'p2', data: { to: 'me', kind: 'offer', offer: { gold: 500, items: [theirs], stacks: [{ id: 'peacebloom', n: 3 }] } } });
    Trade.myLock = true; Trade.onMsg({ peer: 'p2', data: { to: 'me', kind: 'lock' } }); Trade.myOk = true;
    const gb = G.gold; Trade.onMsg({ peer: 'p2', data: { to: 'me', kind: 'confirm' } });
    if (G.gold !== gb - 50 + 500) return 'trade gold ' + (G.gold - gb);
    if (G.bag.includes(give)) return 'gave item still in bag';
    if (!G.bag.some(x => x.base === theirs.base && x.ilvl === theirs.ilvl)) return 'received item missing';
    if (cleanItem({ kind: 'weapon', base: 'nope' })) return 'bad item accepted';
    NET.room = room0; NET.offline = wasOff; render();
  });
  step('settlement trainers', () => {
    fresh('warden', 'hearthkin', 'soldier', 25); G.gold = 99999;
    let total = 0, kinds = {};
    for (const z of ZONES) { const st = settlementOf(z); if (!st) continue; G.map = z.id; G.x = 16; G.y = 12; reset(new Field()); run(1); const f = scenes.find(s => s instanceof Field); const tr = f.entities().filter(e => ['proftrainer', 'craftmaster', 'curator'].includes(e.svc)); kinds[st.kind] = (kinds[st.kind] || 0) + 1; total += tr.length;
      for (const t of tr) { if (!f.tileAt(t.x, t.y)[1]) return 'trainer on wall ' + z.id; }
      if (st.kind === 'CITY') { const ps = new Set(tr.map(t => t.prof)); for (const p of Object.keys(PROFS)) if (!['fish', 'cook'].includes(p) && !ps.has(p)) return 'city missing ' + p; }
      for (const t of tr.slice(0, 3)) { npcService(t); for (let i = 0; i < 4; i++) { press('a'); render(); } press('b'); press('b'); } }
    if (!kinds.CITY || !kinds.TOWN || !kinds.VILLAGE) return 'kinds ' + JSON.stringify(kinds);
    if (total < 60) return 'only ' + total + ' trainers';
    // smith path + starter quest
    G.lvl = 25; G.prof.blacksmith = 40; G.smithPath = null;
    const r = RECIPES.find(x => x.id === 't_armorsmith_2'); G.blueprints.push(r.id); for (const k in r.needs) addItem(k, 40); G.prof.armorsmith = 100;
    if (!/smith path/i.test(craft(r))) return 'path gate missing';
    G.smithPath = 'armorsmith'; if (!/^Forged/.test(craft(r))) return 'path craft failed';
    G.smithPath = 'weaponsmith'; if (/^Forged/.test(craft(r))) return 'wrong path crafted';
    const s = starterState('herb'); s.accepted = true; progressProfessionQuest('herb', 'gather', 8); if (s.progress !== 8) return 'starter progress ' + s.progress;
    const g0 = G.gold; starterQuestTalk('herb'); if (!s.done || G.gold <= g0) return 'starter claim';
    return null;
  });
  step('mounts', () => {
    fresh('warden', 'hearthkin', 'soldier', 14); G.gold = 999999; G.mounts = []; G.hasMount = false;
    if (MOUNTS.length !== 120 || new Set(MOUNTS.map(m => m.family)).size !== 12) return 'catalogue';
    for (const m of MOUNTS) if (!IMG['mt_' + m.id]) return 'no art ' + m.id;
    stableMenu(); press('a'); press('a'); if (G.mounts.length) return 'mount before 15';
    scenes.length = 0; reset(new Field()); G.lvl = 15; stableMenu(); press('a'); for (let i = 0; i < 6; i++) { press('a'); render(); }
    if (G.mounts.length !== 1 || !G.hasMount) return 'first mount ' + G.mounts.length;
    if (mountSpeed() !== 4) return 'speed';
    G.lvl = 200; grantMount('drake_crimson'); G.mount = 'drake_crimson'; if (mountSpeed() !== 8 || mountArt() !== 'mt_drake_crimson') return 'drake';
    push(new MountScene()); for (const k of ['down', 'right', 'a', 'left', 'up', 'a']) { press(k); render(); }
    G.mounted = true; reset(new Field()); run(4); render();
  });
  step('soundtest', () => { push(new SoundTest()); press('a'); press('select'); press('a'); press('start'); press('down', 5); render(); press('b'); });

  // 11. atlas
  step('atlas', () => { openAtlas(); const ok = !!document.getElementById('atlasOverlay'); closeAtlas(); return ok ? null : 'no overlay'; });

  // 12. ghost / wipe
  step('party wipe', () => { fresh('arcanist', 'wispling', 'scholar', 1); startBattle(rollEncounter(ZONE_BY_ID[G.map])); if (!waitBattle()) return 'no battle'; const b = scenes.find(s => s instanceof Battle); b.party.forEach(u => { if (u.ch) u.ch.hp = 0; }); b.checkEnd(); for (let i = 0; i < 3000 && scenes.some(s => s instanceof Battle); i++) { tick(); if (i % 40 === 0) { bDown('a'); tick(); bUp('a'); } } run(60); if (!G.ghost) return 'no ghost state'; G.ghost = false; G.hp = derive(G).hpMax; });

  // 13. monkey: random input for 6000 ticks per seed, from the field, across whatever scenes it reaches
  for (const seed of [1, 2, 3, 4, 5, 6]) step('monkey ' + seed, () => {
    fresh(CLASS_ORDER[seed * 2 % 12], SPEC[seed % SPEC.length], BGS[seed % BGS.length], [1, 8, 30, 90, 250, 600][seed - 1]);
    const r = RNG('monkey' + seed), seen = new Set();
    const BT = ['up', 'down', 'left', 'right', 'a', 'a', 'b', 'start', 'select', 'up', 'right', 'down', 'left'];
    for (let t = 0; t < 6000; t++) {
      const b = r.pick(BT); bDown(b); tick(); if (r() < 0.6) bUp(b); tick(); BTNS.forEach(bUp);
      if (t % 25 === 0) render();
      seen.add(top());
      if (topScene() instanceof Title || topScene() instanceof SlotPicker || topScene() instanceof Boot) enterWorld();
      if (G.ghost && t % 500 === 0) { G.ghost = false; G.hp = derive(G).hpMax; }
    }
    return 'visited ' + [...seen].join(',');
  });
  window.text = text = _text; return { fails, notes, stats, losses, bad: Object.keys(bad), secs: ((performance.now() - t0) / 1000).toFixed(1) };
}
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': 520, 'height': 900})).new_page()
        loop_errs = []
        pg.on('pageerror', lambda e: loop_errs.append(str(e).split('\n')[0]))
        await pg.goto('file://' + os.path.abspath(PAGE)); await pg.wait_for_timeout(2500)
        await pg.evaluate("() => { window.__errs = []; addEventListener('error', e => __errs.push(String(e.message))); }")
        pg.set_default_timeout(0)
        res = await pg.evaluate(SWEEP)
        print(f"sweep finished in {res['secs']} s; battles {res['stats']}")
        for f in res['fails']: print('FAIL', f['step'], '::', f['err'])
        for n in res['notes']: print('NOTE', n)
        for l in res['losses']: print('LOSS', l)
        for t in res['bad']: print('TEXT', t)
        uniq = sorted(set(loop_errs))
        for e in uniq: print('LOOP', e)
        print(f"{len(res['fails'])} failures, {len(res['notes'])} notes, {len(uniq)} loop errors")
        await b.close()
        sys.exit(1 if res['fails'] or uniq or res['bad'] else 0)

asyncio.run(main())
