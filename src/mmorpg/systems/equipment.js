export const EQUIPMENT_SLOTS=["head","neck","shoulders","back","chest","wrists","hands","waist","legs","feet","ring1","ring2","trinket1","trinket2","mainHand","offHand"];
export function createEquipment(){return Object.fromEntries(EQUIPMENT_SLOTS.map(s=>[s,null]));}
export function equipItem(loadout,item){if(!EQUIPMENT_SLOTS.includes(item.slot))return {ok:false,reason:"invalid_slot"};if(item.requiredLevel&&item.requiredLevel>loadout.level)return {ok:false,reason:"level_too_low"};const previous=loadout.equipment[item.slot];loadout.equipment[item.slot]=item;return {ok:true,previous};}
export function calculateGearStats(loadout){return Object.values(loadout.equipment).filter(Boolean).reduce((out,item)=>{for(const [k,v] of Object.entries(item.stats||{}))out[k]=(out[k]||0)+v;return out;},{});}
