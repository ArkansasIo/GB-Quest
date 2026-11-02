import framework from "../data/enemy-framework.json" with { type: "json" };
import bossCatalog from "../data/bosses-350.json" with { type: "json" };
import taxonomy from "../data/monster-taxonomy.json" with { type: "json" };
import { createMonsterCombatant } from "./monsters.js";

export const ENEMY_RANKS = Object.freeze(framework.ranks);
export const ENCOUNTER_DIFFICULTIES = Object.freeze(framework.difficulties);
export const ENEMY_AFFIXES = Object.freeze(framework.affixes);
export const MONSTER_ARCHETYPES = Object.freeze(taxonomy.monsterClasses);
export const BOSS_DEFINITIONS = Object.freeze(bossCatalog.bosses);

const bossesById = new Map(BOSS_DEFINITIONS.map(boss => [boss.id, boss]));
const archetypesById = new Map(MONSTER_ARCHETYPES.map(archetype => [archetype.id, archetype]));
const defaultBossPhases = framework.bossPhases;
const MAX_PARTY_SIZE = 20;

function requireNumber(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be from ${min} to ${max}`);
  }
}

function getArchetype(id, subclass = null) {
  if (id === null) {
    if (subclass !== null) throw new RangeError("An enemy subclass requires an archetype");
    return { id: null, subclass: null };
  }
  const archetype = archetypesById.get(id);
  if (!archetype) throw new RangeError(`Unknown enemy archetype: ${id}`);
  if (subclass && !archetype.subclasses.some(entry => entry.id === subclass)) {
    throw new RangeError(`Unknown ${id} subclass: ${subclass}`);
  }
  return { id, subclass };
}

function getRank(rank) {
  const definition = ENEMY_RANKS[rank];
  if (!definition) throw new RangeError(`Unknown enemy rank: ${rank}`);
  return definition;
}

function getDifficulty(difficulty) {
  const definition = ENCOUNTER_DIFFICULTIES[difficulty];
  if (!definition) throw new RangeError(`Unknown encounter difficulty: ${difficulty}`);
  return definition;
}

function normalizeAffixes(affixes) {
  if (!Array.isArray(affixes)) throw new TypeError("Enemy affixes must be an array");
  const unique = [...new Set(affixes)];
  for (const id of unique) {
    if (!Object.hasOwn(ENEMY_AFFIXES, id)) throw new RangeError(`Unknown enemy affix: ${id}`);
  }
  return unique;
}

export function listBosses({
  rank = null, regionId = null, level = null, partySize = null, mechanics = null,
  query = "", limit = 100
} = {}) {
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 720)) {
    throw new RangeError("Character level must be from 1 to 720");
  }
  if (partySize !== null && (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE)) {
    throw new RangeError(`Party size must be from 1 to ${MAX_PARTY_SIZE}`);
  }
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Boss limit must be a positive integer");
  const requiredMechanics = mechanics === null ? [] : Array.isArray(mechanics) ? mechanics : [mechanics];
  const needle = String(query).trim().toLowerCase();
  return BOSS_DEFINITIONS
    .filter(boss => !rank || boss.rank === rank)
    .filter(boss => !regionId || boss.regionId === regionId)
    .filter(boss => level === null || (level >= boss.levelRange[0] && level <= boss.levelRange[1]))
    .filter(boss => partySize === null || partySize <= boss.partySize)
    .filter(boss => requiredMechanics.every(mechanic => boss.mechanics.includes(mechanic)))
    .filter(boss => !needle || `${boss.id} ${boss.name} ${boss.regionId}`.toLowerCase().includes(needle))
    .slice(0, limit);
}

export function createScaledMonster(identifier, {
  id = null, hpMode = "average", random = Math.random, rank = "common",
  difficulty = "normal", partySize = 1, archetype = null, subclass = null, affixes = []
} = {}) {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
    throw new RangeError(`Party size must be from 1 to ${MAX_PARTY_SIZE}`);
  }
  const rankDefinition = getRank(rank);
  const difficultyDefinition = getDifficulty(difficulty);
  const selectedArchetype = getArchetype(archetype, subclass);
  const selectedAffixes = normalizeAffixes(affixes);
  const monster = createMonsterCombatant(identifier, { id, hpMode, random });
  const partyHealth = Math.min(
    framework.partyScaling.maximumHealthMultiplier,
    1 + (partySize - 1) * framework.partyScaling.additionalPlayerHealth
  );
  const affixModifiers = selectedAffixes.reduce((combined, affixId) => {
    const affix = ENEMY_AFFIXES[affixId];
    for (const [key, value] of Object.entries(affix)) {
      if (typeof value === "number") {
        combined[key] = key === "damage" ? (combined[key] ?? 1) * value : (combined[key] ?? 0) + value;
      } else {
        combined[key] = value;
      }
    }
    return combined;
  }, {});
  const hpMultiplier = rankDefinition.health * difficultyDefinition.health * partyHealth;
  const hp = Math.max(1, Math.ceil(monster.hp * hpMultiplier));
  return {
    ...monster,
    rank,
    difficulty,
    partySize,
    hp,
    maxHp: hp,
    armorClass: monster.armorClass + rankDefinition.armor + difficultyDefinition.armor,
    damageMultiplier: rankDefinition.damage * difficultyDefinition.damage * (affixModifiers.damage ?? 1),
    threatMultiplier: rankDefinition.damage,
    controlResistance: Math.min(1, rankDefinition.controlResistance + (affixModifiers.controlResistanceBonus ?? 0)),
    lootMultiplier: rankDefinition.loot,
    affixes: selectedAffixes,
    affixModifiers,
    archetype: selectedArchetype.id,
    subclass: selectedArchetype.subclass
  };
}

function validateBossPhases(phases) {
  if (!Array.isArray(phases)) throw new TypeError("Boss phases must be an array");
  const ids = new Set();
  return phases.map(phase => {
    if (!phase || typeof phase.id !== "string" || !phase.id.trim() || ids.has(phase.id) ||
        !phase.trigger || !["hp_percent", "elapsed_ms", "player_deaths"].includes(phase.trigger.type) ||
        !Array.isArray(phase.actions)) {
      throw new TypeError("Boss phase requires a unique id, supported trigger and action list");
    }
    ids.add(phase.id);
    if (phase.trigger.type === "hp_percent") requireNumber(phase.trigger.value, "Boss HP threshold", { min: 0.01, max: 0.99 });
    else if (phase.trigger.type === "elapsed_ms") requireNumber(phase.trigger.value, "Boss phase time", { min: 1 });
    else if (!Number.isInteger(phase.trigger.value) || phase.trigger.value < 1) {
      throw new RangeError("Boss player-death threshold must be a positive integer");
    }
    if (!phase.actions.every(action => typeof action === "string" && action.trim())) {
      throw new TypeError("Boss phase actions must be non-empty strings");
    }
    return structuredClone(phase);
  });
}

export function createBossEncounter(identifier, {
  maxHp, phases = defaultBossPhases, enrageAfterMs = null
} = {}) {
  const boss = typeof identifier === "string" ? bossesById.get(identifier) : bossesById.get(identifier?.id);
  if (!boss) throw new RangeError("Unknown boss definition");
  requireNumber(maxHp, "Boss maximum HP", { min: 1, max: Number.MAX_SAFE_INTEGER });
  if (!Number.isSafeInteger(maxHp)) throw new TypeError("Boss maximum HP must be a safe integer");
  if (enrageAfterMs !== null) requireNumber(enrageAfterMs, "Boss enrage timer", { min: 1 });
  return {
    bossId: boss.id,
    name: boss.name,
    rank: boss.rank,
    creatureType: boss.creatureType,
    archetype: boss.monsterClass,
    subclass: boss.subclass,
    regionId: boss.regionId,
    levelRange: [...boss.levelRange],
    recommendedPartySize: boss.partySize,
    mechanics: [...boss.mechanics],
    lootTier: boss.lootTier,
    hp: maxHp,
    maxHp,
    phases: validateBossPhases(phases),
    activePhase: null,
    triggeredPhaseIds: [],
    elapsedMs: 0,
    playerDeaths: 0,
    enrageAfterMs,
    enraged: false,
    defeated: false
  };
}

function phaseHasTriggered(phase, encounter) {
  const { type, value } = phase.trigger;
  if (type === "hp_percent") return encounter.hp / encounter.maxHp <= value;
  if (type === "elapsed_ms") return encounter.elapsedMs >= value;
  return encounter.playerDeaths >= value;
}

function collectBossTriggers(encounter) {
  const events = [];
  for (const phase of encounter.phases) {
    if (encounter.triggeredPhaseIds.includes(phase.id)) continue;
    if (phaseHasTriggered(phase, encounter)) {
      encounter.activePhase = phase.id;
      encounter.triggeredPhaseIds.push(phase.id);
      events.push({ type: "phase", phaseId: phase.id, actions: [...phase.actions] });
    }
  }
  if (!encounter.enraged && encounter.enrageAfterMs !== null && encounter.elapsedMs >= encounter.enrageAfterMs) {
    encounter.enraged = true;
    events.push({ type: "enrage" });
  }
  return events;
}

export function damageBoss(encounter, amount) {
  if (!encounter || !Array.isArray(encounter.phases) || encounter.defeated) {
    throw new TypeError("An active boss encounter is required");
  }
  requireNumber(amount, "Boss damage", { min: 0 });
  const applied = Math.min(encounter.hp, Math.floor(amount));
  encounter.hp -= applied;
  encounter.defeated = encounter.hp === 0;
  const events = encounter.defeated
    ? [{ type: "defeated" }]
    : collectBossTriggers(encounter);
  return {
    applied,
    hp: encounter.hp,
    defeated: encounter.defeated,
    events
  };
}

export function tickBossEncounter(encounter, { elapsedMs = 0, playerDeaths = 0 } = {}) {
  if (!encounter || !Array.isArray(encounter.phases) || encounter.defeated) {
    throw new TypeError("An active boss encounter is required");
  }
  requireNumber(elapsedMs, "Elapsed milliseconds");
  if (!Number.isInteger(playerDeaths) || playerDeaths < 0) {
    throw new RangeError("Player deaths must be a non-negative integer");
  }
  encounter.elapsedMs += elapsedMs;
  encounter.playerDeaths += playerDeaths;
  return collectBossTriggers(encounter);
}
