import catalog from "../data/equipment.json" with { type: "json" };

const QUALITY = Object.freeze(["poor","common","uncommon","rare","epic","legendary","artifact"]);
const allCatalogItems = [
  ...catalog.weapons, ...catalog.armor, ...(catalog.adventuringGear ?? []),
  ...(catalog.tools ?? []), ...(catalog.equipmentPacks ?? []),
  ...(catalog.mountsAndVehicles ?? []), ...(catalog.magicItems ?? [])
];
const itemIndex = new Map(allCatalogItems.map(item => [item.id, item]));
const byName = new Map(allCatalogItems.map(item => [item.name.toLowerCase(), item]));

export function listCatalogItems({ category = null, query = "", limit = Infinity } = {}) {
  const q = String(query).trim().toLowerCase();
  const found = allCatalogItems.filter(item =>
    (!category || item.category === category || item.itemType === category) &&
    (!q || item.name.toLowerCase().includes(q) || item.id.includes(q))
  );
  return found.slice(0, Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : found.length);
}

export function getCatalogItem(idOrName) {
  const key = String(idOrName ?? "").toLowerCase();
  return itemIndex.get(key) ?? byName.get(key) ?? null;
}

export function createItemInstance(idOrName, {
  quantity = 1, quality = "common", itemLevel = 1, bind = "unbound",
  maxDurability = 100, stats = {}, randomSeed = null
} = {}) {
  const template = getCatalogItem(idOrName);
  if (!template) throw new RangeError("Unknown catalog item");
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("Quantity must be a positive integer");
  if (!QUALITY.includes(quality)) throw new RangeError("Unknown item quality");
  if (!Number.isInteger(itemLevel) || itemLevel < 1) throw new RangeError("Item level must be positive");
  if (!["unbound","bind_on_equip","bind_on_pickup","soulbound"].includes(bind)) throw new RangeError("Invalid bind mode");
  return {
    instanceId: randomSeed ?? `${template.id}:${itemLevel}:${quality}`,
    templateId: template.id, name: template.name, quantity, quality, itemLevel,
    bind, boundTo: bind === "soulbound" ? null : null,
    durability: template.itemType === "weapon" || template.itemType === "armor" ? maxDurability : null,
    maxDurability: template.itemType === "weapon" || template.itemType === "armor" ? maxDurability : null,
    stats: structuredClone(stats), template: structuredClone(template)
  };
}

export function bindItem(item, characterId, trigger = "equip") {
  if (!item || !characterId) throw new TypeError("Item and character id are required");
  if (item.bind === "bind_on_pickup" && trigger === "pickup" ||
      item.bind === "bind_on_equip" && trigger === "equip" ||
      item.bind === "soulbound") {
    if (item.boundTo && item.boundTo !== characterId) return { ok: false, reason: "already_bound" };
    item.boundTo = characterId; item.bind = "soulbound";
  }
  return { ok: true, bound: item.bind === "soulbound" };
}

export function damageDurability(item, amount = 1) {
  if (!item || !Number.isFinite(amount) || amount < 0) throw new TypeError("Item and non-negative durability loss required");
  if (item.durability === null || item.durability === undefined) return { ok: false, reason: "not_durable" };
  item.durability = Math.max(0, item.durability - Math.floor(amount));
  return { ok: true, durability: item.durability, broken: item.durability === 0 };
}

export function repairItem(item, vendorRate = 1) {
  if (!item || item.durability == null || !Number.isFinite(vendorRate) || vendorRate < 0) {
    throw new TypeError("Durable item and valid vendor rate required");
  }
  const missing = item.maxDurability - item.durability;
  const base = item.template?.priceCopper ?? 0;
  const costCopper = Math.ceil((base / 100) * (missing / Math.max(1, item.maxDurability)) * vendorRate);
  item.durability = item.maxDurability;
  return { costCopper, durability: item.durability };
}

export function getItemQualityMultiplier(quality) {
  const index = QUALITY.indexOf(quality);
  if (index < 0) throw new RangeError("Unknown item quality");
  return [0.5,1,1.15,1.35,1.6,2,2.5][index];
}

export function getEquipmentCatalogSummary() {
  return {
    weapons: catalog.weapons.length, armor: catalog.armor.length,
    adventuringGear: catalog.adventuringGear?.length ?? 0,
    tools: catalog.tools?.length ?? 0, equipmentPacks: catalog.equipmentPacks?.length ?? 0,
    mountsAndVehicles: catalog.mountsAndVehicles?.length ?? 0,
    magicItems: catalog.magicItems?.length ?? 0,
    total: allCatalogItems.length, ruleset: catalog.ruleset
  };
}
