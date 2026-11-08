import test from "node:test";
import assert from "node:assert/strict";
import {
  BOSS_DEFINITIONS, createBossEncounter, createScaledMonster, damageBoss,
  listBosses, tickBossEncounter
} from "../../src/mmorpg/systems/enemy-encounters.js";
import {
  createThreatTable, addThreat, currentTarget, decayThreat, getThreatRanking, recordThreat
} from "../../src/mmorpg/systems/threat.js";
import { createMonsterCombatant } from "../../src/mmorpg/systems/monsters.js";

test("indexes the authored world and arc boss roster with encounter filters", () => {
  assert.equal(BOSS_DEFINITIONS.length, 350);
  assert.equal(listBosses({ rank: "world_boss", limit: 300 }).length, 300);
  assert.equal(listBosses({ rank: "arc_boss", limit: 50 }).length, 50);
  assert.ok(listBosses({ level: 1, partySize: 5, mechanics: "enrage_phase" })
    .every(boss => boss.levelRange[0] <= 1 && boss.partySize >= 5 && boss.mechanics.includes("enrage_phase")));
  assert.throws(() => listBosses({ partySize: 21 }), /Party size/);
});

test("scales monster ranks, difficulty, group size, archetypes and affixes", () => {
  const baseline = createMonsterCombatant("Goblin");
  const common = createScaledMonster("Goblin");
  assert.equal(common.hp, baseline.hp);
  assert.equal(common.damageMultiplier, 1);
  const scaled = createScaledMonster("Goblin", {
    rank: "elite", difficulty: "hard", partySize: 4,
    archetype: "brute", subclass: "ancient", affixes: ["berserk", "toxic", "berserk"]
  });
  assert.equal(scaled.hp, Math.ceil(baseline.hp * 2.5 * 1.25 * 1.36));
  assert.equal(scaled.armorClass, baseline.armorClass + 3);
  assert.equal(scaled.damageMultiplier, 1.5 * 1.1 * 1.25);
  assert.deepEqual(scaled.affixes, ["berserk", "toxic"]);
  assert.equal(scaled.affixModifiers.onHitCondition, "poisoned");
  assert.equal(scaled.archetype, "brute");
  assert.equal(scaled.subclass, "ancient");
  assert.throws(() => createScaledMonster("Goblin", { rank: "unknown" }), /Unknown enemy rank/);
  assert.throws(() => createScaledMonster("Goblin", { affixes: ["unknown"] }), /Unknown enemy affix/);
  assert.throws(() => createScaledMonster("Goblin", { archetype: "brute", subclass: "unknown" }), /Unknown brute subclass/);
});

test("advances boss phases once and raises timer and player-death triggers", () => {
  const boss = createBossEncounter("world-boss-001", { maxHp: 100, enrageAfterMs: 1000 });
  assert.equal(damageBoss(boss, 25).events[0].phaseId, "phase-2");
  assert.deepEqual(damageBoss(boss, 1).events, []);
  const crossed = damageBoss(boss, 50).events;
  assert.deepEqual(crossed.map(event => event.phaseId), ["phase-3", "final-phase"]);
  assert.deepEqual(tickBossEncounter(boss, { elapsedMs: 1000 }), [{ type: "enrage" }]);
  assert.deepEqual(tickBossEncounter(boss, { elapsedMs: 1000 }), []);
  const defeat = damageBoss(boss, 24);
  assert.equal(defeat.defeated, true);
  assert.deepEqual(defeat.events, [{ type: "defeated" }]);
  assert.throws(() => damageBoss(boss, 1), /active boss/);
});

test("supports validated custom boss triggers and rejects invalid definitions", () => {
  const boss = createBossEncounter("arc-boss-01", {
    maxHp: 200,
    phases: [{ id: "adds", trigger: { type: "player_deaths", value: 2 }, actions: ["spawn_adds"] }]
  });
  assert.deepEqual(tickBossEncounter(boss, { elapsedMs: 500, playerDeaths: 1 }), []);
  assert.deepEqual(tickBossEncounter(boss, { playerDeaths: 1 }), [
    { type: "phase", phaseId: "adds", actions: ["spawn_adds"] }
  ]);
  assert.throws(() => createBossEncounter("missing", { maxHp: 100 }), /Unknown boss/);
  assert.throws(() => createBossEncounter("world-boss-001", { maxHp: 0 }), /maximum HP/);
  assert.throws(() => createBossEncounter("world-boss-001", {
    maxHp: 100, phases: [{ id: "bad", trigger: { type: "hp_percent", value: 1 }, actions: [] }]
  }), /HP threshold/);
});

test("aggregates threat from damage, healing, buffs and taunts and supports decay", () => {
  const table = createThreatTable();
  recordThreat(table, "tank", { damage: 10, taunt: 20 });
  recordThreat(table, "healer", { healing: 10, healingTargets: 2 });
  recordThreat(table, "dps", { damage: 15, threatMultiplier: 1.5 });
  assert.equal(currentTarget(table), "tank");
  assert.deepEqual(getThreatRanking(table), [
    { entityId: "dps", threat: 22.5 },
    { entityId: "tank", threat: 30 },
    { entityId: "healer", threat: 10 }
  ].sort((a, b) => b.threat - a.threat));
  decayThreat(table, 0.5);
  assert.equal(table.get("tank"), 15);
  assert.throws(() => recordThreat(table, "bad", { damage: -1 }), /non-negative/);
  assert.throws(() => decayThreat(table, 1.1), /decay/);
  addThreat(table, "tank", 1);
  assert.equal(currentTarget(table), "tank");
});
