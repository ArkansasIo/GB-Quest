import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/season_systems.js',import.meta.url),'utf8');
function load(){const context={Math,Number,String,Object,Array,Date,Set,Map,JSON};context.globalThis=context;vm.runInNewContext(source,context);return context.GBQSeasonal;}

test('the calendar defines four consecutive three-month seasons',()=>{
 const S=load(),months=[0,3,6,9],ids=['emberfall','frostwake','greentide','suncrown'];
 for(let i=0;i<4;i++){const s=S.getSeason(new Date(Date.UTC(2027,months[i],15)));assert.equal(s.quarter,i+1);assert.equal(s.id,'Y2027_'+ids[i]);assert.equal(s.monthInSeason,1);assert.ok(s.end>s.start);assert.ok(s.daysLeft>0);}
 assert.equal(S.getSeason(new Date(Date.UTC(2027,2,31))).quarter,1);
 assert.equal(S.getSeason(new Date(Date.UTC(2027,3,1))).quarter,2);
 assert.equal(S.getSeason(new Date('2027-04-01T00:00:00.000Z')).id,'Y2027_frostwake');
 assert.equal(S.getSeason(new Date('2027-01-01T00:00:00.000Z')).id,'Y2027_emberfall');
});

test('each season has three monthly events with a boss and event objective',()=>{
 const S=load();assert.equal(S.validate(),true);assert.equal(S.MONTHLY_EVENTS.length,4);
 for(const events of S.MONTHLY_EVENTS){assert.equal(events.length,3);for(const event of events){assert.ok(event.name);assert.ok(event.activity);assert.ok(event.boss);}}
});

test('season story has twelve ordered chapters and bounded objective progress',()=>{
 const S=load(),state=S.journeyState(null,{kills:20});
 assert.equal(S.JOURNEY.length,12);assert.equal(state.chapter,1);
 const q=S.JOURNEY[0];assert.equal(S.progressFor(q,{kills:50},{kills:20}),30);
 assert.equal(S.progressFor(q,{kills:500},{kills:20}),60);
 assert.equal(S.questComplete(q,{kills:80},{kills:20}),true);
});

test('weekly season quests are deterministic, distinct and reset from a fresh baseline',()=>{
 const S=load(),a=S.weeklyQuests('hero','2027-01-04',{kills:30}),b=S.weeklyQuests('hero','2027-01-04',{kills:30});
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
 assert.equal(a.length,3);assert.equal(new Set(a.map(q=>q.id)).size,3);
 assert.ok(a.every(q=>q.base.kills===30&&!q.claimed&&q.reward.tokens===50));
});

test('renown rewards and seasonal score ranks scale with activity',()=>{
 const S=load();assert.equal(S.renownLevel(0),0);assert.equal(S.renownLevel(500),5);assert.equal(S.renownLevel(5000),20);
 assert.equal(S.seasonRank(100),'INITIATE');assert.equal(S.seasonRank(600),'ADVENTURER');assert.equal(S.seasonRank(2200),'CHAMPION');assert.equal(S.seasonRank(5500),'VETERAN');assert.equal(S.seasonRank(12000),'PARAGON');
 assert.ok(S.seasonalScore({kills:100,dungeons:2},{kills:0,dungeons:0})>0);
});

test('seasonal quest state discards unknown quest IDs and clamps chapter number',()=>{
 const S=load(),s=S.journeyState({chapter:99,completed:['chapter_1','not_real'],claimed:['chapter_2']},{quests:7});
 assert.equal(s.chapter,13);assert.deepEqual([...s.completed],['chapter_1']);assert.deepEqual([...s.claimed],['chapter_2']);assert.equal(s.base.quests,7);
});
