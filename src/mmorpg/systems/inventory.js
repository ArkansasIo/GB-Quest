const validCapacity = n => Number.isSafeInteger(n) && n >= 0;
const validWeightLimit = n => typeof n === "number" && Number.isFinite(n) && n >= 0;

export function createInventory({ capacity = 40, maxWeight = 100 } = {}) {
  if (!validCapacity(capacity) || !validWeightLimit(maxWeight)) {
    throw new RangeError("Inventory capacity and weight limit must be non-negative valid numbers");
  }
  return { capacity, maxWeight, items: [] };
}

function inventoryWeight(items) {
  return items.reduce((sum, entry) => sum + entry.weight * entry.quantity, 0);
}

export function addItem(inventory, item, quantity = 1) {
  if (!inventory || !Array.isArray(inventory.items) || !validCapacity(inventory.capacity) ||
      !validWeightLimit(inventory.maxWeight) || !item || typeof item.id !== "string" || !item.id.trim() ||
      !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new TypeError("Valid inventory, item id and positive safe quantity required");
  }
  const weight = item.weight ?? 0;
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
    throw new RangeError("Item weight must be a non-negative finite number");
  }
  const existing = inventory.items.find(entry => entry.id === item.id);
  if (existing && item.stackable === false) return { ok: false, reason: "not_stackable" };
  if (existing && (!Number.isSafeInteger(existing.quantity) || existing.quantity < 1 ||
      !Number.isSafeInteger(existing.quantity + quantity))) {
    return { ok: false, reason: "invalid_quantity" };
  }
  if (!existing && inventory.items.length >= inventory.capacity) return { ok: false, reason: "slots_full" };
  const nextItems = inventory.items.map(entry => ({ ...entry }));
  if (existing) {
    const target = nextItems.find(entry => entry.id === item.id);
    target.quantity += quantity;
  } else {
    nextItems.push({ ...item, weight, quantity });
  }
  const totalWeight = inventoryWeight(nextItems);
  if (!Number.isFinite(totalWeight) || totalWeight > inventory.maxWeight) {
    return { ok: false, reason: "overweight" };
  }
  inventory.items = nextItems;
  return { ok: true, quantity: existing ? nextItems.find(entry => entry.id === item.id).quantity : quantity };
}

export function removeItem(inventory, id, quantity = 1) {
  if (!inventory || !Array.isArray(inventory.items) || typeof id !== "string" ||
      !Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, reason: "invalid_request" };
  }
  const item = inventory.items.find(entry => entry.id === id);
  if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < quantity) {
    return { ok: false, reason: "insufficient_quantity" };
  }
  const remaining = item.quantity - quantity;
  if (remaining === 0) inventory.items = inventory.items.filter(entry => entry !== item);
  else item.quantity = remaining;
  return { ok: true, remaining };
}

export function countItem(inventory, id) {
  return inventory?.items?.find(entry => entry.id === id)?.quantity ?? 0;
}
