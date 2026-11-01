const MAX_CLASS_LEVEL = 20;

function validateLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_CLASS_LEVEL) {
    throw new RangeError("D&D class level must be an integer from 1 to 20");
  }
}

function normalizeCharacter(character) {
  if (!character || typeof character !== "object") throw new TypeError("Character state is required");
  if (!Array.isArray(character.features)) character.features = [];
  if (!Array.isArray(character.featureHistory)) character.featureHistory = [];
  return character;
}

function addFeature(character, feature, source) {
  if (!feature || typeof feature.id !== "string" || !feature.id.trim()) {
    throw new TypeError("Every class feature requires a stable id");
  }
  if (character.features.some(entry => (typeof entry === "string" ? entry : entry.id) === feature.id)) return false;
  character.features.push({ id: feature.id, name: feature.name ?? feature.id, source, level: feature.level });
  character.featureHistory.push({ id: feature.id, source, level: feature.level });
  return true;
}

/**
 * Applies a single D&D class-level increase using caller-supplied SRD-derived
 * progression rows. MMO/paragon levels are intentionally not consulted.
 *
 * progression = {
 *   classId: "fighter",
 *   levels: [{ level: 1, features: [{ id, name }] }],
 *   subclass: { unlockLevel: 3, options: [{ id, name, levels: [...] }] }
 * }
 */
export function advanceClassLevel(characterState, classDefinition, progression, targetLevel) {
  const character = normalizeCharacter(characterState);
  if (!classDefinition?.id || !progression || progression.classId !== classDefinition.id) {
    throw new TypeError("Matching class definition and progression data are required");
  }
  validateLevel(targetLevel);
  const currentLevel = character.classLevel ?? character.level ?? 1;
  validateLevel(currentLevel);
  if (targetLevel !== currentLevel + 1) {
    throw new RangeError("Class levels must advance one level at a time");
  }

  const row = (progression.levels ?? []).find(entry => entry.level === targetLevel);
  if (!row) {
    throw new RangeError(`No progression row is defined for ${classDefinition.id} level ${targetLevel}`);
  }

  character.classId = classDefinition.id;
  character.classLevel = targetLevel;
  character.level = targetLevel;
  character.proficiencyBonus = Math.ceil(targetLevel / 4) + 1;

  const granted = [];
  for (const feature of row?.features ?? []) {
    if (addFeature(character, { ...feature, level: targetLevel }, "class")) granted.push(feature.id);
  }

  const subclass = progression.subclass;
  if (subclass && targetLevel >= subclass.unlockLevel) {
    if (!character.subclassId) {
      if (targetLevel === subclass.unlockLevel) {
        return {
          ok: true, level: targetLevel, granted,
          choiceRequired: true,
          choices: (subclass.options ?? []).map(({ id, name }) => ({ id, name }))
        };
      }
      throw new Error("A subclass choice is required before advancing beyond its unlock level");
    }
    const option = (subclass.options ?? []).find(item => item.id === character.subclassId);
    if (!option) throw new RangeError("Selected subclass is not valid for this class");
    for (const feature of (option.levels ?? []).filter(entry => entry.level === targetLevel).flatMap(entry => entry.features ?? [])) {
      if (addFeature(character, { ...feature, level: targetLevel }, "subclass")) granted.push(feature.id);
    }
  }

  return { ok: true, level: targetLevel, granted, choiceRequired: false };
}

export function chooseSubclass(characterState, progression, subclassId) {
  const character = normalizeCharacter(characterState);
  if (!progression?.subclass || !Array.isArray(progression.subclass.options)) {
    throw new TypeError("Subclass options are not defined");
  }
  const level = character.classLevel ?? character.level ?? 1;
  if (level < progression.subclass.unlockLevel) throw new RangeError("Subclass choice is not unlocked yet");
  if (character.subclassId) throw new Error("A subclass has already been selected");
  const option = progression.subclass.options.find(item => item.id === subclassId);
  if (!option) throw new RangeError("Unknown subclass for this class");
  character.subclassId = option.id;
  character.subclassName = option.name ?? option.id;
  const granted = [];
  for (const feature of (option.levels ?? []).filter(entry => entry.level === level).flatMap(entry => entry.features ?? [])) {
    if (addFeature(character, { ...feature, level }, "subclass")) granted.push(feature.id);
  }
  return { ok: true, subclassId: option.id, granted };
}

export function getClassProgressionStatus(character, progression) {
  const level = character?.classLevel ?? character?.level ?? 1;
  const unlockLevel = progression?.subclass?.unlockLevel ?? null;
  return {
    classId: character?.classId ?? progression?.classId ?? null,
    classLevel: level,
    subclassId: character?.subclassId ?? null,
    subclassUnlocked: unlockLevel !== null && level >= unlockLevel,
    subclassChoiceRequired: unlockLevel !== null && level >= unlockLevel && !character?.subclassId
  };
}
