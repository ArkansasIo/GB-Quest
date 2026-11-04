import { createClassFeatureCatalog } from "../rules/class-feature-catalog.js";

/**
 * Data-driven subclass and feat catalogue.
 * This provides a common validated lookup API while keeping feat and subclass
 * rules records separately authored and reviewable.
 */
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function ownedFeatIds(character) {
  return new Set((character?.feats ?? []).map(item => typeof item === "string" ? item : item?.id).filter(Boolean));
}

function validateFeat(feat) {
  if (!feat || typeof feat.id !== "string" || !feat.id.trim()) throw new TypeError("Feat requires a stable id");
  if (typeof feat.name !== "string" || !feat.name.trim()) throw new TypeError(`Feat ${feat.id} requires a name`);
  if (!Array.isArray(feat.prerequisites ?? [])) throw new TypeError(`Feat ${feat.id} prerequisites must be an array`);
  for (const prerequisite of feat.prerequisites ?? []) {
    if (prerequisite.type === "ability_score") {
      if (!["str", "dex", "con", "int", "wis", "cha"].includes(prerequisite.ability) || !Number.isInteger(prerequisite.minimum)) {
        throw new TypeError(`Feat ${feat.id} has an invalid ability-score prerequisite`);
      }
    } else if (prerequisite.type === "level") {
      if (!Number.isInteger(prerequisite.level) || prerequisite.level < 1 || prerequisite.level > 20) throw new RangeError(`Feat ${feat.id} has an invalid level prerequisite`);
    } else if (prerequisite.type === "feat") {
      if (typeof prerequisite.id !== "string" || !prerequisite.id.trim()) throw new TypeError(`Feat ${feat.id} has an invalid feat prerequisite`);
    } else {
      throw new TypeError(`Feat ${feat.id} has an unsupported prerequisite type`);
    }
  }
  return deepFreeze(structuredClone({
    ...feat,
    prerequisites: feat.prerequisites ?? []
  }));
}

function isFeatEligible(feat, character, ownedFeatIds) {
  const missing = [];
  for (const prerequisite of feat.prerequisites) {
    if (prerequisite.type === "ability_score" && (character?.abilities?.[prerequisite.ability] ?? 0) < prerequisite.minimum) {
      missing.push({ ...prerequisite, reason: "ability_score_too_low" });
    }
    if (prerequisite.type === "level" && (character?.classLevel ?? character?.level ?? 1) < prerequisite.level) {
      missing.push({ ...prerequisite, reason: "level_too_low" });
    }
    if (prerequisite.type === "feat" && !ownedFeatIds.has(prerequisite.id)) {
      missing.push({ ...prerequisite, reason: "required_feat_not_owned" });
    }
  }
  return { eligible: missing.length === 0, missing };
}

export function createFeatCatalog(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Feat records must be an array");
  const feats = new Map();
  for (const record of records) {
    const feat = validateFeat(record);
    if (feats.has(feat.id)) throw new TypeError(`Duplicate feat id: ${feat.id}`);
    feats.set(feat.id, feat);
  }
  return Object.freeze({
    get(id) { return feats.get(id) ?? null; },
    list({ query, category, limit = 100 } = {}) {
      if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Feat limit must be a positive integer");
      const needle = String(query ?? "").trim().toLowerCase();
      return [...feats.values()]
        .filter(feat => !category || feat.category === category)
        .filter(feat => !needle || `${feat.id} ${feat.name} ${feat.description ?? ""}`.toLowerCase().includes(needle))
        .slice(0, limit);
    },
    checkEligibility(id, character) {
      const feat = feats.get(id);
      if (!feat) return { eligible: false, reason: "feat_not_found", missing: [] };
      return isFeatEligible(feat, character, ownedFeatIds(character));
    },
    grant(character, id) {
      if (!character || typeof character !== "object") throw new TypeError("Character state is required");
      if (!Array.isArray(character.feats)) character.feats = [];
      const feat = feats.get(id);
      if (!feat) return { ok: false, reason: "feat_not_found" };
      if (ownedFeatIds(character).has(id)) return { ok: false, reason: "already_owned" };
      const eligibility = isFeatEligible(feat, character, ownedFeatIds(character));
      if (!eligibility.eligible) return { ok: false, reason: "prerequisites_not_met", missing: eligibility.missing };
      character.feats.push(id);
      return { ok: true, featId: id };
    },
    get size() { return feats.size; }
  });
}

export { createClassFeatureCatalog };
