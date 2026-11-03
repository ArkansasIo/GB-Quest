#!/usr/bin/env node
// Export the browser game's data, maps and art for the Godot / Summer Engine port in summer-prototype/.
//   node tools/build.cjs && node tools/export_godot.cjs
// Writes:
//   summer-prototype/data/game.json        every rules table (classes, races, spells, buffs, items, monsters, aspects, ...)
//   summer-prototype/data/zones.json       every zone and town map: tile rows, sprite per tile, exits, NPCs, points of interest
//   summer-prototype/data/sprites.json     sprite name -> [file, x, y, w, h] in the 4x HD art (atlases, or a single PNG)
//   summer-prototype/art/                  the 4x atlases from assets_hd64 plus 4x copies of sprites that have no atlas
// The browser game stays the source of truth: re-run this after changing it. art/ is generated (git-ignored).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'summer-prototype');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'art'), { recursive: true });
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.goto('file://' + path.join(ROOT, 'dist', 'gbquest.html'));
  await page.waitForFunction(() => typeof IMG !== 'undefined' && IMG.gh_warden_down0 && typeof applyPackArt === 'function', null, { timeout: 60000 });
  const dump = await page.evaluate(() => {
    const plain = v => JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'function' ? undefined : x instanceof Set ? [...x] : x));
    S.art = 'packs'; applyPackArt(); applyArt();
    const alias = (typeof PACK_INDEX !== 'undefined' && PACK_INDEX.alias) || {};
    const art = n => alias[n] || n;
    G = newGameState({ slot: 0, name: 'EXPORT', cls: 'warden', species: 'hearthkin', bg: Object.keys(BACKGROUNDS)[0] }); G.lvl = 20;
    const data = {
      version: 1, exported: new Date().toISOString(),
      CLASSES, CLASS_ORDER, SPECIES, BACKGROUNDS, SPELLS, SCHOOLS, BUFFS, CONDITIONS: typeof CONDITIONS !== 'undefined' ? CONDITIONS : {}, RARITY, SUBSTATS, WEAPONS, ARMORS,
      WONDROUS: typeof WONDROUS !== 'undefined' ? WONDROUS : [], ITEMS, REGIONS, BIOMES, DUNGEONS, RAIDS, TRIALS, MOUNTS: typeof MOUNTS !== 'undefined' ? MOUNTS : [],
      JOB_ABILITIES: typeof JOB_ABILITIES !== 'undefined' ? JOB_ABILITIES : {}, ASPECT_SPECS: typeof ASPECT_SPECS !== 'undefined' ? ASPECT_SPECS : {},
      FULL_SLOTS, PACT_SLOTS, SPELL_UNLOCK: typeof SPELL_UNLOCK !== 'undefined' ? SPELL_UNLOCK : [], LEVEL_CAP, CLASS_LEVEL_CAP, FEATURE_NAME,
      XP: Array.from({ length: LEVEL_CAP + 1 }, (_, l) => l ? xpForLevel(l) : 0),
      // monster stat blocks by level, from the game's own formula (normal profile), and each bestiary entry with its art
      MONSTER_LEVELS: Array.from({ length: 121 }, (_, i) => { const L = i ? i * 6 : 1; const m = makeMonster(BESTIARY.find(b => b.role === 'brute') || BESTIARY[0], L, 2); return { lvl: L, hp: m.maxhp, ac: m.ac, hit: m.hit, dc: m.dc, dice: m.attacks[0].dice, xp: m.xp, gold: m.gold }; }),
      BESTIARY: BESTIARY.map(b => ({ id: b.id, fam: b.fam, sub: b.sub, name: b.name, role: b.role, rank: b.rank, dt: b.dt, art: monsterArt(b) })),
      BOSSES: BOSSES.map(b => ({ id: b.id, name: b.name, cat: b.cat, fam: b.fam, lvl: b.lvl, zone: b.zone, art: monsterArt(b) })),
      HEROES: Object.fromEntries(CLASS_ORDER.map(c => [c, { walk: ['down', 'up', 'side'].flatMap(d => [0, 1].map(f => `gh_${c}_${d}${f}`)), battle: `c_${c}_4`, portrait: `np_class_${c}` }])),
      RACE_PORTRAITS: Object.fromEntries(Object.keys(SPECIES).map(s => [s, `np_race_${s}_0`])),
      // story, loot rolls, support jobs and crafting (stage 4 of the port)
      CHAPTERS, ACTS, CHAPTER_REWARDS: CHAPTERS.map((c, i) => { const reg = REGIONS.find(r => r.id === ACTS[c[0] - 1].zone); return { xp: Math.round(xpForMonster(reg.lvl[1]) * 6), gold: 20 + reg.lvl[1] * 10 }; }),
      ARC_BOSSES: BOSSES.filter(b => b.cat === 'arc').map(b => ({ id: b.id, name: b.name, act: b.act, lvl: b.lvl, fam: b.fam, art: monsterArt(b) })),
      AFFIX_POOL, AFFIX_K, GREATER_CHANCE, GREATER_MULT,
      ASPECT_TEXT: Object.fromEntries(Object.entries(ASPECT_SPECS).map(([id, A]) => [id, A.e.t === 'stat' ? null : aspectText(A.e, '{v}')])),
      ASP_STAT, SUPPORT_TRAITS, SUPPORT_CAPS, SUPPORT_UNLOCK, RECIPES, HERB_BY_BIOME,
      // stage 5: accessories, gems, temper/masterwork, raids, trials, world bosses
      // stage 7: talents, companions, guilds and conquest, arena, tower, difficulty
      TALENT_TREES, COMPANION_DEFS, BOND_TIERS, GUILD_MAX_LEVEL, GUILD_PERKS, GUILD_WEIGHTS, GUILD_NAMES, SIM_NAMES, DIFFICULTY,
      AI_GUILDS: typeof AI_GUILDS !== 'undefined' ? AI_GUILDS : [], CASTLE_BUFF: typeof CASTLE_BUFF !== 'undefined' ? CASTLE_BUFF : [], CASTLE_NEEDS: typeof CASTLE_NEEDS !== 'undefined' ? CASTLE_NEEDS : 3,
      CHALLENGE_WAVES: typeof challengeWaves === 'function' ? Object.fromEntries(['stone', 'castle', 'defend', 'castle_defend'].map(k => [k, challengeWaves(k)])) : {},
      TOWER_BOSSES: BOSSES.filter(b => b.cat === 'tower').map(b => ({ id: b.id, name: b.name, lvl: b.lvl, fam: b.fam, art: monsterArt(b) })),
      // stage 10: audio (the chip engine's songs and SFX as note lists), the necromancer army
      SONGS: Object.fromEntries(Object.keys(TRACKS).filter(id => !TRACKS[id].jingle).map(id => [id, composeTrack(id)])),
      JINGLES: Object.fromEntries(Object.entries(JINGLES).map(([id, ms]) => [id, ms.map((m, i) => ['s', m ? N(m) : 0, m ? N(m) : 0, 0.16, m ? 0.05 : 0.0001, i * 0.13])])),
      SFX_BANK, MUSIC_BY_BIOME: typeof MUSIC_BY_BIOME !== 'undefined' ? MUSIC_BY_BIOME : {},
      ARMY_ORDER: typeof ARMY_ORDER !== 'undefined' ? ARMY_ORDER : [], ARMY_VARIANTS: typeof ARMY_VARIANTS !== 'undefined' ? ARMY_VARIANTS : {},
      DEFAULT_BOOK: typeof DEFAULT_BOOK !== 'undefined' ? DEFAULT_BOOK : {},
      SACRIFICE: typeof SACRIFICE !== 'undefined' ? Object.fromEntries(Object.entries(SACRIFICE).map(([k, f]) => [k, f(1)])) : {},
      SIDE_TEMPLATES, BOUNTY_TYPES: typeof BOUNTY_TYPES !== 'undefined' ? BOUNTY_TYPES : [],
      SLOTS, GEM_TYPES, GEM_DROP, GEM_TIER_MAX, GEM_SOCKET_LIMIT, GEM_ART: typeof AP_GEM_ART !== 'undefined' ? AP_GEM_ART : {},
      TEMPER_POOLS, TEMPER_BASE, TEMPER_MAX, MW_MAX, MW_STEP, MW_CRIT,
      RAID_BOSSES: BOSSES.filter(b => b.cat === 'raid').map(b => ({ id: b.id, name: b.name, lvl: b.lvl, fam: b.fam, art: monsterArt(b) })),
      TRIAL_BOSSES: BOSSES.filter(b => b.cat === 'trial').map(b => ({ id: b.id, name: b.name, lvl: b.lvl, fam: b.fam, art: monsterArt(b) })),
      WORLD_BOSSES: BOSSES.filter(b => b.cat === 'world').map(b => ({ id: b.id, name: b.name, lvl: b.lvl, fam: b.fam, where: b.where, art: monsterArt(b) })),
    };
    const zones = {};
    const f = new Field();
    for (const z of ZONES) {
      G.map = z.id; G.inst = null; let m;
      try { m = buildZoneCached(z.id); f.m = m; f.zone = z; } catch (e) { continue; }
      let ents = []; try { ents = f.entities(); } catch (e) { ents = []; }
      zones[z.id] = { id: z.id, name: z.name, region: z.region, town: !!z.town, biome: z.biome || m.biome, lvl: z.lvl, music: m.music, rows: m.rows,
        gfx: m.gfx ? m.gfx.map(r => r.map(n => art(String(n).replace('%f', '0')))) : null, walk: m.rows.map(r => [...r].map(ch => (m.tiles[ch] ? m.tiles[ch][1] : 0) ? 1 : 0).join('')),
        exits: m.exits, poi: m.poi, hub: m.hub, nodes: m.nodes || [], bosses: (m.bosses || []).filter(b => !b.arc),
        npcs: ents.filter(e => e.kind === 'npc').map(e => ({ x: e.x0 != null ? e.x0 : e.x, y: e.y0 != null ? e.y0 : e.y, name: e.name, svc: e.svc || null, role: typeof npcRole === 'function' ? npcRole(e) : null, sprite: typeof npcRole === 'function' && IMG[`gh_npc_${npcRole(e)}_down0`] ? `gh_npc_${npcRole(e)}` : null })),
        waypoint: m.poi && m.poi.waypoint || null };
    }
    return { data: plain(data), zones, names: Object.keys(IMG) };
  });
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'data', 'game.json'), JSON.stringify(dump.data));
  fs.writeFileSync(path.join(OUT, 'data', 'zones.json'), JSON.stringify(dump.zones));
  // ---- art: HD atlases, plus 4x nearest copies for sprites the atlases lack
  const HD = path.join(ROOT, 'assets_hd64'), sprites = {};
  for (const f of fs.readdirSync(HD)) {
    if (f.endsWith('.png') && f !== 'preview.png') fs.copyFileSync(path.join(HD, f), path.join(OUT, 'art', f));
    if (f.endsWith('.json')) { const fam = f.slice(0, -5), idx = JSON.parse(fs.readFileSync(path.join(HD, f))); for (const [n, [pg, x, y, w, h]] of Object.entries(idx)) sprites[n] = [`${fam}_${pg}.png`, x, y, w, h]; }
  }
  const missing = fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.png') && !sprites[f.slice(0, -4)]);
  fs.mkdirSync(path.join(OUT, 'art', 'single'), { recursive: true });
  const { execFileSync } = require('child_process');
  const list = path.join(OUT, 'art', 'single', '_list.txt'); fs.writeFileSync(list, missing.join('\n'));
  execFileSync('python3', ['-c', `
import sys, os
from PIL import Image
src, dst, lst = sys.argv[1], sys.argv[2], sys.argv[3]
for n in open(lst).read().split('\\n'):
    if not n: continue
    im = Image.open(os.path.join(src, n)).convert('RGBA'); im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(dst, n))
`, path.join(ROOT, 'assets'), path.join(OUT, 'art', 'single'), list]);
  fs.unlinkSync(list);
  const { imageSize } = { imageSize: f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; } };
  for (const f of missing) { const [w, h] = imageSize(path.join(OUT, 'art', 'single', f)); sprites[f.slice(0, -4)] = [`single/${f}`, 0, 0, w, h]; }
  // ---- the HD64 6,000 asset pack (tools/gen_pack6000_hd.py): generated if missing, packed into 1024x1024 atlases
  const PACK = path.join(ROOT, 'assets_hd64', 'gbq_6000');
  if (!fs.existsSync(path.join(PACK, 'metadata', 'asset_manifest.json'))) {
    try { execFileSync('python3', [path.join(ROOT, 'tools', 'gen_pack6000_hd.py'), '--output', PACK], { stdio: 'inherit' }); }
    catch (e) { console.warn('HD64 pack not generated (needs: pip install numpy pillow):', e.message); }
  }
  if (fs.existsSync(path.join(PACK, 'metadata', 'asset_manifest.json'))) {
    const rows = JSON.parse(fs.readFileSync(path.join(PACK, 'metadata', 'asset_manifest.json')));
    const listFile = path.join(OUT, 'art', '_hd6000.json');
    fs.writeFileSync(listFile, JSON.stringify(rows.map(r => path.join(PACK, r.path))));
    execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
files, out = json.load(open(sys.argv[1])), sys.argv[2]
per = 256
for p in range(0, len(files), per):
    sheet = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    for j, f in enumerate(files[p:p + per]):
        sheet.paste(Image.open(f).convert('RGBA'), ((j % 16) * 64, (j // 16) * 64))
    sheet.save(f'{out}/hd6000_{p // per}.png')
`, listFile, path.join(OUT, 'art')]);
    fs.unlinkSync(listFile);
    const pack = { categories: {}, families: {}, boss_families: {} };
    rows.forEach((r, k) => {
      const name = `hd_${r.category}_${String(r.category_index).padStart(4, '0')}`;
      sprites[name] = [`hd6000_${Math.floor(k / 256)}.png`, (k % 256 % 16) * 64, Math.floor(k % 256 / 16) * 64, 64, 64];
      (pack.categories[r.category] ||= []).push(name);
      if (r.family) ((r.category === 'monsters_creatures' ? pack.families : pack.boss_families)[r.family] ||= []).push(name);
    });
    fs.writeFileSync(path.join(OUT, 'data', 'pack6000.json'), JSON.stringify(pack));
    console.log(`packed ${rows.length} HD64 pack assets into ${Math.ceil(rows.length / 256)} atlases`);
  }
  fs.writeFileSync(path.join(OUT, 'data', 'sprites.json'), JSON.stringify(sprites));
  // ---- audio: render the chip engine (src/engine.js play / Music.tick) to looping WAVs, as the browser would play them
  renderAudio(dump.data, path.join(OUT, 'audio'));
  console.log(`exported ${Object.keys(dump.data).length} tables, ${Object.keys(dump.zones).length} zones, ${Object.keys(sprites).length} sprites (${missing.length} single)`);
})().catch(e => { console.error(e); process.exit(1); });

// A small offline version of the browser's 4-channel chip synth: notes are [wave, f0, f1, dur, vol, delay];
// waves s/p/q are 50/25/12.5% pulses, t triangle, w saw, n the 15-bit LFSR noise played at rate f0/1000.
function renderAudio(data, dir) {
  const RATE = 22050;
  fs.mkdirSync(dir, { recursive: true });
  let lfsr = 0x7fff; const noise = new Float32Array(RATE);
  for (let i = 0; i < RATE; i++) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); noise[i] = (lfsr & 1) ? 0.6 : -0.6; }
  const osc = (wv, ph) => { const x = ph - Math.floor(ph);
    if (wv === 't') return 1 - 4 * Math.abs(x - 0.5); if (wv === 'w') return 2 * x - 1;
    const duty = wv === 'p' ? 0.25 : wv === 'q' ? 0.125 : 0.5; return x < duty ? 1 : -1; };
  const mix = (buf, notes, loop) => {
    for (const [wv, f0, f1, dur, vol, del = 0] of notes) {
      if (!vol || vol < 0.001) continue;
      const start = Math.round(del * RATE), n = Math.round((dur + 0.02) * RATE); let ph = 0;
      for (let k = 0; k < n; k++) {
        const u = Math.min(1, k / (dur * RATE)), g = vol * Math.pow(0.0001 / vol, u);
        const f = f1 === f0 ? f0 : (wv === 'n' ? f0 + (f1 - f0) * u : f0 * Math.pow(f1 / f0, u));
        let v;
        if (wv === 'n') { ph += Math.max(0.05, f / 1000); v = noise[Math.floor(ph) % RATE]; }
        else { ph += Math.max(20, f) / RATE; v = osc(wv, ph); }
        let at = start + k; if (loop) at %= buf.length; else if (at >= buf.length) break;
        buf[at] += v * g;
      }
    }
  };
  const wav = (file, buf, peak) => {
    let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x)); const k = m ? peak / m : 0;
    const b = Buffer.alloc(44 + buf.length * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + buf.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(buf.length * 2, 40);
    for (let i = 0; i < buf.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(buf[i] * k * 32767))), 44 + i * 2);
    fs.writeFileSync(path.join(dir, file), b);
  };
  let n = 0;
  for (const [id, s] of Object.entries(data.SONGS)) {
    const dt = 60 / s.bpm / 2, steps = s.lead.length, buf = new Float32Array(Math.round(steps * dt * RATE)), notes = [];
    for (let i = 0; i < steps; i++) {
      const d = i * dt, N = m => 440 * Math.pow(2, (m - 69) / 12);
      if (s.lead[i]) notes.push(['p', N(s.lead[i]), N(s.lead[i]), dt * 0.85, 0.022, d]);
      if (s.harm[i]) notes.push(['q', N(s.harm[i]), N(s.harm[i]), dt * 3, 0.012, d]);
      if (s.bass[i]) notes.push(['t', N(s.bass[i]), N(s.bass[i]), dt * 1.4, 0.05, d]);
      const dc = s.drums[i % (s.drums.length || 1)];
      if (dc === 'k') notes.push(['n', 300, 80, 0.08, 0.05, d]); else if (dc === 's') notes.push(['n', 2500, 1500, 0.08, 0.035, d]); else if (dc === 'h') notes.push(['n', 8000, 8000, 0.02, 0.015, d]);
    }
    mix(buf, notes, true); wav(`music_${id}.wav`, buf, 0.45); n++;
  }
  const one = (file, notes, peak) => { let end = 0; for (const x of notes) end = Math.max(end, (x[5] || 0) + x[3] + 0.03); const buf = new Float32Array(Math.max(1, Math.round(end * RATE))); mix(buf, notes, false); wav(file, buf, peak); n++; };
  for (const [id, notes] of Object.entries(data.JINGLES)) one(`music_${id}.wav`, notes, 0.5);
  for (const [id, notes] of Object.entries(data.SFX_BANK)) if (Array.isArray(notes) && notes.length) one(`sfx_${id}.wav`, notes, 0.55);
  console.log(`rendered ${n} audio files`);
}
