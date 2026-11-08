import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadRules() {
  const code = fs.readFileSync("src/data_rules.js", "utf8");
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  return vm.runInContext(code + "\n;({ SCHOOLS, SPELLS, CLASSES });", ctx);
}

test("all eight spell schools are defined with names, descriptions and spells", () => {
  const { SCHOOLS, SPELLS } = loadRules();
  const schoolKeys = ["aegis", "calling", "omen", "thrall", "storm", "veil", "grave", "flux"];
  assert.equal(Object.keys(SCHOOLS).length, 8);
  for (const k of schoolKeys) {
    assert.ok(SCHOOLS[k], `Missing school: ${k}`);
    assert.ok(SCHOOLS[k].name && SCHOOLS[k].name.length > 0);
    assert.ok(SCHOOLS[k].desc && SCHOOLS[k].desc.length > 0);
    const inSchool = SPELLS.filter(s => s.school === k);
    assert.ok(inSchool.length >= 5, `Expected at least 5 spells in school ${k}, got ${inSchool.length}`);
    const cantrips = inSchool.filter(s => s.lvl === 0);
    assert.ok(cantrips.length >= 1, `Expected at least 1 cantrip in school ${k}`);
  }
});

test("all spells in the spell catalog have valid attributes and descriptions", () => {
  const { SCHOOLS, SPELLS, CLASSES } = loadRules();
  assert.ok(SPELLS.length >= 70, `Expected at least 70 spells, got ${SPELLS.length}`);
  const validSchools = new Set(Object.keys(SCHOOLS));
  const validClasses = new Set(Object.keys(CLASSES));
  const validEffs = new Set(["dmg", "heal", "cond", "buff", "summon", "revive", "kill", "cleanse", "sleep"]);

  for (const spell of SPELLS) {
    assert.ok(spell.id, "Spell must have an id");
    assert.ok(spell.name, "Spell must have a name");
    assert.ok(validSchools.has(spell.school), `Invalid school ${spell.school} on ${spell.id}`);
    assert.ok(Number.isInteger(spell.lvl) && spell.lvl >= 0 && spell.lvl <= 9, `Invalid level ${spell.lvl} on ${spell.id}`);
    assert.ok(validEffs.has(spell.eff), `Invalid effect ${spell.eff} on ${spell.id}`);
    assert.ok(spell.desc && spell.desc.length > 5, `Missing description on ${spell.id}`);
    assert.ok(Array.isArray(spell.cls) && spell.cls.length > 0, `Missing class list on ${spell.id}`);
    for (const c of spell.cls) {
      assert.ok(validClasses.has(c), `Invalid class ${c} on ${spell.id}`);
    }
  }
});
