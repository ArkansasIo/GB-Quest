import catalog from "../data/equipment.json" with { type: "json" };
import expansion from "../data/aelmoor-expansion.json" with { type: "json" };

const QUALITY = Object.freeze(["poor","common","uncommon","rare","epic","legendary","artifact"]);
const BIND_MODES = Object.freeze(["unbound","bind_on_equip","bind_on_pickup","soulbound"]);
const allCatalogItems = [
  ...catalog.weapons, ...catalog.armor, ...expansion.weapons, ...expansion.armor, ...(catalog.adventuringGear ?? []),
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
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new RangeError("Quantity must be a positive safe integer");
  if (!QUALITY.includes(quality)) throw new RangeError("Unknown item quality");
  if (!Number.isSafeInteger(itemLevel) || itemLevel < 1) throw new RangeError("Item level must be a positive safe integer");
  if (!BIND_MODES.includes(bind)) throw new RangeError("Invalid bind mode");
  if (!stats || typeof stats !== "object" || Array.isArray(stats) ||
      Object.values(stats).some(value => typeof value !== "number" || !Number.isFinite(value))) {
    throw new TypeError("Item stats must be an object containing finite numbers");
  }
  const durable = template.itemType === "weapon" || template.itemType === "armor";
  if (durable && (!Number.isSafeInteger(maxDurability) || maxDurability < 1)) {
    throw new RangeError("Durability must be a positive safe integer");
  }
  const instanceId = randomSeed == null
    ? `${template.id}:${itemLevel}:${quality}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
    : String(randomSeed);
  if (!instanceId) throw new TypeError("Instance id cannot be empty");
  return {
    instanceId, templateId: template.id, name: template.name, quantity, quality, itemLevel,
    bind, boundTo: null,
    durability: durable ? maxDurability : null,
    maxDurability: durable ? maxDurability : null,
    stats: structuredClone(stats), template: structuredClone(template)
  };
}

export function bindItem(item, characterId, trigger = "equip") {
  if (!item || typeof characterId !== "string" || !characterId.trim()) {
    throw new TypeError("Item and character id are required");
  }
  if (!["pickup", "equip"].includes(trigger)) throw new RangeError("Invalid binding trigger");
  if (!BIND_MODES.includes(item.bind)) throw new RangeError("Invalid item bind mode");
  if (item.bind === "soulbound") {
    if (item.boundTo && item.boundTo !== characterId) return { ok: false, reason: "already_bound" };
    item.boundTo ??= characterId;
    return { ok: true, bound: true };
  }
  const shouldBind = item.bind === "bind_on_pickup" && trigger === "pickup" ||
    item.bind === "bind_on_equip" && trigger === "equip";
  if (shouldBind) {
    if (item.boundTo && item.boundTo !== characterId) return { ok: false, reason: "already_bound" };
    item.boundTo = characterId;
    item.bind = "soulbound";
  }
  return { ok: true, bound: item.bind === "soulbound" };
}

export function damageDurability(item, amount = 1) {
  if (!item || !Number.isFinite(amount) || amount < 0) {
    throw new TypeError("Item and non-negative durability loss required");
  }
  if (item.durability == null || item.maxDurability == null) return { ok: false, reason: "not_durable" };
  if (!Number.isSafeInteger(item.durability) || !Number.isSafeInteger(item.maxDurability) ||
      item.maxDurability < 1 || item.durability < 0 || item.durability > item.maxDurability) {
    throw new RangeError("Item durability state is invalid");
  }
  item.durability = Math.max(0, item.durability - Math.floor(amount));
  return { ok: true, durability: item.durability, broken: item.durability === 0 };
}

export function repairItem(item, vendorRate = 1) {
  if (!item || item.durability == null || item.maxDurability == null ||
      !Number.isSafeInteger(item.maxDurability) || item.maxDurability < 1 ||
      !Number.isSafeInteger(item.durability) || item.durability < 0 || item.durability > item.maxDurability ||
      !Number.isFinite(vendorRate) || vendorRate < 0) {
    throw new TypeError("Durable item with valid durability and vendor rate required");
  }
  const missing = item.maxDurability - item.durability;
  const base = item.template?.priceCopper ?? 0;
  if (!Number.isSafeInteger(base) || base < 0) throw new RangeError("Item base price must be a non-negative safe integer");
  const cost = Math.ceil((base / 100) * (missing / item.maxDurability) * vendorRate);
  if (!Number.isSafeInteger(cost)) throw new RangeError("Repair cost exceeds the safe copper range");
  item.durability = item.maxDurability;
  return { costCopper: cost, durability: item.durability };
}

export function getItemQualityMultiplier(quality) {
  const index = QUALITY.indexOf(quality);
  if (index < 0) throw new RangeError("Unknown item quality");
  return [0.5,1,1.15,1.35,1.6,2,2.5][index];
}

export function getEquipmentCatalogSummary() {
  return {
    weapons: catalog.weapons.length + expansion.weapons.length, armor: catalog.armor.length + expansion.armor.length,
    adventuringGear: catalog.adventuringGear?.length ?? 0,
    tools: catalog.tools?.length ?? 0, equipmentPacks: catalog.equipmentPacks?.length ?? 0,
    mountsAndVehicles: catalog.mountsAndVehicles?.length ?? 0,
    magicItems: catalog.magicItems?.length ?? 0,
    total: allCatalogItems.length, ruleset: catalog.ruleset
  };
}
