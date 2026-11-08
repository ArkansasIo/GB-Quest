import { attackRoll, savingThrow, resolveDamage, applyDamage } from "./combat.js";
import { abilityModifier } from "./d20.js";
import { spendClassResource } from "./class-resources.js";
import { spendTurnResource } from "./encounter.js";
import { CONDITIONS, addCondition } from "./conditions.js";

const ACTION_COSTS = new Set(["action", "bonusAction", "reaction", "none"]);
const EFFECT_TYPES = new Set(["damage", "healing", "condition"]);

export function validateClassAbility(ability) {
  if (!ability || typeof ability.id !== "string" || !ability.id.trim()) throw new TypeError("Ability requires a stable id");
  if (!ACTION_COSTS.has(ability.actionCost ?? "action")) throw new RangeError("Unsupported ability action cost");
  if (!Array.isArray(ability.effects) || ability.effects.length === 0) throw new TypeError("Ability requires at least one effect");
  for (const effect of ability.effects) {
    if (!EFFECT_TYPES.has(effect.type)) throw new RangeError(`Unsupported ability effect: ${effect.type}`);
    if ((effect.type === "damage" || effect.type === "healing") && (typeof effect.dice !== "string" || !effect.dice.trim())) {
      throw new TypeError("Damage and healing effects require a dice expression");
    }
    if (effect.type === "condition" && !CONDITIONS[effect.condition]) throw new RangeError(`Unknown condition: ${effect.condition}`);
    if (effect.save && (!["str", "dex", "con", "int", "wis", "cha"].includes(effect.save.ability))) {
      throw new RangeError("Saving throw requires a valid ability");
    }
  }
  for (const cost of ability.resourceCosts ?? []) {
    if (!cost.resourceId || !Number.isInteger(cost.amount) || cost.amount < 1) throw new TypeError("Resource costs require a resourceId and positive integer amount");
  }
  return ability;
}

function canPayResources(actor, costs) {
  const totals = new Map();
  for (const cost of costs) totals.set(cost.resourceId, (totals.get(cost.resourceId) ?? 0) + cost.amount);
  for (const [resourceId, amount] of totals) {
    const resource = actor?.classResources?.[resourceId];
    if (!resource) return { ok: false, reason: "resource_not_found", resourceId };
    if (!resource.spendable) return { ok: false, reason: "resource_not_spendable", resourceId };
    if (resource.remaining < amount) return { ok: false, reason: "insufficient_resource", resourceId };
  }
  return { ok: true };
}

function canPayAction(actor, actionCost) {
  if (actionCost === "none") return { ok: true };
  const key = { action: "actionAvailable", bonusAction: "bonusActionAvailable", reaction: "reactionAvailable" }[actionCost];
  return actor?.[key] === false ? { ok: false, reason: "action_unavailable", actionCost } : { ok: true };
}

function validateTargets(targets, effects) {
  for (const target of targets) {
    if (!target || target.defeated) return false;
    if (effects.some(effect => effect.type === "damage" || effect.type === "healing")) {
      if (!Number.isFinite(target.hp) || !Number.isFinite(target.maxHp) || target.maxHp < 0 || target.hp < 0) return false;
    }
    if (effects.some(effect => effect.type === "damage" && !effect.save) && !Number.isFinite(target.ac ?? 10)) return false;
    if (effects.some(effect => effect.type === "condition") && !Array.isArray(target.conditions)) return false;
  }
  return true;
}

function planEffect({ actor, target, effect, attack, random }) {
  if (effect.type === "condition") return { type: "condition", condition: effect.condition, duration: effect.duration ?? null };
  if (effect.type === "healing") {
    const rolled = resolveDamage({ expression: effect.dice, modifier: effect.modifier ?? 0 }, "healing", random);
    const amount = Math.max(0, rolled.damage + (effect.abilityModifier ? abilityModifier(actor.abilities?.[effect.abilityModifier] ?? 10) : 0));
    return { type: "healing", amount, rolls: rolled.rolls };
  }

  if (effect.save) {
    const save = savingThrow({
      abilityScore: target.abilities?.[effect.save.ability] ?? 10,
      proficient: target.saveProficiencies?.includes(effect.save.ability) ?? false,
      level: target.level ?? 1,
      bonus: target.saveBonuses?.[effect.save.ability] ?? 0,
      dc: effect.save.dc ?? 10,
      advantage: target.saveAdvantages?.[effect.save.ability] ?? 0
    }, random);
    const factor = !save.success ? 1 : effect.save.onSuccess === "half" ? 0.5 : 0;
    const damage = resolveDamage({
      expression: effect.dice, modifier: effect.modifier ?? 0,
      resistance: target.resistances ?? [], vulnerability: target.vulnerabilities ?? [], immunity: target.immunities ?? []
    }, effect.damageType ?? "untyped", random);
    return { type: "damage", amount: Math.floor(damage.damage * factor), damageType: damage.damageType, save, rolls: damage.rolls };
  }

  const hit = attack ?? attackRoll({
    abilityScore: actor.abilities?.[effect.attackAbility ?? "str"] ?? 10,
    proficient: effect.proficient ?? false,
    level: actor.level ?? 1,
    bonus: effect.attackBonus ?? 0,
    advantage: effect.advantage ?? 0
  }, target.ac ?? 10, random);
  if (!hit.hit) return { type: "miss", attack: hit };
  const damage = resolveDamage({
    expression: effect.dice, modifier: effect.modifier ?? 0, critical: hit.critical,
    resistance: target.resistances ?? [], vulnerability: target.vulnerabilities ?? [], immunity: target.immunities ?? []
  }, effect.damageType ?? "untyped", random);
  return { type: "damage", amount: damage.damage, damageType: damage.damageType, attack: hit, rolls: damage.rolls };
}

/** Execute authored class abilities inside an authoritative server simulation. */
export function useClassAbility({ actor, targets, ability, random = Math.random }) {
  validateClassAbility(ability);
  if (!actor || typeof actor !== "object") throw new TypeError("Ability user is required");
  if (!Array.isArray(targets) || targets.length === 0) return { ok: false, reason: "target_required" };
  if (!validateTargets(targets, ability.effects)) return { ok: false, reason: "invalid_target" };

  const actionCost = ability.actionCost ?? "action";
  const actionCheck = canPayAction(actor, actionCost);
  if (!actionCheck.ok) return actionCheck;
  const resourceCosts = ability.resourceCosts ?? [];
  const resourceCheck = canPayResources(actor, resourceCosts);
  if (!resourceCheck.ok) return resourceCheck;

  const attackEffect = ability.effects.find(effect => effect.type === "damage" && !effect.save);
  const staged = targets.map(target => {
    const attack = attackEffect ? attackRoll({
      abilityScore: actor.abilities?.[attackEffect.attackAbility ?? "str"] ?? 10,
      proficient: attackEffect.proficient ?? false,
      level: actor.level ?? 1,
      bonus: attackEffect.attackBonus ?? 0,
      advantage: attackEffect.advantage ?? 0
    }, target.ac ?? 10, random) : null;
    return { target, effects: ability.effects.map(effect => planEffect({ actor, target, effect, attack: effect === attackEffect ? attack : null, random })) };
  });

  // Costs are committed only after validation and all random resolution succeeds.
  if (actionCost !== "none" && !spendTurnResource(actor, actionCost)) return { ok: false, reason: "action_unavailable", actionCost };
  const spent = [];
  for (const cost of resourceCosts) {
    const result = spendClassResource(actor, cost.resourceId, cost.amount);
    if (!result.ok) {
      for (const prior of spent) actor.classResources[prior.resourceId].remaining += prior.amount;
      if (actionCost !== "none") {
        const key = { action: "actionAvailable", bonusAction: "bonusActionAvailable", reaction: "reactionAvailable" }[actionCost];
        actor[key] = true;
      }
      return result;
    }
    spent.push(cost);
  }

  const results = staged.map(entry => ({
    targetId: entry.target.id ?? null,
    effects: entry.effects.map(effect => {
      if (effect.type === "damage") return { ...effect, ...applyDamage(entry.target, effect.amount, effect.damageType) };
      if (effect.type === "healing") {
        const before = entry.target.hp;
        entry.target.hp = Math.min(entry.target.maxHp, before + effect.amount);
        return { ...effect, healed: entry.target.hp - before, remainingHp: entry.target.hp };
      }
      if (effect.type === "condition") {
        addCondition(entry.target, effect.condition, { duration: effect.duration, source: ability.id });
        return effect;
      }
      return effect;
    })
  }));
  return { ok: true, abilityId: ability.id, actionCost, resourcesSpent: spent, results };
}
