import test from "node:test";
import assert from "node:assert/strict";
import { abilityModifier, proficiencyBonus, rollD20, rollCheck, meetsTarget } from "../../src/mmorpg/rules/d20.js";

test("ability modifiers use floor division for odd and negative scores", () => {
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(9), -1);
  assert.equal(abilityModifier(1), -5);
  assert.equal(abilityModifier(30), 10);
});

test("proficiency bonus follows the bounded level 1-20 curve", () => {
  assert.deepEqual([1, 5, 9, 13, 17].map(proficiencyBonus), [2, 3, 4, 5, 6]);
  assert.throws(() => proficiencyBonus(0), RangeError);
  assert.throws(() => proficiencyBonus(21), RangeError);
});

test("d20 rolls validate the random source and include both endpoints", () => {
  assert.equal(rollD20(() => 0), 1);
  assert.equal(rollD20(() => 0.999999), 20);
  assert.throws(() => rollD20(() => 1), RangeError);
  assert.throws(() => rollD20(() => -0.1), RangeError);
});

test("checks support proficiency, advantage and disadvantage deterministically", () => {
  const normal = rollCheck({ ability: "str", score: 16, proficient: true, level: 5 }, () => 0.5);
  assert.deepEqual(normal.rolls, [11]);
  assert.equal(normal.modifier, 6);
  assert.equal(normal.total, 17);
  const advantage = rollCheck({ ability: "dex", score: 12, advantage: 1 }, (() => {
    const values = [0.1, 0.9]; return () => values.shift();
  })());
  assert.deepEqual(advantage.rolls, [3, 19]);
  assert.equal(advantage.die, 19);
  const disadvantage = rollCheck({ ability: "wis", score: 12, advantage: -1 }, (() => {
    const values = [0.9, 0.1]; return () => values.shift();
  })());
  assert.deepEqual(disadvantage.rolls, [19, 3]);
  assert.equal(disadvantage.die, 3);
});

test("target resolution is inclusive", () => {
  assert.equal(meetsTarget(15, 15), true);
  assert.equal(meetsTarget(14, 15), false);
});
