import test from "node:test";
import assert from "node:assert/strict";
import { useClassAbility } from "../../src/mmorpg/rules/class-ability-runtime.js";
import { configureClassResources } from "../../src/mmorpg/rules/class-resources.js";

function actor() {
  const value = {
    id: "hero", level: 5, abilities: { str: 16, wis: 14 },
    actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true
  };
  configureClassResources(value, [{ id: "focus", max: 3, recovery: "short_rest" }], 5);
  return value;
}
function target() {
  return { id: "foe", hp: 30, maxHp: 30, ac: 10, level: 2, abilities: { dex: 10, con: 10 }, conditions: [] };
}
const hitRandom = () => 0.99;

test("executes a resource-powered attack and applies critical damage", () => {
  const hero = actor();
  const foe = target();
  const result = useClassAbility({
    actor: hero, targets: [foe], random: hitRandom,
    ability: {
      id: "power-strike", actionCost: "action",
      resourceCosts: [{ resourceId: "focus", amount: 1 }],
      effects: [{ type: "damage", dice: "1d8", damageType: "slashing", attackAbility: "str", proficient: true }]
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].effects[0].attack.critical, true);
  assert.equal(result.results[0].effects[0].dealt, 16);
  assert.equal(foe.hp, 14);
  assert.equal(hero.classResources.focus.remaining, 2);
  assert.equal(hero.actionAvailable, false);
});

test("failed attack still spends the declared action but deals no damage", () => {
  const hero = actor();
  const foe = target();
  const result = useClassAbility({
    actor: hero, targets: [foe], random: () => 0,
    ability: { id: "swing", effects: [{ type: "damage", dice: "1d6", attackAbility: "str" }] }
  });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].effects[0].type, "miss");
  assert.equal(foe.hp, 30);
  assert.equal(hero.actionAvailable, false);
});

test("resource or action validation fails without spending either cost", () => {
  const hero = actor();
  const foe = target();
  const ability = {
    id: "costly", resourceCosts: [{ resourceId: "focus", amount: 4 }],
    effects: [{ type: "damage", dice: "1d6" }]
  };
  assert.deepEqual(useClassAbility({ actor: hero, targets: [foe], ability }), {
    ok: false, reason: "insufficient_resource", resourceId: "focus"
  });
  assert.equal(hero.actionAvailable, true);
  assert.equal(hero.classResources.focus.remaining, 3);
  hero.actionAvailable = false;
  assert.deepEqual(useClassAbility({ actor: hero, targets: [foe], ability: { ...ability, resourceCosts: [] } }), {
    ok: false, reason: "action_unavailable", actionCost: "action"
  });
});

test("saving throw damage supports half damage on success", () => {
  const hero = actor();
  const foe = target();
  const result = useClassAbility({
    actor: hero, targets: [foe], random: () => 0.99,
    ability: {
      id: "shockwave",
      effects: [{ type: "damage", dice: "2d6", damageType: "thunder", save: { ability: "dex", dc: 15, onSuccess: "half" } }]
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].effects[0].save.success, true);
  assert.equal(result.results[0].effects[0].dealt, 6);
  assert.equal(foe.hp, 24);
});

test("healing is capped at maximum HP and conditions are applied", () => {
  const hero = actor();
  const ally = { id: "ally", hp: 8, maxHp: 10, conditions: [] };
  const result = useClassAbility({
    actor: hero, targets: [ally], random: () => 0.99,
    ability: {
      id: "battle-cry", actionCost: "bonusAction",
      effects: [
        { type: "healing", dice: "1d8", modifier: 5 },
        { type: "condition", condition: "poisoned", duration: 2 }
      ]
    }
  });
  assert.equal(result.ok, true);
  assert.equal(ally.hp, 10);
  assert.equal(result.results[0].effects[0].healed, 2);
  assert.equal(ally.conditions.some(condition => condition.id === "poisoned"), true);
  assert.equal(hero.bonusActionAvailable, false);
});

test("rejects malformed ability definitions and defeated targets", () => {
  const hero = actor();
  assert.throws(() => useClassAbility({
    actor: hero, targets: [target()], ability: { id: "bad", effects: [{ type: "teleport" }] }
  }), /unsupported ability effect/i);
  const dead = target();
  dead.defeated = true;
  assert.deepEqual(useClassAbility({
    actor: hero, targets: [dead], ability: { id: "heal", effects: [{ type: "healing", dice: "1d4" }] }
  }), { ok: false, reason: "invalid_target" });
});
