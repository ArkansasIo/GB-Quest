'use strict';

// Player-facing gem socket management and tier-upgrading.
class GemSocketScene {
  constructor(item) { this.opaque = true; this.item = item; this.socket = 0; this.msg = 'A: SOCKET  SELECT: REMOVE  START: CRAFT'; this.mt = 0; }
  flash(message) { this.msg = String(message || '').toUpperCase(); this.mt = 150; }
  update() {
    const api = globalThis.GBQGems;
    if (!api || !this.item) { removeScene(this); return; }
    if (this.mt > 0) this.mt--;
    if (P('b')) { SFX.back(); removeScene(this); return; }
    const cap = api.gemSocketCapacity(this.item), sockets = api.normalizeGemSockets(this.item);
    if (nav('left')) { this.socket = (this.socket + Math.max(1, cap) - 1) % Math.max(1, cap); SFX.cursor(); }
    if (nav('right')) { this.socket = (this.socket + 1) % Math.max(1, cap); SFX.cursor(); }
    if (P('select')) {
      const result = api.unsocketGemToInventory(G, this.item, this.socket);
      if (result.ok) { this.flash('REMOVED ' + result.gem); SFX.craft(); }
      else { this.flash(result.reason); SFX.error(); }
      return;
    }
    if (P('a')) {
      if (!cap) return this.flash('NO GEM SOCKETS');
      const owned = Object.keys(G.gems || {}).filter(id => (G.gems[id] || 0) > 0 && api.gemDefinition(id));
      if (!owned.length) return this.flash('NO GEMS IN BAG');
      const options = owned.map(id => { const d = api.gemDefinition(id); return d.name + ' x' + G.gems[id] + ' +' + d.value + ' ' + d.label; });
      options.push('CANCEL');
      choose(options, index => {
        if (index < 0 || index >= owned.length) return;
        const result = api.socketGemFromInventory(G, this.item, owned[index], this.socket);
        if (result.ok) { this.flash('SOCKETED ' + result.gem); SFX.equip(); }
        else { this.flash(result.reason); SFX.error(); }
      }, 'SELECT A GEM');
      return;
    }
    if (P('start')) this.craftMenu();
  }
  craftMenu() {
    const api = globalThis.GBQGems;
    const recipes = [];
    for (const type of Object.keys(api.GEM_TYPES)) for (let tier = 1; tier < 9; tier++) {
      const id = type + '_t' + tier, next = type + '_t' + (tier + 1), count = (G.gems && G.gems[id]) || 0;
      if (count >= 3) recipes.push({ id, next, count });
    }
    if (!recipes.length) { this.flash('NEED 3 MATCHING GEMS'); return; }
    const options = recipes.map(r => api.gemDefinition(r.id).name + ' x3  >  ' + api.gemDefinition(r.next).name);
    options.push('CANCEL');
    choose(options, index => {
      if (index < 0 || index >= recipes.length) return;
      const r = recipes[index];
      G.gems[r.id] -= 3;
      if (!G.gems[r.id]) delete G.gems[r.id];
      api.addGemToInventory(G, r.next, 1);
      this.flash('CRAFTED ' + r.next);
      SFX.craft();
    }, 'GEM FUSION: 3 OF ONE TIER');
  }
  draw() {
    const api = globalThis.GBQGems, cap = api.gemSocketCapacity(this.item), sockets = api.normalizeGemSockets(this.item);
    fill(0, 0, W, H, 0); hdr();
    fill(2, 13, W - 4, 15, 1); textC('GEM SOCKET FORGE', W / 2, 16, 'gold');
    textC((this.item.name || 'EQUIPMENT').slice(0, 25), W / 2, 31, 3);
    textC('ILVL ' + (this.item.ilvl || 1) + '  SOCKETS ' + cap, W / 2, 41, 2);
    for (let i = 0; i < Math.max(1, cap); i++) {
      const x = 9 + i * 37, y = 56;
      fill(x, y, 32, 32, i === this.socket ? 3 : 1);
      fill(x + 2, y + 2, 28, 28, 0);
      const id = sockets[i], d = id && api.gemDefinition(id);
      if (d) {
        const colour = { ruby: 'red', sapphire: 'blue', emerald: 'green', amethyst: 'purple', topaz: 'gold', diamond: 'white', onyx: 'grey', opal: 'cyan', garnet: 'red' }[d.type] || 3;
        fill(x + 10, y + 9, 12, 12, colour);
        textC('T' + d.tier, x + 16, y + 23, 3);
      } else textC('EMPTY', x + 16, y + 12, 2);
      if (i === this.socket) textC('^', x + 16, y + 1, 'gold');
    }
    let y = 96;
    text('GEM INVENTORY', 5, y, 'gold'); y += 10;
    const owned = Object.keys(G.gems || {}).filter(id => G.gems[id] > 0).slice(0, 5);
    if (!owned.length) { text('NO GEMS CARRIED', 5, y, 2); y += 9; }
    else for (const id of owned) { const d = api.gemDefinition(id); text((d ? d.name : id).slice(0, 16), 5, y, 3); textR('x' + G.gems[id], W - 5, y, 2); y += 8; }
    const affixes = api.gemAffixes(this.item), stats = Object.entries(affixes);
    text('BONUSES', 5, 133, 'gold');
    if (stats.length) textC(stats.map(([k, v]) => k.toUpperCase() + ' +' + v).join('  ').slice(0, 25), W / 2, 140, 3);
    if (this.mt > 0) { fill(2, H - 12, W - 4, 10, 1); textC(this.msg.slice(0, 25), W / 2, H - 10, 'gold'); }
    else { fill(2, H - 12, W - 4, 10, 1); textC('A SOCKET  SEL REMOVE  START CRAFT', W / 2, H - 10, 2); }
  }
}
globalThis.GemSocketScene = GemSocketScene;
