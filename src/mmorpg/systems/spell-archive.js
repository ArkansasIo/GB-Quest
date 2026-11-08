import classes from "../data/classes.json" with { type: "json" };
import { SPELL_ARCHIVE_ITEMS, EXPANSION_SPELLS } from "../data/spell-content.js";
import { castSpell } from "../rules/spell-runtime.js";
import { configureSpellAccess, learnSpell, prepareSpell } from "../rules/spell-access.js";
import { getSpell } from "./spell-catalog.js";

export { SPELL_ARCHIVE_ITEMS };

const itemById = new Map(SPELL_ARCHIVE_ITEMS.map(item => [item.id, item]));
const expansionSpellIds = new Set(EXPANSION_SPELLS.map(spell => spell.id));

export function createSpellArchive({ capacity = 100 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("Archive capacity must be a positive integer");
  return { capacity, items: [] };
}

export function addArchiveItem(archive, itemId, quantity = 1) {
  if (!archive || !Array.isArray(archive.items)) throw new TypeError("A spell archive is required");
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new RangeError("Quantity must be a positive safe integer");
  const template = itemById.get(itemId);
  if (!template) return { ok: false, reason: "unknown_archive_item" };
  const existing = archive.items.find(item => item.id === itemId);
  if (existing) {
    if (!template.stackable) return { ok: false, reason: "not_stackable" };
    if (!Number.isSafeInteger(existing.quantity) || existing.quantity < 1) throw new RangeError("Existing stack quantity is invalid");
    if (!Number.isSafeInteger(existing.quantity + quantity)) throw new RangeError("Stack quantity exceeds the safe integer limit");
    existing.quantity += quantity;
    return { ok: true, item: existing };
  }
  if (archive.items.length >= archive.capacity) return { ok: false, reason: "archive_full" };
  const item = { ...template, quantity };
  archive.items.push(item);
  return { ok: true, item };
}

export function configureCharacterSpellbook(character, { classId, subclassId = null, mode = "known", maxKnown, maxPrepared } = {}) {
  if (!character?.spellState || !classes.classes.some(entry => entry.id === classId)) {
    throw new TypeError("A character with spellState and a valid classId is required");
  }
  const classDefinition = classes.classes.find(entry => entry.id === classId);
  if (subclassId && classDefinition.subclass?.id !== subclassId && !classDefinition.subclasses?.some(sub => sub.id === subclassId)) {
    throw new RangeError("Subclass does not belong to the selected class");
  }
  const allowedSpellIds = EXPANSION_SPELLS.filter(spell =>
    spell.classIds.includes(classId) &&
    (!subclassId || spell.subclasses.some(option => option.classId === classId && option.subclassId === subclassId))
  ).map(spell => spell.id);
  return configureSpellAccess(character, { mode, allowedSpellIds, maxKnown, maxPrepared });
}

function findArchiveItem(archive, itemId, expectedType) {
  if (!archive || !Array.isArray(archive.items)) throw new TypeError("A spell archive is required");
  const template = itemById.get(itemId);
  const item = archive.items.find(entry => entry.id === itemId && Number.isSafeInteger(entry.quantity) && entry.quantity > 0);
  if (!item) return { ok: false, reason: "item_not_found" };
  if (!template || template.itemType !== expectedType) return { ok: false, reason: "wrong_item_type" };
  return { ok: true, item, template };
}

export function studySpellbook(archive, character, itemId) {
  const found = findArchiveItem(archive, itemId, "spellbook");
  if (!found.ok) return found;
  const spellId = found.template.teachesSpell;
  if (!expansionSpellIds.has(spellId)) return { ok: false, reason: "invalid_spellbook" };
  const result = learnSpell(character, spellId);
  return result.ok ? { ...result, spell: getSpell(spellId) } : result;
}

export function studyCodex(archive, character, itemId) {
  const found = findArchiveItem(archive, itemId, "spell-codex");
  if (!found.ok) return found;
  const spellId = found.template.preparesSpell;
  if (!expansionSpellIds.has(spellId)) return { ok: false, reason: "invalid_spell_codex" };
  const result = prepareSpell(character, spellId);
  return result.ok ? { ...result, spell: getSpell(spellId) } : result;
}

function consumeOne(archive, item) {
  item.quantity--;
  if (item.quantity === 0) archive.items = archive.items.filter(entry => entry !== item);
}

export function castFromScroll(archive, caster, itemId, targets, options = {}) {
  const found = findArchiveItem(archive, itemId, "spell-scroll");
  if (!found.ok) return found;
  const spell = getSpell(found.template.spellId);
  if (!spell || !expansionSpellIds.has(spell.id)) return { ok: false, reason: "invalid_spell_scroll" };
  const result = castSpell({
    ...options,
    caster,
    targets,
    spell,
    slotLevel: spell.level,
    consumeSlot: false,
    source: "scroll",
  });
  if (result.ok) consumeOne(archive, found.item);
  return result;
}

export function listSpellArchiveItems({ itemType = null, school = null, query = "", limit = Infinity } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  const found = SPELL_ARCHIVE_ITEMS.filter(item => {
    if (itemType && item.itemType !== itemType) return false;
    const spell = getSpell(item.spellId || item.teachesSpell || item.preparesSpell);
    if (school && spell?.school !== school) return false;
    return !normalizedQuery ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.id.includes(normalizedQuery) ||
      item.detail.toLowerCase().includes(normalizedQuery);
  });
  return found.slice(0, Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : found.length);
}

export function getSpellArchiveSummary() {
  return {
    totalItems: SPELL_ARCHIVE_ITEMS.length,
    spellScrolls: SPELL_ARCHIVE_ITEMS.filter(item => item.itemType === "spell-scroll").length,
    spellbooks: SPELL_ARCHIVE_ITEMS.filter(item => item.itemType === "spellbook").length,
    codices: SPELL_ARCHIVE_ITEMS.filter(item => item.itemType === "spell-codex").length,
    materials: SPELL_ARCHIVE_ITEMS.filter(item => item.itemType === "arcane-material").length,
  };
}
