export function createEncounter(combatants){if(!Array.isArray(combatants)||combatants.length<2)throw new TypeError("Encounter requires at least two combatants");const ordered=combatants.map(c=>({...c,initiative:c.initiative??0,actionAvailable:true,bonusActionAvailable:true,reactionAvailable:true})).sort((a,b)=>b.initiative-a.initiative);return {round:1,turnIndex:0,combatants:ordered,active:true,log:[]};}
export function currentCombatant(encounter){return encounter.active?encounter.combatants[encounter.turnIndex]||null:null;}
export function advanceTurn(encounter){
 if(!encounter.active)return null;
 let checked=0;
 do{encounter.turnIndex++;if(encounter.turnIndex>=encounter.combatants.length){encounter.turnIndex=0;encounter.round++;}
  checked++;
 }while(checked<=encounter.combatants.length&&(encounter.combatants[encounter.turnIndex].defeated||encounter.combatants[encounter.turnIndex].fled));
 if(encounter.combatants.every(c=>c.defeated||c.fled)){encounter.active=false;return null;}
 const next=currentCombatant(encounter);resetTurnResources(next);return next;
}
export function spendTurnResource(combatant,resource){const costs={action:"actionAvailable",bonusAction:"bonusActionAvailable",reaction:"reactionAvailable"};const key=costs[resource];if(!key)throw new RangeError("Unknown action economy resource");if(combatant[key]===false)return false;combatant[key]=false;return true;}
export function resetTurnResources(combatant){combatant.actionAvailable=true;combatant.bonusActionAvailable=true;combatant.reactionAvailable=true;return combatant;}
