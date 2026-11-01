import { rollDice } from "./dice.js";
export function shortRest(character,{hitDiceToSpend=[],random=Math.random}={}){
 let healed=0,spent=0;
 for(const entry of hitDiceToSpend){
  if(!Number.isInteger(entry.count)||entry.count<1)throw new RangeError("Hit dice spend count must be a positive integer");
  const pool=character.hitDice.find(h=>h.die===entry.die);if(!pool||pool.count<entry.count)throw new RangeError("Insufficient hit dice");
  for(let i=0;i<entry.count;i++){
   if(character.hp>=character.maxHp)break;
   pool.count--;spent++;const roll=rollDice("1d"+entry.die,random).total;
   const con=Math.floor((character.abilities.con-10)/2),gain=Math.max(0,roll+con);
   const actual=Math.min(gain,character.maxHp-character.hp);character.hp+=actual;healed+=actual;
  }
 }
 return {healed,hitDiceSpent:spent,hp:character.hp};
}
export function longRest(character){
 const before=character.hp;character.hp=character.maxHp;character.deathSaves={successes:0,failures:0};
 for(const pool of character.hitDice){const level=character.level||pool.count;pool.count=Math.min(level,pool.count+Math.max(1,Math.floor(level/2)));}
 if(character.spellState){for(const slot of character.spellState.slots)slot.remaining=slot.max;character.spellState.concentration=null;}
 for(const resource of Object.values(character.resources||{}))if(resource.recovery==="long")resource.remaining=resource.max;
 character.conditions=(character.conditions||[]).filter(c=>!c.endsOnLongRest);
 return {healed:character.hp-before,hp:character.hp};
}
export function recoverShortRestResources(character){for(const resource of Object.values(character.resources||{}))if(resource.recovery==="short")resource.remaining=resource.max;return character.resources;}
