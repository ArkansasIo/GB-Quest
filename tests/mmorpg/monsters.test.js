import test from "node:test";
import assert from "node:assert/strict";
import {
  MONSTERS, getMonster, searchMonsters, createMonsterCombatant,
  rollMonsterInitiative, buildMonsterEncounter, getMonsterExperience,
  getMonsterCatalogSummary
} from "../../src/mmorpg/systems/monsters.js";

test("loads the complete SRD 5.2.1 monster dataset", () => {
  assert.equal(MONSTERS.length, 322);
  assert.ok(getMonster("Tarrasque"));
  assert.ok(getMonster("srd:aboleth"));
  assert.equal(getMonsterCatalogSummary().challengeRatingRange[1], 30);
});

test("searches by name, creature type, size and challenge rating", () => {
  assert.ok(searchMonsters({ query: "dragon" }).some((m) => m.name === "Adult Red Dragon"));
  assert.ok(searchMonsters({ type: "undead" }).every((m) => m.type === "undead"));
  assert.ok(searchMonsters({ size: "Gargantuan" }).every((m) => m.size === "Gargantuan"));
  assert.ok(searchMonsters({ minCr: 20 }).every((m) => m.cr_numeric >= 20));
  assert.ok(searchMonsters({ cr: "1/4" }).every((m) => m.cr === "1/4"));
});

test("creates an isolated combatant with average hit points and full stat block", () => {
  const monster = createMonsterCombatant("Goblin", { id: "goblin-1" });
  assert.equal(monster.id, "goblin-1");
  assert.equal(monster.hp, monster.maxHp);
  assert.equal(monster.armorClass, getMonster("Goblin").armor_class);
  assert.ok(Array.isArray(monster.statBlock.actions));
  monster.statBlock.actions.push({ name: "Test-only mutation" });
  assert.equal(getMonster("Goblin").stat_block_json.actions.some((a) => a.name === "Test-only mutation"), false);
});

test("rolls hit points from the monster hit-dice formula", () => {
  const monster = createMonsterCombatant("Goblin", { hpMode: "roll", random: () => 0 });
  assert.equal(monster.hp, 2);
  assert.throws(() => createMonsterCombatant("Goblin", { hpMode: "random" }), /hpMode/);
});

test("calculates monster initiative and challenge experience", () => {
  const monster = createMonsterCombatant("Tarrasque");
  assert.deepEqual(rollMonsterInitiative(monster, () => 0.99), { d20: 20, total: 20 });
  assert.equal(getMonsterExperience("Tarrasque"), 155000);
  assert.equal(getMonsterExperience("Goblin"), 50);
});

test("builds multi-monster encounters and totals XP", () => {
  const encounter = buildMonsterEncounter([
    "Goblin",
    { monster: "Wolf", quantity: 2 }
  ]);
  assert.equal(encounter.monsterCount, 3);
  assert.equal(encounter.totalExperience, 150);
  assert.equal(new Set(encounter.combatants.map((c) => c.id)).size, 3);
});

test("rejects unknown monsters and malformed encounter inputs", () => {
  assert.equal(getMonster("Not a real monster"), null);
  assert.throws(() => createMonsterCombatant("Not a real monster"), /Unknown/);
  assert.throws(() => buildMonsterEncounter({}), /array/);
});
