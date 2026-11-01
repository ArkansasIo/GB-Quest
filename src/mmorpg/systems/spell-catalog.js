import catalog from "../data/spells.json" with { type: "json" };

const spells = catalog.spells;
const byId = new Map(spells.map(spell => [spell.id, spell]));
const byName = new Map(spells.map(spell => [spell.name.toLowerCase(), spell]));

export function getSpell(idOrName) {
  const key = String(idOrName ?? "").trim().toLowerCase();
  return byId.get(key) ?? byName.get(key) ?? null;
}
export function listSpells({ level = null, school = null, query = "", limit = Infinity } = {}) {
  const q = String(query).trim().toLowerCase();
  const found = spells.filter(spell =>
    (level === null || spell.level === level) &&
    (!school || spell.school === school) &&
    (!q || spell.name.toLowerCase().includes(q) || spell.id.includes(q))
  );
  return found.slice(0, Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : found.length);
}
export function getSpellCatalogSummary() {
  return {
    total: spells.length,
    cantrips: spells.filter(spell => spell.level === 0).length,
    leveled: spells.filter(spell => spell.level > 0).length,
    schools: [...new Set(spells.map(spell => spell.school))].sort(),
    ruleset: catalog.ruleset,
    license: catalog.license
  };
}
