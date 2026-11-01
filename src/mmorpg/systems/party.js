export function createParty(leaderId,{maxSize=5}={}){return {leaderId,maxSize,members:[leaderId],lootMode:"group",createdAt:Date.now()};}
export function inviteToParty(party,playerId){if(party.members.includes(playerId))return {ok:false,reason:"already_member"};if(party.members.length>=party.maxSize)return {ok:false,reason:"party_full"};party.members.push(playerId);return {ok:true};}
export function leaveParty(party,playerId){party.members=party.members.filter(id=>id!==playerId);if(playerId===party.leaderId)party.leaderId=party.members[0]||null;return party;}
export function createRaid(leaderId){return createParty(leaderId,{maxSize:20});}
