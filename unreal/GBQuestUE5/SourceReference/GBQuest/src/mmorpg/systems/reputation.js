export const REPUTATION_STANDING=[{id:"hated",min:-42000},{id:"hostile",min:-6000},{id:"unfriendly",min:-3000},{id:"neutral",min:0},{id:"friendly",min:3000},{id:"honored",min:9000},{id:"revered",min:21000},{id:"exalted",min:42000}];
export function changeReputation(state,factionId,amount){state[factionId]=Math.max(-42000,Math.min(42999,(state[factionId]||0)+Math.trunc(amount)));return state[factionId];}
export function reputationStanding(value){return [...REPUTATION_STANDING].reverse().find(s=>value>=s.min)?.id||"hated";}
