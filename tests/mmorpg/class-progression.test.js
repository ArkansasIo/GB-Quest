import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceClassLevel, chooseSubclass, getClassProgressionStatus
} from "../../src/mmorpg/rules/class-progression.js";

const fighter = {
  id: "fighter",
  levels: [
    { level: 2, features: [{ id: "action-surge", name: "Action Surge" }] },
    { level: 3, features: [{ id: "martial-archetype", name: "Martial Archetype" }] },
    { level: 4, features: [{ id: "ability-score-improvement", name: "Ability Score Improvement" }] }
  ],
  subclass: {
    unlockLevel: 3,
    options: [
      { id: "champion", name: "Champion", levels: [
        { level: 3, features: [{ id: "improved-critical", name: "Improved Critical" }] },
        { level: 4, features: [{ id: "remarkable-athlete", name: "Remarkable Athlete" }] }
      ] },
      { id: "battle-master", name: "Battle Master", levels: [
        { level: 3, features: [{ id: "combat-superiority", name: "Combat Superiority" }] }
      ] }
    ]
  }
};

test("class levels advance independently and grant only the matching level row", () => {
  const character = { id: "p1", classId: "fighter", level: 1, features: [] };
  const result = advanceClassLevel(character, { id: "fighter" }, fighter, 2);
  assert.deepEqual(result.granted, ["action-surge"]);
  assert.equal(character.classLevel, 2);
  assert.equal(character.proficiencyBonus, 2);
});

test("subclass unlock requests a choice and prevents skipping it", () => {
  const character = { classId: "fighter", level: 2, features: [] };
  const unlock = advanceClassLevel(character, { id: "fighter" }, fighter, 3);
  assert.equal(unlock.choiceRequired, true);
  assert.deepEqual(unlock.choices.map(x => x.id), ["champion", "battle-master"]);
  assert.throws(() => advanceClassLevel(character, { id: "fighter" }, fighter, 4), /subclass choice/i);
});

test("subclass selection grants current-level features and later level features", () => {
  const character = { classId: "fighter", level: 2, features: [] };
  advanceClassLevel(character, { id: "fighter" }, fighter, 3);
  const selected = chooseSubclass(character, fighter, "champion");
  assert.deepEqual(selected.granted, ["improved-critical"]);
  const next = advanceClassLevel(character, { id: "fighter" }, fighter, 4);
  assert.deepEqual(next.granted, ["ability-score-improvement", "remarkable-athlete"]);
  assert.equal(character.features.filter(x => x.id === "improved-critical").length, 1);
});

test("subclass selection rejects invalid and repeated choices", () => {
  const character = { classId: "fighter", level: 3, features: [] };
  assert.throws(() => chooseSubclass(character, fighter, "wizard"), /unknown subclass/i);
  chooseSubclass(character, fighter, "battle-master");
  assert.throws(() => chooseSubclass(character, fighter, "champion"), /already been selected/i);
});

test("progression validates sequential levels and exposes choice status", () => {
  const character = { classId: "fighter", level: 1, features: [] };
  assert.throws(() => advanceClassLevel(character, { id: "fighter" }, fighter, 3), /one level at a time/i);
  character.level = 3;
  assert.deepEqual(getClassProgressionStatus(character, fighter), {
    classId: "fighter", classLevel: 3, subclassId: null,
    subclassUnlocked: true, subclassChoiceRequired: true
  });
});

test("progression rejects a mismatched class and invalid level", () => {
  const character = { level: 1, features: [] };
  assert.throws(() => advanceClassLevel(character, { id: "wizard" }, fighter, 2), /matching class/i);
  assert.throws(() => advanceClassLevel(character, { id: "fighter" }, fighter, 21), RangeError);
});
