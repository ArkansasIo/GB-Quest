// GB QUEST — game data: maps, tiles, items, enemies, quests.
// Every sprite name refers to a PNG in assets/ sliced from src_sheet/sheet.png.
'use strict';

// ---------------------------------------------------------------- tiles
// [sprite, walkable, encounterZone, rotate90]
const WORLD_TILES = {
  '.': ['world_0_0', 1, 'grass'], ',': ['world_1_4', 1, 'grass'], '"': ['world_3_3', 1, 'grass'],
  'T': ['world_0_1', 1, 'forest'], 'F': ['world_1_1', 1, 'forest'], 'D': ['world_1_0', 1, 'forest'],
  'P': ['world_0_4', 0], 'M': ['world_0_3', 0], 'N': ['world_1_3', 0],
  '~': ['world_0_2', 0], 'W': ['world_1_2', 0], 'w': ['world_0_7', 0], 'v': ['world_1_7', 0],
  '=': ['world_2_2', 1], '|': ['world_1_5', 1], 'X': ['world_2_3', 1], 'h': ['world_1_5', 1, null, 1],
  's': ['world_0_6', 1], 'S': ['world_1_6', 1],
  'A': ['world_2_0', 0], 'a': ['world_3_0', 0], 'K': ['world_2_4', 0], 'k': ['world_3_4', 0],
  'H': ['world_2_6', 0], 'J': ['world_2_7', 0], 'r': ['world_3_6', 0], 'q': ['world_3_7', 0],
};

const DUNGEON_TILES = {
  '#': ['dungeon_1_1', 0], '.': ['dungeon_0_3', 1, 'dungeon'], ',': ['dungeon_1_3', 1, 'dungeon'],
  'L': ['dungeon_0_4', 1], 't': ['dungeon_2_2', 0], 'A': ['dungeon_2_3', 0], 'G': ['dungeon_2_6', 1],
  'b': ['dungeon_3_6', 0], 's': ['dungeon_0_2', 0], 'n': ['dungeon_0_1', 0],
};

// ---------------------------------------------------------------- maps
const WORLD = [
  'MMMMMMMMMMNNMMMMMMMMMMMMNNMMMMMM',
  'MN.TTTTDD..MMMMM..FFFFFFFF..MNMM',
  'M..TTDDDT...MMM..FFDDDDFFF.K..MM',
  'M.P.TTTT......M.FFDDTTDDF..k...M',
  'M......,,.........FFFFFF...|.P.M',
  'M..A........wwvv...........|...M',
  'M..a........w~~v...TTT.....|...M',
  'M..|...P....w~~v..TTDT.....|...M',
  'M..|hhhhhhhhh===hhhhhhhhhhhX...M',
  'M..|.........~~~..........,....M',
  'M..|.........~~~.......,....P..M',
  'M..|....,....~~~....P......TT..M',
  'M.sss.......~~~...........TTDT.M',
  'M.sHsJs.....~~...,,.....TTDDDT.M',
  'M.ssssss....~~.........TTDDDDTTM',
  'M.srs.qs...~~~.......P.TTTDDTT.M',
  'M.ssssss..~~~~.........TTTTT...M',
  'M.........~~~~~...,,...........M',
  'MP...,,...wvvwv.......P....P...M',
  'M..P.....................,,....M',
  'M.....TTT....P.....NN.......P..M',
  'M....TTDTT.........MMN..TTT....M',
  'MNN..TTTT....MM...MMMM.TTDT..NNM',
  'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
];

const DUNGEON = [
  '##t####t#####t####t#',
  '#....,...#......#.A#',
  '#........#..,...#..#',
  '#..bb....#......#..#',
  '#..bb...........#G##',
  '#.......,..........#',
  '####.#####.######..#',
  '#s..........,#....,#',
  '#....######..#..#..#',
  '#....#....#..#..#..#',
  '#.,..#.n..#.....#..#',
  '#....#....#..#.....#',
  '#.........#..#######',
  '#..bb.....#........#',
  '#L........,.......s#',
  '####t#######t#######',
];

const MAPS = {
  world: { rows: WORLD, tiles: WORLD_TILES, name: 'OVERWORLD', music: 'field' },
  dungeon: { rows: DUNGEON, tiles: DUNGEON_TILES, name: 'GOBLIN KEEP', music: 'dungeon' },
};

// ---------------------------------------------------------------- items
const ITEMS = {
  health_potion: { name: 'HEALTH POTION', icon: 'item_health_potion', type: 'use', hp: 20, desc: 'Restores 20 HP.' },
  mana_potion:   { name: 'MANA POTION', icon: 'item_mana_potion', type: 'use', mp: 10, desc: 'Restores 10 MP.' },
  ether:         { name: 'ETHER', icon: 'item_ether', type: 'use', mp: 25, desc: 'Restores 25 MP.' },
  bread:         { name: 'BREAD', icon: 'item_bread', type: 'use', hp: 8, desc: 'Restores 8 HP.' },
  antidote:      { name: 'ANTIDOTE', icon: 'item_antidote', type: 'use', cure: true, desc: 'Cures poison.' },
  herb:          { name: 'HERB', icon: 'item_herb', type: 'use', hp: 5, desc: 'Restores 5 HP.' },
  elixir:        { name: 'ELIXIR', icon: 'item_elixir', type: 'use', hp: 999, mp: 999, cure: true, desc: 'Fully restores HP/MP.' },
  dagger:        { name: 'DAGGER', icon: 'item_dagger', type: 'gear', slot: 'weapon', atk: 2, desc: 'A small blade. ATK+2' },
  iron_sword:    { name: 'IRON SWORD', icon: 'item_iron_sword', type: 'gear', slot: 'weapon', atk: 5, desc: 'Sturdy iron. ATK+5' },
  steel_sword:   { name: 'STEEL SWORD', icon: 'item_steel_sword', type: 'gear', slot: 'weapon', atk: 9, desc: 'Keen steel. ATK+9' },
  wood_shield:   { name: 'WOOD SHIELD', icon: 'icon_0_1', type: 'gear', slot: 'shield', def: 2, desc: 'Light shield. DEF+2' },
  cap:           { name: 'CAP', icon: 'item_cap', type: 'gear', slot: 'helm', def: 1, desc: 'Better than nothing. DEF+1' },
  iron_helm:     { name: 'IRON HELM', icon: 'item_iron_helm', type: 'gear', slot: 'helm', def: 3, desc: 'Solid helm. DEF+3' },
  goblin_mask:   { name: 'GOBLIN MASK', icon: 'item_goblin_mask', type: 'gear', slot: 'helm', def: 4, dex: 2, desc: 'Ugly but tough. DEF+4 DEX+2' },
  leather_armor: { name: 'LEATHER ARMOR', icon: 'item_leather_armor', type: 'gear', slot: 'armor', def: 3, desc: 'Supple hide. DEF+3' },
  boots:         { name: 'BOOTS', icon: 'item_boots', type: 'gear', slot: 'boots', def: 1, dex: 3, desc: 'Swift boots. DEF+1 DEX+3' },
  key:           { name: 'OLD KEY', icon: 'item_key', type: 'key', desc: 'Opens the Goblin Keep.' },
  relic:         { name: 'LOST RELIC', icon: 'item_spellbook', type: 'key', desc: 'An ancient tome. It glows.' },
};
const SLOTS = ['weapon', 'shield', 'helm', 'armor', 'boots'];
const SLOT_ICON = { weapon: 'icon_0_0', shield: 'icon_0_1', helm: 'icon_3_0', armor: 'icon_0_2', boots: 'item_boots' };

// ---------------------------------------------------------------- enemies
const ENEMIES = {
  slime:      { name: 'SLIME', hp: 10, atk: 5, def: 1, exp: 4, gold: 3, drop: 'herb' },
  goldslime:  { name: 'GOLD SLIME', hp: 14, atk: 5, def: 6, exp: 12, gold: 40, drop: 'herb' },
  goblin:     { name: 'GOBLIN', hp: 16, atk: 7, def: 2, exp: 7, gold: 6, drop: 'bread' },
  bat:        { name: 'BAT', hp: 11, atk: 6, def: 1, exp: 5, gold: 4, dex: 14 },
  imp:        { name: 'IMP', hp: 20, atk: 9, def: 3, exp: 10, gold: 8, drop: 'mana_potion' },
  bigbat:     { name: 'GIANT BAT', hp: 22, atk: 10, def: 3, exp: 12, gold: 9, dex: 16 },
  orc:        { name: 'ORC', hp: 30, atk: 12, def: 5, exp: 16, gold: 12, drop: 'health_potion' },
  lizard:     { name: 'LIZARDMAN', hp: 26, atk: 11, def: 4, exp: 14, gold: 10, poison: true, drop: 'antidote' },
  skeleton:   { name: 'SKELETON', hp: 34, atk: 14, def: 7, exp: 20, gold: 14 },
  zombie:     { name: 'ZOMBIE', hp: 40, atk: 13, def: 5, exp: 20, gold: 12, poison: true, drop: 'antidote' },
  ghoul:      { name: 'GHOUL', hp: 36, atk: 15, def: 6, exp: 22, gold: 15, drop: 'health_potion' },
  wraith:     { name: 'WRAITH', hp: 32, atk: 17, def: 5, exp: 24, gold: 16, drop: 'ether' },
  gargoyle:   { name: 'GARGOYLE', hp: 44, atk: 16, def: 10, exp: 28, gold: 20 },
  spearorc:   { name: 'ORC GUARD', hp: 46, atk: 18, def: 8, exp: 30, gold: 22, drop: 'health_potion' },
  goblinking: { name: 'GOBLIN KING', hp: 150, atk: 21, def: 10, exp: 150, gold: 200, boss: true },
};
const ZONES = {
  grass: ['slime', 'slime', 'goblin', 'bat', 'goblin', 'goldslime'],
  forest: ['imp', 'goblin', 'bigbat', 'orc', 'lizard', 'imp'],
  dungeon: ['skeleton', 'zombie', 'ghoul', 'wraith', 'gargoyle', 'spearorc'],
};
const ENCOUNTER_RATE = { grass: 0.07, forest: 0.11, dungeon: 0.10 };

const SKILLS = [
  { id: 'fire', name: 'FIRE SLASH', mp: 4, lvl: 1, desc: 'x1.8 dmg' },
  { id: 'heal', name: 'HEAL', mp: 5, lvl: 2, desc: '+40% HP' },
  { id: 'bolt', name: 'THUNDER', mp: 8, lvl: 5, desc: 'x2.8 dmg' },
];

// ---------------------------------------------------------------- world objects
const CHESTS = {
  c_world1: { m: 'world', x: 2, y: 1, item: 'leather_armor' },
  c_world2: { m: 'world', x: 26, y: 1, item: 'boots' },
  c_world3: { m: 'world', x: 6, y: 22, item: 'iron_sword' },
  c_world4: { m: 'world', x: 30, y: 20, item: 'ether' },
  c_world5: { m: 'world', x: 1, y: 12, item: 'health_potion' },
  c_world6: { m: 'world', x: 30, y: 13, item: 'wood_shield' },
  c_dun1: { m: 'dungeon', x: 18, y: 13, item: 'steel_sword' },
  c_dun2: { m: 'dungeon', x: 8, y: 9, item: 'goblin_mask' },
  c_dun3: { m: 'dungeon', x: 18, y: 7, item: 'elixir' },
  c_dun4: { m: 'dungeon', x: 1, y: 1, item: 'mana_potion' },
  c_dun5: { m: 'dungeon', x: 14, y: 1, item: 'iron_helm' },
};

const HERBS = [
  [6, 3], [9, 5], [20, 3], [22, 6], [17, 10], [25, 12], [28, 14], [7, 19],
  [18, 19], [6, 21], [25, 21], [29, 10], [10, 11], [20, 14], [2, 18], [24, 4],
];

const START = { map: 'world', x: 3, y: 7, dir: 'down' };
const KEEP_ENTRY = { map: 'dungeon', x: 2, y: 14, dir: 'right' };
const KEEP_EXIT = { map: 'world', x: 27, y: 4, dir: 'down' };

// ---------------------------------------------------------------- music (MIDI note numbers, 0 = rest)
const SONGS = {
  title: { bpm: 112,
    lead: [72,0,76,0,79,0,84,0, 83,0,79,0,76,0,0,0, 74,0,77,0,81,0,86,0, 84,0,83,0,79,0,0,0],
    bass: [48,0,0,0,55,0,0,0, 52,0,0,0,55,0,0,0, 50,0,0,0,57,0,0,0, 55,0,0,0,59,0,0,0] },
  field: { bpm: 132,
    lead: [76,0,79,0,81,79,76,0, 74,0,72,0,74,76,0,0, 76,0,79,0,81,83,84,0, 83,81,79,0,76,0,0,0],
    bass: [48,0,55,0,48,0,55,0, 50,0,57,0,50,0,57,0, 53,0,60,0,53,0,60,0, 55,0,62,0,55,0,59,0] },
  dungeon: { bpm: 100,
    lead: [64,0,0,67,0,0,66,0, 64,0,0,0,62,0,0,0, 64,0,0,67,0,0,71,0, 70,0,0,0,0,0,0,0],
    bass: [40,0,0,0,47,0,0,0, 40,0,0,0,46,0,0,0, 43,0,0,0,47,0,0,0, 42,0,0,0,46,0,0,0] },
  battle: { bpm: 168,
    lead: [69,72,76,72,69,72,76,79, 77,76,74,72,71,72,74,0, 69,72,76,72,69,72,76,81, 79,77,76,74,76,0,0,0],
    bass: [45,0,45,57,45,0,45,57, 41,0,41,53,41,0,41,53, 43,0,43,55,43,0,43,55, 40,0,40,52,44,0,44,56] },
  boss: { bpm: 180,
    lead: [69,0,68,69,72,0,71,69, 68,0,64,0,65,0,68,0, 69,0,68,69,72,0,76,0, 75,0,71,0,68,0,64,0],
    bass: [33,45,33,45,33,45,33,45, 32,44,32,44,32,44,32,44, 33,45,33,45,33,45,33,45, 28,40,28,40,32,44,32,44] },
};
