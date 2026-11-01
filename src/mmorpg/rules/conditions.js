export const CONDITIONS=Object.freeze({
 blinded:{speed:1,attackDisadvantage:true,attacksAgainstAdvantage:true},
 charmed:{cannotAttackCharmer:true}, deafened:{hearingUnavailable:true}, frightened:{abilityDisadvantage:true},
 grappled:{speed:0}, incapacitated:{actions:false,reactions:false}, invisible:{attacksAgainstAdvantage:true,attackAdvantage:true},
 paralyzed:{incapacitated:true,speed:0}, petrified:{incapacitated:true,speed:0}, poisoned:{abilityDisadvantage:true,attackDisadvantage:true},
 prone:{meleeAttacksAgainstAdvantage:true,rangedAttacksAgainstDisadvantage:true}, restrained:{speed:0,attackDisadvantage:true,attacksAgainstAdvantage:true},
 stunned:{incapacitated:true,speed:0}, unconscious:{incapacitated:true,prone:true,speed:0}
});
export function addCondition(entity,id,{duration=null,source=null}={}) {
 if(!CONDITIONS[id]) throw new RangeError("Unknown condition: "+id);
 entity.conditions ||= []; entity.conditions=entity.conditions.filter(c=>c.id!==id);
 entity.conditions.push({id,duration,source}); return entity.conditions;
}
export function removeCondition(entity,id){entity.conditions=(entity.conditions||[]).filter(c=>c.id!==id);return entity.conditions;}
export function tickConditions(entity,rounds=1){for(const c of entity.conditions||[])if(c.duration!==null)c.duration-=rounds;entity.conditions=(entity.conditions||[]).filter(c=>c.duration===null||c.duration>0);return entity.conditions;}
