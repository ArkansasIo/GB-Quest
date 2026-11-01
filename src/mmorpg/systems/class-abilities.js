import { validateClassAbility } from "../rules/class-ability-runtime.js";

/**
 * Build an immutable lookup catalog from explicitly authored class ability data.
 * This module deliberately supplies no invented class feature records.
 */
export function createClassAbilityCatalog(records = []) {
  if (!Array.isArray(records)) throw new TypeError("Class ability records must be an array");
  const byId = new Map();
  for (const record of records) {
    validateClassAbility(record);
    if (byId.has(record.id)) throw new TypeError(`Duplicate class ability id: ${record.id}`);
    byId.set(record.id, Object.freeze(structuredClone(record)));
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
    get size() {
      return byId.size;
    }
  });
}
