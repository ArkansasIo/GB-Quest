import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async p => JSON.parse(await readFile(new URL("../../"+p, import.meta.url)));
const world = await read("world/catalog/world.json");
const settlements = (await read("world/catalog/settlements.json")).settlements;
const pois = (await read("world/catalog/points-of-interest.json")).pointsOfInterest;
const biomes = (await read("world/catalog/biomes.json")).biomes;
const factions = (await read("world/catalog/factions.json")).factions;
const manifests = await Promise.all(["asia","africa","north-america","south-america","antarctica","europe","australia"].map(id=>read("world/continents/"+id+".json")));
test("world atlas has seven continents, five oceans and 56 zones",()=>{
 assert.equal(world.continents.length,7); assert.equal(world.oceans.length,5);
 assert.equal(manifests.reduce((n,c)=>n+c.zones.length,0),56);
});
test("every zone has four sub-zones and linked settlements and POIs",()=>{
 for(const c of manifests) for(const z of c.zones){
  assert.equal(z.subZones.length,4);
  assert.equal(z.settlementIds.length,6);
  assert.equal(z.pointsOfInterest.length,5);
  for(const id of z.settlementIds) assert.ok(settlements.some(s=>s.id===id && s.zoneId===z.id));
  for(const p of z.pointsOfInterest) assert.ok(pois.some(x=>x.id===p.id && x.zoneId===z.id));
 }
});
test("settlement, biome, faction and POI totals match atlas",()=>{
 assert.equal(settlements.length,343);
 assert.equal(settlements.filter(s=>s.type==="capital").length,7);
 assert.equal(settlements.filter(s=>s.type==="city").length,56);
 assert.equal(settlements.filter(s=>s.type==="town").length,112);
 assert.equal(settlements.filter(s=>s.type==="village").length,168);
 assert.equal(biomes.length,48); assert.equal(factions.length,21); assert.equal(pois.length,280);
});
test("continent zone biome references exist",()=>{
 const ids=new Set(biomes.map(b=>b.id));
 for(const c of manifests) for(const z of c.zones) assert.ok(ids.has(z.biomeId),z.biomeId);
});
