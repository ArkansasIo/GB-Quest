import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PROFESSION_SKILL, canCraft, craftRecipe, createProfessionState, gainProfessionSkill,
  gatherResource, getProfessionProgress, learnProfession, learnRecipe, listGatheringNodes,
  listProfessionRecipes, listProfessions, validateProfessionCatalog
} from "../../src/mmorpg/systems/professions.js";
import { addItem, createInventory } from "../../src/mmorpg/systems/inventory.js";

test("provides 18 original professions split across gathering and crafting", () => {
  assert.deepEqual(validateProfessionCatalog(), {
    valid: true,
    professionCount: 18,
    gatheringProfessions: 9,
    craftingProfessions: 9,
    recipeCount: 18,
    gatheringNodeCount: 22,
    invalidRecipeIds: [],
    invalidNodeIds: []
  });
  assert.equal(listProfessions().length, 18);
  assert.equal(listProfessions({ category: "gathering" }).length, 9);
  assert.equal(listProfessions({ category: "crafting" }).length, 9);
  assert.equal(listProfessions({ query: "rune" })[0].id, "rune-scribing");
});

test("learns professions and advances skill through rank tiers up to the cap", () => {
  const state = createProfessionState();
  assert.equal(learnProfession(state, "herbalism"), true);
  assert.equal(learnProfession(state, "herbalism"), false);
  assert.deepEqual(getProfessionProgress(state, "herbalism"), {
    professionId: "herbalism", skill: 1, rank: "apprentice", experience: 0, experienceToNext: 30
  });
  const progress = gainProfessionSkill(state, "herbalism", 1000000);
  assert.equal(progress.skill, MAX_PROFESSION_SKILL);
  assert.equal(progress.rank, "master");
  assert.equal(progress.experience, 0);
  assert.equal(progress.experienceToNext, 0);
  assert.throws(() => learnProfession(state, "not-a-profession"), /Unknown profession/);
});

test("gathers resources with skill requirements, cooldowns and inventory capacity", () => {
  const state = createProfessionState();
  const inventory = createInventory({ capacity: 1 });
  const node = "elderwood-bitterleaf";
  assert.equal(gatherResource(state, node, { now: 1000 }).reason, "profession_not_learned");
  learnProfession(state, "herbalism");
  const gathered = gatherResource(state, node, { inventory, now: 1000, random: () => 0.99 });
  assert.equal(gathered.ok, true);
  assert.equal(gathered.quantity, 2);
  assert.equal(inventory.items[0].id, "bitterleaf");
  assert.equal(gatherResource(state, node, { inventory, now: 2000 }).reason, "node_depleted");
  assert.equal(gatherResource(state, node, { inventory, now: gathered.availableAt }).ok, true);
  const advanced = listGatheringNodes({ professionId: "herbalism", skill: 1 })
    .find(entry => entry.requiredSkill > 1);
  assert.equal(advanced, undefined);
  assert.throws(() => gatherResource(state, node, { now: 0, random: () => 1 }), /Random source/);
});

test("crafts only known recipes at their station and commits materials and products atomically", () => {
  const state = createProfessionState();
  const inventory = createInventory({ capacity: 4 });
  learnProfession(state, "alchemy");
  const recipe = listProfessionRecipes({ professionId: "alchemy" })[0];
  assert.equal(learnRecipe(state, recipe.id), true);
  assert.equal(learnRecipe(state, recipe.id), false);
  assert.equal(canCraft(state, recipe, inventory).reason, "missing_materials");
  for (const ingredient of recipe.ingredients) {
    assert.equal(addItem(inventory, { id: ingredient.id, name: ingredient.id, weight: 0.1 }, ingredient.quantity).ok, true);
  }
  const before = structuredClone(inventory);
  assert.equal(craftRecipe(state, recipe.id, inventory).reason, "wrong_station");
  assert.deepEqual(inventory, before);
  const crafted = craftRecipe(state, recipe, inventory, { station: "alchemy-lab" });
  assert.equal(crafted.ok, true);
  assert.equal(inventory.items.find(item => item.id === recipe.output.id).quantity, recipe.output.quantity);
  assert.ok(crafted.skill.experience > 0);
  assert.equal(canCraft(state, recipe, inventory).reason, "missing_materials");
});

test("enforces recipe skill requirements and leaves full inventories unchanged", () => {
  const state = createProfessionState();
  learnProfession(state, "alchemy");
  const advanced = listProfessionRecipes({ professionId: "alchemy" }).find(recipe => recipe.requiredSkill > 1);
  assert.equal(learnRecipe(state, advanced.id), false);
  gainProfessionSkill(state, "alchemy", 1000000);
  assert.equal(learnRecipe(state, advanced.id), true);
  const inventory = createInventory({ capacity: 2 });
  addItem(inventory, { id: "moonpetal", weight: 0.1 }, 4);
  addItem(inventory, { id: "clearwater", weight: 0.1 }, 4);
  const before = structuredClone(inventory);
  const result = craftRecipe(state, advanced, inventory, { station: "alchemy-lab" });
  assert.equal(result.reason, "inventory_slots_full");
  assert.deepEqual(inventory, before);
});
