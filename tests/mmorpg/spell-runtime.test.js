import test from "node:test";
import assert from "node:assert/strict";
import { castSpell } from "../../src/mmorpg/rules/spell-runtime.js";
import { createSpellState } from "../../src/mmorpg/rules/spellcasting.js";

function caster() {
  return {
    id: "mage", abilities: { int: 18 }, spellcastingAbility: "int",
    proficiencyBonus: 3, spellState: createSpellState(5),
    actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true,
    position: { x: 0, y: 0, z: 0 }
  };
}
function target() {
  return { id: "goblin", hp: 20, maxHp: 20, ac: 10, abilities: { dex: 10, wis: 10 }, position: { x: 5, y: 0, z: 0 }, conditions: [] };
}

test("spell attack resolves hit, damage, spell slot and action economy", () => {
  const mage = caster(), goblin = target();
  mage.spellState.known.push("arc-bolt");
  const result = castSpell({
    caster: mage, targets: [goblin],
    spell: { id: "arc-bolt", level: 1, attack: true, damage: "1d8", damageType: "force", rangeFeet: 30 },
    random: () => 0.99
  });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].hit, true);
  assert.equal(goblin.hp, 12);
  assert.equal(mage.spellState.slots[0].remaining, 3);
  assert.equal(mage.actionAvailable, false);
});

test("saving throw can halve damage and upcast scaling is applied", () => {
  const mage = caster(), goblin = target();
  const result = castSpell({
    caster: mage, targets: [goblin], slotLevel: 2,
    spell: { id: "frost-burst", level: 1, saveAbility: "dex", damage: "1d6", damagePerSlotLevel: "1d6", saveForHalf: true, damageType: "cold" },
    random: () => 0.99
  });
  assert.equal(result.ok, true);
  assert.equal(goblin.hp, 14);
});

test("failed validation does not consume spell slot or action", () => {
  const mage = caster(), goblin = target();
  const result = castSpell({
    caster: mage, targets: [goblin],
    spell: { id: "far-ray", level: 1, attack: true, damage: "1d6", rangeFeet: 2 },
    random: () => 0.5
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "out_of_range");
  assert.equal(mage.spellState.slots[0].remaining, 4);
  assert.equal(mage.actionAvailable, true);
});

test("spell can apply timed conditions and concentration", () => {
  const mage = caster(), goblin = target();
  const result = castSpell({
    caster: mage, targets: [goblin],
    spell: { id: "binding-mist", level: 1, saveAbility: "dex", condition: "restrained", conditionDuration: 2, concentration: true },
    random: () => 0
  });
  assert.equal(result.ok, true);
  assert.equal(goblin.conditions[0].id, "restrained");
  assert.equal(mage.spellState.concentration, "binding-mist");
});

test("critical spell attacks double damage dice", () => {
  const mage = caster(), goblin = target();
  const result = castSpell({
    caster: mage, targets: [goblin],
    spell: { id: "critical-ray", level: 1, attack: true, damage: "1d8", damageType: "force" },
    random: () => 0.99
  });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].damage, 16);
  assert.equal(goblin.hp, 4);
});

test("healing spells respect the target maximum hit points", () => {
  const mage = caster();
  const ally = { id: "ally", hp: 8, maxHp: 10, position: { x: 1, y: 0, z: 0 } };
  const result = castSpell({
    caster: mage, targets: [ally],
    spell: { id: "restore", level: 1, healing: "1d8" },
    random: () => 0.99
  });
  assert.equal(result.ok, true);
  assert.equal(ally.hp, 10);
  assert.equal(result.results[0].healing, 2);
});
