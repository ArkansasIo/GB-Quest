'use strict';
// ================================================================ UNDERWORLD, SETTLEMENTS AND KINGDOMS
// Three additions to the world of Aelmoor, layered on the existing zone, building and field systems:
//  1. UNDERGROUND: a cave layer beneath the 12 base regions and one region of each of the 20 expansions
//     (108 zones). Each underground zone sits under one overworld zone (same fx/fy) but only links to the
//     underground zones of its own region. A CAVE MOUTH (tile 'C') in one overworld zone of the region leads
//     down; the cave below has a climb back up. Caves use existing tile art (fungal, ice, buried ruins,
//     abyss, magma, crystal), roll encounters from their theme and hold mining, relic and salvage nodes.
//  2. SETTLEMENTS: the 36 named sub-zone villages in SETTLEMENT_DEFS get real buildings (inn, store, shrine,
//     cottages, mill), every expansion region gets a named hub settlement and a village in its second zone,
//     and kingdom capitals become CITIES with the full set of services.
//  3. KINGDOMS: 26 realms (6 across the base regions, one per expansion), each with a capital, a ruler and the
//     regions it holds. Crossing a border, entering a settlement or going underground shows a toast.
// Zones of the underground layer are added to ZONE_BY_ID only (not ZONES), so the world map, quests and
// overworld travel keep their existing lists. Pure data and helpers are exported as GBQUnderworld for tests.

// ---------------------------------------------------------------- underground themes
// surface biome -> cave theme (each theme is an existing biome with tile art and monster families)
const UNDER_THEME = { meadow: 'mushroom', coast: 'ruins', marsh: 'mushroom', jungle: 'mushroom', snow: 'frozen', badlands: 'ruins', volcanic: 'volcanic', dusk: 'corruption', crystal: 'crystal' };
const UNDER_SUBS = {
  mushroom: ['SPORE HOLLOW', 'GLOWCAP GROTTO', 'MYCEL DEEP', 'ROOT CHASM'],
  frozen: ['RIME CAVERN', 'ICE VEINS', 'FROZEN LAKE', 'HOARFROST DEEP'],
  ruins: ['BURIED HALLS', 'SUNKEN STREETS', 'OSSUARY', 'COLLAPSED VAULT'],
  corruption: ['WEEPING PIT', 'SHADOW WARRENS', 'ROT CHASM', 'THE MAW'],
  volcanic: ['MAGMA TUBES', 'CINDER VAULT', 'EMBER RIFT', 'MOLTEN CORE'],
  crystal: ['GEODE HALL', 'PRISM VEINS', 'ECHO GROTTO', 'STARSTONE DEEP'],
};
const UNDER_DEPTH = ['UPPER', 'MIDDLE', 'LOWER', 'DEEP'];
// monster variants for themes the base spawn table does not list yet (gen.js BIOME_VARIANT)
const UNDER_VARIANTS = { mushroom: ['venom', ''], frozen: ['frost', ''], ruins: ['shadow', ''], corruption: ['shadow', 'ash'] };
// region (base) or expansion region -> [underworld name, description]
const UNDERWORLDS = {
  elderwood: ['THE ROOTWAYS', 'Tunnels the old oaks dug while the villages slept.'],
  hollowmere: ['DROWNED BURROWS', 'Bog water seeps into warrens lit by glowing caps.'],
  thornwood: ['THE UNDERCANOPY', 'Roots as thick as towers hold up a buried jungle.'],
  greypeak: ['DEEPHOLD MINES', 'Dwarven shafts abandoned when the ice came in.'],
  sandspire: ['THE SAND CRYPTS', 'A city the desert swallowed, street by street.'],
  saltreach: ['SMUGGLERS DEEP', 'Sea caves where the tide hides more than salt.'],
  emberwaste: ['THE MAGMA VEINS', 'Rivers of fire run under the ash plains.'],
  frostmarch: ['THE RIME VAULTS', 'Halls of blue ice the rime queen carved for her dead.'],
  verdantdeep: ['THE SPOREDARK', 'A fungal forest that has never seen the sun.'],
  ashenbarrows: ['THE UNDERBARROW', 'Where the barrow kings keep their courts below.'],
  silverhaven: ['THE GEODE HALLS', 'Crystal caverns that sing when you walk them.'],
  duskmoor: ['THE WEEPING DEEP', 'The moor drains into a pit that whispers back.'],
  x1_1: ['WRECKWOOD GROTTOS', 'Ship hulls rot in caves the sea carved long ago.'],
  x2_1: ['THE GLIMMER CAVES', 'Reef crystal grown through the bones of drowned towns.'],
  x3_1: ['GLASSPEAK HOLLOWS', 'Caverns of clouded glass beneath the peaks.'],
  x4_1: ['THE HOWLING DARK', 'Wind screams through tunnels under the gap.'],
  x5_1: ['HALO CATACOMBS', 'The plague dead were laid here, and did not stay.'],
  x6_1: ['GLASSWATER DEPTHS', 'Sunken galleries of crystal under the bay.'],
  x7_1: ['SHARDWIND CAVERNS', 'Ice shards ring like bells in the dark.'],
  x8_1: ['THE LEYLINE TUNNELS', 'Raw magic pools in caves under the meadow.'],
  x9_1: ['THE LEECH WARRENS', 'Blood-fed fungus lines every tunnel.'],
  x10_1: ['SKYPEAK CHASMS', 'Frozen chasms where wyrms once nested.'],
  x11_1: ['THE BARROW OF SHIELDS', 'A thousand fallen warriors, buried with their oaths.'],
  x12_1: ['NIGHTVINE UNDERGROWTH', 'Vines with no need of light choke the deep.'],
  x13_1: ['WILDROOT WARRENS', 'Burrows of the old beasts beneath the jungle.'],
  x14_1: ['THE COGWORK DEEP', 'Old engine halls still glowing with molten slag.'],
  x15_1: ['KELPDROWN TUNNELS', 'Flooded caves where the leviathan sheds its scales.'],
  x16_1: ['THE MIRAGE VAULTS', 'Tombs that are never where you left them.'],
  x17_1: ['UMBRAL DEEPS', 'Starless caves where the shadows have weight.'],
  x18_1: ['THE GLAMOUR GROTTO', 'A fey court hides its prisoners in crystal.'],
  x19_1: ['LEGION UNDERWORKS', 'The Iron Legion forges its dead soldiers here.'],
  x20_1: ['THE GODFALL CHASM', 'Where a god struck the earth, the wound still burns.'],
};

// ---------------------------------------------------------------- kingdoms
// capital: the zone that becomes a CITY (a region hub, or Ardenhold)
const KINGDOMS = [
  { id: 'ardenmark', name: 'KINGDOM OF ARDENMARK', ruler: 'QUEEN-REGENT ISOLDE VANE', capital: 'ardenhold', regions: ['ardenhold', 'elderwood', 'hollowmere', 'saltreach'], desc: 'The last free crown of Aelmoor, held together by the Lantern Temple.' },
  { id: 'thorncrown', name: 'THORNCROWN DOMINION', ruler: 'WARDEN-KING ORRIN BRACKEN', capital: 'thornwood', regions: ['thornwood', 'verdantdeep'], desc: 'Forest wardens who rule by bargain with the living wood.' },
  { id: 'greyholds', name: 'HIGH HOLDS OF GREYPEAK', ruler: 'THANE BRUNA STONEVEIN', capital: 'greypeak', regions: ['greypeak', 'frostmarch'], desc: 'Dwarf-built holds that guard the mountain passes and the ore beneath.' },
  { id: 'redsands', name: 'SULTANATE OF RED SANDS', ruler: 'SULTANA ZAHIRE OF THE WELLS', capital: 'sandspire', regions: ['sandspire', 'emberwaste'], desc: 'Caravan lords who own every well between the dunes and the fire.' },
  { id: 'barrowreach', name: 'FALLEN CROWN OF BARROWREACH', ruler: 'THE HOLLOW REGENT', capital: 'ashenbarrows', regions: ['ashenbarrows', 'duskmoor'], desc: 'A dead kingdom whose regent never noticed it had died.' },
  { id: 'silverrealm', name: 'ELVENREALM OF SILVERHAVEN', ruler: 'HIGH LADY SERAPHEL', capital: 'silverhaven', regions: ['silverhaven'], desc: 'Far-elves in crystal towers, open to mortals who keep their word.' },
  { id: 'merrow', name: 'CORAL THRONE OF MERROW', ruler: 'TIDE-QUEEN NERISSA', exp: 'x1', desc: 'Island lords who crown their queen on a throne of living coral.' },
  { id: 'fathom', name: 'DROWNED EMPIRE OF FATHOM', ruler: 'EMPEROR VAEL OF THE DEEP', exp: 'x2', desc: 'An empire that sank and simply kept ruling from below.' },
  { id: 'skycrown', name: 'SKYCROWN OF CLOUDHOLM', ruler: 'KING AUREN STORMBORN', exp: 'x3', desc: 'A kingdom above the clouds, proud and short of allies.' },
  { id: 'magocracy', name: 'MAGOCRACY OF THE RIFT', ruler: 'THE COUNCIL OF NINE', exp: 'x4', desc: 'Nine archmages share one crown and trust none of the others.' },
  { id: 'dawnshore', name: 'DAWNSHORE PROTECTORATE', ruler: 'LORD-PROTECTOR CASSIAN HALE', exp: 'x5', desc: 'Survivors of the plague, walled in and watchful.' },
  { id: 'prism', name: 'PRISM PRINCIPALITY', ruler: 'PRINCE LUMEN', exp: 'x6', desc: 'A glittering court where every law is cut into crystal.' },
  { id: 'frostsong', name: 'FROSTSONG DYNASTY', ruler: 'EMPRESS SVANA THE SILENT', exp: 'x7', desc: 'An ice dynasty that rules by song and never by speech.' },
  { id: 'leybound', name: 'LEYBOUND REPUBLIC', ruler: 'FIRST SPEAKER ODALYS', exp: 'x8', desc: 'Scholars who vote on everything, including the weather.' },
  { id: 'crimson', name: 'CRIMSON MARCH', ruler: 'COUNT VEXAR DRAKE', exp: 'x9', desc: 'A blood-moon court full of smiling conspirators.' },
  { id: 'wyrmfire', name: 'WYRMFIRE DOMINION', ruler: 'DRAGON-KING ASHKAR', exp: 'x10', desc: 'Dragon-blooded lords who pay tribute in gold and fire.' },
  { id: 'fjordholm', name: 'JARLDOM OF FJORDHOLM', ruler: 'HIGH JARL SIGRUN', exp: 'x11', desc: 'Shield-sworn clans who feast as hard as they fight.' },
  { id: 'nightshade', name: 'NIGHTSHADE COURT', ruler: 'THE VEILED MATRIARCH', exp: 'x12', desc: 'A court of poisoners who never raise their voices.' },
  { id: 'greenheart', name: 'GREENHEART CONCORD', ruler: 'THE OAK COUNCIL', exp: 'x13', desc: 'Druids and beast-folk sworn to keep the wild free.' },
  { id: 'brass', name: 'BRASS EMPIRE', ruler: 'ENGINE-EMPEROR KORVUS IX', exp: 'x14', desc: 'A clockwork state that measures its people in output.' },
  { id: 'stormwrack', name: 'STORMWRACK FREEHOLD', ruler: 'ADMIRAL THESSA BRINE', exp: 'x15', desc: 'Free captains who fly no flag but their own.' },
  { id: 'hourglass', name: 'HOURGLASS DYNASTY', ruler: 'QUEEN-ETERNAL SEPHIRA', exp: 'x16', desc: 'Rulers who live their reigns backward through the sand.' },
  { id: 'starfall', name: 'STARFALL SOVEREIGNTY', ruler: 'THE STAR-BLIND KING', exp: 'x17', desc: 'A crater kingdom built around a fallen star.' },
  { id: 'moonpetal', name: 'MOONPETAL COURT', ruler: 'QUEEN TITHENA', exp: 'x18', desc: 'A fey court where every promise is binding.' },
  { id: 'warfrost', name: 'WARFROST MARCHES', ruler: 'MARSHAL HELGA IRONHAND', exp: 'x19', desc: 'Frontier holds standing between the free lands and the Legion.' },
  { id: 'lastdawn', name: 'LAST DAWN THEOCRACY', ruler: 'HIGH ORACLE MIRAEL', exp: 'x20', desc: 'The final temple-state, praying for the gods to return.' },
];
// city services: the full town set plus a second inn and more houses
const CITY_BUILDINGS = [['inn', 'INN', 0], ['vendor', 'GENERAL STORE', 3], ['blacksmith', 'SMITHY', 11], ['stable', 'STABLE', 7], ['mail', 'POST OFFICE', 4], ['bank', 'BANK', 13],
  ['shrine', 'TEMPLE', 8], ['vendor', 'MARKET HALL', 3], ['inn', 'GRAND INN', 0], ['house', 'HOUSE'], ['house', 'HOUSE'], ['house', 'HOUSE'], ['house', 'MANOR'], ['mill', 'WINDMILL', 5]];

// ---------------------------------------------------------------- generated settlement names (expansion regions)
const NAME_PARTS = {
  coast: ['GULL', 'TIDE', 'SALT', 'BRINE', 'SHELL', 'REEF', 'FOAM', 'KELP'], jungle: ['VINE', 'FERN', 'MOSS', 'ORCHID', 'PALM', 'TANGLE', 'LIANA', 'CANOPY'],
  marsh: ['REED', 'BOG', 'FEN', 'MIRE', 'PEAT', 'HERON', 'SEDGE', 'MURK'], crystal: ['PRISM', 'GLIM', 'SHARD', 'GLASS', 'GEM', 'OPAL', 'STAR', 'LUSTRE'],
  dusk: ['GLOOM', 'DUSK', 'RAVEN', 'SHADE', 'GRIM', 'NIGHT', 'CROW', 'HOLLOW'], snow: ['FROST', 'RIME', 'SNOW', 'WINTER', 'ICE', 'HOAR', 'SLEET', 'PINE'],
  meadow: ['CLOVER', 'BARLEY', 'MEAD', 'HONEY', 'GREEN', 'THISTLE', 'WILLOW', 'APPLE'], volcanic: ['ASH', 'CINDER', 'EMBER', 'SLAG', 'SMOKE', 'FLINT', 'BRIM', 'SCORCH'],
  badlands: ['DUST', 'RUST', 'BONE', 'SAND', 'MESA', 'DRY', 'RED', 'THORN'],
};
const NAME_ENDS = { CITY: ['HOLD', 'GATE', 'SPIRE', 'CROWN', 'KEEP', 'HAVEN'], TOWN: ['FORD', 'HAVEN', 'BURY', 'WATCH', 'BRIDGE', 'MARKET', 'TON', 'MOUTH'], VILLAGE: ['WICK', 'STEAD', 'COMBE', 'THORPE', 'LEA', 'BY', 'DALE', 'FIELD'] };
const FOLK = { coast: 'fisherfolk and net-menders', jungle: 'hunters and herb-gatherers', marsh: 'reed-cutters and eel-trappers', crystal: 'gem-cutters and glassblowers', dusk: 'lantern-keepers and grave-wardens',
  snow: 'trappers and ice-fishers', meadow: 'farmers and beekeepers', volcanic: 'smiths and obsidian-cutters', badlands: 'caravaners and relic-diggers' };
const KIND_DESC = { CITY: 'The capital, walled and crowded', TOWN: 'A market town', VILLAGE: 'A small village' };
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function makeSettlementName(zoneId, biome, kind, used) {
  const parts = NAME_PARTS[biome] || NAME_PARTS.meadow, ends = NAME_ENDS[kind], h = hashStr(zoneId);
  for (let k = 0; k < parts.length * ends.length; k++) {
    const n = parts[(h + k) % parts.length] + ends[(Math.floor(h / 7) + k * 3) % ends.length];
    if (!used.has(n)) { used.add(n); return n; }
  }
  return (parts[h % parts.length] + ' ' + kind).slice(0, 18);
}

// ---------------------------------------------------------------- pure world-building (no browser needed)
function buildUnderworld(W) {
  const { REGIONS, ZONES, EXPANSIONS, SETTLEMENT_DEFS } = W;
  const zonesOf = rid => ZONES.filter(z => z.region === rid);
  // kingdoms: expansions hold all three of their regions, capital at the first
  const kingdoms = KINGDOMS.map(k => {
    if (!k.exp) return Object.assign({}, k);
    const regions = REGIONS.filter(r => r.exp && EXPANSIONS.find(x => x.n === r.exp).id === k.exp).map(r => r.id);
    return Object.assign({}, k, { regions, capital: regions[0] });
  });
  const kingdomByRegion = {}, kingdomByCapital = {};
  for (const k of kingdoms) { kingdomByCapital[k.capital] = k; for (const r of k.regions) kingdomByRegion[r] = k; }
  // underground zones
  const under = [], entrances = {};
  for (const rid of Object.keys(UNDERWORLDS)) {
    const rg = REGIONS.find(r => r.id === rid); if (!rg) continue;
    const cells = zonesOf(rid), theme = UNDER_THEME[rg.biome] || 'mushroom', [uname, udesc] = UNDERWORLDS[rid];
    const span = (rg.lvl[1] - rg.lvl[0]) / cells.length;
    cells.forEach((oz, i) => {
      const lo = Math.min(720, Math.round(rg.lvl[0] + span * i) + 2), hi = Math.min(720, Math.max(lo, Math.round(rg.lvl[0] + span * (i + 1)) + 3));
      under.push({ id: 'u_' + oz.id, region: rid, above: oz.id, name: `${uname} ${UNDER_DEPTH[i] || 'DEEP'}`.slice(0, 22), sub: UNDER_SUBS[theme][i % 4], biome: theme,
        lvl: [lo, hi], fx: oz.fx, fy: oz.fy, town: false, hand: false, exitPos: null, act: rg.act, exp: rg.exp, last: i === cells.length - 1, desc: udesc, v: rg.v, under: true, depth: i });
    });
    // the cave mouth sits in the region's second zone (the first may be hand-made or a hub)
    entrances[rid] = (cells[1] || cells[0]).id;
  }
  // settlements: every zone with a building settlement gets a def (name, kind, desc)
  const used = new Set(Object.values(SETTLEMENT_DEFS).map(d => d.name)), settlements = {}, villageZones = new Set();
  for (const [id, d] of Object.entries(SETTLEMENT_DEFS)) if (/_s\d+$/.test(id) && d.kind === 'village') villageZones.add(id);
  for (const rg of REGIONS.filter(r => r.exp)) {
    const hubKind = kingdomByCapital[rg.id] ? 'CITY' : /_0$/.test(rg.id) ? 'TOWN' : 'VILLAGE';
    const hubName = makeSettlementName(rg.id, rg.biome, hubKind, used);
    settlements[rg.id] = { kind: hubKind.toLowerCase(), name: hubName, desc: `${KIND_DESC[hubKind]} of ${FOLK[rg.biome] || 'travellers'} in ${rg.name}.` };
    const second = zonesOf(rg.id)[1];
    if (second) {
      settlements[second.id] = { kind: 'village', name: makeSettlementName(second.id, rg.biome, 'VILLAGE', used), desc: `${KIND_DESC.VILLAGE} of ${FOLK[rg.biome] || 'travellers'} on the road through ${rg.name}.` };
      villageZones.add(second.id);
    }
  }
  return { kingdoms, kingdomByRegion, kingdomByCapital, under, entrances, settlements, villageZones };
}

// ---------------------------------------------------------------- cave map generator
function buildCave(z, env) {
  const { RNG, noiseGrid, carve, worldTiles, zoneGfx, ZW, ZH, EXIT_POS, WALKABLE, under, entrances, BIOMES, HERB_BY_BIOME } = env;
  const r = RNG('cave-' + z.id), g = [];
  const open = noiseGrid(r, ZW, ZH, 5), det = noiseGrid(r, ZW, ZH, 2), wet = noiseGrid(r, ZW, ZH, 4);
  const pillar = z.biome === 'mushroom' ? 'T' : 'P';
  for (let y = 0; y < ZH; y++) {
    const row = [];
    for (let x = 0; x < ZW; x++) {
      const o = open(x, y) * 0.75 + det(x, y) * 0.25;
      let c = o > 0.5 ? 'N' : o > 0.43 ? 'M' : (r.chance(0.5) ? '.' : ',');
      if ((c === '.' || c === ',') && wet(x, y) > 0.74) c = r.chance(0.85) ? '~' : 'W';
      if ((c === '.' || c === ',') && r.chance(0.035)) c = pillar;
      row.push(c);
    }
    g.push(row);
  }
  for (let x = 0; x < ZW; x++) { g[0][x] = 'M'; g[ZH - 1][x] = 'M'; }
  for (let y = 0; y < ZH; y++) { g[y][0] = 'M'; g[y][ZW - 1] = 'M'; }
  const hub = [r.int(10, 21), r.int(8, 15)];
  for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) g[hub[1] + j][hub[0] + i] = '.';
  // exits to the underground zones of the same region on neighbouring cells
  const exits = {};
  for (const o of under) {
    if (o === z || o.region !== z.region) continue;
    const side = o.fx === z.fx && o.fy === z.fy - 1 ? 'N' : o.fx === z.fx && o.fy === z.fy + 1 ? 'S' : o.fy === z.fy && o.fx === z.fx - 1 ? 'W' : o.fy === z.fy && o.fx === z.fx + 1 ? 'E' : null;
    if (!side) continue;
    const [ex, ey] = EXIT_POS[side], [dx, dy] = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[side];
    exits[side] = { x: ex, y: ey, to: o.id, ix: ex + dx, iy: ey + dy };
    carve(g, ex, ey, hub[0], hub[1], side === 'N' || side === 'S');
  }
  const poi = {};
  // the climb back up, under the zone that holds the cave mouth
  if (entrances[z.region] === z.above) {
    // off every corridor (a climb on a corridor would block it), nearest to a spot beside the hub
    const road = c => '|hX'.includes(c), tx = hub[0] + (hub[0] < 16 ? 6 : -6), ty = hub[1] - 3, spots = [];
    for (let y = 3; y <= ZH - 5; y++) for (let x = 3; x <= ZW - 4; x++) if (!road(g[y][x]) && !road(g[y][x - 1]) && !road(g[y][x + 1]) && !road(g[y - 1][x])) spots.push([x, y, Math.abs(x - tx) + Math.abs(y - ty)]);
    spots.sort((a, b) => a[2] - b[2]);
    const [x, y] = spots[0] || [tx, ty];
    g[y][x] = 'C'; if (!road(g[y + 1][x])) g[y + 1][x] = '.';
    carve(g, x, y + 1, hub[0], hub[1], true);
    poi.ascend = { x, y, to: z.above };
  }
  // reachable floor from the hub (gathering nodes only go where you can walk)
  const key = (x, y) => y * ZW + x, seen = new Set([key(hub[0], hub[1])]), q = [hub], reach = [];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= ZW - 1 || ny >= ZH - 1 || seen.has(key(nx, ny)) || !WALKABLE.has(g[ny][nx])) continue;
      seen.add(key(nx, ny)); q.push([nx, ny]); if (g[ny][nx] === '.' || g[ny][nx] === ',') reach.push([nx, ny]);
    }
  }
  const taken = new Set();
  const free = () => { for (let k = 0; k < 200 && reach.length; k++) { const p = reach[r.int(0, reach.length - 1)]; if (!taken.has(key(p[0], p[1])) && Math.abs(p[0] - hub[0]) + Math.abs(p[1] - hub[1]) > 2) { taken.add(key(p[0], p[1])); return p; } } return [hub[0] + 1, hub[1]]; };
  const herb = (HERB_BY_BIOME && HERB_BY_BIOME[z.biome]) || 'peacebloom', nodes = [];
  for (const [profession, item] of [['mining', 'iron_ore'], ['mining', 'iron_ore'], ['relic', 'relic_fragment'], ['salvaging', 'scrap'], ['herb', herb], ['beast_lore', 'bone_dust']]) { const [x, y] = free(); nodes.push([x, y, profession, item]); }
  const rows = g.map(rw => rw.join(''));
  const bio = BIOMES[z.biome] || BIOMES.meadow;
  const ar = RNG('areas-' + z.id), names = ar.shuffle(['GALLERY', 'SHAFT', 'POOL', 'LEDGE', 'CHAMBER', 'CROSSING', 'VEIN', 'DROP', 'HOLLOW', 'NEST', 'SHRINE', 'SINK']);
  const areas = [[1, 1, 15, 11], [16, 1, 15, 11], [1, 12, 15, 11], [16, 12, 15, 11]].map((rc, i) => ({ id: `${z.id}_a${i}`, r: rc, name: `${z.sub.split(' ')[0]} ${names[i]}` }));
  const music = env.GBQMusic ? env.GBQMusic.zoneMusic(z, 'dungeon') : 'dungeon';
  return { id: z.id, zone: z, rows, tiles: worldTiles(bio.tiles, {}), gfx: zoneGfx(rows, z.biome, false), exits, poi, nodes, bosses: [], buildings: [], hub, areas, name: z.name, music, lvl: z.lvl, biome: z.biome };
}

// put a cave mouth into an overworld zone map (rows as char grid g); returns the poi or null
// avoid: [x, y] spots that must stay free (nodes, bosses, other entrances), with a one-tile margin
function placeCaveMouth(g, hub, WALKABLE, carve, seed, avoid = []) {
  const H = g.length, Wd = g[0].length, cand = [];
  const near = (x, y) => avoid.some(([ax, ay]) => Math.abs(ax - x) <= 1 && Math.abs(ay - y) <= 2);
  for (let y = 3; y < H - 4; y++) for (let x = 3; x < Wd - 4; x++) {
    const c = g[y][x], below = g[y + 1][x];
    if (!'.,"TFDsS'.includes(c) || !WALKABLE.has(below) || '|hX'.includes(below) || near(x, y)) continue;
    const d = Math.abs(x - hub[0]) + Math.abs(y - hub[1]);
    if (d >= 5 && d <= 14) cand.push([x, y]);
  }
  if (!cand.length) return null;
  const [x, y] = cand[hashStr(seed) % cand.length];
  g[y][x] = 'C';
  carve(g, x, y + 1, hub[0], hub[1] + 1, false);
  return { x, y };
}

if (typeof globalThis !== 'undefined') globalThis.GBQUnderworld = { UNDER_THEME, UNDER_SUBS, UNDER_VARIANTS, UNDERWORLDS, KINGDOMS, CITY_BUILDINGS, buildUnderworld, buildCave, placeCaveMouth, makeSettlementName };

// ---------------------------------------------------------------- browser wiring
if (typeof window !== 'undefined' && typeof ZONES !== 'undefined' && typeof buildZone === 'function' && typeof Field !== 'undefined') {
  const UW = buildUnderworld({ REGIONS, ZONES, EXPANSIONS, SETTLEMENT_DEFS });
  Object.assign(globalThis.GBQUnderworld, UW);
  for (const z of UW.under) ZONE_BY_ID[z.id] = z;
  for (const [id, d] of Object.entries(UW.settlements)) if (!SETTLEMENT_DEFS[id]) { SETTLEMENT_DEFS[id] = d; if (typeof SETTLED_ZONE_IDS !== 'undefined') SETTLED_ZONE_IDS.push(id); }
  for (const [k, v] of Object.entries(UNDER_VARIANTS)) if (!BIOME_VARIANT[k]) BIOME_VARIANT[k] = v;
  TILE_LAYOUT.C = [2, 4]; GT_KEY.C = 'keepdoor';
  HUB_BUILDINGS.CITY = CITY_BUILDINGS;
  const entranceZones = new Set(Object.values(UW.entrances));
  const kingdomOf = z => z ? UW.kingdomByRegion[z.region] || null : null;
  const settlementKind = z => !z || z.under ? null : z.town ? 'CITY' : UW.kingdomByCapital[z.id] ? 'CITY' : null;
  globalThis.GBQUnderworld.kingdomOf = kingdomOf;

  // capitals build as cities; named sub-zone villages get buildings too
  { const hsk0 = hubSettlementKind;
    hubSettlementKind = function (z) {
      if (!z || z.town || z.under) return null;
      if (UW.kingdomByCapital[z.id]) return 'CITY';
      if (z.id === z.region) return hsk0(z);
      return UW.villageZones.has(z.id) ? 'VILLAGE' : null;
    };
  }
  { const b0 = buildZone;
    buildZone = function (z) {
      if (z && z.under) return buildCave(z, { RNG, noiseGrid, carve, worldTiles, zoneGfx, ZW, ZH, EXIT_POS, WALKABLE, under: UW.under, entrances: UW.entrances, BIOMES, HERB_BY_BIOME, GBQMusic: typeof GBQMusic !== 'undefined' ? GBQMusic : null });
      const m = b0(z);
      if (!z || z.town) return m;
      const cave = entranceZones.has(z.id), village = !m.buildings.length && z.id !== z.region && UW.villageZones.has(z.id);
      if (!cave && !village) return m;
      const g = m.rows.map(row => row.split(''));
      if (cave) {
        const avoid = [...m.nodes.map(n => [n[0], n[1]]), ...m.bosses.map(b => [b.x, b.y]), ...Object.values(m.poi).filter(p => p && Number.isFinite(p.x)).map(p => [p.x, p.y]), ...Object.values(m.exits).map(e => [e.x, e.y])];
        const p = placeCaveMouth(g, m.hub, WALKABLE, carve, 'cave-' + z.id, avoid); if (p) m.poi.cave = { x: p.x, y: p.y, to: 'u_' + z.id };
      }
      if (village) m.buildings = placeHubBuildings(z, g, m.hub, m.exits, m.poi, m.nodes, m.bosses);
      m.rows = g.map(row => row.join('')); m.gfx = zoneGfx(m.rows, z.biome, z.town);
      return m;
    };
  }
  // underground zones show on the world map at the zone above them
  { const zp0 = zonePin; zonePin = z => zp0(z && z.under ? ZONE_BY_ID[z.above] || z : z); }
  // cave mouths and climbs
  { const ia0 = Field.prototype.interactAt;
    Field.prototype.interactAt = function (x, y) {
      if (!G.inst && this.zone && this.chAt(x, y) === 'C') {
        const p = this.m.poi.cave || this.m.poi.ascend;
        if (p && ZONE_BY_ID[p.to]) {
          const target = ZONE_BY_ID[p.to], down = !!this.m.poi.cave;
          if (down && target.lvl[0] > G.lvl + 8 && !G.ghost) return say(`${target.name} (LV ${target.lvl[0]}+) is too dangerous for now.`);
          const tm = buildZoneCached(p.to), land = down ? tm.poi.ascend : tm.poi.cave;
          if (!land) return say('The way is blocked by fallen rock.');
          return choose([down ? 'CLIMB DOWN' : 'CLIMB UP', 'STAY'], k => {
            if (k !== 0) return;
            SFX.door(); fadeTo(() => { G.map = p.to; G.x = land.x; G.y = land.y + 1; G.dir = 'down'; G.mounted = false; this.ox = this.oy = 0; this.reload(); });
          }, down ? `A cave mouth. Cold air rises from ${target.name}.` : `Daylight far above. The way back to ${target.name}.`);
        }
      }
      return ia0.call(this, x, y);
    };
  }
  // border, settlement and underground toasts
  { const rl0 = Field.prototype.reload; let lastZone = null, lastKingdom = null;
    Field.prototype.reload = function () {
      rl0.apply(this, arguments);
      const z = this.zone; if (G.inst || !z || z.id === lastZone) return;
      const prev = lastZone ? ZONE_BY_ID[lastZone] : null, k = kingdomOf(z);
      lastZone = z.id;
      if (z.under && !(prev && prev.under && prev.region === z.region)) toast(z.name, `UNDERGROUND LV${z.lvl[0]}-${z.lvl[1]}`, 'px_map', 'waypoint');
      else if (k && lastKingdom && k.id !== lastKingdom) toast(k.name.slice(0, 22), k.ruler.slice(0, 24), 'px_map', 'waypoint');
      else if (!z.under) { const s = SETTLEMENT_DEFS[z.id], kind = settlementKind(z) || (s && (z.id === z.region ? hubSettlementKind(z) : UW.villageZones.has(z.id) ? 'VILLAGE' : null)); if (s && kind) toast(s.name.slice(0, 22), `${kind}${k ? ' - ' + k.name.replace(/^(KINGDOM|HIGH HOLDS|SULTANATE|FALLEN CROWN|ELVENREALM|CORAL THRONE|DROWNED EMPIRE|SKYCROWN|MAGOCRACY) OF (THE )?/, '') : ''}`.slice(0, 24), 'px_map', 'waypoint'); }
      if (k) lastKingdom = k.id;
    };
  }
}
