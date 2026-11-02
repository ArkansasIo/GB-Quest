#!/usr/bin/env python3
"""Headless bug sweep for GB Quest.

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
  window.text = text = function (s, ...a) { const str = String(s); if (/undefined|NaN|\bnull\b|\[object/.test(str)) (bad[curStep + ' :: ' + str.slice(0, 40)] = 1); return _text(s, ...a); };
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
  for (let k = 0; k < 17; k++) step('menu item ' + k, () => {
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
