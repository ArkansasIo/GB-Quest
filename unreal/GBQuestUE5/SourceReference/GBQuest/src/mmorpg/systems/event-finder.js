import eventCatalog from "../data/world-events.json" with { type: "json" };
import bossCatalog from "../data/bosses-350.json" with { type: "json" };
import world from "../../../world/manifests/world-scale.json" with { type: "json" };
import { createWorldEvent, joinWorldEvent } from "./world-events.js";

const zoneIds = new Set(world.zones.map(zone => zone.id));
const EVENT_EPOCH = Date.UTC(2026, 0, 1);
const MINUTE_MS = 60 * 1000;
const BOSS_EVENT_DURATION_MINUTES = 20;

function validateDefinition(definition) {
  if (!definition || typeof definition.id !== "string" || !definition.id.trim() ||
      typeof definition.name !== "string" || !definition.name.trim() ||
      !zoneIds.has(definition.zoneId) || !Array.isArray(definition.levelRange) ||
      definition.levelRange.length !== 2 || !definition.levelRange.every(Number.isInteger) ||
      definition.levelRange[0] < 1 || definition.levelRange[1] < definition.levelRange[0]) {
    throw new TypeError("Event requires a valid identity, zone and level range");
  }
}

for (const definition of eventCatalog.events) {
  validateDefinition(definition);
  if (!Number.isSafeInteger(definition.periodMinutes) || definition.periodMinutes < 30 ||
      !Number.isSafeInteger(definition.offsetMinutes) || definition.offsetMinutes < 0 ||
      definition.offsetMinutes >= definition.periodMinutes ||
      !Number.isSafeInteger(definition.durationMinutes) || definition.durationMinutes < 1 ||
      definition.durationMinutes >= definition.periodMinutes ||
      !Array.isArray(definition.objectives) || definition.objectives.length === 0) {
    throw new TypeError(`Invalid event schedule: ${definition.id}`);
  }
}

function recurringWindow(periodMinutes, offsetMinutes, durationMinutes, now) {
  const period = periodMinutes * MINUTE_MS;
  const offset = offsetMinutes * MINUTE_MS;
  const duration = durationMinutes * MINUTE_MS;
  const cycle = Math.floor((now - EVENT_EPOCH - offset) / period);
  let startsAt = EVENT_EPOCH + cycle * period + offset;
  if (startsAt + duration <= now) startsAt += period;
  return { startsAt, endsAt: startsAt + duration };
}

function publicEvent(definition, now) {
  const window = recurringWindow(definition.periodMinutes, definition.offsetMinutes, definition.durationMinutes, now);
  const event = createWorldEvent({
    id: definition.id,
    zoneId: definition.zoneId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    objectives: structuredClone(definition.objectives)
  });
  return {
    ...event,
    name: definition.name,
    kind: "public_event",
    description: definition.description,
    levelRange: [...definition.levelRange],
    partySize: [...definition.partySize],
    rewards: structuredClone(definition.rewards),
    status: now >= event.startsAt && now < event.endsAt ? "active" : "upcoming"
  };
}

function worldBossEvent(boss, now) {
  const bossNumber = Number(boss.id.match(/\d+$/)?.[0] ?? 1);
  const periodMinutes = boss.respawnHours * 60;
  const offsetMinutes = (bossNumber * 137) % periodMinutes;
  const window = recurringWindow(periodMinutes, offsetMinutes, BOSS_EVENT_DURATION_MINUTES, now);
  return {
    id: `event-${boss.id}`,
    name: boss.name,
    kind: "world_boss",
    bossId: boss.id,
    zoneId: boss.regionId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    status: now >= window.startsAt && now < window.endsAt ? "active" : "upcoming",
    levelRange: [...boss.levelRange],
    partySize: [1, boss.partySize],
    respawnHours: boss.respawnHours,
    lootTier: boss.lootTier,
    objectives: [{ id: `defeat-${boss.id}`, type: "kill", target: boss.id, required: 1 }]
  };
}

export function listScheduledEvents({
  now = Date.now(), status = null, kind = null, zoneId = null, continentId = null, level = null,
  query = "", limit = 100
} = {}) {
  if (!Number.isFinite(now)) throw new TypeError("Event finder time must be finite");
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Event finder limit must be a positive integer");
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 720)) {
    throw new RangeError("Character level must be from 1 to 720");
  }
  if (zoneId && !zoneIds.has(zoneId)) return [];
  const zonesById = new Map(world.zones.map(zone => [zone.id, zone]));
  const needle = String(query).trim().toLowerCase();
  const events = [
    ...eventCatalog.events.map(definition => publicEvent(definition, now)),
    ...bossCatalog.bosses.filter(boss => boss.rank === "world_boss").map(boss => worldBossEvent(boss, now))
  ];
  return events
    .filter(event => !status || event.status === status)
    .filter(event => !kind || event.kind === kind)
    .filter(event => !zoneId || event.zoneId === zoneId)
    .filter(event => !continentId || zonesById.get(event.zoneId)?.continentId === continentId)
    .filter(event => level === null || (level >= event.levelRange[0] && level <= event.levelRange[1]))
    .filter(event => !needle || `${event.id} ${event.name} ${event.zoneId} ${event.description ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => a.startsAt - b.startsAt || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function joinScheduledEvent(event, playerId, now = Date.now()) {
  if (!event || !["public_event", "world_boss"].includes(event.kind)) {
    return { ok: false, reason: "event_not_found" };
  }
  if (event.kind === "world_boss") {
    if (now < event.startsAt || now >= event.endsAt) return { ok: false, reason: "event_not_active" };
    if (!playerId) return { ok: false, reason: "invalid_player" };
    event.participants ??= [];
    if (!event.participants.includes(playerId)) event.participants.push(playerId);
    return { ok: true };
  }
  return joinWorldEvent(event, playerId, now);
}

export function getEventFinderSummary() {
  return {
    publicEvents: eventCatalog.events.length,
    worldBossEvents: bossCatalog.bosses.filter(boss => boss.rank === "world_boss").length,
    totalScheduledActivityTypes: 2
  };
}
