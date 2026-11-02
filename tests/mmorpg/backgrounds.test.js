import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../../src/mmorpg/rules/character.js";
import { BACKGROUND_CATALOG, applyBackground, createBackgroundCatalog } from "../../src/mmorpg/systems/backgrounds.js";

test("original background catalog has validated proficiencies, features and starting equipment", () => {
  assert.equal(BACKGROUND_CATALOG.size, 6);
  for (const background of BACKGROUND_CATALOG.list()) {
    assert.equal(background.skillProficiencies.length, 2);
    assert.ok(background.feature.id);
    assert.ok(background.startingEquipment.length > 0);
  }
  assert.equal(BACKGROUND_CATALOG.list({ query: "harbor" })[0].id, "harborhand");
  assert.throws(() => createBackgroundCatalog([{ id: "bad", name: "Bad", skillProficiencies: ["not-a-skill", "arcana"], toolProficiencies: [], startingEquipment: [], feature: { id: "bad", detail: "Bad" } }]), /skill proficiencies/);
});

test("character creation applies background proficiencies, feature and starter gear", () => {
  const character = createCharacter({
    id: "background-hero", name: "Rin", species: "human", classId: "ranger",
    background: "apothecary", abilities: { int: 14, wis: 15 }
  });
  assert.deepEqual(character.proficiencies.skills, ["medicine", "nature"]);
  assert.deepEqual(character.proficiencies.tools, ["tool:herbalism-kit"]);
  assert.equal(character.backgroundFeature.id, "apothecary-field-notes");
  assert.deepEqual(character.inventory.items.map(item => item.id), ["gear:torch", "tool:herbalism-kit"]);
  assert.ok(character.inventory.items.every(item => Number.isFinite(item.weight)));
});

test("background grant is one-time and a full inventory fails without partial mutation", () => {
  const character = createCharacter({
    id: "single-background", name: "Ari", species: "elf", classId: "bard",
    abilities: { cha: 14 }
  });
  assert.deepEqual(applyBackground(character, "wanderer"), { ok: false, reason: "background_already_applied" });
  const full = {
    proficiencies: { skills: [], tools: [], saves: [], weapons: [], armor: [] },
    inventory: { capacity: 1, maxWeight: 100, items: [] }
  };
  const result = applyBackground(full, "wanderer");
  assert.deepEqual(result, { ok: false, reason: "slots_full", itemId: "tool:cartographer-s-tools" });
  assert.deepEqual(full.proficiencies.skills, []);
  assert.equal(full.backgroundId, undefined);
  assert.deepEqual(full.inventory.items, []);
  assert.deepEqual(applyBackground(full, "missing"), { ok: false, reason: "background_not_found" });
});
