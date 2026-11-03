'use strict';
// ================================================================ CODEX OF ASPECTS (data)
// Every family of legendary power found in modern action RPGs, rebuilt for this game with original names and our own
// conditions, elements and buffs. Each aspect is a small effect spec that src/d4_gear.js runs in battle:
//   t: 'dmg'   outgoing damage +v% when a condition holds         (when: lowhp, fullhp, elite, crowd, crit, first, selfhigh,
//                                                                   selflow, phys, spell, el:<type>, cond:<debuff>, buff:<buff>)
//   t: 'proc'  on hit, chance% to: apply a debuff, add bonus elemental damage, chain to another foe, heal, barrier, buff
//   t: 'kill'  on kill: explode, buff, heal or barrier
//   t: 'start' at battle start: buff for v rounds, or a barrier of v% max HP
//   t: 'hit'   when struck: reduce damage (when: lowhp, elite, barrier, el:<type>), reflect, or afflict the attacker
//   t: 'stat'  passive substats scaled by v
// kind: which gear can hold it (weapon, armor, wondrous, any). cat: OFFENSIVE, DEFENSIVE, UTILITY, MOBILITY, RESOURCE.

const ASPECT_SPECS = (() => {
  const S = {};
  const add = (id, name, kind, cat, lo, hi, e) => { S[id] = { name, kind, cat, lo, hi, e }; };
  // ---- the original sixteen (kept so existing items and codexes keep working)
  add('executioner', 'EXECUTIONER', 'weapon', 'OFFENSIVE', 25, 60, { t: 'dmg', when: 'lowhp' });
  add('firststrike', 'FIRST STRIKE', 'weapon', 'OFFENSIVE', 30, 80, { t: 'dmg', when: 'fullhp' });
  add('slayer', 'ELITE SLAYER', 'any', 'OFFENSIVE', 15, 40, { t: 'dmg', when: 'elite' });
  add('stormshard', 'STORMSHARD', 'weapon', 'OFFENSIVE', 20, 50, { t: 'proc', p: 20, act: { chain: 'lightning' } });
  add('glacial', 'GLACIAL', 'weapon', 'OFFENSIVE', 15, 35, { t: 'proc', pv: true, act: { cond: 'frostbite', rounds: 2 } });
  add('bloodletter', 'BLOODLETTER', 'weapon', 'OFFENSIVE', 15, 40, { t: 'proc', pv: true, act: { cond: 'bleeding', rounds: 3 } });
  add('vampiric', 'VAMPIRIC', 'any', 'RESOURCE', 3, 8, { t: 'proc', p: 15, act: { heal: true } });
  add('corpseburst', 'CORPSEBURST', 'any', 'OFFENSIVE', 15, 40, { t: 'kill', act: { explode: 'necrotic' } });
  add('bloodlust', 'BLOODLUST', 'any', 'OFFENSIVE', 2, 4, { t: 'kill', act: { buff: 'might' } });
  add('bulwark', 'BULWARK', 'armor', 'DEFENSIVE', 10, 25, { t: 'start', act: { barrier: true } });
  add('unbroken', 'UNBROKEN', 'armor', 'DEFENSIVE', 10, 25, { t: 'hit', act: { reduce: true, when: 'lowhp' } });
  add('brambles', 'BRAMBLES', 'armor', 'DEFENSIVE', 10, 30, { t: 'hit', act: { reflect: true } });
  add('windstrike', 'WINDSTRIKE', 'wondrous', 'MOBILITY', 1, 3, { t: 'start', act: { buff: 'haste' } });
  add('fortune', 'FORTUNE', 'wondrous', 'UTILITY', 15, 40, { t: 'stat', stats: [['gf', 1], ['mf', 1]] });
  add('sage', 'SAGE', 'wondrous', 'RESOURCE', 10, 25, { t: 'stat', stats: [['heal', 1], ['fire', 1], ['lightning', 1], ['cold', 1], ['necrotic', 1]] });
  add('warlord', 'WARLORD', 'any', 'OFFENSIVE', 1, 3, { t: 'stat', stats: [['hit', 1], ['crit', 2]] });
  // ---- elements: brand (+damage of that element), fang (on-hit bonus damage), burst (kill explosion), arc (chain)
  const EL = { fire: 'EMBER', cold: 'RIME', lightning: 'STORM', necrotic: 'GRAVE', radiant: 'DAWN', poison: 'VENOM', slashing: 'STEEL', force: 'ARCANE', thunder: 'THUNDER', acid: 'CAUSTIC' };
  for (const [el, w] of Object.entries(EL)) {
    add(`brand_${el}`, `${w} BRAND`, 'weapon', 'OFFENSIVE', 15, 45, { t: 'dmg', when: `el:${el}` });
    add(`fang_${el}`, `${w}FANG`, 'weapon', 'OFFENSIVE', 15, 40, { t: 'proc', p: 30, act: { bonus: el } });
    add(`burst_${el}`, `${w}BURST`, 'any', 'OFFENSIVE', 10, 35, { t: 'kill', act: { explode: el } });
    add(`arc_${el}`, `${w} ARC`, 'weapon', 'OFFENSIVE', 20, 50, { t: 'proc', p: 18, act: { chain: el } });
    add(`ward_${el}`, `${w}WARD`, 'armor', 'DEFENSIVE', 15, 40, { t: 'hit', act: { reduce: true, when: `el:${el}` } });
  }
  // ---- debuffs: inflict on hit, exploit for damage, curse attackers
  const CD = { frostbite: 'FROSTBITTEN', bleeding: 'BLEEDING', burning: 'BURNING', venom: 'ENVENOMED', shocked: 'SHOCKED', weakened: 'WEAKENED', vulnerable: 'VULNERABLE', sundered: 'SUNDERED', slowed: 'SLOWED', doomed: 'DOOMED', frightened: 'FRIGHTENED', stunned: 'STUNNED' };
  const CN = { frostbite: 'FROSTBITE', bleeding: 'HEMORRHAGE', burning: 'KINDLING', venom: 'TOXIN', shocked: 'SPARKCALL', weakened: 'ENFEEBLING', vulnerable: 'EXPOSURE', sundered: 'SUNDERING', slowed: 'MIRE', doomed: 'DOOMSAYER', frightened: 'DREAD', stunned: 'CONCUSSION' };
  for (const [c, nm] of Object.entries(CN)) {
    add(`inflict_${c}`, nm, 'weapon', 'OFFENSIVE', 10, 30, { t: 'proc', pv: true, act: { cond: c, rounds: c === 'stunned' || c === 'frightened' ? 1 : 3 } });
    add(`exploit_${c}`, `${nm} HUNTER`, 'any', 'OFFENSIVE', 15, 45, { t: 'dmg', when: `cond:${c}` });
    if (['frostbite', 'weakened', 'slowed', 'burning', 'venom', 'shocked'].includes(c)) add(`retort_${c}`, `${nm} SHELL`, 'armor', 'DEFENSIVE', 15, 40, { t: 'hit', act: { curse: c } });
  }
  // ---- buffs: gain on kill, open battles with, fight harder while holding
  const BF = { haste: 'TAILWIND', might: 'BERSERK', focus: 'HAWKEYE', fortify: 'BASTION', regen: 'MENDING', bless: 'BLESSING', thornskin: 'THORNHIDE', inspired: 'RALLY', frenzy: 'FRENZY' };
  for (const [b, nm] of Object.entries(BF)) {
    add(`killbuff_${b}`, `${nm} REAPER`, 'any', 'OFFENSIVE', 2, 4, { t: 'kill', act: { buff: b } });
    add(`startbuff_${b}`, `${nm} HERALD`, 'wondrous', 'MOBILITY', 1, 3, { t: 'start', act: { buff: b } });
    add(`whilebuff_${b}`, `${nm} FURY`, 'any', 'OFFENSIVE', 15, 40, { t: 'dmg', when: `buff:${b}` });
    add(`procbuff_${b}`, `${nm} SURGE`, 'weapon', 'OFFENSIVE', 8, 20, { t: 'proc', pv: true, act: { buff: b, rounds: 2 } });
  }
  // ---- conditions on the fight itself
  add('crowd', 'WARBAND BREAKER', 'any', 'OFFENSIVE', 15, 40, { t: 'dmg', when: 'crowd' });
  add('critmaw', 'RAZOR MAW', 'weapon', 'OFFENSIVE', 20, 60, { t: 'dmg', when: 'crit' });
  add('opener', 'AMBUSHER', 'weapon', 'OFFENSIVE', 40, 100, { t: 'dmg', when: 'first' });
  add('sanguine', 'SANGUINE MIGHT', 'any', 'OFFENSIVE', 15, 40, { t: 'dmg', when: 'selfhigh' });
  add('desperate', 'LAST STAND', 'any', 'OFFENSIVE', 25, 70, { t: 'dmg', when: 'selflow' });
  add('brawler', 'IRONFIST', 'weapon', 'OFFENSIVE', 15, 40, { t: 'dmg', when: 'phys' });
  add('arcanist', 'SPELLWEAVER', 'any', 'OFFENSIVE', 15, 40, { t: 'dmg', when: 'spell' });
  // ---- defence
  add('eliteguard', 'GIANTSBANE GUARD', 'armor', 'DEFENSIVE', 10, 30, { t: 'hit', act: { reduce: true, when: 'elite' } });
  add('shieldwall', 'SHIELDWALL', 'armor', 'DEFENSIVE', 15, 35, { t: 'hit', act: { reduce: true, when: 'barrier' } });
  add('stoneskin', 'STONESKIN', 'armor', 'DEFENSIVE', 5, 15, { t: 'hit', act: { reduce: true, when: 'always' } });
  add('aegis', 'AEGIS', 'armor', 'DEFENSIVE', 3, 8, { t: 'proc', p: 25, act: { barrier: true } });
  add('lifeward', 'LIFEWARD', 'armor', 'DEFENSIVE', 15, 35, { t: 'start', act: { barrier: true } });
  add('spined', 'SPINED CARAPACE', 'armor', 'DEFENSIVE', 20, 50, { t: 'hit', act: { reflect: true } });
  add('graveheal', 'GRAVE FEAST', 'any', 'RESOURCE', 4, 12, { t: 'kill', act: { heal: true } });
  add('soulshield', 'SOUL SHIELD', 'any', 'DEFENSIVE', 5, 15, { t: 'kill', act: { barrier: true } });
  add('leechlord', 'LEECHLORD', 'weapon', 'RESOURCE', 2, 6, { t: 'proc', p: 25, act: { heal: true } });
  // ---- passive stat aspects (UTILITY and RESOURCE)
  const ST = [['treasure', 'TREASURE SEEKER', [['mf', 1]], 20, 60], ['goldtooth', 'GOLDTOOTH', [['gf', 1]], 20, 60], ['scholar', 'SCHOLAR', [['xp', 1]], 8, 25], ['healer', 'LIFEBINDER', [['heal', 1]], 15, 40],
    ['leech', 'BLOODTHIRST', [['leech', 0.2]], 5, 15], ['keen', 'KEEN EDGE', [['crit', 0.3]], 10, 25], ['savage', 'SAVAGE EDGE', [['critdmg', 1]], 20, 60], ['sure', 'SUREHAND', [['hit', 0.15]], 10, 25],
    ['quick', 'QUICKSILVER', [['haste', 0.5]], 10, 30], ['guard', 'GUARDIAN', [['block', 0.3]], 10, 30], ['evasion', 'SHADOWSTEP', [['dodge', 0.3]], 10, 30], ['titan', 'TITAN', [['hp', 4]], 10, 40],
    ['plate', 'PLATEBOUND', [['acb', 0.1]], 10, 30], ['warded', 'WARDED', [['resist', 0.3]], 10, 30], ['thorned', 'THORNED', [['thorns', 1]], 5, 25], ['power', 'OVERPOWER', [['dmg', 0.5]], 10, 40]];
  for (const [id, name, stats, lo, hi] of ST) add(id, name, ['hp', 'acb', 'resist', 'block', 'thorns'].includes(stats[0][0]) ? 'armor' : ['mf', 'gf', 'xp', 'heal', 'haste', 'dodge'].includes(stats[0][0]) ? 'wondrous' : 'any', ['mf', 'gf', 'xp'].includes(stats[0][0]) ? 'UTILITY' : 'RESOURCE', lo, hi, { t: 'stat', stats });
  return S;
})();
