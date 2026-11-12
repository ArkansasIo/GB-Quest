import test from "node:test";
import assert from "node:assert/strict";
import classes from "../../src/mmorpg/data/classes.json" with { type: "json" };
import {
  CLASS_BOOK_RECORDS, getClassBook, listClassBooks, studyAbilityBook, studySkillBook
} from "../../src/mmorpg/systems/class-books.js";

test("every class has exactly one skill book and one ability book with unique ids and names", () => {
  assert.equal(CLASS_BOOK_RECORDS.length, 24);
  assert.equal(new Set(CLASS_BOOK_RECORDS.map(b => b.id)).size, 24);
  assert.equal(new Set(CLASS_BOOK_RECORDS.map(b => b.name)).size, 24);
  for (const { id } of classes.classes) {
    assert.equal(listClassBooks({ classId: id, itemType: "class-skill-book" }).length, 1, id);
    assert.equal(listClassBooks({ classId: id, itemType: "class-ability-book" }).length, 1, id);
  }
});

test("skill book grants one valid class skill once and is not consumed", () => {
  const rogue = { classId: "rogue" };
  assert.equal(studySkillBook(rogue, "skillbook-rogue", "stealth").ok, true);
  assert.deepEqual(rogue.skillProficiencies, ["stealth"]);
  assert.equal(studySkillBook(rogue, "skillbook-rogue", "stealth").reason, "already_proficient");
  assert.equal(studySkillBook(rogue, "skillbook-rogue", "arcana").reason, "skill_not_in_book");
  assert.equal(studySkillBook({ classId: "wizard" }, "skillbook-rogue", "stealth").reason, "wrong_class");
  assert.equal(studySkillBook(rogue, "abilitybook-rogue", "stealth").reason, "wrong_item_type");
  assert.ok(getClassBook("skillbook-rogue"));
});

test("ability book records abilities by level and subclass", () => {
  const wizard = { classId: "wizard", level: 3, subclassId: "evoker" };
  const result = studyAbilityBook(wizard, "abilitybook-wizard");
  assert.ok(result.learned.includes("wizard-arcane-burst"));
  assert.ok(result.learned.includes("wizard-evoker-prismatic-surge"));
  assert.equal(studyAbilityBook(wizard, "abilitybook-wizard").reason, "nothing_to_learn");
  assert.equal(studyAbilityBook({ classId: "wizard", level: 1 }, "abilitybook-fighter").reason, "wrong_class");
});

test("every class ability book teaches at least one ability", () => {
  for (const { id } of classes.classes) {
    const result = studyAbilityBook({ classId: id, level: 1 }, `abilitybook-${id}`);
    assert.equal(result.ok, true, id);
  }
});
