/** Minimal d20 rules primitives. Original implementation; extend against permitted SRD references. */
export const ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

export function abilityModifier(score) {
  if (!Number.isFinite(score)) throw new TypeError("Ability score must be finite");
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new RangeError("Level must be an integer from 1 to 20");
  }
  return 2 + Math.floor((level - 1) / 4);
}

export function rollD20(random = Math.random) {
  const value = random();
  if (!(value >= 0 && value < 1)) throw new RangeError("Random source must return [0, 1)");
  return 1 + Math.floor(value * 20);
}

export function rollCheck({ ability, score, proficient = false, level = 1, bonus = 0, advantage = 0 }, random = Math.random) {
  if (!ABILITIES.includes(ability)) throw new RangeError("Unknown ability");
  const a = rollD20(random);
  const b = advantage === 0 ? null : rollD20(random);
  const die = b === null ? a : advantage > 0 ? Math.max(a, b) : Math.min(a, b);
  return {
    die,
    rolls: b === null ? [a] : [a, b],
    modifier: abilityModifier(score) + (proficient ? proficiencyBonus(level) : 0) + bonus,
    total: die + abilityModifier(score) + (proficient ? proficiencyBonus(level) : 0) + bonus
  };
}

export function meetsTarget(total, target) {
  return total >= target;
}
