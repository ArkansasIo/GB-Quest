// Spell-school arms: three magic weapon types (orb, grimoire, gauntlet) in each of the
// 8 SRD spell schools, plus a school character class and a school weapon class,
// each with a subclass. Weapon shape follows data/equipment.json.
import schoolCatalog from "./magic-schools.json" with { type: "json" };

const SCHOOL_DEFS = {
  abjuration: { damageType: "force", ability: "int", baseClassId: "wizard", subclassId: "bulwark", characterClass: "Abjurer", subclass: "Ward-Bound", orb: "Aegis Orb", grimoire: "Grimoire of Wards", gauntlet: "Bulwark Gauntlet", weaponClass: "Warding Arms", weaponSubclass: "Shieldbreakers' Rite" },
  conjuration: { damageType: "force", ability: "int", baseClassId: "warlock", subclassId: "summoner", characterClass: "Conjurer", subclass: "Gate-Caller", orb: "Gatewell Orb", grimoire: "Grimoire of Summonings", gauntlet: "Tether Gauntlet", weaponClass: "Summoning Arms", weaponSubclass: "Leashmaster's Rite" },
  divination: { damageType: "psychic", ability: "wis", baseClassId: "cleric", subclassId: "seer", characterClass: "Diviner", subclass: "Fate-Reader", orb: "Scrying Orb", grimoire: "Grimoire of Omens", gauntlet: "Augur's Gauntlet", weaponClass: "Foresight Arms", weaponSubclass: "Prophet's Rite" },
  enchantment: { damageType: "psychic", ability: "cha", baseClassId: "bard", subclassId: "charmer", characterClass: "Enchanter", subclass: "Mind-Weaver", orb: "Charm Orb", grimoire: "Grimoire of Whispers", gauntlet: "Velvet Gauntlet", weaponClass: "Influence Arms", weaponSubclass: "Puppeteer's Rite" },
  evocation: { damageType: "fire", ability: "int", baseClassId: "sorcerer", subclassId: "stormcaller", characterClass: "Evoker", subclass: "Storm-Singer", orb: "Cinderheart Orb", grimoire: "Grimoire of Tempests", gauntlet: "Stormfist Gauntlet", weaponClass: "Blast Arms", weaponSubclass: "Sapper's Rite" },
  illusion: { damageType: "psychic", ability: "int", baseClassId: "rogue", subclassId: "trickster", characterClass: "Illusionist", subclass: "Mirage-Dancer", orb: "Mirage Orb", grimoire: "Grimoire of Glamours", gauntlet: "Veilfinger Gauntlet", weaponClass: "Deception Arms", weaponSubclass: "Phantom's Rite" },
  necromancy: { damageType: "necrotic", ability: "int", baseClassId: "warlock", subclassId: "gravewarden", characterClass: "Necromancer", subclass: "Grave-Warden", orb: "Hollow Orb", grimoire: "Grimoire of Last Breaths", gauntlet: "Ossuary Gauntlet", weaponClass: "Grave Arms", weaponSubclass: "Reaper's Rite" },
  transmutation: { damageType: "bludgeoning", ability: "wis", baseClassId: "druid", subclassId: "shapewright", characterClass: "Transmuter", subclass: "Shape-Wright", orb: "Quicksilver Orb", grimoire: "Grimoire of Changes", gauntlet: "Alchemist's Gauntlet", weaponClass: "Change Arms", weaponSubclass: "Reshaper's Rite" }
};

const WEAPON_TYPES = {
  orb: { itemType: "weapon", category: "martial", type: "melee", damage: "1d8", properties: ["arcane-focus", "light"], mastery: "vex", priceCopper: 5000, weightLb: 2 },
  grimoire: { itemType: "weapon", category: "martial", type: "melee", damage: "1d6", properties: ["arcane-focus", "finesse"], mastery: "sap", priceCopper: 7500, weightLb: 3 },
  gauntlet: { itemType: "weapon", category: "martial", type: "melee", damage: "1d10", properties: ["arcane-focus", "versatile"], mastery: "push", priceCopper: 6000, weightLb: 6 }
};

const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const SCHOOL_ARMS = Object.freeze(schoolCatalog.schools.map(school => {
  const def = SCHOOL_DEFS[school.id];
  if (!def) throw new RangeError(`Missing school arms definition: ${school.id}`);
  return Object.freeze({
    schoolId: school.id,
    schoolName: school.name,
    characterClass: Object.freeze({
      id: `${school.id}-adept`, name: def.characterClass, schoolId: school.id,
      baseClassId: def.baseClassId, spellAbility: def.ability,
      subclass: Object.freeze({ id: def.subclassId, name: def.subclass, classId: `${school.id}-adept`, level: 3 })
    }),
    weaponClass: Object.freeze({
      id: `${school.id}-arms`, name: def.weaponClass, schoolId: school.id,
      weaponTypes: Object.freeze(["orb", "grimoire", "gauntlet"]),
      subclass: Object.freeze({ id: `${school.id}-rite`, name: def.weaponSubclass, weaponClassId: `${school.id}-arms` })
    }),
    weapons: Object.freeze(["orb", "grimoire", "gauntlet"].map(kind => Object.freeze({
      ...WEAPON_TYPES[kind],
      properties: Object.freeze([...WEAPON_TYPES[kind].properties]),
      name: def[kind], weaponKind: kind, schoolId: school.id, weaponClassId: `${school.id}-arms`,
      damageType: def.damageType, spellcastingAbility: def.ability,
      stackable: false, id: `weapon:${slug(def[kind])}`
    })))
  });
}));

export const SCHOOL_WEAPONS = Object.freeze(SCHOOL_ARMS.flatMap(entry => entry.weapons));
