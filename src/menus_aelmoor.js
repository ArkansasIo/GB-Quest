'use strict';
// ================================================================ AELMOOR MENUS ("Lanterns of Aelmoor" menu suite)
// The start screens and every in-game menu in the style of the Aelmoor menu suite art:
//   * a moonlit backdrop from the title key art, navy panels with gold ornate borders, gold title plaques,
//     amber selection bars and button hints at the bottom (A CONFIRM, B BACK...)
//   * UI THEME "AELMOOR" (the default) restyles every existing menu, dialog, header and bar to match
//   * new front-end screens: OPTIONS (Gameplay / Graphics / Audio / Controls / Accessibility / Language tabs with
//     < value > rows and sliders), NEW GAME (Character / Appearance / Name / Confirm), SELECT CLASS (carousel with
//     ability bars and a class strip), CHARACTER SUMMARY (Begin Adventure), LOAD GAME (save cards with a scene
//     thumbnail, level, zone and date), CREDITS (scrolling roll) and a QUIT confirmation.
// Settings changes go through SettingsScene's own handler, so every option keeps its existing side effects.

const AEL = { navy: 'rgba(12,12,34,.94)', navy2: 'rgba(28,24,62,.92)', gold: '#e8b94c', goldDark: '#8a5a1c', cream: '#fff3d6', lav: '#cbb9ed', amber: 'rgba(170,104,34,.78)' };
const aelTheme = () => S.uiTheme === 'aelmoor' && !MONO(S.palette);
const AEL_SHADES = [[12, 12, 34], [52, 44, 96], [196, 184, 232], [255, 243, 214]];

// ---------------------------------------------------------------- shared drawing
function aelBackdrop(logo) {
  // the moonlit castle scene (tools/gen_aelmoor.py r9_title: no lettering), with the key-art logo on top
  const art = IMG.r9_title || IMG.title_aelmoor;
  if (art) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(art, 0, 0, W, H); ctx.imageSmoothingEnabled = sm; }
  else fill(0, 0, W, H, '#140f2e');
  fill(0, 0, W, H, logo ? 'rgba(10,8,30,.15)' : 'rgba(10,8,30,.35)');
  if (logo && IMG.title_aelmoor_hi) {
    // the logo block of the key art (logo, subtitle and tagline), small and centred at the top
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(IMG.title_aelmoor_hi, 44, 4, 266, 132, 40, 0, 80, 40);
    ctx.imageSmoothingEnabled = sm;
  }
}
function aelPanel(x, y, w, h) {
  ctx.save();
  fill(x, y, w, h, AEL.navy);
  ctx.strokeStyle = AEL.goldDark; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.strokeStyle = AEL.gold; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) fill(cx, cy, 3, 3, AEL.gold);
  ctx.restore();
}
function aelPlaque(label, cx, y, w = Math.max(60, String(label).length * 6 + 22)) {
  const x = Math.round(cx - w / 2);
  fill(x + 3, y, w - 6, 11, AEL.goldDark); fill(x, y + 3, w, 5, AEL.goldDark);
  fill(x + 4, y + 1, w - 8, 9, '#1a1640'); fill(x + 1, y + 4, w - 2, 3, '#1a1640');
  fill(x + 4, y + 1, w - 8, 1, AEL.gold); fill(x + 4, y + 9, w - 8, 1, AEL.gold);
  textC(label, cx, y + 1, AEL.cream);
}
// the title menu's selected-row bar: amber fill, bright gold edge; text drawn inside it turns cream
const AEL_SEL = { frame: -1, rects: [] };
function aelSelBar(x, y, w, h) {
  ctx.save(); ctx.fillStyle = AEL.amber; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); ctx.restore();
  if (AEL_SEL.frame !== frameN) { AEL_SEL.frame = frameN; AEL_SEL.rects = []; }
  AEL_SEL.rects.push([x, y, w, h]);
}
const aelInSel = (x, y) => AEL_SEL.frame === frameN && AEL_SEL.rects.some(r => x >= r[0] - 1 && x < r[0] + r[2] && y >= r[1] - 2 && y < r[1] + r[3]);
// an inner content panel: navy fill with a thin gold edge (lighter than the full ornate frame)
function aelInset(x, y, w, h) {
  ctx.save(); ctx.fillStyle = AEL.navy; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = AEL.goldDark; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); ctx.restore();
}
function aelButton(x, y, w, h, label, selected, center = false) {
  if (selected) {
    fill(x, y, w, h, AEL.amber);
    ctx.save(); ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); ctx.restore();
  }
  const ty = y + ((h - 9) >> 1);
  if (center) textC(label, x + (w >> 1), ty, selected ? AEL.cream : AEL.lav);
  else text(String(label).slice(0, Math.floor((w - 4) / 6)), x + 3, ty, selected ? AEL.cream : AEL.lav);
}
function aelHints(list) {
  fill(0, H - 10, W, 10, 'rgba(5,6,15,.8)');
  let x = 4;
  const total = list.reduce((s, [b, l]) => s + 10 + l.length * 6 + 8, 0); x = Math.max(2, (W - total) >> 1);
  for (const [b, l] of list) {
    ctx.save(); ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.arc(x + 4, H - 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    text(b, x + 2, H - 9, '#1a1640');
    text(l, x + 10, H - 9, AEL.cream);
    x += 10 + l.length * 6 + 8;
  }
}
function aelSlider(x, y, w, frac) {
  fill(x, y + 3, w, 4, '#2a2350'); fill(x, y + 3, Math.round(w * frac), 4, AEL.gold);
  const kx = x + Math.round(w * frac); fill(kx - 1, y + 1, 3, 8, AEL.cream);
}

// ---------------------------------------------------------------- UI THEME "AELMOOR": restyle every existing menu
{
  const col2 = col;
  col = function (c) { if (typeof c === 'number' && aelTheme()) { const k = AEL_SHADES[c] || AEL_SHADES[3]; return `rgb(${k[0]},${k[1]},${k[2]})`; } return col2(c); };
  const frame2 = frame;
  frame = function (x, y, w, h, bg = 0) { if (!aelTheme()) return frame2(x, y, w, h, bg); aelPanel(x, y, w, h); };
  const bar2 = bar;
  bar = function (x, y, w, h, v, max, c = 2) {
    if (!aelTheme()) return bar2(x, y, w, h, v, max, c);
    fill(x, y, w, h, AEL.goldDark); fill(x + 1, y + 1, w - 2, h - 2, '#141030');
    const f = Math.round((w - 2) * Math.max(0, Math.min(1, max ? v / max : 0)));
    if (f > 0) { fill(x + 1, y + 1, f, h - 2, col(c)); if (h > 3) fill(x + 1, y + 1, f, 1, 'rgba(255,255,255,.3)'); }
  };
  const hdr2 = hdr;
  hdr = function () {
    if (!aelTheme()) return hdr2();
    fill(0, 0, W, 11, 'rgba(14,12,40,.96)'); fill(0, 10, W, 1, AEL.gold); fill(0, 11, W, 1, AEL.goldDark);
    if (G) { text(`LV${G.lvl}`, 3, 1, AEL.gold); const g = fmt(G.gold); textR(g, W - 3, 1, AEL.cream); }
    // the suite's gold title plaque, naming the screen that is open
    const title = aelSceneTitle(scenes[scenes.length - 1]);
    if (title) aelPlaque(title, 80, 0, Math.min(88, title.length * 6 + 14));
  };
  // menus clear the screen with shade 0 first: give them the moonlit backdrop instead of a flat fill
  const fill2 = fill;
  fill = function (x, y, w, h, c) {
    if (c === 0 && x === 0 && y === 0 && w === W && h === H && aelTheme() && (IMG.r9_title || IMG.title_aelmoor) && !(scenes[scenes.length - 1] instanceof Field)) { aelBackdrop(false); return; }
    // a row or tab filled with the lightest shade is a selection: draw the suite's amber bar with a gold edge
    if (c === 3 && h >= 8 && h <= 14 && w >= 30 && aelTheme()) { aelSelBar(x, y, w, h); return; }
    // list rows draw their cursor with shade 1 (engine HILITE): give them the title menu's amber bar too
    if (c === 1 && h >= 8 && h <= 14 && w >= 60 && aelTheme()) { fill2(x, y, w, h, c); aelSelBar(x, y, w, h); return; }
    // large shade-1 boxes are content panels: navy with a gold edge, like the title menu's panel
    if (c === 1 && w >= 24 && h >= 24 && aelTheme()) { aelInset(x, y, w, h); return; }
    return fill2(x, y, w, h, c);
  };
  // text on a selected row reads cream, like the title menu (warning colours keep their meaning)
  const text2 = text;
  text = function (str, x, y, c = 3, sc = 1, right) {
    if (aelTheme() && aelInSel(x, y) && c !== 'red' && c !== 'green') c = AEL.cream;
    return text2(str, x, y, c, sc, right);
  };
  const ornate2 = drawOrnatePanel;
  drawOrnatePanel = function (x, y, w, h, title) {
    if (!aelTheme()) return ornate2(x, y, w, h, title);
    aelPanel(x, y, w, h); if (title) aelPlaque(title, x + (w >> 1), Math.max(0, y - 5));
  };
}

// screen names for the header plaque: explicit names first, else the class name split into words
const AEL_SCENE_TITLES = { MainMenu: 'GAME MENU', CharacterMenu: 'CHARACTER', CharSheet: 'CHARACTER', InventoryScene: 'INVENTORY', PaperDoll: 'EQUIPMENT', RelicCodexScene: 'RELICS & ARTIFACTS', StatBreakdownScene: 'STATS', GearOverviewScene: 'GEAR', ItemDetailScene: 'ITEM', ProgressSummaryScene: 'PROGRESS', DetailHubScene: 'DETAILS', GearAwakenScene: 'AWAKENING', RiftScene: 'RIFTS', RiftBoardScene: 'LEADERBOARD', SkillRuneScene: 'SKILL RUNES', GamblerScene: 'GAMBLER', LootFilterScene: 'LOOT FILTER', SeasonPassScene: 'SEASON PASS', PatchNotesScene: 'PATCH NOTES',
  StashScene: 'STASH', MarketScene: 'VENDOR', QuestLog: 'QUEST LOG', Spellbook: 'SPELLBOOK', GrowthScene: 'GROWTH', ArtsScene: 'COMBAT ARTS',
  ArmoryScene: 'ARMOURY', HeirloomScene: 'HEIRLOOMS', MountScene: 'MOUNTS', SocialScene: 'SOCIAL', GuildMenuScene: 'GUILD HALL', TitleScene: 'TITLES', AchievementScene: 'ACHIEVEMENTS',
  RepScene: 'REPUTATION', BestiaryScene: 'BESTIARY', BossJournalScene: 'BOSS JOURNAL', ActivityFinderScene: 'ACTIVITIES', SettingsScene: 'SETTINGS',
  TalentScene: 'TALENTS', PerkTreeScene: 'PERKS', CompanionScene: 'PARTY', GemSocketScene: 'GEMS', RuneForgeScene: 'RUNE FORGE', CraftScene: 'CRAFTING',
  ProfessionScene: 'PROFESSIONS', SideQuestBoard: 'QUEST BOARD', ExpansionMapsScene: 'EXPANSIONS', ArtGalleryScene: 'ART GALLERY', AbilitySkillsScene: 'SKILLS' };
function aelSceneTitle(sc) {
  if (!sc || !sc.constructor) return '';
  const n = sc.constructor.name;
  if (AEL_SCENE_TITLES[n]) return AEL_SCENE_TITLES[n];
  return n.replace(/Scene$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase().slice(0, 12);
}

// ---------------------------------------------------------------- GAME MENU (the in-game START menu)
const AEL_MENU_ICON = { CHARACTER: 'ka_chars_00', SPELLBOOK: 'ka_items_17', GROWTH: 'ka_status_13', 'COMBAT ARTS': 'ka_weapons_03', ARMOURY: 'ka_weapons_17',
  HEIRLOOMS: 'ka_weapons_44', WARDROBE: 'ka_weapons_13', LOADOUTS: 'ka_weapons_42', JOBS: 'ka_weapons_11', CHALLENGES: 'ka_icons_01', MOUNTS: 'ka_mounts_01',
  'QUEST LOG': 'ka_items_11', CRAFTING: 'ka_weapons_00', REST: 'ka_items_01', 'ACTIVITY FINDER': 'ka_icons_07', BESTIARY: 'ka_status_01',
  'BOSS JOURNAL': 'ka_status_07', ACHIEVEMENTS: 'ka_icons_00', REPUTATION: 'ka_status_11', SOCIAL: 'ka_status_03', GUILD: 'ka_status_03', TITLES: 'ka_icons_03',
  'WORLD MAP': 'ka_items_45', 'ART GALLERY': 'ka_items_13', 'EXPANSION MAPS': 'ka_items_45', HEARTHSTONE: 'ka_items_07', SETTINGS: 'ka_status_17',
  SAVE: 'ka_items_46', 'SAVE & QUIT': 'ka_items_42' };
const AEL_MENU_DESC = { CHARACTER: 'STATS, GEAR AND BAG', SPELLBOOK: 'SPELLS AND SLOTS', GROWTH: 'LEVEL-UP CHOICES', 'COMBAT ARTS': 'YOUR BATTLE ARTS',
  ARMOURY: 'ARMOUR SETS', HEIRLOOMS: 'FAMILY RELICS', WARDROBE: 'CHANGE YOUR LOOK', LOADOUTS: 'SAVED GEAR SETS', JOBS: 'JOBS AND WORK', CHALLENGES: 'TRIALS AND GOALS',
  MOUNTS: 'RIDE A MOUNT', 'QUEST LOG': 'ACTIVE QUESTS', CRAFTING: 'MAKE ITEMS', REST: 'REST AND HEAL', 'ACTIVITY FINDER': 'DUNGEONS, RAIDS', BESTIARY: 'MONSTERS SEEN',
  'BOSS JOURNAL': 'BOSSES MET', ACHIEVEMENTS: 'YOUR FEATS', REPUTATION: 'FACTION STANDING', SOCIAL: 'FRIENDS, GUILD', GUILD: 'GUILD ROSTER AND MANAGEMENT', TITLES: 'EARNED TITLES',
  'WORLD MAP': 'MAP OF AELMOOR', 'ART GALLERY': 'ART YOU FOUND', 'EXPANSION MAPS': 'NEW LANDS', HEARTHSTONE: 'RETURN HOME', SETTINGS: 'GAME OPTIONS',
  SAVE: 'SAVE YOUR GAME', 'SAVE & QUIT': 'SAVE, TO TITLE' };
function aelGameMenuDraw(menu) {
  fill(0, 0, W, H, 0); hdr();
  const D = derive(G), items = menu.items();
  aelPanel(2, 13, 92, 121);
  menu.rows = 9;
  if (menu.i < menu.top) menu.top = menu.i; if (menu.i >= menu.top + menu.rows) menu.top = menu.i - menu.rows + 1;
  items.slice(menu.top, menu.top + menu.rows).forEach((s, j) => {
    const i = menu.top + j, y = 16 + j * 13, sel = i === menu.i, base = s.replace(' (!)', '');
    if (sel) { fill(5, y, 86, 12, AEL.amber); ctx.save(); ctx.strokeStyle = '#ffd875'; ctx.strokeRect(5.5, y + .5, 85, 11); ctx.restore(); }
    const ic = AEL_MENU_ICON[base];
    if (ic && IMG[ic]) blit(sprFit(ic, 9), 7, y + 1); else fill(9, y + 4, 4, 4, AEL.gold);
    text(base.slice(0, 11), 19, y + 2, sel ? AEL.cream : AEL.lav);
    if (s.endsWith('(!)')) text('!', 86, y + 2, '#ff8a50');
  });
  if (items.length > menu.rows) { const h = 115, bh = Math.max(8, h * menu.rows / items.length); fill(91, 16, 1, h, AEL.goldDark); fill(90, 16 + (h - bh) * menu.top / Math.max(1, items.length - menu.rows), 3, bh, AEL.gold); }
  aelPanel(96, 13, 62, 121);
  const portrait = heroPortrait(G);
  blit(portrait ? sprFit(portrait, 34) : sprH(`c_${G.cls}_0`, 30), 110, 17);
  textC(G.name.slice(0, 9), 127, 53, AEL.cream); textC(CLASSES[G.cls].name.slice(0, 9), 127, 62, AEL.lav);
  text('HP', 99, 73, '#ff8a80'); bar(113, 74, 42, 4, G.hp, D.hpMax, 'hp');
  text('MP', 99, 82, '#80b4ff'); bar(113, 83, 42, 4, typeof resourceFrac === 'function' ? Math.round(resourceFrac(G) * 100) : 0, 100, 'mp');
  text('XP', 99, 91, '#ffd875'); bar(113, 92, 42, 4, G.xp - xpForLevel(G.lvl), xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)) - xpForLevel(G.lvl), 'xp');
  const zone = (typeof ZONE_BY_ID !== 'undefined' && ZONE_BY_ID[G.map]) ? ZONE_BY_ID[G.map].name : '';
  textC(String(zone).slice(0, 10), 127, 101, 2);
  const desc = (AEL_MENU_DESC[(items[menu.i] || '').replace(' (!)', '')] || '').split(' ');
  const lines = ['']; for (const w of desc) { if ((lines[lines.length - 1] + ' ' + w).trim().length > 9 && lines.length < 2) lines.push(''); lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); }
  fill(99, 111, 56, 20, 'rgba(26,22,58,.9)'); lines.forEach((l, k) => textC(l.slice(0, 9), 127, 112 + k * 9, AEL.cream));
  aelHints([['A', 'OPEN'], ['B', 'CLOSE']]);
}
if (typeof MainMenu === 'function') {
  const mmDraw = MainMenu.prototype.draw;
  MainMenu.prototype.draw = function () { if (aelTheme()) return aelGameMenuDraw(this); this.rows = 11; return mmDraw.apply(this, arguments); };
}

// ---------------------------------------------------------------- QUIT
class AelQuit {
  constructor() { this.opaque = true; this.i = 1; }
  update() {
    if (nav('left') || nav('right')) { this.i ^= 1; SFX.cursor(); }
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    SFX.select(); removeScene(this);
    if (this.i === 0) { try { window.close(); } catch (e) { /* tabs opened by the user cannot be closed by script */ } say(['Thanks for exploring Aelmoor.', 'You may close this browser tab.']); }
  }
  draw() {
    aelBackdrop(true);
    aelPanel(18, 50, 124, 70);
    textC('QUIT GAME?', 80, 57, AEL.cream, 1);
    textC('ARE YOU SURE YOU', 80, 72, AEL.lav); textC('WANT TO EXIT?', 80, 82, AEL.lav);
    aelButton(28, 100, 46, 12, 'YES', this.i === 0, true); aelButton(86, 100, 46, 12, 'NO', this.i === 1, true);
    aelHints([['A', 'CONFIRM'], ['B', 'BACK']]);
  }
}

// ---------------------------------------------------------------- OPTIONS
const AEL_TABS = [
  ['GAMEPLAY', [['HARDNESS', 'DIFFICULTY'], ['AUTOPLAY', 'AUTO BATTLE'], ['COMBAT', 'COMBAT MODE'], ['TEXT SPD', 'TEXT SPEED'], ['WEATHER', 'WEATHER']]],
  ['GRAPHICS', [['VIDEO', 'VIDEO'], ['RES', 'HD RESOLUTION'], ['DISPLAY', 'DISPLAY MODE'], ['FPS', 'FRAME RATE'], ['ART', 'ART'], ['UI THEME', 'UI THEME'], ['PALETTE', 'PALETTE'], ['BRIGHT', 'BRIGHTNESS', 'slider']]],
  ['AUDIO', [['ENGINE', 'AUDIO'], ['SOUND', 'SFX VOLUME', 'slider'], ['MUSIC', 'MUSIC VOLUME', 'slider'], ['SND TEST', 'SOUND TEST']]],
  ['CONTROLS', [['SWAP A/B', 'SWAP A/B'], ['KEYS', 'KEY BINDINGS', 'open']]],
  ['ACCESS', [['CONTRAST', 'CONTRAST', 'slider'], ['HOVER', 'HOVER TOOLTIPS'], ['R-CLICK', 'RIGHT-CLICK TOOLTIPS'], ['CHAT', 'CHAT SETTINGS', 'open']]],
  ['LANGUAGE', [['LANGUAGE', null]]],
];
const AEL_TAB_NOTE = ['CORE GAMEPLAY', 'VISUAL OPTIONS', 'SOUND OPTIONS', 'CONTROLS & KEYS', 'COMFORT', 'TEXT LANGUAGE'];
class AelOptions {
  constructor() { this.opaque = true; this.tab = 0; this.row = -1; this.core = new SettingsScene(); }
  rows() { return AEL_TABS[this.tab][1]; }
  value(key) {
    if (!key) return 'ENGLISH';
    const items = this.core.items(), k = items.indexOf(key);
    let v = k >= 0 ? this.core.values()[k] : '';
    if (key === 'DIFFICULTY' && !G) v = 'NORMAL';
    return String(v == null ? '' : v);
  }
  change(key, d) {
    if (!key) return;
    if (key === 'DIFFICULTY' && !G) { SFX.error(); return; }
    // let SettingsScene apply it with its own side effects: aim its cursor at the row, then run its update this frame
    const items = this.core.items(); this.core.i = items.indexOf(key); if (this.core.i < 0) return;
    this.core.update();                       // reads this frame's left/right/A exactly like the old settings list
    if (typeof saveSettings === 'function') saveSettings();
  }
  update() {
    if (P('b')) { if (this.row >= 0) { this.row = -1; SFX.back(); return; } if (typeof saveSettings === 'function') saveSettings(); SFX.back(); removeScene(this); return; }
    if (this.row < 0) {
      if (nav('up')) { this.tab = (this.tab + AEL_TABS.length - 1) % AEL_TABS.length; SFX.cursor(); }
      if (nav('down')) { this.tab = (this.tab + 1) % AEL_TABS.length; SFX.cursor(); }
      if (P('a') || nav('right')) { this.row = 0; SFX.select(); }
      return;
    }
    const R = this.rows();
    if (nav('up')) { this.row = (this.row + R.length - 1) % R.length; SFX.cursor(); return; }
    if (nav('down')) { this.row = (this.row + 1) % R.length; SFX.cursor(); return; }
    const [, key, kind] = R[this.row];
    if (kind === 'open') { if (P('a')) this.change(key, 1); return; }
    if (nav('right') || P('a')) this.change(key, 1);
    else if (nav('left')) this.change(key, -1);
  }
  draw() {
    aelBackdrop(true);
    aelPanel(3, 46, 154, 86); aelPlaque('OPTIONS', 80, 41);
    AEL_TABS.forEach(([name], k) => aelButton(5, 51 + k * 12, 52, 11, name, k === this.tab));
    fill(58, 50, 1, 78, AEL.goldDark);
    this.rows().forEach(([label, key, kind], j) => {
      const y = 51 + j * 10, sel = j === this.row;
      if (sel) fill(60, y - 1, 95, 10, 'rgba(170,104,34,.45)');
      text(label.slice(0, 8), 61, y, sel ? AEL.cream : AEL.lav);
      if (kind === 'slider') { const v = Number(this.value(key)) || 0; aelSlider(116, y, 36, Math.max(0, Math.min(1, v / 6))); }
      else if (kind === 'open') textR('>', 153, y, AEL.gold);
      else { const v = this.value(key).slice(0, 5); textR(v, 149, y, AEL.cream); if (sel) { fill(110, y, 4, 8, 'rgba(0,0,0,0)'); text('<', 109, y, AEL.gold); textR('>', 155, y, AEL.gold); } }
    });
    if (this.rows().length <= 6) textC(AEL_TAB_NOTE[this.tab], 107, 121, 2);
    aelHints([['A', 'CONFIRM'], ['B', 'BACK']]);
  }
}

// ---------------------------------------------------------------- LOAD GAME
const AEL_THUMBS = ['ap_scene_wilderness', 'ap_scene_city', 'ap_scene_dungeon', 'ap_scene_boss_fight'];
class AelLoad {
  constructor() { this.opaque = true; this.i = Math.max(0, lastSlot()); this.top = 0; }
  update() {
    const n = SLOT_KEYS.length;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); }
    if (P('b')) { SFX.back(); removeScene(this); return; }
    const info = slotInfo(this.i);
    if (P('select') && info) { choose(['NO', 'YES, DELETE'], y => { if (y === 1) { store.del(SLOT_KEYS[this.i]); SFX.error(); } }, `Delete ${info.name}? This cannot be undone.`); return; }
    if (!P('a')) return;
    if (!info) { SFX.select(); push(new AelNewGame(this.i)); return; }
    SFX.confirm(); loadSlot(this.i); fadeTo(() => { scenes.length = 0; enterWorld(); });
  }
  draw() {
    aelBackdrop(true);
    aelPanel(3, 46, 154, 86); aelPlaque('LOAD GAME', 80, 41);
    const n = SLOT_KEYS.length; this.top = Math.max(0, Math.min(this.i - 3, n - 4));
    for (let k = 0; k < Math.min(4, n); k++) {
      const s = this.top + k, y = 51 + k * 20, info = slotInfo(s), sel = s === this.i;
      fill(6, y, 148, 18, sel ? 'rgba(170,104,34,.55)' : 'rgba(26,22,58,.85)');
      ctx.save(); ctx.strokeStyle = sel ? '#ffd875' : '#5b4a7a'; ctx.lineWidth = 1; ctx.strokeRect(6.5, y + .5, 147, 17); ctx.restore();
      if (info) {
        const th = AEL_THUMBS[hashStr(String(info.zone)) % AEL_THUMBS.length];
        if (IMG[th]) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(IMG[th], 8, y + 2, 24, 14); ctx.imageSmoothingEnabled = sm; }
        text(`SAVE 0${s + 1}`, 35, y + 1, sel ? AEL.cream : AEL.lav);
        text(`LV${info.lvl} ${String(info.zone || '').slice(0, 11)}`, 35, y + 9, 2);
        if (info.saved) { const d = new Date(info.saved); textR(`${d.getMonth() + 1}/${d.getDate()}`, 151, y + 1, 2); textR(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 151, y + 9, 2); }
      } else { text('+', 16, y + 5, AEL.gold); text('EMPTY SLOT', 35, y + 5, sel ? AEL.cream : 2); }
    }
    aelHints([['A', 'LOAD'], ['B', 'BACK'], ['S', 'DELETE']]);
  }
}

// ---------------------------------------------------------------- CREDITS
class AelCredits {
  constructor() { this.opaque = true; this.t = 0; }
  enter() { try { Music.play('credits'); } catch (e) { /* audio optional */ } }
  update() { this.t++; if (this.t > 20 && (P('a') || P('b') || P('start'))) { SFX.back(); removeScene(this); } }
  lines() {
    return [['GB QUEST STUDIO', 'h'], ['', ''], ['GAME DESIGN & DIRECTION', 'g'], ['ARKANSASIO', ''], ['', ''], ['PROGRAMMING', 'g'], ['GB QUEST CORE TEAM', ''], ['', ''],
      ['ART & PIXEL DESIGN', 'g'], ['GB QUEST ART TEAM', ''], ['', ''], ['MUSIC & SOUND', 'g'], ['AELMOOR AUDIO WORKS', ''], ['', ''],
      ['SPECIAL THANKS', 'g'], ['THE GB QUEST COMMUNITY', ''], ['', ''], [String(BUILD.studio || '').toUpperCase(), ''], [`VERSION ${BUILD.version}`, '']];
  }
  draw() {
    aelBackdrop(true);
    aelPanel(3, 46, 154, 86); aelPlaque('CREDITS', 80, 41);
    ctx.save(); ctx.beginPath(); ctx.rect(5, 49, 150, 80); ctx.clip();
    const L = this.lines(), span = L.length * 10 + 80, off = (this.t * 0.35) % span;
    L.forEach(([s, kind], k) => { const y = 128 - off + k * 10; if (y > 40 && y < 132) textC(s.slice(0, 24), 80, y, kind === 'h' ? AEL.gold : kind === 'g' ? '#ffd875' : AEL.cream); });
    ctx.restore();
    aelHints([['B', 'BACK']]);
  }
}

// ---------------------------------------------------------------- NEW GAME: hub, class select, summary
const AEL_ROLE_TEXT = { tank: 'STURDY DEFENDER WHO HOLDS LINE', healer: 'HEALER WHO KEEPS ALLIES UP', support: 'SUPPORT WHO EMPOWERS ALLIES',
  dps: 'FIGHTER WHO DEALS HEAVY DAMAGE', caster: 'CASTER OF ARCANE POWER', striker: 'SWIFT STRIKER WHO HITS HARD' };
function aelScores(cls) { const v = STANDARD_ARRAY.slice().sort((a, b) => b - a), out = {}; abilityPriority(cls).forEach((a, i) => { out[a] = v[i]; }); return out; }
function aelFreeSlot() { const k = SLOT_KEYS.findIndex((_, i) => !slotInfo(i)); return k >= 0 ? k : 0; }

class AelNewGame {
  constructor(slot, onlineSession = null) {
    this.opaque = true; this.i = 0; this.slot = slot == null ? aelFreeSlot() : slot;
    this.onlineSession = onlineSession;
    this.pick = { species: 'hearthkin', cls: 'warden', bg: 'soldier', name: '', mode: 'solo', diff: 2, look: null, portrait: null };
    this.naming = false;
  }
  items() { return ['CHARACTER', 'APPEARANCE', 'NAME', 'CONFIRM', 'ADVANCED']; }
  startNaming() {
    this.naming = true; SFX.select();
    keyCaptureHandler = code => {
      if (code === 'Enter' || code === 'Escape') { this.naming = false; keyCaptureHandler = null; SFX.select(); return; }
      if (code === 'Backspace') { this.pick.name = this.pick.name.slice(0, -1); SFX.back(); return; }
      const ch = /^Key([A-Z])$/.exec(code) ? code.slice(3) : code === 'Space' ? ' ' : /^Digit\d$/.test(code) ? code.slice(5) : '';
      if (ch && this.pick.name.length < 10) { this.pick.name += ch; SFX.cursor(); }
    };
  }
  update() {
    if (this.naming) { if (P('b')) { this.naming = false; keyCaptureHandler = null; } return; }
    const L = this.items();
    if (nav('up')) { this.i = (this.i + L.length - 1) % L.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % L.length; SFX.cursor(); }
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select') && L[this.i] === 'NAME') { const pool = NAME_POOLS[this.pick.species] || NAME_POOLS.hearthkin; this.pick.name = pool[Math.floor(Math.random() * pool.length)]; SFX.toggle(); return; }
    if (!P('a')) return;
    const c = L[this.i];
    if (c === 'CHARACTER') push(new AelClassSelect(this.pick));
    if (c === 'APPEARANCE') { const k = CC_LOOKS.indexOf(this.pick.look || this.pick.cls); this.pick.look = CC_LOOKS[(k + 1) % CC_LOOKS.length]; SFX.toggle(); }
    if (c === 'NAME') this.startNaming();
    if (c === 'CONFIRM') { if (!this.pick.name) { const pool = NAME_POOLS[this.pick.species] || NAME_POOLS.hearthkin; this.pick.name = pool[Math.floor(Math.random() * pool.length)]; } push(new AelSummary(this.pick, this.slot, this.onlineSession)); }
    if (c === 'ADVANCED') { SFX.select(); fadeTo(() => { scenes.length = 0; push(new CharCreate(this.slot)); }); }
  }
  draw() {
    aelBackdrop(true);
    aelPanel(3, 46, 154, 86); aelPlaque('NEW GAME', 80, 41);
    this.items().forEach((s, k) => aelButton(5, 51 + k * 13, 60, 12, s, k === this.i));
    const portrait = (this.pick.look && classPortrait(this.pick.look)) || classPortrait(this.pick.cls);
    if (portrait && IMG[portrait]) blit(sprFit(portrait, 46), 82, 50);
    textC(this.pick.name || '- NO NAME -', 110, 99, this.naming && (frameN >> 4) % 2 ? AEL.gold : AEL.cream);
    textC(CLASSES[this.pick.cls].name, 110, 108, 2);
    fill(68, 118, 86, 11, 'rgba(26,22,58,.9)');
    textC(this.naming ? 'TYPE, ENTER' : this.onlineSession ? this.onlineSession.realm.name.toUpperCase().slice(0, 16) : this.i === 4 ? 'FULL CREATION' : 'NEW HERO', 111, 119, AEL.lav);
    aelHints(this.items()[this.i] === 'NAME' ? [['A', 'TYPE'], ['S', 'RANDOM'], ['B', 'BACK']] : [['A', 'NEXT'], ['B', 'BACK']]);
  }
}

class AelClassSelect {
  constructor(pick) { this.opaque = true; this.pick = pick; this.k = Math.max(0, CLASS_ORDER.indexOf(pick.cls)); }
  update() {
    const n = CLASS_ORDER.length;
    if (nav('left')) { this.k = (this.k + n - 1) % n; SFX.cursor(); }
    if (nav('right')) { this.k = (this.k + 1) % n; SFX.cursor(); }
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a')) { this.pick.cls = CLASS_ORDER[this.k]; this.pick.look = null; this.pick.portrait = null; SFX.confirm(); removeScene(this); }
  }
  draw() {
    const cls = CLASS_ORDER[this.k], C = CLASSES[cls], sc = aelScores(cls);
    aelBackdrop(true);
    aelPanel(3, 46, 154, 86); aelPlaque('SELECT CLASS', 80, 41);
    const p = classPortrait(cls);
    if (p && IMG[p]) blit(sprFit(p, 40), 12, 51);
    if ((frameN >> 4) % 2) { text('<', 5, 66, AEL.gold); text('>', 54, 66, AEL.gold); }
    fill(8, 93, 50, 10, 'rgba(26,22,58,.9)'); textC(C.name.slice(0, 8), 33, 94, AEL.cream);
    const words = (AEL_ROLE_TEXT[C.role] || `A HERO OF ${C.primary}`).split(' '), lines = [''];
    for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).trim().length > 15 && lines.length < 2) lines.push(''); lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); }
    lines.forEach((l, j) => text(l.slice(0, 15), 62, 50 + j * 9, AEL.lav));
    ABIL6.forEach((a, j) => { const y = 69 + j * 7; text(a, 62, y, 2); fill(84, y + 2, 68, 4, '#2a2350'); fill(84, y + 2, Math.round(68 * Math.max(0, (sc[a] || 8) - 6) / 10), 4, AEL.gold); });
    for (let j = -2; j <= 2; j++) {
      const c2 = CLASS_ORDER[(this.k + j + CLASS_ORDER.length) % CLASS_ORDER.length], x = 80 + j * 30;
      if (j === 0) { fill(x - 14, 115, 28, 12, AEL.amber); ctx.save(); ctx.strokeStyle = '#ffd875'; ctx.strokeRect(x - 13.5, 115.5, 27, 11); ctx.restore(); }
      textC(CLASSES[c2].name.slice(0, 4), x, 117, j === 0 ? AEL.cream : 2);
    }
    aelHints([['A', 'CONFIRM'], ['B', 'BACK']]);
  }
}

class AelSummary {
  constructor(pick, slot, onlineSession = null) {
    this.opaque = true; this.pick = pick; this.slot = slot; this.onlineSession = onlineSession;
    this.pending = false; this.error = '';
  }
  beginAdventure(remoteCharacter = null) {
    const p = this.pick;
    G = newGameState(Object.assign({ slot: this.slot }, p, { scores: aelScores(p.cls), look: p.look || null, portrait: p.portrait || null }));
    G.difficulty = p.diff;
    if (remoteCharacter && this.onlineSession) {
      G.realm = remoteCharacter.realm_id || this.onlineSession.realm.id;
      G.accountId = this.onlineSession.account.id;
      G.mmoCharacterId = remoteCharacter.id;
      G.mmoCharacterClass = remoteCharacter.class;
      G.onlineAccountName = this.onlineSession.account.username;
    }
    const role = CLASSES[G.cls].role === 'tank' ? 'healer' : 'tank';
    G.companions.push(makeAdventurer(role === 'tank' ? 'warden' : 'chaplain', 1, role === 'tank' ? 'BRAM' : 'ESME'));
    saveGame();
    fadeTo(() => { scenes.length = 0; enterWorld(); const ch = chapterDef(); say([`Welcome to AELMOOR, ${G.name}.`, G.mmoCharacterId ? `Your hero is saved on ${G.realm.toUpperCase()}.` : `${G.companions[0].name} the ${CLASSES[G.companions[0].cls].name} will travel with you.`, `CHAPTER 1: ${ch.title}`]); });
  }
  async createOnlineHero() {
    this.pending = true; this.error = '';
    try {
      const remote = await window.GBQMMOAccount.createCharacter(this.onlineSession, this.pick.name, this.pick.cls);
      this.pending = false;
      this.beginAdventure(remote);
    } catch (error) {
      this.pending = false;
      this.error = error.message || 'Online character creation failed.';
    }
  }
  update() {
    if (P('b') && !this.pending) { SFX.back(); removeScene(this); return; }
    if (!P('a') || this.pending) return;
    SFX.confirm();
    if (this.onlineSession) { this.createOnlineHero(); return; }
    this.beginAdventure();
  }
  draw() {
    const p = this.pick, c = newCharacter(Object.assign({}, p, { name: p.name || 'HERO', scores: aelScores(p.cls) })), D = derive(c);
    aelBackdrop(true);
    aelPanel(3, 46, 154, 86); aelPlaque('SUMMARY', 80, 41);
    fill(7, 51, 38, 44, 'rgba(26,22,58,.9)'); ctx.save(); ctx.strokeStyle = AEL.gold; ctx.strokeRect(7.5, 51.5, 37, 43); ctx.restore();
    const portrait = (p.look && classPortrait(p.look)) || classPortrait(p.cls);
    if (portrait && IMG[portrait]) blit(sprFit(portrait, 34), 9, 55);
    text(String(p.name).slice(0, 9), 49, 52, AEL.cream); text(CLASSES[p.cls].name.slice(0, 9), 49, 61, AEL.lav);
    text('LEVEL 1', 49, 70, 2); text((SPECIES[p.species] || { name: '' }).name.slice(0, 9), 49, 79, 2);
    const st = [['HP', D.hpMax], ['AC', D.ac], ['INIT', D.init], ['STR', D.A.STR], ['DEX', D.A.DEX], ['WIS', D.A.WIS]];
    st.forEach(([k, v], j) => { const y = 52 + j * 8; text(k, 112, y, 2); textR(String(v), 152, y, AEL.cream); });
    aelButton(24, 104, 112, 13, 'BEGIN ADVENTURE', (frameN >> 4) % 4 !== 3, true);
    if (this.pending) textC('SAVING HERO TO REALM…', 80, 124, AEL.gold);
    else if (this.error) { fill(5, 121, 150, 11, 'rgba(80,12,12,.95)'); textC(this.error.slice(0, 25), 80, 123, '#ffb8a8'); }
    aelHints([['A', this.pending ? 'SAVING' : 'CREATE'], ['B', 'BACK']]);
  }
}

if (typeof window !== 'undefined') {
  // AELMOOR becomes the default interface once (players can switch in OPTIONS > GRAPHICS > UI THEME)
  if (!S.aelmoorUiDefaulted) { S.aelmoorUiDefaulted = true; S.uiTheme = 'aelmoor'; try { saveSettings(); } catch (e) { /* storage optional */ } }
  window.GBQAelmoorMenus = { AelOptions, AelLoad, AelCredits, AelQuit, AelNewGame, AelClassSelect, AelSummary };
}
if (typeof globalThis !== 'undefined') globalThis.GBQAelmoorMenuData = { AEL_TABS };
