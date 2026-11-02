import atlas from "../../../world/maps/index.json" with { type: "json" };
import points from "../../../world/catalog/points-of-interest.json" with { type: "json" };
import { getWorldMap } from "../world/map-registry.js";

const poiById = new Map(points.pointsOfInterest.map(poi => [poi.id, poi]));
const instanceMaps = atlas.maps.filter(map => map.kind === "dungeon" || map.kind === "raid");
const towerDefinition = Object.freeze({
  id: "spire-of-a-hundred",
  name: "Spire of a Hundred",
  kind: "tower",
  zoneId: "westreach-01",
  levelRange: [3, 720],
  floors: 100,
  checkpointInterval: 10,
  miniBossInterval: 5,
  partySize: [1, 4],
  difficultyModes: ["normal", "heroic", "mythic"],
  entrance: { id: "entrance-spire-of-a-hundred", type: "tower-gate" }
});

function assertLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > 720) throw new RangeError("Character level must be from 1 to 720");
}

function normalizeMap(map) {
  const poi = map.poiId ? poiById.get(map.poiId) : null;
  return {
    id: map.id,
    mapId: map.id,
    name: map.name,
    kind: map.kind,
    continentId: map.continentId,
    zoneId: map.zoneId,
    poiId: poi?.id ?? null,
    entrance: {
      id: poi?.id ?? `entrance-${map.id}`,
      name: poi?.name ?? `${map.name} Entrance`,
      zoneId: map.zoneId,
      type: map.kind === "raid" ? "raid-portal" : "dungeon-entrance"
    },
    levelRange: [...map.levelRange],
    partySize: [...map.instance.partySize],
    difficultyModes: [...map.instance.difficultyModes],
    lockout: map.instance.lockout ?? (map.instance.resettable ? "resettable" : null),
    bossCount: map.instance.bossCount ?? null,
    dimensionsTiles: [...map.dimensionsTiles],
    seedPolicy: map.seedPolicy
  };
}

const INSTANCE_ENTRANCES = Object.freeze(instanceMaps.map(normalizeMap));

export function listInstanceEntrances({
  kind = null, level = null, continentId = null, zoneId = null, query = "", difficulty = null,
  partySize = null, includeUnavailable = false, limit = 100
} = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Finder limit must be a positive integer");
  if (level !== null) assertLevel(level);
  if (partySize !== null && (!Number.isInteger(partySize) || partySize < 1 || partySize > 40)) {
    throw new RangeError("Party size must be from 1 to 40");
  }
  const needle = String(query).trim().toLowerCase();
  return INSTANCE_ENTRANCES.filter(instance =>
    (!kind || instance.kind === kind) &&
    (!continentId || instance.continentId === continentId) &&
    (!zoneId || instance.zoneId === zoneId) &&
    (!needle || `${instance.id} ${instance.name} ${instance.zoneId}`.toLowerCase().includes(needle)) &&
    (!difficulty || instance.difficultyModes.includes(difficulty)) &&
    (partySize === null || (partySize >= instance.partySize[0] && partySize <= instance.partySize[1])) &&
    (level === null || (level >= instance.levelRange[0] && level <= instance.levelRange[1] || includeUnavailable))
  ).slice(0, limit).map(instance => ({
    ...instance,
    available: level === null || (level >= instance.levelRange[0] && level <= instance.levelRange[1])
  }));
}

export function getInstanceEntrance(id) {
  return INSTANCE_ENTRANCES.find(instance => instance.id === id || instance.entrance.id === id) ?? null;
}

export function listTowerEntries({ level = null, bestFloor = 0, query = "" } = {}) {
  if (level !== null) assertLevel(level);
  if (!Number.isInteger(bestFloor) || bestFloor < 0 || bestFloor > towerDefinition.floors) {
    throw new RangeError("Best tower floor must be from 0 to 100");
  }
  const needle = String(query).trim().toLowerCase();
  if (needle && !`${towerDefinition.id} ${towerDefinition.name} tower spire`.toLowerCase().includes(needle)) return [];
  const recommendedFloor = Math.min(towerDefinition.floors, Math.max(1, Math.floor((level ?? 1) / 7) + 1));
  const unlockedCheckpoints = [1];
  for (let floor = towerDefinition.checkpointInterval; floor <= bestFloor; floor += towerDefinition.checkpointInterval) {
    unlockedCheckpoints.push(floor);
  }
  return [{
    ...towerDefinition,
    level,
    bestFloor,
    recommendedFloor,
    unlockedCheckpoints,
    available: level === null || level >= towerDefinition.levelRange[0]
  }];
}

export function startTowerRun({ level, floor = 1, bestFloor = 0, partySize = 1 }) {
  assertLevel(level);
  if (!Number.isInteger(floor) || floor < 1 || floor > towerDefinition.floors) {
    return { ok: false, reason: "invalid_floor" };
  }
  if (!Number.isInteger(bestFloor) || bestFloor < 0 || bestFloor > towerDefinition.floors) {
    return { ok: false, reason: "invalid_progress" };
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > towerDefinition.partySize[1]) {
    return { ok: false, reason: "invalid_party_size" };
  }
  const allowedFloors = new Set([1]);
  for (let checkpoint = towerDefinition.checkpointInterval; checkpoint <= bestFloor; checkpoint += towerDefinition.checkpointInterval) {
    allowedFloors.add(checkpoint);
  }
  if (!allowedFloors.has(floor)) return { ok: false, reason: "checkpoint_locked" };
  if (level < towerDefinition.levelRange[0]) return { ok: false, reason: "level_too_low" };
  return {
    ok: true,
    run: {
      towerId: towerDefinition.id,
      floor,
      partySize,
      recommendedLevel: Math.min(720, towerDefinition.levelRange[0] + (floor - 1) * 7),
      bossFloor: floor % towerDefinition.checkpointInterval === 0,
      miniBossFloor: floor % towerDefinition.miniBossInterval === 0,
      checkpointFloors: [...allowedFloors].sort((a, b) => a - b)
    }
  };
}

export function validateInstanceEntranceCatalog() {
  return {
    valid: INSTANCE_ENTRANCES.length === 34 &&
      INSTANCE_ENTRANCES.every(instance => getWorldMap(instance.mapId)?.kind === instance.kind &&
        instance.entrance.zoneId === instance.zoneId && instance.levelRange.length === 2),
    dungeons: INSTANCE_ENTRANCES.filter(instance => instance.kind === "dungeon").length,
    raids: INSTANCE_ENTRANCES.filter(instance => instance.kind === "raid").length,
    tower: 1
  };
}
