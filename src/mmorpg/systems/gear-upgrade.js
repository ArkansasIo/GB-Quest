import { countItem, removeItem } from "./inventory.js";

export const MAX_GEAR_UPGRADE = 20;
const UPGRADE_STONE = "material:upgrade-stone";
const ARCANE_DUST = "material:arcane-dust";
const safeCopper = value => Number.isSafeInteger(value) && value >= 0;

export function quoteGearUpgrade(item) {
  if (!item || typeof item !== "object" || !Number.isSafeInteger(item.itemLevel) || item.itemLevel < 1) {
    throw new TypeError("A valid gear instance with a positive item level is required");
  }
  const currentLevel = item.upgradeLevel ?? 0;
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 0 || currentLevel > MAX_GEAR_UPGRADE) {
    throw new RangeError("Gear upgrade level is invalid");
  }
  if (currentLevel >= MAX_GEAR_UPGRADE) {
    return { canUpgrade: false, reason: "upgrade_cap", currentLevel, nextLevel: null };
  }
  const nextLevel = currentLevel + 1;
  const goldCopper = item.itemLevel * 100 * nextLevel;
  if (!Number.isSafeInteger(goldCopper)) throw new RangeError("Upgrade cost exceeds safe currency range");
  const materials = [
    { id: UPGRADE_STONE, quantity: nextLevel },
    ...(nextLevel % 5 === 0 ? [{ id: ARCANE_DUST, quantity: Math.ceil(nextLevel / 5) }] : [])
  ];
  return {
    canUpgrade: true, currentLevel, nextLevel, goldCopper, materials,
    successChance: Math.max(0.5, 1 - currentLevel * 0.025),
    statMultiplier: 1 + nextLevel * 0.05
  };
}

function validUpgradeInventory(inventory, materials) {
  return inventory && Array.isArray(inventory.items) &&
    materials.every(material => Number.isSafeInteger(countItem(inventory, material.id)) &&
      countItem(inventory, material.id) >= material.quantity);
}

function validRandom(random) {
  if (typeof random !== "function") throw new TypeError("Upgrade random source must be a function");
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Upgrade random source must return a number in [0, 1)");
  }
  return value;
}

export function upgradeGear(item, { inventory, wallet, random = Math.random } = {}) {
  const quote = quoteGearUpgrade(item);
  if (!quote.canUpgrade) return { ok: false, reason: quote.reason, quote };
  if (!validUpgradeInventory(inventory, quote.materials)) {
    return { ok: false, reason: "insufficient_materials", quote };
  }
  if (!wallet || !safeCopper(wallet.copper)) return { ok: false, reason: "invalid_wallet", quote };
  if (wallet.copper < quote.goldCopper) return { ok: false, reason: "insufficient_funds", quote };

  const roll = validRandom(random);
  const baseStats = item.baseUpgradeStats ?? structuredClone(item.stats ?? {});
  if (!baseStats || typeof baseStats !== "object" || Array.isArray(baseStats) ||
      Object.values(baseStats).some(value => typeof value !== "number" || !Number.isFinite(value))) {
    return { ok: false, reason: "invalid_base_stats", quote };
  }

  // All failure conditions are checked before consuming any resources.
  for (const material of quote.materials) {
    const removed = removeItem(inventory, material.id, material.quantity);
    if (!removed.ok) throw new Error("Upgrade material inventory changed during transaction");
  }
  wallet.copper -= quote.goldCopper;
  if (roll >= quote.successChance) {
    return { ok: false, reason: "upgrade_failed", consumed: true, quote, upgradeLevel: quote.currentLevel };
  }

  const nextStats = {};
  for (const [key, value] of Object.entries(baseStats)) {
    nextStats[key] = Math.round(value * quote.statMultiplier * 100) / 100;
  }
  item.baseUpgradeStats ??= structuredClone(baseStats);
  item.stats = nextStats;
  item.upgradeLevel = quote.nextLevel;
  return {
    ok: true, item, quote, upgradeLevel: item.upgradeLevel,
    statMultiplier: quote.statMultiplier
  };
}
