export function createCooldownState(){return {readyAt:{}};}
export function startCooldown(state,abilityId,durationMs,now=Date.now()){if(!abilityId||!Number.isFinite(durationMs)||durationMs<0)throw new TypeError("Valid ability and cooldown required");state.readyAt[abilityId]=now+durationMs;return state.readyAt[abilityId];}
export function cooldownRemaining(state,abilityId,now=Date.now()){return Math.max(0,(state.readyAt[abilityId]||0)-now);}
export function canUseAbility(state,abilityId,now=Date.now()){return cooldownRemaining(state,abilityId,now)===0;}
