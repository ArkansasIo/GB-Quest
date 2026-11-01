import test from "node:test";
import assert from "node:assert/strict";
import {
  configureSpellAccess, learnSpell, prepareSpell, unprepareSpell, canCastSpell
} from "../../src/mmorpg/rules/spell-access.js";
import { castSpell } from "../../src/mmorpg/rules/spell-runtime.js";
import { createSpellState } from "../../src/mmorpg/rules/spellcasting.js";

function character() {
  return { id: "caster", spellState: createSpellState(3), actionAvailable: true,
    abilities: { int: 16 }, spellcastingAbility: "int", proficiencyBonus: 2,
    position: { x: 0, y: 0, z: 0 } };
}
const bolt = { id: "bolt", level: 1, damage: "1d6", rangeFeet: 30 };
const target = () => ({ id: "target", hp: 10, maxHp: 10, position: { x: 2, y: 0, z: 0 } });

test("known-spell policy restricts learning to the supplied class list", () => {
  const mage = character();
  configureSpellAccess(mage, { mode: "known", allowedSpellIds: ["bolt", "ward"], maxKnown: 1 });
  assert.deepEqual(learnSpell(mage, "not-on-list"), { ok: false, reason: "spell_not_available_to_class" });
  assert.equal(learnSpell(mage, "bolt").ok, true);
  assert.deepEqual(learnSpell(mage, "ward"), { ok: false, reason: "known_spell_limit" });
  assert.equal(canCastSpell(mage, "bolt").ok, true);
  assert.deepEqual(canCastSpell(mage, "ward"), { ok: false, reason: "spell_not_known" });
});

test("prepared-spell policy enforces the prepared limit and supports unpreparing", () => {
  const mage = character();
  configureSpellAccess(mage, { mode: "prepared", allowedSpellIds: ["bolt", "ward"], maxPrepared: 1 });
  assert.equal(prepareSpell(mage, "bolt").ok, true);
  assert.deepEqual(prepareSpell(mage, "ward"), { ok: false, reason: "prepared_spell_limit" });
  assert.equal(canCastSpell(mage, "bolt").ok, true);
  assert.deepEqual(canCastSpell(mage, "ward"), { ok: false, reason: "spell_not_prepared" });
  assert.equal(unprepareSpell(mage, "bolt").ok, true);
  assert.deepEqual(canCastSpell(mage, "bolt"), { ok: false, reason: "spell_not_prepared" });
});

test("spell runtime refuses a spell excluded by configured class access", () => {
  const mage = character();
  configureSpellAccess(mage, { mode: "prepared", allowedSpellIds: ["ward"], maxPrepared: 1 });
  const foe = target();
  const result = castSpell({ caster: mage, targets: [foe], spell: bolt, random: () => 0.5 });
  assert.deepEqual(result, { ok: false, reason: "spell_not_available_to_class" });
  assert.equal(mage.spellState.slots[0].remaining, 2);
  assert.equal(mage.actionAvailable, true);
  assert.equal(foe.hp, 10);
});

test("spell runtime requires preparation when policy says prepared", () => {
  const mage = character();
  configureSpellAccess(mage, { mode: "prepared", allowedSpellIds: ["bolt"], maxPrepared: 1 });
  const foe = target();
  assert.deepEqual(castSpell({ caster: mage, targets: [foe], spell: bolt }), {
    ok: false, reason: "spell_not_prepared"
  });
  prepareSpell(mage, "bolt");
  assert.equal(castSpell({ caster: mage, targets: [foe], spell: bolt, random: () => 0.5 }).ok, true);
});

test("access configuration validates mode, allow-list and limits", () => {
  const mage = character();
  assert.throws(() => configureSpellAccess(mage, { mode: "all", allowedSpellIds: [] }), /mode/i);
  assert.throws(() => configureSpellAccess(mage, { mode: "known", allowedSpellIds: "bolt" }), /allowedSpellIds/i);
  assert.throws(() => configureSpellAccess(mage, { mode: "known", allowedSpellIds: [], maxKnown: -1 }), /maxKnown/i);
});
