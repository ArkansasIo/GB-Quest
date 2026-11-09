// Class skill books and ability books: one of each per class (12 classes).
// Skill lists follow the SRD 5.2.1 class skill proficiency options.
const ALL_SKILLS = [
  "acrobatics", "animalHandling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleightOfHand", "stealth", "survival"
];

const CLASS_BOOK_DEFINITIONS = [
  { classId: "barbarian", className: "Barbarian", skills: ["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"], skillTitle: "Primer of the Unbroken Trail", abilityTitle: "Codex of Red Fury" },
  { classId: "bard", className: "Bard", skills: ALL_SKILLS, skillTitle: "Folio of a Thousand Verses", abilityTitle: "Songbook of Rallying Refrains" },
  { classId: "cleric", className: "Cleric", skills: ["history", "insight", "medicine", "persuasion", "religion"], skillTitle: "Breviary of Quiet Devotion", abilityTitle: "Liturgy of the Dawnward Flame" },
  { classId: "druid", className: "Druid", skills: ["arcana", "animalHandling", "insight", "medicine", "nature", "perception", "religion", "survival"], skillTitle: "Herbal of the Old Groves", abilityTitle: "Grimoire of Thorn and Tide" },
  { classId: "fighter", className: "Fighter", skills: ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "persuasion", "perception", "survival"], skillTitle: "Drillmaster's Field Manual", abilityTitle: "Treatise of Steel and Stance" },
  { classId: "monk", className: "Monk", skills: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], skillTitle: "Scroll of Still Waters", abilityTitle: "Manual of the Open Palm" },
  { classId: "paladin", className: "Paladin", skills: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], skillTitle: "Oathkeeper's Handbook", abilityTitle: "Book of Sworn Radiance" },
  { classId: "ranger", className: "Ranger", skills: ["animalHandling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], skillTitle: "Wayfinder's Logbook", abilityTitle: "Quiver-Lore Compendium" },
  { classId: "rogue", className: "Rogue", skills: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleightOfHand", "stealth"], skillTitle: "Ledger of Light Fingers", abilityTitle: "Whispered Book of Clean Cuts" },
  { classId: "sorcerer", className: "Sorcerer", skills: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], skillTitle: "Diary of Wild Blood", abilityTitle: "Tome of Kindled Bloodlines" },
  { classId: "warlock", className: "Warlock", skills: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], skillTitle: "Pactbinder's Marginalia", abilityTitle: "Ledger of Bound Powers" },
  { classId: "wizard", className: "Wizard", skills: ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"], skillTitle: "Scholar's Commonplace Book", abilityTitle: "Prismatic Treatise of Applied Force" }
];

export const CLASS_BOOK_RECORDS = Object.freeze(CLASS_BOOK_DEFINITIONS.flatMap(def => [
  Object.freeze({
    id: `skillbook-${def.classId}`,
    name: def.skillTitle,
    itemType: "class-skill-book",
    classId: def.classId,
    skillOptions: Object.freeze([...def.skills]),
    stackable: false,
    detail: `${def.className} skill book. Study to gain proficiency in one ${def.className} skill. Not consumed.`
  }),
  Object.freeze({
    id: `abilitybook-${def.classId}`,
    name: def.abilityTitle,
    itemType: "class-ability-book",
    classId: def.classId,
    stackable: false,
    detail: `${def.className} ability book. Study to record every ${def.className} ability your level and subclass allow. Not consumed.`
  })
]));
