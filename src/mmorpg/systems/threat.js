export function createThreatTable(){return new Map();}
export function addThreat(table,entityId,amount){if(!entityId||!Number.isFinite(amount)||amount<0)throw new TypeError("Valid entity and threat required");table.set(entityId,(table.get(entityId)||0)+amount);return table.get(entityId);}
export function currentTarget(table){return [...table.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;}
export function clearThreat(table,entityId){if(entityId)table.delete(entityId);else table.clear();return table;}
