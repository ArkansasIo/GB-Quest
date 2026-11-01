import test from "node:test";
import assert from "node:assert/strict";
import { tileToChunk, worldPositionToChunk, chunksInRadius } from "../../src/mmorpg/world/coordinates.js";

test("negative tile coordinates use floor division", () => {
  assert.equal(tileToChunk(-1, 32), -1);
  assert.equal(tileToChunk(-32, 32), -1);
  assert.equal(tileToChunk(-33, 32), -2);
});

test("world position maps to chunk coordinates", () => {
  assert.deepEqual(worldPositionToChunk(64, -1, 32), { x: 2, y: -1 });
});

test("radius one returns a 3 by 3 chunk neighborhood", () => {
  const chunks = chunksInRadius(0, 0, 1);
  assert.equal(chunks.length, 9);
  assert.ok(chunks.some(chunk => chunk.key === "-1,-1"));
  assert.ok(chunks.some(chunk => chunk.key === "1,1"));
});
