// LOST KINGDOM OF SHADOWBANE CHRONICLES — procedural generation: seeded RNG, the 400-creature bestiary,
// 350 bosses, zone maps, dungeons, raids, tower floors, side quests and loot.
'use strict';

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function RNG(seed) {
  let s = (typeof seed === 'string' ? hashStr(seed) : seed >>> 0) || 0x9e3779b9;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = a => a[Math.floor(r() * a.length)];
  r.chance = p => r() < p;
  r.shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return r;
}
const R = RNG(Date.now() & 0xffffffff); // gameplay randomness
const pick = a => a[Math.floor(R() * a.length)];

// ================================================================ dice
function roll(expr, crit = false, maxDice = false) {
  // "2d6+3", "70", "1d4+1"
  const m = String(expr).replace(/\s/g, '').match(/^(\d+)d(\d+)([+-]\d+)?$|^(\d+)$/);
  if (!m) return { total: 0, rolls: [] };
  if (m[4]) return { total: +m[4], rolls: [] };
  let n = +m[1]; const d = +m[2], b = +(m[3] || 0);
  if (crit) n *= 2;
  const rolls = []; for (let i = 0; i < n; i++) rolls.push(maxDice ? d : 1 + Math.floor(R() * d));
  return { total: rolls.reduce((a, c) => a + c, 0) + b, rolls };
}
const d20 = () => 1 + Math.floor(R() * 20);
function diceAvg(expr) { const m = String(expr).match(/^(\d+)d(\d+)([+-]\d+)?$|^(\d+)$/); if (!m) return 0; if (m[4]) return +m[4]; return +m[1] * (+m[2] + 1) / 2 + +(m[3] || 0); }
const mod = s => Math.floor((s - 10) / 2);

// ================================================================ monster stats from level
function monsterNumbers(L, prof = {}) {
  const pb = 2 + Math.floor((Math.min(L, 20) - 1) / 4) + Math.floor(Math.max(0, L - 20) / 40);
  const over = Math.max(0, L - 20);
  return {
    pb,
    ac: 11 + Math.min(8, Math.floor(L / 3)) + Math.floor(over / 25) + (prof.ac || 0),
    hp: Math.round((5 + 5 * L + 0.015 * L * L) * (prof.hp || 1)),
    hit: 2 + pb + Math.min(5, Math.floor(L / 4)) + Math.floor(over / 25),
    dpr: (1.2 + 2.6 * L + 0.004 * L * L) * (prof.dmg || 1),
    dc: 8 + pb + Math.min(5, Math.floor(L / 4)) + Math.floor(over / 25),
    save: Math.floor(L / 4) + 1,
  };
}
function xpForMonster(L, mult = 1) {
  if (L <= 30) { const keys = Object.keys(CR_XP).map(Number).sort((a, b) => a - b); let k = keys[0]; for (const c of keys) if (c <= L) k = c; return Math.round(CR_XP[k] * mult * 0.5); }
  return Math.round(155000 * Math.pow(L / 30, 1.5) * mult * 0.5);
}

// ================================================================ the bestiary: 400 creatures
const BESTIARY = [];
(function buildBestiary() {
  const fams = Object.keys(FAMILIES);
  for (const f of fams) for (const [sub, spr, dt, role] of FAMILIES[f].sub) for (const v of VARIANTS) {
    const tinted = v.tint && spr.startsWith('enemy_') ? `e_${v.tint}_${spr.slice(6)}` : spr;
    BESTIARY.push({ id: `${f}_${sub.toLowerCase().replace(/ /g, '')}_${v.id || 'base'}`, fam: f, sub, variant: v.id, name: (v.name ? v.name + ' ' : '') + sub,
      spr: tinted, dt: v.dt || dt, res: v.res ? [v.res] : [], role, rank: 'normal' });
  }
  // fill to 400 with elite versions of the hardiest roles
  const extra = BESTIARY.filter(b => b.role === 'brute' || b.role === 'guard');
  for (let i = 0; BESTIARY.length < 400; i++) { const b = extra[i % extra.length]; BESTIARY.push(Object.assign({}, b, { id: b.id + '_elite' + i, name: b.name + ' ALPHA', rank: 'elite' })); }
  BESTIARY.forEach((b, i) => { b.no = i + 1; b.lore = LORE_BITS[b.fam]; b.type = FAMILIES[b.fam].name; });
})();
const BEAST_BY_ID = Object.fromEntries(BESTIARY.map(b => [b.id, b]));
const BIOME_VARIANT = { meadow: ['', ''], coast: ['', 'gilded'], marsh: ['venom', ''], jungle: ['venom', ''], snow: ['frost', ''], badlands: ['ash', ''], volcanic: ['ember', 'ash'], dusk: ['shadow', ''], crystal: ['gilded', 'frost'] };
function spawnTable(biome, lvl) {
  const fams = BIOMES[biome].fam, vars = BIOME_VARIANT[biome];
  // collector creatures (stages 1-3) only appear inside their level band when a level is given
  return BESTIARY.filter(b => fams.includes(b.fam) && vars.includes(b.variant) && b.rank === 'normal' && (!b.collector || lvl == null || (lvl >= b.minLvl && lvl <= b.maxLvl)));
}

// ================================================================ 350 bosses
const BOSSES = [];
(function buildBosses() {
  let r = RNG('bosses-v2');
  const name = () => r.pick(BOSS_SYL.a) + r.pick(BOSS_SYL.b);
  const add = (cat, where, lvl, base, extra = {}) => {
    const b = BEAST_BY_ID[base] || null;
    const mechs = r.shuffle(BOSS_MECHS).slice(0, cat === 'raid' || cat === 'arc' ? 3 : 2);
    BOSSES.push(Object.assign({ id: `boss_${BOSSES.length}`, cat, where, lvl, base, mechs, name: `${name()} ${r.pick(BOSS_TITLES)}`,
      spr: b ? b.spr : 'enemy_goblinking', fam: b ? b.fam : 'giant', dt: b ? b.dt : 'slashing', res: b ? b.res.slice() : [] }, extra));
  };
  // arc bosses: handmade from MONSTERS
  ARC_BOSSES.forEach(a => { const m = MONSTERS[a.id]; const z = regionLastZone(REGIONS.find(zz => zz.act === a.act).id);
    add('arc', z.id, Math.max(z.lvl[1] + 1, Math.round(m.cr) + 2), null, { name: a.name || m.name, title: a.title, unique: a.id, spr: m.spr, fam: m.type, dt: m.a[0][3], res: (m.res || []).concat(m.imm || []), act: a.act }); });
  const pickBase = biome => { const t = spawnTable(biome); return r.pick(t.length ? t : BESTIARY).id; };
  // the original content (content wave 3 is added after the world bosses, below, so these ids never shift)
  const dungeonBosses = d => { const z = REGIONS.find(zz => zz.id === d.zone); for (let i = 0; i < 3; i++) add('dungeon', d.id, d.lvl + i, pickBase(z.biome), { order: i }); };
  const raidBosses = d => { const z = REGIONS.find(zz => zz.id === d.zone) || REGIONS[0]; for (let i = 0; i < d.bosses; i++) add('raid', d.id, d.lvl + i * 2, pickBase(z.biome), { order: i }); };
  const trialBosses = t => { for (let i = 0; i < (t.stages || 5); i++) add('trial', t.id, t.lvl + i * 3, r.pick(BESTIARY).id, { order: i }); };
  DUNGEONS.filter(d => !d.v).forEach(dungeonBosses);
  RAIDS.filter(d => !d.v).forEach(raidBosses);
  TRIALS.filter(t => !t.v).forEach(trialBosses);
  for (let f = 5; f <= TOWER.floors; f += 5) add('tower', 'tower', TOWER.baseLvl + f * TOWER.perFloor, r.pick(BESTIARY).id, { floor: f });
  const wild = ZONES.filter(z => !z.town);
  for (let i = 0; BOSSES.length < 350; i++) { const z = wild[i % wild.length]; add('world', z.id, z.lvl[1] + 2, pickBase(z.biome), { order: Math.floor(i / wild.length) }); }
  // content wave 3 (v: 3): new dungeons, raids, trials and towers, from their own seed, after the original 350
  r = RNG('bosses-v3');
  DUNGEONS.filter(d => d.v).forEach(dungeonBosses);
  RAIDS.filter(d => d.v).forEach(raidBosses);
  TRIALS.filter(t => t.v).forEach(trialBosses);
  for (const tw of TOWERS) if (tw.v) for (let f = 5; f <= tw.floors; f += 5) add('tower', tw.id, tw.baseLvl + f * tw.perFloor, r.pick(BESTIARY).id, { floor: f });
})();
const BOSS_BY_ID = Object.fromEntries(BOSSES.map(b => [b.id, b]));

// ================================================================ tiles for a tileset prefix
const TILE_LAYOUT = {
  '.': [0, 0], ',': [1, 4], '"': [3, 3], 'T': [0, 1], 'F': [1, 1], 'D': [1, 0], 'P': [0, 4], 'M': [0, 3], 'N': [1, 3],
  '~': [0, 2], 'W': [1, 2], 'w': [0, 7], 'v': [1, 7], '=': [2, 2], '|': [1, 5], 'X': [2, 3], 'h': [1, 5], 's': [0, 6], 'S': [1, 6],
  'A': [2, 0], 'a': [3, 0], 'K': [2, 4], 'k': [3, 4], 'H': [2, 6], 'J': [2, 7], 'r': [3, 6], 'q': [3, 7], 'R': [2, 6], 'Q': [2, 4],
  'B': [3, 3], // a hub building's footprint: ground underneath, drawn over by its sprite (see m.buildings)
};
const WALKABLE = new Set(['.', ',', '"', 'T', 'F', 'D', '=', '|', 'X', 'h', 's', 'S']);
const ZONE_OF = { '.': 'open', ',': 'open', 'T': 'wood', 'F': 'wood', 'D': 'wood', 's': 'open' };
function worldTiles(prefix, opts = {}) {
  const t = {};
  for (const ch in TILE_LAYOUT) {
    const [r, c] = TILE_LAYOUT[ch];
    const enc = opts.safe ? null : (ch === 's' && !opts.sandEnc ? null : ZONE_OF[ch] || null);
    t[ch] = [`${prefix}_${r}_${c}`, WALKABLE.has(ch) ? 1 : 0, enc, ch === 'h' ? 1 : 0];
  }
  return t;
}
const DUN_LAYOUT = { '#': [1, 1], '.': [0, 3], ',': [1, 3], 'L': [0, 4], 'U': [1, 5], 't': [2, 2], 'A': [2, 3], 'G': [2, 6], 'b': [3, 6], 's': [0, 2], 'n': [0, 1], 'd': [3, 0] };
const DUN_WALK = new Set(['.', ',', 'L', 'U', 'G']);
function dungeonTiles(theme) {
  const p = theme === 'dungeon' ? 'dungeon' : 'd_' + theme, t = {};
  for (const ch in DUN_LAYOUT) { const [r, c] = DUN_LAYOUT[ch]; t[ch] = [`${p}_${r}_${c}`, DUN_WALK.has(ch) ? 1 : 0, null]; }
  return t;
}

// ================================================================ Game Boy pixel tile graphics (auto-tiled)
const GT_KEY = { '.': 'grass', ',': 'meadow', '"': 'ground', 'T': 'tree', 'F': 'pine', 'D': 'dense', 'P': 'single', 'M': 'rock', 'N': 'peak', 'W': 'deep%f', '=': 'bridge%f',
  's': 'sand', 'S': 'sand2', 'A': 'wall', 'a': 'gate', 'K': 'keep', 'k': 'keepdoor', 'H': 'shop', 'J': 'inn', 'r': 'shrine', 'q': 'statue', 'R': 'temple', 'Q': 'arena', 'B': 'ground' };
const WATERS = new Set(['~', 'w', 'v', 'W', '=']), ROADS = new Set(['|', 'h', 'X', '=', 'a', 'k', 'J', 'H']);
function zoneGfx(rows, biome, town) {
  const b = biome === 'meadow' || !biome ? 'meadow' : biome, H = rows.length, W = rows[0].length;
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? null : rows[y][x];
  return rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === '~' || ch === 'w' || ch === 'v') { let m = 0; [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, bit]) => { const n = at(x + dx, y + dy); if (n !== null && !WATERS.has(n)) m |= bit; }); return `gt_${b}_water${m}_%f`; }
    if (ch === '|' || ch === 'h' || ch === 'X') { let m = 0; [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, bit]) => { const n = at(x + dx, y + dy); if (n === null || ROADS.has(n)) m |= bit; }); return `gt_${b}_road${m}`; }
    if (town && (ch === '"' || ch === 'S')) return `gt_${b}_cobble`;
    return `gt_${b}_${GT_KEY[ch] || 'grass'}`;
  }));
}
const GD_KEY = { '.': 'floor', ',': 'floor2', 'L': 'down', 'U': 'up', 't': 'torch%f', 'A': 'altar', 'G': 'gold', 'b': 'barrel', 's': 'statue', 'n': 'sign', 'd': 'door' };
function dungeonGfx(rows, theme) {
  const t = theme || 'dungeon', walk = c => DUN_WALK.has(c);
  return rows.map((row, y) => [...row].map((ch, x) => ch === '#' ? `gd_${t}_${rows[y + 1] && walk(rows[y + 1][x]) ? 'wall' : 'walltop'}` : `gd_${t}_${GD_KEY[ch] || 'floor'}`));
}

// ================================================================ zone map generator
const ZW = 32, ZH = 24;
function noiseGrid(r, w, h, cell) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = [];
  for (let i = 0; i < gw * gh; i++) g.push(r());
  const at = (x, y) => g[y * gw + x];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx, b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}
function neighborsOf(z) {
  const n = {};
  for (const o of ZONES) {
    if (o === z) continue;
    if (o.fx === z.fx && o.fy === z.fy - 1) n.N = o.id; if (o.fx === z.fx && o.fy === z.fy + 1) n.S = o.id;
    if (o.fy === z.fy && o.fx === z.fx - 1) n.W = o.id; if (o.fy === z.fy && o.fx === z.fx + 1) n.E = o.id;
  }
  // expansions link to their predecessor via the coast (first zone of each expansion -> ardenhold portal)
  return n;
}
const EXIT_POS = { N: [16, 0], S: [16, ZH - 1], W: [0, 12], E: [ZW - 1, 12] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

function carve(g, x0, y0, x1, y1, vertFirst) { // L-shaped road
  let x = x0, y = y0;
  const put = (cx, cy, horiz) => { const c = g[cy][cx]; if (!'AaKkHJrqRQB'.includes(c)) g[cy][cx] = horiz ? 'h' : '|'; };
  if (vertFirst) while (y !== y1) { put(x, y, false); y += Math.sign(y1 - y); }
  while (x !== x1) { put(x, y, true); x += Math.sign(x1 - x); }
  while (y !== y1) { put(x, y, false); y += Math.sign(y1 - y); }
  put(x, y, false);
}
function buildZone(z) {
  const bio = BIOMES[z.biome === 'meadow' ? 'meadow' : z.biome] || BIOMES.meadow;
  const r = RNG('zone-' + z.id);
  const nb = neighborsOf(z);
  let g;
  if (z.hand) {
    g = ELDERWOOD_MAP.map(row => row.split(''));
  } else if (z.town) {
    g = buildCity(r);
  } else {
    const elev = noiseGrid(r, ZW, ZH, 6), moist = noiseGrid(r, ZW, ZH, 5), det = noiseGrid(r, ZW, ZH, 2);
    g = [];
    for (let y = 0; y < ZH; y++) {
      const row = [];
      for (let x = 0; x < ZW; x++) {
        const e = elev(x, y) * 0.8 + det(x, y) * 0.2, m = moist(x, y);
        let c = r.chance(0.5) ? '.' : ',';
        if (bio.sand && m < bio.sand) c = r.chance(0.8) ? 's' : 'S';
        if (m > 1 - bio.forest) c = r.pick(['T', 'F', 'D', 'T']);
        if (e < bio.water) c = r.chance(0.85) ? '~' : 'W';
        else if (e < bio.water + 0.04 && bio.sand) c = 's';
        if (e > 1 - bio.mount) c = e > 1 - bio.mount / 2 ? 'N' : 'M';
        if (c === '.' && r.chance(0.03)) c = 'P';
        row.push(c);
      }
      g.push(row);
    }
    for (let x = 0; x < ZW; x++) { g[0][x] = 'M'; g[ZH - 1][x] = 'M'; }
    for (let y = 0; y < ZH; y++) { g[y][0] = 'M'; g[y][ZW - 1] = 'M'; }
  }
  const hub = z.town ? [16, 12] : z.hand ? [3, 8] : [r.int(10, 21), r.int(8, 15)];
  if (z.town && z.id !== z.region) g = buildHarbor(r);
  // exits and roads
  const exits = {};
  for (const side in nb) {
    const [ex, ey] = (z.exitPos && z.exitPos[side]) || EXIT_POS[side];
    const [dx, dy] = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[side];
    exits[side] = { x: ex, y: ey, to: nb[side], ix: ex + dx, iy: ey + dy };
    carve(g, ex, ey, hub[0], hub[1], side === 'N' || side === 'S');
  }
  // points of interest
  const poi = {};
  const free = () => { for (let k = 0; k < 400; k++) { const x = r.int(3, ZW - 4), y = r.int(3, ZH - 4); if (WALKABLE.has(g[y][x]) && g[y][x] !== 'h' && g[y][x] !== '|') return [x, y]; } return [hub[0] + 1, hub[1]]; };
  if (!z.town) {
    const dg = z.last ? DUNGEONS.find(d => d.zone === z.region) : null;
    if (dg && !z.hand) { const [x, y] = free(); g[y][x] = 'k'; g[y - 1][x] = 'K'; carve(g, x, y + 1, hub[0], hub[1]); poi.dungeon = { x, y, id: dg.id }; }
    if (dg && z.hand) poi.dungeon = { x: 27, y: 3, id: dg.id };
    const rd = z.last ? RAIDS.find(d => d.zone === z.region) : null;
    if (rd) { const [x, y] = free(); g[y][x] = 'R'; carve(g, x, y + 1, hub[0], hub[1]); poi.raid = { x, y, id: rd.id }; }
    const [wx, wy] = z.hand ? [4, 9] : free(); poi.waypoint = { x: wx, y: wy };
    if (!z.hand) { // small camp at hub
      for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) if (g[hub[1] + j] && g[hub[1] + j][hub[0] + i] && !'|h'.includes(g[hub[1] + j][hub[0] + i])) g[hub[1] + j][hub[0] + i] = '"';
    }
  }
  // gathering profession nodes, world boss spots
  const herb = HERB_BY_BIOME[z.biome] || 'peacebloom';
  const nodes = [], bosses = [];
  if (!z.town) {
    const resources = [
      ['herb', herb], ['mining', 'iron_ore'], ['forestry', 'sap'], ['hidecraft', 'hide'],
      ['salvaging', 'scrap'], ['relic', 'relic_fragment'], ['cultivation', 'field_fiber'], ['beast_lore', 'bone_dust'],
    ];
    for (const [profession, item] of resources) { const [x, y] = free(); nodes.push([x, y, profession, item]); }
    const wb = BOSSES.filter(b => b.cat === 'world' && b.where === z.id).slice(0, 4);
    wb.forEach(b => { const [x, y] = free(); bosses.push({ id: b.id, x, y }); });
    const arc = BOSSES.find(b => b.cat === 'arc' && b.where === z.id);
    if (arc) { const [x, y] = free(); bosses.push({ id: arc.id, x, y, arc: true }); }
  }
  const buildings = !z.town && !z.hand && z.id === z.region ? placeHubBuildings(z, g, hub, exits, poi, nodes, bosses) : [];
  const rows = g.map(rw => rw.join(''));
  const prefix = bio.tiles;
  const tiles = worldTiles(prefix, { safe: z.town, sandEnc: z.biome === 'badlands' || z.biome === 'coast' });
  // areas = quadrants
  const ar = RNG('areas-' + z.id), names = ar.shuffle(ZONE_AREAS);
  const areas = [[1, 1, 15, 11], [16, 1, 15, 11], [1, 12, 15, 11], [16, 12, 15, 11]].map((rc, i) => ({ id: `${z.id}_a${i}`, r: rc, name: `${z.name.split(' ')[0]} ${names[i]}` }));
  return { id: z.id, zone: z, rows, tiles, gfx: zoneGfx(rows, z.biome, z.town), exits, poi, nodes, bosses, buildings, hub, areas, name: z.name, music: typeof GBQMusic !== 'undefined' ? GBQMusic.zoneMusic(z, z.town ? 'town' : (MUSIC_BY_BIOME[z.biome] || 'field')) : (z.town ? 'town' : (MUSIC_BY_BIOME[z.biome] || 'field')), lvl: z.lvl, biome: z.biome };
}
const MUSIC_BY_BIOME = { meadow: 'field', coast: 'coast', marsh: 'marsh', jungle: 'jungle', snow: 'snow', badlands: 'desert', desert: 'desert', oasis: 'coast', savanna: 'field', steppe: 'field', forest: 'field', deepforest: 'jungle', hills: 'field', mountains: 'snow', volcanic: 'volcano', dusk: 'dusk', ruins: 'dungeon', corruption: 'dusk', aether: 'crystal', crystal: 'crystal', mushroom: 'jungle', ocean: 'coast', river: 'coast', frozen: 'snow', sky: 'crystal' };
// ================================================================ hub buildings (towns and villages)
// Every wild region hub is a settlement. Villages get an inn, a general store and a shrine; towns
// (every third region, and the first region of each expansion) add a smithy, stable, post office
// and bank. Each building is a 2x2 footprint ('B' tiles, solid) drawn with an asset-pack sprite; you
// use it by facing any of its tiles. Placement runs after everything else in buildZone, from its own
// seed, never covers a road, exit, node, boss, waypoint or entrance, and is undone if it would cut
// anything off from the hub. Then a path is laid from its door to the camp.
const HUB_BUILDINGS = {
  VILLAGE: [['inn', 'INN', 0], ['vendor', 'GENERAL STORE', 3], ['shrine', 'SHRINE', 8], ['house', 'COTTAGE'], ['house', 'COTTAGE'], ['mill', 'WINDMILL', 2]],
  TOWN: [['inn', 'INN', 0], ['vendor', 'GENERAL STORE', 3], ['blacksmith', 'SMITHY', 11], ['stable', 'STABLE', 7], ['mail', 'POST OFFICE', 4], ['bank', 'BANK', 13],
    ['shrine', 'SHRINE', 8], ['house', 'HOUSE'], ['house', 'HOUSE'], ['house', 'HOUSE'], ['mill', 'WINDMILL', 5]],
};
const HOUSE_SPRITES = [9, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
const BUILD_ON = new Set(['.', ',', '"', 's', 'S', 'T', 'F', 'D']);
// cheapest path from a door to the camp: open ground costs 1, water and rock 6, buildings and the border can't be crossed
function lane(g, x0, y0, x1, y1) {
  const H = g.length, Wd = g[0].length, cost = new Map(), from = new Map(), k = (x, y) => y * Wd + x, q = [[0, x0, y0]];
  cost.set(k(x0, y0), 0);
  while (q.length) {
    let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
    const [c, x, y] = q.splice(bi, 1)[0];
    if (x === x1 && y === y1) break;
    if (c > cost.get(k(x, y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= Wd - 1 || ny >= H - 1) continue;
      const ch = g[ny][nx]; if ('BAaKkHJrqRQ'.includes(ch)) continue;
      const nc = c + (WALKABLE.has(ch) ? (ch === '|' || ch === 'h' ? 0.5 : 1) : 6);
      if (nc < (cost.has(k(nx, ny)) ? cost.get(k(nx, ny)) : Infinity)) { cost.set(k(nx, ny), nc); from.set(k(nx, ny), k(x, y)); q.push([nc, nx, ny]); }
    }
  }
  if (!cost.has(k(x1, y1))) return;
  const path = []; for (let p = k(x1, y1); p !== undefined; p = from.get(p)) path.push([p % Wd, Math.floor(p / Wd)]);
  path.reverse();
  path.forEach(([x, y], i) => {
    if (g[y][x] === '|' || g[y][x] === 'h' || g[y][x] === 'X') return;
    const [px, py] = path[i - 1] || path[i + 1] || [x, y - 1];
    g[y][x] = py === y ? 'h' : '|';
  });
}
function hubSettlementKind(z) {
  if (!z || z.town || z.id !== z.region) return null;
  if (z.exp) return /_0$/.test(z.region) ? 'TOWN' : 'VILLAGE';
  return REGIONS.findIndex(r => r.id === z.region) % 3 === 0 ? 'TOWN' : 'VILLAGE';
}
function placeHubBuildings(z, g, hub, exits, poi, nodes, bosses) {
  const kind = hubSettlementKind(z); if (!kind) return [];
  const r = RNG('buildings-' + z.id), H = g.length, Wd = g[0].length, out = [];
  const key = (x, y) => x + ',' + y, keep = new Set(), targets = [];
  const hold = (x, y, reach = true) => { keep.add(key(x, y)); if (reach) targets.push([x, y]); };
  for (const e of Object.values(exits)) { hold(e.x, e.y); hold(e.ix, e.iy); }
  for (const p of Object.values(poi)) if (p && Number.isFinite(p.x)) { hold(p.x, p.y); if (p === poi.dungeon) hold(p.x, p.y - 1, false); }
  for (const [x, y] of nodes) hold(x, y);
  for (const b of bosses) hold(b.x, b.y);
  // the camp, the warden, and room around the hub for the settlement's trainers
  for (let y = hub[1] - 2; y <= hub[1] + 4; y++) for (let x = hub[0] - 3; x <= hub[0] + 3; x++) keep.add(key(x, y));
  const walk = c => WALKABLE.has(c);
  const reachAll = () => {
    const seen = new Set([key(hub[0], hub[1])]), q = [[hub[0], hub[1]]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= Wd || ny >= H || seen.has(k) || !walk(g[ny][nx])) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    const ok = ([x, y]) => seen.has(key(x, y)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(x + dx, y + dy)));
    return targets.every(ok) && out.every(b => seen.has(key(b.x, b.y + 1)) || seen.has(key(b.x + 1, b.y + 1)));
  };
  // only what the hub can already reach has to stay reachable (some nodes sit across water)
  { const all = targets.splice(0); targets.push(...all.filter(t => { targets.length = 0; targets.push(t); return reachAll(); })); }
  // candidate spots ring the hub, nearest first with a little seeded jitter
  const spots = [];
  for (let y = 3; y <= H - 4; y++) for (let x = 2; x <= Wd - 4; x++) {
    const d = Math.max(Math.abs(x + 0.5 - hub[0]), Math.abs(y - 0.5 - hub[1]));
    if (d >= 3 && d <= 11) spots.push([x, y, d + r() * 2.5]);
  }
  spots.sort((a, b) => a[2] - b[2]);
  const near = (x, y) => out.some(b => x >= b.x - 2 && x <= b.x + 3 && y >= b.y - 2 && y <= b.y + 2);
  for (const [svc, name, spr] of HUB_BUILDINGS[kind]) {
    for (const [x, y] of spots) {
      const foot = [[x, y - 1], [x + 1, y - 1], [x, y], [x + 1, y]], front = [[x, y + 1], [x + 1, y + 1]];
      if (foot.some(([fx, fy]) => !BUILD_ON.has(g[fy][fx]) || keep.has(key(fx, fy)))) continue;
      if (!front.some(([fx, fy]) => walk(g[fy][fx]) && !keep.has(key(fx, fy)) || walk(g[fy][fx]) && (g[fy][fx] === '|' || g[fy][fx] === 'h'))) continue;
      if (near(x, y)) continue;
      const before = foot.map(([fx, fy]) => g[fy][fx]);
      foot.forEach(([fx, fy]) => { g[fy][fx] = 'B'; });
      const b = { x, y, svc, name, spr: 'ap_buildings_' + String(spr != null ? spr : r.pick(HOUSE_SPRITES)).padStart(3, '0'), kind };
      out.push(b);
      if (!walk(g[y + 1][x]) && !walk(g[y + 1][x + 1])) { out.pop(); foot.forEach(([fx, fy], i) => { g[fy][fx] = before[i]; }); continue; }
      if (!reachAll()) { out.pop(); foot.forEach(([fx, fy], i) => { g[fy][fx] = before[i]; }); continue; }
      foot.forEach(([fx, fy]) => keep.add(key(fx, fy)));
      break;
    }
  }
  // paths from each door to the camp (only the shops; houses sit off the lanes)
  for (const b of out) if (b.svc !== 'house' && b.svc !== 'mill') lane(g, walk(g[b.y + 1][b.x]) ? b.x : b.x + 1, b.y + 1, hub[0], hub[1] + 1);
  return out;
}
function buildHarbor(r) {
  const g = Array.from({ length: ZH }, () => Array(ZW).fill('"'));
  for (let x = 0; x < ZW; x++) { g[0][x] = 'M'; g[1][x] = 'A'; }
  for (let y = 0; y < ZH; y++) { g[y][0] = 'A'; g[y][ZW - 1] = 'M'; }
  for (let y = 14; y < ZH; y++) for (let x = 1; x < ZW - 1; x++) g[y][x] = y === 14 ? 'S' : (r.chance(0.8) ? '~' : 'W');
  for (let y = 15; y < 20; y++) { g[y][8] = '='; g[y][22] = '='; }
  for (let x = 1; x < ZW - 1; x++) g[12][x] = 'h';
  [[5, 6, 'H'], [11, 6, 'J'], [20, 6, 'q'], [26, 6, 'r'], [8, 20, 'Q'], [22, 20, 'R']].forEach(([x, y, c]) => { g[y][x] = c; });
  return g;
}
function buildCity(r) {
  const g = Array.from({ length: ZH }, () => Array(ZW).fill('"'));
  for (let x = 0; x < ZW; x++) { g[0][x] = 'M'; g[ZH - 1][x] = 'M'; g[1][x] = 'A'; g[ZH - 2][x] = 'A'; }
  for (let y = 0; y < ZH; y++) { g[y][0] = 'M'; g[y][ZW - 1] = 'M'; g[y][1] = 'A'; g[y][ZW - 2] = 'A'; }
  for (let x = 1; x < ZW - 1; x++) g[12][x] = 'h';
  for (let y = 1; y < ZH - 1; y++) g[y][16] = '|';
  for (let y = 9; y <= 15; y++) for (let x = 12; x <= 20; x++) g[y][x] = 'S';
  // buildings (service tiles) — see CITY_SVC
  const B = { H: [[5, 5], [26, 5]], J: [[5, 18], [26, 18]], r: [[10, 4]], q: [[22, 4], [10, 19]], K: [[16, 3]], Q: [[22, 19]], R: [[28, 12]] };
  for (const ch in B) B[ch].forEach(([x, y]) => { g[y][x] = ch; if (ch === 'K') g[y + 1][x] = 'k'; });
  ['~', '~', '~'].forEach((_, i) => { g[7][3 + i] = '~'; g[17][27 + i] = '~'; });
  return g;
}

// ================================================================ dungeon / raid / tower generator
// buildInstance lives in rooms.js (designed rooms for dungeons, raids, trials and the tower)

// ================================================================ side quests per zone
function sideQuests(z) {
  const r = RNG('sq-' + z.id), out = [];
  const table = spawnTable(z.biome);
  for (let i = 0; i < 6; i++) {
    const [verb, kind, text] = SIDE_TEMPLATES[(i + r.int(0, 7)) % SIDE_TEMPLATES.length];
    const fam = r.pick(table.length ? table : BESTIARY);
    const npc = `${r.pick(NPC_FIRST)} THE ${r.pick(NPC_ROLE)}`;
    const area = r.pick(ZONE_AREAS);
    const wb = BOSSES.filter(b => b.cat === 'world' && b.where === z.id);
    const boss = wb.length ? r.pick(wb) : null;
    const n = kind === 'kill' ? r.int(4, 8) : kind === 'gather' ? r.int(3, 5) : kind === 'fish' ? 3 : 1;
    if (kind === 'worldboss' && !boss) continue;
    out.push({ id: `sq_${z.id}_${i}`, zone: z.id, name: `${verb}: ${(kind === 'kill' || kind === 'elite') ? fam.sub : kind === 'worldboss' ? boss.name.split(' ')[0] : area}`.slice(0, 24),
      kind, target: kind === 'kill' || kind === 'elite' ? fam.fam : kind === 'worldboss' ? boss.id : kind === 'gather' ? HERB_BY_BIOME[z.biome] : null,
      count: n, npc, text: text.replace('{fam}', fam.sub + 'S').replace('{area}', area).replace('{npc}', npc).replace('{n}', n).replace('{boss}', boss ? boss.name : ''),
      xp: Math.round(xpForMonster(z.lvl[0] + 1) * (4 + n)), gold: 10 + z.lvl[0] * 6, dc: 10 + Math.floor(z.lvl[0] / 3) });
  }
  return out;
}

// ================================================================ loot generation
let ITEM_UID = 1;
function rollRarity(lvl, mfPct = 0, boss = false, diffLoot = 1) {
  const luck = (1 + mfPct / 100) * diffLoot;
  const x = R() / luck;
  if (boss) { if (x < 0.04) return 5; if (x < 0.25) return 4; return 3; }
  if (lvl >= 8 && x < 0.004) return 5;
  if (lvl >= 5 && x < 0.02) return 4;
  if (x < 0.07) return 3;
  if (x < 0.25) return 2;
  if (x < 0.75) return 1;
  return 0;
}
const AFFIX_K = { crit: 1.2, critdmg: 5, dodge: 0.8, block: 1.2, leech: 0.4, haste: 1.2, dmg: 3, heal: 3, resist: 1.2, thorns: 2, mf: 4, gf: 5, xp: 1.5, hp: 5, acb: 0.2, hit: 0.2, fire: 4, cold: 4, lightning: 4, necrotic: 4, radiant: 4 };
function makeItem(opts = {}) {
  const lvl = Math.max(1, Math.min(720, Math.floor(Number(opts.lvl) || 1))), rar = opts.rarity != null ? Math.max(0, Math.min(8, Math.floor(Number(opts.rarity) || 0))) : rollRarity(lvl, opts.mf, opts.boss, opts.loot);
  const r = R;
  let kind = opts.kind || r.pick(['weapon', 'weapon', 'armor', 'armor', 'wondrous', 'wondrous', 'wondrous', 'wondrous']);
  const it = { uid: ITEM_UID++, kind, rarity: rar, ilvl: lvl, rank: rankFor(lvl).n, plus: RARITY[rar].plus, affixes: [] };
  applyGearProgression(it);
  if (rar === 0) it.plus = -1;
  if (kind === 'weapon') {
    const leg = rar === 5 ? r.pick(LEGENDARY_WEAPON) : null;
    it.base = opts.base || (leg ? leg.base : r.pick(Object.keys(WEAPONS)));
    if (leg) { it.legend = leg; it.name = leg.name; }
  } else if (kind === 'armor') {
    it.base = opts.base || r.pick(Object.keys(ARMORS));
  } else {
    const w = opts.base ? WONDROUS.find(x => x.id === opts.base) : r.pick(WONDROUS);
    it.base = w.id; it.slot = w.slot; if (rar < 2) it.rarity = 2;
  }
  const n = [0, 0, 1, 2, 3, 4][it.rarity];
  const pool = r.shuffle(AFFIX_POOL);
  for (let i = 0; i < n; i++) {
    const s = pool[i], k = AFFIX_K[s] || 1;
    let v = k * (1 + lvl / 12) * (0.6 + it.rarity * 0.25) * (0.7 + r() * 0.3);
    v = s === 'acb' || s === 'hit' ? Math.max(1, Math.round(v)) : Math.max(1, Math.round(v));
    it.affixes.push([s, Math.min(SUBSTATS[s].max, v)]);
  }
  if (!it.name) it.name = itemBaseName(it);
  it.value = Math.max(1, Math.round((itemBaseCost(it) + 5 * lvl) * RARITY[it.rarity].value));
  it.attune = !!RARITY[it.rarity].attune;
  applyGearProgression(it); // Recompute after wondrous-item rarity normalization.
  return it;
}
function itemBaseName(it) {
  const b = it.kind === 'weapon' ? WEAPONS[it.base].name : it.kind === 'armor' ? ARMORS[it.base].name : WONDROUS.find(w => w.id === it.base).name;
  if (it.rarity === 0) return 'WORN ' + b;
  return (it.plus > 0 ? `+${it.plus} ` : '') + b;
}
function itemBaseCost(it) { return it.kind === 'weapon' ? WEAPONS[it.base].cost : it.kind === 'armor' ? ARMORS[it.base].cost / 4 : 20; }
function itemSlot(it) { if (it.kind === 'weapon') return 'weapon'; if (it.kind === 'armor') return ARMORS[it.base].type === 'shield' ? 'offhand' : 'armor'; const s = it.slot || (WONDROUS.find(w => w.id === it.base) || {}).slot; return s === 'ring' ? 'ring1' : s === 'trinket' ? 'trinket1' : s; }
function itemIcon(it) { if (typeof nesItemIcon === 'function') { const n = nesItemIcon(it); if (n && IMG[n]) return n; } return it.kind === 'weapon' ? WEAPONS[it.base].icon : it.kind === 'armor' ? ARMORS[it.base].icon : WONDROUS.find(w => w.id === it.base).icon; }
