import expansion from "../data/aelmoor-expansion.json" with { type: "json" };

const records = expansion.talents;
const byId = new Map(records.map(record => [record.id, Object.freeze(structuredClone(record))]));
if (byId.size !== records.length) throw new Error("Duplicate talent id in Aelmoor expansion");

export const TALENT_CATALOG = Object.freeze({
  get(id) { return byId.get(String(id)) ?? null; },
  list({ classId, branch, query = "", limit = 100 } = {}) {
    const q = String(query).trim().toLowerCase();
    return records.filter(t => (!classId || t.classId === classId) &&
      (!branch || t.branch === branch) &&
      (!q || (t.id + " " + t.name + " " + t.description).toLowerCase().includes(q)))
      .slice(0, Math.max(0, Math.min(500, Number.isFinite(limit) ? Math.floor(limit) : 100)));
  },
  forCharacter(character) {
    if (!character || typeof character.classId !== "string") throw new TypeError("Character class is required");
    const level = Number(character.level ?? 1);
    if (!Number.isInteger(level) || level < 1) throw new RangeError("Character level must be a positive integer");
    const owned = new Set((character.talents ?? []).map(t => typeof t === "string" ? t : t.id));
    return records.filter(t => t.classId === character.classId && t.requiredLevel <= level)
      .map(t => ({ ...t, owned: owned.has(t.id), available: !owned.has(t.id) }));
  },
  learn(character, id) {
    if (!character || typeof character !== "object") throw new TypeError("Character state is required");
    const talent = byId.get(String(id));
    if (!talent) return { ok: false, reason: "talent_not_found" };
    if (character.classId !== talent.classId) return { ok: false, reason: "wrong_class" };
    if (Number(character.level ?? 1) < talent.requiredLevel) return { ok: false, reason: "level_too_low", requiredLevel: talent.requiredLevel };
    if (!Array.isArray(character.talents)) character.talents = [];
    const owned = character.talents.some(t => (typeof t === "string" ? t : t.id) === talent.id);
    if (owned) return { ok: false, reason: "already_learned" };
    const points = Number(character.talentPoints ?? 0);
    if (!Number.isSafeInteger(points) || points < 1) return { ok: false, reason: "insufficient_talent_points" };
    character.talents.push({ id: talent.id, rank: 1 });
    character.talentPoints = points - 1;
    return { ok: true, talentId: talent.id, rank: 1, remainingPoints: character.talentPoints };
  },
  get size() { return records.length; }
});
