const freeze = value => Object.freeze(value);

export const PROFESSIONS = freeze([
  { id: "herbalism", name: "Herbalism", category: "gathering", tool: "gathering-sickle", description: "Identify and harvest alchemical plants." },
  { id: "ore-mining", name: "Ore Mining", category: "gathering", tool: "mining-pick", description: "Extract ore, gems and mineral salts." },
  { id: "forestry", name: "Forestry", category: "gathering", tool: "woodcutters-axe", description: "Harvest timber, bark and resins." },
  { id: "hidecraft", name: "Hidecraft", category: "gathering", tool: "skinning-knife", description: "Prepare hides, scales and monster parts." },
  { id: "angling", name: "Angling", category: "gathering", tool: "fishing-rod", description: "Catch fish and gather waterside materials." },
  { id: "salvaging", name: "Salvaging", category: "gathering", tool: "salvage-kit", description: "Recover useful materials from abandoned gear." },
  { id: "relic-survey", name: "Relic Survey", category: "gathering", tool: "survey-compass", description: "Survey ruins for fragments and ancient components." },
  { id: "cultivation", name: "Cultivation", category: "gathering", tool: "field-tools", description: "Grow rare crops and useful fibers." },
  { id: "beast-lore", name: "Beast Lore", category: "gathering", tool: "field-dressing-kit", description: "Safely collect reagents from defeated creatures." },
  { id: "alchemy", name: "Alchemy", category: "crafting", tool: "alchemist-kit", station: "alchemy-lab", description: "Brew restorative draughts and elemental mixtures." },
  { id: "armorsmithing", name: "Armorsmithing", category: "crafting", tool: "smith-hammer", station: "forge", description: "Forge durable armor and protective fittings." },
  { id: "weaponsmithing", name: "Weaponsmithing", category: "crafting", tool: "smith-hammer", station: "forge", description: "Forge reliable weapons for adventurers." },
  { id: "tailoring", name: "Tailoring", category: "crafting", tool: "weaving-loom", station: "loom", description: "Weave cloth into garments and field supplies." },
  { id: "leatherworking", name: "Leatherworking", category: "crafting", tool: "leatherworking-tools", station: "tanning-rack", description: "Turn treated hides into armor and utility gear." },
  { id: "jewelcraft", name: "Jewelcraft", category: "crafting", tool: "jeweler-loupe", station: "jeweler-bench", description: "Cut stones and shape ornamental settings." },
  { id: "rune-scribing", name: "Rune Scribing", category: "crafting", tool: "scribe-kit", station: "inscription-desk", description: "Write original warding runes and spell records." },
  { id: "engineering", name: "Engineering", category: "crafting", tool: "tinker-tools", station: "workbench", description: "Build useful devices, mechanisms and field tools." },
  { id: "cookery", name: "Cookery", category: "crafting", tool: "cook-kit", station: "cooking-fire", description: "Prepare hearty meals and travel provisions." }
].map(freeze));

const ingredient = (id, quantity) => ({ id, quantity });
const recipe = (id, professionId, name, skill, station, ingredients, outputId, outputName, quantity = 1) =>
  freeze({
    id, professionId, name, requiredSkill: skill, station,
    ingredients: freeze(ingredients.map(([itemId, count]) => freeze(ingredient(itemId, count)))),
    output: freeze({ id: outputId, name: outputName, quantity, weight: 0.1, stackable: true }),
    skillExperience: skill < 75 ? 15 : skill < 150 ? 25 : 40
  });

const recipes = [];
const itemCatalog = {};

function registerItem(id, name, { weight = 0.1, stackable = true } = {}) {
  itemCatalog[id] ||= freeze({ id, name, weight, stackable });
}

for (const [id, name, weight] of [
  ["bitterleaf", "Bitterleaf", 0.1], ["river-salt", "River Salt", 0.2], ["moonpetal", "Moonpetal", 0.1],
  ["clearwater", "Clearwater", 0.2], ["iron-ore", "Iron Ore", 1], ["beast-hide", "Beast Hide", 0.8],
  ["star-iron", "Star Iron", 1.2], ["tempered-hide", "Tempered Hide", 0.8], ["heartwood", "Heartwood", 1],
  ["stormglass", "Stormglass", 0.3], ["field-fiber", "Field Fiber", 0.1], ["moonthread", "Moonthread", 0.1],
  ["wyrm-scale", "Wyrm Scale", 0.5], ["river-gem", "River Gem", 0.2], ["prism-shard", "Prism Shard", 0.2],
  ["relic-fragment", "Relic Fragment", 0.4], ["rune-slate", "Rune Slate", 0.6],
  ["salvaged-spring", "Salvaged Spring", 0.3], ["river-trout", "River Trout", 0.5],
  ["hearthroot", "Hearthroot", 0.2], ["wild-game", "Wild Game", 0.7]
]) registerItem(id, name, { weight });

function addRecipe(...args) {
  const entry = recipe(...args);
  recipes.push(entry);
  registerItem(entry.output.id, entry.output.name, entry.output);
  for (const { id } of entry.ingredients) registerItem(id, id.replaceAll("-", " "));
}

const craftingSpecs = [
  ["alchemy", "Bitterleaf Draught", "Clearwater Tonic", ["bitterleaf", "river-salt"], ["moonpetal", "clearwater"]],
  ["armorsmithing", "Riveted Trail Coat", "Star-Iron Cuirass", ["iron-ore", "beast-hide"], ["star-iron", "tempered-hide"]],
  ["weaponsmithing", "Wayfarer Spear", "Stormglass Edge", ["iron-ore", "heartwood"], ["star-iron", "stormglass"]],
  ["tailoring", "Woven Field Mantle", "Moonthread Robe", ["field-fiber", "beast-hide"], ["moonthread", "moonpetal"]],
  ["leatherworking", "Reinforced Scout Jerkin", "Wyrmhide Harness", ["beast-hide", "iron-ore"], ["wyrm-scale", "tempered-hide"]],
  ["jewelcraft", "Riverstone Pendant", "Prismatic Signet", ["river-gem", "iron-ore"], ["prism-shard", "star-iron"]],
  ["rune-scribing", "Minor Ward Glyph", "Waystone Inscription", ["relic-fragment", "moonpetal"], ["rune-slate", "prism-shard"]],
  ["engineering", "Pocket Signal Flare", "Surveyor's Folding Lens", ["salvaged-spring", "iron-ore"], ["relic-fragment", "prism-shard"]],
  ["cookery", "Herb-Roasted Trout", "Deepwood Travel Stew", ["river-trout", "bitterleaf"], ["hearthroot", "wild-game"]]
];

for (const [professionId, basicName, advancedName, basicMaterials, advancedMaterials] of craftingSpecs) {
  const profession = PROFESSIONS.find(entry => entry.id === professionId);
  const idPrefix = professionId;
  const firstOutput = `${idPrefix}-basic-${basicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`;
  const secondOutput = `${idPrefix}-advanced-${advancedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`;
  addRecipe(`${idPrefix}-recipe-01`, professionId, basicName, 1, profession.station,
    basicMaterials.map(itemId => [itemId, 2]), firstOutput, basicName, professionId === "alchemy" || professionId === "cookery" ? 2 : 1);
  addRecipe(`${idPrefix}-recipe-02`, professionId, advancedName, 75, profession.station,
    advancedMaterials.map(itemId => [itemId, 3]), secondOutput, advancedName);
}

const node = (id, name, professionId, skill, itemId, itemName, cooldownMs, quantity = [1, 2]) =>
  freeze({ id, name, professionId, requiredSkill: skill, item: freeze({ id: itemId, name: itemName, weight: itemCatalog[itemId]?.weight ?? 0.2, stackable: true }), quantity: freeze(quantity), cooldownMs, skillExperience: skill < 75 ? 8 : 14 });

const nodes = [
  node("elderwood-bitterleaf", "Bitterleaf Patch", "herbalism", 1, "bitterleaf", "Bitterleaf", 30000),
  node("moonpetal-grove", "Moonpetal Grove", "herbalism", 75, "moonpetal", "Moonpetal", 60000),
  node("iron-vein", "Iron Vein", "ore-mining", 1, "iron-ore", "Iron Ore", 45000),
  node("star-iron-seam", "Star-Iron Seam", "ore-mining", 75, "star-iron", "Star Iron", 90000),
  node("river-gem-pocket", "River-Gem Pocket", "ore-mining", 1, "river-gem", "River Gem", 45000),
  node("heartwood-stand", "Heartwood Stand", "forestry", 1, "heartwood", "Heartwood", 45000),
  node("moonthread-boll", "Moonthread Boll", "forestry", 75, "moonthread", "Moonthread", 90000),
  node("trail-beast-remains", "Trail Beast Remains", "hidecraft", 1, "beast-hide", "Beast Hide", 45000),
  node("wyrm-scale-remains", "Wyrm Remains", "hidecraft", 75, "wyrm-scale", "Wyrm Scale", 90000),
  node("tempered-hide-remains", "Tempered Hide Remains", "hidecraft", 75, "tempered-hide", "Tempered Hide", 90000),
  node("clearwater-pool", "Clearwater Pool", "angling", 1, "river-trout", "River Trout", 30000),
  node("deepwater-run", "Deepwater Run", "angling", 75, "river-trout", "River Trout", 60000),
  node("river-salt-beds", "River Salt Beds", "angling", 1, "river-salt", "River Salt", 30000),
  node("springwater-falls", "Springwater Falls", "angling", 75, "clearwater", "Clearwater", 60000),
  node("broken-caravan", "Broken Caravan", "salvaging", 1, "salvaged-spring", "Salvaged Spring", 45000),
  node("ancient-machinery", "Ancient Machinery", "salvaging", 75, "prism-shard", "Prism Shard", 90000),
  node("ruined-shrine", "Ruined Shrine", "relic-survey", 1, "relic-fragment", "Relic Fragment", 60000),
  node("sealed-archive", "Sealed Archive", "relic-survey", 75, "rune-slate", "Rune Slate", 120000),
  node("hearthroot-bed", "Hearthroot Bed", "cultivation", 1, "hearthroot", "Hearthroot", 30000),
  node("field-fiber-crop", "Moonlit Fiber Crop", "cultivation", 75, "field-fiber", "Field Fiber", 60000),
  node("wild-game-tracks", "Wild Game Tracks", "beast-lore", 1, "wild-game", "Wild Game", 45000),
  node("storm-drake-remains", "Storm Drake Remains", "beast-lore", 75, "stormglass", "Stormglass", 90000)
];

export const PROFESSION_RECIPES = freeze(recipes);
export const GATHERING_NODES = freeze(nodes);
export const PROFESSION_ITEMS = freeze(itemCatalog);
