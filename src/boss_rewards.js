'use strict';

// Boss reward tuning shared by loot generation and automated tests.
const BOSS_RUNE_DROP_CHANCE = { world: 0.4, dungeon: 0.5, trial: 0.6, tower: 0.65, arc: 0.75, raid: 0.85 };
const BOSS_RUNE_FAMILIES = {
  world: ['might', 'precision', 'leech'],
  dungeon: ['ward', 'vigor', 'shadow'],
  trial: ['precision', 'vigor', 'shadow'],
  tower: ['ward', 'might', 'leech'],
  arc: ['flame', 'frost', 'storm'],
  raid: ['flame', 'frost', 'storm', 'ward', 'vigor', 'might', 'precision', 'shadow', 'leech'],
};
function rollBossRuneDrops(boss, itemLevel, random = Math.random) {
  if (!boss || !BOSS_RUNE_DROP_CHANCE[boss.cat]) return [];
  const chance = BOSS_RUNE_DROP_CHANCE[boss.cat];
  if (random() >= chance) return [];
  const families = BOSS_RUNE_FAMILIES[boss.cat];
  const tier = Math.max(1, Math.min(9, Math.ceil(Math.max(1, Number(itemLevel) || 1) / 80)));
  const count = (boss.cat === 'raid' || boss.cat === 'arc') && random() < 0.45 ? 2 : 1;
  const out = [];
  for (let i = 0; i < count; i++) out.push(families[Math.floor(random() * families.length)] + '_r' + tier);
  return out;
}
if (typeof globalThis !== 'undefined') globalThis.GBQBossRewards = { BOSS_RUNE_DROP_CHANCE, BOSS_RUNE_FAMILIES, rollBossRuneDrops };
