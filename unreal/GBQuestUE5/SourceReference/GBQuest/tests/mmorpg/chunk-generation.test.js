import test from "node:test";
import assert from "node:assert/strict";
import { generateChunk } from "../../src/mmorpg/world/chunk-generation.js";

const zone = { id: "test-zone", biome: "temperate_forest", dimensionsTiles: [64, 64] };

test("chunk generation is deterministic for the same seed and coordinates", () => {
  assert.deepEqual(generateChunk(zone, 0, 0, 123), generateChunk(zone, 0, 0, 123));
});

test("neighboring chunks use absolute tile coordinates without overlap", () => {
  const a = generateChunk(zone, 0, 0, 123);
  const b = generateChunk(zone, 1, 0, 123);
  assert.equal(a.cells.at(-1).x, 31);
  assert.equal(b.cells[0].x, 32);
  assert.equal(a.cells.length, 1024);
  assert.equal(b.cells.length, 1024);
});

test("chunk generation rejects coordinates outside the zone", () => {
  assert.throws(() => generateChunk(zone, 2, 0, 123), RangeError);
});
