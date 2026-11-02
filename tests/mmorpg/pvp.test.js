import test from "node:test";
import assert from "node:assert/strict";
import "../../src/mmorpg/systems/pvp.js";

const pvp = globalThis.GBQ_PVP;

test("open-world attacks require both players flagged and a hostile faction", () => {
  const attacker = { id: "a", pvpEnabled: true };
  const target = { id: "b", pvpEnabled: true };
  assert.equal(pvp.canAttack(attacker, target), true);
  assert.equal(pvp.canAttack({ ...attacker, pvpEnabled: false }, target), false);
  assert.equal(pvp.canAttack(attacker, target, { safeZone: true }), false);
  assert.equal(pvp.canAttack(attacker, target, { sameFaction: true }), false);
  assert.equal(pvp.canAttack(attacker, attacker), false);
});

test("consensual duels and battleground combat bypass open-world flags", () => {
  const a = { id: "a", pvpEnabled: false };
  const b = { id: "b", pvpEnabled: false };
  assert.equal(pvp.canAttack(a, b, { duelAccepted: true, safeZone: true }), true);
  assert.equal(pvp.canAttack(a, b, { battleground: true }), true);
});

test("battleground captures validate objectives and award a best-of-five win", () => {
  const match = pvp.createBattleground("banners");
  assert.equal(match.teamSize, 3);
  assert.equal(pvp.captureBattlegroundObjective(match, { team: "blue", objectiveId: "North Banner" }).status, "active");
  assert.throws(() => pvp.captureBattlegroundObjective(match, { team: "red", objectiveId: "North Banner" }), /invalid or already captured/);
  pvp.captureBattlegroundObjective(match, { team: "red", objectiveId: "South Banner" });
  pvp.captureBattlegroundObjective(match, { team: "blue", objectiveId: "Lower Banner" });
  pvp.captureBattlegroundObjective(match, { team: "red", objectiveId: "Upper Banner" });
  const result = pvp.captureBattlegroundObjective(match, { team: "blue", objectiveId: "Central Banner" });
  assert.deepEqual(result, { score: { blue: 3, red: 2 }, status: "complete", winner: "blue" });
  assert.throws(() => pvp.captureBattlegroundObjective(match, { team: "red", objectiveId: "South Banner" }), /not active/);
});

test("battleground definitions reject unknown modes", () => {
  assert.deepEqual(Object.keys(pvp.battlegroundModes), ["banners", "waystones"]);
  assert.throws(() => pvp.createBattleground("unknown"), /Unknown battleground mode/);
});

test("honor scales with opponent level and applies repeat-kill penalties", () => {
  assert.equal(pvp.calculateHonor({ levelDifference: 0, base: 100 }), 100);
  assert.equal(pvp.calculateHonor({ levelDifference: 10, base: 100 }), 150);
  assert.equal(pvp.calculateHonor({ levelDifference: -10, base: 100 }), 50);
  assert.equal(pvp.calculateHonor({ base: 100, repeatPenalty: 0.5 }), 50);
  assert.equal(pvp.calculateHonor({ base: 100, repeatPenalty: 1 }), 10);
  assert.throws(() => pvp.calculateHonor({ base: Number.NaN }), /finite/);
});
