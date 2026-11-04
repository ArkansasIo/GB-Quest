export function createMountCollection(){return {owned:[],activeMount:null};}
export function learnMount(collection,mountId){if(collection.owned.includes(mountId))return false;collection.owned.push(mountId);return true;}
export function summonMount(collection,mountId,{inCombat=false,indoors=false,restricted=false}={}){if(!collection.owned.includes(mountId))return {ok:false,reason:"not_owned"};if(inCombat||indoors||restricted)return {ok:false,reason:"summoning_restricted"};collection.activeMount=mountId;return {ok:true};}
