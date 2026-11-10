'use strict';
(() => {
const SEASONS=[
{id:'emberfall',name:'EMBERFALL',theme:'Ash and Flame',element:'fire',currency:'Ember Sigils',lore:'The old forges awaken beneath Valendria.'},
{id:'frostwake',name:'FROSTWAKE',theme:'Winter and Ice',element:'cold',currency:'Frost Marks',lore:'An ancient winter has crossed the northern passes.'},
{id:'greentide',name:'GREENTIDE',theme:'Wild Growth',element:'poison',currency:'Bloom Seals',lore:'The Worldroot spreads into forgotten lands.'},
{id:'suncrown',name:'SUNCROWN',theme:'Sun and Storm',element:'lightning',currency:'Solar Crests',lore:'A broken sun casts a shadow across the realm.'}
];
const STAT_KEYS=['kills','elites','dungeons','raids','trials','quests','worldBosses','crafted','fish','steps','keystones'];
const JOURNEY=[
['A Spark in the Dark','kills',60,'Find the first signs of the seasonal disturbance.'],
['The Threat Revealed','elites',8,'Defeat elite forces gathering around the seasonal frontier.'],
['Into the Fracture','dungeons',2,'Clear dungeons corrupted by the season.'],
['Voices of the Realm','quests',5,'Complete quests for the people of Valendria.'],
['A Greater Enemy','worldBosses',1,'Defeat a seasonal world boss.'],
['The First Expedition','raids',1,'Complete a raid expedition.'],
['Trial by Fire','trials',2,'Complete two trials against the season’s champions.'],
['Supply the Vanguard','crafted',12,'Craft supplies for the seasonal war effort.'],
['Keys to the Front','keystones',2,'Complete keystone expeditions.'],
['A Realm United','kills',250,'Push back the seasonal invasion across the realm.'],
['Break Their Stronghold','dungeons',6,'Clear six more dungeons and weaken the enemy stronghold.'],
['The Season’s End','worldBosses',3,'Defeat three world bosses and end the seasonal threat.']
].map((x,i)=>({id:'chapter_'+(i+1),chapter:i+1,name:x[0],stat:x[1],target:x[2],description:x[3],reward:{tokens:30+i*5,seasonXp:250+i*25,gold:200+i*50}}));
const WEEKLY_POOL=[
{id:'weekly_hunt',name:'FRONTIER HUNTER',stat:'kills',target:180,description:'Defeat enemies across the frontier.'},
{id:'weekly_elites',name:'ELITE BREAKER',stat:'elites',target:15,description:'Defeat elite enemies.'},
{id:'weekly_dungeons',name:'DUNGEON DELVER',stat:'dungeons',target:4,description:'Clear dungeons.'},
{id:'weekly_raids',name:'RAID VANGUARD',stat:'raids',target:1,description:'Complete a raid.'},
{id:'weekly_trials',name:'TRIAL SEEKER',stat:'trials',target:3,description:'Complete trials.'},
{id:'weekly_quests',name:'REALM HELPER',stat:'quests',target:10,description:'Complete quests.'},
{id:'weekly_bosses',name:'GIANT SLAYER',stat:'worldBosses',target:2,description:'Defeat world bosses.'},
{id:'weekly_craft',name:'WAR QUARTERMASTER',stat:'crafted',target:20,description:'Craft items.'},
{id:'weekly_keys',name:'KEYSTONE RUNNER',stat:'keystones',target:3,description:'Finish keystone runs.'}
];
const MONTHLY_EVENTS=[
[
{id:'cinderfall',name:'CINDERFALL INVASION',activity:'Defend the Ashen March',bonus:'Fire-themed rewards',boss:'The Cinder Sovereign'},
{id:'forgeweek',name:'FORGE OF THE FIRST KING',activity:'Gather rare ore and craft war gear',bonus:'Crafting and upgrade materials',boss:'The Ironbound Regent'},
{id:'ashmoon',name:'ASHEN MOON HUNT',activity:'Hunt elite beasts beneath the red moon',bonus:'Elite hunt and legendary caches',boss:'The Red Moon Stalker'}
],
[
{id:'frostbound',name:'FROSTBOUND HUNT',activity:'Track the Pale Huntress through the north',bonus:'Cold-themed rewards',boss:'The Pale Huntress'},
{id:'icefall',name:'SHATTERING ICE',activity:'Break icebound fortresses and rescue scouts',bonus:'Dungeon and rescue rewards',boss:'The Glacier Warden'},
{id:'longnight',name:'THE LONG NIGHT',activity:'Survive waves in the frozen dark',bonus:'Survival caches and titles',boss:'The Night-Ice Colossus'}
],
[
{id:'wildbloom',name:'WILDBLOOM SURGE',activity:'Cleanse corrupted Worldroot growth',bonus:'Nature and poison rewards',boss:'The Verdant Devourer'},
{id:'rootwake',name:'ROOTWAKE EXPEDITION',activity:'Explore newly opened Worldroot passages',bonus:'Gathering and exploration rewards',boss:'The Rootbound Ancient'},
{id:'beasttide',name:'BEASTTIDE',activity:'Hunt beasts empowered by wild growth',bonus:'Companion and beast trophies',boss:'The Thornhide Alpha'}
],
[
{id:'eclipse',name:'ECLIPSE OF THE SUN',activity:'Recover the fallen solar standards',bonus:'Solar relics and titles',boss:'The Eclipse Herald'},
{id:'stormcrown',name:'STORMCROWN SIEGE',activity:'Defend the sky citadel from storm legions',bonus:'Lightning relics and siege caches',boss:'The Tempest Marshal'},
{id:'lastlight',name:'THE LAST LIGHT',activity:'Enter the final eclipse and defeat its champions',bonus:'End-of-season prestige rewards',boss:'The Sunless King'}
]
];
function pad(n){return String(n).padStart(2,'0');}
function dateKey(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function getSeason(d=new Date()){
const q=Math.floor(d.getMonth()/3),s=SEASONS[q],start=new Date(d.getFullYear(),q*3,1),end=new Date(d.getFullYear(),q*3+3,1);
return{id:'Y'+d.getFullYear()+'_'+s.id,year:d.getFullYear(),quarter:q+1,name:s.name,theme:s.theme,element:s.element,currency:s.currency,lore:s.lore,start:dateKey(start),end:dateKey(end),daysLeft:Math.max(0,Math.ceil((end-d)/86400000)),monthInSeason:d.getMonth()%3+1,eventData:MONTHLY_EVENTS[q][d.getMonth()%3]};
}
function weekKey(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return dateKey(x);}
function statSnapshot(stats={}){return Object.fromEntries(STAT_KEYS.map(k=>[k,Math.max(0,Number(stats[k])||0)]));}
function progressFor(q,stats={},base={}){return Math.max(0,Math.min(q.target,(Number(stats[q.stat])||0)-(Number(base[q.stat])||0)));}
function questComplete(q,stats={},base={}){return progressFor(q,stats,base)>=q.target;}
function weeklyQuests(seed,week,stats={}){
let n=2166136261;for(const c of String(seed)+'|'+week){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}let x=n>>>0;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};
const pool=WEEKLY_POOL.slice(),out=[];while(out.length<3&&pool.length){const i=Math.floor(rand()*pool.length),q=pool.splice(i,1)[0];out.push({...q,base:statSnapshot(stats),claimed:false,reward:{tokens:50,seasonXp:350,gold:500}});}return out;
}
function journeyState(state,stats={}){const s=state&&typeof state==='object'?state:{};const chapter=Math.max(1,Math.min(13,Math.floor(Number(s.chapter)||1)));return{chapter,base:s.base&&typeof s.base==='object'?statSnapshot(s.base):statSnapshot(stats),completed:Array.isArray(s.completed)?s.completed.filter(x=>JOURNEY.some(q=>q.id===x)):[],claimed:Array.isArray(s.claimed)?s.claimed.filter(x=>JOURNEY.some(q=>q.id===x)):[]};}
function renownLevel(points){let level=0;while(level<20&&points>=(level+1)*100)level++;return level;}
function renownReward(level){const l=Math.max(1,Math.min(20,Math.floor(level)));return l%5===0?{tokens:100,renown:0,gold:1500,title:l===20?'season_renowned':null,cache:true}:{tokens:25,renown:0,gold:250,cache:l%2===0};}
function seasonRank(score){const s=Math.max(0,Number(score)||0);return s>=10000?'PARAGON':s>=5000?'VETERAN':s>=2000?'CHAMPION':s>=500?'ADVENTURER':'INITIATE';}
function seasonalScore(stats={},base={}){const weights={kills:1,elites:8,dungeons:80,raids:250,trials:100,quests:25,worldBosses:150,crafted:5,keystones:120};return Object.entries(weights).reduce((n,[k,w])=>n+Math.max(0,(Number(stats[k])||0)-(Number(base[k])||0))*w,0);}
function validate(){return SEASONS.length===4&&MONTHLY_EVENTS.length===4&&MONTHLY_EVENTS.every(x=>x.length===3)&&JOURNEY.length===12&&new Set(JOURNEY.map(q=>q.id)).size===12&&WEEKLY_POOL.length>=3;}
if(typeof globalThis!=='undefined')globalThis.GBQSeasonal={SEASONS,JOURNEY,WEEKLY_POOL,MONTHLY_EVENTS,getSeason,weekKey,statSnapshot,progressFor,questComplete,weeklyQuests,journeyState,renownLevel,renownReward,seasonRank,seasonalScore,validate};
if(typeof window==='undefined'||typeof G==='undefined'||typeof makeItem!=='function')return;
const current=()=>getSeason(new Date()),playerKey=()=>String(G.slot)+'|'+String(G.name||'hero')+'|'+String(G.created||0);
function ensureSeasonal(){
const s=current(),stats=G.stats||{},state=G.seasonal;
if(!state||state.seasonId!==s.id)G.seasonal={seasonId:s.id,currency:0,renown:0,claimedRenown:[],journey:{chapter:1,base:statSnapshot(stats),completed:[],claimed:[]},weekly:{week:weekKey(),quests:weeklyQuests(playerKey(),weekKey(),stats)},eventClaims:[],eventMonth:current().id+'_'+current().monthInSeason,eventBase:statSnapshot(stats),scoreBase:statSnapshot(stats),bestBosses:[]};
const z=G.seasonal;z.currency=Math.max(0,Math.floor(Number(z.currency)||0));z.renown=Math.max(0,Math.floor(Number(z.renown)||0));z.claimedRenown=Array.isArray(z.claimedRenown)?z.claimedRenown:[];z.eventClaims=Array.isArray(z.eventClaims)?z.eventClaims:[];z.bestBosses=Array.isArray(z.bestBosses)?z.bestBosses:[];
z.journey=journeyState(z.journey,stats);const wk=weekKey();if(!z.weekly||z.weekly.week!==wk)z.weekly={week:wk,quests:weeklyQuests(playerKey(),wk,stats)};const eventMonth=s.id+'_'+s.monthInSeason;if(z.eventMonth!==eventMonth){z.eventMonth=eventMonth;z.eventBase=statSnapshot(stats);}z.eventBase=z.eventBase||statSnapshot(stats);return z;
}
function addSeasonTokens(n){const z=ensureSeasonal(),amount=Math.max(0,Math.floor(Number(n)||0));z.currency=Math.min(999999,z.currency+amount);}
function awardSeasonReward(r){const z=ensureSeasonal();addSeasonTokens(r.tokens||0);z.renown=Math.min(999999,z.renown+Math.max(0,Math.floor(Number(r.renown===undefined?(r.tokens||0):r.renown)||0)));G.gold+=r.gold||0;if(typeof addSeasonXp==='function')addSeasonXp(r.seasonXp||0);else if(G.season)G.season.bonus=(Number(G.season.bonus)||0)+(r.seasonXp||0);if(r.items&&typeof addItem==='function')for(const[k,n]of Object.entries(r.items))if(typeof ITEMS!=='undefined'&&ITEMS[k])addItem(k,n);if(r.gear&&typeof addGear==='function')addGear(makeItem({lvl:G.lvl,...r.gear}));if(r.title){G.titlesWon||={};G.titlesWon[r.title]=true;}}
function claimJourney(){const z=ensureSeasonal(),q=JOURNEY[z.journey.chapter-1];if(!q)return'The seasonal story is complete.';if(z.journey.claimed.includes(q.id))return'Already claimed.';if(!questComplete(q,G.stats,z.journey.base))return'Quest objective not complete.';awardSeasonReward(q.reward);z.journey.claimed.push(q.id);z.journey.completed.push(q.id);z.journey.chapter=Math.min(13,z.journey.chapter+1);z.journey.base=statSnapshot(G.stats);saveGame();return null;}
function claimWeekly(i){const z=ensureSeasonal(),q=z.weekly.quests[i];if(!q)return'No such seasonal quest.';if(q.claimed)return'Already claimed.';if(!questComplete(q,G.stats,q.base))return'Objective not complete.';q.claimed=true;awardSeasonReward(q.reward);saveGame();return null;}
function claimRenownRewards(){const z=ensureSeasonal(),level=renownLevel(z.renown),out=[];for(let i=1;i<=level;i++)if(!z.claimedRenown.includes(i)){const r=renownReward(i);awardSeasonReward(r);z.claimedRenown.push(i);out.push(i);}saveGame();return out;}
const VENDOR=[
{id:'vendor_shards',name:'ASCENDANT SHARDS',cost:80,reward:{items:{star_shard:1,shard:5}},label:'1 STAR SHARD + 5 SHARDS'},
{id:'vendor_ember',name:'FORGE EMBERS',cost:50,reward:{items:{ember:5}},label:'5 EMBERS'},
{id:'vendor_awake',name:'AWAKENING CACHE',cost:120,reward:{items:{awk_stone:10}},label:'10 AWAKENING STONES'},
{id:'vendor_key',name:'RIFT KEY CACHE',cost:100,reward:{riftKeys:2},label:'2 RIFT KEYS'},
{id:'vendor_gear',name:'SEASONAL RELIC',cost:250,reward:{gear:{rarity:5}},label:'LEGENDARY RELIC'},
{id:'vendor_title',name:'SEASONAL TITLE',cost:400,reward:{title:'season_renowned'},label:'SEASON RENOWNED TITLE'}
];
function buyVendor(i){const z=ensureSeasonal(),v=VENDOR[i];if(!v)return'Unknown seasonal reward.';if(z.currency<v.cost)return'Not enough seasonal currency.';z.currency-=v.cost;awardSeasonReward({...v.reward,gold:0,seasonXp:0,tokens:0});if(v.reward.riftKeys){G.rift||={};G.rift.keys=(Number(G.rift.keys)||0)+v.reward.riftKeys;}saveGame();return'PURCHASED '+v.name+'.';}
function seasonQuestMenu(){const z=ensureSeasonal(),q=JOURNEY[z.journey.chapter-1];if(!q)return say('THE SEASON STORY IS COMPLETE.',seasonMainMenu);const p=progressFor(q,G.stats,z.journey.base),ready=p>=q.target;choose([ready?'CLAIM STORY CHAPTER':'VIEW STORY CHAPTER','SEASONAL WEEKLIES','BACK'],k=>{if(k===0){if(!ready)return say([q.name,q.description,p+'/'+q.target+' '+q.stat.toUpperCase()],seasonQuestMenu);const err=claimJourney();return say(err||[q.name+' COMPLETE','SEASON TOKENS AND SEASON XP AWARDED.'],seasonQuestMenu);}if(k===1)return weeklySeasonMenu();if(k===2)return seasonMainMenu();},'CHAPTER '+q.chapter+'/12: '+q.name);}
function weeklySeasonMenu(){const z=ensureSeasonal(),rows=z.weekly.quests;choose(rows.map(q=>(q.claimed?'#':questComplete(q,G.stats,q.base)?'!':' ')+q.name.slice(0,17)+' '+progressFor(q,G.stats,q.base)+'/'+q.target),i=>{if(i<0)return seasonMainMenu();const q=rows[i];if(!q)return seasonMainMenu();if(q.claimed)return say('ALREADY CLAIMED.',weeklySeasonMenu);if(!questComplete(q,G.stats,q.base))return say([q.name,q.description,progressFor(q,G.stats,q.base)+'/'+q.target],weeklySeasonMenu);const err=claimWeekly(i);return say(err||'WEEKLY SEASON QUEST COMPLETE. +50 TOKENS +350 SEASON XP.',weeklySeasonMenu);},'WEEKLY SEASON QUESTS');}
function seasonalVendorMenu(){const z=ensureSeasonal();choose(VENDOR.map(v=>v.name+' '+v.cost+' TOKENS'),i=>{if(i<0)return seasonMainMenu();const v=VENDOR[i];choose(['BUY','BACK'],k=>{if(k!==0)return seasonalVendorMenu();return say(buyVendor(i),seasonalVendorMenu);},v.label+' · '+v.cost+' TOKENS');},'SEASON VENDOR: '+z.currency+' TOKENS');}
function seasonEventMenu(){const s=current(),e=s.eventData,z=ensureSeasonal(),key=s.id+'_'+e.id,claimed=z.eventClaims.includes(key);choose(['EVENT STORY','CLAIM EVENT CACHE','BACK'],k=>{if(k===0)return say([e.name,e.activity,e.bonus,'BOSS: '+e.boss,'Defeat at least one world boss this season to earn the event cache.'],seasonEventMenu);if(k===1){if(claimed)return say('EVENT CACHE ALREADY CLAIMED THIS MONTH.',seasonEventMenu);const kills=Math.max(0,(Number(G.stats.worldBosses)||0)-(Number((z.eventBase||z.scoreBase).worldBosses)||0));if(kills<1)return say('DEFEAT AT LEAST ONE WORLD BOSS THIS SEASON TO CLAIM THE EVENT CACHE.',seasonEventMenu);z.eventClaims.push(key);awardSeasonReward({tokens:75,seasonXp:500,gold:1000,items:{star_shard:1}});saveGame();return say('EVENT CACHE CLAIMED: 75 TOKENS, 500 SEASON XP, 1,000 GOLD.',seasonEventMenu);}if(k===2)return seasonMainMenu();},e.name);}
function seasonMainMenu(){const s=current(),z=ensureSeasonal(),q=JOURNEY[z.journey.chapter-1],level=renownLevel(z.renown);choose(['SEASON STORY '+(q?'CHAPTER '+q.chapter+'/12':'COMPLETE'),'WEEKLY SEASON QUESTS','SEASONAL EVENT: '+s.monthInSeason+'/3','SEASON VENDOR','CLAIM RENOWN REWARDS','SEASON PASS','BACK'],k=>{if(k===0)return seasonQuestMenu();if(k===1)return weeklySeasonMenu();if(k===2)return seasonEventMenu();if(k===3)return seasonalVendorMenu();if(k===4){const got=claimRenownRewards();return say(got.length?'RENOWN REWARDS CLAIMED: '+got.join(', '):'NO NEW RENOWN REWARDS.',seasonMainMenu);}if(k===5&&typeof SeasonPassScene==='function')return push(new SeasonPassScene());},s.name+' · '+s.daysLeft+' DAYS · RENOWN '+level+'/20 · '+seasonRank(seasonalScore(G.stats,z.scoreBase)));}
if(typeof TITLES!=='undefined'&&!TITLES.some(x=>x.id==='t_season_renowned'))TITLES.push({id:'t_season_renowned',name:'SEASON RENOWNED',how:'Reach renown 20 or purchase the seasonal title.',ok:g=>!!(g.titlesWon&&g.titlesWon.season_renowned)});
window.seasonMainMenu=seasonMainMenu;window.ensureSeasonal=ensureSeasonal;window.claimSeasonJourney=claimJourney;window.claimSeasonWeekly=claimWeekly;window.buySeasonalReward=buyVendor;
const oldItems=MainMenu.prototype.items;
MainMenu.prototype.items=function(){const items=oldItems.apply(this,arguments),at=items.indexOf('CHALLENGES');items.splice(at>=0?at+1:items.length,0,'SEASON JOURNEY');return items;};
const oldUpdate=MainMenu.prototype.update;
MainMenu.prototype.update=function(){if(P('a')&&this.items()[this.i]==='SEASON JOURNEY'){SFX.select();return seasonMainMenu();}return oldUpdate.apply(this,arguments);};
})();