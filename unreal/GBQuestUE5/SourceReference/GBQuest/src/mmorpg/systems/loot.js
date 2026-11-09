function validateRandom(random) {
  if (typeof random !== "function") throw new TypeError("Loot random source must be a function");
}

function roll(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Loot random source must return a number in [0, 1)");
  }
  return value;
}

export function rollLootTable(table, random = Math.random) {
  if (!Array.isArray(table)) throw new TypeError("Loot table must be an array");
  validateRandom(random);
  const rewards = [];
  for (const entry of table) {
    if (!entry || !Number.isFinite(entry.chance) || entry.chance < 0 || entry.chance > 1) {
      throw new RangeError("Loot chance must be between 0 and 1");
    }
    if (!entry.item || typeof entry.item !== "object" || Array.isArray(entry.item)) {
      throw new TypeError("Loot entry requires an item object");
    }
    const quantity = entry.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new RangeError("Loot quantity must be a positive safe integer");
    }
    if (roll(random) < entry.chance) {
      rewards.push({ ...structuredClone(entry.item), quantity });
    }
  }
  return rewards;
}

function validateParty(party) {
  if (!Array.isArray(party) || party.length === 0) {
    throw new TypeError("Loot distribution requires a non-empty party");
  }
  const ids = party.map(player => player?.id);
  if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new TypeError("Party members require unique non-empty ids");
  }
}

export function distributeLoot(items, mode, party, random = Math.random) {
  if (!Array.isArray(items)) throw new TypeError("Loot rewards must be an array");
  validateParty(party);
  validateRandom(random);
  if (items.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new TypeError("Loot rewards must contain item objects");
  }

  if (mode === "personal") {
    const distribution = Object.fromEntries(party.map(player => [player.id, []]));
    for (const item of items) {
      for (const player of party) {
        if (roll(random) < 1 / party.length) {
          distribution[player.id].push(structuredClone(item));
        }
      }
    }
    return distribution;
  }
  if (mode === "round-robin") {
    return items.map((item, index) => ({
      playerId: party[index % party.length].id,
      item: structuredClone(item)
    }));
  }
  if (mode === "master-loot") {
    return { mode, items: structuredClone(items), requiresLeaderAssignment: true };
  }
  throw new RangeError("Unknown loot mode");
}
