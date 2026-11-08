import test from "node:test";
import assert from "node:assert/strict";
import { xpForLevel, progressionAt, levelFromXp, paragonRewardTrack } from "../../src/mmorpg/progression/level-progression.js";

test("D20 levels use the standard XP thresholds through level 20", () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 300);
  assert.equal(xpForLevel(20), 355000);
});

test("Paragon levels extend to 720 without extending class level", () => {
  const p = progressionAt(720);
  assert.equal(p.classLevel, 20);
  assert.equal(p.paragonLevel, 700);
  assert.equal(p.isMaxLevel, true);
});

test("XP lookup returns highest reached level", () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(300), 2);
  assert.equal(levelFromXp(xpForLevel(720)), 720);
});

test("Paragon milestone rewards are deterministic", () => {
  assert.deepEqual(paragonRewardTrack(25), ["mastery_point"]);
  assert.deepEqual(paragonRewardTrack(40), ["mastery_point", "cosmetic_or_title", "specialization_perk_choice"]);
});

test("invalid levels and XP are rejected", () => {
  assert.throws(() => xpForLevel(721), RangeError);
  assert.throws(() => levelFromXp(-1), RangeError);
});
