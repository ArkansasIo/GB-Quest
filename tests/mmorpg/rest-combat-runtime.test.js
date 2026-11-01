import test from "node:test";
import assert from "node:assert/strict";
import {createCharacter,deriveCharacterStats,skillCheck} from "../../src/mmorpg/rules/character.js";
import {shortRest,longRest,recoverShortRestResources} from "../../src/mmorpg/rules/rests.js";
import {rollDeathSave,stabilizeCharacter} from "../../src/mmorpg/rules/death-saves.js";
import {createEncounter,currentCombatant,advanceTurn,spendTurnResource,resetTurnResources} from "../../src/mmorpg/rules/encounter.js";
import {createCooldownState,startCooldown,canUseAbility,cooldownRemaining} from "../../src/mmorpg/systems/cooldowns.js";
import {applyTimedEffect,expireEffects,aggregateEffectStats} from "../../src/mmorpg/systems/effects.js";

test("derived character starts at full hit points and gets hit dice",()=>{const c=createCharacter({id:"a",name:"A",species:"human",classId:"fighter",abilities:{con:14}});const d=deriveCharacterStats(c,{hitDie:10});assert.equal(d.hp,d.maxHp);assert.deepEqual(d.hitDice,[{die:10,count:1}]);});
test("skill checks add proficiency and expertise",()=>{const c=createCharacter({id:"a",name:"A",species:"human",classId:"rogue",abilities:{dex:16}});c.proficiencies.skills=["stealth"];c.expertise=["stealth"];c.proficiencyBonus=2;assert.equal(skillCheck(c,"stealth",{},()=>0).total,8);});
test("short rest spends hit dice and long rest restores health",()=>{const c=deriveCharacterStats(createCharacter({id:"a",name:"A",species:"human",classId:"fighter",abilities:{con:12}}),{hitDie:10});c.hp=2;const r=shortRest(c,{hitDiceToSpend:[{die:10,count:1}],random:()=>0.99});assert.equal(r.hp,10);c.hp=1;assert.equal(longRest(c).hp,10);});
test("short rest resource recovery is limited to short-rest resources",()=>{const c={resources:{ki:{max:3,remaining:0,recovery:"short"},rage:{max:2,remaining:0,recovery:"long"}}};recoverShortRestResources(c);assert.equal(c.resources.ki.remaining,3);assert.equal(c.resources.rage.remaining,0);});
test("death saves stabilize at three successes and natural 20 revives",()=>{const c={hp:0,deathSaves:{successes:0,failures:0}};rollDeathSave(c,()=>0.6);rollDeathSave(c,()=>0.6);assert.equal(rollDeathSave(c,()=>0.6).result,"stable");const d={hp:0,deathSaves:{successes:0,failures:0}};assert.equal(rollDeathSave(d,()=>0.999).hp,1);});
test("stabilization helper marks an unconscious character stable",()=>{const c={hp:0,deathSaves:{successes:0,failures:0}};assert.equal(stabilizeCharacter(c),true);});
test("encounter advances turns and resets action economy",()=>{const e=createEncounter([{id:"a",initiative:20},{id:"b",initiative:10}]);assert.equal(currentCombatant(e).id,"a");assert.equal(spendTurnResource(e.combatants[0],"action"),true);assert.equal(spendTurnResource(e.combatants[0],"action"),false);advanceTurn(e);resetTurnResources(e.combatants[0]);assert.equal(e.combatants[0].actionAvailable,true);});
test("cooldowns report remaining time deterministically",()=>{const s=createCooldownState();startCooldown(s,"fireball",5000,1000);assert.equal(cooldownRemaining(s,"fireball",3000),3000);assert.equal(canUseAbility(s,"fireball",6000),true);});
test("timed effects stack and expire",()=>{const e={effects:[]};applyTimedEffect(e,{id:"haste",stats:{speed:5},durationMs:1000,now:0,stacking:"stack"});applyTimedEffect(e,{id:"haste",stats:{speed:5},durationMs:1000,now:0,stacking:"stack"});assert.equal(aggregateEffectStats(e,500).speed,10);assert.equal(expireEffects(e,1000).length,0);});
