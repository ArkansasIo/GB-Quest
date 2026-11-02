'use strict';
// ================================================================ INSTANCE ROOMS
// Designed rooms for dungeons, raids, trials and the tower. Instances are laid out on a grid of cells:
// a main path from the ENTRANCE to the BOSS ARENA, with side rooms (vaults, shrines, ossuaries) hanging
// off it. Every room type has its own shape, props and job. Raids add guardian chambers per boss, trials
// are an antechamber + an arena where waves appear one at a time, and each tower floor uses one of six
// layouts with a floor modifier.
//
// Map glyphs: #wall .floor ,cracked L exit U stairs-up t torch A altar G gold b barrel s statue n sign
//             d door D seal o pillar ^ spikes p pool x bones h shelf i bars B brazier _ rug T throne

Object.assign(DUN_LAYOUT, { 'o': [0, 2], '^': [1, 3], 'p': [1, 1], 'x': [1, 3], 'h': [0, 1], 'i': [1, 1], 'B': [2, 2], '_': [0, 3], 'T': [2, 3], 'D': [3, 0] });
['d', '^', 'x', '_'].forEach(c => DUN_WALK.add(c));
Object.assign(GD_KEY, { 'o': 'pillar', '^': 'spikes', 'p': 'pool%f', 'x': 'bones', 'h': 'shelf', 'i': 'bars', 'B': 'brazier%f', '_': 'rug', 'T': 'throne', 'D': 'seal', 'd': 'door' });

const ROOM_TYPES = {
  entrance: { name: 'ENTRY HALL', desc: 'The way back out.' },
  guard: { name: 'GUARD POST', desc: 'Sentries keep watch here.', pull: 1 },
  pillars: { name: 'PILLAR HALL', desc: 'Columns hide the foe.', pull: 1 },
  traps: { name: 'TRAP GALLERY', desc: 'Mind the spikes.', pull: 0.4 },
  barracks: { name: 'BARRACKS', desc: 'Bones and old bunks.', pull: 1, big: 1 },
  flooded: { name: 'FLOODED HALL', desc: 'Keep to the walkways.', pull: 0.5 },
  library: { name: 'LIBRARY', desc: 'Dusty tomes line the walls.', pull: 0.8 },
  prison: { name: 'PRISON BLOCK', desc: 'Empty cells. Mostly.', pull: 1 },
  crossroads: { name: 'CROSSROADS', desc: 'Paths meet under old statues.' },
  vault: { name: 'TREASURE VAULT', desc: 'Gold glints behind the door.' },
  shrine: { name: 'SHRINE', desc: 'Pray at the altar to heal.' },
  ossuary: { name: 'OSSUARY', desc: 'Something stirs in the bones.', pull: 1, elite: 1 },
  guardian: { name: 'GUARDIAN CHAMBER', desc: 'A guardian bars the way.' },
  arena: { name: 'THRONE ROOM', desc: 'The master of this place awaits.' },
  trialArena: { name: 'THE ARENA', desc: 'Survive every wave.' },
};
const PATH_TYPES = ['guard', 'pillars', 'traps', 'barracks', 'flooded', 'library', 'prison', 'crossroads', 'guard', 'pillars'];
const SIDE_TYPES = ['vault', 'shrine', 'ossuary', 'vault', 'shrine'];
const TOWER_SHAPES = ['hall', 'ring', 'cross', 'gauntlet', 'garden', 'maze'];
const TOWER_MODS = [
  { id: 'none', name: 'CALM FLOOR', desc: 'No modifier.' },
  { id: 'fortified', name: 'FORTIFIED', desc: 'Foes have +30% HP.', hp: 1.3 },
  { id: 'sharpened', name: 'SHARPENED', desc: 'Foes hit more often (+2).', hit: 2 },
  { id: 'swarming', name: 'SWARMING', desc: 'Every pack has an extra foe.', extra: 1 },
  { id: 'gilded', name: 'GILDED', desc: 'Double gold, +25% XP.', gold: 2, xp: 1.25 },
  { id: 'blessed', name: 'BLESSED', desc: 'A shrine waits on this floor.', shrine: 1 },
  { id: 'cursed', name: 'CURSED', desc: 'Foes +20% HP and +1 hit, +50% XP.', hp: 1.2, hit: 1, xp: 1.5 },
];

function buildInstance(kind, def, floor = 0) {
  const r = RNG(`${kind}-${def.id}-${floor}`), theme = def.theme || 'dungeon';
  const tier = Math.max(1, Math.min(9, Math.floor(Number(G && G.difficulty) || 2)));
  const lvl = (def.lvl ?? def.baseLvl ?? 1) + (kind === 'tower' ? floor * TOWER.perFloor : 0);
  const table = kind === 'tower' ? BESTIARY : spawnTable((REGIONS.find(z => z.id === def.zone) || { biome: 'dusk' }).biome);
  const mob = () => r.pick(table.length ? table : BESTIARY).id;
  const bosses = kind === 'tower' ? BOSSES.filter(b => b.cat === 'tower' && b.floor === floor)
    : BOSSES.filter(b => b.where === def.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  const M = kind === 'tower' ? towerLayout(r, floor) : kind === 'trial' ? trialLayout(r) : gridLayout(r, kind, bosses.length);
  const { g, rooms } = M, H = g.length, W = g[0].length;
  const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W) ? g[y][x] : '#';
  const set = (x, y, c) => { if (y > 0 && y < H - 1 && x > 0 && x < W - 1) g[y][x] = c; };
  const inside = (o, x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
  const keep = new Set(M.keep || []); // tiles that must stay walkable (corridor mouths, spines)
  const K = (x, y) => keep.add(x + ',' + y);
  // protect each room's centre cross so decor never cuts a room in half
  for (const o of rooms) { for (let x = o.x; x < o.x + o.w; x++) K(x, o.cy); for (let y = o.y; y < o.y + o.h; y++) K(o.cx, y); }
  const free = (x, y) => at(x, y) === '.' && !keep.has(x + ',' + y);
  const block = (x, y, c) => { if (free(x, y)) set(x, y, c); };
  const wallAbove = (o, c, n) => { const xs = []; for (let x = o.x; x < o.x + o.w; x++) if (at(x, o.y - 1) === '#' && at(x, o.y) !== '#') xs.push(x); for (const x of r.shuffle ? r.shuffle(xs).slice(0, n) : xs.filter((_, i) => i % Math.max(1, Math.floor(xs.length / n)) === 0).slice(0, n)) set(x, o.y - 1, c); };
  const pulls = [], vaults = [], seals = [], shrines = [];
  let pi = 0, chest = null;
  const mod = kind === 'tower' && floor >= 3 ? TOWER_MODS[1 + (hashStr('mod' + floor) % (TOWER_MODS.length - 1))] : TOWER_MODS[0];
  const pack = (n, x, y, extra = {}) => pulls.push({ id: `p${++pi}`, x, y, mobs: Array.from({ length: n + (mod.extra || 0) }, mob), lvl: lvl + r.int(0, 1), ...extra });
  const bossPull = (b, x, y, extra = {}) => pulls.push({ id: `p${++pi}`, x, y, boss: b.id, lvl: b.lvl, ...extra });
  const bossQueue = bosses.slice();
  const finalBoss = kind === 'tower' ? bossQueue[bossQueue.length - 1] : bossQueue.pop();

  // ---------------------------------------------------------------- dress each room
  for (const o of rooms) {
    const T0 = ROOM_TYPES[o.type] || ROOM_TYPES.guard; o.name = T0.name; o.desc = T0.desc;
    const { x, y, w, h, cx, cy } = o;
    // floor texture
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (at(i, j) === '.' && r() < 0.1) set(i, j, ',');
    // torches on the north wall of most rooms
    if (!['flooded', 'vault'].includes(o.type)) for (let i = x + 1; i < x + w - 1; i += 3) if (at(i, y - 1) === '#' && r() < 0.6) set(i, y - 1, 't');
    switch (o.type) {
      case 'entrance': {
        set(o.ex ?? x, o.ey ?? cy, 'L'); K(o.ex ?? x, o.ey ?? cy);
        if (at(cx, y - 1) === '#') set(cx, y - 1, 'n');
        block(x + w - 1, y, 'b'); block(x + w - 1, y + h - 1, 'b');
        if (kind === 'trial' || (mod.shrine && kind === 'tower')) { set(x + 1, y, 'A'); K(x + 1, y + 1); shrines.push({ x: x + 1, y, id: 'sh_entry' }); }
        break;
      }
      case 'guard': for (const [i, j] of [[x, y], [x + w - 1, y], [x, y + h - 1]]) block(i, j, r.pick(['b', 'b', 's'])); pack(r.int(2, 3), cx, cy); break;
      case 'pillars': for (let j = y + 1; j < y + h - 1; j += 2) for (let i = x + 1; i < x + w - 1; i += 2) block(i, j, 'o'); pack(r.int(2, 3), cx, cy); break;
      case 'traps': {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (at(i, j) === '.' || at(i, j) === ',') { if ((i + j) % 2 === 0 && !(i === cx && j === cy)) set(i, j, '^'); }
        if (r() < T0.pull) pack(2, cx, cy);
        break;
      }
      case 'barracks': for (let i = x; i < x + w; i++) { if (r() < 0.5) block(i, y, r.pick(['b', 'x', 'x'])); if (r() < 0.5) block(i, y + h - 1, r.pick(['x', 'b'])); } pack(r.int(3, 4), cx, cy); break;
      case 'flooded': for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) block(i, j, 'p'); if (r() < T0.pull) pack(2, cx, cy); break;
      case 'library': wallAbove(o, 'h', Math.max(2, w - 2)); for (let i = x + 1; i < x + w - 1; i += 3) block(i, y + h - 1, 'h'); if (r() < T0.pull) pack(2, cx, cy); break;
      case 'prison': for (let i = x; i < x + w; i++) { if (i % 2 === 0) { block(i, y, 'i'); block(i, y + h - 1, 'i'); } else { if (r() < 0.4) block(i, y, 'x'); } } pack(r.int(2, 3), cx, cy); break;
      case 'crossroads': for (const [i, j] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) block(i, j, 's'); break;
      case 'vault': {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (free(i, j) && r() < 0.35) set(i, j, 'G');
        block(x, y, 'b'); block(x + w - 1, y + h - 1, 'b');
        vaults.push({ x: cx, y: Math.max(y, cy - 1), id: `v${vaults.length}` }); K(cx, cy);
        if (o.door) set(o.door[0], o.door[1], 'd');
        break;
      }
      case 'shrine': {
        // the altar stands against the wall opposite the door; a rug runs from the door to it
        const fromTop = o.door ? o.door[1] < y : false, ax = cx, ay = fromTop ? y + h - 1 : y, dy = fromTop ? -1 : 1;
        set(ax, ay, 'A'); K(ax, ay + dy);
        for (let j = ay + dy; j >= y && j < y + h; j += dy) if (at(ax, j) === '.' || at(ax, j) === ',') set(ax, j, '_');
        block(ax - 2, ay, 'B'); block(ax + 2, ay, 'B');
        shrines.push({ x: ax, y: ay, id: `sh${shrines.length}` });
        if (o.door) set(o.door[0], o.door[1], 'd');
        break;
      }
      case 'ossuary': {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (free(i, j) && r() < 0.4) set(i, j, r() < 0.15 ? 's' : 'x');
        pack(1, cx, cy, { elite: true, lvl: lvl + 3 });
        vaults.push({ x: x + w - 1, y: y + h - 1, id: `v${vaults.length}`, needs: `p${pi}` }); set(x + w - 1, y + h - 1, '.');
        if (o.door) set(o.door[0], o.door[1], 'd');
        break;
      }
      case 'guardian': {
        for (const [i, j] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) block(i, j, 'o');
        block(x, y, 'B'); block(x + w - 1, y, 'B');
        const b = bossQueue.shift(); if (b) bossPull(b, cx, cy, { guardian: true }); else pack(3, cx, cy, { elite: true });
        break;
      }
      case 'arena': case 'trialArena': {
        // braziers in the corners, a ring of pillars, a rug to the throne on the far wall
        block(x, y, 'B'); block(x + w - 1, y, 'B'); block(x, y + h - 1, 'B'); block(x + w - 1, y + h - 1, 'B');
        for (let i = x + 2; i < x + w - 2; i += 3) { block(i, y + 1, 'o'); block(i, y + h - 2, 'o'); }
        if (o.type === 'arena') {
          const tx = x + w - 1; for (let i = o.ex ?? x; i < tx; i++) if (at(i, cy) === '.' || at(i, cy) === ',') set(i, cy, '_');
          set(tx, cy, 'T'); K(tx - 1, cy);
          chest = { x: tx, y: cy - 1 >= y ? cy - 1 : cy + 1, id: `chest_${def.id}_${floor}` }; set(chest.x, chest.y, '.');
          if (finalBoss) bossPull(finalBoss, tx - 2, cy, { final: true }); else pack(4, tx - 2, cy, { final: true, elite: true });
          if (o.door && bosses.length > 1) { set(o.door[0], o.door[1], 'D'); seals.push({ x: o.door[0], y: o.door[1], why: 'guardians' }); }
        }
        break;
      }
      case 'towerRoom': break;
    }
  }
  // ---------------------------------------------------------------- tower floors: packs spread over the layout, boss at the top
  if (kind === 'tower') {
    const o = rooms[0], spots = M.spots || [];
    const bossF = floor % TOWER.bossEvery === 0, miniF = floor % TOWER.miniEvery === 0;
    const nPacks = bossF ? 1 : miniF ? 2 : r.int(2, 3);
    spots.slice(0, nPacks).forEach(([sx, sy]) => pack(r.int(2, 3), sx, sy));
    if (bosses.length) bossPull(bosses[bosses.length - 1], M.boss[0], M.boss[1], { final: true });
    else if (miniF) pack(3, M.boss[0], M.boss[1], { elite: true, lvl: lvl + 2, final: true });
    set(M.up[0], M.up[1], 'U'); K(M.up[0], M.up[1]);
    chest = { x: M.chest[0], y: M.chest[1], id: `chest_tower_${floor}` };
    o.name = `${floor}F · ${M.shapeName}`; o.desc = mod.name;
  }
  // ---------------------------------------------------------------- trials: waves appear one at a time in the arena
  if (kind === 'trial') {
    const ar = rooms.find(o => o.type === 'trialArena'), rush = def.rule === 'rush';
    let wave = 0;
    for (const b of bosses) {
      if (!rush) { pack(r.int(3, 4), ar.cx, ar.cy, { wave: wave++ }); }
      bossPull(b, ar.cx, ar.cy, { wave: wave++, final: b === bosses[bosses.length - 1] });
    }
    if (!bosses.length) for (let k = 0; k < 4; k++) pack(3 + k, ar.cx, ar.cy, { wave: wave++, final: k === 3 });
    chest = { x: ar.x + ar.w - 3, y: ar.y, id: `chest_${def.id}` };
  }
  if (kind === 'dungeon' || kind === 'raid') {
    for (const o of rooms) {
      if (o.type === 'entrance') continue;
      let encounter = pulls.find(p => inside(o, p.x, p.y));
      if (!encounter) { pack(2, o.cx, o.cy, { roomNumber: o.number }); encounter = pulls[pulls.length - 1]; }
      encounter.roomNumber = o.number;
      if (o.number % 4 === 0 && !encounter.boss) { encounter.elite = true; encounter.miniboss = true; encounter.mobs = encounter.mobs.slice(0, 1); encounter.lvl += 2; }
    }
    let minibosses = pulls.filter(p => p.miniboss).length;
    for (const o of rooms.filter(room => room.type !== 'entrance' && room.type !== 'arena')) {
      if (minibosses >= 2) break;
      const encounter = pulls.find(p => inside(o, p.x, p.y));
      if (!encounter || encounter.boss || encounter.miniboss) continue;
      encounter.elite = true; encounter.miniboss = true; encounter.mobs = encounter.mobs.slice(0, 1); encounter.lvl += 2; minibosses++;
    }
  }
  for (const pull of pulls) pull.difficulty = tier;
  // ---------------------------------------------------------------- hidden traps in trap galleries and corridors
  const traps = [];
  for (const o of rooms.filter(o => o.type === 'traps' || o.type === 'guard').slice(0, 3)) for (let k = 0; k < 2; k++) {
    const tx = o.x + r.int(0, o.w - 1), ty = o.y + r.int(0, o.h - 1);
    if (at(tx, ty) === '.' && !pulls.some(p => p.x === tx && p.y === ty)) traps.push({ x: tx, y: ty, dc: 10 + Math.min(10, Math.floor(lvl / 5)) + tier, dmg: `${1 + Math.floor(lvl / 4) + Math.floor(tier / 3)}d10` });
  }
  // ---------------------------------------------------------------- make sure everything is reachable; strip decor if not
  const targets = [...pulls, ...vaults, ...(chest ? [chest] : []), ...shrines, ...(M.up ? [{ x: M.up[0], y: M.up[1] }] : [])];
  const BLOCKERS = new Set(['o', 'p', 'b', 's', 'B', 'i', 'h', 'T', 'A', 'n', 't']);
  for (let pass = 0; pass < 3; pass++) {
    const seen = reach(g, M.entry, BLOCKERS);
    const lost = targets.filter(t => !seen.has(t.x + ',' + t.y) && !neighbours(t).some(([a, b]) => seen.has(a + ',' + b)));
    if (!lost.length) break;
    for (const t of lost) { const o = rooms.find(o => inside(o, t.x, t.y)) || rooms[0]; for (let j = o.y; j < o.y + o.h; j++) for (let i = o.x; i < o.x + o.w; i++) if (['o', 'p', 'b', 's', 'i', 'h', 'x', 'B'].includes(at(i, j))) set(i, j, '.'); }
  }
  for (const s of seals) set(s.x, s.y, 'D');
  const rowsOut = g.map(rw => rw.join(''));
  return {
    id: `${kind}:${def.id}:${floor}`, kind, def, floor, rows: rowsOut, gfx: dungeonGfx(rowsOut, theme), tiles: dungeonTiles(theme), entry: M.entry, pulls, chest, traps, lvl,
    rooms: rooms.map(({ x, y, w, h, type, name, desc, number }) => ({ x, y, w, h, type, name, desc, number, difficulty: tier })), roomCount: rooms.length, difficulty: tier, vaults, shrines, seals, mod, trapDC: 10 + Math.min(10, Math.floor(lvl / 6)) + tier, spikeDmg: `${1 + Math.floor(lvl / 8) + Math.floor(tier / 3)}d4`,
    name: kind === 'tower' ? `${TOWER.name} ${floor}F` : def.name, music: kind === 'raid' ? 'raid' : kind === 'tower' ? 'tower' : 'dungeon', instance: kind,
  };
}
const neighbours = t => [[t.x + 1, t.y], [t.x - 1, t.y], [t.x, t.y + 1], [t.x, t.y - 1]];
function reach(g, start, blockers) {
  const H = g.length, W = g[0].length, seen = new Set([start.x + ',' + start.y]), q = [[start.x, start.y]];
  while (q.length) { const [x, y] = q.shift(); for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (a < 0 || b < 0 || a >= W || b >= H) continue; const c = g[b][a], k = a + ',' + b; if (seen.has(k) || c === '#' || blockers.has(c)) continue; seen.add(k); q.push([a, b]); } }
  return seen;
}

// ---------------------------------------------------------------- dungeon / raid: cells, main path + side rooms
function gridLayout(r, kind, nBosses) {
  const cols = kind === 'raid' ? 5 : 4, rows = kind === 'raid' ? 4 : 3, CW = 10, CH = 8;
  const W = cols * CW + 2, H = rows * CH + 2, g = Array.from({ length: H }, () => Array(W).fill('#'));
  const cell = {}, key = (c, w) => c + ',' + w, path = [];
  let c = 0, w = r.int(0, rows - 1); path.push([c, w]); cell[key(c, w)] = 1;
  while (c < cols - 1) {
    const opts = [[c + 1, w], [c + 1, w], [c + 1, w], [c, w - 1], [c, w + 1]].filter(([a, b]) => b >= 0 && b < rows && !cell[key(a, b)]);
    const [a, b] = r.pick(opts.length ? opts : [[c + 1, w]]); c = a; w = b; path.push([c, w]); cell[key(c, w)] = 1;
  }
  // side rooms off the main path
  const sides = [], nSide = kind === 'raid' ? 4 : 3;
  for (let k = 0; k < 40 && sides.length < nSide; k++) {
    const [pc, pw] = r.pick(path.slice(1, -1).length ? path.slice(1, -1) : path);
    const [a, b] = r.pick([[pc, pw - 1], [pc, pw + 1], [pc - 1, pw]]);
    if (a < 0 || b < 0 || a >= cols || b >= rows || cell[key(a, b)]) continue;
    cell[key(a, b)] = 1; sides.push({ at: [a, b], from: [pc, pw] });
  }
  // Fill a connected route to twelve chambers. Raids keep extra empty cells around the route.
  const targetRooms = Math.min(12, cols * rows);
  while (Object.keys(cell).length < targetRooms) {
    const choices = [];
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      if (cell[key(a, b)]) continue;
      const parents = [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && cell[key(x, y)]);
      if (parents.length) choices.push({ at: [a, b], from: r.pick(parents) });
    }
    if (!choices.length) break;
    const next = r.pick(choices); cell[key(...next.at)] = 1; sides.push(next);
  }
  // room types along the path: guardians evenly spaced (one per extra boss), arena last
  const nGuard = Math.max(0, nBosses - 1), types = path.map(() => null);
  types[0] = 'entrance'; types[path.length - 1] = 'arena';
  const mids = path.length - 2;
  for (let k = 0; k < nGuard; k++) { const i = 1 + Math.min(mids - 1, Math.floor((k + 1) * mids / (nGuard + 1))); if (!types[i]) types[i] = 'guardian'; else { const j = types.findIndex((t, ix) => !t && ix > 0); if (j > 0) types[j] = 'guardian'; } }
  const pool = r.shuffle ? r.shuffle(PATH_TYPES.slice()) : PATH_TYPES.slice();
  types.forEach((t, i) => { if (!t) types[i] = pool[i % pool.length]; });
  const rooms = [];
  const mk = (c, w, type) => {
    const ox = 1 + c * CW, oy = 1 + w * CH, big = ['arena', 'guardian', 'barracks', 'pillars', 'flooded'].includes(type);
    const rw = big ? CW - 2 : r.int(5, 7), rh = big ? CH - 2 : r.int(4, 5);
    const x = ox + 1 + (big ? 0 : r.int(0, CW - 2 - rw)), y = oy + 1 + (big ? 0 : r.int(0, CH - 2 - rh));
    const o = { x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1), type, cell: [c, w], number: rooms.length + 1 };
    const round = type === 'crossroads' || (type === 'shrine' && r() < 0.5);
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) { if (round && (i === 0 || i === rw - 1) && (j === 0 || j === rh - 1)) continue; g[y + j][x + i] = '.'; }
    rooms.push(o); return o;
  };
  const byCell = {};
  path.forEach(([a, b], i) => { byCell[key(a, b)] = mk(a, b, types[i]); });
  const sideTypes = r.shuffle ? r.shuffle(SIDE_TYPES.slice()) : SIDE_TYPES.slice();
  let extraGuardians = Math.max(0, nBosses - 1 - types.filter(type => type === 'guardian').length);
  sides.forEach((s, i) => { const type = extraGuardians > 0 ? (extraGuardians--, 'guardian') : sideTypes[i % sideTypes.length]; byCell[key(...s.at)] = mk(s.at[0], s.at[1], type); });
  // corridors
  const keep = [];
  const link = (A, B, doorOnB) => {
    let x = A.cx, y = A.cy; const horiz = A.cell[1] === B.cell[1];
    const carve = (i, j) => { if (g[j][i] === '#') g[j][i] = '.'; keep.push(i + ',' + j); }; // every corridor tile, also inside rooms, stays clear of decor
    if (horiz) { const mx = Math.round((A.cx + B.cx) / 2); while (x !== mx) { carve(x, y); x += Math.sign(mx - x); } while (y !== B.cy) { carve(x, y); y += Math.sign(B.cy - y); } while (x !== B.cx) { carve(x, y); x += Math.sign(B.cx - x); } }
    else { const my = Math.round((A.cy + B.cy) / 2); while (y !== my) { carve(x, y); y += Math.sign(my - y); } while (x !== B.cx) { carve(x, y); x += Math.sign(B.cx - x); } while (y !== B.cy) { carve(x, y); y += Math.sign(B.cy - y); } }
    if (doorOnB) {
      // the corridor tile just outside B is its door
      let dx = B.cx, dy = B.cy;
      if (horiz) { dx = B.cx < A.cx ? B.x + B.w : B.x - 1; dy = B.cy; } else { dy = B.cy < A.cy ? B.y + B.h : B.y - 1; dx = B.cx; }
      if (g[dy] && g[dy][dx] === '.') B.door = [dx, dy];
    }
    if (B.type === 'arena' || B.type === 'entrance') B.ex = horiz ? (B.cx > A.cx ? B.x : B.x + B.w - 1) : B.cx;
  };
  for (let i = 1; i < path.length; i++) link(byCell[key(...path[i - 1])], byCell[key(...path[i])], path.length - 1 === i);
  for (const s of sides) link(byCell[key(...s.from)], byCell[key(...s.at)], true);
  // the entrance stairs sit on the far wall from the next room
  const E = rooms[0], nx = rooms[1]; E.ex = nx.cx > E.cx ? E.x : E.x + E.w - 1; E.ey = E.cy;
  const entry = { x: E.ex === E.x ? E.x + 1 : E.x + E.w - 2, y: E.cy };
  return { g, rooms, entry, keep };
}

// ---------------------------------------------------------------- trial: antechamber + arena
function trialLayout(r) {
  const W = 34, H = 18, g = Array.from({ length: H }, () => Array(W).fill('#'));
  const ante = { x: 2, y: 6, w: 6, h: 6, type: 'entrance' }, ar = { x: 11, y: 2, w: 21, h: 14, type: 'trialArena' };
  for (const o of [ante, ar]) { o.cx = o.x + (o.w >> 1); o.cy = o.y + (o.h >> 1); for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) g[o.y + j][o.x + i] = '.'; }
  // round the arena's corners
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [ar.w - 1, 0], [ar.w - 2, 0], [ar.w - 1, 1], [0, ar.h - 1], [1, ar.h - 1], [0, ar.h - 2], [ar.w - 1, ar.h - 1], [ar.w - 2, ar.h - 1], [ar.w - 1, ar.h - 2]]) g[ar.y + j][ar.x + i] = '#';
  const keep = []; for (let x = ante.x + ante.w; x < ar.x; x++) { g[ante.cy][x] = '.'; keep.push(x + ',' + ante.cy); }
  ante.ex = ante.x; ante.ey = ante.cy;
  return { g, rooms: [ante, ar], entry: { x: ante.x + 1, y: ante.cy }, keep };
}

// ---------------------------------------------------------------- tower: one floor, six layouts
function towerLayout(r, floor) {
  const W = 24, H = 18, g = Array.from({ length: H }, () => Array(W).fill('#'));
  const shape = TOWER_SHAPES[(floor - 1 + 6) % 6], bossF = floor % TOWER.bossEvery === 0;
  const o = { x: 2, y: 2, w: W - 4, h: H - 4, type: 'towerRoom' }; o.cx = o.x + (o.w >> 1); o.cy = o.y + (o.h >> 1);
  const fillR = (x, y, w, h, c = '.') => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = c; };
  const keep = [], K = (x, y) => keep.push(x + ',' + y);
  let spots, boss, up, chest, name;
  const S = bossF ? 'arena' : shape;
  if (S === 'arena') {
    fillR(o.x, o.y, o.w, o.h); name = 'GUARDIAN ARENA';
    for (let i = o.x + 2; i < o.x + o.w - 2; i += 3) { g[o.y + 1][i] = 'o'; g[o.y + o.h - 2][i] = 'o'; }
    for (const [i, j] of [[o.x, o.y], [o.x + o.w - 1, o.y], [o.x, o.y + o.h - 1], [o.x + o.w - 1, o.y + o.h - 1]]) g[j][i] = 'B';
    for (let i = o.x + 1; i < o.x + o.w - 2; i++) g[o.cy][i] = '_';
    g[o.cy][o.x + o.w - 1] = 'T'; boss = [o.x + o.w - 4, o.cy]; up = [o.x + o.w - 2, o.y + 1]; chest = [o.x + o.w - 2, o.y + o.h - 2]; spots = [];
  } else if (S === 'hall') {
    fillR(o.x, o.y, o.w, o.h); name = 'PILLAR HALL';
    for (let j = o.y + 2; j < o.y + o.h - 1; j += 3) for (let i = o.x + 2; i < o.x + o.w - 1; i += 4) if (j !== o.cy) g[j][i] = 'o';
    spots = [[o.x + 5, o.cy], [o.x + 10, o.cy], [o.x + 14, o.cy - 3]]; boss = [o.x + o.w - 3, o.cy]; up = [o.x + o.w - 1, o.cy]; chest = [o.x + o.w - 1, o.y];
  } else if (S === 'ring') {
    fillR(o.x, o.y, o.w, o.h); fillR(o.x + 4, o.y + 4, o.w - 8, o.h - 8, 'p'); name = 'POOL RING';
    spots = [[o.cx, o.y + 1], [o.cx, o.y + o.h - 2], [o.x + 1, o.cy]]; boss = [o.x + o.w - 2, o.cy]; up = [o.x + o.w - 1, o.y]; chest = [o.x + o.w - 1, o.y + o.h - 1];
  } else if (S === 'cross') {
    fillR(o.x, o.cy - 2, o.w, 5); fillR(o.cx - 2, o.y, 5, o.h); name = 'CROSSWAYS';
    for (const [i, j] of [[o.cx, o.y], [o.cx, o.y + o.h - 1]]) g[j][i] = 'B';
    spots = [[o.x + 4, o.cy], [o.cx, o.y + 3], [o.cx, o.y + o.h - 4]]; boss = [o.x + o.w - 4, o.cy]; up = [o.x + o.w - 1, o.cy]; chest = [o.cx + 2, o.y + 1];
  } else if (S === 'gauntlet') {
    fillR(o.x, o.cy - 1, o.w, 3); name = 'THE GAUNTLET';
    for (let i = o.x + 3; i < o.x + o.w - 3; i += 5) { fillR(i, o.cy - 4, 2, 3); fillR(i, o.cy + 2, 2, 3); g[o.cy - 1][i] = '^'; g[o.cy + 1][i + 1] = '^'; }
    spots = [[o.x + 4, o.cy - 3], [o.x + 9, o.cy + 3], [o.x + 14, o.cy - 3]]; boss = [o.x + o.w - 3, o.cy]; up = [o.x + o.w - 1, o.cy]; chest = [o.x + 13, o.cy + 3];
  } else if (S === 'garden') {
    fillR(o.x, o.y, o.w, o.h); name = 'SUNKEN GARDEN';
    fillR(o.x + 1, o.y + 1, 4, 3, 'p'); fillR(o.x + o.w - 5, o.y + 1, 4, 3, 'p'); fillR(o.x + 1, o.y + o.h - 4, 4, 3, 'p'); fillR(o.x + o.w - 5, o.y + o.h - 4, 4, 3, 'p');
    for (let i = o.x; i < o.x + o.w; i++) g[o.cy][i] = '_'; g[o.cy - 2][o.cx] = 's'; g[o.cy + 2][o.cx] = 's';
    spots = [[o.x + 6, o.cy - 3], [o.cx, o.cy + 1], [o.x + o.w - 7, o.cy + 3]]; boss = [o.x + o.w - 3, o.cy]; up = [o.x + o.w - 1, o.cy]; chest = [o.cx, o.y];
  } else { // maze
    name = 'LABYRINTH'; const mw = 10, mh = 7, vis = new Set(), st = [[0, 0]]; vis.add('0,0');
    const cxy = (a, b) => [o.x + a * 2, o.y + b * 2]; g[o.y][o.x] = '.';
    while (st.length) { const [a, b] = st[st.length - 1]; const nb = [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]].filter(([p, q]) => p >= 0 && q >= 0 && p < mw && q < mh && !vis.has(p + ',' + q)); if (!nb.length) { st.pop(); continue; } const [p, q] = nb[Math.floor(r() * nb.length)]; vis.add(p + ',' + q); const [x0, y0] = cxy(a, b), [x1, y1] = cxy(p, q); g[y1][x1] = '.'; g[(y0 + y1) / 2][(x0 + x1) / 2] = '.'; st.push([p, q]); }
    spots = [cxy(3, 2), cxy(6, 5), cxy(8, 1)]; boss = cxy(9, 5); up = cxy(9, 6); chest = cxy(5, 6);
    o.cy = o.y; // the maze's "centre cross" is not protected
  }
  // entrance stairs back down at the left edge
  const ey = S === 'maze' ? o.y : S === 'ring' || S === 'garden' || S === 'cross' || S === 'gauntlet' || S === 'arena' || S === 'hall' ? o.cy : o.cy;
  const ex = o.x - 1; g[ey][ex] = 'L'; K(ex, ey); g[ey][ex + 1] = g[ey][ex + 1] === '#' ? '.' : g[ey][ex + 1];
  for (const [i, j] of [up, chest, boss, ...spots]) { if (g[j][i] === '#' || g[j][i] === 'p' || g[j][i] === 'o') g[j][i] = '.'; K(i, j); }
  return { g, rooms: [o], entry: { x: ex + 1, y: ey }, keep, spots, boss, up, chest, shapeName: name };
}

// ---------------------------------------------------------------- runtime helpers used by the Field
const instRoomAt = (inst, x, y) => inst && inst.map.rooms && inst.map.rooms.find(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
function instVisiblePulls(inst) {
  const live = inst.map.pulls.filter(p => !inst.cleared.includes(p.id));
  if (inst.kind !== 'trial') return live;
  const w = Math.min(...live.map(p => p.wave ?? 0)); return live.filter(p => (p.wave ?? 0) === w);
}
function updateSeals(inst) {
  if (!inst || !inst.map.seals) return;
  const guardiansLeft = inst.map.pulls.some(p => p.guardian && !inst.cleared.includes(p.id));
  for (const s of inst.map.seals) {
    if (s.open || guardiansLeft) continue;
    s.open = true; const row = inst.map.rows[s.y]; inst.map.rows[s.y] = row.slice(0, s.x) + 'd' + row.slice(s.x + 1);
    inst.map.gfx[s.y][s.x] = `gd_${inst.def.theme || 'dungeon'}_door`;
    toast('THE SEAL BREAKS', 'THE THRONE ROOM OPENS', 'item_key', 'door');
  }
}
function useShrine(inst, x, y) {
  const s = inst.map.shrines && inst.map.shrines.find(o => o.x === x && o.y === y); if (!s) return false;
  inst.shrinesUsed = inst.shrinesUsed || [];
  if (inst.shrinesUsed.includes(s.id)) { say('The altar is quiet now.'); return true; }
  inst.shrinesUsed.push(s.id);
  G.hp = derive(G).hpMax; (G.companions || []).forEach(c => { c.hp = derive(c).hpMax; c.res = resMax(c, derive(c)); });
  G.res = resMax(G, derive(G)); SFX.heal(); shake = 2;
  say(['You kneel at the altar.', 'Warm light fills the room. Your party is fully healed and rested.']);
  return true;
}
function openVault(inst, v) {
  inst.vaultsOpened = inst.vaultsOpened || [];
  if (inst.vaultsOpened.includes(v.id)) return;
  if (v.needs && !inst.cleared.includes(v.needs)) return say('Bones shift over the chest. Defeat what guards it.');
  inst.vaultsOpened.push(v.id); SFX.chest();
  const tier = inst.difficulty || G.difficulty, g = Math.round((10 + inst.map.lvl * 4 * ((inst.map.mod && inst.map.mod.gold) || 1)) * DIFFICULTY[tier - 1].loot); G.gold += g;
  const lucky = R() < 0.6, it = lucky ? makeItem({ lvl: inst.map.lvl, mf: derive(G).mf, loot: diffOf().loot }) : null;
  if (it) addGear(it); else addItem('potion', 2);
  say([`A treasure chest! ${g} G`, it ? `[${RARITY[it.rarity].name}] ${it.name}` : 'and 2 POTIONS']);
}
// apply a tower floor modifier to the foes of a fight
function applyFloorMod(foes, mod) {
  if (!mod || mod.id === 'none') return foes;
  for (const f of foes) {
    if (mod.hp) { f.maxhp = Math.round(f.maxhp * mod.hp); f.hp = f.maxhp; }
    if (mod.hit) { f.hit = (f.hit || 0) + mod.hit; (f.attacks || []).forEach(a => { if (a.hit != null) a.hit += mod.hit; }); }
    if (mod.xp) f.xp = Math.round((f.xp || 0) * mod.xp);
    if (mod.gold) f.gold = Math.round((f.gold || 0) * mod.gold);
  }
  return foes;
}
