// Hidden world encounters: concealed NPCs, caches, portals, rooms and secret bosses.
'use strict';
const GBQ_SECRET_WORLD_BASE_DEFS = [
  { id: 'lantern_keeper', zone: 'hollowmere', name: 'THE DROWNED LANTERN KEEPER', type: 'npc', minLvl: 4, hint: 'A lantern glows where the reeds grow silent.' },
  { id: 'frost_cache', zone: 'greypeak', name: 'THE ICE-SEALED CACHE', type: 'cache', minLvl: 8, hint: 'A cold glint hides among the mountain stones.' },
  { id: 'king_under_ash', zone: 'ashenbarrows', name: 'THE KING UNDER ASH', type: 'dungeon', minLvl: 20, hint: 'The oldest barrow has a door with no handle.' },
  { id: 'builder_room', zone: 'ardenhold', name: 'THE BUILDER’S HIDDEN WORKSHOP', type: 'developer', minLvl: 1, hint: 'Look behind the city’s forgotten wall.' },
  { id: 'void_herald', zone: 'duskmoor', name: 'THE VOID HERALD', type: 'boss', minLvl: 28, hint: 'A second shadow moves when yours stands still.', relic: 'HERALD’S LAST STAR' },
  { id: 'ember_gate', zone: 'emberwaste', name: 'THE EMBER GATE', type: 'portal', minLvl: 14, hint: 'A crack in the basalt breathes warm air.' },
];
const GBQ_SECRET_ADJECTIVES = ['Forgotten','Whispering','Sunken','Shattered','Veiled','Moonlit','Hollow','Crimson','Silver','Thornbound','Starless','Gilded','Ashen','Frostbitten'];
const GBQ_SECRET_NOUNS = ['Covenant','Reliquary','Pilgrim','Sentinel','Crown','Sanctum','Oracle','Waystone','Oath','Archive','Warden','Beacon','Chalice','Throne','Key','Observatory'];
const GBQ_SECRET_HINTS = {
  npc: 'A traveler waits where the old road bends away from the light.',
  cache: 'A small glimmer catches your eye among the stones.',
  dungeon: 'A seam in the earth suggests a passage beneath the surface.',
  portal: 'The air shimmers here, though no heat or wind can explain it.',
  boss: 'Something ancient watches from just beyond the edge of sight.',
};
function buildSecretWorldCatalog() {
  const zones = typeof ZONES !== 'undefined' && Array.isArray(ZONES) ? ZONES : [];
  const fallback = ['elderwood','hollowmere','thornwood','greypeak','sandspire','saltreach','emberwaste','frostmarch','verdantdeep','ashenbarrows','silverhaven','duskmoor','ardenhold'];
  const zoneData = zones.length ? zones : fallback.map((id, i) => ({ id, lvl: [Math.max(1, i * 3 + 1), Math.max(4, i * 3 + 4)] }));
  const result = GBQ_SECRET_WORLD_BASE_DEFS.map(d => ({ ...d }));
  const types = ['npc','cache','dungeon','portal','boss','cache','npc','dungeon','cache','portal'];
  for (let i = 0; result.length < 100; i++) {
    const serial = i + 1, zone = zoneData[(i * 17 + 5) % zoneData.length];
    const adjective = GBQ_SECRET_ADJECTIVES[(i * 7 + 3) % GBQ_SECRET_ADJECTIVES.length];
    const noun = GBQ_SECRET_NOUNS[(i * 11 + 5) % GBQ_SECRET_NOUNS.length];
    const type = types[i % types.length], id = 'hidden_' + String(serial).padStart(3, '0');
    const level = Math.max(1, Number(zone.lvl && zone.lvl[0]) || 1);
    const reward = type === 'boss'
      ? { gold: 2000 + serial * 100, sigils: 3 + serial % 6, potions: 1 + serial % 3 }
      : type === 'cache' ? { gold: 500 + serial * 45, sigils: 1 + serial % 3, potions: 1 + serial % 4 }
      : type === 'npc' ? { gold: 350 + serial * 30, sigils: 0, potions: 1 + serial % 3 }
      : { gold: 600 + serial * 35, sigils: 1 + serial % 2, potions: 1 };
    result.push({ id, zone: zone.id, name: 'THE ' + adjective.toUpperCase() + ' ' + noun.toUpperCase() + ' ' + String(serial).padStart(2, '0'),
      type, minLvl: level, hint: GBQ_SECRET_HINTS[type], reward,
      relic: type === 'boss' ? adjective.toUpperCase() + ' ' + noun.toUpperCase() + ' RELIC' : undefined });
  }
  return Object.freeze(result.map(d => {
    if (d.reward) return Object.freeze(d);
    const reward = d.type === 'boss' ? { gold: 12000, sigils: 8, potions: 0 }
      : d.type === 'cache' ? { gold: 3200, sigils: 2, potions: 3 }
      : d.type === 'npc' ? { gold: 1200, sigils: 0, potions: 2 }
      : { gold: 900, sigils: 1, potions: 1 };
    return Object.freeze({ ...d, reward: Object.freeze(reward) });
  }));
}
const GBQ_SECRET_WORLD_DEFS = buildSecretWorldCatalog();
function ensureSecretWorld(state) {
  if (!state || typeof state !== 'object') throw new TypeError('A game state is required.');
  state.secretWorld = state.secretWorld && typeof state.secretWorld === 'object' && !Array.isArray(state.secretWorld) ? state.secretWorld : {};
  return state.secretWorld;
}
function secretWorldFindPosition(def, map, occupied) {
  const h = map.rows.length, w = map.rows[0].length, total = Math.max(1, (w - 4) * (h - 4));
  const seed = (typeof hashStr === 'function' ? hashStr(def.id + ':' + def.zone) : def.id.length * 7919) >>> 0;
  const start = seed % total;
  for (let n = 0; n < total; n++) {
    const k = (start + n * 37) % total, x = 2 + (k % (w - 4)), y = 2 + Math.floor(k / (w - 4));
    const ch = map.rows[y] && map.rows[y][x];
    if (typeof WALKABLE !== 'undefined' && WALKABLE.has(ch) && !occupied.has(x + ',' + y)) return { x, y };
  }
  return null;
}
function secretWorldPosition(def, map) {
  if (!map || !Array.isArray(map.rows) || !map.rows.length || !map.rows[0] || map.rows[0].length < 6 || map.rows.length < 6) return null;
  const occupied = new Set(), poi = map.poi || {};
  for (const value of Object.values(poi)) if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) occupied.add(value.x + ',' + value.y);
  for (const b of map.bosses || []) occupied.add(b.x + ',' + b.y);
  for (const node of map.nodes || []) occupied.add(node[0] + ',' + node[1]);
  for (const ex of Object.values(map.exits || {})) if (ex) occupied.add(ex.x + ',' + ex.y);
  for (const prior of GBQ_SECRET_WORLD_DEFS) {
    if (prior.id === def.id) break;
    if (prior.zone !== def.zone) continue;
    const pos = secretWorldFindPosition(prior, map, occupied);
    if (pos) occupied.add(pos.x + ',' + pos.y);
  }
  return secretWorldFindPosition(def, map, occupied);
}
function secretWorldAt(state, zone, map, x, y) {
  if (!zone || !map) return null;
  for (const def of GBQ_SECRET_WORLD_DEFS) {
    if (def.zone !== zone.id || (Number(state.lvl) || 1) < def.minLvl) continue;
    const pos = secretWorldPosition(def, map);
    if (pos && pos.x === x && pos.y === y) return def;
  }
  return null;
}
function grantSecretWorldReward(state, def, reward) {
  const found = ensureSecretWorld(state);
  if (found[def.id] && found[def.id].claimed) return false;
  found[def.id] = { foundAt: Date.now(), claimed: true };
  state.gold = Math.max(0, Number(state.gold) || 0) + (reward.gold || 0);
  state.bossTokens = Math.max(0, Number(state.bossTokens) || 0) + (reward.sigils || 0);
  state.inv = state.inv && typeof state.inv === 'object' ? state.inv : {};
  state.inv.potion = Math.max(0, Number(state.inv.potion) || 0) + (reward.potions || 0);
  state.stats = state.stats || {};
  state.stats.secretFinds = Math.max(0, Number(state.stats.secretFinds) || 0) + 1;
  if (typeof saveGame === 'function') saveGame();
  return true;
}
function activateSecretWorld(def, state) {
  const found = ensureSecretWorld(state);
  if (def.type === 'npc') {
    if (found[def.id] && found[def.id].claimed) return say('The lantern keeper has already shared the secret. “The mountain remembers every footstep.”');
    return choose(['LISTEN', 'LEAVE'], i => {
      if (i !== 0) return;
      grantSecretWorldReward(state, def, def.reward || { gold: 1200, potions: 2 });
      say(['A hooded keeper emerges from the reeds.', '“The old roads were built over older doors.”', 'You receive 1,200 gold and two potions.']);
      toast('SECRET NPC FOUND', def.name, 'px_crown', 'achievement');
    }, 'A faint lantern moves against the wind. Someone is waiting.');
  }
  if (def.type === 'cache') {
    if (found[def.id] && found[def.id].claimed) return say('The ice-sealed cache is empty.');
    grantSecretWorldReward(state, def, def.reward || { gold: 3200, sigils: 2, potions: 3 });
    toast('INVISIBLE CACHE FOUND', '+3,200 GOLD  +2 SIGILS', 'item_chest', 'achievement');
    return say(['You uncover a chest beneath a sheet of ancient ice.', 'Inside: 3,200 gold, 2 boss sigils and 3 potions.']);
  }
  if (def.type === 'dungeon' || def.type === 'developer' || def.type === 'portal') {
    const repeat = !!(found[def.id] && found[def.id].entered);
    if (!found[def.id] || !found[def.id].claimed) grantSecretWorldReward(state, def, def.reward || { gold: 800, sigils: 1, potions: 1 });
    found[def.id] = Object.assign({}, found[def.id], { entered: true, foundAt: found[def.id] && found[def.id].foundAt || Date.now() });
    if (typeof saveGame === 'function') saveGame();
    const level = Math.max(def.minLvl, Math.min(720, state.lvl + (def.type === 'developer' ? 0 : 4)));
    const theme = def.type === 'developer' ? 'temple' : def.type === 'portal' ? 'lava' : def.type === 'puzzle' ? 'crystal' : 'crypt';
    const dungeon = { id: 'secret_' + def.id, name: def.name, lvl: level, zone: def.zone, theme };
    if (typeof enterInstance === 'function') {
      if (repeat) toast('SECRET PASSAGE', 'The hidden route opens again.', 'item_key', 'stairs');
      return enterInstance('dungeon', dungeon, 1, Math.max(1, Math.min(4, typeof fieldPartySize === 'function' ? fieldPartySize() : 1)));
    }
    return say('The hidden passage is sealed.');
  }
  if (def.type === 'boss') {
    if (found[def.id] && found[def.id].claimed) return say('The Void Herald’s echo has faded. Its relic is already yours.');
    const base = (typeof BESTIARY !== 'undefined' && BESTIARY.length) ? BESTIARY[(typeof hashStr === 'function' ? hashStr(def.id) : 0) % BESTIARY.length] : null;
    if (!base || typeof makeMonster !== 'function') return say('A presence stirs beyond the veil.');
    const level = Math.max(def.minLvl, state.lvl + 3), foe = makeMonster(base, level, state.difficulty || 2);
    foe.name = def.name; foe.hp = Math.round(foe.hp * 3.2); foe.maxhp = foe.hp; foe.ac += 4; foe.hit += 4;
    foe.xp = Math.round((foe.xp || 0) * 8); foe.gold = Math.round((foe.gold || 0) * 8);
    return choose(['CHALLENGE', 'RETREAT'], i => {
      if (i !== 0) return;
      startBattle([foe], { size: Math.max(1, Math.min(4, typeof fieldPartySize === 'function' ? fieldPartySize() : 1)), music: 'arcboss', title: 'THE HIDDEN VOID HERALD',
        onEnd: result => {
          if (result !== 'win') return;
          if (grantSecretWorldReward(state, def, def.reward || { gold: 12000, sigils: 8 })) {
            const item = makeItem({ lvl: Math.max(level, 40), rarity: 8, boss: true, mf: derive(state).mf, loot: 2 });
            item.name = def.relic || (def.name + ' RELIC'); item.named = 'secret_' + def.id; item.legend = true; item.lore = 'A star that fell through the seam between worlds.';
            addGear(item); if (typeof saveGame === 'function') saveGame();
            toast('SECRET BOSS DEFEATED', item.name, 'px_crown', 'achievement');
          }
        } });
    }, 'A second shadow detaches from the first. LV' + level + ' — a hidden boss.');
  }
}
function secretWorldSummary(state) {
  const found = ensureSecretWorld(state);
  return { total: GBQ_SECRET_WORLD_DEFS.length, discovered: GBQ_SECRET_WORLD_DEFS.filter(d => !!found[d.id]).length,
    entries: GBQ_SECRET_WORLD_DEFS.map(d => ({ ...d, found: !!found[d.id], claimed: !!(found[d.id] && found[d.id].claimed), entered: !!(found[d.id] && found[d.id].entered) })) };
}
const GBQSecretWorld = Object.freeze({ definitions: GBQ_SECRET_WORLD_DEFS, ensure: ensureSecretWorld, position: secretWorldPosition, at: secretWorldAt, activate: activateSecretWorld, grant: grantSecretWorldReward, summary: secretWorldSummary });
globalThis.GBQSecretWorld = GBQSecretWorld;
