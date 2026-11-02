import test from "node:test";
import assert from "node:assert/strict";
import { CLASS_ABILITY_CATALOG } from "../../src/mmorpg/systems/class-abilities.js";
import { useClassAbility } from "../../src/mmorpg/rules/class-ability-runtime.js";

test("original class ability catalog covers all twelve classes and their catalogued subclasses", () => {
  assert.equal(CLASS_ABILITY_CATALOG.size, 24);
  for (const classId of [
    "barbarian", "bard", "cleric", "druid", "fighter", "monk",
    "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"
  ]) {
    const records = CLASS_ABILITY_CATALOG.list({ classId });
    assert.equal(records.length, 2, `${classId} should have a base and subclass ability`);
    assert.equal(records.filter(record => !record.subclassId).length, 1);
    assert.equal(records.filter(record => record.subclassId).length, 1);
  }
});

test("character ability list respects class, subclass and level", () => {
  const wizard = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 2 });
  assert.deepEqual(wizard.map(ability => ability.id), ["wizard-arcane-burst"]);

  const evoker = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 3, subclassId: "evoker" });
  assert.deepEqual(evoker.map(ability => ability.id), ["wizard-arcane-burst", "wizard-evoker-prismatic-surge"]);

  const otherSubclass = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 3, subclassId: "unknown" });
  assert.deepEqual(otherSubclass.map(ability => ability.id), ["wizard-arcane-burst"]);
  assert.throws(() => CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 21 }), /class level/);
});

test("every catalogued ability executes through the shared class ability runtime", () => {
  for (const ability of CLASS_ABILITY_CATALOG.list({ limit: 100 })) {
    const actor = {
      id: "hero", level: 5, classLevel: 5, abilities: { str: 16, dex: 16, cha: 16, wis: 16 },
      proficiencyBonus: 3, actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true
    };
    const target = {
      id: "target", hp: 100, maxHp: 100, ac: 10, level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, conditions: []
    };
    const result = useClassAbility({ actor, targets: [target], ability, random: () => 0.99 });
    assert.equal(result.ok, true, ability.id);
    assert.equal(result.abilityId, ability.id);
    assert.ok(result.results[0].effects.length > 0, ability.id);
  }
});
