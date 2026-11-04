/**
 * Lost Kingdom of Shadowbane Chronicles hybrid progression.
 * D20 class/rules progression is capped at level 20; MMORPG Paragon ranks continue to 720.
 * Paragon ranks grant horizontal progression (mastery, collection, cosmetics, crafting),
 * not unlimited attack bonuses or ability-score inflation.
 */
export const D20_CLASS_LEVEL_CAP = 20;
export const PARAGON_LEVEL_CAP = 720;

export const D20_XP_THRESHOLDS = Object.freeze([
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
  305000, 355000
]);

export function xpForLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > PARAGON_LEVEL_CAP) {
    throw new RangeError("Level must be an integer from 1 to 720");
  }
  if (level <= D20_CLASS_LEVEL_CAP) return D20_XP_THRESHOLDS[level - 1];
  const n = level - D20_CLASS_LEVEL_CAP;
  // Smooth prestige curve after the level-20 D20 chassis cap.
  return D20_XP_THRESHOLDS[19] + (25000 * n) + (250 * n * n);
}

export function progressionAt(level) {
  const xp = xpForLevel(level);
  const nextXp = level === PARAGON_LEVEL_CAP ? null : xpForLevel(level + 1);
  const tier = level <= 20 ? "adventurer" : Math.ceil((level - 20) / 20);
  const bracket = level <= 20 ? "D20" : `Paragon ${Math.ceil((level - 20) / 20)}`;
  return {
    level,
    xp,
    nextXp,
    xpToNext: nextXp === null ? 0 : nextXp - xp,
    classLevel: Math.min(level, D20_CLASS_LEVEL_CAP),
    paragonLevel: Math.max(0, level - D20_CLASS_LEVEL_CAP),
    tier,
    bracket,
    isMaxLevel: level === PARAGON_LEVEL_CAP
  };
}

export function levelFromXp(totalXp) {
  if (!Number.isFinite(totalXp) || totalXp < 0) throw new RangeError("XP must be a non-negative number");
  let low = 1, high = PARAGON_LEVEL_CAP;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (xpForLevel(mid) <= totalXp) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function paragonRewardTrack(level) {
  const p = progressionAt(level);
  if (p.paragonLevel === 0) return [];
  const rewards = [];
  if (p.paragonLevel % 5 === 0) rewards.push("mastery_point");
  if (p.paragonLevel % 10 === 0) rewards.push("cosmetic_or_title");
  if (p.paragonLevel % 20 === 0) rewards.push("specialization_perk_choice");
  if (p.paragonLevel % 50 === 0) rewards.push("world_renown_milestone");
  return rewards;
}
