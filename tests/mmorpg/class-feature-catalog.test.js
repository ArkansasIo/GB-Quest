import test from "node:test";
import assert from "node:assert/strict";
import {
  createClassFeatureCatalog, checkFeaturePrerequisites
} from "../../src/mmorpg/rules/class-feature-catalog.js";

const data = [{
  classId: "fighter",
  levels: [
    { level: 1, features: [{ id: "fighter-style", name: "Fighting Style" }] },
    { level: 2, features: [{ id: "fighter-surge", prerequisites: [{ type: "class_level", level: 2 }] }] },
    { level: 4, features: [{ id: "fighter-improvement", prerequisites: [{ type: "feature", id: "fighter-style" }] }] }
  ],
  subclass: {
    unlockLevel: 3,
    options: [{
      id: "champion", name: "Champion",
      levels: [{ level: 3, features: [{ id: "champion-critical", prerequisites: [{ type: "ability_score", ability: "str", minimum: 13 }] }] }]
    }]
  }
}];

test("catalog indexes class and subclass features through requested level", () => {
  const catalog = createClassFeatureCatalog(data);
  assert.equal(catalog.size, 1);
  assert.deepEqual(catalog.listClasses(), ["fighter"]);
  assert.deepEqual(catalog.getFeatures("fighter", 2).map(item => item.id), ["fighter-style", "fighter-surge"]);
  assert.deepEqual(catalog.getFeatures("fighter", 4, "champion").map(item => item.id), [
    "fighter-style", "fighter-surge", "fighter-improvement", "champion-critical"
  ]);
  assert.equal(catalog.getClass("wizard"), null);
});

test("feature prerequisites report missing feature, level and ability requirements", () => {
  const feature = createClassFeatureCatalog(data).getFeatures("fighter", 4, "champion")[3];
  const check = checkFeaturePrerequisites(feature, { classLevel: 2, abilities: { str: 10 }, features: [] });
  assert.equal(check.eligible, false);
  assert.deepEqual(check.missing.map(item => item.reason), ["ability_score_too_low"]);
  assert.equal(checkFeaturePrerequisites(feature, { classLevel: 3, abilities: { str: 15 } }).eligible, true);
});

test("feature prerequisite checker handles feature ownership and legacy string IDs", () => {
  const feature = { prerequisites: [{ type: "feature", id: "fighter-style" }] };
  assert.equal(checkFeaturePrerequisites(feature, { features: [] }).eligible, false);
  assert.equal(checkFeaturePrerequisites(feature, { features: ["fighter-style"] }).eligible, true);
  assert.equal(checkFeaturePrerequisites({ prerequisites: [] }, {}).eligible, true);
});

test("catalog rejects duplicate classes, duplicate levels, duplicate features and malformed prerequisites", () => {
  assert.throws(() => createClassFeatureCatalog([...data, ...data]), /duplicate class/i);
  assert.throws(() => createClassFeatureCatalog([{ classId: "x", levels: [{ level: 1 }, { level: 1 }] }]), /duplicate.*level/i);
  assert.throws(() => createClassFeatureCatalog([{ classId: "x", levels: [{ level: 1, features: [{ id: "same" }, { id: "same" }] }] }]), /duplicate.*feature/i);
  assert.throws(() => createClassFeatureCatalog([{ classId: "x", levels: [{ level: 1, features: [{ id: "bad", prerequisites: [{ type: "ability_score", ability: "luck", minimum: 10 }] }] }] }]), /invalid ability prerequisite/i);
  assert.throws(() => createClassFeatureCatalog([{ classId: "x", subclass: { unlockLevel: 3, options: [] } }]), /at least one option/i);
});
