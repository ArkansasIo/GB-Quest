import { validateClassAbility } from "../rules/class-ability-runtime.js";
import { CLASS_ABILITY_RECORDS } from "../data/class-abilities.js";
import classCatalog from "../data/classes.json" with { type: "json" };

const classById = new Map(classCatalog.classes.map(entry => [entry.id, entry]));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Build an immutable lookup catalog from explicitly authored class ability data.
 * This module deliberately supplies no invented class feature records.
 */
export function createClassAbilityCatalog(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Class ability records must be an array");
  const byId = new Map();
  for (const record of records) {
    validateClassAbility(record);
    const classDefinition = classById.get(record.classId);
    if (!classDefinition) throw new RangeError(`Unknown class for ability ${record.id}: ${record.classId}`);
    const subclassIds = classDefinition.subclasses?.map(sub => sub.id) ?? (classDefinition.subclass ? [classDefinition.subclass.id] : []);
    if (record.subclassId && !subclassIds.includes(record.subclassId)) {
      throw new RangeError(`Unknown subclass for ability ${record.id}: ${record.subclassId}`);
    }
    if (!Number.isInteger(record.level) || record.level < 1 || record.level > 20) {
      throw new RangeError(`Ability ${record.id} level must be an integer from 1 to 20`);
    }
    if (byId.has(record.id)) throw new TypeError(`Duplicate class ability id: ${record.id}`);
    byId.set(record.id, deepFreeze(structuredClone(record)));
  }

  return Object.freeze({
    get(id) {
      return byId.get(id) ?? null;
    },
    list({ classId, subclassId, level, actionCost, query, limit = 100 } = {}) {
      if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Catalog limit must be a positive integer");
      const needle = String(query ?? "").trim().toLowerCase();
      return [...byId.values()]
        .filter(record => !classId || record.classId === classId)
        .filter(record => !subclassId || record.subclassId === subclassId)
        .filter(record => level === undefined || record.level <= level)
        .filter(record => !actionCost || (record.actionCost ?? "action") === actionCost)
        .filter(record => !needle || `${record.id} ${record.name ?? ""} ${record.description ?? ""}`.toLowerCase().includes(needle))
        .slice(0, limit);
    },
    forCharacter(character, { limit = 100 } = {}) {
      if (!character || typeof character.classId !== "string") throw new TypeError("Character class is required");
      const classLevel = character.classLevel ?? character.level ?? 1;
      if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 20) {
        throw new RangeError("Character class level must be an integer from 1 to 20");
      }
      return this.list({ classId: character.classId, level: classLevel, limit })
        .filter(record => !record.subclassId || record.subclassId === character.subclassId);
    },
    get size() {
      return byId.size;
    }
  });
}

export const CLASS_ABILITY_CATALOG = createClassAbilityCatalog(CLASS_ABILITY_RECORDS);
