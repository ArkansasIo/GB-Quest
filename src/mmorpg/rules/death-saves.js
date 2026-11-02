export function rollDeathSave(character,random=Math.random){
 if(character.hp>0||character.stable||character.dead)throw new Error("Death saves require an unconscious, unstable character");
 const n=random();if(!(n>=0&&n<1))throw new RangeError("Random source must return [0,1)");
 const die=1+Math.floor(n*20),s=character.deathSaves;
 if(die===20){character.hp=1;s.successes=0;s.failures=0;return {die,result:"regain_consciousness",hp:1};}
 if(die===1)s.failures+=2;else if(die>=10)s.successes++;else s.failures++;
 if(s.failures>=3){character.dead=true;return {die,result:"dead"};}
 if(s.successes>=3){character.stable=true;return {die,result:"stable"};}
 return {die,result:die===1?"two_failures":die>=10?"success":"failure",successes:s.successes,failures:s.failures};
}
export function stabilizeCharacter(character){if(character.hp>0||character.dead)return false;character.stable=true;character.deathSaves={successes:0,failures:0};return true;}
