export function createThreatTable(){return new Map();}
export function addThreat(table,entityId,amount){if(!(table instanceof Map)||!entityId||!Number.isFinite(amount)||amount<0)throw new TypeError("Valid threat table, entity and non-negative threat are required");table.set(entityId,(table.get(entityId)||0)+amount);return table.get(entityId);}
export function recordThreat(table,entityId,{damage=0,healing=0,healingTargets=1,buff=0,proximity=0,taunt=0,threatMultiplier=1,healingMultiplier=0.5,buffMultiplier=1}={}){
 const values=[damage,healing,buff,proximity,taunt];
 if(values.some(value=>!Number.isFinite(value)||value<0)||!Number.isInteger(healingTargets)||healingTargets<1||
  !Number.isFinite(threatMultiplier)||threatMultiplier<0||!Number.isFinite(healingMultiplier)||healingMultiplier<0||
  !Number.isFinite(buffMultiplier)||buffMultiplier<0)throw new TypeError("Threat events and multipliers must be non-negative finite values");
 const generated=(damage+healing*healingTargets*healingMultiplier+buff*buffMultiplier+proximity)*threatMultiplier+taunt;
 return addThreat(table,entityId,generated);
}
export function decayThreat(table,fraction){
 if(!(table instanceof Map)||!Number.isFinite(fraction)||fraction<0||fraction>1)throw new RangeError("Threat decay must be from 0 to 1");
 for(const [entityId,amount] of table){const remaining=amount*(1-fraction);if(remaining===0)table.delete(entityId);else table.set(entityId,remaining);}
 return table;
}
export function getThreatRanking(table){
 if(!(table instanceof Map))throw new TypeError("A threat table is required");
 return [...table.entries()].sort((a,b)=>b[1]-a[1]).map(([entityId,threat])=>({entityId,threat}));
}
export function currentTarget(table){return getThreatRanking(table)[0]?.entityId||null;}
export function clearThreat(table,entityId){if(!(table instanceof Map))throw new TypeError("A threat table is required");if(entityId)table.delete(entityId);else table.clear();return table;}
