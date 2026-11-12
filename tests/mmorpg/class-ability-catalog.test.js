import test from "node:test";
import assert from "node:assert/strict";
import classes from "../../src/mmorpg/data/classes.json" with { type: "json" };
import { CLASS_ABILITY_CATALOG } from "../../src/mmorpg/systems/class-abilities.js";
import { useClassAbility } from "../../src/mmorpg/rules/class-ability-runtime.js";

const expectedSubclassIds = Object.fromEntries(
  classes.classes.map(c => [c.id, new Set(c.subclasses.map(s => s.id))])
);

test("class ability catalog covers all twelve classes, each with base + every SRD subclass ability", () => {
  let total = 0;
  for (const classId of Object.keys(expectedSubclassIds)) {
    const records = CLASS_ABILITY_CATALOG.list({ classId });
    const base = records.filter(record => !record.subclassId);
    assert.ok(base.length >= 1, `${classId} should have at least one base ability`);
    total += base.length;
    const subIds = new Set(records.filter(record => record.subclassId).map(record => record.subclassId));
    for (const subId of expectedSubclassIds[classId]) {
      assert.ok(subIds.has(subId), `${classId} missing ability for subclass ${subId}`);
    }
    total += records.filter(record => record.subclassId).length;
  }
  assert.ok(total >= 24, `catalog should have at least 24 abilities, got ${total}`);
});

test("character ability list respects class, subclass and level", () => {
  const wizard = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 2 });
  assert.ok(wizard.some(ability => ability.id === "wizard-arcane-burst"));\n  assert.ok(wizard.every(ability => ability.level <= 2));

  const evoker = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 3, subclassId: "evoker" });
  assert.ok(evoker.some(ability => ability.id === "wizard-arcane-burst"));\n  assert.ok(evoker.some(ability => ability.id === "wizard-evoker-prismatic-surge"));

  const abjurer = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 3, subclassId: "abjurer" });
  assert.ok(abjurer.some(ability => ability.id === "wizard-arcane-burst"));\n  assert.ok(abjurer.some(ability => ability.id === "wizard-abjurer-arcane-ward"));

  const diviner = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 3, subclassId: "diviner" });
  assert.ok(diviner.some(ability => ability.id === "wizard-arcane-burst"));\n  assert.ok(diviner.some(ability => ability.id === "wizard-diviner-portent"));

  const otherSubclass = CLASS_ABILITY_CATALOG.forCharacter({ classId: "wizard", level: 3, subclassId: "unknown" });
  assert.ok(otherSubclass.every(ability => !ability.subclassId));\n  assert.ok(otherSubclass.some(ability => ability.id === "wizard-arcane-burst"));
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
