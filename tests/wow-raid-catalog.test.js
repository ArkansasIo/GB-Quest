import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx={console,window:{}};ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of ['data_rules.js','jobs_data.js','data_world.js','wow_raid_catalog.js']){
  vm.runInContext(fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),ctx,{filename:file});
}
const get=name=>vm.runInContext(name,ctx);
const catalog=get('GBQWowRaidCatalog');
const raids=get('RAIDS'),dungeons=get('DUNGEONS'),regions=new Set(get('REGIONS').map(x=>x.id));

test('adds twelve original WoW-style dungeons and twelve raids to the live instance catalog',()=>{
 assert.equal(catalog.counts.dungeons,12);
 assert.equal(catalog.counts.raids,12);
 assert.equal(raids.filter(x=>x.source==='wow_style_expansion').length,12);
 assert.equal(dungeons.filter(x=>x.source==='wow_style_expansion').length,12);
 assert.equal(new Set(catalog.raids.map(x=>x.id)).size,12);
 assert.equal(new Set(catalog.dungeons.map(x=>x.id)).size,12);
});

test('every new instance uses an existing world region and supported difficulty theme',()=>{
 const themes=new Set(['dungeon','temple','ice','crypt','lava','void']);
 for(const instance of [...catalog.dungeons,...catalog.raids]){
  assert.ok(regions.has(instance.zone),instance.id);
  assert.ok(themes.has(instance.theme),instance.id);
  assert.ok(instance.lvl>=1&&instance.lvl<=720,instance.id);
 }
});

test('Shadowbane Citadel has twelve ordered guardian encounters and a separate arc boss',()=>{
 const raid=catalog.raids.find(x=>x.id==='wow_rd_shadowbane_citadel');
 assert.ok(raid);
 assert.equal(raid.bosses,12);
 assert.equal(raid.encounters.length,12);
 assert.equal(new Set(raid.encounters.map(x=>x.id)).size,12);
 assert.equal(raid.arcBoss,'Malgreth Shadowbane');
 assert.equal(raid.mobs.length,12);
 assert.equal(raid.map.wings.length,4);
 for(const wing of raid.map.wings) for(const node of wing.nodes){
  assert.ok(node[1]>=0&&node[1]<=100);
  assert.ok(node[2]>=0&&node[2]<=100);
 }
});

test('raid bosses expose mechanics and named loot, and all raid maps have floorplan nodes',()=>{
 for(const raid of catalog.raids){
  assert.equal(raid.encounters.length,raid.bosses,raid.id);
  for(const boss of raid.encounters){
   assert.ok(boss.name&&boss.mechanic&&boss.loot?.length,raid.id);
  }
  assert.ok(raid.mobs.length,raid.id);
  assert.ok(raid.map.wings.some(w=>w.nodes.length>=3),raid.id);
 }
});

test('named raid weapons and armour are merged into the existing equipment registries',()=>{
 const weapons=get('WEAPONS'),armours=get('ARMORS');
 for(const key of Object.keys(catalog.weapons)) assert.equal(weapons[key],catalog.weapons[key]);
 for(const key of Object.keys(catalog.armour)){
  assert.equal(armours[key],catalog.armour[key]);
  assert.ok(armours[key].aclass);
 }
 assert.ok(Object.keys(catalog.weapons).length>=10);
 assert.ok(Object.keys(catalog.armour).length>=8);
 assert.equal(catalog.sets.length,8);
 assert.ok(catalog.sets.every(set=>set.pieces.length===6&&set.bonus2&&set.bonus4));
 assert.equal(catalog.items.length,12);
 assert.ok(catalog.items.some(item=>item.id==='nyxara_moonwing'));
 assert.ok(catalog.items.some(item=>item.id==='malgreth_voidling'));
});

test('wave-five generator creates named encounter bosses and a separate Citadel arc boss',()=>{
 const source=fs.readFileSync(new URL('../src/gen.js',import.meta.url),'utf8');
 assert.match(source,/DUNGEONS\.filter\(x => x\.v === 5\)/);
 assert.match(source,/RAIDS\.filter\(x => x\.v === 5\)/);
 assert.match(source,/encounterId: encounter\.id/);
 assert.match(source,/raidArc: true/);
 assert.match(source,/name: encounter\.name/);
});

test('runtime installs eight six-piece raid sets, encounter rewards and instance mobs',()=>{
 ctx.NAMED_ITEMS=[];ctx.NAMED_BY_ID={};ctx.LEGENDARY_SET_DEFS={};
 ctx.BESTIARY=[];ctx.BEAST_BY_ID={};
 vm.runInContext(fs.readFileSync(new URL('../src/wow_raid_runtime.js',import.meta.url),'utf8'),ctx,{filename:'wow_raid_runtime.js'});
 const runtime=get('GBQWowRaidRuntime');
 const defs=get('LEGENDARY_SET_DEFS'),named=get('NAMED_ITEMS'),best=get('BESTIARY');
 assert.equal(runtime.sets.length,8);
 for(const set of runtime.sets){
  assert.equal(defs[set.id].pieces.length,6,set.id);
  assert.ok(defs[set.id].six.length>0,set.id);
 }
 assert.ok(runtime.rewardCount>=20);
 assert.ok(named.some(item=>item.id==='n_malgreth_voidcrown'));
 assert.ok(best.length>0);
});

test('all runtime raid reward templates reference declared item bases',()=>{
 const source=['data_rules.js','items.js','armory.js'].map(file=>fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8')).join('\\n');
 for(const item of get('NAMED_ITEMS')){
  const key=item.kind==='wondrous' ? `id: '${item.base}'` : `\\n  ${item.base}:`;
  assert.ok(source.includes(key),item.id+': missing base '+item.base);
 }
});

test('every dungeon and raid has a navigable map, boss pins and mob-pack markers',()=>{
 for(const dungeon of catalog.dungeons){
  assert.ok(dungeon.map.wings.length>0,dungeon.id);
  assert.equal(dungeon.encounters.length,dungeon.bosses.length,dungeon.id);
  assert.ok(dungeon.mobNodes.length>0,dungeon.id);
 }
 for(const raid of catalog.raids){
  assert.ok(raid.map.wings.length>0,raid.id);
  assert.equal(raid.encounters.length,raid.bosses,raid.id);
  assert.ok(raid.mobNodes.length>0,raid.id);
  const mapBossNames=raid.map.wings.flatMap(wing=>wing.nodes.map(node=>node[0]));
  for(const boss of raid.encounters) assert.ok(mapBossNames.includes(boss.name),raid.id+': '+boss.name);
 }
});

test('interactive atlas is reachable from the main menu and exposes instance controls',()=>{
 const menu=fs.readFileSync(new URL('../src/scenes_menu.js',import.meta.url),'utf8');
 const atlas=fs.readFileSync(new URL('../src/wow_raid_map.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(menu,/'RAID MAP': \(\) => new WowRaidMapScene\(\)/);
 assert.match(atlas,/class WowRaidMapScene extends ListScene/);
 assert.match(atlas,/instanceMenu\(kind/);
 assert.ok(html.includes('src/wow_raid_map.js'));
});
