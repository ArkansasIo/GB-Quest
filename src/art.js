// LOST KINGDOM OF SHADOWBANE CHRONICLES art pack: the NES-style sheets (monsters, equipment, class & species portraits)
// mapped onto creatures, bosses, items, spells, heroes and battle backgrounds.
// Settings > ART switches between NES (these sheets) and CLASSIC (the original sheet).
'use strict';
const NES = window.NES_INDEX || {};
const artOn = () => S.art !== 'classic' && Object.keys(NES).length > 0;
function nesPick(cats, key) {
  const pool = [].concat(...cats.map(c => NES[c] || []));
  return pool.length ? pool[hashStr(String(key)) % pool.length] : null;
}
const FAMILY_ART = {
  beast: ['beast', 'm_beast'], humanoid: ['m_humanoid', 'monster'], undead: ['undead', 'm_undead'], fiend: ['demon', 'm_fiend'],
  fey: ['m_fey', 'plant'], elemental: ['elemental', 'm_elemental'], construct: ['m_giant', 'strong'], dragon: ['dragon', 'm_dragon'],
  giant: ['m_giant'], ooze: ['slime', 'm_ooze'], aberration: ['m_aberration'], monstrosity: ['monster'], plant: ['plant'], celestial: ['strong', 'm_fey'],
};
// every bestiary entry and boss gets a stable NES sprite (same subtype + variant -> same art)
for (const b of BESTIARY) if (!b.ccArt) b.nspr = nesPick(FAMILY_ART[b.fam] || ['monster'], b.sub + '|' + b.variant + '|' + b.rank);
for (const b of BOSSES) b.nspr = b.cat === 'arc' ? null : nesPick(b.cat === 'raid' || b.cat === 'world' ? ['strong', 'dragon', 'demon'] : ['strong', ...(FAMILY_ART[b.fam] || ['monster'])], b.id);
const CITADEL_CREATURES = { beast: ['dire-wolf','griffin','forest-stag'], humanoid: ['stone-troll','harpy'], undead: ['wraith'], fiend: ['wyvern'], fey: ['forest-stag'], elemental: ['iron-golem'], construct: ['iron-golem'], dragon: ['wyvern'], giant: ['stone-troll'], ooze: ['mimic'], aberration: ['sea-leviathan'], monstrosity: ['basilisk','cave-spider'], plant: ['forest-stag'], celestial: ['griffin'] };
const citadelCreatureFor = b => {
  if (!b || S.citadelArt === false) return null;
  const pool = CITADEL_CREATURES[b.fam];
  if (!pool || !pool.length) return null;
  const key = pool[hashStr(String(b.sub || b.id || b.name || b.variant || b.fam)) % pool.length];
  const image = 'citadel_creature_' + key;
  return IMG[image] ? image : null;
};
const CITADEL_BOSSES = ['ember-ancient','frost-tyrant','void-oracle','dread-colossus','storm-seraph','hollow-king'];
let AP_PACK_ENEMIES = null;
function assetPackEnemyFor(b) {
  if (S.art !== 'packs' || !b) return null;
  AP_PACK_ENEMIES ||= Object.keys(IMG).filter(name => /^ap_enemies_\d+$/.test(name)).sort();
  if (!AP_PACK_ENEMIES.length) return null;
  const familyIndex = { ooze: 0, beast: 4, humanoid: 2, undead: 3, fiend: 13, dragon: 7, giant: 10, plant: 12, aberration: 8, monstrosity: 10, fey: 12 };
  const index = familyIndex[b.fam] ?? hashStr(`${b.fam}|${b.sub}|${b.variant}|${b.id}`) % AP_PACK_ENEMIES.length;
  const preferred = `ap_enemies_${String(index).padStart(3, '0')}`;
  return IMG[preferred] ? preferred : AP_PACK_ENEMIES[index % AP_PACK_ENEMIES.length];
}
// RETRO 8-BIT mode (tools/gen_retro8.py): original 8-bit console-RPG tiles and monsters.
// Each bestiary subtype has one design, palette-swapped per element variant; bosses get a crowned regal version.
// Collector creatures and story (arc) bosses keep their own art.
const RETRO_TILE_GROUP = { desert: 'sand', badlands: 'sand', savanna: 'sand', oasis: 'sand', snow: 'snow', frozen: 'snow',
  marsh: 'swamp', corruption: 'swamp', dusk: 'swamp', ruins: 'swamp', mushroom: 'swamp', volcanic: 'lava', crystal: 'mystic', aether: 'mystic', sky: 'mystic' };
// AELMOOR HD (tools/gen_aelmoor.py) shares the retro shapes and tiles but renders monsters and townsfolk with
// smooth height-field lighting (r9* sprites), and adds a moonlit title backdrop.
const retroMode = () => S.art === 'retro' || S.art === 'aelmoor';
const retroPrefix = () => (S.art === 'aelmoor' ? 'r9' : 'r8');
// Lanterns of Aelmoor key art (src/keyart_index.js, tools/slice_keyart.py): in AELMOOR HD mode the sliced sprites
// replace the generated ones wherever the index has a match.
const keyArtOn = () => S.art === 'aelmoor' && typeof KEYART !== 'undefined';
const keyArtImg = n => (n && IMG[n] ? n : null);
function retroNpcArt(role, blink, key) {
  if (!retroMode() || !role) return null;
  if (keyArtOn()) {
    const k = keyArtImg(KEYART.npc[role]) || keyArtImg(KEYART.npcPool[hashStr(String(key || role)) % KEYART.npcPool.length]);
    if (k) return k;
  }
  const name = `${retroPrefix()}n_${role}_${blink ? 1 : 0}`;
  return IMG[name] ? name : null;
}
const retroSlug = sub => String(sub || '').toLowerCase().replace(/[^a-z]/g, '');
const RETRO_DUNGEON_THEMES = new Set(['dungeon', 'crypt', 'ice', 'lava', 'temple', 'void']);
function retroWorldTile(tile) {
  const m = /^g([td])_([a-z]+)_(.+)$/.exec(tile || '');
  if (!m || m[2].startsWith('r8')) return null;
  if (m[1] === 't' && keyArtOn() && KEYART.town.includes(m[3])) { const k = keyArtImg(`gt_ka${RETRO_TILE_GROUP[m[2]] || 'green'}_${m[3]}`); if (k) return k; }
  const name = m[1] === 'd' ? `gd_r8${RETRO_DUNGEON_THEMES.has(m[2]) ? m[2] : 'dungeon'}_${m[3]}` : `gt_r8${RETRO_TILE_GROUP[m[2]] || 'green'}_${m[3]}`;
  return IMG[name] ? name : null;
}
function retroMonsterArt(b) {
  if (!b || b.ccArt || b.cat === 'arc') return null;
  if (S.art === 'packs') return fdMonsterArt(b);
  const isBoss = !!(b.cat || b.boss);
  const src = isBoss ? (b.base && BEAST_BY_ID[b.base]) || (b.sub ? b : null) : b;
  if (!src || src.ccArt) return null;
  const slug = retroSlug(src.sub);
  if (keyArtOn() && KEYART.monsters[slug]) {
    const base = KEYART.monsters[slug], v = isBoss ? '' : (src.variant ? `${base}_${src.variant}` : '');
    const k = keyArtImg(v) || keyArtImg(base);
    if (k) return k;
  }
  const p = retroPrefix(), name = isBoss ? `${p}b_${slug}_${hashStr(String(b.id || b.name || slug)) % 3}` : `${p}m_${slug}_${src.variant || 'base'}`;
  return IMG[name] ? name : null;
}
// FULL DETAIL (the default mode, tools/gen_fulldetail.py): redesigned heroes for every class and species, townsfolk,
// one monster per bestiary subtype (seven element variants, three boss forms) and field props for every biome.
const FD_PROPS = new Set(['tree', 'pine', 'dense', 'single', 'rock', 'peak', 'shop', 'inn', 'shrine', 'statue', 'temple', 'arena', 'keep', 'keepdoor', 'wall', 'gate']);
const fdOn = () => S.art === 'packs';
function fdMonsterArt(b) {
  if (!fdOn() || !b || b.ccArt || b.cat === 'arc') return null;
  const isBoss = !!(b.cat || b.boss);
  const src = isBoss ? (b.base && BEAST_BY_ID[b.base]) || (b.sub ? b : null) : b;
  if (!src || src.ccArt) return null;
  const slug = retroSlug(src.sub);
  const name = isBoss ? `fdb_${slug}_${hashStr(String(b.id || b.name || slug)) % 3}` : `fdm_${slug}_${src.variant || 'base'}`;
  return IMG[name] ? name : null;
}
function fdWorldTile(tile) {
  if (!fdOn()) return null;
  const m = /^gt_([a-z]+)_([a-z]+)$/.exec(tile || '');
  if (!m || !FD_PROPS.has(m[2])) return null;
  const name = `gt_fd${m[1]}_${m[2]}`;
  return IMG[name] ? name : null;
}
// field walker: class + species frames (16x24); left is the mirrored side view
function fdWalkerName(character, dir = 'down', frame = 0) {
  if (!fdOn() || !character) return null;
  const d = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side', f = frame ? 1 : 0;
  const cls = character.look && IMG[`fdw_${character.look}_down0`] ? character.look : character.cls;
  const sp = character.species || character.race;
  return [sp && sp !== 'hearthkin' ? `fdw_${cls}_${sp}_${d}${f}` : null, `fdw_${cls}_${d}${f}`].find(n => n && IMG[n]) || null;
}
function fdWalker(character, dir = 'down', frame = 0, ghost = false) {
  const name = fdWalkerName(character, dir, frame);
  return name ? spr(name, 16, 24, { flip: dir === 'left', ghost }) : null;
}
function fdNpcArt(role, blink) {
  if (!fdOn() || !role) return null;
  const name = `fdn_${role}_${blink ? 1 : 0}`;
  return IMG[name] ? name : null;
}
if (typeof window !== 'undefined') { window.fdWalker = fdWalker; window.fdWalkerName = fdWalkerName; window.fdWorldTile = fdWorldTile; window.fdNpcArt = fdNpcArt; window.fdMonsterArt = fdMonsterArt; }
if (typeof window !== 'undefined') { window.retroWorldTile = retroWorldTile; window.retroMonsterArt = retroMonsterArt; window.retroNpcArt = retroNpcArt; window.retroMode = retroMode; }

const monsterArt = b => {
  const fd = fdMonsterArt(b);
  if (fd) return fd;
  const supplied = assetPackEnemyFor(b);
  if (supplied) return supplied;
  if (retroMode()) { const retro = retroMonsterArt(b); if (retro) return retro; }
  if (b && (b.boss || b.cat === 'raid' || b.cat === 'world') && S.citadelArt !== false) {
    const boss = 'citadel_boss_' + CITADEL_BOSSES[hashStr(String(b.id || b.name || b.sub)) % CITADEL_BOSSES.length];
    if (IMG[boss]) return boss;
  }
  const citadel = citadelCreatureFor(b);
  if (citadel) return citadel;
  if (b && b.ccArt && IMG[b.ccArt]) return b.ccArt;
  if (artOn() && b && b.nspr && IMG[b.nspr]) return b.nspr;
  return b ? b.spr : 'enemy_goblin';
};

// items
const WEAPON_ART = { knife: 'dagger', crescent: 'dagger', longbrand: 'sword', needleblade: 'sword', widesword: 'sword', hatchet: 'axe', cleaver: 'axe',
  cudgel: 'mace', knobmace: 'mace', ironhammer: 'mace', stonemaul: 'mace', shortspear: 'polearm', poleblade: 'polearm', huntbow: 'bow', greatbow: 'bow', boltcaster: 'crossbow', walkstaff: 'staff' };
const WONDROUS_ART = { ring: 'ring', band: 'ring', charm: 'ring', amulet: 'amulet', pendant: 'amulet', boots: 'boots', sabatons: 'boots', circlet: 'magicitem', helm: 'heavyarmor', mask: 'relic', cloak: 'lightarmor', mantle: 'mediumarmor', gloves: 'glove', gauntlets: 'glove', belt: 'belt', girdle: 'belt', leggings: 'lightarmor', greaves: 'heavyarmor' };
function tierPick(cat, rarity, salt) {
  const L = NES[cat] || [];
  if (!L.length) return null;
  const tier = Number.isFinite(Number(rarity)) ? Number(rarity) : 1;
  const i = Math.min(L.length - 1, Math.max(0, Math.floor(tier) * 2 - 1 + (hashStr(String(salt)) % 2)));
  return L[i] || L[0] || null;
}
function armorArtCategory(item) {
  const armor = typeof ARMORS !== 'undefined' && ARMORS ? ARMORS[item.base] : null;
  const type = String((armor && (armor.type || armor.aclass)) || item.type || '').toLowerCase();
  if (type === 'shield') return 'shield';
  if (['light', 'leather', 'cloth', 'robe'].includes(type)) return 'lightarmor';
  if (['heavy', 'plate'].includes(type)) return 'heavyarmor';
  if (['medium', 'mail', 'chain'].includes(type)) return 'mediumarmor';
  return 'mediumarmor';
}
function nesItemIcon(it) {
  if (!it || !artOn()) return null;
  if (it.kind === 'weapon') return tierPick(WEAPON_ART[it.base] || 'sword', it.rarity, it.base);
  if (it.kind === 'armor') return tierPick(armorArtCategory(it), it.rarity, it.base);
  return tierPick(WONDROUS_ART[it.base] || 'ring', it.rarity, it.base);
}
if (typeof globalThis !== 'undefined') globalThis.GBQArtAssetSafety = { armorArtCategory, tierPick };
const ITEM_ART = { potion: ['potion', 0], greater: ['potion', 1], superior: ['potion', 3], supreme: ['potion', 5], ether: ['potion', 2], antitoxin: ['potion', 4], might: ['potion', 7],
  ration: ['food', 0], grilled: ['food', 4], feast: ['food', 6], campkit: ['tool', 3], scroll_flame: ['scroll', 1], scroll_mend: ['scroll', 2], scroll_dawn: ['scroll', 5],
  hearthstone: ['magicitem', 2], peacebloom: ['reagent', 0], sandroot: ['reagent', 3], frostbloom: ['reagent', 5], small_fish: ['food', 9], big_fish: ['food', 10], eel: ['food', 11],
  goblin_token: ['currency', 2], old_bone: ['misc', 3], slimegel: ['reagent', 7], gold_dust: ['currency', 5], coinpurse: ['treasure2', 2], idol_shard: ['gem', 3],
  codex_page: ['tome', 3], tower_key: ['key', 4], old_boot: ['boots', 0] };
for (const k in ITEMS) ITEMS[k].icon0 = ITEMS[k].icon;
// RETRO 8-BIT / AELMOOR HD item icons: <p>i_<category>_<slot> (slot as tierPick picks it) and <p>c_<item key>
const RETRO_HELMS = new Set(['helm', 'circlet', 'great_helm', 'bascinet', 'sallet', 'barbute', 'armet', 'kettle_hat', 'nasal_helm']);
function retroItemIcon(it) {
  if (!it || !retroMode()) return null;
  let cat;
  if (it.kind === 'weapon') cat = WEAPON_ART[it.base] || 'sword';
  else if (it.kind === 'armor') cat = armorArtCategory(it);
  else cat = RETRO_HELMS.has(it.base) ? 'helmet' : (WONDROUS_ART[it.base] || 'ring');
  const tier = Number.isFinite(Number(it.rarity)) ? Math.floor(Number(it.rarity)) : 1;
  const slot = Math.min(10, Math.max(0, tier * 2 - 1 + (hashStr(String(it.base)) % 2)));
  if (keyArtOn() && KEYART.equip[cat]) { const L = KEYART.equip[cat], k = keyArtImg(L[Math.min(L.length - 1, Math.floor(slot * L.length / 11))]); if (k) return k; }
  // RETRO 8-BIT: the 8-bit item sheet (src/itemsheet_index.js), one icon per tier left to right
  if (S.art === 'retro' && typeof ITEMSHEET !== 'undefined' && ITEMSHEET.equip[cat]) { const L = ITEMSHEET.equip[cat], k = keyArtImg(L[Math.min(L.length - 1, Math.floor(slot * L.length / 11))]); if (k) return k; }
  const name = `${retroPrefix()}i_${cat}_${slot}`;
  return IMG[name] ? name : null;
}
if (typeof window !== 'undefined') window.retroItemIcon = retroItemIcon;
function applyArt() {
  for (const k in ITEMS) { const a = ITEM_ART[k]; const L = a && NES[a[0]]; const r = (keyArtOn() && keyArtImg(KEYART.consumables[k])) || (S.art === 'retro' && typeof ITEMSHEET !== 'undefined' && keyArtImg(ITEMSHEET.consumables[k])) || (retroMode() && IMG[`${retroPrefix()}c_${k}`] ? `${retroPrefix()}c_${k}` : null); ITEMS[k].icon = r || (artOn() && L && L.length ? L[Math.min(L.length - 1, a[1])] : ITEMS[k].icon0); }
}
applyArt();

// spells: one icon per school/damage type, used as the battle effect
const SPELL_ART = { fire: 0, cold: 1, lightning: 2, poison: 3, necrotic: 4, radiant: 5, force: 6, psychic: 7, thunder: 2, acid: 3, piercing: 8, bludgeoning: 9, slashing: 9 };
const SCHOOL_ART = { aegis: 10, calling: 11, omen: 12, thrall: 13, veil: 14, flux: 15, grave: 4, storm: 0 };
function spellArt(sp) {
  if (keyArtOn() && sp) { const k = keyArtImg(KEYART.effects[sp.dt]); if (k) return k; }
  if (S.art === 'packs' && typeof window.assetPackSpellArt === 'function') {
    const pack = window.assetPackSpellArt(sp);
    if (pack && IMG[pack]) return pack;
  }
  if (!artOn() || !NES.spell) return null;
  const i = sp.dt ? SPELL_ART[sp.dt] : SCHOOL_ART[sp.school];
  return NES.spell[Math.min(NES.spell.length - 1, i || 0)];
}
// heroes & species
const CITADEL_CLASS_ALIASES = { fighter: 'warrior', warden: 'warrior', barbarian: 'berserker', wizard: 'mage', sorcerer: 'mage', warlock: 'necromancer', druid: 'mage', monk: 'rogue', bard: 'bard', artificer: 'artificer', cleric: 'cleric', paladin: 'paladin', ranger: 'ranger', rogue: 'rogue', warrior: 'warrior', summoner: 'summoner', necromancer: 'necromancer', berserker: 'berserker', alchemist: 'alchemist' };
const classPortrait = cls => {
  const pack = artOn() && globalThis.GBQAssetPack && globalThis.GBQAssetPack.characterFor({ cls });
  if (pack && IMG[pack]) return pack;
  const id = CITADEL_CLASS_ALIASES[String(cls || '').toLowerCase()] || String(cls || '').toLowerCase();
  const citadel = 'citadel_class_' + id;
  return S.citadelArt !== false && IMG[citadel] ? citadel : artOn() && IMG[`np_class_${cls}`] ? `np_class_${cls}` : null;
};
const CITADEL_RACE_ALIASES = { hearthkin: 'human', human: 'human', thornelf: 'elf', elf: 'elf', lunari: 'elf', stonekin: 'dwarf', dwarf: 'dwarf', burrowkin: 'dwarf', orc: 'orc', tuskborn: 'orc', hornfolk: 'orc', tiefling: 'tiefling', emberborn: 'tiefling', felinar: 'beastkin', beastkin: 'beastkin', wolfkin: 'beastkin', wispling: 'beastkin', dragonkin: 'dragonkin', drakkin: 'dragonkin', starkin: 'human', pipkin: 'human', twinblood: 'human', undead: 'undead', returned: 'undead', halfling: 'human' };
const racePortrait = (sp, i = 0) => {
  const raw = String(sp || '').toLowerCase();
  const id = CITADEL_RACE_ALIASES[raw] || raw;
  const citadel = 'citadel_race_' + id;
  if (!artOn()) return null;
  const pack = globalThis.GBQAssetPack && globalThis.GBQAssetPack.portraitFor(`${raw}|${i}`);
  if (pack && IMG[pack]) return pack;
  if (S.citadelArt !== false && IMG[citadel]) return citadel;
  const n = `np_race_${sp}_${i}`; return IMG[n] ? n : IMG[`np_race_${sp}_0`] ? `np_race_${sp}_0` : null;
};
// battle backdrops: plains, forest, mountains, cave, castle
function battleBackdrop(kind) {
  if (S.citadelArt !== false) {
    const z = ZONE_BY_ID[G && G.map];
    let id = 'forest';
    if (kind === 'dungeon' || kind === 'tower' || kind === 'trial' || (G && G.inst && G.inst.kind !== 'raid')) id = 'dungeon';
    else if (kind === 'raid' || kind === 'arena' || (z && z.town)) id = 'city';
    else if (z) id = ({ meadow: 'plains', coast: 'coast', marsh: 'swamp', jungle: 'forest', snow: 'snow', badlands: 'desert', volcanic: 'volcanic', dusk: 'forest', crystal: 'crystal' })[z.biome] || 'plains';
    const citadel = 'citadel_environment_' + id;
    if (IMG[citadel]) return citadel;
  }
  if (!artOn() || !NES.battlebg || !NES.battlebg.length) return null;
  const z = ZONE_BY_ID[G && G.map];
  let i = 0;
  if (kind === 'dungeon' || kind === 'tower' || kind === 'trial' || (G && G.inst && G.inst.kind !== 'raid')) i = 3;
  else if (kind === 'raid' || kind === 'arena' || (z && z.town)) i = 4;
  else if (z) i = { meadow: 0, coast: 0, marsh: 1, jungle: 1, snow: 2, badlands: 2, volcanic: 2, dusk: 1, crystal: 2 }[z.biome] || 0;
  return NES.battlebg[Math.min(NES.battlebg.length - 1, i)];
}
const mountArt = () => { const m = typeof curMount === 'function' ? curMount() : null; if (S.art === 'packs' && m) { const pack = window.GBQAssetPack && window.GBQAssetPack.apAsset('mounts', hashStr(String(m.id)) % 22); if (pack && IMG[pack]) return pack; } if (m && IMG['mt_' + m.id]) return 'mt_' + m.id; return artOn() && NES.mount && NES.mount.length ? NES.mount[0] : null; };
