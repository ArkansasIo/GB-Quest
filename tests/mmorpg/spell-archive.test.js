import test from "node:test";
import assert from "node:assert/strict";
import {
  SPELL_ARCHIVE_ITEMS,
  addArchiveItem,
  castFromScroll,
  configureCharacterSpellbook,
  createSpellArchive,
  getSpellArchiveSummary,
  listSpellArchiveItems,
  studyCodex,
  studySpellbook,
} from "../../src/mmorpg/systems/spell-archive.js";
import { getSpell, getSpellSchools, getSpellTypes, listSpells } from "../../src/mmorpg/systems/spell-catalog.js";
import { effectiveArmorClass, tickSpellEffects } from "../../src/mmorpg/rules/spell-runtime.js";
import { createSpellState } from "../../src/mmorpg/rules/spellcasting.js";

function makeCharacter(classId = "wizard", subclassId = "evoker", mode = "known") {
  const character = {
    id: "archive-caster",
    classId,
    subclassId,
    level: 10,
    abilities: { int: 18, wis: 14, dex: 12, con: 12, str: 10, cha: 10 },
    spellcastingAbility: "int",
    proficiencyBonus: 4,
    spellState: createSpellState(10),
    actionAvailable: true,
    bonusActionAvailable: true,
    reactionAvailable: true,
    position: { x: 0, y: 0, z: 0 },
    hp: 40,
    maxHp: 40,
    ac: 12,
    conditions: [],
  };
  configureCharacterSpellbook(character, { classId, subclassId, mode, maxKnown: 100, maxPrepared: 100 });
  return character;
}

test("original spell expansion contains 90 unique, detailed spells across nine schools", () => {
  const expansion = listSpells({ source: "GBQ-original" });
  assert.equal(expansion.length, 90);
  assert.equal(new Set(expansion.map(spell => spell.id)).size, 90);
  assert.equal(new Set(expansion.map(spell => spell.name)).size, 90);
  assert.equal(getSpellSchools().length, 9);
  assert.equal(getSpellTypes().length, 9);
  for (const spell of expansion) {
    assert.ok(spell.detail.length > 40);
    assert.ok(spell.stats.power > 0);
    assert.ok(spell.subStats.rangeFeet > 0);
    assert.ok(spell.classIds.length > 0);
    assert.ok(spell.subclasses.some(option => spell.classIds.includes(option.classId)));
    assert.equal(getSpell(spell.name).id, spell.id);
  }
});

test("spell catalog filters the expansion by class, school, type and subtype", () => {
  const fire = listSpells({ school: "starfire", type: "damage", limit: 1 })[0];
  assert.ok(fire);
  assert.equal(getSpell(fire.id).name, fire.name);
  assert.ok(listSpells({ classId: "wizard", subclassId: "evoker" }).some(spell => spell.id === fire.id));
  assert.ok(listSpells({ school: "starfire", type: "damage", subtype: fire.subtype }).some(spell => spell.id === fire.id));
  assert.equal(listSpells({ classId: "barbarian" }).some(spell => spell.source === "GBQ-original"), false);
  assert.equal(listSpells({ classId: "wizard", subclassId: "life" }).length, 0);
});

test("archive contains exactly 300 unique scrolls, spellbooks, codices and materials", () => {
  const summary = getSpellArchiveSummary();
  assert.deepEqual(summary, { totalItems: 300, spellScrolls: 90, spellbooks: 90, codices: 90, materials: 30 });
  assert.equal(new Set(SPELL_ARCHIVE_ITEMS.map(item => item.id)).size, 300);
  assert.equal(new Set(SPELL_ARCHIVE_ITEMS.map(item => item.name)).size, 300);
  assert.equal(listSpellArchiveItems({ itemType: "spell-scroll", school: "wildsong" }).length, 10);
  assert.equal(listSpellArchiveItems({ itemType: "spellbook", query: "Lantern Ward" }).length, 1);
});

test("spellbooks teach class-accessible spells and codices prepare them", () => {
  const archive = createSpellArchive();
  const mage = makeCharacter();
  const spell = listSpells({ classId: "wizard", subclassId: "evoker", type: "damage", limit: 1 })[0];
  assert.equal(addArchiveItem(archive, `spellbook-${spell.id}`).ok, true);
  const learned = studySpellbook(archive, mage, `spellbook-${spell.id}`);
  assert.equal(learned.ok, true);
  assert.ok(mage.spellState.known.includes(spell.id));
  assert.equal(archive.items[0].quantity, 1);
  assert.deepEqual(studySpellbook(archive, mage, `spellbook-${spell.id}`), { ok: false, reason: "already_known" });
  assert.equal(addArchiveItem(archive, `codex-${spell.id}`).ok, true);
  assert.equal(studyCodex(archive, mage, `codex-${spell.id}`).ok, true);
  assert.ok(mage.spellState.prepared.includes(spell.id));
});

test("class restrictions and invalid archive items fail without changing spell access", () => {
  const archive = createSpellArchive();
  const mage = makeCharacter("barbarian", "berserker");
  const spell = getSpell("aegis-01");
  assert.equal(addArchiveItem(archive, `spellbook-${spell.id}`).ok, true);
  assert.deepEqual(studySpellbook(archive, mage, `spellbook-${spell.id}`), {
    ok: false, reason: "spell_not_available_to_class"
  });
  assert.deepEqual(addArchiveItem(archive, "missing-scroll"), { ok: false, reason: "unknown_archive_item" });
  assert.throws(() => configureCharacterSpellbook(mage, { classId: "wizard", subclassId: "berserker" }), /does not belong/);
});

test("spell scroll casts without class knowledge or spell slots and consumes only on success", () => {
  const archive = createSpellArchive();
  const caster = makeCharacter("barbarian", "berserker");
  caster.spellState.slots[0].remaining = 0;
  const spell = listSpells({ type: "damage", limit: 1 })[0];
  const target = { id: "target", hp: 1000, maxHp: 1000, ac: 10, position: { x: 1, y: 0, z: 0 }, conditions: [] };
  const scrollId = `scroll-${spell.id}`;
  addArchiveItem(archive, scrollId, 2);
  archive.items[0].spellId = listSpells({ type: "healing" })[0].id;

  assert.deepEqual(castFromScroll(archive, caster, scrollId, [{ id: "invalid", hp: 0 }]), {
    ok: false, reason: "invalid_target"
  });
  assert.equal(archive.items[0].quantity, 2);
  const cast = castFromScroll(archive, caster, scrollId, [target], { random: () => 0.99 });
  assert.equal(cast.ok, true);
  assert.equal(cast.spellId, spell.id);
  assert.equal(cast.source, "scroll");
  assert.equal(cast.consumeSlot, false);
  assert.equal(archive.items[0].quantity, 1);
  assert.equal(caster.spellState.slots[0].remaining, 0);
});

test("scroll spell effects resolve damage, healing, control, wards and summons", () => {
  const archive = createSpellArchive();
  const caster = makeCharacter();
  const target = { id: "target", hp: 20, maxHp: 40, ac: 12, abilities: { dex: 10, wis: 10, con: 10 }, position: { x: 1, y: 0, z: 0 }, conditions: [] };
  const castOne = (type, targets = [target], random = () => 0) => {
    caster.actionAvailable = true;
    caster.bonusActionAvailable = true;
    caster.reactionAvailable = true;
    const spell = listSpells({ type, limit: 1 })[0];
    addArchiveItem(archive, `scroll-${spell.id}`);
    return castFromScroll(archive, caster, `scroll-${spell.id}`, targets, { random });
  };

  assert.equal(castOne("damage", [target], () => 0.99).ok, true);
  assert.equal(castOne("healing").ok, true);
  assert.equal(castOne("control").ok, true);
  assert.equal(target.conditions.length, 1);
  assert.equal(castOne("ward", [target]).ok, true);
  assert.ok(effectiveArmorClass(target) > target.ac);
  assert.ok(target.temporaryHitPoints > 0);
  assert.equal(castOne("summoning", [caster]).ok, true);
  assert.equal(caster.summons.length, 1);
  tickSpellEffects(target, 100);
  assert.equal(effectiveArmorClass(target), target.ac);
});

test("all expansion spell types produce working runtime effects", () => {
  const archive = createSpellArchive();
  const caster = makeCharacter();
  const target = { id: "target", hp: 40, maxHp: 40, ac: 10, position: { x: 1, y: 0, z: 0 }, conditions: [] };
  for (const type of ["damage", "healing", "control", "ward", "summoning", "movement", "divination", "transformation", "utility"]) {
    caster.actionAvailable = true;
    caster.bonusActionAvailable = true;
    caster.reactionAvailable = true;
    const spell = listSpells({ type, limit: 1 })[0];
    addArchiveItem(archive, `scroll-${spell.id}`);
    const result = castFromScroll(archive, caster, `scroll-${spell.id}`, type === "summoning" ? [caster] : [target], {
      random: () => 0.1
    });
    assert.equal(result.ok, true, `${type} scroll should cast`);
    assert.equal(result.results[0].effectApplied, type);
  }
  assert.ok(target.spellSenses.length);
  assert.ok(target.transformations.length);
});

test("archive capacity and stack rules prevent overfilling non-stackable books", () => {
  const archive = createSpellArchive({ capacity: 2 });
  const scrollId = "scroll-aegis-01";
  assert.equal(addArchiveItem(archive, scrollId, 2).ok, true);
  assert.equal(addArchiveItem(archive, scrollId).item.quantity, 3);
  assert.equal(addArchiveItem(archive, "spellbook-aegis-01").ok, true);
  assert.deepEqual(addArchiveItem(archive, "spellbook-aegis-01"), { ok: false, reason: "not_stackable" });
  assert.deepEqual(addArchiveItem(archive, "codex-aegis-01"), { ok: false, reason: "archive_full" });
});
