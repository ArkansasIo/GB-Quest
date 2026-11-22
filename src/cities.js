'use strict';
(() => { // own scope: every module shares one global scope, so nothing here may clash with another file's names
// ================================================================ FULL CITIES: SIX DISTRICTS FOR ARDENHOLD AND EVERY KINGDOM CAPITAL
// Ardenhold and the 26 kingdom capitals (underworld.js KINGDOMS) become full cities of six districts:
//   1 MARKET          the capital zone itself, with its existing services, plus a CITY GATE into the districts
//   2 CRAFT ROW       smithy, jeweler, tailor, alchemist, trade hall, workshop
//   3 TEMPLE QUARTER  cathedral, chapel, library, apothecary, pilgrim inn
//   4 NOBLE QUARTER   royal bank, gemcutter, couturier, grand hotel, post office, manors
//   5 HARBOR          (coast and marsh cities) fish market, sailors' tavern, harbormaster, dock guild
//     or THE SLUMS    (everywhere else) rat tavern, pawn shop, thieves' guild, fight pit, shacks
//   6 CASTLE          throne room, barracks, arena, guild hall, royal stable, royal archive
// Districts are safe walled zones (no random encounters) laid out like the game's towns, linked by gates:
//        NOBLE  - CASTLE
//          |        |
//   MARKET-CRAFT  - TEMPLE        (the market's CITY GATE opens into CRAFT ROW, and back)
//          |
//     HARBOR / SLUMS
// New working buildings: ALCHEMIST (potions), JEWELER (gems), TAILOR (commission armour), GUILD HALL (quest board),
// LIBRARY (lore, daily study XP), ARENA (fights), BARRACKS (drills: MIGHTY / FOCUSED) and THRONE ROOM (audience,
// daily royal favour). District zones are added to ZONE_BY_ID only (like the underground), so the world map, quests
// and travel lists keep their existing zones. Pure data and helpers are exported as GBQCities for tests.

const DISTRICTS = [
  { k: 1, key: 'craft', name: 'CRAFT ROW', theme: 'craft', buildings: [['blacksmith', 'SMITHY', 11], ['jeweler', 'JEWELER', 4], ['tailor', 'TAILOR', 10], ['alchemist', 'ALCHEMIST', 3], ['vendor', 'TRADE HALL', 4], ['mill', 'WORKSHOP', 5], ['house', 'HOUSE'], ['house', 'HOUSE']] },
  { k: 2, key: 'temple', name: 'TEMPLE QUARTER', theme: 'temple', buildings: [['shrine', 'CATHEDRAL', 1], ['library', 'LIBRARY', 0], ['alchemist', 'APOTHECARY', 3], ['inn', 'PILGRIM INN', 0], ['shrine', 'CHAPEL', 8], ['house', 'HOUSE'], ['house', 'HOUSE']] },
  { k: 3, key: 'noble', name: 'NOBLE QUARTER', theme: 'noble', buildings: [['bank', 'ROYAL BANK', 13], ['jeweler', 'GEMCUTTER', 4], ['tailor', 'COUTURIER', 10], ['inn', 'GRAND HOTEL', 0], ['mail', 'POST OFFICE', 4], ['house', 'MANOR', 14], ['house', 'MANOR', 16], ['house', 'MANOR', 18]] },
  { k: 4, key: 'harbor', name: 'HARBOR', theme: 'harbor', buildings: [['vendor', 'FISH MARKET', 3], ['inn', 'SAILORS TAVERN', 0], ['mail', 'HARBORMASTER', 4], ['guild', 'DOCK GUILD', 7], ['alchemist', 'SALT APOTHECARY', 3], ['house', 'HOUSE'], ['house', 'HOUSE'], ['house', 'HOUSE']] },
  { k: 4, key: 'slums', name: 'THE SLUMS', theme: 'slums', buildings: [['inn', 'RAT TAVERN', 0], ['vendor', 'PAWN SHOP', 4], ['guild', 'THIEVES GUILD', 9], ['arena', 'FIGHT PIT', 9], ['house', 'SHACK'], ['house', 'SHACK'], ['house', 'SHACK'], ['house', 'SHACK']] },
  { k: 5, key: 'castle', name: 'CASTLE', theme: 'castle', buildings: [['throne', 'THRONE ROOM', 1], ['barracks', 'BARRACKS', 7], ['arena', 'ARENA', 9], ['guild', 'GUILD HALL', 7], ['stable', 'ROYAL STABLE', 7], ['library', 'ROYAL ARCHIVE', 0]] },
];
const DISTRICT_COUNT = 6; // the market (capital zone) plus five district zones
const HARBOR_BIOMES = ['coast', 'marsh'];
// links between district zones by index k (side -> k); all of them are two-way
const DISTRICT_LINKS = { 1: { N: 3, E: 2, S: 4 }, 2: { W: 1, N: 5 }, 3: { S: 1, E: 5 }, 5: { W: 3, S: 2 }, 4: { N: 1 } };
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
const NEW_SERVICES = ['alchemist', 'jeweler', 'tailor', 'guild', 'library', 'arena', 'barracks', 'throne'];
const districtId = (capId, k) => `city_${capId}_${k}`;

// the five district zones for one capital: { k, key, id, name, links: { side: districtId }, buildings, theme }
function cityPlan(capId, cityName, biome) {
  const lower = HARBOR_BIOMES.includes(biome) ? 'harbor' : 'slums';
  const defs = DISTRICTS.filter(d => d.k !== 4 || d.key === lower).sort((a, b) => a.k - b.k);
  return defs.map(d => ({
    k: d.k, key: d.key, theme: d.theme, id: districtId(capId, d.k),
    name: `${cityName} ${d.name}`.slice(0, 24), district: d.name,
    links: Object.fromEntries(Object.entries(DISTRICT_LINKS[d.k]).map(([side, k]) => [side, districtId(capId, k)])),
    buildings: d.buildings,
  }));
}
// a small deterministic hash for layout variety
const h32 = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// the walled district grid (ZW x ZH chars), themed; exits and buildings are added by the game wiring
function districtGrid(theme, seed, ZW, ZH) {
  const g = Array.from({ length: ZH }, () => Array(ZW).fill('"'));
  let n = h32(seed);
  const rnd = () => { n = (Math.imul(n ^ (n >>> 13), 1274126177) + 0x9e3779b9) >>> 0; return n / 4294967296; };
  for (let x = 0; x < ZW; x++) { g[0][x] = 'M'; g[ZH - 1][x] = 'M'; g[1][x] = 'A'; g[ZH - 2][x] = 'A'; }
  for (let y = 0; y < ZH; y++) { g[y][0] = 'M'; g[y][ZW - 1] = 'M'; if (y > 0 && y < ZH - 1) { g[y][1] = 'A'; g[y][ZW - 2] = 'A'; } }
  const midY = Math.floor(ZH / 2), midX = Math.floor(ZW / 2);
  // main roads run through the inner wall at the exit positions (EXIT_POS sits on these lines), like buildCity
  for (let x = 1; x < ZW - 1; x++) g[midY][x] = 'h';
  for (let y = 1; y < ZH - 1; y++) g[y][midX] = '|';
  for (let y = midY - 2; y <= midY + 2; y++) for (let x = midX - 3; x <= midX + 3; x++) g[y][x] = 'S';
  const dot = (x, y, c) => { if (y > 1 && y < ZH - 2 && x > 1 && x < ZW - 2 && g[y][x] === '"') g[y][x] = c; };
  if (theme === 'temple') { for (const [cx, cy] of [[5, 4], [ZW - 7, ZH - 6]]) for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) dot(cx + i, cy + j, '~'); }
  if (theme === 'noble') { for (const [cx, cy] of [[3, 3], [ZW - 6, 3], [3, ZH - 5], [ZW - 6, ZH - 5]]) for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) if (rnd() < 0.8) dot(cx + i, cy + j, 'T'); }
  if (theme === 'harbor') { for (let y = ZH - 5; y <= ZH - 3; y++) for (let x = 2; x < ZW - 2; x++) g[y][x] = y === ZH - 5 && x % 6 === 3 ? 'h' : '~'; for (let x = 3; x < ZW - 2; x += 6) for (let y = ZH - 5; y <= ZH - 3; y++) g[y][x] = 'h'; }
  if (theme === 'slums') { for (let y = 2; y < ZH - 2; y++) for (let x = 2; x < ZW - 2; x++) if (g[y][x] === '"' && rnd() < 0.35) g[y][x] = ','; }
  if (theme === 'castle') { for (let x = 4; x < ZW - 4; x++) if (g[3][x] === '"' && x % 3 !== 0) g[3][x] = 'T'; for (let y = midY - 3; y <= midY + 3; y++) for (let x = midX - 5; x <= midX + 5; x++) if (g[y][x] === '"') g[y][x] = 'S'; }
  return g;
}

if (typeof globalThis !== 'undefined') globalThis.GBQCities = { DISTRICTS, DISTRICT_COUNT, DISTRICT_LINKS, OPPOSITE, NEW_SERVICES, HARBOR_BIOMES, districtId, cityPlan, districtGrid };

// ================================================================ game wiring (browser build only)
if (typeof window === 'undefined' || typeof ZONES === 'undefined' || typeof buildZone !== 'function' || typeof Field === 'undefined' || typeof HUB_BUILDINGS === 'undefined') return;

const UW = globalThis.GBQUnderworld || {};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// the capitals: every kingdom capital plus Ardenhold (the base game's city hub)
const capitals = new Set(Object.keys(UW.kingdomByCapital || {}).filter(id => ZONE_BY_ID[id]));
for (const z of ZONES) if (z.town && z.id === z.region) capitals.add(z.id);
const cityNameOf = cap => { const s = typeof SETTLEMENT_DEFS !== 'undefined' && SETTLEMENT_DEFS[cap.id]; return ((s && s.name) || cap.name).replace(/^(THE )/, '').slice(0, 12); };
const kingdomOfCap = cap => (UW.kingdomByCapital && UW.kingdomByCapital[cap.id]) || (UW.kingdomByRegion && UW.kingdomByRegion[cap.region]) || { name: 'VALENDRIA', ruler: 'THE HIGH COUNCIL', desc: 'The council rules from Ardenhold, and the roads all lead here.' };
const DISTRICT_ZONES = {}; // district zone id -> { cap, plan entry }
for (const capId of capitals) {
  const cap = ZONE_BY_ID[capId]; if (!cap) continue;
  for (const d of cityPlan(capId, cityNameOf(cap), cap.biome)) {
    const z = { id: d.id, name: d.name, region: cap.region, biome: cap.biome, lvl: cap.lvl.slice(), fx: cap.fx, fy: cap.fy, town: false, hand: false, act: cap.act, exp: cap.exp, v: cap.v,
      desc: `${d.district} of ${cityNameOf(cap)}.`, sub: d.district, district: d.key, districtName: d.district, cityOf: capId, cityName: cityNameOf(cap), districtK: d.k };
    ZONE_BY_ID[z.id] = z;
    DISTRICT_ZONES[z.id] = { cap, d, z };
    HUB_BUILDINGS['CITY_' + d.key.toUpperCase()] = d.buildings;
  }
}
globalThis.GBQCities.capitals = [...capitals];
globalThis.GBQCities.districtZones = DISTRICT_ZONES;
// district zones place their buildings with the shared hub placer
{ const hsk0 = hubSettlementKind; hubSettlementKind = function (z) { return z && z.district ? 'CITY_' + z.district.toUpperCase() : hsk0.apply(this, arguments); }; }
// district zones sit on the world map at their city
{ const zp0 = zonePin; zonePin = z => zp0(z && z.cityOf ? ZONE_BY_ID[z.cityOf] || z : z); }

function buildDistrict(z) {
  const { d } = DISTRICT_ZONES[z.id], bio = BIOMES[z.biome] || BIOMES.meadow;
  const g = districtGrid(d.theme, z.id, ZW, ZH), hub = [Math.floor(ZW / 2), Math.floor(ZH / 2)];
  const exits = {};
  for (const [side, to] of Object.entries(d.links)) {
    const [ex, ey] = EXIT_POS[side], [dx, dy] = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[side];
    exits[side] = { x: ex, y: ey, to, ix: ex + dx, iy: ey + dy };
    carve(g, ex, ey, hub[0], hub[1], side === 'N' || side === 'S');
  }
  const poi = {};
  if (d.k === 1) { const p = placeCaveMouth(g, hub, WALKABLE, carve, 'gate-' + z.id, Object.values(exits).map(e => [e.x, e.y])); if (p) poi.cityGate = { x: p.x, y: p.y, to: z.cityOf }; }
  const buildings = placeHubBuildings(z, g, hub, exits, poi, [], []);
  const rows = g.map(r => r.join(''));
  const areas = [[1, 1, 15, 11], [16, 1, 15, 11], [1, 12, 15, 11], [16, 12, 15, 11]].map((rc, i) => ({ id: `${z.id}_a${i}`, r: rc, name: `${z.districtName.split(' ')[0]} ${['NORTHWEST', 'NORTHEAST', 'SOUTHWEST', 'SOUTHEAST'][i]}` }));
  return { id: z.id, zone: z, rows, tiles: worldTiles(bio.tiles, { safe: true }), gfx: zoneGfx(rows, z.biome, true), exits, poi, nodes: [], bosses: [], buildings, hub, areas, name: z.name,
    music: typeof GBQMusic !== 'undefined' && GBQMusic.zoneMusic ? GBQMusic.zoneMusic(z, 'town') : 'town' };
}
{ const b0 = buildZone; buildZone = function (z) {
    if (z && z.district && DISTRICT_ZONES[z.id]) return buildDistrict(z);
    const m = b0.apply(this, arguments);
    try {
      if (z && capitals.has(z.id) && !m.poi.cityGate) {
        const g = m.rows.map(r => r.split(''));
        const avoid = [...Object.values(m.exits).map(e => [e.x, e.y]), ...m.nodes.map(n => [n[0], n[1]]), ...m.bosses.map(b => [b.x, b.y]),
          ...Object.values(m.poi).filter(p => p && Number.isFinite(p.x)).map(p => [p.x, p.y]), ...(m.buildings || []).flatMap(b => [[b.x, b.y], [b.x + 1, b.y], [b.x, b.y - 1], [b.x + 1, b.y - 1], [b.x, b.y + 1], [b.x + 1, b.y + 1]])];
        const p = placeCaveMouth(g, m.hub, WALKABLE, carve, 'gate-' + z.id, avoid);
        if (p) { m.poi.cityGate = { x: p.x, y: p.y, to: districtId(z.id, 1) }; m.rows = g.map(r => r.join('')); m.gfx = zoneGfx(m.rows, z.biome, z.town); }
      }
    } catch (e) { /* the capital works without its gate */ }
    return m;
  }; }
// walking through a CITY GATE
{ const ia0 = Field.prototype.interactAt; Field.prototype.interactAt = function (x, y) {
    const gate = !G.inst && this.m && this.m.poi && this.m.poi.cityGate;
    if (gate && gate.x === x && gate.y === y && ZONE_BY_ID[gate.to]) {
      const target = ZONE_BY_ID[gate.to], tm = buildZoneCached(gate.to), land = tm.poi && tm.poi.cityGate;
      if (!land) return say('The gate is barred.');
      return choose(['ENTER', 'STAY'], k => {
        if (k !== 0) return;
        SFX.door(); fadeTo(() => { G.map = gate.to; G.x = land.x; G.y = land.y + 1; G.dir = 'down'; G.mounted = false; this.ox = this.oy = 0; this.reload(); });
      }, `CITY GATE: to ${target.name}.`);
    }
    return ia0.apply(this, arguments);
  }; }
// a toast when you step into a district
{ const rl0 = Field.prototype.reload; let last = null; Field.prototype.reload = function () {
    rl0.apply(this, arguments);
    try { const z = this.zone; if (!G.inst && z && z.id !== last) { last = z.id; if (z.district) toast(z.cityName, z.districtName, 'px_map', 'waypoint'); } } catch (e) { /* no toast */ }
  }; }

// ------------------------------------------------ the new services
const capOfHere = () => { const z = ZONE_BY_ID[G.map]; return z && z.cityOf ? ZONE_BY_ID[z.cityOf] : z; };
function alchemist(b) {
  const ALCH = ['potion', 'greater', 'superior', 'supreme', 'ether', 'antitoxin', 'might']; // healing, mana, cures and draughts (no food)
  const stock = ALCH.filter(k => ITEMS[k] && ITEMS[k].price > 0);
  const opts = stock.map(k => `${ITEMS[k].name} ${ITEMS[k].price}G`.slice(0, 22)).concat(['LEAVE']);
  choose(opts, i => {
    const k = stock[i]; if (!k) return;
    if (G.gold < ITEMS[k].price) { SFX.error(); return say('Not enough gold.'); }
    G.gold -= ITEMS[k].price; addItem(k, 1); SFX.coin(); saveGame(); alchemist(b);
  }, `${b.name}: Tonics, draughts and elixirs. GOLD ${G.gold}`);
}
function jeweler(b) {
  if (!globalThis.GBQGems) return say(`${b.name}: Come back when the caravans bring stones.`);
  const tier = Math.max(1, Math.min(9, 1 + Math.floor(G.lvl / 80))), price = 120 * tier * tier, types = Object.keys(GBQGems.GEM_TYPES);
  const opts = types.map(t => `T${tier} ${GBQGems.GEM_TYPES[t].name} ${price}G`.slice(0, 22)).concat(['LEAVE']);
  choose(opts, i => {
    const t = types[i]; if (!t) return;
    if (G.gold < price) { SFX.error(); return say('Not enough gold.'); }
    G.gold -= price; GBQGems.addGemToInventory(G, `${t}_t${tier}`, 1); SFX.coin(); saveGame(); say(`Bought a T${tier} ${GBQGems.GEM_TYPES[t].name}. Socket it from your bag.`);
  }, `${b.name}: Cut stones for your sockets. GOLD ${G.gold}`);
}
function tailor(b) {
  const slots = [['head', 'HELM'], ['back', 'CLOAK'], ['hands', 'GLOVES'], ['waist', 'BELT'], ['legs', 'LEGGINGS'], ['feet', 'BOOTS']].filter(([s]) => WONDROUS.some(w => w.slot === s));
  const price = 200 + G.lvl * 20;
  choose(slots.map(([, n]) => `${n} ${price}G`).concat(['LEAVE']), i => {
    const s = slots[i]; if (!s) return;
    if (G.gold < price) { SFX.error(); return say('Not enough gold.'); }
    if (G.bag.length >= BAG_MAX) { SFX.error(); return say('Your bag is full.'); }
    G.gold -= price;
    const it = makeItem({ kind: 'wondrous', base: WONDROUS.find(w => w.slot === s[0]).id, rarity: 3, lvl: G.lvl });
    addGear(it); SFX.equip(); saveGame(); say(`${b.name} hands over ${it.name}.`);
  }, `${b.name}: A made-to-measure piece, rare quality. GOLD ${G.gold}`);
}
function library(b) {
  const cap = capOfHere(), k = kingdomOfCap(cap), reg = REGIONS.find(r => r.id === cap.region) || {};
  G.cityStudy = G.cityStudy || {};
  const studied = G.cityStudy[cap.id] === today();
  choose([`READ: ${k.name}`.slice(0, 22), `READ: ${(reg.name || cap.name)}`.slice(0, 22), studied ? 'STUDY (DONE TODAY)' : 'STUDY (+XP, DAILY)', 'LEAVE'], i => {
    if (i === 0) say([`${k.name}.`, `Ruled by ${k.ruler}.`, k.desc || '']);
    else if (i === 1) say([`${reg.name || cap.name}.`, reg.desc || cap.desc || 'An old land with older roads.']);
    else if (i === 2) {
      if (studied) return say('You have studied enough for today.');
      G.cityStudy[cap.id] = today();
      const xp = Math.max(10, Math.round((xpForLevel(G.lvl + 1) - xpForLevel(G.lvl)) * 0.05));
      gainXP(G, xp); SFX.quest_done ? SFX.quest_done() : SFX.confirm(); saveGame(); say(`Hours among the shelves. +${xp} XP.`);
    }
  }, `${b.name}: Quiet, please.`);
}
function arena(b) {
  const cap = capOfHere();
  choose(['FIGHT A BOUT', 'FIGHT A GROUP', 'LEAVE'], i => {
    if (i > 1) return;
    SFX.confirm(); startBattle(rollEncounter(cap, { group: i === 1 }));
  }, `${b.name}: Win and the crowd will pay you in gold. LV ${cap.lvl[0]}-${cap.lvl[1]}`);
}
function barracks(b) {
  const price = 40 + G.lvl * 4, party = [G, ...(G.companions || [])];
  const drill = (id, label) => { if (G.gold < price) { SFX.error(); return say('Not enough gold.'); } G.gold -= price; for (const c of party) c.buffs = (c.buffs || []).filter(x => x.id !== id).concat([{ id, fights: 3 }]); SFX.confirm(); saveGame(); say(`Drill done. Your party is ${label} for 3 fights.`); };
  choose([`WEAPON DRILL ${price}G`, `SPARRING ${price}G`, 'LEAVE'], i => { if (i === 0) drill('might', 'MIGHTY'); else if (i === 1) drill('focus', 'FOCUSED'); }, `${b.name}: The captain will drill your party.`);
}
function throne(b) {
  const cap = capOfHere(), k = kingdomOfCap(cap);
  G.royalFavor = G.royalFavor || {};
  const done = G.royalFavor[cap.id] === today();
  choose(['AUDIENCE', done ? 'ROYAL FAVOUR (DONE)' : 'ROYAL FAVOUR (DAILY)', 'LEAVE'], i => {
    if (i === 0) say([`${k.ruler} looks down from the throne.`, `"Welcome to ${k.name}, traveller."`, k.desc || '']);
    else if (i === 1) {
      if (done) return say('"You have had our favour today. Return tomorrow."');
      G.royalFavor[cap.id] = today(); const gold = 50 + G.lvl * 10; G.gold += gold; SFX.coin(); saveGame();
      say([`${k.ruler} nods to the steward.`, `You receive ${gold} G.`]);
    }
  }, `${b.name}: The court of ${k.name}.`.slice(0, 60));
}
const SERVICE = { alchemist, jeweler, tailor, library, arena, barracks, throne, guild: b => { SFX.open(); push(new SideQuestBoard(capOfHere().id, b.name)); } };
if (typeof useBuilding === 'function') { const ub0 = useBuilding; useBuilding = function (b, field) {
    if (b && SERVICE[b.svc]) { SFX.open(); return SERVICE[b.svc](b); }
    return ub0.apply(this, arguments);
  }; }
})();
