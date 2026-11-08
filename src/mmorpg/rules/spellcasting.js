export const FULL_CASTER_SLOTS=[[],[2],[3,0],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
export function spellSaveDc({abilityScore,proficiency,bonus=0}){return 8+Math.floor((abilityScore-10)/2)+proficiency+bonus;}
export function spellAttackBonus({abilityScore,proficiency,bonus=0}){return Math.floor((abilityScore-10)/2)+proficiency+bonus;}
export function createSpellState(level,slots=FULL_CASTER_SLOTS[level]||[]){return {slots:slots.map(max=>({max,remaining:max})),concentration:null,prepared:[],known:[]};}
export function spendSpellSlot(state,level){const slot=state.slots[level-1];if(!slot||slot.remaining<1)return false;slot.remaining--;return true;}
export function recoverSpellSlots(state){for(const s of state.slots)s.remaining=s.max;return state;}
export function setConcentration(state,spellId){state.concentration=spellId||null;return state.concentration;}
