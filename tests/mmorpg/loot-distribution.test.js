import test from "node:test";
import assert from "node:assert/strict";
import { rollLootTable, distributeLoot } from "../../src/mmorpg/systems/loot.js";

test("loot tables validate entries and return independent item instances", () => {
  const table = [{ chance: 1, item: { id: "rune", tags: ["boss"] }, quantity: 2 }];
  const rewards = rollLootTable(table, () => 0.5);
  assert.deepEqual(rewards, [{ id: "rune", tags: ["boss"], quantity: 2 }]);
  rewards[0].tags.push("changed");
  assert.deepEqual(table[0].item.tags, ["boss"]);
  assert.throws(() => rollLootTable(null), /array/i);
  assert.throws(() => rollLootTable([{ chance: 2, item: { id: "x" } }]), /chance/i);
  assert.throws(() => rollLootTable([{ chance: 1, item: null }]), /item object/i);
  assert.throws(() => rollLootTable([{ chance: 1, item: { id: "x" }, quantity: 0 }]), /quantity/i);
});

test("loot random sources are range checked", () => {
  assert.throws(() => rollLootTable([{ chance: 1, item: { id: "x" } }], () => 1), /\[0, 1\)/);
  assert.throws(() => rollLootTable([], null), /function/i);
});

test("personal loot rolls independently for each party member", () => {
  const rewards = [{ id: "rare-drop", quantity: 1 }];
  const values = [0.1, 0.9, 0.9, 0.1];
  let index = 0;
  const result = distributeLoot(rewards, "personal", [{ id: "a" }, { id: "b" }], () => values[index++]);
  assert.deepEqual(result, { a: [rewards[0]], b: [] });
  assert.equal(index, 2);
  assert.notEqual(result.a[0], rewards[0]);
});

test("round-robin assigns each reward exactly once in party order", () => {
  const items = [{ id: "one" }, { id: "two" }, { id: "three" }];
  const result = distributeLoot(items, "round-robin", [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(result.map(x => x.playerId), ["a", "b", "a"]);
  assert.deepEqual(result.map(x => x.item), items);
});

test("master loot returns a copied assignment queue", () => {
  const items = [{ id: "boss-drop" }];
  const result = distributeLoot(items, "master-loot", [{ id: "leader" }]);
  assert.equal(result.requiresLeaderAssignment, true);
  result.items[0].id = "changed";
  assert.equal(items[0].id, "boss-drop");
});

test("distribution rejects empty or duplicate party ids and unknown modes", () => {
  assert.throws(() => distributeLoot([], "round-robin", []), /non-empty party/i);
  assert.throws(() => distributeLoot([], "personal", [{ id: "same" }, { id: "same" }]), /unique/i);
  assert.throws(() => distributeLoot([], "unknown", [{ id: "a" }]), /unknown loot mode/i);
});
