import {
  GATHERING_NODES, PROFESSION_ITEMS, PROFESSION_RECIPES, PROFESSIONS
} from "../data/profession-catalog.js";
import { addItem, removeItem } from "./inventory.js";

export const MAX_PROFESSION_SKILL = 720;
export const MAX_PROFESSION_TALENT_RANK = 240;
export const PROFESSION_RANKS = Object.freeze([
  Object.freeze({ id: "apprentice", min: 1, max: 144 }),
  Object.freeze({ id: "journeyman", min: 145, max: 288 }),
  Object.freeze({ id: "expert", min: 289, max: 432 }),
  Object.freeze({ id: "master", min: 433, max: 576 }),
  Object.freeze({ id: "grandmaster", min: 577, max: 720 })
]);
const TALENT_BRANCHES = Object.freeze({
  gathering: Object.freeze([
    Object.freeze({ id: "yield", name: "Abundant Harvest", description: "Gain more materials from each gathering action." }),
    Object.freeze({ id: "fortune", name: "Keen Discovery", description: "Improve the chance of finding extra materials." }),
    Object.freeze({ id: "fieldcraft", name: "Fieldcraft", description: "Reduce the time before gathering nodes return." })
  ]),
  crafting: Object.freeze([
    Object.freeze({ id: "efficiency", name: "Efficient Practice", description: "Use fewer ingredients per recipe." }),
    Object.freeze({ id: "yield", name: "Productive Crafting", description: "Create extra items when a recipe succeeds." }),
    Object.freeze({ id: "mastery", name: "Deep Mastery", description: "Gain more profession experience from crafting." })
  ])
});

const professionById = new Map(PROFESSIONS.map(profession => [profession.id, profession]));
const recipeById = new Map(PROFESSION_RECIPES.map(recipe => [recipe.id, recipe]));
const nodeById = new Map(GATHERING_NODES.map(node => [node.id, node]));

function assertState(state) {
  if (!state || typeof state !== "object" || !state.skills || !Array.isArray(state.knownRecipes) ||
      !state.gatheringNodes || typeof state.gatheringNodes !== "object") {
    throw new TypeError("A valid profession state is required");
  }
  state.skillExperience ??= {};
  state.talents ??= {};
  if (!state.talents || typeof state.talents !== "object" || Array.isArray(state.talents)) {
    throw new TypeError("Profession talent state must be an object");
  }
}

function professionDefinition(professionId) {
  const profession = professionById.get(professionId);
  if (!profession) throw new RangeError(`Unknown profession: ${professionId}`);
  return profession;
}

function currentSkill(state, professionId) {
  const level = state.skills[professionId] ?? 0;
  if (!Number.isInteger(level) || level < 0 || level > MAX_PROFESSION_SKILL) {
    throw new RangeError(`Invalid ${professionId} skill level`);
  }
  return level;
}

function skillXpToNext(level) {
  return 25 + level * 5;
}

function skillRank(level) {
  return PROFESSION_RANKS.find(rank => level >= rank.min && level <= rank.max)?.id ?? null;
}

function resolveRecipe(recipeOrId) {
  if (typeof recipeOrId === "string") {
    const recipe = recipeById.get(recipeOrId);
    if (!recipe) throw new RangeError(`Unknown profession recipe: ${recipeOrId}`);
    return recipe;
  }
  if (!recipeOrId || typeof recipeOrId !== "object" || !recipeOrId.id) {
    throw new TypeError("A valid profession recipe is required");
  }
  const recipe = recipeById.get(recipeOrId.id);
  if (!recipe || recipe !== recipeOrId) throw new RangeError(`Unknown profession recipe: ${recipeOrId.id}`);
  return recipe;
}

function recipeAvailability(state, recipe, inventory) {
  if (!state.knownRecipes.includes(recipe.id)) return { ok: false, reason: "recipe_unknown" };
  if (currentSkill(state, recipe.professionId) < recipe.requiredSkill) {
    return { ok: false, reason: "skill_too_low" };
  }
  if (!inventory || !Array.isArray(inventory.items)) {
    throw new TypeError("A valid inventory is required");
  }
  const reduction = Math.floor(talentRank(state, recipe.professionId, "efficiency") / 24);
  for (const ingredient of recipe.ingredients) {
    const quantity = Math.max(1, ingredient.quantity - reduction);
    if ((inventory.items.find(item => item.id === ingredient.id)?.quantity ?? 0) < quantity) {
      return { ok: false, reason: "missing_materials" };
    }
  }
  return { ok: true };
}

export function createProfessionState() {
  return { skills: {}, skillExperience: {}, talents: {}, knownRecipes: [], gatheringNodes: {} };
}

export function listProfessions({ category = null, query = "" } = {}) {
  const needle = String(query).trim().toLowerCase();
  return PROFESSIONS.filter(profession => !category || profession.category === category)
    .filter(profession => !needle ||
      `${profession.id} ${profession.name} ${profession.description}`.toLowerCase().includes(needle));
}

export function getProfession(professionId) {
  return professionDefinition(professionId);
}

export function learnProfession(state, professionId) {
  assertState(state);
  professionDefinition(professionId);
  if (currentSkill(state, professionId) > 0) return false;
  state.skills[professionId] = 1;
  state.skillExperience[professionId] = 0;
  return true;
}

export function getProfessionProgress(state, professionId) {
  assertState(state);
  professionDefinition(professionId);
  const skill = currentSkill(state, professionId);
  const xp = state.skillExperience[professionId] ?? 0;
  if (!Number.isSafeInteger(xp) || xp < 0 || (skill === MAX_PROFESSION_SKILL && xp !== 0)) {
    throw new RangeError(`Invalid ${professionId} skill experience`);
  }
  return {
    professionId,
    skill,
    rank: skillRank(skill),
    experience: xp,
    experienceToNext: skill === 0 || skill === MAX_PROFESSION_SKILL ? 0 : skillXpToNext(skill)
  };
}

export function getProfessionTalentTree(state, professionId) {
  assertState(state);
  const profession = professionDefinition(professionId);
  const skill = currentSkill(state, professionId);
  const branches = TALENT_BRANCHES[profession.category];
  const saved = state.talents[professionId] ?? {};
  for (const branch of branches) {
    const rank = saved[branch.id] ?? 0;
    if (!Number.isInteger(rank) || rank < 0 || rank > MAX_PROFESSION_TALENT_RANK) {
      throw new RangeError(`Invalid ${professionId} ${branch.id} talent rank`);
    }
  }
  const spent = branches.reduce((total, branch) => total + (saved[branch.id] ?? 0), 0);
  if (spent > skill) throw new RangeError(`${professionId} talent points exceed its profession skill`);
  return {
    professionId,
    skill,
    pointsEarned: skill,
    pointsSpent: spent,
    pointsAvailable: skill - spent,
    branches: branches.map(branch => ({
      ...branch,
      rank: saved[branch.id] ?? 0,
      maxRank: MAX_PROFESSION_TALENT_RANK
    }))
  };
}

export function spendProfessionTalent(state, professionId, branchId, points = 1) {
  assertState(state);
  const tree = getProfessionTalentTree(state, professionId);
  if (!Number.isInteger(points) || points < 1) throw new RangeError("Talent points to spend must be a positive integer");
  const branch = tree.branches.find(entry => entry.id === branchId);
  if (!branch) throw new RangeError(`Unknown ${professionId} talent branch: ${branchId}`);
  if (tree.pointsAvailable < points) return { ok: false, reason: "insufficient_points" };
  if (branch.rank + points > branch.maxRank) return { ok: false, reason: "rank_cap" };
  state.talents[professionId] ??= {};
  state.talents[professionId][branchId] = branch.rank + points;
  return { ok: true, ...getProfessionTalentTree(state, professionId) };
}

function talentRank(state, professionId, branchId) {
  return state.talents[professionId]?.[branchId] ?? 0;
}

export function gainProfessionSkill(state, professionId, experience) {
  assertState(state);
  professionDefinition(professionId);
  if (!Number.isSafeInteger(experience) || experience < 1) {
    throw new RangeError("Profession experience must be a positive safe integer");
  }
  let skill = currentSkill(state, professionId);
  if (skill === 0) throw new RangeError(`Learn ${professionId} before gaining skill`);
  let xp = state.skillExperience[professionId] ?? 0;
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError(`Invalid ${professionId} skill experience`);
  xp += experience;
  let levelsGained = 0;
  while (skill < MAX_PROFESSION_SKILL && xp >= skillXpToNext(skill)) {
    xp -= skillXpToNext(skill);
    skill++;
    levelsGained++;
  }
  if (skill === MAX_PROFESSION_SKILL) xp = 0;
  state.skills[professionId] = skill;
  state.skillExperience[professionId] = xp;
  return { ...getProfessionProgress(state, professionId), levelsGained };
}

export function listProfessionRecipes({ professionId = null, skill = null, query = "" } = {}) {
  if (professionId !== null) professionDefinition(professionId);
  if (skill !== null && (!Number.isInteger(skill) || skill < 0 || skill > MAX_PROFESSION_SKILL)) {
    throw new RangeError("Profession skill must be from 0 to 300");
  }
  const needle = String(query).trim().toLowerCase();
  return PROFESSION_RECIPES.filter(recipe => !professionId || recipe.professionId === professionId)
    .filter(recipe => skill === null || recipe.requiredSkill <= skill)
    .filter(recipe => !needle || `${recipe.id} ${recipe.name}`.toLowerCase().includes(needle));
}

export function learnRecipe(state, recipeId) {
  assertState(state);
  const recipe = resolveRecipe(recipeId);
  if (state.knownRecipes.includes(recipe.id)) return false;
  if (currentSkill(state, recipe.professionId) < recipe.requiredSkill) return false;
  state.knownRecipes.push(recipe.id);
  return true;
}

export function canCraft(state, recipeOrId, inventory) {
  assertState(state);
  return recipeAvailability(state, resolveRecipe(recipeOrId), inventory);
}

export function craftRecipe(state, recipeOrId, inventory, { station = null } = {}) {
  assertState(state);
  const recipe = resolveRecipe(recipeOrId);
  const availability = recipeAvailability(state, recipe, inventory);
  if (!availability.ok) return availability;
  if (recipe.station && station !== recipe.station) return { ok: false, reason: "wrong_station" };

  const stagedInventory = structuredClone(inventory);
  for (const ingredient of recipe.ingredients) {
    const reduction = Math.floor(talentRank(state, recipe.professionId, "efficiency") / 24);
    const quantity = Math.max(1, ingredient.quantity - reduction);
    const removal = removeItem(stagedInventory, ingredient.id, quantity);
    if (!removal.ok) return { ok: false, reason: "missing_materials" };
  }
  const output = { ...PROFESSION_ITEMS[recipe.output.id], ...recipe.output };
  const outputQuantity = recipe.output.quantity + Math.floor(talentRank(state, recipe.professionId, "yield") / 24);
  const addition = addItem(stagedInventory, output, outputQuantity);
  if (!addition.ok) return { ok: false, reason: `inventory_${addition.reason}` };

  const stagedState = structuredClone(state);
  const mastery = talentRank(state, recipe.professionId, "mastery");
  const skill = gainProfessionSkill(stagedState, recipe.professionId, Math.max(1, Math.floor(recipe.skillExperience * (1 + mastery / MAX_PROFESSION_TALENT_RANK))));
  inventory.items = stagedInventory.items;
  state.skills = stagedState.skills;
  state.skillExperience = stagedState.skillExperience;
  state.talents = stagedState.talents;
  return { ok: true, recipeId: recipe.id, output: { ...recipe.output, quantity: outputQuantity }, skill };
}

export function listGatheringNodes({ professionId = null, skill = null, query = "" } = {}) {
  if (professionId !== null) {
    const profession = professionDefinition(professionId);
    if (profession.category !== "gathering") return [];
  }
  if (skill !== null && (!Number.isInteger(skill) || skill < 0 || skill > MAX_PROFESSION_SKILL)) {
    throw new RangeError("Profession skill must be from 0 to 300");
  }
  const needle = String(query).trim().toLowerCase();
  return GATHERING_NODES.filter(node => !professionId || node.professionId === professionId)
    .filter(node => skill === null || node.requiredSkill <= skill)
    .filter(node => !needle || `${node.id} ${node.name} ${node.item.name}`.toLowerCase().includes(needle));
}

export function gatherResource(state, nodeId, { inventory = null, now = Date.now(), random = Math.random } = {}) {
  assertState(state);
  const node = nodeById.get(nodeId);
  if (!node) throw new RangeError(`Unknown gathering node: ${nodeId}`);
  if (!Number.isFinite(now) || now < 0) throw new RangeError("Gathering time must be a non-negative finite value");
  const sample = random();
  if (!(sample >= 0 && sample < 1)) throw new RangeError("Random source must return a value in [0, 1)");
  const skill = currentSkill(state, node.professionId);
  if (skill === 0) return { ok: false, reason: "profession_not_learned" };
  if (skill < node.requiredSkill) return { ok: false, reason: "skill_too_low" };
  if (state.gatheringNodes[node.id] > now) return { ok: false, reason: "node_depleted" };
  if (inventory !== null && (!inventory || !Array.isArray(inventory.items))) {
    throw new TypeError("A valid inventory is required");
  }
  const baseQuantity = node.quantity[0] + Math.floor(sample * (node.quantity[1] - node.quantity[0] + 1));
  const yieldBonus = Math.floor(talentRank(state, node.professionId, "yield") / 24);
  const fortuneRoll = yieldBonus ? random() : 1;
  if (!(fortuneRoll >= 0 && fortuneRoll < 1) && yieldBonus) throw new RangeError("Random source must return a value in [0, 1)");
  const fortuneBonus = fortuneRoll < Math.min(0.5, talentRank(state, node.professionId, "fortune") / 480) ? 1 : 0;
  const quantity = baseQuantity + yieldBonus + fortuneBonus;
  const cooldownReduction = Math.min(0.6, talentRank(state, node.professionId, "fieldcraft") / 400);
  const cooldownMs = Math.ceil(node.cooldownMs * (1 - cooldownReduction));

  if (inventory) {
    const stagedInventory = structuredClone(inventory);
    const addition = addItem(stagedInventory, node.item, quantity);
    if (!addition.ok) return { ok: false, reason: `inventory_${addition.reason}` };
    inventory.items = stagedInventory.items;
  }
  state.gatheringNodes[node.id] = now + cooldownMs;
  const progress = gainProfessionSkill(state, node.professionId, node.skillExperience);
  return { ok: true, nodeId, item: { ...node.item }, quantity, availableAt: state.gatheringNodes[node.id], skill: progress };
}

export function validateProfessionCatalog() {
  const ids = PROFESSIONS.map(profession => profession.id);
  const recipeIds = PROFESSION_RECIPES.map(recipe => recipe.id);
  const nodeIds = GATHERING_NODES.map(node => node.id);
  const duplicates = values => values.filter((value, index) => values.indexOf(value) !== index);
  const invalidRecipes = PROFESSION_RECIPES.filter(recipe =>
    professionById.get(recipe.professionId)?.category !== "crafting" ||
    recipe.ingredients.length === 0 || recipe.ingredients.some(item => !PROFESSION_ITEMS[item.id]) ||
    !PROFESSION_ITEMS[recipe.output.id] || recipe.requiredSkill < 1 || recipe.requiredSkill > MAX_PROFESSION_SKILL);
  const invalidNodes = GATHERING_NODES.filter(node =>
    professionById.get(node.professionId)?.category !== "gathering" ||
    !PROFESSION_ITEMS[node.item.id] || node.quantity.length !== 2 ||
    node.quantity[0] < 1 || node.quantity[1] < node.quantity[0]);
  return {
    valid: ids.length === 18 && duplicates(ids).length === 0 &&
      duplicates(recipeIds).length === 0 && duplicates(nodeIds).length === 0 &&
      invalidRecipes.length === 0 && invalidNodes.length === 0,
    professionCount: ids.length,
    gatheringProfessions: PROFESSIONS.filter(profession => profession.category === "gathering").length,
    craftingProfessions: PROFESSIONS.filter(profession => profession.category === "crafting").length,
    recipeCount: recipeIds.length,
    gatheringNodeCount: nodeIds.length,
    invalidRecipeIds: invalidRecipes.map(recipe => recipe.id),
    invalidNodeIds: invalidNodes.map(node => node.id)
  };
}
