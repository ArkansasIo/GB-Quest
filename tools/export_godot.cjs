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
  fs.writeFileSync(path.join(OUT, 'data', 'sprites.json'), JSON.stringify(sprites));
  console.log(`exported ${Object.keys(dump.data).length} tables, ${Object.keys(dump.zones).length} zones, ${Object.keys(sprites).length} sprites (${missing.length} single)`);
})().catch(e => { console.error(e); process.exit(1); });
