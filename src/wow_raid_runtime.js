/* Runtime integration for the WoW-style GB-Quest instance expansion.
 * Loaded after items.js and armory.js so boss indexes, item factories and set systems exist.
 */
'use strict';

(function installWowRaidRuntime() {
  if (typeof GBQWowRaidCatalog === 'undefined' || typeof NAMED_ITEMS === 'undefined' ||
      typeof NAMED_BY_ID === 'undefined' || typeof LEGENDARY_SET_DEFS === 'undefined') return;

  const sets = [
    { id:'set_lantern_queen', name:'LANTERN QUEEN REGALIA', raid:'wow_rd_shadowbane_citadel', start:0,
      two:[['radiant',12],['heal',8]], three:[['resist',8],['hp',80]], six:[['radiant',28],['heal',18],['acb',2]] },
    { id:'set_eclipse_reaver', name:'ECLIPSE REAVER PANOPLY', raid:'wow_rd_shadowbane_citadel', start:6,
      two:[['crit',4],['critdmg',18]], three:[['haste',10],['dmg',12]], six:[['crit',8],['critdmg',45],['leech',6]] },
    { id:'set_dread_marshal', name:'DREAD MARSHAL BATTLEPLATE', raid:'wow_rd_ironlegion', start:0,
      two:[['block',6],['hp',90]], three:[['acb',1],['resist',10]], six:[['block',14],['hp',240],['thorns',35]] },
    { id:'set_black_sun', name:'BLACK SUN VESTMENTS', raid:'wow_rd_shadowbane_citadel', start:6,
      two:[['dmg',12],['haste',8]], three:[['necrotic',18],['resist',8]], six:[['dmg',30],['necrotic',35],['heal',12]] },
    { id:'set_frostveil', name:'FROSTVEIL REGALIA', raid:'wow_rd_frostveil', start:0,
      two:[['cold',14],['resist',8]], three:[['hp',100],['dodge',4]], six:[['cold',32],['resist',18],['hp',220]] },
    { id:'set_worldroot', name:'WORLDROOT BARKMAIL', raid:'wow_rd_greenwake', start:0,
      two:[['heal',12],['hp',70]], three:[['resist',10],['dodge',3]], six:[['heal',28],['hp',180],['leech',4]] },
    { id:'set_starwoven', name:'STARWOVEN VESTMENTS', raid:'wow_rd_starfall', start:0,
      two:[['dmg',14],['crit',3]], three:[['haste',10],['resist',8]], six:[['dmg',35],['crit',7],['haste',18]] },
    { id:'set_embercrown', name:'EMBERCROWN WARPLATE', raid:'wow_rd_embercrown', start:0,
      two:[['fire',16],['hp',70]], three:[['resist',10],['thorns',18]], six:[['fire',38],['hp',200],['thorns',45]] }
  ];
  const bases = [
    ['helm','wondrous','great_helm'], ['cloak','wondrous','cloak'], ['chest','armor','maximilian_plate'],
    ['gloves','wondrous','vambraces'], ['legs','wondrous','chausses'], ['boots','wondrous','riding_boots']
  ];
  const statAffixes = [
    [['hp',45],['resist',4]], [['dodge',3],['haste',4]], [['acb',1],['hp',65]],
    [['crit',3],['critdmg',12]], [['hp',55],['dmg',5]], [['haste',5],['resist',3]]
  ];
  for (const set of sets) {
    LEGENDARY_SET_DEFS[set.id] = { name:set.name, pieces:[], two:set.two, three:set.three, six:set.six };
    for (let i=0;i<bases.length;i++) {
      const [slot,kind,base]=bases[i], id=set.id+'_'+slot;
      const entry={
        id, name:set.name+' '+slot.toUpperCase(), kind, base, rarity:7, setId:set.id,
        affixes:statAffixes[i], lore:'A masterwork of the '+set.name+'. Its runes answer the call of a complete warband.',
        src:{raid:set.raid,order:set.start+i}
      };
      if (!NAMED_BY_ID[id]) { NAMED_ITEMS.push(entry); NAMED_BY_ID[id]=entry; }
      LEGENDARY_SET_DEFS[set.id].pieces.push(id);
    }
  }

  // Encounter-specific rewards: these are in the real named-drop pool and use existing item bases.
  const rewardDefs = [
    ['citadel_01','VORUN_GATECRUSH','weapon','maul',[['dmg',22],['critdmg',35]]],
    ['citadel_02','TWIN_ECLIPSE_GLAIVES','weapon','glaive',[['radiant',24],['crit',5]]],
    ['citadel_03','VAELS_EDICT','weapon','sceptre',[['radiant',20],['heal',8]]],
    ['citadel_04','CHAINBREAKER_MAUL','weapon','war_hammer',[['dmg',26],['block',5]]],
    ['citadel_05','CINDER_MOTHERS_EMBERSTAFF','weapon','quarterstaff',[['fire',28],['dmg',12]]],
    ['citadel_06','SABLETHORN_RAPIER','weapon','rapier',[['crit',7],['poison',16]]],
    ['citadel_07','ADMIRALS_UNDERTOW','weapon','trident',[['cold',20],['leech',5]]],
    ['citadel_08','BLACK_SUN_CODEX','weapon','voidcodex',[['necrotic',28],['dmg',12]]],
    ['citadel_09','UNHALLOWED_GEARBLADE','weapon','bastard_sword',[['lightning',20],['haste',8]]],
    ['citadel_10','KHARVOXS_WARBANNER','wondrous','banner',[['hp',120],['block',6]]],
    ['citadel_11','SHARDSUNDER_GREATSWORD','weapon','zweihander',[['critdmg',55],['dmg',20]]],
    ['citadel_12','NYXARAS_LAST_LIGHT','weapon','longsword',[['radiant',35],['heal',12],['crit',5]]],
    ['embercrown_6','RHAZUL_CROWN_OF_FLAME','weapon','dane_axe',[['fire',38],['critdmg',50]]],
    ['frostveil_7','EIRATH_WINTERS_END','weapon','katana',[['cold',40],['crit',7]]],
    ['tidebreaker_5','THALASSAR_DEEP_SOVEREIGN','weapon','trident',[['lightning',30],['cold',20]]],
    ['greenwake_6','VERDRAS_WORLDROOT_HEART','wondrous','torc',[['heal',20],['hp',160]]],
    ['clockwork_8','EVERLASTING_MINUTE','wondrous','circlet',[['haste',15],['crit',6]]],
    ['starfall_7','ASTRAELS_LAST_CONSTELLATION','weapon','quarterstaff',[['radiant',30],['force',30]]],
    ['sandsage_5','AKH_RAS_LAST_HOUR','wondrous','pendant',[['haste',12],['resist',15]]],
    ['ironlegion_8','VALKORS_LEGION_ETERNAL','weapon','greatsword',[['hp',150],['dmg',25]]],
    ['twilight_9','AURELION_WORLD_ENDER','weapon','zweihander',[['radiant',35],['necrotic',35],['critdmg',70]]],
    ['dragonfire_6','ZYRATH_NEXUS_INCARNATE','weapon','bastard_sword',[['fire',35],['force',25],['critdmg',55]]]
  ];
  const bossOrderByEncounter = {};
  for (const raid of GBQWowRaidCatalog.raids) for (const encounter of raid.encounters || []) bossOrderByEncounter[encounter.id]=encounter;
  for (const [encounterId,id,kind,base,affixes] of rewardDefs) {
    const encounter=bossOrderByEncounter[encounterId]; if(!encounter) continue;
    const raid=GBQWowRaidCatalog.raids.find(r=>(r.encounters||[]).includes(encounter)); if(!raid) continue;
    const entry={id:'n_wow_'+id.toLowerCase(),name:id.replace(/_/g,' '),kind,base,rarity:8,affixes,
      lore:'A named trophy claimed from '+encounter.name+'.',src:{raid:raid.id,order:raid.encounters.indexOf(encounter)}};
    if(!NAMED_BY_ID[entry.id]){NAMED_ITEMS.push(entry);NAMED_BY_ID[entry.id]=entry;}
  }
  const arc = GBQWowRaidCatalog.raids.find(r=>r.arcBoss);
  if(arc){
    const entry={id:'n_malgreth_voidcrown',name:'MALGReTH’S VOIDCROWN',kind:'wondrous',base:'circlet',rarity:9,
      affixes:[['necrotic',55],['resist',25],['hp',250],['dmg',35]],lore:'The last light in the Citadel was extinguished here.',
      src:{raid:arc.id,order:arc.bosses}};
    if(!NAMED_BY_ID[entry.id]){NAMED_ITEMS.push(entry);NAMED_BY_ID[entry.id]=entry;}
  }

  // Add named mob templates to the existing bestiary so the biome and encounter systems can resolve them.
  if (typeof BESTIARY !== 'undefined' && typeof BEAST_BY_ID !== 'undefined' && typeof FAMILIES !== 'undefined') {
    const familyFor = theme => ({crypt:'undead',ice:'undead',lava:'elemental',void:'aberration',temple:'plant',dungeon:'humanoid'})[theme] || 'humanoid';
    const fallbackFor = fam => (BESTIARY.find(x=>x.fam===fam) || BESTIARY[0] || {}).spr || 'enemy_goblin';
    for (const instance of [...GBQWowRaidCatalog.dungeons,...GBQWowRaidCatalog.raids]) {
      const fam=familyFor(instance.theme), spr=fallbackFor(fam);
      for (const name of instance.mobs || []) {
        const id='wow_mob_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
        if(BEAST_BY_ID[id]) continue;
        const mob={id,fam,sub:name,variant:'',name,spr,nspr:id,ccArt:id,dt:fam==='undead'?'necrotic':fam==='elemental'?'fire':fam==='plant'?'poison':'slashing',
          res:[],role:'pack',rank:'normal',minLvl:instance.lvl,maxLvl:720,collector:true,raidInstance:instance.id};
        BESTIARY.push(mob); BEAST_BY_ID[id]=mob;
      }
    }
  }

  if(typeof globalThis!=='undefined') globalThis.GBQWowRaidRuntime={
    sets, rewardCount:rewardDefs.length, mobCount:GBQWowRaidCatalog.dungeons.concat(GBQWowRaidCatalog.raids).reduce((n,x)=>n+(x.mobs||[]).length,0),
    bossForEncounter(id){return typeof BOSSES!=='undefined'?BOSSES.find(b=>b.encounterId===id)||null:null;}
  };
})();
