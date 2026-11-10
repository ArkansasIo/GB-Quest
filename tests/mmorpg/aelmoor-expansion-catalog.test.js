import test from "node:test";
import assert from "node:assert/strict";
import expansion from "../../src/mmorpg/data/aelmoor-expansion.json" with { type: "json" };
import { listCatalogItems, getEquipmentCatalogSummary } from "../../src/mmorpg/systems/itemization.js";
import { listSpells, getSpellCatalogSummary } from "../../src/mmorpg/systems/spell-catalog.js";
import { CLASS_ABILITY_CATALOG } from "../../src/mmorpg/systems/class-abilities.js";
import { TALENT_CATALOG } from "../../src/mmorpg/systems/talent-catalog.js";

test("original MMO expansion includes broad weapon and armor coverage", () => {
  assert.equal(expansion.weapons.length, 48);
  assert.equal(expansion.armor.length, 120);
  assert.equal(new Set(expansion.weapons.map(x => x.id)).size, expansion.weapons.length);
  assert.equal(new Set(expansion.armor.map(x => x.id)).size, expansion.armor.length);
  assert.ok(getEquipmentCatalogSummary().weapons >= 86);
  assert.ok(getEquipmentCatalogSummary().armor >= 133);
  assert.ok(listCatalogItems({ query: "Aetherweave" }).length > 0);
});

test("expanded original spell records are registered in spell catalog", () => {
  assert.equal(expansion.spells.length, 120);
  assert.ok(getSpellCatalogSummary().total >= expansion.spells.length);
  for (const spell of expansion.spells) assert.ok(listSpells({ query: spell.id, limit: 1 }).some(x => x.id === spell.id));
});

test("expanded active abilities validate and unlock by class level", () => {
  assert.equal(expansion.abilities.length, 60);
  for (const ability of expansion.abilities) assert.equal(CLASS_ABILITY_CATALOG.get(ability.id)?.id, ability.id);
  assert.ok(CLASS_ABILITY_CATALOG.forCharacter({ classId: "fighter", level: 5 }).length >= 3);
});

test("talent trees enforce class, level and talent-point requirements", () => {
  assert.equal(TALENT_CATALOG.size, 60);
  const character = { classId: "fighter", level: 10, talentPoints: 2, talents: [] };
  const talent = TALENT_CATALOG.list({ classId: "fighter" })[0];
  assert.equal(TALENT_CATALOG.learn({ ...character, level: 1 }, talent.id).reason, "level_too_low");
  assert.equal(TALENT_CATALOG.learn(character, talent.id).ok, true);
  assert.equal(character.talentPoints, 1);
  assert.equal(TALENT_CATALOG.learn(character, talent.id).reason, "already_learned");
  assert.equal(TALENT_CATALOG.learn({ classId: "wizard", level: 80, talentPoints: 2 }, talent.id).reason, "wrong_class");
});
