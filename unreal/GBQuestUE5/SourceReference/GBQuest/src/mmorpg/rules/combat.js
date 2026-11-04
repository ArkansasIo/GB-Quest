import { abilityModifier, proficiencyBonus, rollD20 } from "./d20.js";
import { rollDice } from "./dice.js";
export function armorClass({ armorBase=10, dexterity=10, shieldBonus=0, otherBonus=0, dexCap=null }={}) {
  const dex=abilityModifier(dexterity); return armorBase + (dexCap===null?dex:Math.min(dex,dexCap)) + shieldBonus + otherBonus;
}
export function attackRoll({ abilityScore=10, proficient=false, level=1, bonus=0, advantage=0 }, targetAc, random=Math.random) {
  const first=rollD20(random), second=advantage===0?null:rollD20(random);
  const die=second===null?first:advantage>0?Math.max(first,second):Math.min(first,second);
  const total=die+abilityModifier(abilityScore)+(proficient?proficiencyBonus(level):0)+bonus;
  return { die, rolls:second===null?[first]:[first,second], total, hit:die===20|| (die!==1&&total>=targetAc), critical:die===20, fumble:die===1 };
}
export function resolveDamage({ expression, modifier=0, critical=false, resistance=[], vulnerability=[], immunity=[] }, damageType, random=Math.random) {
  const parsed=rollDice(expression,random), rolled=critical?[...parsed.rolls,...parsed.rolls]:parsed.rolls;
  let amount=rolled.reduce((a,b)=>a+b,modifier);
  const type=String(damageType).toLowerCase();
  if(immunity.includes(type)) amount=0;
  else { if(resistance.includes(type)) amount=Math.floor(amount/2); if(vulnerability.includes(type)) amount*=2; }
  return { damage:Math.max(0,amount), damageType:type, critical, rolls:rolled };
}
export function applyDamage(target, amount, damageType="untyped") {
  if(!target || !Number.isFinite(amount) || amount<0) throw new TypeError("Target and non-negative damage required");
  const dealt=Math.min(target.hp,Math.floor(amount)); target.hp-=dealt;
  if(target.hp===0) target.defeated=true;
  return { dealt, remainingHp:target.hp, defeated:!!target.defeated, damageType };
}
export function savingThrow({ abilityScore, proficient=false, level=1, bonus=0, dc, advantage=0 },random=Math.random) {
  const a=rollD20(random), b=advantage===0?null:rollD20(random), die=b===null?a:advantage>0?Math.max(a,b):Math.min(a,b);
  const total=die+abilityModifier(abilityScore)+(proficient?proficiencyBonus(level):0)+bonus;
  return {die,total,success:total>=dc};
}
