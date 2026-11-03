'use strict';
// ================================================================ JOBS AND RACES: data
// Eleven new jobs and six new races, original takes on classic MMO archetypes (no borrowed names):
//   RONIN (two-handed blade master), SHINOBI (shadow ninja), BLADEDANCER (healing dancer), WYRMLANCER (leaping lancer
//   with a wyvern), CORSAIR (gunner who rolls party buffs), BEASTCALLER (beast tamer), PUPPETEER (automaton master),
//   DREADKNIGHT (death-touched tank), VOIDHUNTER (glaive-wielding hunter), SCALESAGE (dragon-breath caster/healer)
//   and STORMCALLER (totem shaman).
//   Races: HORNFOLK (horned plains giants), FELINAR (cat-folk), PIPKIN (small spellcasters), LUNARI (moon elves),
//   WOLFKIN (wolf-blooded) and STARKIN (light-touched travellers).
// Loaded right after the core rules so character creation, companions and NPC adventurers all see them.
// Job abilities, the job-change system, support jobs, racial traits and monster jobs live in src/jobs.js.

Object.assign(CLASSES, {
  ronin: { name: 'RONIN', hd: 10, primary: 'STR', saves: ['STR', 'DEX'], armor: ['light', 'medium'], weapons: 'martial', caster: null,
    skills: ['athletics', 'intimidation'], gear: ['widesword', 'scalevest'], role: 'dps',
    features: [[1, 'style_def'], [2, 'surge'], [5, 'extra1'], [11, 'extra2']],
    subs: [{ id: 'kensai', name: 'KENSAI', keys: { critRange: 1 }, desc: 'Crit on 19-20.' }, { id: 'iaido', name: 'IAIDO', keys: { maneuver: 1 }, desc: '+1d8 on first hit each turn (4/rest).' }],
    desc: 'Wandering blade masters. Meditate, then cut with a single perfect stroke.' },
  shinobi: { name: 'SHINOBI', hd: 8, primary: 'DEX', saves: ['DEX', 'INT'], armor: ['light'], weapons: 'finesse', caster: null,
    skills: ['stealth', 'acrobatics', 'sleight'], expertise: ['stealth'], gear: ['needleblade', 'quilted'], role: 'dps',
    features: [[1, 'cunning'], [5, 'extra1']],
    subs: [{ id: 'kage', name: 'KAGE', keys: { shadowstart: 1 }, desc: 'Start every battle invisible.' }, { id: 'yamikiri', name: 'YAMIKIRI', keys: { assassinate: 1 }, desc: 'Strike hard before foes act.' }],
    desc: 'Shadow warriors. Paper-image decoys and spinning shuriken.' },
  bladedancer: { name: 'BLADEDANCER', hd: 8, primary: 'DEX', saves: ['DEX', 'CHA'], armor: ['light'], weapons: 'finesse', caster: null,
    skills: ['performance', 'acrobatics', 'persuasion'], gear: ['knife', 'quilted'], role: 'healer',
    features: [[1, 'cunning'], [5, 'extra1']],
    subs: [{ id: 'veil', name: 'VEIL DANCER', keys: { ward: 1 }, desc: 'Start battles with a ward.' }, { id: 'edge', name: 'EDGE DANCER', keys: { critRange: 1 }, desc: 'Crit on 19-20.' }],
    desc: 'Dancers whose steps heal friends and unbalance foes.' },
  wyrmlancer: { name: 'WYRMLANCER', hd: 10, primary: 'STR', saves: ['STR', 'CON'], armor: ['light', 'medium', 'heavy'], weapons: 'martial', caster: null,
    skills: ['athletics', 'animal'], gear: ['poleblade', 'chainhauberk'], role: 'dps',
    features: [[1, 'style_def'], [5, 'extra1'], [9, 'indomitable']],
    subs: [{ id: 'skyleap', name: 'SKYLEAP', keys: { critRange: 1 }, desc: 'Crit on 19-20.' }, { id: 'wyrmbond', name: 'WYRMBOND', keys: { wolf: 1 }, desc: 'A wyvern hatchling fights beside you.' }],
    desc: 'Lancers who leap from the sky with a wyvern at their side.' },
  corsair: { name: 'CORSAIR', hd: 8, primary: 'DEX', saves: ['DEX', 'CHA'], armor: ['light'], weapons: 'martial', caster: null,
    skills: ['deception', 'acrobatics', 'perception'], gear: ['boltcaster', 'quilted'], role: 'dps',
    features: [[1, 'style_arch'], [5, 'extra1']],
    subs: [{ id: 'fortune', name: 'FORTUNE', keys: { critRange: 1 }, desc: 'Crit on 19-20.' }, { id: 'quickdraw', name: 'QUICKDRAW', keys: { maneuver: 1 }, desc: '+1d8 on first hit each turn (4/rest).' }],
    desc: 'Lucky gunners. Phantom dice for the party, elemental shots for foes.' },
  beastcaller: { name: 'BEASTCALLER', hd: 10, primary: 'CHA', saves: ['STR', 'CHA'], armor: ['light', 'medium', 'shield'], weapons: 'martial', caster: null,
    skills: ['animal', 'survival'], gear: ['hatchet', 'hidecoat', 'buckler'], role: 'tank',
    features: [[1, 'style_def'], [5, 'extra1']],
    subs: [{ id: 'packlord', name: 'PACKLORD', keys: { wolf: 1 }, desc: 'A wolf joins every battle.' }, { id: 'feral', name: 'FERAL', keys: { frenzy: 1 }, desc: 'Fight like a beast: an extra attack in a frenzy.' }],
    desc: 'Tamers who fight with the wild at their back.' },
  puppeteer: { name: 'PUPPETEER', hd: 8, primary: 'INT', saves: ['DEX', 'INT'], armor: ['light'], weapons: 'simple', caster: null,
    skills: ['arcana', 'sleight'], gear: ['cudgel', 'quilted'], role: 'tank',
    features: [[1, 'reliable'], [5, 'extra1']],
    subs: [{ id: 'valoredge', name: 'VALOREDGE', keys: { ward: 1 }, desc: 'Start battles with a ward.' }, { id: 'sharpshot', name: 'SHARPSHOT FRAME', keys: { critRange: 1 }, desc: 'Crit on 19-20.' }],
    desc: 'Engineers with a clockwork automaton that shields and strikes.' },
  dreadknight: { name: 'DREADKNIGHT', hd: 10, primary: 'STR', saves: ['STR', 'CON'], armor: ['light', 'medium', 'heavy'], weapons: 'martial', caster: 'half', cast: 'INT',
    skills: ['athletics', 'intimidation'], gear: ['widesword', 'chainhauberk'], role: 'tank',
    features: [[1, 'style_def'], [2, 'secondwind'], [5, 'extra1']],
    subs: [{ id: 'bloodoath', name: 'BLOOD OATH', keys: { vow: 1 }, desc: 'Vow of enmity against one foe.' }, { id: 'frostgrave', name: 'FROSTGRAVE', keys: { totem: 1 }, desc: 'Resist all damage while raging.' }],
    desc: 'Knights who returned from the grave. They steal life and hold foes in place.' },
  voidhunter: { name: 'VOIDHUNTER', hd: 10, primary: 'DEX', saves: ['DEX', 'CON'], armor: ['light', 'medium'], weapons: 'martial', caster: null,
    skills: ['perception', 'acrobatics', 'intimidation'], gear: ['crescent', 'scalevest'], role: 'dps',
    features: [[1, 'style_def'], [5, 'extra1'], [11, 'extra2']],
    subs: [{ id: 'havoc', name: 'HAVOC', keys: { frenzy: 1 }, desc: 'An extra attack in a frenzy.' }, { id: 'vengeance', name: 'VENGEANCE', keys: { totem: 1 }, desc: 'Resist all damage while raging.' }],
    desc: 'Blindfolded hunters who sacrificed their sight to see the void.' },
  scalesage: { name: 'SCALESAGE', hd: 8, primary: 'INT', saves: ['INT', 'CHA'], armor: ['light'], weapons: 'simple', caster: 'full', cast: 'INT',
    skills: ['arcana', 'medicine'], gear: ['walkstaff', 'quilted'], role: 'healer', features: [[1, 'recovery']],
    subs: [{ id: 'devastation', name: 'DEVASTATION', keys: { evoker: 1 }, desc: 'Spell damage adds your INT.' }, { id: 'preservation', name: 'PRESERVATION', keys: { lifedomain: 1 }, desc: 'Healing spells heal more.' }],
    desc: 'Dragon-blooded sages. Breath of fire for foes, emerald light for friends.' },
  stormcaller: { name: 'STORMCALLER', hd: 8, primary: 'WIS', saves: ['WIS', 'CHA'], armor: ['light', 'medium', 'shield'], weapons: 'simple', caster: 'half', cast: 'WIS',
    skills: ['nature', 'medicine'], gear: ['knobmace', 'scalevest', 'buckler'], role: 'healer', features: [[1, 'layhands'], [5, 'extra1']],
    subs: [{ id: 'thunder', name: 'THUNDER', keys: { tempest: 1 }, desc: 'Lightning and thunder hit harder.' }, { id: 'tides', name: 'TIDES', keys: { lifedomain: 1 }, desc: 'Healing spells heal more.' }],
    desc: 'Shamans who plant totems and call the storm.' },
});
CLASS_ORDER.push('ronin', 'shinobi', 'bladedancer', 'wyrmlancer', 'corsair', 'beastcaller', 'puppeteer', 'dreadknight', 'voidhunter', 'scalesage', 'stormcaller');

Object.assign(SPECIES, {
  hornfolk: { name: 'HORNFOLK', asi: { STR: 2, CON: 1 }, traits: ['stalwart', 'warstomp'], desc: 'Horned giants of the plains. Extra health; WAR STOMP stuns foes once a battle.' },
  felinar: { name: 'FELINAR', asi: { DEX: 2, WIS: 1 }, traits: ['keen', 'nimble'], desc: 'Swift cat-folk. Keen senses and +5% dodge.' },
  pipkin: { name: 'PIPKIN', asi: { INT: 2, DEX: 1 }, traits: ['cunning', 'spellspark'], desc: 'Small, bright spellcasters. +10% elemental damage; resist magic.' },
  lunari: { name: 'LUNARI', asi: { DEX: 2, INT: 1 }, traits: ['feyblood', 'shadowmeld'], desc: 'Moon elves. Begin battles hidden; resist charm and sleep.' },
  wolfkin: { name: 'WOLFKIN', asi: { STR: 2, DEX: 1 }, traits: ['feral'], desc: 'Wolf-blooded hunters. +4% crit chance and +15% crit damage.' },
  starkin: { name: 'STARKIN', asi: { WIS: 2, CHA: 1 }, traits: ['lightsgift'], res: ['radiant'], desc: 'Light-touched travellers. +15% healing; GIFT OF LIGHT heals once a battle.' },
});

// spells for the new casters
{
  const give = (cls, ids) => { for (const id of ids) { const s = SPELLS.find(x => x.id === id); if (s && !s.cls.includes(cls)) s.cls.push(cls); } };
  give('scalesage', ['emberdart', 'sparklife', 'flamefan', 'mend', 'quickmend', 'rays', 'sunorb', 'chorus', 'greatchorus', 'greatmend', 'starshard', 'renewal', 'skyfall', 'worldsong', 'wardspark', 'barkskin', 'bastion']);
  give('stormcaller', ['sparklife', 'thunderwave', 'mend', 'bless', 'barkskin', 'lance', 'calllightning', 'chorus', 'stormchain', 'greatmend']);
  give('dreadknight', ['gravechill', 'lifetap', 'forceward', 'wither']);
}
// class skills, passives and talent access for the new jobs
{
  const MARTIAL = ['ronin', 'shinobi', 'bladedancer', 'wyrmlancer', 'corsair', 'beastcaller', 'puppeteer', 'dreadknight', 'voidhunter'];
  const add = (list, ids, who) => { for (const def of list) if (ids.includes(def.id)) for (const c of who) if (!def.classes.includes(c)) def.classes.push(c); };
  add(ACTIVE_SKILLS, ['power_strike'], MARTIAL); add(ACTIVE_SKILLS, ['rally'], ['wyrmlancer', 'beastcaller', 'dreadknight', 'corsair', 'stormcaller']);
  add(ACTIVE_SKILLS, ['shadowstep'], ['shinobi', 'bladedancer', 'voidhunter']); add(ACTIVE_SKILLS, ['field_mend'], ['bladedancer', 'scalesage', 'stormcaller']);
  add(ACTIVE_SKILLS, ['arcane_burst', 'warding_aura'], ['scalesage', 'puppeteer']);
  add(PASSIVE_SKILLS, ['vitality'], ['wyrmlancer', 'beastcaller', 'dreadknight', 'puppeteer', 'stormcaller']);
  add(PASSIVE_SKILLS, ['precision'], ['ronin', 'corsair', 'voidhunter', 'shinobi']); add(PASSIVE_SKILLS, ['ferocity'], ['ronin', 'voidhunter', 'dreadknight']);
  add(PASSIVE_SKILLS, ['swift'], ['shinobi', 'bladedancer', 'corsair']); add(PASSIVE_SKILLS, ['arcane_focus'], ['scalesage', 'stormcaller', 'puppeteer']);
}
// character creation shows the class grid 9 to a row (27 classes, 3 rows)
const CLASS_COLS = 9;
