const SCHOOL_SPELL_NAMES = Object.freeze([
  {
    id: "aegis",
    name: "Aegis Weaving",
    theme: "Protective wards, counterforces and restoration",
    focus: ["defense", "restoration"],
    classes: ["cleric", "paladin", "wizard"],
    subclasses: [["cleric", "life"], ["paladin", "devotion"], ["wizard", "evoker"]],
    spells: [
      "Lantern Ward", "Oathglass Shelter", "Mending Halo", "Bastion of Seven Threads", "Guardian Sigil",
      "Wellspring Mantle", "Sanctuary of the Dawn Bell", "Reversal Aegis", "Citadel of Quiet Stars", "Unbroken Horizon",
    ],
  },
  {
    id: "gateweaving",
    name: "Gateweaving",
    theme: "Summoning, safe passage and folded distance",
    focus: ["summoning", "movement"],
    classes: ["druid", "sorcerer", "wizard"],
    subclasses: [["druid", "land"], ["sorcerer", "draconic"], ["wizard", "evoker"]],
    spells: [
      "Mothlight Courier", "Thornway Step", "Hearthdoor", "Wayfarer's Loop", "Call of the Amber Stag",
      "Crossing of Blue Embers", "Sanctum Passage", "Confluence Gate", "Parallax Caravan", "Road Beyond the Moon",
    ],
  },
  {
    id: "farseeing",
    name: "Farseeing",
    theme: "Revelation, foresight and reading hidden traces",
    focus: ["divination", "precision"],
    classes: ["bard", "cleric", "druid", "ranger", "wizard"],
    subclasses: [["bard", "lore"], ["cleric", "life"], ["druid", "land"], ["ranger", "hunter"], ["wizard", "evoker"]],
    spells: [
      "Ashen Footprints", "Hawk's Borrowed View", "Unlost Compass", "Threadcount Omen", "Whisperglass Lens",
      "Five Roads Foretold", "Map of the Unseen Rain", "Oracle's Blue Hour", "Archive of Falling Stars", "The Certain Dawn",
    ],
  },
  {
    id: "heartbinding",
    name: "Heartbinding",
    theme: "Emotion, resolve and gentle influence",
    focus: ["control", "support"],
    classes: ["bard", "cleric", "sorcerer", "warlock", "wizard"],
    subclasses: [["bard", "lore"], ["cleric", "life"], ["sorcerer", "draconic"], ["warlock", "fiend"], ["wizard", "evoker"]],
    spells: [
      "Kindling Promise", "Chorus of Calm", "Hushed Refrain", "Courage in the Hollow", "Silvered Accord",
      "The Unbroken Chorus", "Heart of the Open Gate", "Sovereign Refrain", "Covenant of Quiet Names", "Will Made Morning",
    ],
  },
  {
    id: "starfire",
    name: "Starfire",
    theme: "Elemental force, radiant light and thunder",
    focus: ["damage", "area control"],
    classes: ["cleric", "druid", "sorcerer", "warlock", "wizard"],
    subclasses: [["cleric", "life"], ["druid", "land"], ["sorcerer", "draconic"], ["warlock", "fiend"], ["wizard", "evoker"]],
    spells: [
      "Cinderpin", "Rime Bell", "Stormseed", "Dawnflare Arc", "Sunstorm Spiral",
      "Cometfall Lance", "Crown of Blue Lightning", "Sevenfold Starburst", "Daybreak Cataclysm", "Worldspark",
    ],
  },
  {
    id: "veilsong",
    name: "Veilsong",
    theme: "Illusions, concealment and false appearances",
    focus: ["deception", "control"],
    classes: ["bard", "ranger", "rogue", "sorcerer", "wizard"],
    subclasses: [["bard", "lore"], ["ranger", "hunter"], ["rogue", "thief"], ["sorcerer", "draconic"], ["wizard", "evoker"]],
    spells: [
      "Softstep Echo", "Mimic's Lantern", "Borrowed Footfall", "Cloak of Reed Shadows", "Hall of False Doors",
      "Theatre of Small Moons", "Silhouette Parade", "Mirage of the Empty Keep", "Veiled City Procession", "Unwritten Face",
    ],
  },
  {
    id: "gravecalling",
    name: "Gravecalling",
    theme: "Life, memory, endings and the quiet dead",
    focus: ["life", "necrotic force"],
    classes: ["cleric", "sorcerer", "warlock", "wizard"],
    subclasses: [["cleric", "life"], ["sorcerer", "draconic"], ["warlock", "fiend"], ["wizard", "evoker"]],
    spells: [
      "Last Ember Vigil", "Gentle Departure", "Marrow Bell", "Keeper at the Threshold", "Gravesoil Pact",
      "Ancestor's Lantern", "Requiem of the Reed Crown", "Borrowed Winter", "Choir Beneath the Hill", "Merciful Nightfall",
    ],
  },
  {
    id: "flux",
    name: "Fluxcraft",
    theme: "Transformation, motion and mutable matter",
    focus: ["transformation", "mobility"],
    classes: ["bard", "druid", "sorcerer", "wizard"],
    subclasses: [["bard", "lore"], ["druid", "land"], ["sorcerer", "draconic"], ["wizard", "evoker"]],
    spells: [
      "Copperleaf Shift", "Mossstride", "Glasswater Skin", "Quickening Current", "Tideglass Form",
      "Boulderkin Turn", "Shape of the Long Road", "Clockwork Pollen", "Mutable Mountain", "New World Pattern",
    ],
  },
  {
    id: "wildsong",
    name: "Wildsong",
    theme: "Living landscapes, beasts and natural cycles",
    focus: ["nature", "summoning"],
    classes: ["bard", "druid", "ranger"],
    subclasses: [["bard", "lore"], ["druid", "land"], ["ranger", "hunter"]],
    spells: [
      "Acorn Messenger", "Bramble Snare", "Raincall", "Foxfire Path", "Herd of Pale Harts",
      "Rootbound Refuge", "Greenward Procession", "River's Remembering", "Canopy Without End", "First Garden",
    ],
  },
]);

const EFFECTS = Object.freeze([
  { type: "damage", subtypes: ["fire", "cold", "lightning", "force", "radiant", "necrotic", "psychic", "thunder", "acid"] },
  { type: "healing", subtypes: ["hit-points", "stabilize", "regeneration"] },
  { type: "control", subtypes: ["blinded", "charmed", "frightened", "grappled", "poisoned", "prone", "restrained", "stunned"] },
  { type: "ward", subtypes: ["armor", "temporary-hit-points"] },
  { type: "summoning", subtypes: ["beast", "spirit", "elemental", "guardian"] },
  { type: "movement", subtypes: ["stride", "blink", "flight", "passage"] },
  { type: "divination", subtypes: ["sight", "tracking", "foresight", "revelation"] },
  { type: "transformation", subtypes: ["beast-form", "stone-form", "water-form", "shapeshift"] },
  { type: "utility", subtypes: ["light", "repair", "message", "ritual"] },
]);

const CONDITION_ABILITIES = Object.freeze({
  blinded: "dex",
  charmed: "wis",
  frightened: "wis",
  grappled: "str",
  poisoned: "con",
  prone: "dex",
  restrained: "dex",
  stunned: "con",
});

function spellStats(level, effectType) {
  const scale = Math.max(1, Math.ceil((level + 1) / 2));
  const stats = { power: level + 1, precision: Math.max(1, 10 - level), control: 0, durationRounds: 1 };
  if (effectType === "damage") Object.assign(stats, { power: level + 2, damageDice: `${scale}d8`, upcastDice: "1d8" });
  if (effectType === "healing") Object.assign(stats, { power: level + 1, healingDice: `${scale}d6`, upcastDice: "1d6" });
  if (effectType === "control") Object.assign(stats, { control: level + 2, durationRounds: Math.max(1, level + 2) });
  if (effectType === "ward") Object.assign(stats, { defense: 1 + Math.floor(level / 3), temporaryHitPoints: level * 2 + 2, durationRounds: Math.max(1, level + 2) });
  if (effectType === "summoning") Object.assign(stats, { summonLevel: Math.max(1, level + 1), durationRounds: Math.max(1, level + 3) });
  if (effectType === "movement") Object.assign(stats, { movementFeet: 15 + level * 5, durationRounds: Math.max(1, level + 1) });
  if (effectType === "divination") Object.assign(stats, { perception: level + 2, durationRounds: Math.max(1, level + 1) });
  if (effectType === "transformation") Object.assign(stats, { transformationRank: Math.max(1, level), durationRounds: Math.max(1, level + 2) });
  if (effectType === "utility") Object.assign(stats, { utilityRank: level + 1, durationRounds: Math.max(1, level + 1) });
  return stats;
}

function spellDetail(school, name, level, type, subtype) {
  return `${name} is a level ${level} ${school.name.toLowerCase()} ${type} spell. ${school.theme}. Its ${subtype} expression scales with its spell level. These original game mechanics are concise gameplay summaries, not copied rules text.`;
}

export const SPELL_SCHOOLS = Object.freeze(SCHOOL_SPELL_NAMES.map(({ spells, ...school }) => Object.freeze({
  ...school,
  focus: Object.freeze([...school.focus]),
  classes: Object.freeze([...school.classes]),
  subclasses: Object.freeze(school.subclasses.map(([classId, subclassId]) => Object.freeze({ classId, subclassId }))),
  spells: Object.freeze([...spells]),
})));

export const SPELL_TYPES = Object.freeze(EFFECTS.map(effect => Object.freeze({
  id: effect.type,
  name: effect.type.replaceAll("-", " ").replace(/\b\w/g, char => char.toUpperCase()),
  subtypes: Object.freeze([...effect.subtypes]),
})));

export const EXPANSION_SPELLS = Object.freeze(SCHOOL_SPELL_NAMES.flatMap((school, schoolIndex) =>
  school.spells.map((name, index) => {
    const level = (index + schoolIndex) % 10;
    const effect = EFFECTS[(index + schoolIndex) % EFFECTS.length];
    const subtype = effect.subtypes[(index + schoolIndex) % effect.subtypes.length];
    const stats = spellStats(level, effect.type);
    const classIds = [...school.classes];
    const subclassAccess = school.subclasses.map(([classId, subclassId]) => Object.freeze({ classId, subclassId }));
    const spell = {
      id: `${school.id}-${String(index + 1).padStart(2, "0")}`,
      name,
      source: "GBQ-original",
      level,
      school: school.id,
      schoolName: school.name,
      classIds: Object.freeze(classIds),
      subclasses: Object.freeze(subclassAccess),
      type: effect.type,
      subtype,
      effect: Object.freeze({ type: effect.type, subtype, durationRounds: stats.durationRounds }),
      detail: spellDetail(school, name, level, effect.type, subtype),
      stats: Object.freeze(stats),
      subStats: Object.freeze({
        castingTime: level === 0 ? "action" : index % 4 === 0 ? "bonus action" : "action",
        rangeFeet: effect.type === "movement" ? stats.movementFeet : Math.min(120, 30 + level * 10),
        durationRounds: stats.durationRounds,
        components: Object.freeze(level > 2 ? ["V", "S", "M"] : ["V", "S"]),
        saveAbility: effect.type === "control" ? CONDITION_ABILITIES[subtype] : null,
        concentration: ["control", "summoning", "transformation"].includes(effect.type),
      }),
    };
    if (effect.type === "damage") Object.assign(spell, {
      attack: true,
      damage: stats.damageDice,
      damagePerSlotLevel: stats.upcastDice,
      damageType: subtype,
    });
    if (effect.type === "healing") Object.assign(spell, {
      healing: stats.healingDice,
      addSpellcastingModifier: true,
      healingPerSlotLevel: stats.upcastDice,
    });
    if (effect.type === "control") Object.assign(spell, {
      saveAbility: CONDITION_ABILITIES[subtype],
      condition: subtype,
      conditionDuration: stats.durationRounds,
      concentration: true,
    });
    if (effect.type === "ward") Object.assign(spell, {
      armorClassBonus: stats.defense,
      temporaryHitPoints: stats.temporaryHitPoints,
      concentration: true,
    });
    return Object.freeze(spell);
  }),
));

export const ARCHIVE_MATERIALS = Object.freeze([
  "Moon-silver Inkwell", "Cinderleaf Paper", "Whisperglass Lens", "Storm-thread Binding", "Amber Quill",
  "Frostmoth Parchment", "Dawnwax Seal", "Bramble Ink", "Echoing Bookmark", "Riverstone Stylus",
  "Star-ash Pigment", "Lanternfish Vellum", "Quiet Bell Clasp", "Cloud-iron Pen", "Foxfire Dust",
  "Hearthsalt Ink", "Blue-Reed Folio", "Comet-tail Thread", "Mossbound Cover", "Sunseed Seal",
  "Hollow Oak Writing Board", "Glasswing Bookmark", "Tidepool Ink", "Rookfeather Quill", "Silver Rain Parchment",
  "Wayfinder's Brass Clip", "Night Orchard Pigment", "Woven Aegis Cover", "Farseeing Prism", "Wildsong Press",
]);

function makeArchiveItems() {
  const scrolls = EXPANSION_SPELLS.map(spell => Object.freeze({
    id: `scroll-${spell.id}`,
    name: `Scroll: ${spell.name}`,
    itemType: "spell-scroll",
    spellId: spell.id,
    consumable: true,
    stackable: true,
    weight: 0.01,
    stats: Object.freeze({ uses: 1, slotCost: 0, spellLevel: spell.level }),
    subStats: Object.freeze({ rangeFeet: spell.subStats.rangeFeet, castingTime: spell.subStats.castingTime, damage: spell.damage ?? null, healing: spell.healing ?? null }),
    detail: `A single-use vellum carrying ${spell.name}. Cast it without spending a spell slot.`,
  }));
  const spellbooks = EXPANSION_SPELLS.map(spell => Object.freeze({
    id: `spellbook-${spell.id}`,
    name: `Spellbook: ${spell.name}`,
    itemType: "spellbook",
    teachesSpell: spell.id,
    consumable: false,
    stackable: false,
    weight: 1,
    stats: Object.freeze({ studyMinutes: 15 + spell.level * 5, spellLevel: spell.level }),
    subStats: Object.freeze({ school: spell.school, classIds: spell.classIds }),
    detail: `Study this original ${spell.schoolName} primer to learn ${spell.name}, if your class can access it.`,
  }));
  const codices = EXPANSION_SPELLS.map(spell => Object.freeze({
    id: `codex-${spell.id}`,
    name: `Codex of ${spell.name}`,
    itemType: "spell-codex",
    preparesSpell: spell.id,
    consumable: false,
    stackable: false,
    weight: 2,
    stats: Object.freeze({ studyMinutes: 10 + spell.level * 5, preparedSpells: 1, spellLevel: spell.level }),
    subStats: Object.freeze({ school: spell.school, subclassIds: spell.subclasses.map(option => option.subclassId) }),
    detail: `A field codex for preparing ${spell.name}. Study requires prior knowledge and class access.`,
  }));
  const materials = ARCHIVE_MATERIALS.map((name, index) => Object.freeze({
    id: `archive-material-${String(index + 1).padStart(2, "0")}`,
    name,
    itemType: "arcane-material",
    consumable: true,
    stackable: true,
    weight: 0.1,
    stats: Object.freeze({ craftingRank: index % 10 + 1, archiveValue: 5 + index * 2 }),
    subStats: Object.freeze({ materialType: ["ink", "paper", "binding", "seal", "tool"][index % 5], stackLimit: 99 }),
    detail: `An original spellcraft supply for copying, binding or restoring an arcane archive.`,
  }));
  return Object.freeze([...scrolls, ...spellbooks, ...codices, ...materials]);
}

export const SPELL_ARCHIVE_ITEMS = makeArchiveItems();
