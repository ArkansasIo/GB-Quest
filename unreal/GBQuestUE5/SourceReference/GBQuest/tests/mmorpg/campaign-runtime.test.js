import test from "node:test";
import assert from "node:assert/strict";
import {createCampaignState,acceptQuest,applyObjectiveEvent,completeQuest,unlockAct} from "../../src/mmorpg/systems/campaign-runtime.js";
const quest={id:"q1",kind:"main",repeatable:false,objective:{type:"collect",target:"herb",required:3},rewards:{xp:100,gold:10}};
test("quest state validates acceptance, objective progress and reward claim",()=>{
 const s=createCampaignState();assert.deepEqual(acceptQuest(s,quest),{ok:true});
 assert.equal(applyObjectiveEvent(s,quest,{type:"kill",target:"herb"}),0);
 assert.equal(applyObjectiveEvent(s,quest,{type:"collect",target:"herb",amount:2}),2);
 assert.equal(completeQuest(s,quest).reason,"objectives_incomplete");
 assert.equal(applyObjectiveEvent(s,quest,{type:"collect",target:"herb"}),1);
 assert.deepEqual(completeQuest(s,quest),{ok:true,rewards:{xp:100,gold:10}});
 assert.equal(completeQuest(s,quest).reason,"reward_already_claimed");
});
test("act unlock requires all prerequisite quests",()=>{
 const s=createCampaignState();assert.equal(unlockAct(s,"act-02",["q1"]),false);
 s.completed.q1=1;assert.equal(unlockAct(s,"act-02",["q1"]),true);
});
