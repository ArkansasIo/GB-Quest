import catalog from "../data/spells.json" with { type: "json" };
import { EXPANSION_SPELLS, SPELL_SCHOOLS, SPELL_TYPES } from "../data/spell-content.js";

const spells = [...catalog.spells, ...EXPANSION_SPELLS];
const byId = new Map(spells.map(spell => [spell.id, spell]));
const byName = new Map(spells.map(spell => [spell.name.toLowerCase(), spell]));

export function getSpell(idOrName) {
  const key = String(idOrName ?? "").trim().toLowerCase();
  return byId.get(key) ?? byName.get(key) ?? null;
}
export function listSpells({ level = null, school = null, classId = null, subclassId = null, type = null, subtype = null, source = null, query = "", limit = Infinity } = {}) {
  const q = String(query).trim().toLowerCase();
  const found = spells.filter(spell =>
    (level === null || spell.level === level) &&
    (!school || spell.school === school) &&
    (!classId || (spell.classIds?.includes(classId) && (!subclassId || spell.subclasses?.some(option => option.classId === classId && option.subclassId === subclassId)))) &&
    (!subclassId || spell.subclasses?.some(option => option.subclassId === subclassId && (!classId || option.classId === classId))) &&
    (!type || spell.type === type) &&
    (!subtype || spell.subtype === subtype) &&
    (!source || spell.source === source) &&
    (!q || spell.name.toLowerCase().includes(q) || spell.id.includes(q) || spell.detail?.toLowerCase().includes(q) || spell.source?.toLowerCase().includes(q))
  );
  return found.slice(0, Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : found.length);
}
export function getSpellCatalogSummary() {
  return {
    total: spells.length,
    originalExpansion: EXPANSION_SPELLS.length,
    cantrips: spells.filter(spell => spell.level === 0).length,
    leveled: spells.filter(spell => spell.level > 0).length,
    schools: [...new Set(spells.map(spell => spell.school))].sort(),
    types: [...new Set(EXPANSION_SPELLS.map(spell => spell.type))].sort(),
    ruleset: catalog.ruleset,
    license: catalog.license
  };
}

export function getSpellSchools() { return SPELL_SCHOOLS; }
export function getSpellTypes() { return SPELL_TYPES; }
