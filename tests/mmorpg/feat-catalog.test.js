import test from "node:test";
import assert from "node:assert/strict";
import { createFeatCatalog } from "../../src/mmorpg/systems/feat-catalog.js";

const feats = [
  { id: "feat.athlete", name: "Athlete", category: "general", prerequisites: [] },
  { id: "feat.keen-mind", name: "Keen Mind", category: "general", prerequisites: [{ type: "ability_score", ability: "int", minimum: 13 }] },
  { id: "feat.master", name: "Master Feat", category: "combat", prerequisites: [{ type: "level", level: 4 }, { type: "feat", id: "feat.athlete" }] }
];

test("feat catalog supports lookup, search, category and limits", () => {
  const catalog = createFeatCatalog(feats);
  assert.equal(catalog.size, 3);
  assert.equal(catalog.get("feat.athlete").name, "Athlete");
  assert.deepEqual(catalog.list({ category: "general" }).map(item => item.id), ["feat.athlete", "feat.keen-mind"]);
  assert.deepEqual(catalog.list({ query: "master" }).map(item => item.id), ["feat.master"]);
  assert.throws(() => catalog.list({ limit: 0 }), /positive integer/i);
});

test("feat eligibility checks ability score, level and owned prerequisite feat", () => {
  const catalog = createFeatCatalog(feats);
  assert.deepEqual(catalog.checkEligibility("feat.keen-mind", { abilities: { int: 12 } }), {
    eligible: false,
    missing: [{ type: "ability_score", ability: "int", minimum: 13, reason: "ability_score_too_low" }]
  });
  assert.equal(catalog.checkEligibility("feat.master", { level: 3, feats: [] }).eligible, false);
  assert.equal(catalog.checkEligibility("feat.master", { level: 4, feats: ["feat.athlete"] }).eligible, true);
  assert.deepEqual(catalog.checkEligibility("missing", {}), { eligible: false, reason: "feat_not_found", missing: [] });
});

test("feat catalog rejects malformed or duplicate feat records", () => {
  assert.throws(() => createFeatCatalog([feats[0], feats[0]]), /duplicate feat/i);
  assert.throws(() => createFeatCatalog([{ id: "bad", name: "Bad", prerequisites: [{ type: "skill" }] }]), /unsupported prerequisite/i);
  assert.throws(() => createFeatCatalog([{ id: "bad", name: "Bad", prerequisites: [{ type: "level", level: 21 }] }]), /invalid level/i);
  assert.throws(() => createFeatCatalog({}), /array/i);
});


test("feat granting is prerequisite-gated, duplicate-safe and non-mutating on failure", () => {
  const catalog = createFeatCatalog(feats);
  const character = { level: 3, abilities: { int: 12 }, feats: [] };
  assert.deepEqual(catalog.grant(character, "feat.keen-mind"), {
    ok: false, reason: "prerequisites_not_met",
    missing: [{ type: "ability_score", ability: "int", minimum: 13, reason: "ability_score_too_low" }]
  });
  assert.deepEqual(character.feats, []);
  character.abilities.int = 13;
  assert.deepEqual(catalog.grant(character, "feat.keen-mind"), { ok: true, featId: "feat.keen-mind" });
  assert.deepEqual(catalog.grant(character, "feat.keen-mind"), { ok: false, reason: "already_owned" });
  assert.deepEqual(catalog.grant(character, "missing"), { ok: false, reason: "feat_not_found" });
});

test("feat prerequisite chains accept previously granted feat identifiers", () => {
  const catalog = createFeatCatalog(feats);
  const character = { level: 4, feats: [] };
  assert.equal(catalog.grant(character, "feat.master").reason, "prerequisites_not_met");
  assert.deepEqual(catalog.grant(character, "feat.athlete"), { ok: true, featId: "feat.athlete" });
  assert.deepEqual(catalog.grant(character, "feat.master"), { ok: true, featId: "feat.master" });
});

test("feat records deeply freeze nested metadata", () => {
  const catalog = createFeatCatalog([{ id: "feat.deep", name: "Deep", prerequisites: [], metadata: { tags: ["test"] } }]);
  assert.equal(Object.isFrozen(catalog.get("feat.deep").metadata.tags), true);
});
