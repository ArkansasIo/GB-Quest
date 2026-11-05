'use strict';
// HD64 game-wide asset routing. The atlas indexes in assets_hd64 are authoritative;
// engine.js preloads every referenced atlas page before this adapter is applied.
(function (root) {
  const EQUIPMENT_CATEGORIES = [
    'sword','dagger','axe','mace','polearm','bow','crossbow','staff','wand',
    'lightarmor','mediumarmor','heavyarmor','shield','ring','amulet','belt','glove','boots',
    'potion','scroll','food','tome','magicitem','tool','light','key','treasure2','misc',
    'ore','gem','leather','wood','reagent','mount','vehicle','relic','artifact','questitem',
    'banner','instrument','currency','m_dragon','m_undead','m_beast','m_fiend','m_elemental',
    'm_aberration','m_giant','m_fey','m_humanoid','m_ooze','c_hero','c_townsfolk','c_merchant',
    'c_noble','c_guard','c_special','buff','status2'
  ];
  const MONSTER_PREFIXES = {
    dragon:['nm_dragon','nm_monster'], fiend:['nm_demon','nm_fiend','nm_monster'],
    undead:['nm_undead','nm_monster'], beast:['nm_beast','nm_monster'],
    elemental:['nm_elemental','nm_monster'], humanoid:['nm_humanoid','nm_strong','nm_monster'],
    construct:['nm_armor','nm_strong','nm_monster'], giant:['nm_strong','nm_beast','nm_monster'],
    ooze:['nm_slime','nm_monster'], aberration:['nm_monster'], monstrosity:['nm_beast','nm_monster'],
    plant:['nm_plant','nm_monster'], fey:['nm_town','nm_monster'], celestial:['nm_monster']
  };
  const hash = value => { let h=2166136261; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; };
  const sorted = list => list.slice().sort((a,b) => {
    const ai=Number((a.match(/_(\\d+)$/)||[])[1]||0), bi=Number((b.match(/_(\\d+)$/)||[])[1]||0);
    return ai-bi || a.localeCompare(b);
  });
  function apply() {
    const indexes = root.GBQ_HD64_INDEXES || {};
    const equipment = indexes.equipment || {};
    let equipmentMapped = 0;
    if (typeof NES !== 'undefined') {
      for (const category of EQUIPMENT_CATEGORIES) {
        const prefix = 'ne_' + category + '_';
        const names = sorted(Object.keys(equipment).filter(name => name.startsWith(prefix)));
        if (names.length) { NES[category] = names; equipmentMapped += names.length; }
      }
      if (typeof applyArt === 'function') applyArt();
    }
    let monstersMapped = 0;
    const monsterIndex = indexes.monsters || {};
    if (typeof BESTIARY !== 'undefined') {
      for (const creature of BESTIARY) {
        if (!creature || creature.ccArt) continue;
        const prefixes = MONSTER_PREFIXES[creature.fam] || ['nm_monster'];
        const pool = prefixes.flatMap(prefix => Object.keys(monsterIndex).filter(name => name.startsWith(prefix + '_')));
        if (!pool.length) continue;
        creature.nspr = sorted(pool)[hash((creature.sub || '') + '|' + (creature.variant || '') + '|' + creature.fam) % pool.length];
        monstersMapped++;
      }
    }
    const library = {
      families: Object.keys(indexes),
      spriteCount: Object.values(indexes).reduce((sum, family) => sum + Object.keys(family || {}).length, 0),
      keys(family) { return Object.keys(indexes[family] || {}); },
      resolve(name) {
        for (const [family, entries] of Object.entries(indexes)) {
          const rect = entries && entries[name];
          if (rect) return { name, family, page: rect[0], x: rect[1], y: rect[2], width: rect[3], height: rect[4], atlas: 'assets_hd64/' + family + '_' + rect[0] + '.png' };
        }
        return null;
      }
    };
    root.GBQ_HD64_ASSET_LIBRARY = library;
    root.GBQ_HD64_ART_APPLIED = { equipmentMapped, monstersMapped, spriteCount: library.spriteCount, families: library.families.length };
    return root.GBQ_HD64_ART_APPLIED;
  }
  root.GBQ_HD64_APPLY_ART = apply;
  if (typeof module !== 'undefined' && module.exports) module.exports = { EQUIPMENT_CATEGORIES, MONSTER_PREFIXES, apply };
})(typeof window !== 'undefined' ? window : globalThis);
