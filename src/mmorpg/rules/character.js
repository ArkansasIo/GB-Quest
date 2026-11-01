import { abilityModifier, proficiencyBonus } from "./d20.js";
export const ABILITY_KEYS = Object.freeze(["str","dex","con","int","wis","cha"]);
export function createCharacter({ id, name, species, classId, background="wanderer", abilities, level=1 }) {
  if (!id || !name || !species || !classId) throw new TypeError("Character identity, species and class are required");
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError("D&D level must be 1-20");
  const scores = Object.fromEntries(ABILITY_KEYS.map(k => [k, Number(abilities?.[k] ?? 10)]));
  if (ABILITY_KEYS.some(k => !Number.isInteger(scores[k]) || scores[k] < 1 || scores[k] > 30)) throw new RangeError("Ability scores must be integers from 1 to 30");
  return { id, name, species, classId, background, level, xp: 0, abilities: scores, proficiencyBonus: proficiencyBonus(level),
    hp: 1, maxHp: 1, hitDice: [], deathSaves: { successes: 0, failures: 0 }, inspiration: false,
    proficiencies: { skills: [], saves: [], weapons: [], armor: [], tools: [] }, features: [], resources: {}, conditions: [] };
}
export function deriveCharacterStats(character, classDefinition, conScore=character.abilities.con) {
  const con = abilityModifier(conScore), level=character.level;
  const hitDie=classDefinition.hitDie;
  const maxHp=hitDie + con + Math.max(0,level-1)*Math.max(1,Math.floor(hitDie/2)+1+con);
  return { ...character, maxHp: Math.max(1,maxHp), hp: Math.min(character.hp || maxHp,maxHp),
    proficiencyBonus: proficiencyBonus(level), initiative: abilityModifier(character.abilities.dex),
    passivePerception: 10 + abilityModifier(character.abilities.wis) };
}
export function xpForLevel(level) {
  const table=[0,0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError("Level must be 1-20");
  return table[level];
}
export function levelFromXp(xp) {
  if (!Number.isFinite(xp) || xp < 0) throw new RangeError("XP must be non-negative");
  let level=1; for(let i=2;i<=20;i++) if(xp>=xpForLevel(i)) level=i; else break; return level;
}
