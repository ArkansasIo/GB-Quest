// Hidden world encounters: concealed NPCs, caches, portals, rooms and secret bosses.
'use strict';
const GBQ_SECRET_WORLD_DEFS = Object.freeze([
  { id: 'lantern_keeper', zone: 'hollowmere', name: 'THE DROWNED LANTERN KEEPER', type: 'npc', minLvl: 4, hint: 'A lantern glows where the reeds grow silent.' },
  { id: 'frost_cache', zone: 'greypeak', name: 'THE ICE-SEALED CACHE', type: 'cache', minLvl: 8, hint: 'A cold glint hides among the mountain stones.' },
  { id: 'king_under_ash', zone: 'ashenbarrows', name: 'THE KING UNDER ASH', type: 'dungeon', minLvl: 20, hint: 'The oldest barrow has a door with no handle.' },
  { id: 'builder_room', zone: 'ardenhold', name: 'THE BUILDER’S HIDDEN WORKSHOP', type: 'developer', minLvl: 1, hint: 'Look behind the city’s forgotten wall.' },
  { id: 'void_herald', zone: 'duskmoor', name: 'THE VOID HERALD', type: 'boss', minLvl: 28, hint: 'A second shadow moves when yours stands still.' },
  { id: 'ember_gate', zone: 'emberwaste', name: 'THE EMBER GATE', type: 'portal', minLvl: 14, hint: 'A crack in the basalt breathes warm air.' },
]);
function ensureSecretWorld(state) {
  if (!state || typeof state !== 'object') throw new TypeError('A game state is required.');
  state.secretWorld = state.secretWorld && typeof state.secretWorld === 'object' && !Array.isArray(state.secretWorld) ? state.secretWorld : {};
  return state.secretWorld;
}
function secretWorldPosition(def, map) {
  if (!map || !Array.isArray(map.rows) || !map.rows.length) return null;
  const h = map.rows.length, w = map.rows[0].length, occupied = new Set();
  const poi = map.poi || {};
  for (const value of Object.values(poi)) if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) occupied.add(value.x + ',' + value.y);
  for (const b of map.bosses || []) occupied.add(b.x + ',' + b.y);
  for (const node of map.nodes || []) occupied.add(node[0] + ',' + node[1]);
  for (const ex of Object.values(map.exits || {})) occupied.add(ex.x + ',' + ex.y);
  const seed = (typeof hashStr === 'function' ? hashStr(def.id + ':' + def.zone) : def.id.length * 7919) >>> 0;
  const start = seed % Math.max(1, (w - 4) * (h - 4));
  for (let n = 0; n < (w - 4) * (h - 4); n++) {
    const k = (start + n * 37) % ((w - 4) * (h - 4));
    const x = 2 + (k % (w - 4)), y = 2 + Math.floor(k / (w - 4));
    const ch = map.rows[y] && map.rows[y][x];
    if (typeof WALKABLE !== 'undefined' && WALKABLE.has(ch) && !occupied.has(x + ',' + y)) return { x, y };
  }
  return null;
}
function secretWorldAt(state, zone, map, x, y) {
  if (!zone || !map) return null;
  const def = GBQ_SECRET_WORLD_DEFS.find(d => d.zone === zone.id);
  if (!def || (Number(state.lvl) || 1) < def.minLvl) return null;
  const pos = secretWorldPosition(def, map);
  return pos && pos.x === x && pos.y === y ? def : null;
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
      grantSecretWorldReward(state, def, { gold: 1200, potions: 2 });
      say(['A hooded keeper emerges from the reeds.', '“The old roads were built over older doors.”', 'You receive 1,200 gold and two potions.']);
      toast('SECRET NPC FOUND', def.name, 'px_crown', 'achievement');
    }, 'A faint lantern moves against the wind. Someone is waiting.');
  }
  if (def.type === 'cache') {
    if (found[def.id] && found[def.id].claimed) return say('The ice-sealed cache is empty.');
    grantSecretWorldReward(state, def, { gold: 3200, sigils: 2, potions: 3 });
    toast('INVISIBLE CACHE FOUND', '+3,200 GOLD  +2 SIGILS', 'item_chest', 'achievement');
    return say(['You uncover a chest beneath a sheet of ancient ice.', 'Inside: 3,200 gold, 2 boss sigils and 3 potions.']);
  }
  if (def.type === 'dungeon' || def.type === 'developer' || def.type === 'portal') {
    const repeat = !!(found[def.id] && found[def.id].entered);
    found[def.id] = Object.assign({}, found[def.id], { entered: true, foundAt: found[def.id] && found[def.id].foundAt || Date.now() });
    if (typeof saveGame === 'function') saveGame();
    const level = Math.max(def.minLvl, Math.min(720, state.lvl + (def.type === 'developer' ? 0 : 4)));
    const theme = def.type === 'developer' ? 'temple' : def.type === 'portal' ? 'lava' : 'crypt';
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
    foe.name = 'VOID HERALD'; foe.hp = Math.round(foe.hp * 3.2); foe.maxhp = foe.hp; foe.ac += 4; foe.hit += 4;
    foe.xp = Math.round((foe.xp || 0) * 8); foe.gold = Math.round((foe.gold || 0) * 8);
    return choose(['CHALLENGE', 'RETREAT'], i => {
      if (i !== 0) return;
      startBattle([foe], { size: Math.max(1, Math.min(4, typeof fieldPartySize === 'function' ? fieldPartySize() : 1)), music: 'arcboss', title: 'THE HIDDEN VOID HERALD',
        onEnd: result => {
          if (result !== 'win') return;
          if (grantSecretWorldReward(state, def, { gold: 12000, sigils: 8 })) {
            const item = makeItem({ lvl: Math.max(level, 40), rarity: 8, boss: true, mf: derive(state).mf, loot: 2 });
            item.name = 'HERALD’S LAST STAR'; item.named = 'secret_herald_star'; item.legend = true; item.lore = 'A star that fell through the seam between worlds.';
            addGear(item); if (typeof saveGame === 'function') saveGame();
            toast('SECRET BOSS DEFEATED', 'HERALD’S LAST STAR', 'px_crown', 'achievement');
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
