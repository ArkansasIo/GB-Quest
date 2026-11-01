import { abilityModifier, proficiencyBonus } from "./d20.js";
export const ABILITY_KEYS = Object.freeze(["str","dex","con","int","wis","cha"]);
export const SKILLS = Object.freeze({
  acrobatics:"dex", animalHandling:"wis", arcana:"int", athletics:"str", deception:"cha",
  history:"int", insight:"wis", intimidation:"cha", investigation:"int", medicine:"wis",
  nature:"int", perception:"wis", performance:"cha", persuasion:"cha", religion:"int",
  sleightOfHand:"dex", stealth:"dex", survival:"wis"
});
export function createCharacter({ id, name, species, classId, background="wanderer", abilities, level=1 }) {
  if (!id || !name || !species || !classId) throw new TypeError("Character identity, species and class are required");
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError("D&D level must be 1-20");
  const scores=Object.fromEntries(ABILITY_KEYS.map(k=>[k,Number(abilities?.[k]??10)]));
  if(ABILITY_KEYS.some(k=>!Number.isInteger(scores[k])||scores[k]<1||scores[k]>30))throw new RangeError("Ability scores must be integers from 1 to 30");
  return {id,name,species,classId,background,level,xp:0,abilities:scores,proficiencyBonus:proficiencyBonus(level),
    hp:null,maxHp:null,hitDice:[],deathSaves:{successes:0,failures:0},inspiration:false,
    proficiencies:{skills:[],saves:[],weapons:[],armor:[],tools:[]},expertise:[],features:[],resources:{},conditions:[],spellState:null};
}
export function deriveCharacterStats(character,classDefinition,conScore=character.abilities.con){
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
