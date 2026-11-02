// GB QUEST scenes: boot logo, title, save slots, prologue, character creation, the field
// (zones, instances, tower), NPC services, fishing, world map, trials, level up, credits.
'use strict';

// ================================================================ BOOT (studio logo, classic handheld style)
class Boot {
  constructor(progress) { this.opaque = true; this.t = 0; this.prog = progress || (() => 1); }
  update() { this.t++; if (this.t === 72) { play(arp('q', [84, 96], 0.09, 0.08)); } if ((this.t > 150 && this.prog() >= 1) || (this.t > 30 && (P('a') || P('start')) && this.prog() >= 1)) { fadeTo(() => reset(new Title())); this.t = -9999; } }
  draw() {
    fill(0, 0, W, H, 0);
    const y = Math.min(56, -20 + this.t * 1.1);
    text(BUILD.studio, 80 - BUILD.studio.length * 6, y, 3, 2);
    fill(80 - BUILD.studio.length * 6, y + 20, BUILD.studio.length * 12, 1, 2);
    if (this.t > 75) textC('PRESENTS', 80, 82, 2);
    if (this.prog() < 1) { bar(40, 120, 80, 5, this.prog(), 1); textC('LOADING', 80, 128, 1); }
    textC(`v${BUILD.version} ${BUILD.build}`, 80, 134, 1);
  }
}

// ================================================================ TITLE
class Title {
  constructor() { this.opaque = true; this.t = 0; this.i = 0; }
  enter() { Music.play('title'); }
  resume() { Music.play('title'); }
  opts() { const o = []; if (lastSlot() >= 0) o.push('CONTINUE'); o.push('NEW GAME', 'LOAD GAME', 'MULTIPLAYER', 'SETTINGS', 'CREDITS'); return o; }
  update() {
    this.t++;
    const o = this.opts();
    if (nav('up')) { this.i = (this.i + o.length - 1) % o.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % o.length; SFX.cursor(); }
    if (P('a') || P('start')) {
      SFX.select();
      const c = o[this.i];
      if (c === 'CONTINUE') { loadSlot(lastSlot()); fadeTo(() => enterWorld()); }
      if (c === 'NEW GAME') push(new SlotPicker('new'));
      if (c === 'LOAD GAME') push(new SlotPicker('load'));
      if (c === 'MULTIPLAYER') say(['MULTIPLAYER: share this page with friends.', 'Load a hero, then visit the REALM STONE in ARDENHOLD (or open SOCIAL > SERVER) to host or join a server.', `Status: ${NET.status || 'OFFLINE'}. Live players: ${NET.peers.length}.`]);
      if (c === 'SETTINGS') push(new SettingsScene());
      if (c === 'CREDITS') push(new Credits());
    }
  }
  draw() {
    // scrolling landscape made of the biome tiles
    const biomes = ['world', 'b_marsh', 'b_snow', 'b_badlands', 'b_volcanic', 'b_crystal', 'b_dusk'];
    const off = (this.t / 2) % 16;
    for (let y = 0; y < 9; y++) for (let x = -1; x < 11; x++) {
      const b = biomes[Math.floor((x + Math.floor(this.t / 32)) / 3) % biomes.length] || 'world';
      const ch = y < 2 ? '0_3' : y > 6 ? '0_2' : (x * 7 + y * 3) % 5 === 0 ? '0_1' : '0_0';
      blit(spr(`${b}_${ch}`, 16, 16), x * 16 - off, y * 16);
    }
    ctx.globalAlpha = 0.5; fill(0, 0, W, H, 0); ctx.globalAlpha = 1;
    frame(8, 8, 144, 44);
    textC('GB QUEST', 81, 14, 2, 2); textC('GB QUEST', 80, 13, 3, 2);
    textC(BUILD.subtitle, 80, 36, 2);
    const bob = Math.round(Math.sin(this.t / 12));
    blit(sprH('c_warden_4', 28), 16, 60 + bob); blit(sprH('c_arcanist_4', 28), 36, 62 - bob); blit(sprH('enemy_goblinking', 30, { flip: true }), 120, 58 + bob);
    const o = this.opts(); const h = o.length * 10 + 6;
    frame(48, 58, 64, h);
    o.forEach((s, i) => { text(s.slice(0, 9), 60, 61 + i * 10, i === this.i ? 3 : 2); if (i === this.i) text('>', 52, 61 + i * 10); });
    textC(`(C)${BUILD.year} ${BUILD.studio}  v${BUILD.version}`, 80, 134, 1);
  }
}

// ================================================================ SAVE SLOTS
class SlotPicker {
  constructor(mode) { this.opaque = true; this.mode = mode; this.i = 0; }
  update() {
    if (nav('up')) { this.i = (this.i + 2) % 3; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % 3; SFX.cursor(); }
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const info = slotInfo(this.i);
    if (this.mode === 'load') {
      if (!info) { SFX.error(); return; }
      choose(['LOAD', 'DELETE', 'CANCEL'], k => {
        if (k === 0) { loadSlot(this.i); fadeTo(() => { scenes.length = 0; enterWorld(); }); }
        if (k === 1) choose(['NO', 'YES, DELETE'], y => { if (y === 1) { store.del(SLOT_KEYS[this.i]); SFX.error(); } }, `Delete ${info.name}? This cannot be undone.`);
      }, `SLOT ${this.i + 1}: ${info.name} LV${info.lvl}`);
    } else {
      const go = () => fadeTo(() => { scenes.length = 0; push(new Prologue(() => push(new CharCreate(this.i)))); });
      if (info) choose(['NO', 'OVERWRITE'], y => { if (y === 1) go(); }, `Slot ${this.i + 1} has ${info.name}. Overwrite?`); else go();
    }
  }
  draw() {
    fill(0, 0, W, H, 0);
    textC(this.mode === 'load' ? 'LOAD GAME' : 'NEW GAME: PICK A SLOT', 80, 4, 3);
    for (let i = 0; i < 3; i++) {
      const y = 18 + i * 40, info = slotInfo(i);
      frame(6, y, 148, 36, i === this.i ? 1 : 0);
      text(`SLOT ${i + 1}`, 12, y + 4, 2);
      if (info) {
        blit(sprH(`c_${info.cls}_0`, 22), 128, y + 7);
        text(`${info.name}`, 12, y + 14); text(`LV${info.lvl} ${CLASSES[info.cls].name}`, 12, y + 24, 2);
        textR(info.zone.slice(0, 12), 124, y + 4, 2);
      } else text('- EMPTY -', 12, y + 16, 1);
    }
  }
}

// ================================================================ PROLOGUE
class Prologue {
  constructor(cb) { this.opaque = true; this.cb = cb; this.i = 0; this.c = 0; this.t = 0; }
  enter() { Music.play('prologue'); }
  update() {
    this.t++;
    const L = PROLOGUE[this.i];
    if (P('start')) { this.done(); return; }
    if (this.c < L.length) { this.c += 0.7; if (P('a')) this.c = L.length; return; }
    if (P('a') || P('b')) { SFX.page(); this.i++; this.c = 0; if (this.i >= PROLOGUE.length) this.done(); }
  }
  done() { if (this.over) return; this.over = true; fadeTo(() => { removeScene(this); this.cb(); }); }
  draw() {
    fill(0, 0, W, H, 3);
    const art = ['item_spellbook', 'px_waypoint', 'px_symbol', 'px_skull', 'enemy_goblinking', 'px_rune', 'c_warden_0', 'elder_0'][this.i] || 'px_waypoint';
    const glow = 2 + Math.round(Math.sin(this.t / 10) * 2);
    fill(80 - 20 - glow, 30 - glow, 40 + glow * 2, 40 + glow * 2, 2);
    blit(sprFit(art, 36), 62, 32);
    text(wrap(PROLOGUE[this.i] || '', 24).join('\n').slice(0, Math.floor(this.c)), 8, 84, 0);
    textR('START: SKIP', 156, 134, 1);
    textC(`${this.i + 1}/${PROLOGUE.length}`, 80, 4, 1);
  }
}

// ================================================================ CHARACTER CREATION
class CharCreate {
  constructor(slot) { this.opaque = true; this.slot = slot; this.step = 0; this.i = 0; this.pick = { species: 'hearthkin', cls: 'warden', bg: 'soldier', name: '', mode: 'solo' }; this.li = 0; }
  enter() { Music.play('character'); }
  lists() { return [Object.keys(SPECIES), CLASS_ORDER, Object.keys(BACKGROUNDS), null, PLAY_MODES.map(m => m.id), null]; }
  update() {
    const L = this.lists()[this.step];
    if (this.step === 3) return this.updateName();
    if (this.step === 5) { if (P('a') || P('start')) { SFX.confirm(); this.finish(); } if (P('b')) { this.step = 4; SFX.back(); } return; }
    if (nav('up') || nav('left')) { this.i = (this.i + L.length - 1) % L.length; SFX.cursor(); }
    if (nav('down') || nav('right')) { this.i = (this.i + 1) % L.length; SFX.cursor(); }
    if (P('b')) { if (this.step > 0) { this.step--; this.i = 0; SFX.back(); } return; }
    if (P('a')) { SFX.select(); this.pick[['species', 'cls', 'bg', null, 'mode'][this.step]] = L[this.i]; this.step++; this.i = 0; if (this.step === 3 && !this.pick.name) this.pick.name = pick(['ARIN', 'BRYN', 'CALE', 'DESS', 'EDRIC', 'FENN', 'GWEN', 'HALE']); }
  }
  updateName() {
    const keys = NAME_LETTERS + '<>', n = keys.length, cols = 7;
    if (nav('left')) { this.li = (this.li + n - 1) % n; SFX.cursor(); }
    if (nav('right')) { this.li = (this.li + 1) % n; SFX.cursor(); }
    if (nav('up')) { this.li = (this.li + n - cols) % n; SFX.cursor(); }
    if (nav('down')) { this.li = (this.li + cols) % n; SFX.cursor(); }
    if (P('b')) { this.pick.name = this.pick.name.slice(0, -1); SFX.back(); }
    if (P('start') && this.pick.name) { this.step = 4; SFX.select(); return; }
    if (P('a')) { const k = keys[this.li]; if (k === '<') this.pick.name = this.pick.name.slice(0, -1); else if (k === '>') { if (this.pick.name) { this.step = 4; } } else if (this.pick.name.length < 10) this.pick.name += k; SFX.type(); }
  }
  finish() {
    G = newGameState(Object.assign({ slot: this.slot }, this.pick));
    const role = CLASSES[G.cls].role === 'tank' ? 'healer' : 'tank';
    const buddy = makeAdventurer(role === 'tank' ? 'warden' : 'chaplain', 1, role === 'tank' ? 'BRAM' : 'ESME'); G.companions.push(buddy);
    saveGame();
    fadeTo(() => { scenes.length = 0; enterWorld(); const ch = chapterDef(); say([`Welcome to AELMOOR, ${G.name}.`, `${G.companions[0].name} the ${CLASSES[G.companions[0].cls].name} will travel with you. Hire more at any inn.`, `CHAPTER 1: ${ch.title}`, ch.line, 'START: menu   SELECT: map   B: mount   A: talk/act'], null, { who: 'NARRATOR' }); });
  }
  draw() {
    fill(0, 0, W, H, 0);
    const titles = ['CHOOSE YOUR SPECIES', 'CHOOSE YOUR CLASS', 'CHOOSE A BACKGROUND', 'NAME YOUR HERO', 'CHOOSE PLAY MODE', 'READY?'];
    textC(titles[this.step], 80, 3, 3); fill(4, 13, 152, 1, 2);
    const L = this.lists()[this.step];
    if (this.step === 0 || this.step === 2 || this.step === 4) {
      L.forEach((k, j) => { const y = 18 + j * 11; if (j === this.i) fill(4, y - 2, 70, 11, 1); text((this.step === 0 ? SPECIES[k].name : this.step === 2 ? BACKGROUNDS[k].name : PLAY_MODES[j].name), 8, y); });
      const k = L[this.i], d = this.step === 0 ? SPECIES[k] : this.step === 2 ? BACKGROUNDS[k] : PLAY_MODES[this.i];
      frame(78, 16, 78, 120); text(wrap(d.desc, 12).join('\n'), 82, 20);
      if (this.step === 0) text(Object.entries(SPECIES[k].asi).map(([a, v]) => `${a}+${v}`).join(' ').slice(0, 12), 82, 108, 2);
      if (this.step === 2) text(BACKGROUNDS[k].skills.map(s => SKILL_NAME[s].slice(0, 8)).join('\n'), 82, 108, 2);
    } else if (this.step === 1) {
      const k = L[this.i], c = CLASSES[k];
      CLASS_ORDER.forEach((id, j) => { const x = 6 + (j % 6) * 25, y = 18 + Math.floor(j / 6) * 30; if (j === this.i) fill(x - 2, y - 2, 24, 30, 1); blit(sprH(`c_${id}_0`, 24), x + 2, y); });
      frame(4, 78, 152, 60);
      text(c.name, 8, 82, 2); textR(`d${c.hd} ${c.primary}`, 152, 82, 2);
      text(wrap(c.desc, 24).slice(0, 3).join('\n'), 8, 93);
      text(`SAVES ${c.saves.join('/')} ${c.caster ? c.caster.toUpperCase() + ' CASTER' : 'MARTIAL'}`.slice(0, 24), 8, 125, 2);
    } else if (this.step === 3) {
      frame(30, 18, 100, 16); text(this.pick.name + ((frameN >> 4) % 2 ? '_' : ''), 36, 22);
      const keys = NAME_LETTERS + '<>';
      [...keys].forEach((k, j) => { const x = 22 + (j % 7) * 17, y = 44 + Math.floor(j / 7) * 14; if (j === this.li) fill(x - 3, y - 2, 13, 12, 1); text(k === '<' ? '<-' : k === '>' ? 'OK' : k, x, y); });
      text('A: add  B: delete  START: done', 4, 132, 2);
    } else {
      const p = this.pick;
      blit(sprH(`c_${p.cls}_0`, 44), 12, 24);
      text(p.name, 60, 22, 3, 1); text(SPECIES[p.species].name, 60, 34, 2); text(CLASSES[p.cls].name, 60, 44, 2); text(BACKGROUNDS[p.bg].name, 60, 54, 2); text(PLAY_MODES.find(m => m.id === p.mode).name, 60, 64, 2);
      const c = newCharacter(p), D = derive(c);
      text(ATTRS.map(a => `${a}${String(D.A[a]).padStart(3)}`).reduce((acc, s, i) => acc + s + (i % 3 === 2 ? '\n' : ' '), ''), 8, 80);
      text(`HP ${D.hpMax}  AC ${D.ac}  INIT ${D.init >= 0 ? '+' : ''}${D.init}`, 8, 112, 2);
      textC('A: BEGIN YOUR STORY', 80, 128, (frameN >> 4) % 2 ? 3 : 2);
    }
  }
}

// ================================================================ FIELD
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const LOOK_F = { down: [0, 3], up: [3, 0], left: [5, 1], right: [4, 2] };
const CITY_NPCS = [
  [5, 7, 'villager_0', 'AUCTIONEER', 'auction'], [10, 6, 'elder_1', 'BANKER', 'bank'], [6, 17, 'villager_2', 'INNKEEPER', 'inn'], [22, 6, 'hero_1', 'TRAINER', 'trainer'],
  [26, 7, 'elder_2', 'GUILDMASTER', 'guild'], [13, 10, 'villager_1', 'MERCHANT', 'vendor'], [19, 10, 'hero_2', 'QUARTERMASTER', 'honor'], [15, 14, 'villager_3', 'LFG BOARD', 'lfg'],
  [12, 14, 'elder_3', 'ORACLE', 'difficulty'], [17, 5, 'hero_3', 'SPIRE KEEPER', 'tower'], [21, 18, 'villager_5', 'TRIALS MASTER', 'trials'], [27, 13, 'villager_4', 'HARBORMASTER', 'portal'],
  [19, 14, 'elder_5', 'REALM STONE', 'server'], [10, 18, 'villager_0', 'STABLEMASTER', 'stable'], [23, 18, 'hero_0', 'ARENAMASTER', 'arena'],
];
const TILE_SVC = { H: 'auction', J: 'inn', r: 'mail', q: 'trainer', a: 'bank' };
let FIELD = null;
const currentField = () => FIELD;
function enterWorld() { reset(new Field()); }
class Field {
  constructor() { this.opaque = true; this.ox = 0; this.oy = 0; this.walk = 0; this.since = 0; this.toast = 90; this.trail = []; FIELD = this; this.reload(); }
  reload() {
    if (G.inst) { this.m = G.inst.map; this.zone = null; }
    else { this.m = buildZoneCached(G.map); this.zone = ZONE_BY_ID[G.map]; }
    this.toast = 90; this.trail = []; Physics.clear();
    window.SOLID_AT = null;
    Music.play(this.m.music);
    if (this.zone) { if (!G.waypoints[G.map] && this.m.poi.waypoint) {} questEvent('enter', G.map); this.discover(); }
  }
  enter() { this.reload(); }
  resume() { Music.play(this.m.music); FIELD = this; }
  tileAt(x, y) { const r = this.m.rows[y]; if (!r || x < 0 || x >= r.length) return null; return this.m.tiles[r[x]]; }
  chAt(x, y) { return (this.m.rows[y] || '')[x]; }
  entities() {
    const e = [];
    if (G.inst) {
      for (const p of G.inst.map.pulls) if (!G.inst.cleared.includes(p.id)) e.push({ kind: 'pull', p, x: p.x, y: p.y });
      if (!G.inst.chest) e.push({ kind: 'chest', x: G.inst.map.chest.x, y: G.inst.map.chest.y });
      for (const t of G.inst.map.traps) if (!t.done && derive(G).passive >= t.dc) e.push({ kind: 'trap', t, x: t.x, y: t.y, walk: true });
      return e;
    }
    const z = this.zone, m = this.m;
    if (z.town && z.id === z.region) CITY_NPCS.forEach(([x, y, s, name, svc]) => e.push({ kind: 'npc', x, y, spr: s, name, svc }));
    else if (z.town) [[6, 8, 'villager_4', 'DOCKHAND', 'portal'], [12, 8, 'villager_1', 'FISHMONGER', 'vendor'], [20, 8, 'hero_1', 'TRAINER', 'trainer']].forEach(([x, y, s, name, svc]) => e.push({ kind: 'npc', x, y, spr: s, name, svc }));
    else {
      if (z.id === 'elderwood') { e.push({ kind: 'npc', x: 5, y: 16, spr: 'elder_0', name: 'ELDER MAE', svc: 'elder' }); e.push({ kind: 'npc', x: 7, y: 14, spr: 'villager_0', name: 'MERCHANT', svc: 'vendor' }); e.push({ kind: 'npc', x: 2, y: 7, spr: 'hero_1', name: 'CAPTAIN', svc: 'warden' }); }
      else { const r = RNG('warden-' + z.id); e.push({ kind: 'npc', x: m.hub[0], y: m.hub[1] - 1, spr: r.pick(['villager_1', 'villager_3', 'elder_1', 'hero_2']), name: `WARDEN ${r.pick(NPC_FIRST)}`, svc: 'warden' }); }
      if (m.poi.waypoint) e.push({ kind: 'waypoint', x: m.poi.waypoint.x, y: m.poi.waypoint.y });
      const nodes = G.nodes[z.id] || {};
      m.nodes.forEach(([x, y, herb], i) => { if (!nodes[i] || G.stats.steps - nodes[i] > 250) e.push({ kind: 'herb', i, x, y, herb, walk: true }); });
      for (const b of m.bosses) { const k = G.bossKills[b.id]; if (!k || Date.now() - k > (b.arc ? 3600e3 : 1800e3)) e.push({ kind: 'boss', b, x: b.x, y: b.y }); }
      if (G.ghost && G.ghost.map === z.id) e.push({ kind: 'grave', x: G.ghost.x, y: G.ghost.y, walk: true });
    }
    for (const p of realmPlayersIn(G.map)) e.push({ kind: 'sim', p, x: p.x, y: p.y, walk: true });
    for (const p of NET.peersInZone(G.map)) e.push({ kind: 'peer', p, x: p.presence.x, y: p.presence.y, walk: true });
    return e;
  }
  blocked(x, y) {
    const t = this.tileAt(x, y); if (!t || !t[1]) return true;
    return this.entities().some(e => e.x === x && e.y === y && !e.walk);
  }
  update() {
    if (this.toast > 0) this.toast--;
    // sim players wander
    if (frameN % 40 === 0) for (const p of realmPlayersIn(G.map)) { const d = pick(Object.keys(DIRS)), [dx, dy] = DIRS[d]; if (!this.blocked(p.x + dx, p.y + dy) && R() < 0.5) { p.x += dx; p.y += dy; p.dir = d; } }
    weatherTick(this.zone ? this.zone.biome : null, this.cam ? this.cam[0] : 0, this.cam ? this.cam[1] : 0);
    if (this.ox || this.oy) {
      const sp = G.mounted ? 4 : 2;
      this.ox -= Math.sign(this.ox) * sp; this.oy -= Math.sign(this.oy) * sp; this.walk += sp;
      if (!this.ox && !this.oy) this.onStep();
      return;
    }
    if (P('start')) { SFX.open(); push(new MainMenu()); return; }
    if (P('select')) { SFX.open(); push(new WorldMap()); return; }
    if (P('b') && G.hasMount && !G.inst && !G.ghost) { G.mounted = !G.mounted; SFX[G.mounted ? 'howl' : 'cursor'](); return; }
    if (P('a')) { this.interact(); return; }
    for (const d of ['up', 'down', 'left', 'right']) {
      if (!held[d]) continue;
      G.dir = d;
      const [dx, dy] = DIRS[d], nx = G.x + dx, ny = G.y + dy;
      if (this.exitAt(nx, ny)) return;
      if (this.blocked(nx, ny)) { if (P(d) || rep[d] % 20 === 0) { if (!this.bump(nx, ny)) SFX.cursor(); } }
      else { this.trail.unshift([G.x, G.y, G.dir]); this.trail.length = 12; G.x = nx; G.y = ny; this.ox = -dx * T; this.oy = -dy * T; }
      break;
    }
  }
  exitAt(nx, ny) {
    if (G.inst) return false;
    for (const side in this.m.exits) { const e = this.m.exits[side]; if (e.x === nx && e.y === ny) {
      const target = ZONE_BY_ID[e.to]; const tm = buildZoneCached(e.to), back = tm.exits[OPP[side]];
      if (!back) return false;
      if (target.lvl[0] > G.lvl + 8 && !G.ghost) { say(`${target.name} (LV ${target.lvl[0]}+) is too dangerous for now.`); return true; }
      SFX.door(); fadeTo(() => { G.map = e.to; G.x = back.ix; G.y = back.iy; G.dir = { N: 'up', S: 'down', E: 'right', W: 'left' }[side]; this.ox = this.oy = 0; this.reload(); });
      return true;
    } }
    return false;
  }
  bump(x, y) {
    const e = this.entities().find(e => e.x === x && e.y === y);
    if (e && (e.kind === 'pull' || e.kind === 'boss')) { this.interactAt(x, y); return true; }
    const ch = this.chAt(x, y);
    if (!G.inst && 'kKRQHJrqa'.includes(ch)) { this.interactAt(x, y); return true; }
    return false;
  }
  interact() { const [dx, dy] = DIRS[G.dir]; this.interactAt(G.x + dx, G.y + dy); }
  interactAt(x, y) {
    const e = this.entities().find(e => e.x === x && e.y === y);
    if (G.ghost && !(e && (e.kind === 'npc' && e.svc === 'warden' || e.kind === 'grave'))) { if (e && e.kind === 'npc') return say('You are a spirit. Find your grave, or ask a warden for a spirit healer.'); }
    if (e) {
      if (e.kind === 'npc') return npcService(e);
      if (e.kind === 'waypoint') { if (!G.waypoints[G.map]) { G.waypoints[G.map] = true; SFX.waypoint(); toast('WAYPOINT', this.zone.name, 'px_waypoint', 'waypoint'); checkAchievements(); } return push(new WaypointMenu()); }
      if (e.kind === 'herb') return gatherHerb(e);
      if (e.kind === 'boss') return fightBoss(e.b);
      if (e.kind === 'pull') return fightPull(e.p);
      if (e.kind === 'chest') return openInstanceChest();
      if (e.kind === 'sim') return simPlayerMenu(e.p);
      if (e.kind === 'peer') return say([`${clean(e.p.presence.n)} - LV${e.p.presence.l} ${(CLASSES[e.p.presence.c] || { name: '' }).name}`, e.p.presence.h ? `Hosting server: ${clean(e.p.presence.h, 20)}` : 'A fellow adventurer (live player).']);
    }
    const ch = this.chAt(x, y), t = this.tileAt(x, y);
    if (G.inst) { if (ch === 'L') return leaveInstance(); if (ch === 'U') return towerNext(); if (ch === 't') return say('A torch flickers.'); if (ch === 's') return say('A grim statue watches you.'); return; }
    if (t && (ch === '~' || ch === 'W' || ch === 'w' || ch === 'v')) return push(new Fishing());
    if (this.zone.town && this.zone.id === this.zone.region) {
      const svc = { K: 'tower', k: 'tower', Q: 'arena', R: 'portal', H: 'auction', J: 'inn', r: 'mail', q: 'trainer' }[ch]; if (svc) return npcService({ svc, name: svc.toUpperCase() });
    } else if (this.zone.town) { const svc = { H: 'auction', J: 'inn', r: 'mail', q: 'trainer', Q: 'portal', R: 'portal' }[ch]; if (svc) return npcService({ svc, name: svc.toUpperCase() }); }
    if (ch === 'k' || ch === 'K') { const dg = this.m.poi.dungeon; if (dg) return instanceMenu('dungeon', DUNGEONS.find(d => d.id === dg.id)); }
    if (ch === 'R' && this.m.poi.raid) return instanceMenu('raid', RAIDS.find(d => d.id === this.m.poi.raid.id));
    if (TILE_SVC[ch] && this.zone.id === 'elderwood') return npcService({ svc: TILE_SVC[ch], name: TILE_SVC[ch].toUpperCase() });
    if (ch === 'H' || ch === 'J') return say('A cosy house. Nobody answers.');
    if (ch === 'r' || ch === 'q') return say('A small shrine. You feel calm.');
  }
  onStep() {
    G.stats.steps++; this.since++;
    const t = this.tileAt(G.x, G.y), ch = this.chAt(G.x, G.y);
    const stepS = this.zone && this.zone.biome === 'snow' ? 'step_snow' : (ch === 's' || ch === 'S') ? 'step_sand' : G.inst ? 'step_stone' : 'step_grass';
    if (G.stats.steps % 2 === 0) SFX[stepS]();
    if (G.mounted && this.cam) FX.dust(G.x * T - this.cam[0] + 4, G.y * T - this.cam[1] + 14);
    if (G.inst) {
      const trap = G.inst.map.traps.find(tr => tr.x === G.x && tr.y === G.y && !tr.done);
      if (trap) { trap.done = true; const sv = skillCheck(G, 'acrobatics', trap.dc); const d = sv.ok ? 0 : roll(trap.dmg).total; if (d) G.hp = Math.max(1, G.hp - d); shake = 6; SFX[d ? 'hurt' : 'dodge'](); say([`A hidden trap! ${sv.text}`, d ? `You take ${d} damage.` : 'You leap clear!']); }
      return;
    }
    if (G.ghost && G.ghost.map === G.map && Math.abs(G.ghost.x - G.x) + Math.abs(G.ghost.y - G.y) <= 0) { G.ghost = null; G.hp = Math.ceil(derive(G).hpMax / 2); SFX.revive(); say('You return to your body. Half HP restored.'); return; }
    this.discover();
    const zt = t && t[2];
    const rate = zt === 'wood' ? 0.1 : zt === 'open' ? 0.06 : 0;
    if (rate && !G.ghost && this.since > 5 && R() < rate * (G.mounted ? 0.6 : 1)) {
      this.since = 0;
      const foes = rollEncounter(this.zone, { group: zt === 'wood' });
      const st = skillCheck(G, 'stealth', 10 + Math.floor(foes[0].lvl / 2));
      startBattle(foes, { surprise: st.ok && R() < 0.5 ? 'party' : (!st.ok && st.roll === 1 ? 'foe' : null) });
    }
  }
  discover() {
    if (!this.zone || this.zone.town) return;
    for (const a of this.m.areas) {
      const [x, y, w, h] = a.r;
      if (!G.areas[a.id] && G.x >= x && G.x < x + w && G.y >= y && G.y < y + h) {
        G.areas[a.id] = true; const xp = xpForMonster(this.zone.lvl[0]) * 2; gainXP(G, xp);
        toast('DISCOVERED', a.name, 'px_map', 'discover'); questEvent('discover', a.id); checkAchievements();
      }
    }
  }
  draw() {
    const m = this.m, cols = m.rows[0].length, rows = m.rows.length;
    const px = G.x * T + this.ox, py = G.y * T + this.oy;
    const cx = Math.max(0, Math.min(cols * T - W, px - 72)), cy = Math.max(0, Math.min(rows * T - H, py - 64));
    this.cam = [cx, cy];
    const ghost = !!G.ghost;
    for (let ty = Math.floor(cy / T); ty <= Math.floor((cy + H) / T); ty++)
      for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + W) / T); tx++) {
        const d = this.tileAt(tx, ty); if (!d) continue;
        blit(spr(d[0], T, T, { rot: d[3], ghost }), tx * T - cx, ty * T - cy);
      }
    const list = this.entities().map(e => Object.assign(e, { sy: e.y * T }));
    list.push({ kind: 'player', sy: py });
    G.companions.slice(0, 3).forEach((c, i) => { const tr = this.trail[(i + 1) * 2 - 1]; if (tr) list.push({ kind: 'follower', c, x: tr[0], y: tr[1], dir: tr[2], sy: tr[1] * T - 1 }); });
    if (G.pet) { const tr = this.trail[G.companions.length ? 7 : 1]; if (tr) list.push({ kind: 'pet', x: tr[0], y: tr[1], sy: tr[1] * T - 2 }); }
    list.sort((a, b) => a.sy - b.sy);
    for (const e of list) {
      const ex = e.x * T - cx, ey = e.y * T - cy;
      if (e.kind === 'player') {
        const f = LOOK_F[G.dir][(this.ox || this.oy) ? (this.walk >> 3) % 2 : 0];
        if (G.mounted) { const mnt = sprH('enemy_lizard', 14); blit(mnt, px - cx + (T - mnt.width) / 2, py - cy + 3); }
        const c = sprH(`c_${G.cls}_${f}`, 23, { ghost }); blit(c, px - cx + (T - c.width) / 2, py - cy + T - 23 - (G.mounted ? 6 : 1));
      } else if (e.kind === 'follower') { const c = sprH(`c_${e.c.cls}_${LOOK_F[e.dir][0]}`, 21); blit(c, ex + (T - c.width) / 2, ey + T - 22); }
      else if (e.kind === 'pet') blit(sprH(G.pet === 'slime' ? 'enemy_slime' : 'enemy_bat', 9), ex + 3, ey + 6);
      else if (e.kind === 'npc') { const c = sprH(e.spr, 23); blit(c, ex + (T - c.width) / 2, ey + T - 24); if (e.svc === 'warden' || e.svc === 'elder') { const q = npcMarker(e); if (q) { fill(ex + 5, ey - 12, 7, 10, 3); text(q, ex + 5, ey - 11, q === '?' ? 'gold' : 'gold'); } } }
      else if (e.kind === 'sim' || e.kind === 'peer') {
        const p = e.kind === 'sim' ? e.p : { name: clean(e.p.presence.n), cls: e.p.presence.c, dir: e.p.presence.d || 'down' };
        const c = sprH(`c_${CLASSES[p.cls] ? p.cls : 'warden'}_${LOOK_F[p.dir || 'down'][0]}`, 21); blit(c, ex + (T - c.width) / 2, ey + T - 22);
        const nm = (p.name || '').slice(0, 8); fill(ex + 8 - nm.length * 3 - 1, ey - 8, nm.length * 6 + 2, 8, e.kind === 'peer' ? 'blue' : 3); text(nm, ex + 8 - nm.length * 3, ey - 8, 0);
      }
      else if (e.kind === 'herb') blit(sprH(e.herb === 'sandroot' ? 'px_sandroot' : 'item_herb', 11), ex + 3, ey + 3 - ((frameN >> 5) % 4 === 0 ? 1 : 0));
      else if (e.kind === 'waypoint') blit(sprH('px_waypoint', 14), ex + 2, ey + 1 - Math.round(Math.sin(frameN / 15)));
      else if (e.kind === 'grave') blit(sprH('px_skull', 10), ex + 3, ey + 4);
      else if (e.kind === 'trap') { fill(ex + 4, ey + 6, 8, 4, 'red'); }
      else if (e.kind === 'chest') blit(sprFit('item_chest', 14), ex + 1, ey + 2);
      else if (e.kind === 'boss') { const bd = e.b, B = BOSS_BY_ID[bd.id]; const c = sprH(B.spr, 26); blit(c, ex + (T - c.width) / 2, ey + T - 27 + Math.round(Math.sin(frameN / 10))); if ((frameN >> 4) % 2) text(B.cat === 'arc' ? '!!' : '!', ex + 4, ey - 18, 'red'); }
      else if (e.kind === 'pull') { const p = e.p, s = p.boss ? BOSS_BY_ID[p.boss].spr : (BEAST_BY_ID[p.mobs[0]] || BESTIARY[0]).spr; const c = sprH(s, p.boss ? 26 : 18); blit(c, ex + (T - c.width) / 2, ey + T - c.height - 1 + ((frameN >> 4) % 2)); }
    }
    FX.draw(cx, cy);
    if (this.toast > 0) { const n = (G.inst ? this.m.name : `${this.zone.name}`).slice(0, 24); frame(80 - n.length * 3 - 6, 4, n.length * 6 + 12, 15); textC(n, 80, 7); if (this.zone && !this.zone.town) textC(`${this.zone.sub} LV${this.zone.lvl[0]}-${this.zone.lvl[1]}`, 80, 21, 'gold'); }
    // HUD: hp/xp micro bars
    const D = derive(G);
    bar(1, H - 5, 50, 4, G.hp, D.hpMax, G.hp < D.hpMax * 0.3 ? 'red' : 'hp');
    const x0 = xpForLevel(G.lvl), x1 = xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1));
    bar(53, H - 4, 106, 3, G.xp - x0, Math.max(1, x1 - x0), 'xp');
    if (ghost) textC('SPIRIT', 80, H - 14, 'blue');
  }
}
function npcMarker(e) {
  if (e.svc === 'elder') { const ch = chapterDef(); return ch && ch.type === 'talk' && ch.arg === 'elder' ? '!' : null; }
  const zid = G.map; const ch = chapterDef();
  if (ch && ch.type === 'talk' && ch.arg === 'zone' && regionOf(zid) === ch.region) return '!';
  const qs = sideQuestsFor(zid);
  if (qs.some(q => G.sideq[q.id] && G.sideq[q.id].state === 'ready')) return '?';
  if (qs.some(q => !G.sideq[q.id])) return '!';
  return null;
}

// ================================================================ interactions
function gatherHerb(e) {
  const nodes = G.nodes[G.map] || (G.nodes[G.map] = {});
  const chk = skillCheck(G, 'nature', 8 + Math.floor(G.prof.herb / 10));
  nodes[e.i] = G.stats.steps;
  const n = chk.ok ? 2 : 1; addItem(e.herb, n); SFX.gather();
  const up = gainProf('herb', G.prof.herb);
  questEvent('gather', e.herb);
  toast(`+${n} ${ITEMS[e.herb].name}`, up ? `HERBALISM ${G.prof.herb}` : chk.text.slice(0, 22), ITEMS[e.herb].icon, 'pickup');
}
function fightBoss(b) {
  const B = BOSS_BY_ID[b.id];
  const lvl = Math.max(B.lvl, ZONE_BY_ID[G.map].lvl[1] + 1);
  const mechs = (B.mechs || []).map(m => BOSS_MECH_DESC[m]).join(' ');
  choose(['FIGHT', 'LEAVE'], k => {
    if (k !== 0) return;
    const foe = makeMonster(B, lvl, G.difficulty, { bossId: B.id, cat: B.cat }); foe.name = B.name.slice(0, 16);
    const size = B.cat === 'world' ? Math.max(4, fieldPartySize()) : fieldPartySize();
    startBattle([foe], { size, music: B.cat === 'arc' ? 'arcboss' : 'boss', title: B.title || B.name });
  }, `${B.cat === 'arc' ? 'ARC BOSS' : 'WORLD BOSS'}: ${B.name}. LV${lvl}. ${mechs}`);
}
function simPlayerMenu(p) {
  choose(['INSPECT', 'INVITE', 'DUEL', 'WAVE', 'LEAVE'], k => {
    if (k === 0) say(`${p.name} - LV${p.lvl} ${CLASSES[p.cls].name}${p.guild ? ` <${p.guild}>` : ''}`);
    if (k === 1) { if (G.companions.length >= Math.max(3, modeOf().size - 1)) return say('Your party is full.'); const c = makeAdventurer(p.cls, Math.min(G.lvl, p.lvl), p.name); G.companions.push(c); SFX.lfg_ready(); say(`${p.name} joins your party!`); }
    if (k === 2) { const c = makeAdventurer(p.cls, Math.min(LEVEL_CAP, p.lvl), p.name); const foe = adventurerFoe(c); startBattle([foe], { size: 1, noFlee: true, kind: 'arena', onEnd: r => say(r === 'win' ? `${p.name}: GG! Well fought.` : `${p.name}: Better luck next time.`) }); }
    if (k === 3) { SFX.charm(); chatLog('Emote', G.name, `waves at ${p.name}.`); say(`${p.name} waves back.`); }
  }, `${p.name} LV${p.lvl}`);
}
// an NPC adventurer as a foe (arena / duels / mirror trial)
function adventurerFoe(c) {
  const D = derive(c);
  const m = makeMonster(BESTIARY[0], c.lvl, 2);
  Object.assign(m, { name: c.name, spr: `c_${c.cls}_4`, hp: D.hpMax, maxhp: D.hpMax, ac: D.ac, hit: D.weapon.hit, dc: D.spell ? D.spell.dc : 10, fam: 'humanoid', bestId: null, res: [], imm: [], vuln: [],
    attacks: [{ name: D.weapon.name, type: D.weapon.type, hit: D.weapon.hit, dice: `${D.weapon.dice}+${D.weapon.dmg}` }], multi: D.attacks, spells: D.spell ? D.spell.known.filter(s => s.eff === 'dmg' && s.lvl > 0).slice(-2).map(s => s.id) : [], xp: xpForMonster(c.lvl) * 2, gold: 10 + c.lvl * 3, pvp: true });
  return m;
}

// ================================================================ NPC services
function npcService(e) {
  SFX.open();
  const svc = e.svc;
  if (svc === 'elder') return elderTalk();
  if (svc === 'warden') return wardenMenu(e);
  if (svc === 'vendor') return vendorMenu();
  if (svc === 'inn') return innMenu();
  if (svc === 'trainer') return trainerMenu();
  if (svc === 'auction') return push(new AuctionHouse());
  if (svc === 'mail') return mailMenu();
  if (svc === 'bank') return push(new BankScene());
  if (svc === 'guild') return guildMenu();
  if (svc === 'honor') return honorMenu();
  if (svc === 'lfg') return lfgMenu();
  if (svc === 'difficulty') return difficultyMenu();
  if (svc === 'tower') return towerMenu();
  if (svc === 'trials') return trialsMenu();
  if (svc === 'portal') return portalMenu();
  if (svc === 'server') return serverMenu();
  if (svc === 'stable') return stableMenu();
  if (svc === 'arena') return arenaMenu();
  if (svc === 'keep') return instanceMenu('dungeon', DUNGEONS[0]);
}
function elderTalk() {
  const ch = chapterDef();
  if (ch && ch.type === 'talk' && ch.arg === 'elder') {
    if (ch.i === 0) say(['ELDER MAE: You carry the last lantern. I knew it would choose someone.', 'The EMBER CODEX was torn into twelve pages. Each is held by a tyrant.', 'Goblins of KING GRUK raid our roads. Start there: drive them back, then find his keep to the north-east.', 'Take my blessing. Rest at the castle gate when hurt.'], () => questEvent('talk', 'elder'), { who: 'ELDER MAE' });
    else say(['ELDER MAE: You have them all. Twelve pages, one Codex.', 'Lift it, and let the sun remember AELMOOR.', 'The lantern flares... and dawn breaks across the land.'], () => { questEvent('talk', 'elder'); push(new Credits(true)); }, { who: 'ELDER MAE' });
    return;
  }
  say(['ELDER MAE: ' + (ch ? chapterGoal(ch) : 'The dawn is yours. The SPIRE and the far ISLES still call to heroes.')], null, { who: 'ELDER MAE' });
}
function wardenMenu(e) {
  const zid = G.map, qs = sideQuestsFor(zid), ch = chapterDef();
  const opts = ['QUESTS', 'SHORT REST', 'SPIRIT HEALER', 'LEAVE'];
  if (ch && ch.type === 'talk' && ch.arg === 'zone' && regionOf(zid) === ch.region) opts.unshift('STORY');
  choose(opts, k => {
    const o = opts[k];
    if (o === 'STORY') say([`${e.name}: You came. ${ch.line}`, 'Take this warning: the tyrant here guards a page of the Codex. Find the dungeon and the arc boss of this land.'], () => questEvent('talk', 'warden:' + ch.region), { who: e.name });
    if (o === 'QUESTS') push(new SideQuestBoard(zid, e.name));
    if (o === 'SHORT REST') { const log = shortRest(G); G.companions.forEach(c => shortRest(c)); SFX.heal(); say(['You rest for an hour.'].concat(log.length ? log : ['Nothing to recover.'])); }
    if (o === 'SPIRIT HEALER') { if (!G.ghost) return say('You are alive. No need.'); G.ghost = null; const D = derive(G); G.hp = Math.ceil(D.hpMax / 2); G.buffs = (G.buffs || []).concat([{ id: 'weakened', fights: 3 }]); SFX.revive(); say('You are resurrected, but WEAKENED for 3 fights.'); }
  }, `${e.name}: Well met, ${G.name}.`);
}
class SideQuestBoard {
  constructor(zid, who) { this.opaque = true; this.zid = zid; this.who = who; this.i = 0; }
  update() {
    const qs = sideQuestsFor(this.zid);
    if (nav('up')) { this.i = (this.i + qs.length - 1) % qs.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % qs.length; SFX.cursor(); }
    if (P('b')) { removeScene(this); SFX.back(); return; }
    if (!P('a')) return;
    const q = qs[this.i], st = G.sideq[q.id];
    if (!st) {
      if (q.kind === 'check') { const r = skillCheck(G, 'persuasion', q.dc); G.sideq[q.id] = { state: r.ok ? 'ready' : 'active', prog: r.ok ? 1 : 0 }; say([q.text, r.text, r.ok ? 'They agree. Return for your reward.' : 'They are not convinced. Try again later (talk to me).']); return; }
      G.sideq[q.id] = { state: 'active', prog: 0 }; SFX.quest_accept(); say([`${this.who}: ${q.text}`, `Reward: ${fmt(q.xp)} XP, ${q.gold} G.`]);
    } else if (st.state === 'ready') turnInSide(q.id);
    else if (st.state === 'active' && q.kind === 'check') { const r = skillCheck(G, 'persuasion', q.dc); if (r.ok) { st.state = 'ready'; } say([r.text, r.ok ? 'Success!' : 'Still no.']); }
    else say(st.state === 'done' ? 'Already completed. Thank you!' : `In progress: ${st.prog}/${q.count}.`);
  }
  draw() {
    fill(0, 0, W, H, 0); frame(2, 2, 156, 140);
    text(`${this.who.slice(0, 22)}`, 7, 6, 2);
    const qs = sideQuestsFor(this.zid);
    qs.forEach((q, i) => { const y = 18 + i * 13, st = G.sideq[q.id]; if (i === this.i) fill(4, y - 2, 152, 12, 1); text(st ? (st.state === 'done' ? '#' : st.state === 'ready' ? '?' : '-') : '!', 7, y, st && st.state === 'ready' ? 'gold' : 3); text(q.name.slice(0, 22), 15, y); });
    const q = qs[this.i]; frame(4, 98, 152, 42); text(wrap(q.text, 24).slice(0, 3).join('\n'), 8, 102); text(`${fmt(q.xp)}XP ${q.gold}G`, 8, 131, 2);
  }
}
function vendorMenu() {
  const stock = ['potion', 'greater', 'antitoxin', 'ration', 'campkit', 'ether', 'scroll_mend', 'scroll_flame'].concat(G.lvl >= 10 ? ['superior', 'might', 'scroll_dawn'] : []).concat(G.lvl >= 30 ? ['supreme'] : []);
  const disc = G.daily.discount === new Date().toDateString() ? 0.9 : 1;
  choose(['BUY', 'BUY GEAR', 'SELL', 'SELL ALL JUNK', 'HAGGLE (CHA)', 'LEAVE'], k => {
    if (k === 0) choose(stock.map(s => `${ITEMS[s].name.slice(0, 14)} ${Math.round(ITEMS[s].price * disc)}G`), i => { if (i < 0) return; const s = stock[i], p = Math.round(ITEMS[s].price * disc); if (G.gold < p) { SFX.error(); return say('Not enough gold.'); } G.gold -= p; addItem(s); SFX.buy(); vendorMenu(); }, `Gold: ${fmt(G.gold)}`);
    if (k === 1) { const items = [0, 1, 2, 3].map(i => makeItem({ lvl: G.lvl, rarity: i < 2 ? 1 : 2, kind: i === 3 ? 'wondrous' : i % 2 ? 'armor' : 'weapon' })); choose(items.map(it => `${it.name.slice(0, 14)} ${fmt(it.value * 2)}G`), i => { if (i < 0) return; const it = items[i]; if (G.gold < it.value * 2) return say('Not enough gold.'); G.gold -= it.value * 2; addGear(it); SFX.buy(); }, 'Fresh stock from the forge.'); }
    if (k === 2) push(new BagScene('sell'));
    if (k === 3) { let g = 0; for (const key of Object.keys(G.inv)) if (ITEMS[key] && ITEMS[key].type === 'junk') { g += ITEMS[key].price * G.inv[key]; delete G.inv[key]; } G.bag = G.bag.filter(it => { if (it.rarity === 0) { g += it.value; return false; } return true; }); G.gold += g; SFX.sell(); say(`Sold junk for ${g} G.`); }
    if (k === 4) { if (G.daily.haggle === new Date().toDateString()) return say('The merchant will not haggle again today.'); G.daily.haggle = new Date().toDateString(); const r = skillCheck(G, 'persuasion', 13); if (r.ok) G.daily.discount = new Date().toDateString(); say([r.text, r.ok ? '10% discount for today!' : 'The merchant shrugs. Prices stay.']); }
  }, 'MERCHANT: What will it be?');
}
function innMenu() {
  const price = 5 + Math.floor(G.lvl / 2);
  choose([`LONG REST (${price}G)`, 'SET HEARTH HERE', 'HIRE COMPANION', 'DISMISS COMPANION', 'LEAVE'], k => {
    if (k === 0) { if (G.gold < price) return say('Not enough gold.'); G.gold -= price; longRest(G); G.companions.forEach(longRest); G.ghost = null; Music.play('inn'); SFX.heal(); saveGame(); say(['You sleep soundly. HP, hit dice and spell slots restored.', 'Game saved.']); }
    if (k === 1) { G.hearth = { map: G.map, x: G.x, y: G.y + 1 }; SFX.confirm(); say('Your hearthstone is bound here.'); }
    if (k === 2) { const max = Math.max(3, modeOf().size - 1); if (G.companions.length >= max) return say(`Your party is full (${max}).`); choose(['TANK', 'HEALER', 'DAMAGE'], r => { if (r < 0) return; const c = hireCompanion(['tank', 'healer', 'dps'][r]); SFX.lfg_ready(); say(`${c.name} the ${CLASSES[c.cls].name} joins you!`); }, 'Which role?'); }
    if (k === 3) { if (!G.companions.length) return say('No companions.'); choose(G.companions.map(c => `${c.name} ${CLASSES[c.cls].name.slice(0, 8)}`), i => { if (i >= 0) { G.companions.splice(i, 1); SFX.back(); } }); }
  }, 'INNKEEPER: A warm bed and good company.');
}
function trainerMenu() {
  choose(['SPEND POINTS', 'CHANGE SUBCLASS (100G)', 'RIDING (LV10, 300G)', 'PROFESSIONS', 'LEAVE'], k => {
    if (k === 0) push(new GrowthScene());
    if (k === 1) { if (classLevel(G) < 3) return say('Subclasses unlock at level 3.'); if (G.gold < 100) return say('Not enough gold.'); G.gold -= 100; G.sub = null; G.pending.sub = true; push(new GrowthScene()); }
    if (k === 2) { if (G.hasMount) return say('You already ride.'); if (G.lvl < 10 || G.gold < 300) return say('Need level 10 and 300 G.'); G.gold -= 300; G.hasMount = true; SFX.howl(); checkAchievements(); say('You learn to ride! Press B in the field to mount.'); }
    if (k === 3) say(Object.entries(PROFS).map(([k2, n]) => `${n}: ${G.prof[k2]}/100`).concat(['Gather herbs (A on bushes), fish (A at water), craft from MENU > CRAFT.']));
  }, 'TRAINER: Knowledge is power.');
}
function mailMenu() {
  if (!G.mail.length) return say('Your mailbox is empty.');
  const m = G.mail.shift(); if (m.gold) G.gold += m.gold; if (m.item) addGear(m.item); SFX.mail();
  say([`FROM ${m.from}: ${m.text}`, m.gold ? `+${m.gold} G` : m.item ? `Received ${m.item.name}` : '']);
}
function guildMenu() {
  if (G.guild) return choose(['ROSTER', 'LEAVE GUILD', 'BACK'], k => { if (k === 0) say([`<${G.guild}>`, `Members: ${G.name}, ${SIM_NAMES.slice(0, 5).join(', ')}`]); if (k === 1) { G.guild = null; SFX.back(); } }, `<${G.guild}>`);
  choose(GUILD_NAMES.map(n => `JOIN <${n}>`).concat(['CREATE (100G)']), k => {
    if (k < 0) return;
    if (k < GUILD_NAMES.length) { G.guild = GUILD_NAMES[k]; } else { if (G.gold < 100) return say('Not enough gold.'); G.gold -= 100; G.guild = `${G.name}'S BAND`.slice(0, 16); }
    SFX.achievement(); checkAchievements(); say(`Welcome to <${G.guild}>!`); chatLog('Guild', 'GUILDMASTER', `${G.name} has joined the guild!`);
  }, 'GUILDMASTER: Strength in numbers.');
}
function honorMenu() {
  const items = [[150, 3, 'weapon'], [150, 3, 'armor'], [250, 4, 'weapon'], [250, 4, 'armor'], [200, 3, 'wondrous']];
  choose(items.map(([c, r, kd]) => `${RARITY[r].name} ${kd.toUpperCase()} ${c}H`), i => {
    if (i < 0) return; const [c, r, kd] = items[i];
    if (G.honor < c) return say(`Need ${c} honor (you have ${G.honor}).`);
    G.honor -= c; const it = makeItem({ lvl: G.lvl, rarity: r, kind: kd }); it.name = 'GLADIATOR ' + it.name.replace(/^\+\d /, ''); addGear(it); SFX.buy();
  }, `QUARTERMASTER: Honor: ${G.honor}`);
}
function difficultyMenu() {
  choose(DIFFICULTY.map(d => `${d.n} ${d.name}${diffUnlocked(d.n) ? '' : ` (LV${d.req})`}`), i => {
    if (i < 0) return; if (!diffUnlocked(i + 1)) { SFX.error(); return say(`Unlocks at level ${DIFFICULTY[i].req}.`); }
    G.difficulty = i + 1; SFX.confirm(); const d = DIFFICULTY[i];
    say(`Difficulty ${d.n}: ${d.name}. Monsters +${d.lvl} LV, HP x${d.hp}, XP x${d.xp}, loot x${d.loot}.`);
  }, `ORACLE: Current: ${diffOf().name}`, { start: G.difficulty - 1 });
}
function stableMenu() {
  choose(['BUY RAPTOR (300G)', 'LEAVE'], k => { if (k === 0) trainerMenu(); }, 'STABLEMASTER: Fine mounts here.');
}
function portalMenu() {
  const opts = [{ name: 'ELDERWOOD', z: 'elderwood' }, { name: 'ARDENHOLD', z: 'ardenhold' }].concat(EXPANSIONS.map(x => ({ name: `${x.name} LV${x.lvl[0]}`, z: `${x.id}_0`, need: x.lvl[0] - 5 })));
  choose(opts.map(o => o.name.slice(0, 22)), i => {
    if (i < 0) return; const o = opts[i];
    if (o.need && G.lvl < o.need) return say(`The ship captain refuses: reach level ${o.need} first.`);
    travelTo(o.z);
  }, 'HARBORMASTER: Where to?');
}
function travelTo(zid, x, y) {
  const m = buildZoneCached(zid);
  SFX.waypoint();
  fadeTo(() => { G.inst = null; G.map = zid; G.x = x != null ? x : m.hub[0]; G.y = y != null ? y : m.hub[1] + 1; G.mounted = false; if (FIELD) FIELD.reload(); });
}
class WaypointMenu {
  constructor() { const ids = Object.keys(G.waypoints).filter(id => ZONE_BY_ID[id]); this.ids = ids; }
  update() {}
  enter() {
    removeScene(this);
    choose(this.ids.map(id => ZONE_BY_ID[id].name.slice(0, 20)), i => { if (i >= 0) travelTo(this.ids[i], buildZoneCached(this.ids[i]).poi.waypoint ? buildZoneCached(this.ids[i]).poi.waypoint.x : null, buildZoneCached(this.ids[i]).poi.waypoint ? buildZoneCached(this.ids[i]).poi.waypoint.y + 1 : null); }, 'WAYPOINT: fast travel');
  }
  draw() {}
}
function serverMenu() {
  const svs = NET.servers();
  const opts = [NET.server ? 'STOP HOSTING' : 'HOST SERVER', `JOIN SERVER (${svs.length})`, NET.hostOf ? 'LEAVE SERVER' : null, `PLAY MODE: ${modeOf().name}`, 'LIVE PLAYERS'].filter(Boolean);
  choose(opts, k => {
    const o = opts[k]; if (!o) return;
    if (o === 'HOST SERVER') { if (!NET.room) return say('Live multiplayer needs this page open in Claude with the room connected. Status: ' + (NET.status || 'OFFLINE')); NET.hostServer(); say([`Server "${NET.server.name}" is online.`, 'Friends who open this page can JOIN from their REALM STONE. They fight in your party (host runs every battle).']); }
    else if (o === 'STOP HOSTING') { NET.stopServer(); say('Server stopped.'); }
    else if (o.startsWith('JOIN')) { if (!svs.length) return say('No servers found. Ask a friend to HOST.'); choose(svs.map(s => `${s.name} (${s.players})`), i => { if (i >= 0) NET.joinServer(svs[i].peer); }); }
    else if (o === 'LEAVE SERVER') { NET.hostOf = null; say('You left the server.'); }
    else if (o.startsWith('PLAY MODE')) choose(PLAY_MODES.map(m => m.name + ': ' + m.desc.slice(0, 10)), i => { if (i >= 0) { G.playMode = PLAY_MODES[i].id; SFX.confirm(); say(`${PLAY_MODES[i].name}: ${PLAY_MODES[i].desc}`); } });
    else if (o === 'LIVE PLAYERS') say(NET.peers.length ? NET.peers.map(p => `${clean((p.presence || {}).n || 'HERO')} LV${(p.presence || {}).l || '?'} @${((ZONE_BY_ID[(p.presence || {}).z] || { name: '?' }).name).slice(0, 10)}`) : ['No other live players right now.']);
  }, `REALM STONE  [${NET.status || 'OFFLINE'}]`);
}
function arenaMenu() {
  choose(['RANKED 1V1', 'TEAM 3V3', 'LEAVE'], k => {
    if (k < 0 || k === 2) return;
    const n = k === 0 ? 1 : 3;
    const foes = Array.from({ length: n }, () => adventurerFoe(makeAdventurer(pick(CLASS_ORDER), Math.max(1, G.lvl + R() * 2 - 1 | 0), pick(SIM_NAMES))));
    startBattle(foes, { size: n, noFlee: true, kind: 'arena', music: 'boss', onEnd: r => {
      if (r === 'win') { const h = 20 + G.lvl; G.honor += h; G.rating += 18; G.stats.pvpWins++; say(`Victory! +${h} honor. Rating ${G.rating}.`); checkAchievements(); }
      else if (r === 'lose') { G.rating = Math.max(0, G.rating - 12); G.hp = 1; say(`Defeat. Rating ${G.rating}.`); }
    } });
  }, `ARENA  Rating ${G.rating}  Honor ${G.honor}`);
}
function lfgMenu() {
  const dgs = DUNGEONS.filter(d => d.lvl <= G.lvl + 6), rds = RAIDS.filter(r => r.lvl <= G.lvl + 6);
  const opts = dgs.map(d => ({ t: `DG ${d.name} ${d.lvl}`, k: 'dungeon', d })).concat(rds.map(r => ({ t: `RAID ${r.name} ${r.lvl}`, k: 'raid', d: r })));
  if (!opts.length) return say('Nothing available yet. Reach level 2.');
  choose(opts.map(o => o.t.slice(0, 22)), i => { if (i >= 0) instanceMenu(opts[i].k, opts[i].d); }, 'LOOKING FOR GROUP');
}

// ================================================================ instances: dungeons, raids, tower
function instanceMenu(kind, def) {
  const size = kind === 'raid' ? 12 : 4;
  choose([`ENTER (GROUP OF ${size})`, `ENTER SOLO`, `DIFFICULTY: ${diffOf().name}`, 'LEAVE'], k => {
    if (k === 2) return difficultyMenu();
    if (k !== 0 && k !== 1) return;
    if (kind === 'raid') { const wk = weekKey(); if (G.raidWeek[def.id] === wk) say('You are saved to this raid this week. No boss loot until reset.'); }
    enterInstance(kind, def, 0, k === 0 ? size : 1);
  }, `${def.name} - LV${def.lvl}`);
}
const weekKey = () => { const d = new Date(); return `${d.getFullYear()}-${Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 6048e5)}`; };
function enterInstance(kind, def, floor, size) {
  const map = buildInstance(kind, def, floor);
  SFX.door(); Music.stop();
  fadeTo(() => {
    const ret = G.inst ? G.inst.return : { map: G.map, x: G.x, y: G.y };
    G.inst = { kind, def, floor, map, cleared: [], chest: false, size, return: ret };
    G.x = map.entry.x; G.y = map.entry.y; G.mounted = false;
    if (FIELD) FIELD.reload();
    toast(map.name, kind === 'tower' ? `FLOOR ${floor} / 100` : `GROUP OF ${size}`, kind === 'tower' ? 'px_tower' : 'item_key', 'stairs');
  });
}
function fightPull(p) {
  const inst = G.inst;
  let foes;
  if (p.boss) { const B = BOSS_BY_ID[p.boss]; const f = makeMonster(B, p.lvl, G.difficulty, { bossId: B.id, cat: B.cat }); f.name = B.name.slice(0, 16); foes = [f]; }
  else foes = p.mobs.map(id => makeMonster(BEAST_BY_ID[id] || BESTIARY[0], p.lvl, G.difficulty));
  startBattle(foes, { size: inst.size, kind: inst.kind, music: p.boss ? (p.final ? 'arcboss' : 'boss') : 'battle', onEnd: r => {
    if (r === 'lose') return onPartyWipe();
    if (r !== 'win') return;
    inst.cleared.push(p.id); checkAchievements();
    if (p.final) {
      if (inst.kind === 'dungeon') { G.stats.dungeons++; questEvent('dungeon', inst.def.id); toast('DUNGEON CLEARED', inst.def.name, 'item_chest', 'quest_done'); }
      if (inst.kind === 'raid') { G.stats.raids++; G.raidWeek[inst.def.id] = weekKey(); toast('RAID CLEARED', inst.def.name, 'px_crown', 'act_complete'); }
      checkAchievements();
    }
    if (inst.kind === 'tower' && p.boss) { G.towerBest = Math.max(G.towerBest, inst.floor); NET.publishHero(); checkAchievements(); }
    if (p.boss && inst.size > 1 && R() < 0.6) push(new LootRoll(makeItem({ lvl: p.lvl, boss: true, mf: derive(G).mf, loot: diffOf().loot }), inst.size));
  } });
}
function openInstanceChest() {
  const inst = G.inst;
  if (!inst.cleared.some(id => inst.map.pulls.find(p => p.id === id && p.final)) && inst.kind !== 'tower' && inst.map.pulls.some(p => p.final)) return say('The chest is sealed by a powerful ward. Defeat the final boss.');
  inst.chest = true; SFX.chest();
  const it = makeItem({ lvl: inst.map.lvl + 2, mf: derive(G).mf, loot: diffOf().loot, rarity: Math.max(2, rollRarity(inst.map.lvl, derive(G).mf)) });
  addGear(it); const g = 20 + inst.map.lvl * 8; G.gold += g;
  say([`The chest holds ${g} G and:`, `[${RARITY[it.rarity].name}] ${it.name}`]);
}
function leaveInstance() {
  choose(['LEAVE', 'STAY'], k => { if (k !== 0) return; const r = G.inst.return; fadeTo(() => { G.inst = null; G.map = r.map; G.x = r.x; G.y = r.y + 1; FIELD.reload(); }); }, 'Leave the instance? Progress resets.');
}
function towerMenu() {
  const cps = [1]; for (let f = 10; f <= Math.min(100, G.towerBest + 1); f += 10) if (f <= G.towerBest + 1) cps.push(f);
  choose(cps.map(f => `START FLOOR ${f}`).concat([`BEST: ${G.towerBest}F`]), i => {
    if (i < 0 || i >= cps.length) return;
    enterInstance('tower', { id: 'tower', name: TOWER.name, lvl: TOWER.baseLvl, theme: ['void', 'crypt', 'lava', 'ice', 'temple'][Math.floor(cps[i] / 20) % 5] }, cps[i], Math.max(1, Math.min(4, fieldPartySize())));
  }, `${TOWER.name}: 100 floors. Boss every 5th.`);
}
function towerNext() {
  const inst = G.inst;
  const bossLeft = inst.map.pulls.some(p => p.boss && !inst.cleared.includes(p.id));
  if (bossLeft) return say('The stairs are sealed. Defeat this floor\'s guardian.');
  G.towerBest = Math.max(G.towerBest, inst.floor);
  if (inst.floor >= TOWER.floors) { checkAchievements(); return say(['You stand atop the SPIRE OF A HUNDRED.', 'The whole of AELMOOR glitters below. LEGEND.']); }
  const def = Object.assign({}, inst.def, { theme: ['void', 'crypt', 'lava', 'ice', 'temple'][Math.floor((inst.floor + 1) / 20) % 5] });
  enterInstance('tower', def, inst.floor + 1, inst.size);
}

// ================================================================ trials (boss rush etc)
function trialsMenu() {
  choose(TRIALS.map(t => `${t.name.slice(0, 18)} ${t.lvl}`), i => {
    if (i < 0) return; const t = TRIALS[i];
    choose(['BEGIN', 'BACK'], k => { if (k === 0) runTrial(t, 0); }, `${t.name}: ${t.desc}`);
  }, 'TRIALS MASTER: Prove yourself.');
}
function runTrial(t, stage) {
  const bosses = BOSSES.filter(b => b.where === t.id).sort((a, b) => a.order - b.order);
  const lvl = Math.max(t.lvl, G.lvl) + stage;
  let foes;
  if (t.rule === 'waves') foes = Array.from({ length: 3 }, () => makeMonster(pick(BESTIARY), lvl - 1, G.difficulty));
  else if (t.rule === 'mirror') foes = [adventurerFoe(makeAdventurer(G.cls, G.lvl, 'MIRROR ' + G.name.slice(0, 8)))];
  else { const B = bosses[stage % bosses.length]; const f = makeMonster(B, lvl, G.difficulty, { bossId: B.id, cat: 'trial' }); f.name = B.name.slice(0, 16); foes = [f]; }
  const stages = t.rule === 'waves' ? 10 : t.rule === 'mirror' ? 3 : 5;
  startBattle(foes, { size: t.rule === 'solo' || t.rule === 'mirror' ? 1 : Math.min(4, fieldPartySize()), kind: 'trial', rule: t.rule, noFlee: true, music: 'boss', onEnd: r => {
    if (r !== 'win') { G.hp = Math.max(1, G.hp); return say(`Trial failed at stage ${stage + 1}.`); }
    if (stage + 1 >= stages) { G.stats.trials++; const it = makeItem({ lvl: lvl + 2, rarity: 4 }); addGear(it); checkAchievements(); return say([`${t.name} COMPLETE!`, `Reward: ${it.name}`]); }
    if (t.rule !== 'rush') { const D = derive(G); G.hp = Math.min(D.hpMax, G.hp + Math.ceil(D.hpMax * 0.3)); }
    say(`Stage ${stage + 1}/${stages} cleared! Next...`, () => runTrial(t, stage + 1));
  } });
}

// ================================================================ need / greed loot roll
class LootRoll {
  constructor(item, size) { this.opaque = false; this.it = item; this.size = size; this.i = 0; this.res = null; }
  update() {
    if (this.res) { if (P('a') || P('b')) { removeScene(this); } return; }
    if (nav('left') || nav('up')) { this.i = (this.i + 2) % 3; SFX.cursor(); }
    if (nav('right') || nav('down')) { this.i = (this.i + 1) % 3; SFX.cursor(); }
    if (P('a')) {
      const mine = this.i === 2 ? 0 : (this.i === 0 ? 100 : 0) + roll('1d100').total;
      const others = Array.from({ length: Math.min(4, this.size - 1) }, () => ({ n: pick(SIM_NAMES), r: (R() < 0.3 ? 100 : 0) + roll('1d100').total }));
      const best = others.reduce((a, b) => (b.r > a.r ? b : a), { n: '-', r: -1 });
      this.res = { mine, best, won: mine > best.r };
      if (this.res.won) { addGear(this.it); SFX.chest(); } else SFX.back();
    }
  }
  draw() {
    frame(6, 30, 148, 76);
    text('LOOT ROLL', 12, 34, 2);
    blit(sprFit(itemIcon(this.it), 14), 12, 46); text(this.it.name.slice(0, 18), 30, 48, rarityCol(this.it.rarity)); text(RARITY[this.it.rarity].name, 30, 58, 2);
    if (!this.res) ['NEED', 'GREED', 'PASS'].forEach((s, i) => { const x = 16 + i * 46; if (i === this.i) fill(x - 4, 80, 42, 12, 3); text(s, x, 82, i === this.i ? 0 : 3); });
    else { text(`You: ${this.res.mine || 'PASS'}  ${this.res.best.n}: ${this.res.best.r}`, 12, 74); text(this.res.won ? 'YOU WIN THE ITEM!' : `${this.res.best.n} wins.`, 12, 88, this.res.won ? 'green' : 2); }
  }
}

// ================================================================ fishing
class Fishing {
  constructor() { this.opaque = false; this.t = 0; this.state = 'cast'; this.wait = 60 + Math.floor(R() * 180); }
  update() {
    this.t++;
    if (this.state === 'cast') { if (this.t === 1) SFX.cast_line(); if (this.t > 20) this.state = 'wait'; return; }
    if (this.state === 'wait') { if (P('b')) { removeScene(this); return; } if (P('a')) return this.fail('Too early! The fish swims off.'); if (this.t > this.wait) { this.state = 'bite'; this.bt = this.t; SFX.bite(); FX.splash(80, 70); } return; }
    if (this.state === 'bite') { if (P('a')) return this.catch_(); if (this.t - this.bt > 28 + Math.floor(G.prof.fish / 10)) return this.fail('It got away...'); return; }
  }
  fail(msg) { removeScene(this); SFX.splash(); say(msg); }
  catch_() {
    removeScene(this);
    const z = ZONE_BY_ID[G.map], r = R() * 100 + G.prof.fish / 4;
    const k = r < 8 ? 'old_boot' : r > 90 ? 'eel' : r > 70 ? 'big_fish' : 'small_fish';
    addItem(k); G.stats.fish++; SFX.reel();
    const up = gainProf('fish', G.prof.fish);
    questEvent('fish', k); checkAchievements();
    toast(`CAUGHT ${ITEMS[k].name}`, up ? `FISHING ${G.prof.fish}` : (z ? z.sub : ''), ITEMS[k].icon, 'pickup');
  }
  draw() {
    frame(30, 50, 100, 44);
    text(this.state === 'bite' ? '!!! PRESS A !!!' : this.state === 'wait' ? 'Waiting...' : 'Casting...', 40, 56, this.state === 'bite' ? 'red' : 3);
    const bob = this.state === 'bite' ? ((frameN >> 2) % 2) * 2 : Math.round(Math.sin(this.t / 10));
    fill(78, 74 + bob, 4, 4, 'red'); fill(40, 80, 80, 1, 'blue');
    text(`FISHING ${G.prof.fish}`, 40, 84, 2);
  }
}

// ================================================================ world map (parchment, all regions & sub-zones)
class WorldMap {
  constructor() { this.opaque = true; const z = ZONE_BY_ID[G.map] || ZONE_BY_ID[(G.inst && G.inst.return.map) || 'elderwood']; this.cx = z.fx; this.cy = z.fy; }
  update() {
    const move = (dx, dy) => { const t = ZONES.find(z => z.fx === this.cx + dx && z.fy === this.cy + dy); if (t) { this.cx += dx; this.cy += dy; SFX.cursor(); } else { for (let s = 2; s < 26; s++) { const t2 = ZONES.find(z => z.fx === this.cx + dx * s && z.fy === this.cy + dy * s); if (t2) { this.cx = t2.fx; this.cy = t2.fy; SFX.cursor(); break; } } } };
    if (nav('left')) move(-1, 0); if (nav('right')) move(1, 0); if (nav('up')) move(0, -1); if (nav('down')) move(0, 1);
    if (P('b') || P('select') || P('start')) { removeScene(this); SFX.close(); return; }
    if (P('a')) { const z = ZONES.find(zz => zz.fx === this.cx && zz.fy === this.cy); if (z && G.waypoints[z.id] && !G.inst && !G.ghost) { removeScene(this); const wp = buildZoneCached(z.id).poi.waypoint; travelTo(z.id, wp ? wp.x : null, wp ? wp.y + 1 : null); } else SFX.error(); }
  }
  draw() {
    fill(0, 0, W, H, 0);
    const cell = 12, ox = Math.round(80 - this.cx * cell - cell / 2), oy = 16;
    const BCOL = { meadow: [120, 170, 70], coast: [200, 190, 130], marsh: [90, 110, 70], jungle: [40, 130, 60], snow: [220, 230, 240], badlands: [190, 110, 70], volcanic: [120, 50, 40], dusk: [90, 60, 120], crystal: [120, 200, 210] };
    // ocean
    for (let y = 0; y < 9; y++) for (let x = -2; x < 30; x++) if ((x + y + (frameN >> 5)) % 4 === 0) fill(ox + x * cell + 4, oy + y * cell + 6, 3, 1, 1);
    for (const z of ZONES) {
      const x = ox + z.fx * cell, y = oy + z.fy * cell; if (x < -cell || x > W) continue;
      const c = BCOL[z.biome] || [150, 150, 150];
      ctx.fillStyle = (S.palette === 'dmg' || S.palette === 'pocket') ? col(z.town ? 3 : 1 + (z.fx + z.fy) % 2) : `rgb(${c})`; ctx.fillRect(x, y, cell, cell);
      // glyphs: mountains, trees, waves
      const glyph = { snow: '^', volcanic: '^', jungle: 'T', marsh: '~', crystal: '*', dusk: '+', badlands: '.', coast: '~', meadow: '"' }[z.biome];
      text(glyph, x + 3, y + 2, 3);
      if (z.town) { fill(x + 3, y + 3, 6, 6, 3); fill(x + 4, y + 4, 4, 4, 0); }
      if (G.waypoints[z.id]) fill(x + cell - 3, y + 1, 2, 2, 'blue');
      // region borders
      const nb = ZONES.find(o => o.fx === z.fx + 1 && o.fy === z.fy); if (!nb || nb.region !== z.region) fill(x + cell - 1, y, 1, cell, 3);
      const nd = ZONES.find(o => o.fx === z.fx && o.fy === z.fy + 1); if (!nd || nd.region !== z.region) fill(x, y + cell - 1, cell, 1, 3);
    }
    const here = ZONE_BY_ID[G.inst ? G.inst.return.map : G.map];
    if (here && (frameN >> 3) % 2) fill(ox + here.fx * cell + 4, oy + here.fy * cell + 4, 4, 4, 'red');
    const sel = ZONES.find(z => z.fx === this.cx && z.fy === this.cy);
    ctx.strokeStyle = col(3); ctx.lineWidth = 1; ctx.strokeRect(ox + this.cx * cell - 0.5, oy + this.cy * cell - 0.5, cell + 1, cell + 1);
    fill(0, 0, W, 12, 3); textC('MAP OF AELMOOR', 80, 2, 0);
    frame(2, 112, 156, 30);
    if (sel) {
      text(sel.name.slice(0, 22), 6, 115, 3); textR(sel.town ? 'SAFE' : `LV${sel.lvl[0]}-${sel.lvl[1]}`, 154, 115, 2);
      const reg = REGIONS.find(r => r.id === sel.region);
      text(`${sel.sub}${reg.exp ? ' EXP' + reg.exp : reg.act ? ' ACT' + reg.act : ''}`.slice(0, 24), 6, 124, 2);
      text(G.waypoints[sel.id] ? 'A: TRAVEL (WAYPOINT)' : 'Find its waypoint', 6, 133, G.waypoints[sel.id] ? 'blue' : 1);
    }
  }
}

// ================================================================ level up
class LevelUpScene {
  constructor(g, cb) { this.opaque = true; this.g = g; this.cb = cb; this.t = 0; }
  enter() { SFX.levelup(); }
  update() { this.t++; if (this.t > 30 && (P('a') || P('b') || P('start'))) { SFX.select(); removeScene(this); this.cb && this.cb(); } }
  draw() {
    fill(0, 0, W, H, 0); frame(3, 3, 154, 138);
    blit(sprH(`c_${G.cls}_0`, 44), 10, 40 + (this.t < 20 ? Math.round(Math.sin(this.t / 2) * 3) : 0));
    for (let i = 0; i < 9; i++) { const x = 50 + ((i * 37) % 100), y = 20 + ((i * 53) % 110); if (((this.t >> 3) + i) % 3 === 0) text('+', x, y, 'gold'); }
    textC('LEVEL UP!', 100, 10, 'gold', 2);
    textC(`LEVEL ${this.g.lvl}`, 100, 34, 3);
    if (this.g.hp) text(`MAX HP +${this.g.hp}`, 56, 48, 2);
    (this.g.notes || []).slice(0, 5).forEach((n, i) => text(n.slice(0, 16), 56, 62 + i * 12, 3));
    if (this.t > 30 && (this.t >> 4) % 2) text('v', 146, 128);
  }
}

// ================================================================ remote battle (joined a host's server)
class RemoteBattleView {
  constructor() { this.opaque = true; this.i = 0; }
  update() {
    const t = NET.myTurn;
    if (!NET.remoteView) { removeScene(this); return; }
    if (!t) return;
    const foes = t.foes || [];
    if (nav('up')) { this.i = (this.i + foes.length) % (foes.length + 1); SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % (foes.length + 1); SFX.cursor(); }
    if (P('a')) { SFX.select(); if (this.i < foes.length) NET.sendAct({ kind: 'attack', target: foes[this.i][0] }); else { const D = derive(G); const sp = D.spell && D.spell.known.filter(s => s.eff === 'dmg').pop(); NET.sendAct(sp ? { kind: 'spell', id: sp.id, target: foes[0] && foes[0][0] } : { kind: 'attack', target: foes[0] && foes[0][0] }); } }
  }
  draw() {
    const v = NET.remoteView || { party: [], foes: [], text: '' };
    fill(0, 0, W, H, 0);
    v.party.slice(0, 6).forEach(([n, hp, mx], i) => { text(n.slice(0, 6), 2, 1 + i * 9); bar(40, 2 + i * 9, 36, 4, hp, mx, 'hp'); });
    v.foes.slice(0, 4).forEach(([n, hp, mx, id, sp], i) => { textR(n.slice(0, 7), 120, 1 + i * 9); bar(122, 2 + i * 9, 36, 4, hp, mx, 'red'); const s = sprH(IMG[sp] ? sp : 'enemy_goblin', 26, { flip: true }); if (s && hp > 0) blit(s, 92 + (i % 2) * 32, 60 + Math.floor(i / 2) * 20 - s.height + 26); });
    blit(sprH(`c_${G.cls}_4`, 30), 14, 58);
    frame(2, 95, 156, 47);
    if (NET.myTurn) { text('YOUR TURN! Attack:', 7, 99, 'gold'); (NET.myTurn.foes || []).slice(0, 2).concat([['', 'BEST SPELL']]).forEach((f, i) => { if (i === this.i) text('>', 7, 110 + i * 10); text(f[1], 14, 110 + i * 10); }); }
    else text(wrap(v.text || 'Battle in progress...', 24).slice(0, 4).join('\n'), 7, 99);
    textR('SERVER', 156, 132, 'blue');
  }
}

// ================================================================ credits / ending
class Credits {
  constructor(ending) { this.opaque = true; this.t = 0; this.ending = ending; }
  enter() { Music.play('credits'); if (this.ending) saveGame(); }
  update() { this.t++; if (this.t > 60 && (P('a') || P('b') || P('start'))) { removeScene(this); if (this.ending) { const f = currentField(); if (f) f.resume(); } } }
  draw() {
    fill(0, 0, W, H, 3);
    const lines = [this.ending ? 'DAWN RETURNS TO AELMOOR' : '', '', BUILD.game, BUILD.subtitle, '', 'A GAME BY', BUILD.studio, '', 'DESIGN & CODE', BUILD.studio, '', 'ART', 'From the GB QUEST asset sheet', 'and its generated variants', '', 'RULES', 'A d20 system modelled on', 'the 5E SRD (CC-BY-4.0)', 'with original lore', '', 'MUSIC & SFX', 'Procedural 4-channel chip', '', `v${BUILD.version} ${BUILD.build}`, '', 'THANK YOU FOR PLAYING!'];
    lines.forEach((l, i) => { const y = 150 + i * 12 - this.t * 0.5 + (this.t > 520 ? this.t * 0.5 - 260 : 0); if (y > -10 && y < H) textC(l, 80, y, i === 2 || i === 6 ? 'gold' : 0); });
  }
}
