// ================================================================ HUB BUILDINGS: inns, shops and houses in every town and village
// gen.js places the buildings (placeHubBuildings, HUB_BUILDINGS) and records them on the zone map as
// m.buildings = [{ x, y, svc, name, spr, kind }], where (x, y) is the bottom-left tile of a 2x2
// footprint of solid 'B' tiles. This file draws them, and opens each one when you face any of its
// tiles and press A (or walk into its door from below).
//   INN           rest, set your hearth, hire companions (innMenu)
//   GENERAL STORE buy and sell (vendorMenu)
//   SMITHY        repair, upgrade and craft gear (smithMenu)          towns only
//   STABLE        mounts (stableMenu)                                  towns only
//   POST OFFICE   mail (mailMenu)                                      towns only
//   BANK          your stash (StashScene)                              towns only
//   SHRINE        PRAY: free HP/MP and BLESSED for 3 fights, once every 10 minutes
//   WINDMILL      BUY BREAD: WELL FED for 5 fights
//   HOUSES        the townsfolk who live there

const SHRINE_COOLDOWN = 10 * 60 * 1000;
const HOUSE_LINES = [
  'A kettle whistles inside. "Mind the mud on your boots!"',
  'A child peeks through the shutters, then ducks away.',
  '"The warden says the roads are worse every year."',
  '"If you are going to the dungeon, bring more potions than you think."',
  'Nobody is home. A cat watches you from the windowsill.',
  '"My grandmother saw the Codex once. Or so she says."',
  '"Trade is good since the waypoint was rebuilt."',
  'Someone is singing inside, badly but happily.',
  '"Bandits took our cart last week. Keep your blade close."',
  'The door is locked. A sign reads: GONE FISHING.',
];

function buildingAt(m, x, y) {
  if (!m || !m.buildings) return null;
  return m.buildings.find(b => x >= b.x && x <= b.x + 1 && y >= b.y - 1 && y <= b.y) || null;
}

function shrinePray(b) {
  const now = Date.now(), last = (G.shrineAt || 0);
  if (now - last < SHRINE_COOLDOWN) {
    const min = Math.ceil((SHRINE_COOLDOWN - (now - last)) / 60000);
    return say([`${b.name}: The candles are still burning from your last prayer.`, `Come back in ${min} minute${min === 1 ? '' : 's'}.`]);
  }
  G.shrineAt = now;
  for (const c of [G, ...(G.companions || [])]) {
    const D = derive(c); c.hp = Math.max(c.hp, D.hpMax); c.res = Math.max(c.res || 0, resMax(c, D));
    c.buffs = (c.buffs || []).filter(x => x.id !== 'bless').concat([{ id: 'bless', fights: 3 }]);
  }
  SFX.heal(); saveGame();
  say(['You kneel and pray. A warm light fills you.', 'HP and MP restored. Your party is BLESSED for 3 fights.']);
}

function millBread(b) {
  const price = 10 + Math.floor(G.lvl / 4);
  choose([`BUY BREAD (${price}G)`, 'LEAVE'], k => {
    if (k !== 0) return;
    if (G.gold < price) return say('Not enough gold.');
    G.gold -= price;
    for (const c of [G, ...(G.companions || [])]) c.buffs = (c.buffs || []).filter(x => x.id !== 'fed').concat([{ id: 'fed', fights: 5 }]);
    SFX.eat ? SFX.eat() : SFX.confirm(); saveGame();
    say('Fresh bread, still warm. Your party is WELL FED for 5 fights.');
  }, `MILLER: Flour from our own fields. Bread for the road?`);
}

function useBuilding(b, field) {
  if (b.svc === 'house') {
    const r = RNG(`house-${G.map}-${b.x}-${b.y}`);
    SFX.open(); return say(r.pick(HOUSE_LINES));
  }
  if (b.svc === 'shrine') { SFX.open(); return choose(['PRAY', 'LEAVE'], k => { if (k === 0) shrinePray(b); }, `${b.name}: A quiet altar to the old gods.`); }
  if (b.svc === 'mill') { SFX.open(); return millBread(b); }
  return npcService({ svc: b.svc, name: b.name });
}

function drawBuilding(e, ex, ey) {
  const img = IMG[e.b.spr];
  if (img) { ctx.drawImage(img, Math.round(ex - 1), Math.round(ey + T - img.height), img.width, img.height); return; }
  // no sprite (art not loaded): a plain roofed block so the footprint is never invisible
  fill(ex, ey - T + 4, 2 * T, 2 * T - 4, 2); fill(ex + 2, ey - T + 6, 2 * T - 4, 6, 3); fill(ex + 12, ey + 6, 8, 10, 3);
}

{
  const ent0 = Field.prototype.entities;
  Field.prototype.entities = function () {
    const e = ent0.call(this);
    if (G.inst || !this.zone || !this.m || !this.m.buildings) return e;
    for (const b of this.m.buildings) e.push({ kind: 'building', b, x: b.x, y: b.y, walk: true, name: b.name });
    return e;
  };
  const act0 = Field.prototype.interactAt;
  Field.prototype.interactAt = function (x, y) {
    if (!G.inst && this.zone && this.chAt(x, y) === 'B') {
      const b = buildingAt(this.m, x, y);
      if (b) {
        if (G.ghost) return say('You are a spirit. Nobody inside can see you.');
        return useBuilding(b, this);
      }
    }
    return act0.call(this, x, y);
  };
  const bump0 = Field.prototype.bump;
  Field.prototype.bump = function (x, y) {
    if (!G.inst && this.zone && this.chAt(x, y) === 'B' && G.dir === 'up') {
      const b = buildingAt(this.m, x, y);
      if (b && y === b.y) { this.interactAt(x, y); return true; }
    }
    return bump0.call(this, x, y);
  };
}
