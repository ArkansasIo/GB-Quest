import expansion from "./aelmoor-expansion.json" with { type: "json" };

export const CLASS_ABILITY_RECORDS = Object.freeze([
  {
    id: "barbarian-rending-surge", name: "Rending Surge", classId: "barbarian", level: 1,
    description: "Drive a heavy weapon strike through a foe's guard.",
    effects: [{ type: "damage", dice: "2d6", damageType: "slashing", attackAbility: "str", proficient: true }]
  },
  {
    id: "barbarian-berserker-red-momentum", name: "Red Momentum", classId: "barbarian", subclassId: "berserker", level: 3,
    description: "Convert a committed strike into a punishing follow-through.",
    effects: [{ type: "damage", dice: "3d6", damageType: "slashing", attackAbility: "str", proficient: true }]
  },
  {
    id: "bard-rallying-verse", name: "Rallying Verse", classId: "bard", level: 1, actionCost: "bonusAction",
    description: "Restore an ally with a brief, steadying refrain.",
    effects: [{ type: "healing", dice: "1d8", abilityModifier: "cha" }]
  },
  {
    id: "bard-lore-cutting-refrain", name: "Cutting Refrain", classId: "bard", subclassId: "lore", level: 3,
    description: "A sharp counter-melody disrupts a foe's next move.",
    effects: [{ type: "damage", dice: "2d6", damageType: "psychic", save: { ability: "wis", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "cleric-dawnward-burst", name: "Dawnward Burst", classId: "cleric", level: 1,
    description: "Unleash a brief pulse of focused radiant force.",
    effects: [{ type: "damage", dice: "1d8", damageType: "radiant", save: { ability: "wis", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "cleric-life-wellspring-touch", name: "Wellspring Touch", classId: "cleric", subclassId: "life", level: 3, actionCost: "bonusAction",
    description: "Channel a measured pulse of restorative energy.",
    effects: [{ type: "healing", dice: "2d8", abilityModifier: "wis" }]
  },
  {
    id: "druid-thorn-call", name: "Thorn Call", classId: "druid", level: 1,
    description: "Call a thorned lash to strike at a nearby foe.",
    effects: [{ type: "damage", dice: "1d8", damageType: "piercing", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "druid-land-rooted-current", name: "Rooted Current", classId: "druid", subclassId: "land", level: 3,
    description: "A pulse of living ground strikes a nearby enemy.",
    effects: [{ type: "damage", dice: "2d6", damageType: "bludgeoning", save: { ability: "str", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "fighter-measured-strike", name: "Measured Strike", classId: "fighter", level: 1,
    description: "Deliver a practiced, accurate weapon attack.",
    effects: [{ type: "damage", dice: "1d10", damageType: "slashing", attackAbility: "str", proficient: true }]
  },
  {
    id: "fighter-champion-unbroken-stance", name: "Unbroken Stance", classId: "fighter", subclassId: "champion", level: 3,
    description: "Set your stance and answer with a forceful counterblow.",
    effects: [{ type: "damage", dice: "2d8", damageType: "bludgeoning", attackAbility: "str", proficient: true }]
  },
  {
    id: "monk-flowing-palm", name: "Flowing Palm", classId: "monk", level: 1, actionCost: "bonusAction",
    description: "Strike with a quick, controlled unarmed technique.",
    effects: [{ type: "damage", dice: "1d6", damageType: "bludgeoning", attackAbility: "dex", proficient: true }]
  },
  {
    id: "monk-open-hand-turning-current", name: "Turning Current", classId: "monk", subclassId: "open-hand", level: 3,
    description: "A redirecting palm strike lands with practiced force.",
    effects: [{ type: "damage", dice: "1d8", damageType: "bludgeoning", attackAbility: "dex", proficient: true }]
  },
  {
    id: "paladin-oath-sunder", name: "Oath Sunder", classId: "paladin", level: 1,
    description: "Strike with a weapon and a measured flare of radiant power.",
    effects: [{ type: "damage", dice: "2d8", damageType: "radiant", attackAbility: "str", proficient: true }]
  },
  {
    id: "paladin-devotion-lantern-vow", name: "Lantern Vow", classId: "paladin", subclassId: "devotion", level: 3, actionCost: "bonusAction",
    description: "Restore an ally with a vow spoken in the light.",
    effects: [{ type: "healing", dice: "2d8", abilityModifier: "cha" }]
  },
  {
    id: "ranger-marked-volley", name: "Marked Volley", classId: "ranger", level: 1,
    description: "Loose a carefully aimed shot at a marked target.",
    effects: [{ type: "damage", dice: "1d8", damageType: "piercing", attackAbility: "dex", proficient: true }]
  },
  {
    id: "ranger-hunter-stalkers-judgment", name: "Stalker's Judgment", classId: "ranger", subclassId: "hunter", level: 3,
    description: "Exploit an opening with a decisive follow-up shot.",
    effects: [{ type: "damage", dice: "2d8", damageType: "piercing", attackAbility: "dex", proficient: true, advantage: 1 }]
  },
  {
    id: "rogue-precise-cut", name: "Precise Cut", classId: "rogue", level: 1,
    description: "Find a gap in the target's defense with a precise strike.",
    effects: [{ type: "damage", dice: "1d8", damageType: "piercing", attackAbility: "dex", proficient: true, advantage: 1 }]
  },
  {
    id: "rogue-thief-quick-hands", name: "Quick Hands", classId: "rogue", subclassId: "thief", level: 3, actionCost: "bonusAction",
    description: "Make a fast, opportunistic attack while repositioning.",
    effects: [{ type: "damage", dice: "2d6", damageType: "piercing", attackAbility: "dex", proficient: true }]
  },
  {
    id: "sorcerer-wild-spark", name: "Wild Spark", classId: "sorcerer", level: 1,
    description: "Release a concentrated spark of unstable magic.",
    effects: [{ type: "damage", dice: "1d10", damageType: "lightning", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "sorcerer-draconic-scale-of-embers", name: "Scale of Embers", classId: "sorcerer", subclassId: "draconic", level: 3,
    description: "Shape draconic fire into a focused burst.",
    effects: [{ type: "damage", dice: "2d8", damageType: "fire", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "warlock-pact-lash", name: "Pact Lash", classId: "warlock", level: 1,
    description: "Snap a thread of pact energy against a foe.",
    effects: [{ type: "damage", dice: "1d10", damageType: "necrotic", attackAbility: "cha", proficient: true }]
  },
  {
    id: "warlock-fiend-cinder-debt", name: "Cinder Debt", classId: "warlock", subclassId: "fiend", level: 3,
    description: "Call in a small measure of infernal power.",
    effects: [{ type: "damage", dice: "2d8", damageType: "fire", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "wizard-arcane-burst", name: "Arcane Burst", classId: "wizard", level: 1,
    description: "Release a controlled burst of force at one foe.",
    effects: [{ type: "damage", dice: "1d10", damageType: "force", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  {
    id: "wizard-evoker-prismatic-surge", name: "Prismatic Surge", classId: "wizard", subclassId: "evoker", level: 3,
    description: "Focus an elemental surge into a precise strike.",
    effects: [{ type: "damage", dice: "2d8", damageType: "force", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  // ---- Barbarian: Path of the Totem Warrior
  {
    id: "barbarian-totem-warrior-totemic-spirit", name: "Totemic Spirit", classId: "barbarian", subclassId: "totem-warrior", level: 3,
    description: "Call a totem spirit that grants resistance while raging.",
    effects: [{ type: "damage", dice: "2d6", damageType: "slashing", attackAbility: "str", proficient: true }]
  },
  // ---- Bard: College of Valor
  {
    id: "bard-valor-combat-inspiration", name: "Combat Inspiration", classId: "bard", subclassId: "valor", level: 3, actionCost: "bonusAction",
    description: "Inspire an ally to add a die to an attack, save, or ability check.",
    effects: [{ type: "healing", dice: "1d8", abilityModifier: "cha" }]
  },
  // ---- Cleric: Light Domain
  {
    id: "cleric-light-radiance-of-the-dawn", name: "Radiance of the Dawn", classId: "cleric", subclassId: "light", level: 3,
    description: "Channel radiant light that harms undead and heals allies.",
    effects: [{ type: "damage", dice: "2d8", damageType: "radiant", save: { ability: "con", dc: 13, onSuccess: "half" } }]
  },
  // ---- Cleric: Trickery Domain
  {
    id: "cleric-trickery-tricksters-blessing", name: "Trickster's Blessing", classId: "cleric", subclassId: "trickery", level: 3, actionCost: "bonusAction",
    description: "Grant advantage on a Dexterity check or saving throw.",
    effects: [{ type: "damage", dice: "1d8", damageType: "psychic", save: { ability: "wis", dc: 13, onSuccess: "half" } }]
  },
  // ---- Cleric: War Domain
  {
    id: "cleric-war-war-priests-strike", name: "War Priest's Strike", classId: "cleric", subclassId: "war", level: 3,
    description: "Strike with a weapon and divine power.",
    effects: [{ type: "damage", dice: "2d8", damageType: "radiant", attackAbility: "str", proficient: true }]
  },
  // ---- Druid: Circle of the Moon
  {
    id: "druid-moon-moon-beast-form", name: "Moon Beast Form", classId: "druid", subclassId: "moon", level: 3,
    description: "Assume a powerful beast form with temporary hit points.",
    effects: [{ type: "damage", dice: "1d10", damageType: "piercing", attackAbility: "str", proficient: true }]
  },
  // ---- Fighter: Battle Master
  {
    id: "fighter-battle-master-maneuver-strike", name: "Maneuver Strike", classId: "fighter", subclassId: "battle-master", level: 3,
    description: "Spend a superiority die to add a tactical effect to an attack.",
    effects: [{ type: "damage", dice: "1d10", damageType: "slashing", attackAbility: "str", proficient: true }]
  },
  // ---- Fighter: Eldritch Knight
  {
    id: "fighter-eldritch-knight-bonded-weapon", name: "Bonded Weapon", classId: "fighter", subclassId: "eldritch-knight", level: 3,
    description: "Bond with a weapon and summon it as a bonus action.",
    effects: [{ type: "damage", dice: "2d6", damageType: "force", attackAbility: "str", proficient: true }]
  },
  // ---- Monk: Way of Shadow
  {
    id: "monk-shadow-shadow-step", name: "Shadow Step", classId: "monk", subclassId: "shadow", level: 3, actionCost: "bonusAction",
    description: "Step between shadows and strike from concealment.",
    effects: [{ type: "damage", dice: "1d8", damageType: "necrotic", attackAbility: "dex", proficient: true }]
  },
  // ---- Monk: Way of the Four Elements
  {
    id: "monk-four-elements-elemental-strike", name: "Elemental Strike", classId: "monk", subclassId: "four-elements", level: 3,
    description: "Channel elemental energy into an unarmed strike.",
    effects: [{ type: "damage", dice: "1d10", damageType: "fire", attackAbility: "dex", proficient: true }]
  },
  // ---- Paladin: Oath of the Ancients
  {
    id: "paladin-ancients-nature-s-wrath", name: "Nature's Wrath", classId: "paladin", subclassId: "ancients", level: 3,
    description: "Entangle foes with spectral vines of primal power.",
    effects: [{ type: "damage", dice: "2d6", damageType: "poison", save: { ability: "str", dc: 13, onSuccess: "half" } }]
  },
  // ---- Paladin: Oath of Vengeance
  {
    id: "paladin-vengeance-vow-of-enmity", name: "Vow of Enmity", classId: "paladin", subclassId: "vengeance", level: 3, actionCost: "bonusAction",
    description: "Swear vengeance on a foe and gain advantage against them.",
    effects: [{ type: "damage", dice: "1d8", damageType: "radiant", attackAbility: "str", proficient: true }]
  },
  // ---- Ranger: Beast Master
  {
    id: "ranger-beast-master-primal-companion", name: "Primal Companion", classId: "ranger", subclassId: "beast-master", level: 3,
    description: "Call a beast to fight beside you.",
    effects: [{ type: "damage", dice: "1d8", damageType: "piercing", attackAbility: "dex", proficient: true }]
  },
  // ---- Rogue: Assassin
  {
    id: "rogue-assassin-assassinate", name: "Assassinate", classId: "rogue", subclassId: "assassin", level: 3,
    description: "Auto-crit foes that have not yet acted in combat.",
    effects: [{ type: "damage", dice: "2d6", damageType: "piercing", attackAbility: "dex", proficient: true, advantage: 1 }]
  },
  // ---- Rogue: Arcane Trickster
  {
    id: "rogue-arcane-trickster-spell-thief", name: "Spell Thief", classId: "rogue", subclassId: "arcane-trickster", level: 3,
    description: "Steal a spell from a caster and use it once.",
    effects: [{ type: "damage", dice: "1d8", damageType: "force", save: { ability: "wis", dc: 13, onSuccess: "half" } }]
  },
  // ---- Sorcerer: Wild Magic
  {
    id: "sorcerer-wild-magic-wild-surge", name: "Wild Surge", classId: "sorcerer", subclassId: "wild-magic", level: 3,
    description: "Unleash wild magic with an unpredictable effect.",
    effects: [{ type: "damage", dice: "2d6", damageType: "force", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  // ---- Warlock: The Great Old One
  {
    id: "warlock-great-old-one-awakened-mind", name: "Awakened Mind", classId: "warlock", subclassId: "great-old-one", level: 3,
    description: "Telepathically contact a creature and probe its thoughts.",
    effects: [{ type: "damage", dice: "1d10", damageType: "psychic", save: { ability: "wis", dc: 13, onSuccess: "half" } }]
  },
  // ---- Wizard: School of Abjuration
  {
    id: "wizard-abjurer-arcane-ward", name: "Arcane Ward", classId: "wizard", subclassId: "abjurer", level: 3,
    description: "Create a magical ward that absorbs incoming damage.",
    effects: [{ type: "damage", dice: "1d10", damageType: "force", save: { ability: "dex", dc: 13, onSuccess: "half" } }]
  },
  // ---- Wizard: School of Divination
  {
    id: "wizard-diviner-portent", name: "Portent", classId: "wizard", subclassId: "diviner", level: 3,
    description: "Foresee and replace a d20 roll with a portent die.",
    effects: [{ type: "damage", dice: "1d8", damageType: "force", save: { ability: "wis", dc: 13, onSuccess: "half" } }]
  }
  ...expansion.abilities
]);
