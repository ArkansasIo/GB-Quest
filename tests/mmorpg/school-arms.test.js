import test from "node:test";
import assert from "node:assert/strict";
import schools from "../../src/mmorpg/data/magic-schools.json" with { type: "json" };
import classes from "../../src/mmorpg/data/classes.json" with { type: "json" };
import { SCHOOL_ARMS, SCHOOL_WEAPONS } from "../../src/mmorpg/data/school-arms.js";

test("each of the 8 spell schools has a character class, weapon class, and subclass for both", () => {
  assert.equal(SCHOOL_ARMS.length, 8);
  assert.deepEqual(SCHOOL_ARMS.map(e => e.schoolId), schools.schools.map(s => s.id));
  const ids = new Set(classes.classes.map(c => c.id));
  for (const entry of SCHOOL_ARMS) {
    assert.ok(ids.has(entry.characterClass.baseClassId), entry.schoolId);
    assert.ok(entry.characterClass.subclass.name && entry.weaponClass.subclass.name);
    assert.equal(entry.characterClass.subclass.classId, entry.characterClass.id);
    assert.equal(entry.weaponClass.subclass.weaponClassId, entry.weaponClass.id);
  }
  for (const key of ["characterClass", "weaponClass"]) {
    assert.equal(new Set(SCHOOL_ARMS.map(e => e[key].id)).size, 8);
    assert.equal(new Set(SCHOOL_ARMS.map(e => e[key].name)).size, 8);
  }
});

test("every school has one orb, one grimoire and one gauntlet with unique ids", () => {
  assert.equal(SCHOOL_WEAPONS.length, 24);
  assert.equal(new Set(SCHOOL_WEAPONS.map(w => w.id)).size, 24);
  assert.equal(new Set(SCHOOL_WEAPONS.map(w => w.name)).size, 24);
  for (const entry of SCHOOL_ARMS) {
    assert.deepEqual(entry.weapons.map(w => w.weaponKind), ["orb", "grimoire", "gauntlet"]);
    for (const w of entry.weapons) {
      assert.equal(w.weaponClassId, entry.weaponClass.id);
      assert.match(w.damage, /^\d+d\d+$/);
      assert.equal(w.itemType, "weapon");
    }
  }
});
