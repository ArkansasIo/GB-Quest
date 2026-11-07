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
const monsterArt = b => {
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
function tierPick(cat, rarity, salt) { const L = NES[cat] || []; if (!L.length) return null; const i = Math.min(L.length - 1, Math.max(0, rarity * 2 - 1 + (hashStr(String(salt)) % 2))); return L[i]; }
function nesItemIcon(it) {
  if (!artOn()) return null;
  if (it.kind === 'weapon') return tierPick(WEAPON_ART[it.base] || 'sword', it.rarity, it.base);
  if (it.kind === 'armor') { const t = ARMORS[it.base].type; return tierPick(t === 'shield' ? 'shield' : t + 'armor', it.rarity, it.base); }
  return tierPick(WONDROUS_ART[it.base] || 'ring', it.rarity, it.base);
}
const ITEM_ART = { potion: ['potion', 0], greater: ['potion', 1], superior: ['potion', 3], supreme: ['potion', 5], ether: ['potion', 2], antitoxin: ['potion', 4], might: ['potion', 7],
  ration: ['food', 0], grilled: ['food', 4], feast: ['food', 6], campkit: ['tool', 3], scroll_flame: ['scroll', 1], scroll_mend: ['scroll', 2], scroll_dawn: ['scroll', 5],
  hearthstone: ['magicitem', 2], peacebloom: ['reagent', 0], sandroot: ['reagent', 3], frostbloom: ['reagent', 5], small_fish: ['food', 9], big_fish: ['food', 10], eel: ['food', 11],
  goblin_token: ['currency', 2], old_bone: ['misc', 3], slimegel: ['reagent', 7], gold_dust: ['currency', 5], coinpurse: ['treasure2', 2], idol_shard: ['gem', 3],
  codex_page: ['tome', 3], tower_key: ['key', 4], old_boot: ['boots', 0] };
for (const k in ITEMS) ITEMS[k].icon0 = ITEMS[k].icon;
function applyArt() {
  for (const k in ITEMS) { const a = ITEM_ART[k]; const L = a && NES[a[0]]; ITEMS[k].icon = artOn() && L && L.length ? L[Math.min(L.length - 1, a[1])] : ITEMS[k].icon0; }
}
applyArt();

// spells: one icon per school/damage type, used as the battle effect
const SPELL_ART = { fire: 0, cold: 1, lightning: 2, poison: 3, necrotic: 4, radiant: 5, force: 6, psychic: 7, thunder: 2, acid: 3, piercing: 8, bludgeoning: 9, slashing: 9 };
const SCHOOL_ART = { aegis: 10, calling: 11, omen: 12, thrall: 13, veil: 14, flux: 15, grave: 4, storm: 0 };
function spellArt(sp) {
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
