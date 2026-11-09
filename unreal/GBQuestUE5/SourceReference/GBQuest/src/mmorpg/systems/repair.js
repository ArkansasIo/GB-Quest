const validRate = rate => typeof rate === "number" && Number.isFinite(rate) && rate >= 0;
const validBudget = budget => budget === Infinity || (Number.isSafeInteger(budget) && budget >= 0);

function validateLoadout(loadout) {
  if (!loadout || typeof loadout !== "object" || !loadout.equipment ||
      typeof loadout.equipment !== "object" || Array.isArray(loadout.equipment)) {
    throw new TypeError("Valid equipment loadout required");
  }
}

function repairEntry(slot, item, repairRate) {
  if (!item || typeof item !== "object" ||
      !Number.isFinite(item.maxDurability) || item.maxDurability <= 0 ||
      !Number.isFinite(item.durability) || item.durability >= item.maxDurability) return null;

  const missing = Math.max(0, item.maxDurability - Math.max(0, item.durability));
  const level = Number.isSafeInteger(item.itemLevel) && item.itemLevel > 0 ? item.itemLevel : 1;
  const cost = Math.ceil(missing * repairRate * (1 + Math.floor(level / 10)));
  return { slot, item, missing, cost };
}

export function getRepairQuote(loadout, repairRate = 1) {
  validateLoadout(loadout);
  if (!validRate(repairRate)) throw new RangeError("Repair rate must be a non-negative finite number");

  const repairs = Object.entries(loadout.equipment)
    .map(([slot, item]) => repairEntry(slot, item, repairRate))
    .filter(Boolean)
    .map(({ slot, missing, cost }) => ({ slot, missing, cost }));
  return {
    repairs,
    itemCount: repairs.length,
    totalCost: repairs.reduce((sum, entry) => sum + entry.cost, 0)
  };
}

export function repairEquipment(loadout, slot, budget = Infinity, repairRate = 1) {
  validateLoadout(loadout);
  if (typeof slot !== "string" || !Object.hasOwn(loadout.equipment, slot)) {
    return { ok: false, reason: "invalid_slot" };
  }
  if (!validBudget(budget) || !validRate(repairRate)) {
    return { ok: false, reason: "invalid_budget_or_rate" };
  }
  const entry = repairEntry(slot, loadout.equipment[slot], repairRate);
  if (!entry) return { ok: false, reason: "no_repair_needed" };
  if (entry.cost > budget) return { ok: false, reason: "insufficient_funds", cost: entry.cost };

  entry.item.durability = entry.item.maxDurability;
  return { ok: true, slot, repaired: entry.missing, cost: entry.cost, durability: entry.item.durability };
}

export function repairAllEquipment(loadout, budget = Infinity, repairRate = 1) {
  validateLoadout(loadout);
  if (!validBudget(budget) || !validRate(repairRate)) {
    return { ok: false, reason: "invalid_budget_or_rate" };
  }
  const quote = getRepairQuote(loadout, repairRate);
  if (!quote.itemCount) return { ok: true, repaired: 0, cost: 0, repairs: [] };
  if (quote.totalCost > budget) {
    return { ok: false, reason: "insufficient_funds", cost: quote.totalCost, required: quote.totalCost };
  }

  for (const repair of quote.repairs) {
    loadout.equipment[repair.slot].durability = loadout.equipment[repair.slot].maxDurability;
  }
  return { ok: true, repaired: quote.itemCount, cost: quote.totalCost, repairs: quote.repairs };
}
