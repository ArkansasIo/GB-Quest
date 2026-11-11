'use strict';
// ================================================================ ASSET PACK ART IN THE GAME
// The sliced reference sheets are installed as ap_* (world/game art) and au_* (UI kit).
// Every route is deterministic and falls back to the existing sprite when pack art is unavailable.

const AP_COUNTS = Object.freeze({
  characters: 43, npcs: 33, enemies: 19, monsters: 24, weapons: 42, armor: 52,
  items: 54, terrain: 34, environment: 26, buildings: 27, dungeon: 48,
  ui_icons: 40, portraits: 30, particles: 24, mounts: 22, map_elements: 12,
});
const AP_ACTOR_SPRITES = Object.freeze({
  characters: Array.from({ length: AP_COUNTS.characters }, (_, i) => `actor_character_${String(i).padStart(3, '0')}`),
  npcs: Array.from({ length: AP_COUNTS.npcs }, (_, i) => `actor_npc_${String(i).padStart(3, '0')}`),
  enemies: Array.from({ length: AP_COUNTS.enemies }, (_, i) => `actor_enemy_${String(i).padStart(3, '0')}`),
  monsters: Array.from({ length: AP_COUNTS.monsters }, (_, i) => `actor_monster_${String(i).padStart(3, '0')}`),
});
const AU_COUNTS = Object.freeze({
  rarity_frames: 9, socket_gems: 8, consumables: 12, frames: 4, buttons: 3,
  checkboxes: 12, system_icons: 14, hotbar_skills: 4, hotbar_potions: 3,
  skill_icons: 12, inventory_items: 23, storage_items: 17, shop_items: 13,
  menu_icons: 12, banners: 2,
});
const AP_ITEM_ART = {
  potion: 'ap_items_000', greater: 'ap_items_001', superior: 'ap_items_005', supreme: 'ap_items_029', ether: 'ap_items_002', antitoxin: 'ap_items_003',
  might: 'ap_items_004', ration: 'ap_items_020', grilled: 'ap_items_022', feast: 'ap_items_017', scroll_flame: 'ap_items_007', scroll_mend: 'ap_items_008',
  scroll_dawn: 'ap_items_007', codex_page: 'ap_items_006', coinpurse: 'ap_items_014', gold_dust: 'ap_items_014', tower_key: 'ap_items_016', idol_shard: 'ap_items_028',
  repair_kit: 'ap_items_013',
};
const AP_GEM_ART = { ruby: 'au_socket_gems_000', sapphire: 'au_socket_gems_001', emerald: 'au_socket_gems_002', topaz: 'au_socket_gems_003', garnet: 'au_socket_gems_004', onyx: 'au_socket_gems_004', opal: 'au_socket_gems_005', diamond: 'au_socket_gems_006', amethyst: 'au_socket_gems_007' };
const actorMonster = i => AP_ACTOR_SPRITES.monsters[i];
const actorEnemy = i => AP_ACTOR_SPRITES.enemies[i];
// The source pack's dedicated px variants cover every actor role and monster family.
const AP_MONSTERS = Object.freeze({
  dragon: [0, 7, 8, 23].map(actorMonster).concat('custom_enemy_ash_wyrm'),
  fiend: [2, 17, 18].map(actorMonster),
  construct: [1, 19].map(actorMonster).concat('custom_enemy_crystal_titan'),
  elemental: [1, 20].map(actorMonster).concat('custom_enemy_mire_wisp'),
  giant: [1, 21].map(actorMonster),
  beast: [4, 5, 6, 11, 12, 13, 14, 15, 16].map(actorMonster),
  monstrosity: [3, 5, 22].map(actorMonster),
  aberration: [3, 22].map(actorMonster),
  ooze: [9, 10].map(actorMonster),
  humanoid: [2, ...Array.from({ length: 15 }, (_, i) => i + 4)].map(actorEnemy).concat([19, 20, 21, 22].map(actorMonster)),
  undead: [0, 1, 3].map(actorEnemy).concat('custom_enemy_bone_stalker'),
  celestial: [2, 17, 18].map(actorMonster),
  fey: [4, 9, 10].map(actorMonster),
  plant: [9, 10, 16].map(actorMonster),
  boss: AP_ACTOR_SPRITES.monsters,
});
const AP_PORTRAITS = Array.from({ length: AP_COUNTS.portraits }, (_, i) => `ap_portraits_${String(i).padStart(3, '0')}`);
function apHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function apPick(category, identity, prefix = 'ap_') {
  const counts = prefix === 'au_' ? AU_COUNTS : AP_COUNTS, count = counts[category] || 0;
  if (!count) return null;
  const name = `${prefix}${category}_${String(apHash(`${category}|${identity}`) % count).padStart(3, '0')}`;
  return typeof IMG === 'undefined' || IMG[name] ? name : null;
}
function apActorPick(category, identity) {
  const sprites = AP_ACTOR_SPRITES[category];
  if (!sprites || !sprites.length) return apPick(category, identity);
  const name = sprites[apHash(`${category}|${identity}`) % sprites.length];
  return typeof IMG === 'undefined' || IMG[name] ? name : apPick(category, identity);
}
const auMenuIconFor = label => apPick('menu_icons', label, 'au_');
const auSystemIconFor = label => apPick('system_icons', label, 'au_');
const AU_ITEM_CATEGORIES = new Set(['inventory_items', 'storage_items', 'shop_items']);
const auItemFor = (category, identity) => AU_ITEM_CATEGORIES.has(category) ? apPick(category, identity, 'au_') : null;
const AP_CLASS_ART = Object.freeze({
  vanguard: 'custom_character_iron_vanguard', strider: 'custom_character_moon_ranger',
  arcanist: 'custom_character_ember_mage', chaplain: 'custom_character_dawn_priest',
});
function apCharacterFor(character) {
  const cls = typeof character === 'object' && character ? String(character.cls || '').toLowerCase() : '';
  const custom = AP_CLASS_ART[cls];
  if (custom && typeof IMG !== 'undefined' && IMG[custom]) return custom;
  return apActorPick('characters', typeof character === 'object' && character ? `${character.name || ''}|${character.cls || ''}|${character.species || character.race || ''}` : character);
}
const apNpcFor = entity => apActorPick('npcs', typeof entity === 'object' && entity ? `${entity.name || ''}|${entity.svc || ''}|${entity.prof || ''}|${entity.spr || ''}` : entity);
const apMountFor = mount => apPick('mounts', typeof mount === 'object' && mount ? `${mount.id || ''}|${mount.family || ''}|${mount.variant || ''}` : mount);
function apEquipmentFor(item) {
  if (!item) return null;
  const id = String(item.base || item.id || item.name || item.kind || 'item');
  if (AP_ITEM_ART[id]) return AP_ITEM_ART[id];
  if (item.kind === 'weapon') return apPick('weapons', `${id}|${item.name || ''}|${item.fam || ''}`);
  if (item.kind === 'armor' || item.kind === 'armour') return apPick('armor', `${id}|${item.name || ''}|${item.slot || ''}`);
  return apPick('items', `${id}|${item.name || ''}|${item.kind || ''}`);
}
function apFieldArtFor(name) {
  if (!name || typeof name !== 'string' || name.startsWith('ap_') || name.startsWith('au_')) return null;
  const lower = name.toLowerCase();
  if (/^gt_/.test(lower)) {
    if (/_(house|inn|shop|temple|tower|building|windmill)(_|$)/.test(lower)) return apPick('buildings', lower);
    if (/_(tree|pine|dense|single|rock|bush|plant)(_|$)/.test(lower)) return apPick('environment', lower);
    return apPick('terrain', lower);
  }
  if (/^(gd_|d_[a-z])/.test(lower)) return apPick('dungeon', lower);
  if (/^go_/.test(lower) || /^(px_waypoint|item_chest)/.test(lower)) return apPick('map_elements', lower);
  if (/^mt_/.test(lower)) return apPick('mounts', lower);
  if (/^gh_npc_/.test(lower) || /^(villager|elder|hero)_/.test(lower)) return apActorPick('npcs', lower);
  if (/^(gh_|c_)/.test(lower)) return apActorPick('characters', lower);
  if (/^world_/.test(lower)) return apPick('environment', lower);
  if (/^b_/.test(lower)) return apPick('buildings', lower);
  return null;
}
// Every subtype resolves to stable family art; unknown families use the full monster set.
const apMonsterArt = (fam, key) => { const L = AP_MONSTERS[fam] || AP_MONSTERS.boss; if (!L || !L.length) return null; return L[apHash('ap|' + key) % L.length]; };
const apBossArtFor = boss => {
  const family = boss && boss.fam;
  const L = AP_MONSTERS[family] || AP_MONSTERS.boss;
  if (!L || !L.length) return null;
  return L[apHash(`boss|${boss && (boss.id || boss.name) || ''}`) % L.length];
};
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

if (typeof globalThis !== 'undefined') globalThis.GBQAssetPack = {
  AP_ITEM_ART, AP_GEM_ART, AP_MONSTERS, AP_ACTOR_SPRITES, AP_CLASS_ART, AP_PORTRAITS, AP_COUNTS, AU_COUNTS,
  apPick, apActorPick, menuIconFor: auMenuIconFor, systemIconFor: auSystemIconFor, uiItemFor: auItemFor,
  characterFor: apCharacterFor, npcFor: apNpcFor, mountFor: apMountFor,
  equipmentFor: apEquipmentFor, fieldArtFor: apFieldArtFor, portraitFor: apPortraitFor,
  apMonsterArt, bossArtFor: apBossArtFor, apPortraitFor, apSceneFor, BATTLE_BG_MODES, nextBattleBg,
};

if (typeof window !== 'undefined' && typeof IMG !== 'undefined') {
  window.gemArt = type => (typeof artOn !== 'function' || artOn()) && AP_GEM_ART[type] && IMG[AP_GEM_ART[type]] ? AP_GEM_ART[type] : null;

  // Route item/gear icons through the matching item, weapon, or armour collection.
  if (typeof itemIcon === 'function') {
    const itemIconBase = itemIcon;
    itemIcon = function (it) {
      if (it && artOn()) {
        const active = typeof scenes !== 'undefined' && scenes.length ? scenes[scenes.length - 1] : null;
        const sceneName = active && active.constructor ? active.constructor.name : '';
        const category = sceneName === 'StashScene' ? 'storage_items' : /Auction|Shop|Store|Vendor/.test(sceneName) && !it.kind ? 'shop_items' : null;
        const uiItem = category && auItemFor(category, `${it.base || it.id || it.name || ''}|${it.kind || it.type || ''}`);
        if (uiItem && IMG[uiItem]) return uiItem;
        const named = it.named && IMG['nn_' + it.named];
        if (!named) {
          const packed = apEquipmentFor(it);
          if (packed && IMG[packed]) return packed;
        }
      }
      return itemIconBase.apply(this, arguments);
    };
  }

  // Replace map tiles, people, and mounts by the semantically matching pack family.
  // Each mapper is deterministic and uses the original renderer as a fallback.
  const packSpriteName = name => {
    if (typeof artOn !== 'function' || !artOn()) return null;
    const candidate = apFieldArtFor(name);
    return candidate && IMG[candidate] ? candidate : null;
  };
  if (typeof spr === 'function') {
    const sprBase = spr;
    spr = function (name, w, h, opt) { return sprBase(packSpriteName(name) || name, w, h, opt); };
  }
  if (typeof sprH === 'function') {
    const sprHBase = sprH;
    sprH = function (name, h, opt) { return sprHBase(packSpriteName(name) || name, h, opt); };
  }
  if (typeof sprFit === 'function') {
    const sprFitBase = sprFit;
    sprFit = function (name, box, opt) { return sprFitBase(packSpriteName(name) || name, box, opt); };
  }

  // The full-body character collection appears in the field, class select, and character panels.
  if (typeof worldPortrait === 'function') {
    const worldPortraitBase = worldPortrait;
    worldPortrait = function (character, dir, ghost) {
      if (artOn() && !ghost) {
        const packed = apCharacterFor(character);
        if (packed && IMG[packed]) return sprFit(packed, 24, { flip: dir === 'left' });
      }
      return worldPortraitBase.apply(this, arguments);
    };
  }
  if (typeof npcSprite === 'function') {
    const npcSpriteBase = npcSprite;
    npcSprite = function (entity) {
      if (artOn() && entity) {
        const packed = apNpcFor(entity);
        if (packed && IMG[packed]) return spr(packed, 16, 16);
      }
      return npcSpriteBase.apply(this, arguments);
    };
    window.npcSprite = npcSprite;
  }

  // Expose all supplied main-pack monsters across matching families and relevant bosses.
  if (typeof BESTIARY !== 'undefined') {
    for (const b of BESTIARY) if (!b.ccArt) { const n = apMonsterArt(b.fam, `${b.sub}|${b.variant}`); if (n) b.nspr = n; }
  }
  if (typeof BOSSES !== 'undefined') for (const b of BOSSES) { const n = apBossArtFor(b); if (n) b.nspr = n; }

  // Scene paintings are selected in SETTINGS > BATTLE BG > SCENES.
  if (typeof drawBattleBackdrop === 'function') {
    const d0 = drawBattleBackdrop;
    drawBattleBackdrop = function (battle) {
      if (S.battleBg !== 'scenes') return d0.apply(this, arguments);
      const zone = typeof ZONE_BY_ID !== 'undefined' && G ? ZONE_BY_ID[G.map] : null;
      const name = apSceneFor(battle.kind, battle.foes, !!(G && G.inst && G.inst.kind !== 'raid'), !!(zone && zone.town));
      const im = IMG[name];
      if (!im) return d0.apply(this, arguments);
      const band = BBG_BOT - BBG_TOP, sy = Math.max(0, Math.round(im.height * 0.5 - band / 2));
      ctx.drawImage(spr(name, im.width, im.height), 0, sy, im.width, band, 0, BBG_TOP, W, band);
      ctx.fillStyle = 'rgba(10,8,16,0.38)'; ctx.fillRect(0, BBG_TOP, W, band);
      fill(0, BBG_BOT - 1, W, 1, 3);
    };
  }

  // Pack spell particles are used by the existing battle-effect renderer.
  if (typeof spellArt === 'function') {
    const spellArtBase = spellArt;
    spellArt = function (spell) {
      if (artOn() && spell) {
        const packed = apPick('particles', `${spell.dt || ''}|${spell.school || ''}|${spell.id || spell.name || ''}`);
        if (packed && IMG[packed]) return packed;
      }
      return spellArtBase.apply(this, arguments);
    };
  }

  // Item cells get the ornate rarity ring from the UI kit.
  if (typeof drawItemCell === 'function') {
    const drawItemCellBase = drawItemCell;
    drawItemCell = function (it, x, y, selected, opts = {}) {
      const args = Array.from(arguments);
      const active = typeof scenes !== 'undefined' && scenes.length ? scenes[scenes.length - 1] : null;
      const sceneName = active && active.constructor ? active.constructor.name : '';
      if (artOn() && opts && opts.icon) {
        const category = sceneName === 'StashScene' && active.pane ? 'storage_items' : 'inventory_items';
        const itemName = it && (it.name || it.base || it.id || it.kind) || opts.icon;
        const uiItem = auItemFor(category, `${itemName}|${opts.icon}`);
        if (uiItem && IMG[uiItem]) args[4] = { ...opts, icon: uiItem };
      }
      const result = drawItemCellBase.apply(this, args);
      if (it && artOn() && !MONO(S.palette)) {
        const n = `au_rframe_${Math.max(0, Math.min(8, it.rarity === undefined ? 1 : it.rarity))}`;
        if (IMG[n]) blit(spr(n, 18, 18), x, y);
      }
      return result;
    };
  }

  // Talking to a townsperson shows a stable face portrait beside the dialogue box.
  let speaker = null;
  if (typeof npcService === 'function') {
    const npcServiceBase = npcService;
    npcService = function (entity) { speaker = entity && entity.name && entity.kind === 'npc' ? entity.name : null; return npcServiceBase.apply(this, arguments); };
  }
  if (typeof Field !== 'undefined') {
    const fieldUpdateBase = Field.prototype.update;
    Field.prototype.update = function () { if (scenes[scenes.length - 1] === this) speaker = null; return fieldUpdateBase.apply(this, arguments); };
  }
  if (typeof Dialog !== 'undefined') {
    const dialogDrawBase = Dialog.prototype.draw;
    Dialog.prototype.draw = function () {
      if (this.face === undefined) this.face = this.portrait || (speaker && artOn() ? apPortraitFor(speaker) : null);
      dialogDrawBase.apply(this, arguments);
      if (this.face && IMG[this.face]) { const y = H - 44 - 34; frame(W - 38, y, 36, 36); blit(sprFit(this.face, 32), W - 36, y + 2); }
    };
  }
}
