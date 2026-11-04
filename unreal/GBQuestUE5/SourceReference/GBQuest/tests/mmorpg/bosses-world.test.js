import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bosses = JSON.parse(await readFile(new URL("../../src/mmorpg/data/bosses-350.json", import.meta.url)));
const taxonomy = JSON.parse(await readFile(new URL("../../src/mmorpg/data/monster-taxonomy.json", import.meta.url)));
const world = JSON.parse(await readFile(new URL("../../world/manifests/world-scale.json", import.meta.url)));

test("boss registry contains 300 world bosses and 50 arc bosses", () => {
  assert.equal(bosses.bosses.length, 350);
  assert.equal(bosses.bosses.filter(b => b.rank === "world_boss").length, 300);
  assert.equal(bosses.bosses.filter(b => b.rank === "arc_boss").length, 50);
  assert.equal(new Set(bosses.bosses.map(b => b.id)).size, 350);
});

test("all bosses have valid monster taxonomy and world locations", () => {
  const typeSet = new Set(taxonomy.creatureTypes);
  const classSet = new Set(taxonomy.monsterClasses.map(c => c.id));
  const subSet = new Set(taxonomy.monsterClasses.flatMap(c => c.subclasses.map(s => s.id)));
  const zoneSet = new Set(world.zones.map(z => z.id));
  for (const b of bosses.bosses) {
    assert.ok(typeSet.has(b.creatureType));
    assert.ok(classSet.has(b.monsterClass));
    assert.ok(subSet.has(b.subclass));
    assert.ok(zoneSet.has(b.regionId));
  }
});

test("world scale has 4 continents, 40 zones and 10240 chunks", () => {
  assert.equal(world.continentCount, 4);
  assert.equal(world.zoneCount, 40);
  assert.equal(world.zones.length, 40);
  assert.equal(world.totalChunks, 10240);
  assert.deepEqual(world.zoneDimensionsTiles, [512, 512]);
});
