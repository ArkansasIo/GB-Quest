'use strict';
// ================================================================ MMO UI THEMES
// SETTINGS > UI THEME: POKEMON CLASSIC / CRIMSON / CLASSIC / SANCTUM / DIABLO IV / BLACKBIRD.
// A Game Boy Color era layout that borrows the MMO screen plan:
//   * menus and dialogue: light panels with a rounded double border (handheld-RPG style), dark text
//   * top left  unit frame (WoW/FFXIV): portrait, level, HP and MP bars, XP strip; party frames below it
//   * top right square minimap with the zone's safety tag under it
//   * bottom    hotbar of the four combat arts and potions, between a red HP orb and a blue MP orb (MU/Diablo)
//   * banners and toasts sit in the middle band so nothing covers the frames
//   * START menu: a right-hand list over the map (15 px rows, triangle cursor), a small hero card and a help line;
//     every pop-up choice list uses the same roomy rows and cursor
//   * full-screen pages get a WoW-style window title bar: page name, gold and a close button (B)
// Text and bars follow the chosen palette; the frames use fixed handheld colours.

const MMO_THEMES = ['mmo', 'mu', 'classic', 'sanctum', 'diablo', 'blackbird'];
const MMO_THEME_NAME = { mmo: 'POKEMON CLASSIC', mu: 'CRIMSON', classic: 'CLASSIC', sanctum: 'SANCTUM', diablo: 'DIABLO IV', blackbird: 'BLACKBIRD' };
const nextUiTheme = (cur, d = 1) => { const k = Math.max(0, MMO_THEMES.indexOf(cur)); return MMO_THEMES[(k + (d > 0 ? 1 : MMO_THEMES.length - 1)) % MMO_THEMES.length]; };
// where things go on the 160x144 screen
const MMO_LAYOUT = { unit: { x: 1, y: 1, w: 66, h: 23 }, map: { x: 127, y: 1, s: 32 }, toastY: 48, bannerY: 78, hud: { y: 144 - 22, orbR: 9 }, hotbar: { x: 31, slots: 5, step: 20 } };

if (typeof globalThis !== 'undefined') globalThis.GBQUiMmo = { MMO_THEMES, MMO_THEME_NAME, nextUiTheme, MMO_LAYOUT };

if (typeof window !== 'undefined' && typeof Field !== 'undefined') {
  // no floating text over the game by default: on-screen chat lines and chat bubbles start off (CHAT SETTINGS turns them on)
  if (!S.floatTextOff) { S.floatTextOff = true; S.screenChat = false; S.bubbles = false; S.nameTags = false; try { saveSettings(); } catch (e) {} }
  if (!S.mmoUiDefaulted) { S.mmoUiDefaulted = true; if (!S.uiTheme || S.uiTheme === 'sanctum') S.uiTheme = 'mmo'; try { saveSettings(); } catch (e) {} }
  // One-time migration: use the classic blue-and-cream handheld interface as the default.
  // Preserve a deliberately selected non-default theme; replace only the prior automatic Blackbird default.
  if (!S.pokemonUiDefaulted) {
    if (!S.uiTheme || (S.uiTheme === 'blackbird' && S.blackbirdUiDefaulted)) S.uiTheme = 'mmo';
    S.pokemonUiDefaulted = true;
    try { saveSettings(); } catch (e) {}
  }
  window.hudMmo = () => S.uiTheme === 'mmo' || S.uiTheme === 'mu' || S.uiTheme === 'blackbird';
  const isPokemon = () => S.uiTheme === 'mmo';
  const isMu = () => S.uiTheme === 'mu';
  const isBlackbird = () => S.uiTheme === 'blackbird';
  let blackbirdPanelPattern = null;
  window.nextUiTheme = nextUiTheme; window.uiThemeName = t => MMO_THEME_NAME[t] || 'CLASSIC';
  // colours per theme: POKEMON CLASSIC (handheld blue on cream) and CRIMSON (MU-style: black stone, blood-red frames, gold trim)
  const PALETTE = {
    mmo: { ink: [24, 28, 48], edge: [64, 88, 160], panel: [248, 246, 232], panel2: [226, 232, 244], shade: [168, 184, 214], hp: [82, 170, 68], hpLow: [216, 72, 48], mp: [48, 104, 224], xp: [72, 142, 204], gold: [200, 150, 30], title: [24, 28, 48] },
    mu: { ink: [10, 6, 6], edge: [128, 22, 18], panel: [26, 20, 18], panel2: [70, 48, 26], shade: [90, 70, 50], hp: [210, 20, 16], hpLow: [255, 90, 30], mp: [36, 76, 230], xp: [236, 186, 60], gold: [222, 172, 64], title: [86, 14, 10] },
    blackbird: { ink: [5, 6, 9], edge: [92, 100, 111], panel: [16, 18, 22], panel2: [42, 46, 52], shade: [72, 78, 86], hp: [184, 44, 44], hpLow: [250, 94, 48], mp: [58, 110, 183], xp: [189, 147, 62], gold: [224, 188, 104], title: [12, 14, 17] },
  };
  const C = new Proxy({}, { get: (_, k) => (PALETTE[S.uiTheme] || PALETTE.mmo)[k] });
  const mono = () => typeof MONO === 'function' && MONO(S.palette);
  const rgb = (c, k) => mono() ? col(k) : css(c);

  // handheld panel: rounded double border
  function panel(x, y, w, h, bg) {
    const ink = rgb(C.ink, 3), edge = rgb(C.edge, 2), fillc = bg != null && bg !== 0 ? col(bg) : rgb(C.panel, 0);
    if (isBlackbird()) {
      fill(x, y, w, h, ink); fill(x + 1, y + 1, w - 2, h - 2, edge);
      fill(x + 2, y + 2, w - 4, h - 4, fillc);
      if (bg == null || bg === 0) {
        const texture = IMG.bb_panel;
        if (texture && w > 6 && h > 6) {
          ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, w - 4, h - 4); ctx.clip();
          if (!blackbirdPanelPattern) blackbirdPanelPattern = ctx.createPattern(texture, 'repeat');
          ctx.globalAlpha = 0.82; ctx.fillStyle = blackbirdPanelPattern; ctx.fillRect(x + 2, y + 2, w - 4, h - 4); ctx.restore();
        }
      }
      if (IMG.bb_border && w >= 10 && h >= 10) {
        ctx.save(); ctx.globalAlpha = 0.82;
        for (const [cx, cy] of [[x + 1, y + 1], [x + w - 5, y + 1], [x + 1, y + h - 5], [x + w - 5, y + h - 5]]) ctx.drawImage(IMG.bb_border, cx, cy, 4, 4);
        ctx.restore();
      }
      return;
    }
    fill(x + 2, y, w - 4, h, ink); fill(x, y + 2, w, h - 4, ink); fill(x + 1, y + 1, w - 2, h - 2, ink);
    fill(x + 2, y + 1, w - 4, h - 2, edge); fill(x + 1, y + 2, w - 2, h - 4, edge);
    fill(x + 2, y + 2, w - 4, h - 4, fillc);
    if (w > 8 && h > 8) { fill(x + 3, y + 3, w - 6, 1, rgb(C.panel2, 0)); }
    if (isMu() && w > 10 && h > 10) { // gold inner trim and corner studs
      const gd = rgb(C.gold, 2); fill(x + 2, y + 2, w - 4, 1, gd); fill(x + 2, y + h - 3, w - 4, 1, gd); fill(x + 2, y + 2, 1, h - 4, gd); fill(x + w - 3, y + 2, 1, h - 4, gd);
      fill(x + 3, y + 3, w - 6, 1, rgb([120, 90, 40], 1));
      for (const [sx, sy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) fill(sx, sy, 3, 3, gd);
    }
  }
  { const f0 = frame; frame = function (x, y, w, h, bg = 0) { if (!hudMmo() || w < 6 || h < 6) return f0(x, y, w, h, bg); panel(x, y, w, h, bg); }; }

  function hbar(x, y, w, h, frac, c, k) {
    fill(x, y, w, h, rgb(C.ink, 3)); fill(x + 1, y + 1, w - 2, h - 2, isPokemon() ? rgb([255, 255, 255], 0) : rgb([40, 44, 60], 0));
    const f = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
    if (f > 0) { fill(x + 1, y + 1, f, h - 2, rgb(c, k)); if (h > 3) fill(x + 1, y + 1, f, 1, 'rgba(255,255,255,0.35)'); }
  }
  function orb(cx, cy, r, frac, c) {
    if (typeof drawOrb === 'function' && !mono()) return drawOrb(cx, cy, r, frac, c);
    fill(cx - r, cy - r, r * 2, r * 2, col(3)); fill(cx - r + 1, cy + r - 1 - Math.round((2 * r - 2) * frac), r * 2 - 2, Math.round((2 * r - 2) * frac), col(1));
  }
  const pct = (a, b) => b > 0 ? a / b : 0;
  function unitFrame() {
    const U = MMO_LAYOUT.unit, D = derive(G), hpF = pct(G.hp, D.hpMax), mpF = typeof resourceFrac === 'function' ? resourceFrac(G) : 1;
    panel(U.x, U.y, U.w, U.h);
    if (isBlackbird() && IMG.bb_vitals_bg) ctx.drawImage(IMG.bb_vitals_bg, U.x + 21, U.y + 9, U.w - 23, 12);
    fill(U.x + 3, U.y + 3, 17, 17, rgb(C.ink, 3)); fill(U.x + 4, U.y + 4, 15, 15, rgb([196, 214, 236], 1));
    const por = heroPortrait(G); if (por) { const s = sprFit(por, 15); blit(s, U.x + 4 + ((15 - s.width) >> 1), U.y + 4 + ((15 - s.height) >> 1)); }
    else { const w = typeof walker === 'function' ? walker(heroLook(G), 'down', 0) : null; if (w) blit(w, U.x + 3, U.y + 4); }
    text(`L${G.lvl} ${G.name}`.slice(0, 7), U.x + 22, U.y + 3, 3);
    const barX = isBlackbird() ? U.x + 29 : U.x + 22, barW = U.x + U.w - 3 - barX;
    hbar(barX, U.y + 11, barW, 5, hpF, G.hp < D.hpMax * 0.3 && (frameN >> 3) % 2 ? C.hpLow : C.hp, 'red');
    hbar(barX, U.y + 16, barW, 4, mpF, C.mp, 'blue');
    if (isBlackbird() && IMG.bb_vitals_fg) ctx.drawImage(IMG.bb_vitals_fg, U.x + 21, U.y + 9, U.w - 23, 12);
    const x0 = xpForLevel(G.lvl), x1 = xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1));
    const xpFrac = pct(G.xp - x0, Math.max(1, x1 - x0));
    if (isBlackbird() && IMG.bb_xp) {
      ctx.drawImage(IMG.bb_xp, U.x + 1, U.y + U.h, U.w - 2, 3);
      fill(U.x + 2, U.y + U.h + 1, Math.round((U.w - 4) * xpFrac), 1, rgb(C.xp, 'gold'));
    } else hbar(U.x + 1, U.y + U.h, U.w - 2, 3, xpFrac, C.xp, 'gold');
    // party frames
    (G.companions || []).filter(c => c && !c.dead).slice(0, 3).forEach((c, i) => {
      const y = U.y + U.h + 4 + i * 10, Dc = derive(c);
      panel(U.x, y, 50, 9);
      text((c.name || '').slice(0, 3), U.x + 3, y + 1, 3);
      hbar(U.x + 23, y + 2, 25, 5, pct(c.hp, Dc.hpMax), C.hp, 'red');
    });
  }
  function minimap(field) {
    const M = MMO_LAYOUT.map, cx = M.x + (M.s >> 1), cy = M.y + (M.s >> 1);
    panel(M.x, M.y, M.s, M.s);
    const Z = S.mapZoom === 2 ? 2 : 3, RR = Z === 2 ? 7 : 4;
    for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
      const t = field.tileAt(G.x + dx, G.y + dy); if (!t) continue;
      fill(cx + dx * Z - 1, cy + dy * Z - 1, Z, Z, mono() ? col(t[1] ? 2 : 1) : css(t[1] ? [92, 112, 84] : [150, 196, 120]));
    }
    for (const e of field.entities()) {
      const dx = e.x - G.x, dy = e.y - G.y, Z = S.mapZoom === 2 ? 2 : 3, RR = Z === 2 ? 7 : 4; if (Math.abs(dx) > RR || Math.abs(dy) > RR) continue;
      fill(cx + dx * Z - 1, cy + dy * Z - 1, 2, 2, e.kind === 'boss' || e.kind === 'pull' ? 'red' : e.kind === 'npc' ? 'gold' : e.kind === 'waypoint' ? 'blue' : col(3));
    }
    fill(cx - 1, cy - 1, 3, 3, (frameN >> 4) % 2 ? 'white' : rgb(C.ink, 3));
    const z = field.zone, tag = G.inst ? 'INST' : !z ? '' : z.town ? 'SAFE' : G.pvpEnabled ? 'PVP' : 'PVE';
    if (tag) { const w = tag.length * 6 + 4; fill(cx - (w >> 1), M.y + M.s, w, 8, z && z.town ? rgb([40, 120, 70], 2) : G.pvpEnabled ? 'red' : rgb(C.edge, 2)); textC(tag, cx, M.y + M.s, 0); }
    if (isMu() && field.zone) { const lab = `(${G.x},${G.y})`; fill(M.x - 2, M.y + M.s + 9, M.s + 4, 8, rgb(C.ink, 3)); textC(lab.slice(0, 7), cx, M.y + M.s + 9, 'gold'); } // MU-style coordinates
  }
  function hotbar() {
    const Hd = MMO_LAYOUT.hud, Hb = MMO_LAYOUT.hotbar, D = derive(G);
    if (isPokemon()) {
      const y = Hd.y;
      panel(0, y, W, H - y, 0);
      fill(2, y + 2, W - 4, 1, rgb(C.edge, 2));
      panel(2, y + 4, 29, 14);
      text('HP', 4, y + 5, 3);
      hbar(4, y + 11, 25, 5, pct(G.hp, D.hpMax), G.hp < D.hpMax * 0.3 ? C.hpLow : C.hp, 'green');
      panel(W - 31, y + 4, 29, 14);
      text('MP', W - 29, y + 5, 3);
      hbar(W - 29, y + 11, 25, 5, typeof resourceFrac === 'function' ? resourceFrac(G) : 1, C.mp, 'blue');
      const arts = typeof artLoadout === 'function' ? artLoadout(G) : [];
      for (let i = 0; i < 5; i++) {
        const x = 33 + i * 19, sy = y + 5;
        panel(x, sy, 17, 13, 0);
        if (i < 4) { const a = arts[i]; if (a) { const ic = a.kind === 'physical' ? 'sk_power_strike' : 'sk_arcane_burst'; if (IMG[ic]) blit(sprFit(ic, 9), x + 4, sy + 1); } }
        else { const n = (G.inv && G.inv.potion) || 0, ic = ITEMS.potion && ITEMS.potion.icon; if (ic && IMG[ic]) blit(sprFit(ic, 9), x + 2, sy + 1); textR(String(Math.min(99, n)), x + 16, sy + 4, n ? 3 : 2); }
      }
      return;
    }
    if (isBlackbird()) panel(0, Hd.y + 2, W, H - Hd.y - 2);
    else { fill(0, Hd.y + 2, W, H - Hd.y - 2, rgb(C.ink, 3)); fill(0, Hd.y + 3, W, 1, rgb(C.edge, 2)); }
    if (isBlackbird() && IMG.bb_tab) ctx.drawImage(IMG.bb_tab, 0, Hd.y + 2, W, 2);
    const OR = isMu() ? 11 : Hd.orbR;
    if (isMu()) { fill(0, Hd.y - 1, 26, H - Hd.y + 1, rgb(C.ink, 3)); fill(W - 26, Hd.y - 1, 26, H - Hd.y + 1, rgb(C.ink, 3)); }
    orb(13, H - 11, OR, pct(G.hp, D.hpMax), G.hp < D.hpMax * 0.3 && (frameN >> 3) % 2 ? [255, 90, 50] : [200, 28, 24]);
    orb(W - 14, H - 11, OR, typeof resourceFrac === 'function' ? resourceFrac(G) : 1, [44, 92, 220]);
    const arts = typeof artLoadout === 'function' ? artLoadout(G) : [];
    for (let i = 0; i < Hb.slots; i++) {
      const x = Hb.x + i * Hb.step, y = Hd.y + 6;
      panel(x, y, 18, 14, 0);
      if (i < 4) { const a = arts[i]; if (a) { const ic = a.kind === 'physical' ? 'sk_power_strike' : 'sk_arcane_burst'; if (IMG[ic]) blit(sprFit(ic, 9), x + 5, y + 2); } }
      else { const n = (G.inv && G.inv.potion) || 0, ic = ITEMS.potion && ITEMS.potion.icon; if (ic && IMG[ic]) blit(sprFit(ic, 9), x + 3, y + 2); textR(String(Math.min(99, n)), x + 17, y + 6, n ? 3 : 2); }
    }
  }

  // ---------------------------------------------------------------- handheld-RPG menus
  // a solid right-pointing cursor triangle
  const tri = (x, y, c = 3) => { for (let i = 0; i < 4; i++) fill(x + i, y + i, 1, 7 - 2 * i, typeof c === 'number' ? col(c) : c); };
  window.mmoCursor = tri;
  // pop-up choice lists: roomier rows, triangle cursor, box hugs the right edge
  if (typeof Choice !== 'undefined') {
    const cd0 = Choice.prototype.draw;
    Choice.prototype.draw = function () {
      if (!hudMmo()) return cd0.apply(this, arguments);
      let bottom = H - 2;
      if (this.prompt) { frame(2, H - 46, W - 4, 44); text(wrap(this.prompt).slice(0, 3).join('\n'), 9, H - 39); bottom = H - 47; }
      const roomy = Math.min(this.o.length, this.rows) * 15 + 10 <= bottom - 2, rh = roomy ? 15 : 11;
      const vis = this.o.slice(this.top, this.top + this.rows);
      const w = Math.min(156, Math.max(...this.o.map(s => String(s).length)) * 6 + 22), h = vis.length * rh + 10;
      const x = this.x != null ? this.x : W - w - 2, y = Math.max(2, bottom - h);
      frame(x, y, w, h);
      vis.forEach((s, j) => { const i = this.top + j, ty = y + 6 + j * rh + (roomy ? 2 : 0); text(String(s).slice(0, 23), x + 14, ty); if (i === this.i) tri(x + 6, ty); });
      if (this.o.length > this.rows) { if (this.top > 0) text('^', x + w - 10, y + 2, 2); if (this.top + this.rows < this.o.length) text('v', x + w - 10, y + h - 10, 2); }
    };
  }
  // START menu: a narrow list on the right over the map, a trainer card on the left and a help line at the bottom
  const MENU_HELP = { CHARACTER: 'Stats, gear and skills.', SPELLBOOK: 'Spells and slots.', GROWTH: 'Spend level-up points.', 'COMBAT ARTS': 'Equip four arts.', ARMOURY: 'Armour sets.', HEIRLOOMS: 'Account-wide gear.',
    'BOOK OF DEAD': 'Shape your undead army.', WARDROBE: 'Change your look.', LOADOUTS: 'Specs and gear sets.', JOBS: 'Change job, support job.', CHALLENGES: 'Bounties, keys, quests.', MOUNTS: 'Ride a mount.', 'QUEST LOG': 'Your quests.',
    CRAFTING: 'Make gear and goods.', REST: 'Short or long rest.', 'ACTIVITY FINDER': 'Dungeons and raids.', BESTIARY: 'Foes you have met.', 'BOSS JOURNAL': 'Boss loot and kills.',
    ACHIEVEMENTS: 'Feats of the realm.', REPUTATION: 'Faction standing.', SOCIAL: 'Friends, guild, party.', TITLES: 'Wear a title.', 'WORLD MAP': 'Where you are.', 'EXPANSION MAPS': 'Other lands.',
    HEARTHSTONE: 'Return to your inn.', SETTINGS: 'Game options.', SAVE: 'Save your game.', 'SAVE & QUIT': 'Save, back to title.', 'SECRET ARCHIVE': 'Secrets found.', 'HIDDEN WORLD': 'The hidden realm.' };
  if (typeof MainMenu !== 'undefined') {
    const md0 = MainMenu.prototype.draw;
    MainMenu.prototype.draw = function () {
      const on = hudMmo(); this.opaque = !on;
      if (!on) { this.rows = 11; return md0.apply(this, arguments); }
      this.rows = 7;
      const items = this.items(), D = derive(G);
      // trainer card
      frame(2, 2, 50, 72);
      const por = heroPortrait(G); if (por) { const sp = sprFit(por, 24); blit(sp, 27 - (sp.width >> 1), 6); } else { const wk = typeof walker === 'function' ? walker(heroLook(G), 'down', (frameN >> 4) % 2) : null; if (wk) blit(wk, 19, 10); }
      textC(G.name.slice(0, 7), 27, 32, 3); textC(`LV${G.lvl}`, 27, 41, 2);
      text('HP', 6, 51, 2); bar(19, 52, 29, 4, G.hp, D.hpMax, G.hp < D.hpMax * 0.3 ? 'red' : 'hp');
      // menu list
      const w = 104, x = W - w - 2, rh = 15, h = this.rows * rh + 10;
      frame(x, 2, w, h);
      items.slice(this.top, this.top + this.rows).forEach((s, j) => { const i = this.top + j, ty = 9 + j * rh; text(s.slice(0, 15), x + 14, ty, s.includes('(!)') ? 'gold' : 3); if (i === this.i) tri(x + 6, ty); });
      if (this.top > 0) text('^', x + w - 10, 3, 2); if (this.top + this.rows < items.length) text('v', x + w - 10, h - 7, 2);
      // help line
      const sel = (items[this.i] || '').replace(' (!)', '');
      frame(2, H - 26, W - 4, 24); text((MENU_HELP[sel] || (window.MENU_HELP_EXTRA || {})[sel] || sel).slice(0, 24), 9, H - 18);
      textC(`${fmt(G.gold)}G`, 27, 60, 'gold');
    };
  }

  // ---------------------------------------------------------------- WoW-style window title bars on full-screen pages
  const WIN_TITLE = { CharacterMenu: 'CHARACTER', CharSheet: 'CHARACTER', PaperDoll: 'EQUIPMENT', EquipScene: 'EQUIPMENT', InventoryScene: 'BAGS', BagScene: 'BAGS', BankScene: 'BANK', StashScene: 'STASH',
    Spellbook: 'SPELLBOOK', TalentScene: 'TALENTS', GrowthScene: 'GROWTH', AbilitySkillsScene: 'SKILLS', QuestLog: 'QUEST LOG', SocialScene: 'SOCIAL', SettingsScene: 'GAME MENU', KeybindScene: 'KEY BINDINGS',
    RepScene: 'REPUTATION', AchievementScene: 'ACHIEVEMENTS', BestiaryScene: 'BESTIARY', BossJournalScene: 'ADVENTURE GUIDE', ActivityFinderScene: 'GROUP FINDER', CraftScene: 'PROFESSIONS',
    ProfessionTreeScene: 'PROFESSIONS', ProfessionQuestScene: 'PROFESSIONS', BlueprintScene: 'BLUEPRINTS', AuctionHouse: 'AUCTION HOUSE', RealmStoreScene: 'SHOP', HousingScene: 'HOUSING',
    HomeInteriorScene: 'HOUSING', GemSocketScene: 'GEM SOCKETS', RuneForgeScene: 'RUNEFORGE', CompareScene: 'COMPARE', StoryLibrary: 'LIBRARY', SecretWorldJournalScene: 'HIDDEN WORLD', EasterEggArchiveScene: 'SECRETS', SoundTest: 'SOUND TEST' };
  const pageTitle = () => { for (let i = scenes.length - 1; i >= 0; i--) { const n = scenes[i] && scenes[i].constructor && scenes[i].constructor.name; if (WIN_TITLE[n]) return WIN_TITLE[n]; } return null; };
  window.mmoPageTitle = pageTitle;
  if (typeof hdr === 'function') {
    const h0 = hdr;
    hdr = function () {
      const t = hudMmo() && G ? pageTitle() : null;
      if (!t && isBlackbird() && G && IMG.bb_title) {
        panel(1, 12, W - 2, H - 14);
        ctx.drawImage(IMG.bb_title, 0, 0, W, 12);
        const d = new Date(); text(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 3, 2, 2); text(`LV${G.lvl}`, 40, 2, 'gold');
        if (NET.room) text(NET.server ? 'HOST' : NET.hostOf ? 'JOIN' : 'LIVE', 72, 2, 'blue');
        const gold = fmt(G.gold); textR(gold, W - 3, 2, 'gold');
        return;
      }
      if (!t) return h0.apply(this, arguments);
      if (isBlackbird()) panel(1, 12, W - 2, H - 14);
      const ink = rgb(C.ink, 3), edge = rgb(C.edge, 2);
      if (isBlackbird() && IMG.bb_title) ctx.drawImage(IMG.bb_title, 0, 0, W, 12);
      else fill(0, 0, W, 12, rgb(C.title, 3));
      fill(0, 11, W, 1, isMu() ? rgb(C.gold, 2) : edge); fill(1, 1, W - 2, 1, isMu() ? rgb([150, 40, 30], 1) : rgb([60, 70, 110], 1));
      fill(2, 2, 7, 7, rgb(C.gold, 2)); fill(3, 3, 5, 5, rgb([255, 226, 120], 1));            // window icon
      text(t.slice(0, 15), 12, 2, 'gold');
      const g = fmt(G.gold); textR(g, W - 13, 2, 'white');
      fill(W - 11, 1, 10, 9, isBlackbird() ? rgb(C.edge, 2) : rgb([150, 30, 26], 2));
      fill(W - 10, 2, 8, 7, isBlackbird() ? rgb(C.ink, 3) : rgb([200, 50, 40], 2));  // B closes the window
      const closeInk = isBlackbird() ? rgb(C.gold, 2) : 'white';
      for (let k = 0; k < 5; k++) { fill(W - 9 + k, 3 + k, 1, 1, closeInk); fill(W - 5 - k, 3 + k, 1, 1, closeInk); }
    };
  }
  { const d0 = Field.prototype.draw; Field.prototype.draw = function () { d0.apply(this, arguments); if (hudMmo() && G) { try { unitFrame(); minimap(this); hotbar(); } catch (e) { console.warn('mmo hud', e); } } }; }
  // toasts in the middle band
  { const t0 = drawToasts; drawToasts = function () {
      if (!hudMmo() || !(scenes[scenes.length - 1] instanceof Field)) return t0.apply(this, arguments);
      const t = toasts[0]; if (!t) return;
      const slide = Math.min(1, (110 - t.t) / 10, t.t / 10), y = MMO_LAYOUT.toastY + (isMu() ? 8 : 0) - Math.round(6 * (1 - slide));
      ctx.globalAlpha = Math.max(0.2, slide); panel(4, y, 152, 25);
      if (t.icon) blit(sprFit(t.icon, 14), 9, y + 6);
      text(String(t.title).slice(0, 21), 27, y + 4, 3); text(String(t.sub || '').slice(0, 21), 27, y + 14, 2); ctx.globalAlpha = 1;
    }; }
}
