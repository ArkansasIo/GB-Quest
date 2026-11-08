const DEFAULT_WEIGHTS = Object.freeze({
  Strength: 1, Dexterity: 1, Constitution: 1, Intelligence: 1, Wisdom: 1, Vitality: 1,
  AttackPower: 1, SpellPower: 1, Armor: 0.7, MaxHealth: 0.35, MaxMana: 0.2,
  CriticalChance: 8, CriticalDamage: 0.08, AttackSpeed: 5, Haste: 5, Dodge: 4,
  Block: 2, LifeSteal: 4, FireResistance: 0.5, ColdResistance: 0.5,
  LightningResistance: 0.5, PoisonResistance: 0.5
});
const statKey = key => key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
function statEntries(lines) {
  if (Array.isArray(lines)) return lines.filter(x => x && typeof x.statId === "string" && Number.isFinite(Number(x.value)));
  if (lines && typeof lines === "object") return Object.entries(lines).filter(([, value]) => Number.isFinite(Number(value))).map(([statId, value]) => ({ statId, value: Number(value) }));
  return [];
}
function itemStatLines(item = {}) {
  return [...statEntries(item.baseStats), ...statEntries(item.subStats), ...statEntries(item.stats)];
}
function isPercentStat(item, statId) {
  return itemStatLines(item).some(line => line.statId === statId && line.isPercent === true);
}
function scoreStatValue(value, isPercent) {
  return isPercent ? value / 100 : value;
}
export function aggregateGearStats(item = {}) {
  const totals = new Map();
  for (const line of itemStatLines(item)) {
    totals.set(line.statId, (totals.get(line.statId) || 0) + Number(line.value));
  }
  return Object.fromEntries([...totals.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
export function compareGearStats(candidate = {}, equipped = {}) {
  const next = aggregateGearStats(candidate), current = aggregateGearStats(equipped);
  return [...new Set([...Object.keys(next), ...Object.keys(current)])].sort().map(statId => ({
    statId, candidateValue: next[statId] || 0, equippedValue: current[statId] || 0,
    difference: (next[statId] || 0) - (current[statId] || 0),
    isPercent: isPercentStat(candidate, statId) || isPercentStat(equipped, statId)
  }));
}
function weightFor(key, weights) {
  if (Number.isFinite(weights[key])) return weights[key];
  const normalized = statKey(key);
  const match = Object.keys(weights).find(candidate => statKey(candidate) === normalized);
  return match ? weights[match] : 0.5;
}
export function calculateGearScore(item = {}, weights = DEFAULT_WEIGHTS) {
  const stats = aggregateGearStats(item);
  const statScore = Object.entries(stats).reduce((sum, [key, value]) =>
    sum + scoreStatValue(value, isPercentStat(item, key)) * weightFor(key, weights), 0);
  return statScore + Math.max(0, Number(item.rarity) || 0) * 0.25 + Math.max(1, Number(item.itemLevel) || 1) * 0.05;
}
export function inspectGear(candidate = {}, equipped = null, { characterLevel = 1, weights = DEFAULT_WEIGHTS } = {}) {
  const level = Math.max(1, Math.floor(Number(characterLevel) || 1));
  const requiredLevel = Math.max(0, Math.floor(Number(candidate.requiredLevel) || 0));
  const score = calculateGearScore(candidate, weights);
  const equippedScore = equipped ? calculateGearScore(equipped, weights) : 0;
  const comparison = compareGearStats(candidate, equipped || {});
  const statDeltaScore = comparison.reduce((sum, row) =>
    sum + scoreStatValue(row.difference, row.isPercent) * weightFor(row.statId, weights), 0);
  const upgradeDelta = statDeltaScore
    + (Math.max(0, Number(candidate.rarity) || 0) - Math.max(0, Number(equipped?.rarity) || 0)) * 0.25
    + (Math.max(1, Number(candidate.itemLevel) || 1) - Math.max(1, Number(equipped?.itemLevel) || 1)) * 0.05;
  return {
    item: structuredClone(candidate),
    baseStats: statEntries(candidate.baseStats),
    subStats: statEntries(candidate.subStats).map(line => ({ ...line, greaterAffix: line.greaterAffix === true })),
    affixes: Array.isArray(candidate.affixes) ? [...candidate.affixes] : [],
    specialEffect: String(candidate.specialEffect || ""),
    comparison, powerScore: score, equippedPowerScore: equippedScore, upgradeDelta,
    isUpgradeByScore: !equipped || upgradeDelta > 0,
    canEquip: requiredLevel <= level,
    restriction: requiredLevel > level ? `Requires level ${requiredLevel}` : null
  };
}
export function quoteVendorPurchase(item, options = {}) {
  const buyMultiplier = options.buyMultiplier ?? 1.25;
  const characterLevel = options.characterLevel ?? 1;
  const availableGold = options.availableGold ?? 0;
  const stock = options.stock ?? -1;
  const vendorValue = Number(item?.vendorValue);
  const validValue = Number.isFinite(vendorValue) && vendorValue > 0;
  const validMultiplier = Number.isFinite(buyMultiplier) && buyMultiplier > 0;
  const validLevel = Number.isFinite(characterLevel) && characterLevel >= 1;
  const validWallet = Number.isFinite(availableGold) && availableGold >= 0;
  const validStock = stock === -1 || (Number.isSafeInteger(stock) && stock >= 0);
  const rawPrice = validValue && validMultiplier ? Math.ceil(vendorValue * buyMultiplier) : 0;
  const price = Number.isSafeInteger(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  let reason = null;
  if (!validValue) reason = "invalid_vendor_value";
  else if (!validMultiplier || !validLevel || !validWallet || !validStock || !price) reason = "invalid_quote";
  else if (stock === 0) reason = "out_of_stock";
  else if ((Number(item?.requiredLevel) || 0) > characterLevel) reason = "level_too_low";
  else if (availableGold < price) reason = "insufficient_gold";
  return { item: structuredClone(item || {}), price, canPurchase: reason === null, reason };
}
export function quoteVendorSale(item, options = {}) {
  const vendorValue = Number(item?.vendorValue);
  const sellMultiplier = options.sellMultiplier ?? 0.5;
  const validValue = Number.isFinite(vendorValue) && vendorValue > 0;
  const validMultiplier = Number.isFinite(sellMultiplier) && sellMultiplier > 0;
  const rawPrice = validValue && validMultiplier ? Math.floor(vendorValue * sellMultiplier) : 0;
  const price = Number.isSafeInteger(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  const canSell = validValue && validMultiplier && price > 0;
  return {
    item: structuredClone(item || {}), price, canSell,
    reason: canSell ? null : validValue ? "no_resale_value" : "invalid_vendor_value"
  };
}
