const MAX_LEVEL = 20;
const CASTING_TYPES = new Set(["full", "half", "third", "pact", "none"]);

/**
 * Spell slot progressions are explicit rules data, not inferred from a label.
 * Each level row is an array of maximum slots indexed by spell level - 1.
 */
export function createSpellSlotProgressionCatalog(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Spell slot progression records must be an array");
  const entries = new Map();
  for (const record of records) {
    if (!record || typeof record.classId !== "string" || !record.classId.trim()) {
      throw new TypeError("Spell slot progression requires a classId");
    }
    if (!CASTING_TYPES.has(record.castingType)) throw new RangeError(`Unsupported casting type for ${record.classId}`);
    if (!Array.isArray(record.levels) || record.levels.length !== MAX_LEVEL) {
      throw new TypeError(`Class ${record.classId} requires exactly 20 level rows`);
    }
    const levels = record.levels.map((slots, index) => {
      if (!Array.isArray(slots) || slots.length > 9 || slots.some(value => !Number.isInteger(value) || value < 0 || value > 4)) {
        throw new TypeError(`Invalid spell slot row at class level ${index + 1}`);
      }
      return Object.freeze([...slots]);
    });
    if (entries.has(record.classId)) throw new TypeError(`Duplicate spell slot progression: ${record.classId}`);
    entries.set(record.classId, Object.freeze({
      classId: record.classId,
      castingType: record.castingType,
      levels: Object.freeze(levels),
      pact: record.pact ? Object.freeze(structuredClone(record.pact)) : null
    }));
  }
  return Object.freeze({
    get(classId) { return entries.get(classId) ?? null; },
    getSlots(classId, level) {
      if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new RangeError("Class level must be between 1 and 20");
      const record = entries.get(classId);
      if (!record) return null;
      return { classId, classLevel: level, castingType: record.castingType, slots: [...record.levels[level - 1]], pact: record.pact ? structuredClone(record.pact) : null };
    },
    listClassIds() { return [...entries.keys()]; },
    get size() { return entries.size; }
  });
}
