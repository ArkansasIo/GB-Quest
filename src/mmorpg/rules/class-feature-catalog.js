const MAX_CLASS_LEVEL = 20;
const ABILITY_IDS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

function assertLevel(level, label = "Feature level") {
  if (!Number.isInteger(level) || level < 1 || level > MAX_CLASS_LEVEL) {
    throw new RangeError(`${label} must be an integer from 1 to 20`);
  }
}

function normalizeFeature(feature, level, source) {
  if (!feature || typeof feature.id !== "string" || !feature.id.trim()) {
    throw new TypeError("Every feature requires a stable id");
  }
  const prerequisites = feature.prerequisites ?? [];
  if (!Array.isArray(prerequisites)) throw new TypeError(`Feature ${feature.id} prerequisites must be an array`);
  for (const prerequisite of prerequisites) {
    if (!prerequisite || !["feature", "class_level", "ability_score"].includes(prerequisite.type)) {
      throw new TypeError(`Feature ${feature.id} has an unsupported prerequisite`);
    }
    if (prerequisite.type === "feature" && (typeof prerequisite.id !== "string" || !prerequisite.id.trim())) {
      throw new TypeError(`Feature ${feature.id} requires a prerequisite feature id`);
    }
    if (prerequisite.type === "class_level") assertLevel(prerequisite.level, "Prerequisite class level");
    if (prerequisite.type === "ability_score" && (!ABILITY_IDS.has(prerequisite.ability) || !Number.isInteger(prerequisite.minimum) || prerequisite.minimum < 1 || prerequisite.minimum > 30)) {
      throw new TypeError(`Feature ${feature.id} has an invalid ability prerequisite`);
    }
  }
  return Object.freeze({
    id: feature.id,
    name: feature.name ?? feature.id,
    description: feature.description ?? "",
    level,
    source,
    prerequisites: Object.freeze(prerequisites.map(item => Object.freeze({ ...item }))),
    abilityIds: Object.freeze([...(feature.abilityIds ?? [])])
  });
}

function normalizeRows(rows, source) {
  if (!Array.isArray(rows)) throw new TypeError(`${source} progression rows must be an array`);
  const levels = new Set();
  const featureIds = new Set();
  return Object.freeze(rows.map(row => {
    assertLevel(row?.level);
    if (levels.has(row.level)) throw new TypeError(`Duplicate ${source} progression level: ${row.level}`);
    levels.add(row.level);
    if (!Array.isArray(row.features ?? [])) throw new TypeError("Feature row features must be an array");
    const features = (row.features ?? []).map(feature => {
      if (featureIds.has(feature.id)) throw new TypeError(`Duplicate ${source} feature id: ${feature.id}`);
      featureIds.add(feature.id);
      return normalizeFeature(feature, row.level, source);
    });
    return Object.freeze({ level: row.level, features: Object.freeze(features) });
  }).sort((a, b) => a.level - b.level));
}

function normalizeClass(record) {
  if (!record || typeof record.classId !== "string" || !record.classId.trim()) throw new TypeError("Class progression requires classId");
  const levels = normalizeRows(record.levels ?? [], "class");
  let subclass = null;
  if (record.subclass) {
    assertLevel(record.subclass.unlockLevel, "Subclass unlock level");
    if (!Array.isArray(record.subclass.options) || record.subclass.options.length === 0) {
      throw new TypeError("Subclass progression requires at least one option");
    }
    const optionIds = new Set();
    const options = record.subclass.options.map(option => {
      if (!option || typeof option.id !== "string" || !option.id.trim()) throw new TypeError("Subclass option requires a stable id");
      if (optionIds.has(option.id)) throw new TypeError(`Duplicate subclass option id: ${option.id}`);
      optionIds.add(option.id);
      return Object.freeze({
        id: option.id,
        name: option.name ?? option.id,
        levels: normalizeRows(option.levels ?? [], `subclass ${option.id}`)
      });
    });
    subclass = Object.freeze({ unlockLevel: record.subclass.unlockLevel, options: Object.freeze(options) });
  }
  return Object.freeze({ classId: record.classId, levels, subclass });
}

/** Validated catalog for authored class/subclass feature progression tables. */
export function createClassFeatureCatalog(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Class feature records must be an array");
  const classes = new Map();
  for (const record of records) {
    const normalized = normalizeClass(record);
    if (classes.has(normalized.classId)) throw new TypeError(`Duplicate class progression: ${normalized.classId}`);
    classes.set(normalized.classId, normalized);
  }
  return Object.freeze({
    getClass(classId) {
      return classes.get(classId) ?? null;
    },
    listClasses() {
      return [...classes.keys()];
    },
    getFeatures(classId, level, subclassId = null) {
      assertLevel(level);
      const definition = classes.get(classId);
      if (!definition) return [];
      const classFeatures = definition.levels.filter(row => row.level <= level).flatMap(row => row.features);
      const option = subclassId && definition.subclass?.options.find(item => item.id === subclassId);
      const subclassFeatures = option
        ? option.levels.filter(row => row.level <= level).flatMap(row => row.features)
        : [];
      return [...classFeatures, ...subclassFeatures];
    },
    get size() {
      return classes.size;
    }
  });
}

/** Check authored prerequisites without mutating character state. */
export function checkFeaturePrerequisites(feature, character) {
  const missing = [];
  for (const prerequisite of feature?.prerequisites ?? []) {
    if (prerequisite.type === "feature") {
      const owned = (character?.features ?? []).some(item => (typeof item === "string" ? item : item.id) === prerequisite.id);
      if (!owned) missing.push({ ...prerequisite, reason: "feature_not_owned" });
    } else if (prerequisite.type === "class_level") {
      if ((character?.classLevel ?? character?.level ?? 1) < prerequisite.level) missing.push({ ...prerequisite, reason: "class_level_too_low" });
    } else if (prerequisite.type === "ability_score") {
      if ((character?.abilities?.[prerequisite.ability] ?? 0) < prerequisite.minimum) missing.push({ ...prerequisite, reason: "ability_score_too_low" });
    }
  }
  return { eligible: missing.length === 0, missing };
}
