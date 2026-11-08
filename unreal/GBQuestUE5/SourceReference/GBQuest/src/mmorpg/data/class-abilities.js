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
  }
]);
