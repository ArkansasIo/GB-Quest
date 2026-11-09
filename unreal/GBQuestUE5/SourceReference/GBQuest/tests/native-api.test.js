import test from "node:test";
import assert from "node:assert/strict";
import { createGameServer, validateAttackRequest } from "../server.js";

test("native attack request accepts a bounded attack", () => {
  const attack = {
    naturalRoll: 12,
    abilityScore: 18,
    proficiency: 3,
    bonus: 1,
    targetArmorClass: 18,
  };
  assert.equal(validateAttackRequest(attack), attack);
});

test("native attack request rejects missing and invalid values", () => {
  assert.throws(() => validateAttackRequest(null), TypeError);
  assert.throws(() => validateAttackRequest({}), RangeError);
  assert.throws(() => validateAttackRequest({
    naturalRoll: 21,
    abilityScore: 18,
    proficiency: 3,
    bonus: 1,
    targetArmorClass: 18,
  }), /naturalRoll/);
});

test("static game server answers the offline health probe and serves visual-map data", async t => {
  const server = createGameServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: false, service: "game-static-server" });

  const visualMap = await fetch(`${base}/data/visuals/equipment-catalog-visual-map.json`);
  assert.equal(visualMap.status, 200);
  assert.equal(visualMap.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(typeof await visualMap.json(), "object");

  // the source build (index.html) loads its 64-BIT sprite indexes and atlases from assets_hd64/
  const hd64 = await fetch(`${base}/assets_hd64/monsters.json`);
  assert.equal(hd64.status, 200);
  assert.equal(typeof await hd64.json(), "object");
});
