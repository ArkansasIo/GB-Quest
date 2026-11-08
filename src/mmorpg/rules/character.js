import speciesCatalog from "../data/species.json" with { type: "json" };
import classCatalog from "../data/classes.json" with { type: "json" };
import skillCatalog from "../data/skills.json" with { type: "json" };
import { abilityModifier, proficiencyBonus } from "./d20.js";
import { applyBackground, BACKGROUND_CATALOG } from "../systems/backgrounds.js";
export const ABILITY_KEYS = Object.freeze(["str","dex","con","int","wis","cha"]);
export const STANDARD_ARRAY = Object.freeze([15,14,13,12,10,8]);
export const POINT_BUY_COSTS = Object.freeze({8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9});
export const SKILLS = Object.freeze(Object.fromEntries(skillCatalog.skills.map(skill => [skill.id, skill.ability])));
const speciesById = new Map(speciesCatalog.species.map(entry => [entry.id, entry]));
const classesById = new Map(classCatalog.classes.map(entry => [entry.id, entry]));

function normalizeAbilityScores(abilities) {
  const scores = Object.fromEntries(ABILITY_KEYS.map(key => [key, Number(abilities?.[key] ?? 10)]));
  if (ABILITY_KEYS.some(key => !Number.isInteger(scores[key]) || scores[key] < 1 || scores[key] > 30)) {
    throw new RangeError("Ability scores must be integers from 1 to 30");
  }
  return scores;
}

export function assignStandardArray(assignment) {
  if (!assignment || typeof assignment !== "object" || ABILITY_KEYS.some(key => !Object.hasOwn(assignment, key))) {
    throw new TypeError("Standard-array assignment must specify all six abilities");
  }
  const scores = normalizeAbilityScores(assignment);
  if (STANDARD_ARRAY.some(score => !Object.values(scores).includes(score)) ||
      new Set(Object.values(scores)).size !== STANDARD_ARRAY.length) {
    throw new RangeError("Standard-array scores must use 15, 14, 13, 12, 10 and 8 exactly once");
  }
  return scores;
}

export function pointBuyCost(abilities) {
  const scores = normalizeAbilityScores(abilities);
  if (ABILITY_KEYS.some(key => scores[key] < 8 || scores[key] > 15)) {
    throw new RangeError("Point-buy ability scores must be from 8 to 15");
  }
  return ABILITY_KEYS.reduce((total, key) => total + POINT_BUY_COSTS[scores[key]], 0);
}

export function createCharacter({
  id, name, species, classId, background="wanderer", abilities, abilityMethod="manual", level=1
}) {
  if (!id || !name || !species || !classId) throw new TypeError("Character identity, species and class are required");
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError("D&D level must be 1-20");
  const speciesDefinition = speciesById.get(species);
  const classDefinition = classesById.get(classId);
  const backgroundDefinition = BACKGROUND_CATALOG.get(background);
  if (!speciesDefinition) throw new RangeError(`Unknown species: ${species}`);
  if (!classDefinition) throw new RangeError(`Unknown class: ${classId}`);
  if (!backgroundDefinition) throw new RangeError(`Unknown background: ${background}`);
  let scores;
  if (abilityMethod === "manual") scores = normalizeAbilityScores(abilities);
  else if (abilityMethod === "standard-array") scores = assignStandardArray(abilities);
  else if (abilityMethod === "point-buy") {
    scores = normalizeAbilityScores(abilities);
    if (pointBuyCost(scores) > 27) throw new RangeError("Point-buy assignment cannot exceed 27 points");
  } else throw new RangeError(`Unknown ability assignment method: ${abilityMethod}`);
  const character = {id,name,species,classId,background,level,xp:0,abilities:scores,
    speciesName:speciesDefinition.name,speciesSizeOptions:[...speciesDefinition.size],speed:speciesDefinition.speed,
    className:classDefinition.name,hitDie:classDefinition.hitDie,primaryAbilities:[...classDefinition.primaryAbilities],
    abilityMethod,proficiencyBonus:proficiencyBonus(level),
    hp:null,maxHp:null,hitDice:[],deathSaves:{successes:0,failures:0},inspiration:false,
    proficiencies:{skills:[],saves:[],weapons:[],armor:[],tools:[]},expertise:[],features:[],resources:{},conditions:[],spellState:null};
  const backgroundResult = applyBackground(character, background);
  if (!backgroundResult.ok) throw new Error(`Could not apply background ${background}: ${backgroundResult.reason}`);
  return character;
}
export function deriveCharacterStats(character,classDefinition=classesById.get(character?.classId),conScore=character.abilities.con){
  if(!classDefinition||![6,8,10,12].includes(classDefinition.hitDie))throw new TypeError("A valid class hit die is required");
  const con=abilityModifier(conScore),level=character.level,die=classDefinition.hitDie;
  const maxHp=Math.max(1,die+con+Math.max(0,level-1)*Math.max(1,Math.floor(die/2)+1+con));
  return {...character,maxHp,hp:character.hp===null||character.hp===undefined?maxHp:Math.min(character.hp,maxHp),
    hitDice:Array.isArray(character.hitDice)&&character.hitDice.length?character.hitDice:[{die,count:level}],
    proficiencyBonus:proficiencyBonus(level),initiative:abilityModifier(character.abilities.dex),
    passivePerception:10+abilityModifier(character.abilities.wis)};
}
export function skillCheck(character,skill,{bonus=0,advantage=0}={},random=Math.random){
  const ability=SKILLS[skill];if(!ability)throw new RangeError("Unknown skill: "+skill);
  const proficient=character.proficiencies.skills.includes(skill),expert=character.expertise.includes(skill);
  const a=1+Math.floor(random()*20),b=advantage===0?null:1+Math.floor(random()*20);
  const die=b===null?a:advantage>0?Math.max(a,b):Math.min(a,b);
  const modifier=abilityModifier(character.abilities[ability])+(proficient?character.proficiencyBonus:0)+(expert?character.proficiencyBonus:0)+bonus;
  return {skill,ability,die,rolls:b===null?[a]:[a,b],modifier,total:die+modifier};
}
export function xpForLevel(level){const t=[0,0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];if(!Number.isInteger(level)||level<1||level>20)throw new RangeError("Level must be 1-20");return t[level];}
export function levelFromXp(xp){if(!Number.isFinite(xp)||xp<0)throw new RangeError("XP must be non-negative");let level=1;for(let i=2;i<=20;i++)if(xp>=xpForLevel(i))level=i;else break;return level;}
