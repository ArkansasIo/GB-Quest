import backgroundCatalog from "../data/backgrounds.json" with { type: "json" };
import equipmentCatalog from "../data/equipment.json" with { type: "json" };
import skillCatalog from "../data/skills.json" with { type: "json" };
import { addItem, createInventory } from "./inventory.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function buildEquipmentIndex() {
  const sections = [
    equipmentCatalog.weapons,
    equipmentCatalog.armor,
    equipmentCatalog.adventuringGear,
    equipmentCatalog.tools,
    equipmentCatalog.equipmentPacks,
    equipmentCatalog.mountsAndVehicles,
    equipmentCatalog.magicItems
  ];
  return new Map(sections.flat().map(item => [item.id, item]));
}

const equipmentById = buildEquipmentIndex();
const validSkills = new Set(skillCatalog.skills.map(skill => skill.id));

function normalizeBackground(record) {
  if (!record || typeof record.id !== "string" || !record.id.trim() ||
      typeof record.name !== "string" || !record.name.trim()) {
    throw new TypeError("Background requires a stable id and name");
  }
  if (!Array.isArray(record.skillProficiencies) || record.skillProficiencies.length !== 2 ||
      record.skillProficiencies.some(skill => !validSkills.has(skill)) ||
      new Set(record.skillProficiencies).size !== record.skillProficiencies.length) {
    throw new TypeError(`Background ${record.id} requires two unique valid skill proficiencies`);
  }
  if (!Array.isArray(record.toolProficiencies) || record.toolProficiencies.some(id => !equipmentById.has(id))) {
    throw new TypeError(`Background ${record.id} contains an unknown tool proficiency`);
  }
  if (!Array.isArray(record.startingEquipment) || record.startingEquipment.some(id => !equipmentById.has(id))) {
    throw new TypeError(`Background ${record.id} contains unknown starting equipment`);
  }
  if (!record.feature || typeof record.feature.id !== "string" || typeof record.feature.detail !== "string") {
    throw new TypeError(`Background ${record.id} requires a descriptive feature`);
  }
  return deepFreeze(structuredClone(record));
}

export function createBackgroundCatalog(records = backgroundCatalog.backgrounds) {
  if (!Array.isArray(records)) throw new TypeError("Background records must be an array");
  const byId = new Map();
  for (const record of records) {
    const background = normalizeBackground(record);
    if (byId.has(background.id)) throw new TypeError(`Duplicate background id: ${background.id}`);
    byId.set(background.id, background);
  }
  return Object.freeze({
    get(id) { return byId.get(id) ?? null; },
    list({ query = "", limit = 100 } = {}) {
      if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Background limit must be a positive integer");
      const needle = String(query).trim().toLowerCase();
      return [...byId.values()]
        .filter(background => !needle || `${background.id} ${background.name} ${background.description}`.toLowerCase().includes(needle))
        .slice(0, limit);
    },
    get size() { return byId.size; }
  });
}

export const BACKGROUND_CATALOG = createBackgroundCatalog();

export function applyBackground(character, backgroundId) {
  if (!character || typeof character !== "object") throw new TypeError("Character state is required");
  const background = BACKGROUND_CATALOG.get(backgroundId);
  if (!background) return { ok: false, reason: "background_not_found" };
  if (character.backgroundId) return { ok: false, reason: "background_already_applied" };
  const proficiencies = character.proficiencies ?? { skills: [], saves: [], weapons: [], armor: [], tools: [] };
  if (!Array.isArray(proficiencies.skills) || !Array.isArray(proficiencies.tools)) {
    throw new TypeError("Character skill and tool proficiency state must be arrays");
  }
  const inventory = character.inventory
    ? { ...character.inventory, items: character.inventory.items.map(item => ({ ...item })) }
    : createInventory();
  for (const itemId of background.startingEquipment) {
    const template = equipmentById.get(itemId);
    const result = addItem(inventory, {
      ...template,
      weight: template.weight ?? template.weightLb ?? 0
    });
    if (!result.ok) return { ok: false, reason: result.reason, itemId };
  }

  character.proficiencies = {
    ...proficiencies,
    skills: [...new Set([...proficiencies.skills, ...background.skillProficiencies])],
    tools: [...new Set([...proficiencies.tools, ...background.toolProficiencies])]
  };
  character.inventory = inventory;
  character.background = background.id;
  character.backgroundId = background.id;
  character.backgroundFeature = { ...background.feature };
  return { ok: true, backgroundId: background.id, feature: { ...background.feature } };
}
