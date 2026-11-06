'use strict';
// ================================================================ ASSET PACK ART IN THE GAME
// Uses the 8-bit art sliced from the two reference sheets (tools/slice_assetpack.py; ap_* asset pack, au_* UI kit):
//   * SETTINGS > BATTLE BG gains SCENES: painted city, wilderness, dungeon and boss-fight backdrops behind battles.
//   * Potions, food, scrolls, books, keys and coins use the pack's item icons while art is on.
//   * The gem socket forge shows real gem icons.
//   * Item cells get an ornate border tinted by rarity (au_rframe_<tier>).
//   * About half of each bestiary family (and fitting world and raid bosses) use the pack's monster art.
//   * Talking to a townsperson shows a face portrait beside the dialogue box.
// Everything falls back to the old art when an image is missing.

const AP_ITEM_ART = {
  potion: 'ap_items_000', greater: 'ap_items_001', superior: 'ap_items_005', supreme: 'ap_items_029', ether: 'ap_items_002', antitoxin: 'ap_items_003',
  might: 'ap_items_004', ration: 'ap_items_020', grilled: 'ap_items_022', feast: 'ap_items_017', scroll_flame: 'ap_items_007', scroll_mend: 'ap_items_008',
  scroll_dawn: 'ap_items_007', codex_page: 'ap_items_006', coinpurse: 'ap_items_014', gold_dust: 'ap_items_014', tower_key: 'ap_items_016', idol_shard: 'ap_items_028',
  repair_kit: 'ap_items_013',
};
const AP_GEM_ART = { ruby: 'au_socket_gems_000', sapphire: 'au_socket_gems_001', emerald: 'au_socket_gems_002', topaz: 'au_socket_gems_003', garnet: 'au_socket_gems_004', onyx: 'au_socket_gems_004', opal: 'au_socket_gems_005', diamond: 'au_socket_gems_006', amethyst: 'au_socket_gems_007' };
// pack monster art by family (indices into ap_monsters_* / ap_enemies_*)
const AP_MONSTERS = {
  dragon: ['ap_monsters_000', 'ap_monsters_007', 'ap_monsters_008'], fiend: ['ap_monsters_002', 'ap_monsters_017', 'ap_monsters_018'],
  construct: ['ap_monsters_001'], elemental: ['ap_monsters_001'], giant: ['ap_monsters_001'],
  beast: ['ap_monsters_004', 'ap_monsters_005', 'ap_monsters_006', 'ap_monsters_011', 'ap_monsters_012', 'ap_monsters_013', 'ap_monsters_014', 'ap_monsters_015', 'ap_monsters_016'],
  monstrosity: ['ap_monsters_003', 'ap_monsters_005'], aberration: ['ap_monsters_003'], ooze: ['ap_monsters_009', 'ap_monsters_010'],
  humanoid: ['ap_enemies_002', 'ap_enemies_004', 'ap_enemies_005', 'ap_enemies_006', 'ap_enemies_007', 'ap_enemies_008', 'ap_enemies_009', 'ap_enemies_011', 'ap_enemies_012', 'ap_enemies_013', 'ap_enemies_014', 'ap_enemies_015', 'ap_enemies_016', 'ap_enemies_017', 'ap_enemies_018', 'ap_monsters_019', 'ap_monsters_020', 'ap_monsters_021', 'ap_monsters_022'],
  undead: ['ap_enemies_000', 'ap_enemies_001', 'ap_enemies_003'],
};
const AP_PORTRAITS = Array.from({ length: 30 }, (_, i) => `ap_portraits_${String(i).padStart(3, '0')}`);
function apHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// a bestiary subtype gets pack art when its hash lands in the new half (stable per subtype)
const apMonsterArt = (fam, key) => { const L = AP_MONSTERS[fam]; if (!L) return null; const h = apHash('ap|' + key); return h % 2 ? L[(h >>> 1) % L.length] : null; };
const apPortraitFor = name => name ? AP_PORTRAITS[apHash('face|' + name) % AP_PORTRAITS.length] : null;
// which painted scene a battle uses
function apSceneFor(kind, foes, inDungeon, inTown) {
  if ((foes || []).some(f => f && f.boss)) return 'ap_scene_boss_fight';
  if (inDungeon || ['dungeon', 'tower', 'trial', 'raid'].includes(kind)) return 'ap_scene_dungeon';
  if (inTown || ['arena', 'pvp'].includes(kind)) return 'ap_scene_city';
  return 'ap_scene_wilderness';
}
const BATTLE_BG_MODES = ['clean', 'painted', 'scenes'];
const nextBattleBg = cur => BATTLE_BG_MODES[(BATTLE_BG_MODES.indexOf(cur) + 1) % BATTLE_BG_MODES.length];

if (typeof globalThis !== 'undefined') globalThis.GBQAssetPack = { AP_ITEM_ART, AP_GEM_ART, AP_MONSTERS, AP_PORTRAITS, apMonsterArt, apPortraitFor, apSceneFor, BATTLE_BG_MODES, nextBattleBg };

if (typeof window !== 'undefined' && typeof IMG !== 'undefined') {
  window.gemArt = type => (typeof artOn !== 'function' || artOn()) && AP_GEM_ART[type] && IMG[AP_GEM_ART[type]] ? AP_GEM_ART[type] : null;
  // item icons: on top of the NES art, refreshed whenever the art setting changes
  if (typeof applyArt === 'function') {
    const a0 = applyArt;
    applyArt = function () { a0.apply(this, arguments); if (!artOn()) return; for (const [k, n] of Object.entries(AP_ITEM_ART)) if (ITEMS[k] && IMG[n]) ITEMS[k].icon = n; };
    // images load after the scripts run: apply once they are in
    const wait = setInterval(() => { if (IMG.ap_items_000) { clearInterval(wait); applyArt(); } }, 250); setTimeout(() => clearInterval(wait), 30000);
  }
  // painted scene backdrops
  if (typeof drawBattleBackdrop === 'function') {
    const d0 = drawBattleBackdrop;
    drawBattleBackdrop = function (b) {
      if (S.battleBg !== 'scenes') return d0.apply(this, arguments);
      const z = typeof ZONE_BY_ID !== 'undefined' && G ? ZONE_BY_ID[G.map] : null;
      const n = apSceneFor(b.kind, b.foes, !!(G && G.inst && G.inst.kind !== 'raid'), !!(z && z.town));
      const im = IMG[n]; if (!im) return d0.apply(this, arguments);
      const band = BBG_BOT - BBG_TOP, sy = Math.max(0, Math.round(im.height * 0.5 - band / 2));
      ctx.drawImage(spr(n, im.width, im.height), 0, sy, im.width, band, 0, BBG_TOP, W, band);
      ctx.fillStyle = 'rgba(10,8,16,0.38)'; ctx.fillRect(0, BBG_TOP, W, band); // dim so the fighters stand out
      fill(0, BBG_BOT - 1, W, 1, 3);
    };
  }

  // monster art: half of each family's subtypes, plus dragon and fiend world/raid bosses
  if (typeof BESTIARY !== 'undefined') {
    for (const b of BESTIARY) if (!b.ccArt) { const n = apMonsterArt(b.fam, `${b.sub}|${b.variant}`); if (n) b.nspr = n; }
    if (typeof BOSSES !== 'undefined') for (const b of BOSSES) if (b.cat !== 'arc' && ['dragon', 'fiend', 'construct'].includes(b.fam)) { const n = apMonsterArt(b.fam, b.id); if (n) b.nspr = n; }
  }
  // rarity rings on item cells
  if (typeof drawItemCell === 'function') {
    const c0 = drawItemCell;
    drawItemCell = function (it, x, y) {
      const r = c0.apply(this, arguments);
      if (it && artOn() && !MONO(S.palette)) { const n = `au_rframe_${Math.max(0, Math.min(8, it.rarity === undefined ? 1 : it.rarity))}`; if (IMG[n]) blit(spr(n, 18, 18), x, y); }
      return r;
    };
  }
  // faces for townsfolk: a dialogue opened while talking to an NPC shows their portrait
  let speaker = null;
  if (typeof npcService === 'function') { const n0 = npcService; npcService = function (e) { speaker = e && e.name && e.kind === 'npc' ? e.name : null; return n0.apply(this, arguments); }; }
  if (typeof Field !== 'undefined') { const u0 = Field.prototype.update; Field.prototype.update = function () { if (scenes[scenes.length - 1] === this) speaker = null; return u0.apply(this, arguments); }; }
  if (typeof Dialog !== 'undefined') {
    const d0 = Dialog.prototype.draw;
    Dialog.prototype.draw = function () {
      if (this.face === undefined) this.face = this.portrait || (speaker && artOn() ? apPortraitFor(speaker) : null);
      d0.apply(this, arguments);
      if (this.face && IMG[this.face]) { const y = H - 44 - 34; frame(W - 38, y, 36, 36); blit(sprFit(this.face, 32), W - 36, y + 2); }
    };
  }
}

// Equipment icons from assets_pack: use dedicated weapon and armour panels
// instead of generic placeholders. Stable hashes keep item art consistent.
const AP_GEAR_COUNTS = { weapons: 42, armor: 52 };
function apGearIcon(it) {
  if (!it || !artOn()) return null;
  const panel = it.kind === 'weapon' ? 'weapons' : it.kind === 'armor' ? 'armor' : null;
  if (!panel) return null;
  const count = AP_GEAR_COUNTS[panel];
  const rarity = Math.max(0, Number(it.rarity) || 0);
  const index = apHash(panel + '|' + String(it.base || it.id || it.name || 'gear') + '|' + rarity) % count;
  const name = `ap_${panel}_${String(index).padStart(3, '0')}`;
  return IMG[name] ? name : null;
}
if (typeof window !== 'undefined' && typeof itemIcon === 'function') {
  const apItemIconBase = itemIcon;
  itemIcon = function (it) { return apGearIcon(it) || apItemIconBase.apply(this, arguments); };
}
