'use strict';
// ================================================================ ASSET PACK ART IN THE GAME
// Uses the 8-bit art sliced from the two reference sheets (tools/slice_assetpack.py; ap_* asset pack, au_* UI kit):
//   * SETTINGS > BATTLE BG gains SCENES: painted city, wilderness, dungeon and boss-fight backdrops behind battles.
//   * Potions, food, scrolls, books, keys and coins use the pack's item icons while art is on.
//   * The gem socket forge shows real gem icons.
// Everything falls back to the old art when an image is missing.

const AP_ITEM_ART = {
  potion: 'ap_items_000', greater: 'ap_items_001', superior: 'ap_items_005', supreme: 'ap_items_029', ether: 'ap_items_002', antitoxin: 'ap_items_003',
  might: 'ap_items_004', ration: 'ap_items_020', grilled: 'ap_items_022', feast: 'ap_items_017', scroll_flame: 'ap_items_007', scroll_mend: 'ap_items_008',
  scroll_dawn: 'ap_items_007', codex_page: 'ap_items_006', coinpurse: 'ap_items_014', gold_dust: 'ap_items_014', tower_key: 'ap_items_016', idol_shard: 'ap_items_028',
  repair_kit: 'ap_items_013',
};
const AP_GEM_ART = { ruby: 'au_socket_gems_000', sapphire: 'au_socket_gems_001', emerald: 'au_socket_gems_002', topaz: 'au_socket_gems_003', garnet: 'au_socket_gems_004', onyx: 'au_socket_gems_004', opal: 'au_socket_gems_005', diamond: 'au_socket_gems_006', amethyst: 'au_socket_gems_007' };
// which painted scene a battle uses
function apSceneFor(kind, foes, inDungeon, inTown) {
  if ((foes || []).some(f => f && f.boss)) return 'ap_scene_boss_fight';
  if (inDungeon || ['dungeon', 'tower', 'trial', 'raid'].includes(kind)) return 'ap_scene_dungeon';
  if (inTown || ['arena', 'pvp'].includes(kind)) return 'ap_scene_city';
  return 'ap_scene_wilderness';
}
const BATTLE_BG_MODES = ['clean', 'painted', 'scenes'];
const nextBattleBg = cur => BATTLE_BG_MODES[(BATTLE_BG_MODES.indexOf(cur) + 1) % BATTLE_BG_MODES.length];

if (typeof globalThis !== 'undefined') globalThis.GBQAssetPack = { AP_ITEM_ART, AP_GEM_ART, apSceneFor, BATTLE_BG_MODES, nextBattleBg };

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
}
