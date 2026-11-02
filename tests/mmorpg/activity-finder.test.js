import test from "node:test";
import assert from "node:assert/strict";
import { getInstanceEntrance, listInstanceEntrances, listTowerEntries, startTowerRun, validateInstanceEntranceCatalog } from "../../src/mmorpg/systems/instance-finder.js";
import { getEventFinderSummary, joinScheduledEvent, listScheduledEvents } from "../../src/mmorpg/systems/event-finder.js";
import { progressWorldEvent } from "../../src/mmorpg/systems/world-events.js";

test("instance finder indexes dungeon and raid entrances with world map requirements", () => {
  assert.deepEqual(validateInstanceEntranceCatalog(), { valid: true, dungeons: 20, raids: 14, tower: 1 });
  assert.equal(listInstanceEntrances({ kind: "dungeon" }).length, 20);
  assert.equal(listInstanceEntrances({ kind: "raid" }).length, 14);

  const catacombs = listInstanceEntrances({ kind: "dungeon", query: "Jadewind", level: 10 })[0];
  assert.equal(catacombs.name, "Forgotten Catacombs of Jadewind Basin");
  assert.equal(catacombs.available, true);
  assert.equal(catacombs.entrance.type, "dungeon-entrance");
  assert.equal(getInstanceEntrance(catacombs.entrance.id).mapId, catacombs.mapId);

  const raid = listInstanceEntrances({ kind: "raid", limit: 1 })[0];
  assert.equal(raid.entrance.type, "raid-portal");
  assert.equal(raid.lockout, "weekly");
  assert.equal(listInstanceEntrances({ kind: "dungeon", level: 720 }).length, 0);
  assert.equal(listInstanceEntrances({ kind: "dungeon", level: 720, includeUnavailable: true })[0].available, false);
  assert.equal(listInstanceEntrances({ difficulty: "impossible" }).length, 0);
  assert.throws(() => listInstanceEntrances({ level: 721 }), /Character level/);
});

test("tower finder exposes unlocked checkpoints and validates run entry", () => {
  const [tower] = listTowerEntries({ level: 35, bestFloor: 25 });
  assert.equal(tower.floors, 100);
  assert.deepEqual(tower.unlockedCheckpoints, [1, 10, 20]);
  assert.equal(tower.available, true);
  assert.deepEqual(startTowerRun({ level: 35, floor: 20, bestFloor: 25, partySize: 4 }).run, {
    towerId: "spire-of-a-hundred",
    floor: 20,
    partySize: 4,
    recommendedLevel: 136,
    bossFloor: true,
    miniBossFloor: true,
    checkpointFloors: [1, 10, 20]
  });
  assert.equal(startTowerRun({ level: 35, floor: 30, bestFloor: 25 }).reason, "checkpoint_locked");
  assert.equal(startTowerRun({ level: 35, floor: 0 }).reason, "invalid_floor");
  assert.equal(startTowerRun({ level: 35, floor: 1, partySize: 5 }).reason, "invalid_party_size");
  assert.equal(listTowerEntries({ query: "dungeon" }).length, 0);
});

test("event finder schedules public activities and world bosses with zone and level filters", () => {
  const epoch = Date.UTC(2026, 0, 1);
  assert.deepEqual(getEventFinderSummary(), { publicEvents: 6, worldBossEvents: 300, totalScheduledActivityTypes: 2 });
  const active = listScheduledEvents({ now: epoch + 30 * 60 * 1000, kind: "public_event", status: "active" });
  const lantern = active.find(event => event.id === "greenreach-lantern-watch");
  assert.ok(lantern);
  assert.equal(lantern.zoneId, "westreach-01");
  assert.equal(lantern.status, "active");
  assert.equal(joinScheduledEvent(lantern, "hero", epoch + 30 * 60 * 1000).ok, true);
  assert.equal(joinScheduledEvent(lantern, "hero", epoch + 30 * 60 * 1000).ok, true);
  assert.equal(lantern.participants.length, 1);
  assert.equal(progressWorldEvent(lantern, "light-beacons", 3), true);
  assert.equal(lantern.progress["light-beacons"], 3);

  const upcoming = listScheduledEvents({ now: epoch, kind: "public_event", status: "upcoming", level: 10 });
  assert.ok(upcoming.some(event => event.id === "greenreach-lantern-watch"));
  assert.equal(listScheduledEvents({ now: epoch, zoneId: "unknown-zone" }).length, 0);
  const bossEvents = listScheduledEvents({ now: epoch, kind: "world_boss", continentId: "westreach", limit: 10 });
  assert.equal(bossEvents.length, 10);
  assert.ok(bossEvents.every(event => event.bossId && event.respawnHours > 0));
  assert.throws(() => listScheduledEvents({ level: 721 }), /Character level/);
});
