'use strict';

// Player-facing Rune Forge: socketing, extraction and three-to-one tier fusion.
class RuneForgeScene {
  constructor(item) { this.opaque = true; this.item = item; this.socket = 0; this.msg = 'A SOCKET  SELECT REMOVE  START FUSE'; this.mt = 0; }
  flash(message) { this.msg = String(message || '').toUpperCase(); this.mt = 150; }
  update() {
    const api = globalThis.GBQRunes;
    if (!api || !this.item) { removeScene(this); return; }
    if (this.mt > 0) this.mt--;
    if (P('b')) { SFX.back(); removeScene(this); return; }
    const cap = api.runeSocketCapacity(this.item);
    if (nav('left')) { this.socket = (this.socket + Math.max(1, cap) - 1) % Math.max(1, cap); SFX.cursor(); }
    if (nav('right')) { this.socket = (this.socket + 1) % Math.max(1, cap); SFX.cursor(); }
    if (P('select')) {
      const result = api.unsocketRuneToInventory(G, this.item, this.socket);
      this.flash(result.ok ? 'REMOVED ' + result.rune : result.reason);
      SFX[result.ok ? 'craft' : 'error'](); return;
    }
    if (P('a')) {
      if (!cap) return this.flash('NO RUNE SOCKETS');
      const owned = Object.keys(G.runes || {}).filter(id => (G.runes[id] || 0) > 0 && api.runeDefinition(id));
      if (!owned.length) return this.flash('NO RUNES IN BAG');
      const options = owned.map(id => { const d = api.runeDefinition(id); return d.name + ' x' + G.runes[id] + ' +' + d.value + ' ' + d.label; });
      options.push('CANCEL');
      choose(options, index => {
        if (index < 0 || index >= owned.length) return;
        const result = api.socketRuneFromInventory(G, this.item, owned[index], this.socket);
        this.flash(result.ok ? 'SOCKETED ' + result.rune : result.reason);
        SFX[result.ok ? 'equip' : 'error']();
      }, 'SELECT A RUNE');
      return;
    }
    if (P('start')) this.fuseMenu();
  }
  fuseMenu() {
    const api = globalThis.GBQRunes, recipes = [];
    for (const type of Object.keys(api.RUNE_TYPES)) for (let tier = 1; tier < 9; tier++) {
      const id = type + '_r' + tier, next = type + '_r' + (tier + 1);
      if (((G.runes && G.runes[id]) || 0) >= 3) recipes.push({ id, next });
    }
    if (!recipes.length) { this.flash('NEED 3 MATCHING RUNES'); return; }
    const options = recipes.map(r => api.runeDefinition(r.id).name + ' x3 > ' + api.runeDefinition(r.next).name);
    options.push('CANCEL');
    choose(options, index => {
      if (index < 0 || index >= recipes.length) return;
      const r = recipes[index]; G.runes[r.id] -= 3;
      if (!G.runes[r.id]) delete G.runes[r.id];
      api.addRuneToInventory(G, r.next, 1);
      this.flash('FUSED ' + r.next); SFX.craft();
    }, 'RUNE FUSION');
  }
  draw() {
    const api = globalThis.GBQRunes, cap = api.runeSocketCapacity(this.item), sockets = api.normalizeRuneSockets(this.item);
    fill(0, 0, W, H, 0); hdr();
    fill(2, 13, W - 4, 15, 1); textC('RUNE FORGE', W / 2, 16, 'gold');
    textC((this.item.name || 'EQUIPMENT').slice(0, 25), W / 2, 31, 3);
    textC('ILVL ' + (this.item.ilvl || 1) + '  RUNE SLOTS ' + cap, W / 2, 41, 2);
    for (let i = 0; i < Math.max(1, cap); i++) {
      const x = 15 + i * 44, y = 56, id = sockets[i], d = id && api.runeDefinition(id);
      fill(x, y, 36, 34, i === this.socket ? 3 : 1); fill(x + 2, y + 2, 32, 30, 0);
      if (d) { fill(x + 12, y + 8, 12, 12, ({ flame: 'red', frost: 'cyan', storm: 'yellow', ward: 'blue', vigor: 'green', might: 'orange', precision: 'white', shadow: 'purple', leech: 'red' })[d.type] || 3); textC('R' + d.tier, x + 18, y + 22, 3); }
      else textC('EMPTY', x + 18, y + 13, 2);
      if (i === this.socket) textC('^', x + 18, y + 1, 'gold');
    }
    let y = 98; text('RUNE INVENTORY', 5, y, 'gold'); y += 10;
    const owned = Object.keys(G.runes || {}).filter(id => G.runes[id] > 0).slice(0, 5);
    if (!owned.length) text('NO RUNES CARRIED', 5, y, 2);
    else for (const id of owned) { const d = api.runeDefinition(id); text((d ? d.name : id).slice(0, 17), 5, y, 3); textR('x' + G.runes[id], W - 5, y, 2); y += 8; }
    const bonuses = Object.entries(api.runeAffixes(this.item));
    text('RUNE BONUSES', 5, 133, 'gold');
    if (bonuses.length) textC(bonuses.map(([k, v]) => k.toUpperCase() + ' +' + v).join(' ').slice(0, 25), W / 2, 140, 3);
    fill(2, H - 12, W - 4, 10, 1);
    textC(this.mt > 0 ? this.msg.slice(0, 25) : 'A SOCKET  SEL REMOVE  START FUSE', W / 2, H - 10, 'gold');
  }
}
globalThis.RuneForgeScene = RuneForgeScene;
