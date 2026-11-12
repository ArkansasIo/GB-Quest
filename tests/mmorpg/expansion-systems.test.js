import test from "node:test";
import assert from "node:assert/strict";
import { createGuildOperationsState, guildCan, changeGuildRank, depositGuildBank, withdrawGuildBank, updateGuildMotd, startGuildEvent, joinGuildEvent, declareGuildWar, purchaseGuildUpgrade } from "../../src/mmorpg/systems/guild-operations.js";
import { createCollectionState, unlockCollectionEntry, activateCollectionEntry, awardAchievement, collectionSummary } from "../../src/mmorpg/systems/collections.js";
import { buildExpansionMenuState, getExpansionCatalog } from "../../src/mmorpg/systems/expansion-menu.js";
const seed = () => createGuildOperationsState({ id:"g1", leaderId:"p1", members:[{playerId:"p1",rank:"guild_master"},{playerId:"p2",rank:"member"}] });
test("guild permissions, rank changes, and bank ledger enforce authority",()=>{
 const g=seed(); assert.equal(guildCan(g,"p2","withdraw"),false);
 assert.equal(changeGuildRank(g,"p2","p1","officer").reason,"permission_denied");
 assert.equal(changeGuildRank(g,"p1","p2","officer").ok,true);
 assert.equal(depositGuildBank(g,"p2",500).balance,500);
 assert.equal(withdrawGuildBank(g,"p2",100).reason,"permission_denied");
 assert.equal(withdrawGuildBank(g,"p1",100).balance,400);
 assert.equal(g.bankLedger.length,2);
});
test("guild events, wars, MOTD and upgrades validate state",()=>{
 const g=seed(); assert.equal(updateGuildMotd(g,"p1","Lanterns assemble").ok,true);
 const event=startGuildEvent(g,"p1",{title:"Citadel Patrol",startsAt:new Date(Date.now()+3600000).toISOString(),capacity:5});
 assert.equal(event.ok,true); assert.equal(joinGuildEvent(g,"p2",event.event.id).ok,true);
 assert.equal(declareGuildWar(g,"p1","g2").ok,true);
 assert.equal(depositGuildBank(g,"p2",500).ok,true);\n assert.equal(purchaseGuildUpgrade(g,"p1","guild-vault",[{id:"guild-vault",maxLevel:5,costs:[100,200,300,400,500]}]).level,1);
 assert.ok(g.auditLog.length>=4);
});
test("collections unlock once, activate owned rewards and award achievements",()=>{
 const c=createCollectionState(); assert.equal(unlockCollectionEntry(c,"mounts","mossback-stag").ok,true);
 assert.equal(unlockCollectionEntry(c,"mounts","mossback-stag").reason,"already_unlocked");
 assert.equal(activateCollectionEntry(c,"mounts","mossback-stag").ok,true);
 const award=awardAchievement(c,"world-walker",[{id:"world-walker",points:50,rewards:[{category:"titles",id:"world-walker"}]}]);
 assert.equal(award.totalPoints,50); assert.equal(c.activeMount,"mossback-stag");
 assert.deepEqual(collectionSummary(c),{mounts:1,pets:0,titles:1,appearances:0,achievements:1});
});
test("expansion menu availability follows character, guild, collection and online state",()=>{
 const menu=buildExpansionMenuState({character:{id:"p1"},guild:null,collections:null,online:false});
 const find=label=>menu.flatMap(s=>s.children).find(item=>item.label===label);
 assert.equal(find("Guild").enabled,false); assert.equal(find("Collections").enabled,false);
 assert.equal(find("Overview").enabled,true); assert.equal(find("Friends").enabled,false);
 assert.equal(getExpansionCatalog().regions.length,5);
});

import { createCollections, collectAppearance, applyTransmog, collectMount } from "../../src/mmorpg/systems/collections.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
test("legacy wardrobe collections remain compatible with itemization",()=>{
 const c=createCollections(); const item={templateId:"longsword",slot:"main_hand"};
 assert.equal(collectAppearance(c,item),true);
 assert.equal(collectAppearance(c,item),false);
 assert.equal(applyTransmog(c,item,"longsword").ok,true);
 assert.equal(collectMount(c,"mount:warhorse"),true);
 assert.equal(collectMount(c,"mount:warhorse"),false);
});
test("expansion catalog is valid JSON with original regions, dungeons and raids",()=>{
 const here=dirname(fileURLToPath(import.meta.url));
 const catalog=JSON.parse(readFileSync(resolve(here,"../../src/mmorpg/data/expansion-catalog.json"),"utf8"));
 assert.equal(catalog.regions.length,5);
 assert.equal(catalog.dungeons.length,5);
 assert.equal(catalog.raids.length,3);
});
