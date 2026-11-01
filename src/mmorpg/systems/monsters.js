import monsterData from "../data/monsters.json" with { type: "json" };
import { rollDice } from "../rules/dice.js";

export const MONSTER_SOURCE = "D&D System Reference Document 5.2.1";
export const MONSTERS = monsterData.monsters;
const byId = new Map(MONSTERS.map((monster) => [monster.id, monster]));
const byName = new Map(MONSTERS.map((monster) => [monster.name.toLowerCase(), monster]));

const XP_BY_CR = Object.freeze({
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000,
  "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000
});

function normalizeMonster(monster) {
  if (typeof monster === "string") {
    const key = monster.trim().toLowerCase();
    return byId.get(key) ?? byName.get(key) ?? null;
  }
  if (monster && typeof monster === "object" && monster.id) {
    return byId.get(monster.id) ?? null;
  }
  return null;
}

export function getMonster(identifier) {
  return normalizeMonster(identifier);
}

export function getMonsterExperience(monster) {
  const entry = normalizeMonster(monster);
  if (!entry) throw new RangeError("Unknown SRD monster");
  return XP_BY_CR[entry.cr] ?? 0;
}

export function searchMonsters({
  query = "", type = null, size = null, cr = null,
  minCr = null, maxCr = null, limit = Infinity
} = {}) {
  const needle = String(query).trim().toLowerCase();
  const results = MONSTERS.filter((monster) => {
    if (needle && !monster.name.toLowerCase().includes(needle) &&
        !monster.type.includes(needle) && !monster.id.includes(needle)) return false;
    if (type && monster.type !== String(type).toLowerCase()) return false;
    if (size && monster.size.toLowerCase() !== String(size).toLowerCase()) return false;
    if (cr !== null && monster.cr !== String(cr)) return false;
    if (minCr !== null && monster.cr_numeric < Number(minCr)) return false;
    if (maxCr !== null && monster.cr_numeric > Number(maxCr)) return false;
    return true;
  });
  return results.slice(0, Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : results.length));
}

export function createMonsterCombatant(identifier, {
  id = null, hpMode = "average", random = Math.random
} = {}) {
  const monster = normalizeMonster(identifier);
  if (!monster) throw new RangeError("Unknown SRD monster");
  if (hpMode !== "average" && hpMode !== "roll") {
    throw new RangeError('hpMode must be "average" or "roll"');
  }
  const hp = hpMode === "roll"
    ? rollDice(monster.hp_formula, random).total
    : monster.hp_max;
  const statBlock = structuredClone(monster.stat_block_json);
  return {
    id: id ?? monster.id,
    monsterId: monster.id,
    name: monster.name,
    size: monster.size,
    type: monster.type,
    challengeRating: monster.cr,
    experience: getMonsterExperience(monster),
    armorClass: monster.armor_class,
    initiativeModifier: monster.initiative_modifier,
    hp,
    maxHp: hp,
    speed: structuredClone(statBlock.speed),
    abilityScores: structuredClone(statBlock.ability_scores),
    statBlock,
    conditions: [],
    defeated: false,
    legendaryActionsRemaining: statBlock.legendary_actions?.per_round ?? 0
  };
}

export function rollMonsterInitiative(combatant, random = Math.random) {
  if (!combatant || !Number.isFinite(combatant.initiativeModifier)) {
    throw new TypeError("A monster combatant is required");
  }
  const sample = random();
  if (!(sample >= 0 && sample < 1)) throw new RangeError("Random source must return [0, 1)");
  const d20 = 1 + Math.floor(sample * 20);
  return { d20, total: d20 + combatant.initiativeModifier };
}

export function buildMonsterEncounter(monsters) {
  if (!Array.isArray(monsters)) throw new TypeError("Encounter monsters must be an array");
  const combatants = monsters.map((entry, index) => {
    if (typeof entry === "string") return createMonsterCombatant(entry, { id: `monster-${index + 1}` });
    if (!entry || typeof entry !== "object") throw new TypeError("Invalid monster encounter entry");
    const quantity = Math.max(1, Math.floor(entry.quantity ?? 1));
    return Array.from({ length: quantity }, (_, copy) =>
      createMonsterCombatant(entry.monster ?? entry.id ?? entry.name, {
        id: `monster-${index + 1}-${copy + 1}`,
        hpMode: entry.hpMode ?? "average"
      })
    );
  }).flat();
  return {
    combatants,
    monsterCount: combatants.length,
    totalExperience: combatants.reduce((sum, combatant) => sum + combatant.experience, 0)
  };
}

export function getMonsterCatalogSummary() {
  return {
    source: MONSTER_SOURCE,
    count: MONSTERS.length,
    byType: Object.fromEntries([...new Set(MONSTERS.map((monster) => monster.type))]
      .sort().map((type) => [type, MONSTERS.filter((monster) => monster.type === type).length])),
    challengeRatingRange: [
      Math.min(...MONSTERS.map((monster) => monster.cr_numeric)),
      Math.max(...MONSTERS.map((monster) => monster.cr_numeric))
    ]
  };
}
