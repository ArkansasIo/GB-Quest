import test from "node:test";
import assert from "node:assert/strict";
import {
  configureClassResources, spendClassResource, recoverClassResources,
  restoreClassResource, getClassResourceStatus
} from "../../src/mmorpg/rules/class-resources.js";

const definitions = [
  { id: "rage", name: "Rage", max: [2, 2, 3, 3], recovery: "long_rest" },
  { id: "focus", max: [0, 0, 2, 2], recovery: "short_rest" },
  { id: "oath-charge", max: 1, recovery: "manual" },
  { id: "passive", max: 1, recovery: "never", spendable: false }
];

test("class resources initialize from authored level-based maxima", () => {
  const character = {};
  const status = configureClassResources(character, definitions, 3);
  assert.equal(status.classLevel, 3);
  assert.deepEqual(status.resources.map(resource => [resource.id, resource.maximum, resource.remaining]), [
    ["rage", 3, 3], ["focus", 2, 2], ["oath-charge", 1, 1], ["passive", 1, 1]
  ]);
});

test("spending validates resource, amount, spendability and available balance", () => {
  const character = {};
  configureClassResources(character, definitions, 3);
  assert.deepEqual(spendClassResource(character, "rage", 2), {
    ok: true, resourceId: "rage", spent: 2, remaining: 1
  });
  assert.deepEqual(spendClassResource(character, "rage", 2), {
    ok: false, reason: "insufficient_resource"
  });
  assert.deepEqual(spendClassResource(character, "missing"), {
    ok: false, reason: "resource_not_found"
  });
  assert.deepEqual(spendClassResource(character, "passive"), {
    ok: false, reason: "resource_not_spendable"
  });
  assert.throws(() => spendClassResource(character, "rage", 0), RangeError);
});

test("short and long rests recover only resources assigned to that trigger", () => {
  const character = {};
  configureClassResources(character, definitions, 3);
  spendClassResource(character, "rage", 2);
  spendClassResource(character, "focus", 1);
  spendClassResource(character, "oath-charge", 1);

  assert.deepEqual(recoverClassResources(character, "short_rest").recovered, [
    { resourceId: "focus", amount: 1, remaining: 2 }
  ]);
  assert.equal(character.classResources.rage.remaining, 1);
  assert.deepEqual(recoverClassResources(character, "long_rest").recovered, [
    { resourceId: "rage", amount: 2, remaining: 3 }
  ]);
  assert.equal(character.classResources.oathCharge, undefined);
  assert.deepEqual(recoverClassResources(character, "manual"), {
    ok: false, reason: "invalid_recovery_trigger"
  });
});

test("manual restoration is capped at maximum and does not alter other resources", () => {
  const character = {};
  configureClassResources(character, definitions, 3);
  spendClassResource(character, "oath-charge");
  assert.deepEqual(restoreClassResource(character, "oath-charge", 3), {
    ok: true, resourceId: "oath-charge", restored: 1, remaining: 1
  });
  assert.deepEqual(restoreClassResource(character, "unknown"), {
    ok: false, reason: "resource_not_found"
  });
  assert.throws(() => restoreClassResource(character, "rage", -1), RangeError);
});

test("reconfiguration preserves remaining uses and clamps them to a reduced maximum", () => {
  const character = {};
  configureClassResources(character, definitions, 3);
  spendClassResource(character, "rage", 2);
  const status = configureClassResources(character, definitions, 2);
  assert.equal(status.resources.find(resource => resource.id === "rage").remaining, 1);
  assert.equal(status.resources.find(resource => resource.id === "rage").maximum, 2);
  assert.equal(status.resources.find(resource => resource.id === "focus").maximum, 0);
});

test("resource definitions reject invalid levels, maxima, recovery and duplicate IDs", () => {
  assert.throws(() => configureClassResources({}, [], 0), RangeError);
  assert.throws(() => configureClassResources({}, [{ id: "x", max: -1 }], 1), /maximum/i);
  assert.throws(() => configureClassResources({}, [{ id: "x", max: 1, recovery: "weekly" }], 1), /recovery/i);
  assert.throws(() => configureClassResources({}, [
    { id: "x", max: 1 }, { id: "x", max: 2 }
  ], 1), /unique/i);
});

test("resource status returns a safe display projection", () => {
  const character = {};
  configureClassResources(character, definitions, 3);
  spendClassResource(character, "rage");
  const status = getClassResourceStatus(character);
  assert.equal(status.resources.find(resource => resource.id === "rage").remaining, 2);
  assert.equal(status.resources.find(resource => resource.id === "rage").maximum, 3);
});
