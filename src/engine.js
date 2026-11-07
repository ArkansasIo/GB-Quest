// LOST KINGDOM OF SHADOWBANE CHRONICLES engine: 160x144 framebuffer, palettes (DMG / GBC / FULL), sprite pipeline,
// bitmap text, UI kit, input, 4-channel audio (100+ SFX, procedural music),
// scene stack, transitions, and a small physics + particle system.
'use strict';
const W = 160, H = 144, T = 16;
const LCD = document.getElementById('lcd'), lctx = LCD.getContext('2d');
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; // the 160x144 framebuffer; present() shows it on the LCD
const ctx = cv.getContext('2d', { willReadFrequently: true });
ctx.imageSmoothingEnabled = false;

// ================================================================ storage & settings
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const S = Object.assign({ netMode: 'online', audio: 'chip', video: 'hd64', tiles: 'pixel', vol: 3, music: 3, bright: 3, contrast: 3, palette: 'full', swap: false, textSpeed: 2, diceLog: true, weather: true, autoBattle: false, combatMode: 'turn-based', battleBg: 'scenes', citadelArt: true, fullscreen: false, fps: 60, hdRes: 'native' },
  store.get('gbq2_settings') || {});
const applySmoothArtDefaults = !S.smoothArtDefaultsApplied;
if (applySmoothArtDefaults) { S.video = 'hd64'; S.palette = 'full'; S.smoothArtDefaultsApplied = true; }
// The former 8K option was capped at 1080p and wasted memory. Keep saved users
// on the largest supported, real output size instead.
if (S.hdRes === '8k') S.hdRes = '4k';
if (!['native', '2k', '4k'].includes(S.hdRes)) S.hdRes = 'native';
S.displayMode = S.displayMode || (S.fullscreen ? 'borderless' : 'full-window');
if (S.displayMode === 'windowed' && !S.displayModeUserSet) S.displayMode = 'full-window';
function syncDisplayMode() {
  document.body.classList.toggle('full-window-mode', S.displayMode === 'full-window');
  document.body.classList.toggle('fullscreen-mode', S.displayMode === 'borderless' || S.displayMode === 'fullscreen');
  S.fullscreen = S.displayMode === 'fullscreen';
}
function applyDisplayMode(mode) {
  S.displayMode = mode; S.displayModeUserSet = true; syncDisplayMode(); saveSettings();
  if (mode === 'fullscreen' && !document.fullscreenElement) {
    const enter = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    if (!enter) { S.displayMode = 'borderless'; syncDisplayMode(); saveSettings(); return; }
    try { const result = enter.call(document.documentElement); if (result && result.catch) result.catch(() => { S.displayMode = 'borderless'; syncDisplayMode(); saveSettings(); }); }
    catch (e) { S.displayMode = 'borderless'; syncDisplayMode(); saveSettings(); }
  } else if (mode !== 'fullscreen' && (document.fullscreenElement || document.webkitFullscreenElement)) {
    const leave = document.exitFullscreen || document.webkitExitFullscreen; if (leave) try { leave.call(document); } catch (e) {}
  }
}
syncDisplayMode();
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && S.displayMode === 'fullscreen') { S.displayMode = 'borderless'; syncDisplayMode(); saveSettings(); }
});
function applyFilter() { LCD.style.filter = `brightness(${0.7 + S.bright * 0.1}) contrast(${0.7 + S.contrast * 0.1})`; }
function saveSettings() { store.set('gbq2_settings', S); applyFilter(); }
applyFilter();
if (applySmoothArtDefaults) saveSettings();

// ================================================================ palettes
// UI shades 0 (lightest) .. 3 (darkest) per palette mode; extra named colours for GBC/FULL
const PALS = {
  dmg: { ui: [[160, 168, 104], [112, 124, 72], [60, 76, 42], [22, 32, 18]], name: 'DMG GREEN' },
  gbc: { ui: [[248, 248, 232], [144, 184, 232], [48, 88, 168], [16, 24, 48]], name: 'GB COLOR' },
  full: { ui: [[236, 232, 214], [170, 164, 146], [86, 82, 96], [22, 20, 30]], name: 'FULL COLOR' },
  pocket: { ui: [[196, 207, 161], [139, 149, 109], [77, 83, 60], [31, 31, 31]], name: 'POCKET' },
  sunset: { ui: [[255, 224, 174], [238, 160, 105], [150, 75, 90], [48, 38, 70]], name: 'SUNSET' },
  amber: { ui: [[255, 239, 190], [224, 177, 90], [145, 95, 45], [55, 42, 28]], name: 'AMBER' },
  ocean: { ui: [[205, 235, 245], [112, 183, 207], [48, 111, 151], [22, 45, 82]], name: 'OCEAN' },
};
const PAL_ORDER = ['gbc', 'dmg', 'pocket', 'sunset', 'amber', 'ocean', 'full'];
const MONO = m => m === 'dmg' || m === 'pocket' || m === 'sunset' || m === 'amber' || m === 'ocean';
let UI = PALS[S.palette] || PALS.gbc;
const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
// extra colours (used in colour modes; DMG maps them to shades)
const XCOL = { red: [216, 40, 40], green: [40, 168, 64], blue: [40, 96, 216], purple: [150, 60, 200], orange: [232, 128, 24], gold: [232, 192, 40], grey: [140, 140, 140], hp: [56, 184, 72], mp: [56, 120, 232], xp: [200, 160, 40] };
function col(c) {
  if (typeof c === 'number') return css(UI.ui[c]);
  if (MONO(S.palette)) { const shade = { red: 2, green: 2, blue: 2, purple: 2, orange: 2, gold: 1, grey: 1, hp: 2, mp: 2, xp: 2 }[c]; return css(UI.ui[shade == null ? 3 : shade]); }
  if (XCOL[c]) return css(XCOL[c]);
  return c;
}
const rarityCol = r => (MONO(S.palette) || r <= 1) ? (r === 0 ? 1 : 3) : RARITY[r].color;

// ================================================================ assets
const IMG = {};
let ASSET_NAMES = [];
let HD64_INDEX = null, HD64_INDEX_PROMISE = null;
const HD64_ATLASES = new Map();
const HD64_REQUESTED = new Set();
function assetPackHiResName(name) {
  let m = /^ap_scene_(.+)$/.exec(name);
  if (m) return `ap_hi_scene_${m[1]}`;
  m = /^ap_(.+)$/.exec(name);
  if (m) return `ap_hi_${m[1]}`;
  m = /^au_scene_(.+)$/.exec(name);
  if (m) return `au_hi_scene_${m[1]}`;
  m = /^au_rframe_(\d+)$/.exec(name);
  if (m) return `au_hi_rarity_frames_${String(Number(m[1])).padStart(3, '0')}`;
  m = /^au_(.+)$/.exec(name);
  return m ? `au_hi_${m[1]}` : null;
}
async function hd64Index() {
  if (HD64_INDEX) return HD64_INDEX;
  if (!HD64_INDEX_PROMISE) HD64_INDEX_PROMISE = (async () => {
    let indexes = window.GBQ_HD64_INDEXES;
    if (!indexes) {
      const files = ['achievements', 'asset_pack', 'battle', 'buffs', 'class_sheets', 'conditions', 'creatures', 'dungeon_tiles', 'equipment', 'monsters', 'named_items', 'objects', 'passives', 'perk_icons', 'pixel_packs', 'portraits', 'ranks', 'rarity_gems', 'skills', 'slots', 'talents', 'tiles', 'titles', 'ui_kit', 'walkers'];
      indexes = Object.fromEntries(await Promise.all(files.map(async family => [family, await (await fetch(`assets_hd64/${family}.json`)).json()])));
    }
    HD64_INDEX = new Map();
    for (const [family, sprites] of Object.entries(indexes)) for (const [name, rect] of Object.entries(sprites || {})) HD64_INDEX.set(name, { family, rect });
    return HD64_INDEX;
  })().catch(error => { HD64_INDEX_PROMISE = null; console.warn('HD64 sprite indexes unavailable', error); return null; });
  return HD64_INDEX_PROMISE;
}
async function hd64Atlas(family, page) {
  const key = `${family}_${page}`;
  if (!HD64_ATLASES.has(key)) HD64_ATLASES.set(key, new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => { HD64_ATLASES.set(key, im); clearHd64AtlasCache(family, page); resolve(im); };
    im.onerror = () => { HD64_ATLASES.delete(key); reject(new Error(`HD64 atlas unavailable: ${key}`)); };
    im.src = window.GBQ_HD64_ATLASES && window.GBQ_HD64_ATLASES[key] || `assets_hd64/${key}.png`;
  }));
  return HD64_ATLASES.get(key);
}
function requestHd64Sprite(name) {
  if (S.video !== 'hd64' || HD64_REQUESTED.has(name)) return;
  HD64_REQUESTED.add(name);
  hd64Index().then(index => {
    const entry = index && index.get(name);
    if (entry) hd64Atlas(entry.family, entry.rect[0]).catch(() => {});
  });
}
function clearHd64AtlasCache(family, page) {
  if (!HD64_INDEX) return;
  const names = new Set();
  for (const [name, entry] of HD64_INDEX) if (entry.family === family && entry.rect[0] === page) names.add(name);
  for (const key of sprCache.keys()) {
    const name = key.slice(0, key.indexOf('|'));
    if (names.has(name)) sprCache.delete(key);
  }
}
async function loadCitadelAssets() {
  const catalogs = [
    ['races', 'assets_citadel/catalog.json', 'races'],
    ['classes', 'assets_citadel/catalog.json', 'classes'],
    ['creatures', 'assets_citadel/creature_catalog.json', 'entries'],
    ['bosses', 'assets_citadel/boss_catalog.json', 'entries'],
    ['environments', 'assets_citadel/environment_catalog.json', 'entries'],
    ['props', 'assets_citadel/prop_catalog.json', 'entries'],
    ['terrain', 'assets_citadel/terrain_catalog.json', 'entries'],
    ['buildings', 'assets_citadel/building_catalog.json', 'entries'],
    ['roads', 'assets_citadel/road_catalog.json', 'entries'],
    ['weapons', 'assets_citadel/weapons_catalog.json', 'entries'],
    ['armor', 'assets_citadel/armor_catalog.json', 'entries'],
    ['shields', 'assets_citadel/shields_catalog.json', 'entries'],
  ];
  const loadImage = (key, path) => new Promise(resolve => {
    const im = new Image();
    im.onload = () => { IMG[key] = im; resolve(true); };
    im.onerror = () => resolve(false);
    const embedded = window.GBQ_CITADEL_ASSETS && window.GBQ_CITADEL_ASSETS[path];
    im.src = embedded || path;
  });
  let loaded = 0;
  if (window.GBQ_CITADEL_ASSETS) {
    for (const [path] of Object.entries(window.GBQ_CITADEL_ASSETS)) {
      const parts = path.split('/');
      if (parts.length < 3 || parts[0] !== 'assets_citadel') continue;
      const category = parts[1], id = parts[parts.length - 1].replace(/\.svg$/i, '');
      const singular = ({ races: 'race', classes: 'class', creatures: 'creature', bosses: 'boss', environments: 'environment', props: 'prop', terrain: 'terrain', buildings: 'building', roads: 'road', weapons: 'weapon', armor: 'armor', shields: 'shield', ui: 'ui' })[category] || category;
      const key = `citadel_${singular}_${id}`;
      if (await loadImage(key, path)) loaded++;
    }
  } else {
    const docs = new Map();
    await Promise.all(catalogs.map(async ([kind, path, field]) => {
      try {
        if (!docs.has(path)) docs.set(path, await (await fetch(path)).json());
        const entries = docs.get(path)[field] || [];
        await Promise.all(entries.map(async entry => {
          const id = entry.id, src = entry.src;
          const key = `citadel_${kind === 'races' ? 'race' : kind === 'classes' ? 'class' : kind === 'creatures' ? 'creature' : kind === 'bosses' ? 'boss' : kind === 'props' ? 'prop' : kind === 'terrain' ? 'terrain' : kind === 'buildings' ? 'building' : kind === 'roads' ? 'road' : kind === 'weapons' ? 'weapon' : kind === 'armor' ? 'armor' : kind === 'shields' ? 'shield' : 'environment'}_${id}`;
          if (await loadImage(key, src)) loaded++;
        }));
      } catch (e) { console.warn('CITADEL asset catalog unavailable:', path, e); }
    }));
    for (const [key, path] of [['citadel_ui_crest','assets_citadel/ui/citadel_crest.svg'],['citadel_ui_ornaments','assets_citadel/ui/citadel_ornaments.svg']]) if (await loadImage(key,path)) loaded++;
  }
  window.GBQ_CITADEL_PROPS = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_prop_')).map(key => [key.slice('citadel_prop_'.length), IMG[key]]));
  window.GBQ_CITADEL_TERRAIN = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_terrain_')).map(key => [key.slice('citadel_terrain_'.length), IMG[key]]));
  window.GBQ_CITADEL_BUILDINGS = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_building_')).map(key => [key.slice('citadel_building_'.length), IMG[key]]));
  window.GBQ_CITADEL_ROADS = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_road_')).map(key => [key.slice('citadel_road_'.length), IMG[key]]));
  window.GBQ_CITADEL_WEAPONS = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_weapon_')).map(key => [key.slice('citadel_weapon_'.length), IMG[key]]));
  window.GBQ_CITADEL_ARMOR = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_armor_')).map(key => [key.slice('citadel_armor_'.length), IMG[key]]));
  window.GBQ_CITADEL_SHIELDS = Object.fromEntries(Object.keys(IMG).filter(key => key.startsWith('citadel_shield_')).map(key => [key.slice('citadel_shield_'.length), IMG[key]]));
  window.GBQ_CITADEL_ASSET_COUNT = loaded;
  return loaded;
}
async function loadAssets(onProgress) {
  if (window.GB_ASSETS) ASSET_NAMES = Object.keys(window.GB_ASSETS);
  else { try { ASSET_NAMES = await (await fetch('assets/index.json')).json(); } catch (e) { ASSET_NAMES = []; } }
  if (!ASSET_NAMES.length) onProgress && onProgress(0.9);
  let done = 0;
  await Promise.all(ASSET_NAMES.map(n => new Promise(res => {
    const im = new Image();
    let settled = false;
    const finish = () => { if (settled) return; settled = true; done++; onProgress && onProgress(0.9 * done / Math.max(1, ASSET_NAMES.length)); res(); };
    im.onload = () => { IMG[n] = im; finish(); };
    im.onerror = finish;
    im.src = (window.GB_ASSETS && window.GB_ASSETS[n]) || `assets/${n}.png`;
  })));
  await loadCitadelAssets();
  onProgress && onProgress(1);
}

// ---------------------------------------------------------------- sprite pipeline
const sprCache = new Map(), groupTh = {};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function scaled(img, w, h) {
  const c = mkCanvas(w, h), x = c.getContext('2d');
  x.imageSmoothingEnabled = (w !== img.width || h !== img.height); x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, w, h); return c;
}
const lum = (d, i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
function quantiles(datas, qs) {
  const L = [];
  for (const d of datas) for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 110) L.push(lum(d, i));
  L.sort((a, b) => a - b);
  return qs.map(q => L.length ? L[Math.floor(q * (L.length - 1))] : 128);
}
function tileGroup(name) { const m = name.match(/^(world|dungeon|b_[a-z]+|d_[a-z]+)_\d_\d$/); return m ? m[1] : null; }
function groupThresh(g, w, h) {
  const k = g + w + 'x' + h;
  if (!groupTh[k]) {
    const datas = Object.keys(IMG).filter(n => tileGroup(n) === g).map(n => scaled(IMG[n], w, h).getContext('2d').getImageData(0, 0, w, h).data);
    groupTh[k] = quantiles(datas, g.startsWith('d') ? [0.25, 0.55, 0.85] : [0.1, 0.38, 0.72]);
  }
  return groupTh[k];
}
// GBC: 4-colour palette per sprite via median cut, snapped to 15-bit colour
function medianCut4(d) {
  const px = []; for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 110) px.push([d[i], d[i + 1], d[i + 2]]);
  if (px.length < 4) return [[0, 0, 0], [85, 85, 85], [170, 170, 170], [255, 255, 255]];
  let boxes = [px];
  while (boxes.length < 4) {
    boxes.sort((a, b) => b.length - a.length); const b = boxes.shift();
    let ch = 0, best = -1; for (let c = 0; c < 3; c++) { let mn = 255, mx = 0; for (const p of b) { mn = Math.min(mn, p[c]); mx = Math.max(mx, p[c]); } if (mx - mn > best) { best = mx - mn; ch = c; } }
    b.sort((p, q) => p[ch] - q[ch]); const m = b.length >> 1; boxes.push(b.slice(0, m), b.slice(m));
    if (b.length < 2) break;
  }
  return boxes.map(b => { const s = [0, 0, 0]; b.forEach(p => { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }); return s.map(v => (Math.round(v / b.length) >> 3) << 3); });
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function spr(name, w, h, opt) {
  const img = IMG[name]; if (!img) return null;
  const hiName = assetPackHiResName(name), packImage = hiName && IMG[hiName];
  const source = S.art === 'packs' && packImage ? packImage : img;
  requestHd64Sprite(name);
  opt = opt || {};
  w = w || source.width; h = h || Math.round(source.height * w / source.width);
  const key = `${name}|${w}|${h}|${S.palette}|${opt.flip ? 1 : 0}|${opt.rot ? 1 : 0}|${opt.ghost ? 1 : 0}|${opt.clean ? 1 : 0}`;
  let c = sprCache.get(key); if (c) return c;
  c = scaled(source, w, h);
  let hdReady = false;
  if (S.video === 'hd64') {
    const hd = HD64_INDEX && HD64_INDEX.get(name);
    const atlas = hd && HD64_ATLASES.get(`${hd.family}_${hd.rect[0]}`);
    if (packImage && packImage.width) {
      const hdc = mkCanvas(w, h), hdx = hdc.getContext('2d');
      hdx.imageSmoothingEnabled = true; hdx.drawImage(packImage, 0, 0, w, h);
      c = hdc; hdReady = true;
    } else if (hd && atlas && atlas.width) {
      const [page, sx, sy, sw, sh] = hd.rect;
      const hdc = mkCanvas(w, h), hdx = hdc.getContext('2d');
      hdx.imageSmoothingEnabled = true; hdx.drawImage(atlas, sx, sy, sw, sh, 0, 0, w, h);
      c = hdc; hdReady = true;
    }
  }
  const x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data;
  const mode = S.palette;
  if (hdReady) {
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 110) d[i + 3] = 0;
    x.putImageData(id, 0, 0);
  } else if (MONO(mode)) {
    const pixelArt = /^g[tdohm]_/.test(name);
    const g = tileGroup(name), th = pixelArt ? [78, 128, 182] : g ? groupThresh(g, w, h) : quantiles([d], [0.22, 0.48, 0.78]);
    const P = PALS[mode].ui;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; } d[i + 3] = 255;
      const px = (i >> 2) % w, py = ((i >> 2) / w) | 0, dith = pixelArt ? 0 : (BAYER[(py & 3) * 4 + (px & 3)] / 16 - 0.5) * 10;
      const l = lum(d, i) + dith, k = l < th[0] ? 3 : l < th[1] ? 2 : l < th[2] ? 1 : 0;
      d[i] = P[k][0]; d[i + 1] = P[k][1]; d[i + 2] = P[k][2];
    }
  } else if (mode === 'gbc' && !/^g[tdohm]_/.test(name) && !opt.clean) {
    const pal = medianCut4(d);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; } d[i + 3] = 255;
      let bi = 0, bd = 1e9; for (let k = 0; k < 4; k++) { const p = pal[k], dd = (p[0] - d[i]) ** 2 + (p[1] - d[i + 1]) ** 2 + (p[2] - d[i + 2]) ** 2; if (dd < bd) { bd = dd; bi = k; } }
      d[i] = pal[bi][0]; d[i + 1] = pal[bi][1]; d[i + 2] = pal[bi][2];
    }
  } else for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 110) d[i + 3] = 0; else { d[i + 3] = 255; if (mode === 'gbc') { d[i] &= 0xf8; d[i + 1] &= 0xf8; d[i + 2] &= 0xf8; } } }
  if (opt.clean) { // battle sprites: posterize, solid alpha, 1px dark outline (clean handheld-RPG look)
    const solid = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) { if (d[i + 3] < 128) { d[i + 3] = 0; continue; } d[i + 3] = 255; solid[p] = 1; if (!MONO(mode)) { d[i] = (d[i] >> 4) * 17; d[i + 1] = (d[i + 1] >> 4) * 17; d[i + 2] = (d[i + 2] >> 4) * 17; } }
    const ink = MONO(mode) ? PALS[mode].ui[3] : [22, 18, 26];
    for (let y = 0; y < h; y++) for (let x0 = 0; x0 < w; x0++) { const p = y * w + x0; if (solid[p]) continue;
      if ((x0 > 0 && solid[p - 1]) || (x0 < w - 1 && solid[p + 1]) || (y > 0 && solid[p - w]) || (y < h - 1 && solid[p + w])) { const i = p * 4; d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255; } }
  }
  if (opt.ghost) for (let i = 0; i < d.length; i += 4) { const l = lum(d, i); d[i] = l * 0.6 + 60; d[i + 1] = l * 0.7 + 70; d[i + 2] = l * 0.9 + 90; d[i + 3] = d[i + 3] ? 170 : 0; }
  x.putImageData(id, 0, 0);
  if (opt.flip || opt.rot) {
    const f = mkCanvas(w, h), fx = f.getContext('2d');
    if (opt.rot) { fx.translate(w / 2, h / 2); fx.rotate(Math.PI / 2); fx.translate(-w / 2, -h / 2); }
    if (opt.flip) { fx.translate(w, 0); fx.scale(-1, 1); }
    fx.drawImage(c, 0, 0); c = f;
  }
  sprCache.set(key, c); return c;
}
function sprH(name, h, opt) { const img = IMG[name]; if (!img) return null; const hiName = assetPackHiResName(name), source = S.art === 'packs' && hiName && IMG[hiName] || img; return spr(name, Math.max(1, Math.round(source.width * h / source.height)), h, opt); }
function sprFit(name, box, opt) { const img = IMG[name]; if (!img) return null; const hiName = assetPackHiResName(name), source = S.art === 'packs' && hiName && IMG[hiName] || img; const s = box / Math.max(source.width, source.height); return spr(name, Math.max(1, Math.round(source.width * s)), Math.max(1, Math.round(source.height * s)), opt); }
function blit(c, x, y) { if (c) ctx.drawImage(c, Math.round(x), Math.round(y)); }
function clearCaches() { sprCache.clear(); for (const k in fontC) delete fontC[k]; }

// ================================================================ text & UI
const fontC = {};
function font(c) {
  const key = String(c) + S.palette;
  if (!fontC[key]) {
    const im = IMG.font_6x9, cc = mkCanvas(im.width, im.height), x = cc.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in';
    x.fillStyle = col(c); x.fillRect(0, 0, cc.width, cc.height); fontC[key] = cc;
  }
  return fontC[key];
}
// characters the pixel font lacks become their plain-ASCII look-alikes (instead of '?')
const TEXT_ASCII = { '\u00b7': '-', '\u2022': '-', '\u2013': '-', '\u2014': '-', '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u00d7': 'x', '\u2192': '>', '\u2190': '<', '\u2191': '^', '\u2193': 'v', '\u25b6': '>', '\u2605': '*', '\u2606': '*', '\u00df': 'ss', '\u00e6': 'ae', '\u00c6': 'AE', '\u0153': 'oe', '\u0152': 'OE', '\u00f8': 'o', '\u00d8': 'O', '\u0142': 'l', '\u0141': 'L', '\u00de': 'Th', '\u00fe': 'th' };
function gameText(s) {
  let value = String(s);
  if (typeof value.normalize === 'function') value = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return value.replace(/[^\x20-\x7e\n]/g, ch => TEXT_ASCII[ch] || '?');
}
function fitText(s, maxChars) {
  const value = gameText(s).replace(/\n/g, ' ');
  const limit = Math.max(0, Math.floor(maxChars));
  if (value.length <= limit) return value;
  if (limit <= 3) return '.'.repeat(limit);
  return value.slice(0, limit - 3).trimEnd() + '...';
}
// a list row highlighted with shade 1 must not hide text drawn in shade 1 on top of it
const HILITE = { frame: -1, rects: [] };
function text(s, x, y, c = 3, sc = 1) {
  if (!IMG.font_6x9) return;
  s = gameText(s);
  if (c === 1 && HILITE.frame === frameN && HILITE.rects.some(r => x >= r[0] - 1 && x < r[0] + r[2] && y >= r[1] - 2 && y < r[1] + r[3])) c = 3;
  const f = font(c); let cx = x;
  for (const ch of s) {
    if (ch === '\n') { y += 10 * sc; cx = x; continue; }
    let code = ch.charCodeAt(0); if (code < 32 || code > 126) code = 63;
    if (code !== 32) ctx.drawImage(f, (code - 32) * 6, 0, 6, 9, Math.round(cx), Math.round(y), 6 * sc, 9 * sc);
    cx += 6 * sc;
  }
}
const textR = (s, rx, y, c, sc = 1) => { const value = gameText(s); text(value, rx - value.length * 6 * sc, y, c, sc); };
const textC = (s, cx, y, c, sc = 1) => { const value = gameText(s); text(value, Math.round(cx - value.length * 3 * sc), y, c, sc); };
function fill(x, y, w, h, c) { ctx.fillStyle = col(c); ctx.fillRect(x, y, w, h); if (c === 1 && h >= 8 && h <= 14 && w >= 30) { if (HILITE.frame !== frameN) { HILITE.frame = frameN; HILITE.rects = []; } HILITE.rects.push([x, y, w, h]); } }
function frame(x, y, w, h, bg = 0) {
  fill(x, y, w, h, 3); fill(x + 1, y + 1, w - 2, h - 2, bg);
  fill(x + 2, y + 2, w - 4, 1, 1); fill(x + 2, y + 2, 1, h - 4, 1);
}
function drawMenuBackdrop(scene = 'ap_scene_wilderness') {
  const art = IMG[scene] && spr(scene, W, H, { clean: true });
  if (art) blit(art, 0, 0);
  else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#11132d'); sky.addColorStop(0.58, '#302346'); sky.addColorStop(1, '#5a3541');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#17172d'; ctx.beginPath(); ctx.moveTo(0, 98); ctx.lineTo(28, 58); ctx.lineTo(52, 92); ctx.lineTo(82, 47); ctx.lineTo(112, 91); ctx.lineTo(142, 54); ctx.lineTo(W, 90); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  }
  ctx.save();
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(5,7,21,.42)'); shade.addColorStop(.52, 'rgba(8,7,20,.24)'); shade.addColorStop(1, 'rgba(6,7,17,.72)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
  const moonGlow = ctx.createRadialGradient(126, 24, 2, 126, 24, 37);
  moonGlow.addColorStop(0, 'rgba(255,220,156,.2)'); moonGlow.addColorStop(1, 'rgba(151,118,228,0)');
  ctx.fillStyle = moonGlow; ctx.fillRect(88, 0, 72, 64);
  ctx.restore();
}
function drawOrnatePanel(x, y, w, h, title) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,9,22,.88)'; ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 2; ctx.strokeStyle = '#100b18'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.lineWidth = 1; ctx.strokeStyle = '#e1ae52'; ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  ctx.strokeStyle = 'rgba(255,222,139,.58)'; ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
  ctx.fillStyle = '#f1c76d';
  ctx.fillRect(x + 4, y + 4, 4, 1); ctx.fillRect(x + 4, y + 4, 1, 4);
  ctx.fillRect(x + w - 8, y + 4, 4, 1); ctx.fillRect(x + w - 5, y + 4, 1, 4);
  ctx.fillRect(x + 4, y + h - 5, 4, 1); ctx.fillRect(x + 4, y + h - 8, 1, 4);
  ctx.fillRect(x + w - 8, y + h - 5, 4, 1); ctx.fillRect(x + w - 5, y + h - 8, 1, 4);
  ctx.restore();
  if (title) {
    const maxChars = Math.max(1, Math.floor((w - 28) / 6));
    title = fitText(title, maxChars);
    const tw = Math.min(w - 18, title.length * 6 + 16), tx = x + (w - tw) / 2;
    fill(tx, y - 3, tw, 11, '#110d1d');
    ctx.save(); ctx.strokeStyle = '#e1ae52'; ctx.lineWidth = 1; ctx.strokeRect(tx + .5, y - 2.5, tw - 1, 10); ctx.restore();
    textC(title, x + w / 2, y - 1, '#ffe3a0');
  }
}
function drawMenuButton(x, y, w, h, label, selected = false) {
  label = fitText(label, Math.max(1, Math.floor((w - (selected ? 16 : 8)) / 6)));
  if (selected) {
    fill(x + 2, y + 1, w - 4, h - 2, 'rgba(157,91,33,.58)');
    ctx.save(); ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 1; ctx.shadowColor = '#ffb738'; ctx.shadowBlur = 4; ctx.strokeRect(x + 1.5, y + .5, w - 3, h - 1); ctx.restore();
    text('>', x + 5, y + Math.max(0, (h - 9) >> 1), '#fff0c2');
  }
  textC(label, x + w / 2 + (selected ? 2 : 0), y + Math.max(0, (h - 9) >> 1), selected ? '#fff0c2' : '#e3deeb');
}
function drawMenuHeader(title, subtitle = '') {
  textC(title, 80, 4, '#ffe2a0');
  if (subtitle) textC(subtitle, 80, 14, '#ddd3e6');
}
function bar(x, y, w, h, v, max, c = 2) {
  fill(x, y, w, h, 3); fill(x + 1, y + 1, w - 2, h - 2, 0);
  const f = Math.round((w - 2) * Math.max(0, Math.min(1, max ? v / max : 0)));
  if (f > 0) fill(x + 1, y + 1, f, h - 2, c);
}
function segBar(x, y, n, max) { for (let i = 0; i < max; i++) { fill(x + i * 7, y, 6, 7, 3); if (i >= n) fill(x + i * 7 + 1, y + 1, 4, 5, 0); } }
function checkbox(x, y, on) { fill(x, y, 7, 7, 3); fill(x + 1, y + 1, 5, 5, 0); if (on) fill(x + 2, y + 2, 3, 3, 3); }
function icon(name, x, y, size = 10) { blit(sprFit(name, size), x + (size - Math.min(size, (sprFit(name, size) || { width: size }).width)) / 2, y); }
const pad2 = n => String(n).padStart(2, '0');
const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : String(n);
function wrap(s, n = 23) {
  n = Math.max(1, Math.floor(Number(n) || 23));
  const out = []; for (const para of gameText(s).split('\n')) {
    let line = '';
    for (let word of para.trim().split(/\s+/)) {
      if (!word) continue;
      while (word.length > n) {
        if (line) { out.push(line); line = ''; }
        out.push(word.slice(0, n)); word = word.slice(n);
      }
      if ((line + (line ? ' ' : '') + word).length > n) { if (line) out.push(line); line = word; }
      else line += (line ? ' ' : '') + word;
    }
    out.push(line);
  }
  return out;
}
function pages(lines, rows = 3, n = 23) {
  const res = [];
  for (const l of lines) { const w = wrap(l, n); for (let i = 0; i < w.length; i += rows) res.push(w.slice(i, i + rows).join('\n')); }
  return res;
}

// ================================================================ input
const BTNS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
const held = {}, pressed = {}, rep = {};
const DEFAULT_KEYBINDS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', start: 'Enter', select: 'ShiftLeft' };
S.keybinds = Object.assign({}, DEFAULT_KEYBINDS, S.keybinds || {});
let keyCaptureHandler = null;
let combatHotkeyHandler = null;
const KEY_LABELS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'L CTRL', ControlRight: 'R CTRL', AltLeft: 'L ALT', AltRight: 'R ALT', Backspace: 'BACKSPACE', Tab: 'TAB' };
function keyLabel(code) { return KEY_LABELS[code] || (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code); }
function bDown(b) { audioCtx(); if (!held[b]) { held[b] = true; pressed[b] = true; rep[b] = 0; } }
function bUp(b) { held[b] = false; }
const mapBtn = b => S.swap ? (b === 'a' ? 'b' : b === 'b' ? 'a' : b) : b;
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
  z: 'a', j: 'a', ' ': 'a', x: 'b', k: 'b', Escape: 'b', Backspace: 'b', Enter: 'start', Shift: 'select', Tab: 'select' };
const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
function keyAction(e) {
  const code = e.code || '';
  for (const b of BTNS) if (S.keybinds[b] === code) return b;
  if (Object.values(DEFAULT_KEYBINDS).includes(code)) return null;
  return KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
}
addEventListener('keydown', e => { if (keyCaptureHandler) { e.preventDefault(); if (!e.repeat) keyCaptureHandler(e.code || e.key); return; } if (typing()) return; const code = e.code || ''; const slot = code.startsWith('Digit') ? Number(code.slice(5)) : code.startsWith('Numpad') ? Number(code.slice(6)) : NaN; if (combatHotkeyHandler && (slot >= 1 && slot <= 9 || slot === 0)) { e.preventDefault(); if (!e.repeat) combatHotkeyHandler(slot === 0 ? 9 : slot - 1); return; } const b = keyAction(e); if (b) { e.preventDefault(); bDown(mapBtn(b)); } });
// ---- keyboard focus: the game must own the keyboard, or keys go to whatever else has focus (e.g. the host app's chat box)
LCD.tabIndex = 0; LCD.style.outline = 'none';
const focusGame = () => { if (typing()) return; try { window.focus(); } catch (e) {} try { LCD.focus({ preventScroll: true }); } catch (e) {} };
addEventListener('pointerdown', e => { const t = e.target; if (t && t.closest && t.closest('input, textarea, select, #acctForm, #dbg')) return; focusGame(); }, true);
const focusHint = (() => {
  const el = document.createElement('div'); el.id = 'focusHint'; el.setAttribute('role', 'status');
  el.textContent = 'CLICK THE GAME TO USE YOUR KEYBOARD';
  el.style.cssText = 'position:fixed;z-index:90;pointer-events:none;padding:4px 8px;border-radius:4px;background:#000c;color:#ffe08a;border:1px solid #ffe08a;font:700 10px Silkscreen,"Courier New",monospace;letter-spacing:.06em;white-space:nowrap;display:none';
  const place = () => { const r = LCD.getBoundingClientRect(); el.textContent = r.width < 300 ? 'CLICK TO PLAY' : 'CLICK THE GAME TO USE YOUR KEYBOARD'; const w = el.offsetWidth || 120; el.style.left = Math.round(Math.max(4, Math.min(innerWidth - w - 4, r.left + r.width / 2 - w / 2))) + 'px'; el.style.top = Math.round(r.top + r.height - 22) + 'px'; el.style.transform = 'none'; };
  const upd = () => { const show = !document.hasFocus() && !document.getElementById('atlasOverlay') && !document.getElementById('acctForm'); el.style.display = show ? 'block' : 'none'; if (show) place(); };
  const add = () => { document.body.appendChild(el); upd(); };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  addEventListener('focus', upd); addEventListener('blur', upd); addEventListener('resize', upd); setInterval(upd, 600);
  return { upd };
})();
setTimeout(focusGame, 300);
addEventListener('keyup', e => { const b = keyAction(e); if (b) { if (b === 'a' || b === 'b') { bUp('a'); bUp('b'); } else bUp(b); } });
addEventListener('blur', () => BTNS.forEach(bUp));
LCD.addEventListener('contextmenu', e => e.preventDefault());
LCD.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; e.preventDefault(); const rect = LCD.getBoundingClientRect(), x = (e.clientX - rect.left) * LCD.width / rect.width, y = (e.clientY - rect.top) * LCD.height / rect.height; if (e.button === 0 && combatHotkeyHandler && y >= 81 && y < 94) { combatHotkeyHandler(Math.max(0, Math.min(9, Math.floor((x - 2) / 15.6)))); return; } LCD.setPointerCapture(e.pointerId); bDown(mapBtn(e.button === 2 ? 'b' : 'a')); });
const releaseMouse = e => { if (e.pointerType === 'mouse') { bUp('a'); bUp('b'); } };
LCD.addEventListener('pointerup', releaseMouse); LCD.addEventListener('pointercancel', releaseMouse); LCD.addEventListener('lostpointercapture', releaseMouse);
LCD.addEventListener('wheel', e => { e.preventDefault(); bDown(e.deltaY < 0 ? 'up' : 'down'); setTimeout(() => bUp(e.deltaY < 0 ? 'up' : 'down'), 80); }, { passive: false });
document.querySelectorAll('[data-btn]').forEach(el => {
  const b = el.dataset.btn;
  const on = e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); el.classList.add('down'); bDown(mapBtn(b)); };
  const off = e => { e.preventDefault(); el.classList.remove('down'); if (b === 'a' || b === 'b') { bUp('a'); bUp('b'); } else bUp(b); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
});
(function dpadSetup() {
  const dpad = document.getElementById('dpad'); if (!dpad) return;
  let cur = null;
  const set = d => { if (cur === d) return; if (cur) bUp(cur); cur = d; if (d) bDown(d); dpad.dataset.dir = d || ''; };
  const at = e => {
    const r = dpad.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };
  dpad.addEventListener('pointerdown', e => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); set(at(e)); });
  dpad.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') set(at(e)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => dpad.addEventListener(t, () => set(null)));
})();
const P = b => pressed[b];
const nav = b => pressed[b] || (held[b] && rep[b] > 16 && rep[b] % 4 === 0);

// ================================================================ audio: 4 channels like the APU (2 pulse, wave, noise)
let AC = null, noiseBuf = null, pulse25 = null, pulse12 = null;
function audioCtx() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0);
      let lfsr = 0x7fff; for (let i = 0; i < d.length; i++) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); d[i] = (lfsr & 1) ? 0.6 : -0.6; }
      const mk = duty => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty); return AC.createPeriodicWave(re, im); };
      pulse25 = mk(0.25); pulse12 = mk(0.125);
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
// note: [wave, f0, f1, dur, vol, delay]; wave s=square(50%) p=pulse25 q=pulse12 t=triangle w=saw n=noise
function play(notes, bus = 'sfx') {
  if (!AC) return;
  if (S.audio === 'hd64' && typeof play64 === 'function') return play64(notes, bus);
  const v = bus === 'music' ? S.music : S.vol; if (!v) return;
  for (const [wv, f0, f1, dur, vol, del = 0] of notes) {
    const t = AC.currentTime + Math.max(0, del), g = AC.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol * v / 3), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(AC.destination);
    if (wv === 'n') {
      const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      s.playbackRate.setValueAtTime(Math.max(0.05, f0 / 1000), t); if (f1 !== f0) s.playbackRate.linearRampToValueAtTime(Math.max(0.05, f1 / 1000), t + dur);
      s.connect(g); s.start(t); s.stop(t + dur + 0.02);
    } else {
      const o = AC.createOscillator();
      if (wv === 'p') o.setPeriodicWave(pulse25); else if (wv === 'q') o.setPeriodicWave(pulse12); else o.type = { s: 'square', t: 'triangle', w: 'sawtooth' }[wv] || 'square';
      o.frequency.setValueAtTime(Math.max(20, f0), t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      o.connect(g); o.start(t); o.stop(t + dur + 0.02);
    }
  }
}
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const arp = (wv, ms, step, vol = 0.06, dur) => ms.map((m, i) => [wv, N(m), N(m), dur || step * 0.9, vol, i * step]);
// ---------------------------------------------------------------- the SFX bank (103 sounds)
const SFX_BANK = {
  // UI (12)
  cursor: [['p', 1500, 1500, 0.03, 0.04]], select: arp('p', [79, 86], 0.045), back: [['p', 500, 380, 0.06, 0.05]], error: [['s', 160, 140, 0.15, 0.06]],
  open: arp('p', [72, 76, 79], 0.03), close: arp('p', [79, 76, 72], 0.03), page: [['n', 4000, 2000, 0.04, 0.05]], type: [['q', 1800, 1800, 0.015, 0.025]],
  confirm: arp('s', [76, 84], 0.06), toggle: [['p', 900, 1200, 0.04, 0.04]], buy: arp('p', [84, 88, 91], 0.04), sell: arp('p', [91, 86], 0.05),
  // combat (25)
  swing: [['n', 3000, 900, 0.08, 0.07]], hit_slash: [['n', 2500, 600, 0.1, 0.09], ['s', 300, 120, 0.08, 0.04]], hit_pierce: [['n', 5000, 2000, 0.06, 0.08], ['p', 900, 400, 0.05, 0.04]],
  hit_blunt: [['n', 800, 200, 0.14, 0.1], ['t', 140, 60, 0.12, 0.1]], crit: [['n', 3000, 400, 0.18, 0.12], ['s', 1200, 300, 0.2, 0.06]], miss: [['t', 700, 1100, 0.1, 0.06]],
  block: [['s', 220, 220, 0.06, 0.06], ['n', 1500, 1500, 0.04, 0.05]], dodge: [['n', 2000, 6000, 0.1, 0.05]], shieldup: arp('t', [60, 67, 72], 0.04, 0.08),
  hurt: [['s', 180, 90, 0.18, 0.08]], hurt_big: [['s', 140, 50, 0.3, 0.1], ['n', 600, 100, 0.3, 0.08]], monster_die: [['s', 400, 60, 0.35, 0.07], ['n', 1200, 200, 0.3, 0.05]],
  boss_die: [['s', 300, 30, 1.0, 0.09], ['n', 900, 60, 1.0, 0.09], ['t', 120, 40, 1.0, 0.1]], heal: arp('t', [72, 76, 79, 84], 0.06, 0.09), revive: arp('t', [60, 67, 72, 79, 84, 91], 0.07, 0.09),
  death: arp('t', [67, 63, 60, 55, 48], 0.16, 0.09), ds_ok: arp('p', [72, 79], 0.08), ds_fail: arp('s', [60, 54], 0.1), stabilize: arp('t', [67, 71, 74, 79], 0.08, 0.08),
  flee: [['n', 1000, 5000, 0.25, 0.06]], ambush: arp('s', [52, 58, 64], 0.05), initiative: [['n', 3000, 3000, 0.03, 0.05], ['n', 3000, 3000, 0.03, 0.05, 0.08]],
  nat20: arp('p', [72, 76, 79, 84, 88, 91, 96], 0.04, 0.06), nat1: arp('s', [48, 47, 46, 45], 0.09), thorns: [['n', 6000, 3000, 0.05, 0.04]],
  // spells: 8 schools x cast/impact (16)
  aegis_cast: arp('t', [72, 79, 84], 0.05, 0.08), aegis_hit: [['t', 600, 900, 0.2, 0.07]],
  calling_cast: arp('p', [67, 71, 74, 79], 0.04), calling_hit: arp('t', [79, 84, 88], 0.05, 0.08),
  omen_cast: [['q', 1200, 2400, 0.25, 0.04]], omen_hit: [['q', 2400, 1200, 0.2, 0.04]],
  thrall_cast: [['t', 400, 800, 0.3, 0.07], ['t', 403, 806, 0.3, 0.05]], thrall_hit: [['p', 700, 500, 0.25, 0.05]],
  storm_cast: [['w', 200, 1200, 0.25, 0.05]], storm_hit: [['n', 1500, 100, 0.35, 0.12], ['s', 200, 40, 0.3, 0.06]],
  veil_cast: [['t', 1000, 300, 0.35, 0.06]], veil_hit: [['q', 500, 250, 0.2, 0.05]],
  grave_cast: [['w', 300, 80, 0.4, 0.05]], grave_hit: [['s', 120, 60, 0.3, 0.07], ['n', 300, 100, 0.25, 0.05]],
  flux_cast: [['p', 300, 1500, 0.2, 0.05], ['p', 1500, 300, 0.2, 0.05, 0.2]], flux_hit: [['t', 900, 450, 0.2, 0.07]],
  // status (10)
  poison: [['q', 300, 200, 0.2, 0.05]], burn: [['n', 2500, 1800, 0.25, 0.06]], freeze: [['t', 2000, 1500, 0.2, 0.06], ['n', 8000, 8000, 0.1, 0.03]], shock: [['n', 9000, 4000, 0.12, 0.07]],
  stun: arp('q', [84, 79, 84, 79], 0.04), sleep: arp('t', [72, 69, 65], 0.12, 0.06), charm: arp('t', [76, 80, 83, 88], 0.06, 0.06), fear: [['w', 150, 110, 0.4, 0.05]],
  bless: arp('t', [76, 83, 88], 0.07, 0.07), buff: arp('p', [69, 76], 0.05),
  // items & world (20)
  pickup: arp('p', [84, 91], 0.04), coin: arp('p', [88, 95], 0.05), chest: arp('p', [72, 76, 79, 84, 79, 84, 88], 0.06), door: [['n', 400, 200, 0.2, 0.08]],
  stairs: arp('t', [60, 64, 67, 72], 0.05, 0.07), step_grass: [['n', 2500, 2500, 0.02, 0.012]], step_sand: [['n', 1200, 1200, 0.03, 0.012]], step_stone: [['n', 4500, 4500, 0.015, 0.015]],
  step_snow: [['n', 700, 700, 0.03, 0.015]], splash: [['n', 3000, 600, 0.3, 0.08]], cast_line: [['n', 4000, 7000, 0.2, 0.04]], bite: arp('s', [84, 84], 0.08),
  reel: [['q', 600, 900, 0.3, 0.04]], gather: [['n', 3500, 1500, 0.1, 0.05], ['p', 1200, 1600, 0.05, 0.03]], craft: arp('s', [60, 67, 60, 72], 0.06, 0.05),
  eat: [['n', 1500, 900, 0.06, 0.05], ['n', 1500, 900, 0.06, 0.05, 0.12]], drink: [['t', 300, 600, 0.15, 0.06], ['t', 350, 700, 0.15, 0.05, 0.16]],
  equip: [['n', 2500, 1200, 0.08, 0.06], ['s', 400, 400, 0.05, 0.04]], scroll: [['n', 6000, 3000, 0.15, 0.04]], waypoint: arp('t', [72, 79, 84, 91], 0.08, 0.07),
  // events (12)
  levelup: arp('s', [72, 76, 79, 84, 79, 84, 88, 91], 0.07, 0.06), quest_accept: arp('p', [72, 79, 84], 0.06), quest_done: arp('s', [72, 76, 79, 84, 0, 84, 88], 0.07, 0.06),
  achievement: arp('p', [79, 83, 86, 91, 95], 0.06), discover: arp('t', [67, 72, 76, 79, 84], 0.09, 0.07), boss_appear: [['s', 110, 110, 0.5, 0.08], ['s', 104, 104, 0.5, 0.08, 0.5]],
  world_boss: [['w', 80, 160, 1.0, 0.07], ['n', 300, 100, 1.0, 0.06]], act_complete: arp('s', [60, 64, 67, 72, 76, 79, 84], 0.1, 0.07), lfg_ready: arp('p', [84, 79, 84, 91], 0.07),
  whisper: arp('q', [91, 96], 0.05, 0.03), mail: arp('p', [88, 84, 88], 0.06), auction: arp('p', [79, 84, 79, 84], 0.05),
  // creatures (8)
  growl: [['w', 110, 80, 0.4, 0.06], ['n', 400, 300, 0.4, 0.03]], screech: [['q', 2200, 1600, 0.3, 0.05]], hiss: [['n', 6000, 5000, 0.4, 0.05]], roar: [['w', 160, 60, 0.7, 0.08], ['n', 500, 150, 0.7, 0.06]],
  gurgle: [['t', 200, 120, 0.2, 0.06], ['t', 180, 100, 0.2, 0.06, 0.15]], moan: [['t', 220, 160, 0.6, 0.07]], chitter: arp('q', [96, 98, 96, 98], 0.03, 0.04), howl: [['t', 400, 700, 0.5, 0.07], ['t', 700, 500, 0.4, 0.06, 0.5]],
};
const SFX = new Proxy({}, { get: (_, k) => () => (typeof Events !== 'undefined' && Events.emit('sfx', k), 0) || (S.audio === 'hd64' && typeof sfx64 === 'function') ? sfx64(k) : play(SFX_BANK[k] || SFX_BANK.cursor) });
const SFX_NAMES = Object.keys(SFX_BANK);

// ---------------------------------------------------------------- procedural music (24 tracks)
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], penta: [0, 2, 4, 7, 9, 12, 14] };
const TRACKS = {
  boot: { bpm: 120, root: 60, scale: 'major', prog: [0], drums: '', jingle: true }, title: { bpm: 108, root: 60, scale: 'lydian', prog: [0, 4, 5, 3], drums: 'k...h...s...h...' },
  character: { bpm: 96, root: 62, scale: 'dorian', prog: [0, 3, 6, 4], drums: 'k.......s.......' }, prologue: { bpm: 72, root: 57, scale: 'minor', prog: [0, 5, 3, 4], drums: '' },
  town: { bpm: 104, root: 60, scale: 'major', prog: [0, 3, 4, 0], drums: 'k...h.h.s...h.h.' }, field: { bpm: 132, root: 62, scale: 'major', prog: [0, 4, 5, 3], drums: 'k.h.s.h.k.h.s.h.' },
  coast: { bpm: 116, root: 64, scale: 'mixo', prog: [0, 6, 3, 0], drums: 'k..hs.h.k..hs.h.' }, marsh: { bpm: 90, root: 57, scale: 'dorian', prog: [0, 3, 0, 4], drums: 'k.....h.s.....h.' },
  jungle: { bpm: 124, root: 59, scale: 'penta', prog: [0, 2, 3, 4], drums: 'k.hhs.hhk.hhs.hh' }, snow: { bpm: 84, root: 64, scale: 'minor', prog: [0, 5, 2, 6], drums: 'k.......h.......' },
  desert: { bpm: 112, root: 57, scale: 'harmonic', prog: [0, 1, 0, 6], drums: 'k..k..s.k..k..s.' }, volcano: { bpm: 140, root: 52, scale: 'phrygian', prog: [0, 1, 0, 6], drums: 'kkh.s.h.kkh.s.hs' },
  dusk: { bpm: 80, root: 50, scale: 'harmonic', prog: [0, 5, 4, 0], drums: 'k.......s.......' }, crystal: { bpm: 100, root: 67, scale: 'lydian', prog: [0, 1, 4, 3], drums: '....h.......h...' },
  dungeon: { bpm: 100, root: 52, scale: 'minor', prog: [0, 5, 6, 4], drums: 'k...h...s...h...' }, raid: { bpm: 92, root: 50, scale: 'phrygian', prog: [0, 1, 5, 4], drums: 'k.k.s...k.k.s.s.' },
  tower: { bpm: 118, root: 55, scale: 'dorian', prog: [0, 6, 5, 4], drums: 'k.h.s.h.k.hks.h.' }, battle: { bpm: 168, root: 57, scale: 'minor', prog: [0, 5, 6, 4], drums: 'k.hhs.hhk.hhs.hs' },
  boss: { bpm: 180, root: 52, scale: 'harmonic', prog: [0, 1, 0, 4], drums: 'kkhhs.hhkkhhs.ss' }, arcboss: { bpm: 176, root: 50, scale: 'phrygian', prog: [0, 1, 5, 6], drums: 'kkskkskskkskksss' },
  victory: { bpm: 140, root: 60, scale: 'major', prog: [0], drums: '', jingle: true }, defeat: { bpm: 70, root: 57, scale: 'minor', prog: [0], drums: '', jingle: true },
  inn: { bpm: 76, root: 60, scale: 'major', prog: [0, 5, 3, 4], drums: '' }, credits: { bpm: 112, root: 62, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], drums: 'k.h.s.h.k.h.s.h.' },
};
const JINGLES = { boot: [72, 0, 84], victory: [72, 76, 79, 84, 0, 79, 84, 88], defeat: [67, 65, 63, 60, 0, 55] };
function composeTrack(id) {
  const t = TRACKS[id], r = RNG('music-' + id), sc = SCALES[t.scale];
  const deg = (d, oct = 0) => t.root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
  const lead = [], harm = [], bass = [];
  t.prog.forEach(ch => {
    const rhythm = r.pick(['x.x.xx.x', 'x..xx.x.', 'xx.x.xx.', 'x.xxx.x.', 'x...x.x.']);
    let last = ch + 7;
    for (let i = 0; i < 8; i++) {
      if (rhythm[i] === 'x') { const choices = [ch + 7, ch + 9, ch + 11, last + 1, last - 1, ch + 14]; last = r.pick(choices); lead.push(deg(last)); }
      else lead.push(0);
      harm.push(i % 4 === 0 ? deg(ch + 2) : 0);
      bass.push(i % 2 === 0 ? deg(ch, -1) : (i % 4 === 3 ? deg(ch + 4, -1) : 0));
    }
  });
  return { lead, harm, bass, drums: t.drums || '', bpm: t.bpm };
}
const Music = {
  cur: null, step: 0, next: 0, song: null, cacheSongs: {}, cache64: {}, song64: null,
  play(id) {
    if (this.cur === id) return;
    this.cur = id; this.step = 0; this.next = AC ? AC.currentTime + 0.08 : 0;
    const t = TRACKS[id]; if (!t) { this.song = null; return; }
    if (t.jingle) { this.song = null; if (AC && S.audio === 'hd64' && typeof jingle64 === 'function') { jingle64(id); return; } if (AC) play(JINGLES[id].map((m, i) => ['s', N(m), N(m), 0.16, m ? 0.05 : 0.0001, i * 0.13]), 'music'); return; }
    this.song = this.cacheSongs[id] || (this.cacheSongs[id] = composeTrack(id));
  },
  stop() { this.cur = null; this.song = null; },
  tick() {
    if (AC && S.music && this.cur && S.audio === 'hd64' && typeof music64Tick === 'function') return music64Tick(this);
    if (!AC || !this.song || !S.music) return;
    const s = this.song, dt = 60 / s.bpm / 2;
    if (this.next < AC.currentTime - 0.5) this.next = AC.currentTime + 0.05;
    while (this.next < AC.currentTime + 0.25) {
      const i = this.step % s.lead.length, d = this.next - AC.currentTime, notes = [];
      if (s.lead[i]) notes.push(['p', N(s.lead[i]), N(s.lead[i]), dt * 0.85, 0.022, d]);
      if (s.harm[i]) notes.push(['q', N(s.harm[i]), N(s.harm[i]), dt * 3, 0.012, d]);
      if (s.bass[i]) notes.push(['t', N(s.bass[i]), N(s.bass[i]), dt * 1.4, 0.05, d]);
      const dc = s.drums[i % (s.drums.length || 1)];
      if (dc === 'k') notes.push(['n', 300, 80, 0.08, 0.05, d]); else if (dc === 's') notes.push(['n', 2500, 1500, 0.08, 0.035, d]); else if (dc === 'h') notes.push(['n', 8000, 8000, 0.02, 0.015, d]);
      if (notes.length) play(notes, 'music');
      this.step++; this.next += dt;
    }
  },
};
setInterval(() => Music.tick(), 60);

// ================================================================ physics & particles
// Bodies: AABB with velocity/acceleration, gravity, friction, bounce and tile collision.
const Physics = {
  bodies: [],
  body(o) { const b = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, w: 2, h: 2, grav: 0, fric: 1, bounce: 0, life: 60, solid: null }, o); this.bodies.push(b); return b; },
  step(solidAt) {
    for (const b of this.bodies) {
      b.vx += b.ax; b.vy += b.ay + b.grav; b.vx *= b.fric; b.vy *= b.fric;
      const nx = b.x + b.vx, ny = b.y + b.vy;
      if (solidAt && b.solid) {
        if (solidAt(nx, b.y) || solidAt(nx + b.w, b.y)) { b.vx = -b.vx * b.bounce; } else b.x = nx;
        if (solidAt(b.x, ny + b.h) || solidAt(b.x, ny)) { b.vy = -b.vy * b.bounce; if (Math.abs(b.vy) < 0.2) b.vy = 0; } else b.y = ny;
      } else { b.x = nx; b.y = ny; }
      if (b.floor != null && b.y > b.floor) { b.y = b.floor; b.vy = -b.vy * b.bounce; b.vx *= 0.7; }
      b.life--;
    }
    this.bodies = this.bodies.filter(b => b.life > 0);
  },
  clear() { this.bodies.length = 0; },
};
// particle emitters built on physics bodies
const FX = {
  burst(x, y, n = 8, c = 3, speed = 1.6, grav = 0.08) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random()); Physics.body({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.8, grav, life: 20 + Math.random() * 20, c, kind: 'spark' }); } },
  number(x, y, txt, c = 3) { Physics.body({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: -1.6, grav: 0.07, life: 45, txt: String(txt), c, kind: 'text', floor: y + 4, bounce: 0.3 }); },
  dust(x, y) { for (let i = 0; i < 3; i++) Physics.body({ x: x + Math.random() * 6, y, vx: (Math.random() - 0.5) * 0.5, vy: -0.3 - Math.random() * 0.3, grav: 0.02, life: 14, c: 1, kind: 'spark' }); },
  splash(x, y) { for (let i = 0; i < 10; i++) Physics.body({ x, y, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 1.5, grav: 0.12, life: 24, c: 'blue', kind: 'spark' }); },
  draw(ox = 0, oy = 0) {
    for (const b of Physics.bodies) {
      if (b.kind === 'spark') fill(Math.round(b.x - ox), Math.round(b.y - oy), 2, 2, b.c);
      else if (b.kind === 'text') { text(b.txt, b.x - ox - b.txt.length * 3 + 1, b.y - oy + 1, 0); text(b.txt, b.x - ox - b.txt.length * 3, b.y - oy, b.c); }
      else if (b.kind === 'rain') fill(Math.round(b.x - ox), Math.round(b.y - oy), 1, 3, b.c);
      else if (b.kind === 'snow') fill(Math.round(b.x - ox), Math.round(b.y - oy), 1, 1, b.c);
    }
  },
};
// weather: rain, snow, ash, motes — per biome
const WEATHER = { marsh: 'rain', jungle: 'rain', coast: 'rain', snow: 'snow', volcanic: 'ash', dusk: 'ash', crystal: 'motes' };
function weatherTick(biome, camX, camY) {
  const kind = S.weather ? WEATHER[biome] : null; if (!kind || frameN % 3) return;
  const n = kind === 'rain' ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const x = camX + Math.random() * (W + 40) - 20, y = camY - 4;
    if (kind === 'rain') Physics.body({ x, y, vx: -0.6, vy: 3.2, life: 50, c: 1, kind: 'rain' });
    if (kind === 'snow') Physics.body({ x, y, vx: Math.sin(frameN / 20) * 0.3, vy: 0.5, life: 300, c: 0, kind: 'snow' });
    if (kind === 'ash') Physics.body({ x, y, vx: 0.2, vy: 0.4, life: 300, c: 2, kind: 'snow' });
    if (kind === 'motes' && Math.random() < 0.3) Physics.body({ x, y: camY + Math.random() * H, vx: 0, vy: -0.15, life: 120, c: 'blue', kind: 'snow' });
  }
}

// ================================================================ scene stack
const scenes = [];
let shake = 0, frameN = 0;
function push(s) { scenes.push(s); s.enter && s.enter(); return s; }
function pop() { const s = scenes.pop(); const t = scenes[scenes.length - 1]; t && t.resume && t.resume(); return s; }
const topScene = () => scenes[scenes.length - 1];
function reset(s) { scenes.length = 0; Physics.clear(); push(s); }
function removeScene(s) { const i = scenes.indexOf(s); if (i >= 0) scenes.splice(i, 1); }

class Dialog {
  constructor(lines, cb, opts = {}) { this.p = pages(lines); this.i = 0; this.c = 0; this.cb = cb; this.who = opts.who; this.portrait = opts.portrait; }
  update() {
    const L = this.p[this.i];
    if (this.c < L.length) { this.c += [0.8, 1.5, 3, 99][S.textSpeed]; if (frameN % 3 === 0) SFX.type(); if (P('a') || P('b')) this.c = L.length; return; }
    if (P('a') || P('b')) { SFX.cursor(); this.i++; this.c = 0; if (this.i >= this.p.length) { removeScene(this); this.cb && this.cb(); } }
  }
  draw() {
    const y = H - 44, blackbird = S.uiTheme === 'blackbird';
    if (blackbird) { fill(1, y - 1, W - 2, 43, '#b09258'); fill(2, y, W - 4, 41, '#080a0c'); fill(3, y + 1, W - 6, 39, '#171a1f'); fill(4, y + 2, W - 8, 1, '#343941'); }
    else drawOrnatePanel(2, y, W - 4, 42);
    if (this.who) { const w = this.who.length * 6 + 8; if (blackbird) { fill(3, y - 12, w + 2, 13, '#b09258'); fill(4, y - 11, w, 11, '#171a1f'); } else drawOrnatePanel(4, y - 11, w, 12); text(this.who, 8, y - 9, blackbird ? '#e1c78f' : '#ffe3a0'); }
    const L = this.p[this.i]; if (!L) return;
    text(L.slice(0, Math.floor(this.c)), 8, y + 6);
    if (this.c >= L.length && (frameN >> 4) % 2) text('v', W - 14, y + 31);
  }
}
function say(lines, cb, opts) { push(new Dialog(Array.isArray(lines) ? lines : [lines], cb, opts)); }

class Choice { // scrolling list with optional prompt
  constructor(opts, cb, prompt, o = {}) { this.o = opts; this.cb = cb; this.prompt = prompt; this.i = o.start || 0; this.top = 0; this.rows = o.rows || 8; this.x = o.x; }
  update() {
    const n = this.o.length;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); }
    if (this.i < this.top) this.top = this.i; if (this.i >= this.top + this.rows) this.top = this.i - this.rows + 1;
    if (P('a')) { SFX.select(); removeScene(this); this.cb(this.i); }
    else if (P('b')) { SFX.back(); removeScene(this); this.cb(-1); }
  }
  draw() {
    const blackbird = S.uiTheme === 'blackbird';
    let bottom = H - 2;
    if (this.prompt) {
      if (blackbird) {
        fill(2, H - 44, W - 4, 42, '#080a0c');
        fill(2, H - 44, W - 4, 1, '#b09258');
        fill(2, H - 3, W - 4, 1, '#51432f');
      } else drawOrnatePanel(2, H - 44, W - 4, 42);
      text(wrap(this.prompt).slice(0, 3).join('\n'), 8, H - 38, blackbird ? '#e1c78f' : '#fff0c2');
      bottom = H - 46;
    }
    const vis = this.o.slice(this.top, this.top + this.rows);
    const w = Math.min(156, Math.max(...this.o.map(s => String(s).length)) * 6 + 18), h = vis.length * 11 + 8;
    const x = this.x != null ? this.x : W - w - 2, y = Math.max(2, bottom - h);
    if (blackbird) {
      fill(x, y, w, h, '#b09258');
      fill(x + 1, y + 1, w - 2, h - 2, '#080a0c');
      fill(x + 2, y + 2, w - 4, h - 4, '#171a1f');
      fill(x + 4, y + 4, w - 8, 1, '#343941');
    } else drawOrnatePanel(x, y, w, h);
    vis.forEach((s, j) => {
      const i = this.top + j, rowY = y + 5 + j * 11;
      if (blackbird && i === this.i) {
        fill(x + 3, rowY - 2, w - 6, 10, '#51432f');
        fill(x + 4, rowY - 1, w - 8, 8, '#29231a');
      } else if (i === this.i) {
        fill(x + 3, rowY - 2, w - 6, 10, 'rgba(157,91,33,.58)');
        ctx.save(); ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, rowY - 1.5, w - 7, 9); ctx.restore();
      }
      text(String(s).slice(0, 24), x + 13, rowY, blackbird ? (i === this.i ? '#f2d99f' : '#d1d0ca') : (i === this.i ? '#fff0c2' : '#e3deeb'));
      if (i === this.i) text('>', x + 5, rowY, blackbird ? '#e0bd78' : '#ffe3a0');
    });
    if (this.o.length > this.rows) {
      if (this.top > 0) text('^', x + w - 9, y + 2, 2);
      if (this.top + this.rows < this.o.length) text('v', x + w - 9, y + h - 10, 2);
    }
  }
}
function choose(opts, cb, prompt, o) { push(new Choice(opts, cb, prompt, o)); }

class Fade {
  constructor(cb, color = 3) { this.t = 0; this.cb = cb; this.c = color; }
  update() {
    this.t++;
    if (this.t === 14) { this.cb && this.cb(); removeScene(this); scenes.push(this); }
    if (this.t >= 28) removeScene(this);
  }
  draw() { const a = this.t < 14 ? this.t / 14 : (28 - this.t) / 14; ctx.globalAlpha = Math.max(0, Math.min(1, a)); fill(0, 0, W, H, this.c); ctx.globalAlpha = 1; }
}
function fadeTo(cb) { push(new Fade(cb)); }
class Flash { // battle transition: flashes then horizontal wipe
  constructor(cb) { this.t = 0; this.cb = cb; }
  update() { if (++this.t > 40) { removeScene(this); this.cb(); } }
  draw() {
    if (this.t < 24) { if ((this.t >> 2) % 2) fill(0, 0, W, H, 3); }
    else { const n = (this.t - 24) / 16; for (let y = 0; y < H; y += 8) fill(0, y, W * n * (1 + (y % 16 ? 0.2 : 0)), 8, 3); }
  }
}
// toasts (achievements, discoveries, loot) drawn above everything
const toasts = [];
function toast(title, sub, iconName, sfx = 'achievement') { toasts.push({ title, sub, icon: iconName, t: 110 }); SFX[sfx](); }
function drawToasts() {
  const t = toasts[0]; if (!t) return;
  const slide = Math.min(1, (110 - t.t) / 10, t.t / 10);
  const y = Math.round(-26 + 28 * slide);
  frame(4, y, 152, 25, 0);
  if (t.icon) blit(sprFit(t.icon, 14), 8, y + 5);
  text(String(t.title).slice(0, 22), 26, y + 4, 2); text(String(t.sub || '').slice(0, 22), 26, y + 14);
}

// ================================================================ main loop
let lastT = 0, lastRenderT = 0, acc = 0;
function tick() {
  frameN++;
  const s = topScene(); if (s) s.update();
  Physics.step(window.SOLID_AT || null);
  if (shake > 0) shake--;
  if (typeof Tween !== 'undefined') Tween.tick();
  if (toasts[0] && --toasts[0].t <= 0) toasts.shift();
  for (const b of BTNS) { pressed[b] = false; if (held[b]) rep[b]++; }
  window.NET && NET.tick && NET.tick();
}
function render() {
  ctx.save();
  if (shake) ctx.translate(Math.round((Math.random() - 0.5) * Math.min(4, shake)), Math.round((Math.random() - 0.5) * Math.min(4, shake)));
  let i = scenes.length - 1; while (i > 0 && !scenes[i].opaque) i--;
  for (; i < scenes.length; i++) scenes[i].draw();
  ctx.restore();
  drawToasts();
  if (window.DBG && DBG.overlay) DBG.overlay();
  present();
  document.body.classList.add('game-rendered');
}
function present() {
  const sourceW = S.video === 'hd64' ? W * 4 : W, sourceH = S.video === 'hd64' ? H * 4 : H;
  // Keep output sizes honest and bounded: 2K is 1920 px wide, 4K is 3840.
  const requestedW = S.hdRes === '4k' ? 3840 : S.hdRes === '2k' ? 1920 : sourceW;
  const outW = Math.max(sourceW, requestedW);
  const outH = Math.round(sourceH * outW / sourceW);
  if (S.video === 'hd64' && typeof present64 === 'function') return present64(LCD, lctx, outW, outH);
  if (LCD.width !== outW || LCD.height !== outH) { LCD.width = outW; LCD.height = outH; }
  lctx.imageSmoothingEnabled = S.art === 'packs'; lctx.drawImage(cv, 0, 0, outW, outH);
}
function loop(t) {
  requestAnimationFrame(loop);
  if (!lastT) lastT = t;
  acc += Math.min(100, t - lastT); lastT = t;
  let n = 0;
  if (window.DBG && DBG.paused) { acc = 0; while (DBG.steps > 0) { DBG.steps--; tick(); } if (shouldRender(t)) render(); return; }
  const spd = window.DBG ? DBG.speed : 1;
  while (acc >= 1000 / 60 / spd && n < 4 * spd) { acc -= 1000 / 60 / spd; tick(); n++; }
  if (shouldRender(t)) render();
}
function shouldRender(t) {
  const cap = Math.max(1, Math.min(240, Number(S.fps) || 60));
  if (lastRenderT && t - lastRenderT < 1000 / cap - 0.25) return false;
  lastRenderT = t; return true;
}
