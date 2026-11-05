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
export function aggregateGearStats(item = {}) {
  const totals = new Map();
  for (const line of [...statEntries(item.baseStats), ...statEntries(item.subStats), ...statEntries(item.stats)]) {
    totals.set(line.statId, (totals.get(line.statId) || 0) + Number(line.value));
  }
  return Object.fromEntries([...totals.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
export function compareGearStats(candidate = {}, equipped = {}) {
  const next = aggregateGearStats(candidate), current = aggregateGearStats(equipped);
  return [...new Set([...Object.keys(next), ...Object.keys(current)])].sort().map(statId => ({
    statId, candidateValue: next[statId] || 0, equippedValue: current[statId] || 0,
    difference: (next[statId] || 0) - (current[statId] || 0),
    isPercent: [...statEntries(candidate.baseStats), ...statEntries(candidate.subStats)].find(x => x.statId === statId)?.isPercent === true
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
  const statScore = Object.entries(stats).reduce((sum, [key, value]) => sum + value * weightFor(key, weights), 0);
  return statScore + Math.max(0, Number(item.rarity) || 0) * 0.25 + Math.max(1, Number(item.itemLevel) || 1) * 0.05;
}
export function inspectGear(candidate = {}, equipped = null, { characterLevel = 1, weights = DEFAULT_WEIGHTS } = {}) {
  const level = Math.max(1, Math.floor(Number(characterLevel) || 1));
  const requiredLevel = Math.max(0, Math.floor(Number(candidate.requiredLevel) || 0));
  const score = calculateGearScore(candidate, weights);
  const equippedScore = equipped ? calculateGearScore(equipped, weights) : 0;
  const comparison = compareGearStats(candidate, equipped || {});
  const statDeltaScore = comparison.reduce((sum, row) => sum + row.difference * weightFor(row.statId, weights), 0);
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
export function quoteVendorPurchase(item, { buyMultiplier = 1.25, characterLevel = 1, availableGold = 0, stock = -1 } = {}) {
  const price = Math.max(1, Math.ceil(Math.max(0, Number(item?.vendorValue) || 0) * Math.max(0.01, Number(buyMultiplier) || 1.25)));
  let reason = null;
  if (stock === 0) reason = "out_of_stock";
  else if ((Number(item?.requiredLevel) || 0) > characterLevel) reason = "level_too_low";
  else if (availableGold < price) reason = "insufficient_gold";
  return { item: structuredClone(item || {}), price, canPurchase: reason === null, reason };
}
export function quoteVendorSale(item, { sellMultiplier = 0.5 } = {}) {
  const value = Math.max(0, Number(item?.vendorValue) || 0);
  const price = Math.max(0, Math.floor(value * Math.max(0, Number(sellMultiplier) || 0)));
  return { item: structuredClone(item || {}), price, canSell: value > 0 && price > 0, reason: value > 0 && price > 0 ? null : "no_resale_value" };
}
