export const MMO_LEVEL_CAP = 720;

const TALENT_BUILD_FIELDS = ["classId", "specId", "pointsSpent", "availablePoints", "selected"];

export function xpToNextLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level >= MMO_LEVEL_CAP) return 0;
  return Math.floor(100 * Math.pow(level, 1.65) + level * 75);
}

export function grantXp(player, amount) {
  if (!player || typeof player !== "object") throw new TypeError("Player state is required");
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("XP must be non-negative");

  const level = player.level ?? 1;
  const xp = player.xp ?? 0;
  if (!Number.isInteger(level) || level < 1 || level > MMO_LEVEL_CAP) {
    throw new RangeError(`Player level must be between 1 and ${MMO_LEVEL_CAP}`);
  }
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError("Player XP must be a non-negative safe integer");

  player.level = level;
  player.xp = xp;
  if (level === MMO_LEVEL_CAP) {
    return { levels: [], level, xp, nextLevelXp: 0 };
  }

  const earned = Math.floor(amount);
  if (!Number.isSafeInteger(player.xp + earned)) throw new RangeError("XP total exceeds the safe integer limit");
  player.xp += earned;

  const levels = [];
  while (player.level < MMO_LEVEL_CAP) {
    const threshold = xpToNextLevel(player.level);
    if (player.xp < threshold) break;
    player.xp -= threshold;
    player.level += 1;
    levels.push(player.level);
  }

  return {
    levels,
    level: player.level,
    xp: player.xp,
    nextLevelXp: xpToNextLevel(player.level),
  };
}

export function createTalentBuild(classId, specId, points = 0) {
  if (typeof classId !== "string" || !classId.trim()) throw new TypeError("classId is required");
  if (typeof specId !== "string" || !specId.trim()) throw new TypeError("specId is required");
  if (!Number.isInteger(points) || points < 0) throw new RangeError("Talent points must be a non-negative integer");
  return { classId, specId, pointsSpent: 0, availablePoints: points, selected: [] };
}

function validateTalentBuild(build) {
  if (!build || typeof build !== "object" || TALENT_BUILD_FIELDS.some((field) => !(field in build))) {
    throw new TypeError("Invalid talent build");
  }
  if (!Number.isInteger(build.pointsSpent) || build.pointsSpent < 0
    || !Number.isInteger(build.availablePoints) || build.availablePoints < 0
    || !Array.isArray(build.selected)
    || build.selected.some((id) => typeof id !== "string" || !id)
    || new Set(build.selected).size !== build.selected.length) {
    throw new RangeError("Talent build state is invalid");
  }
}

function validateTalent(talent) {
  if (!talent || typeof talent !== "object" || typeof talent.id !== "string" || !talent.id.trim()) {
    throw new TypeError("Talent id is required");
  }
  if (!Number.isInteger(talent.cost) || talent.cost < 0) throw new RangeError("Talent cost must be a non-negative integer");
  if (talent.prerequisites !== undefined
    && (!Array.isArray(talent.prerequisites) || talent.prerequisites.some((id) => typeof id !== "string" || !id))) {
    throw new TypeError("Talent prerequisites must be an array of talent ids");
  }
}

export function learnTalent(build, talent) {
  validateTalentBuild(build);
  validateTalent(talent);
  if (build.selected.includes(talent.id)) return { ok: false, reason: "already_learned" };
  if (build.availablePoints < talent.cost) return { ok: false, reason: "insufficient_points" };
  if ((talent.prerequisites || []).some((id) => !build.selected.includes(id))) {
    return { ok: false, reason: "prerequisite_missing" };
  }

  build.availablePoints -= talent.cost;
  build.pointsSpent += talent.cost;
  build.selected.push(talent.id);
  return { ok: true, talentId: talent.id, pointsSpent: talent.cost };
}

export function respecTalents(build) {
  validateTalentBuild(build);
  const refundedPoints = build.pointsSpent;
  build.availablePoints += refundedPoints;
  build.pointsSpent = 0;
  build.selected = [];
  return { ok: true, refundedPoints, build };
}

export function rollLootTable(table, random = Math.random) {
  if (!Array.isArray(table)) throw new TypeError("Loot table must be an array");
  if (typeof random !== "function") throw new TypeError("random must be a function");
  return table.filter((entry) => {
    if (!entry || !(entry.chance >= 0 && entry.chance <= 1)) throw new RangeError("Loot chance must be 0..1");
    return random() < entry.chance;
  }).map((entry) => ({ ...entry.item, quantity: entry.quantity || 1 }));
}

export function distributeLoot(items, mode, party, random = Math.random) {
  if (!Array.isArray(items) || !Array.isArray(party)) throw new TypeError("Items and party must be arrays");
  if (typeof random !== "function") throw new TypeError("random must be a function");
  if (!party.length && items.length) throw new RangeError("A party is required to distribute loot");
  if (party.some((player) => !player || player.id === undefined || player.id === null)) {
    throw new TypeError("Every party member must have an id");
  }
  if (mode === "personal") {
    const rewards = Object.fromEntries(party.map((player) => [player.id, []]));
    for (const item of items) {
      const roll = random();
      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError("random must return a value in [0, 1)");
      const recipient = party[Math.floor(roll * party.length)];
      rewards[recipient.id].push(item);
    }
    return rewards;
  }
  if (mode === "round-robin") {
    return items.map((item, index) => ({ playerId: party[index % party.length].id, item }));
  }
  if (mode === "master-loot") return { mode, items: [...items], requiresLeaderAssignment: true };
  throw new RangeError("Unknown loot mode");
}
