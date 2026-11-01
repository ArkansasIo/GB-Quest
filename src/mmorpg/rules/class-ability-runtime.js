import { attackRoll, savingThrow, resolveDamage, applyDamage } from "./combat.js";
import { abilityModifier } from "./d20.js";
import { spendClassResource } from "./class-resources.js";
import { spendTurnResource } from "./encounter.js";
import { CONDITIONS, addCondition } from "./conditions.js";

const ACTION_COSTS = new Set(["action", "bonusAction", "reaction", "none"]);
const EFFECT_TYPES = new Set(["damage", "healing", "condition"]);

function validateAbility(ability) {
  if (!ability || typeof ability.id !== "string" || !ability.id.trim()) {
    throw new TypeError("Ability requires a stable id");
  }
  if (!ACTION_COSTS.has(ability.actionCost ?? "action")) {
    throw new RangeError("Unsupported ability action cost");
  }
  if (!Array.isArray(ability.effects) || ability.effects.length === 0) {
    throw new TypeError("Ability requires at least one effect");
  }
  for (const effect of ability.effects) {
    if (!EFFECT_TYPES.has(effect.type)) throw new RangeError(`Unsupported ability effect: ${effect.type}`);
    if (effect.type === "damage" || effect.type === "healing") {
      if (typeof effect.dice !== "string" || !effect.dice.trim()) throw new TypeError("Damage and healing effects require a dice expression");
    }
    if (effect.type === "condition" && !CONDITIONS[effect.condition]) {
      throw new RangeError(`Unknown condition: ${effect.condition}`);
    }
  }
  for (const cost of ability.resourceCosts ?? []) {
    if (!cost.resourceId || !Number.isInteger(cost.amount) || cost.amount < 1) {
      throw new TypeError("Resource costs require a resourceId and positive integer amount");
    }
  }
  return ability;
}

function canPayResources(actor, costs) {
  for (const cost of costs) {
    const resource = actor?.classResources?.[cost.resourceId];
    if (!resource) return { ok: false, reason: "resource_not_found", resourceId: cost.resourceId };
    if (!resource.spendable) return { ok: false, reason: "resource_not_spendable", resourceId: cost.resourceId };
    if (resource.remaining < cost.amount) return { ok: false, reason: "insufficient_resource", resourceId: cost.resourceId };
  }
  return { ok: true };
}

function canPayAction(actor, actionCost) {
  if (actionCost === "none") return { ok: true };
  const key = { action: "actionAvailable", bonusAction: "bonusActionAvailable", reaction: "reactionAvailable" }[actionCost];
  return actor?.[key] === false ? { ok: false, reason: "action_unavailable", actionCost } : { ok: true };
}

function planEffect({ actor, target, effect, attack, random }) {
  if (effect.type === "condition") {
    return { type: "condition", condition: effect.condition, duration: effect.duration ?? null };
  }
  if (effect.type === "healing") {
    const rolled = resolveDamage({ expression: effect.dice, modifier: effect.modifier ?? 0 }, "healing", random);
    const amount = Math.max(0, rolled.damage + (effect.abilityModifier ? abilityModifier(actor.abilities?.[effect.abilityModifier] ?? 10) : 0));
    return { type: "healing", amount, rolls: rolled.rolls };
  }

  let hit = attack;
  if (effect.save) {
    const score = target.abilities?.[effect.save.ability] ?? 10;
    const save = savingThrow({
      abilityScore: score,
      proficient: target.saveProficiencies?.includes(effect.save.ability) ?? false,
      level: target.level ?? 1,
      bonus: target.saveBonuses?.[effect.save.ability] ?? 0,
      dc: effect.save.dc ?? 10,
      advantage: target.saveAdvantages?.[effect.save.ability] ?? 0
    }, random);
    const failed = !save.success;
    const factor = failed ? 1 : effect.save.onSuccess === "half" ? 0.5 : 0;
    const damage = resolveDamage({
      expression: effect.dice,
      modifier: effect.modifier ?? 0,
      resistance: target.resistances ?? [],
      vulnerability: target.vulnerabilities ?? [],
      immunity: target.immunities ?? []
    }, effect.damageType ?? "untyped", random);
    return { type: "damage", amount: Math.floor(damage.damage * factor), damageType: damage.damageType, save, rolls: damage.rolls };
  }

  if (!hit) {
    const score = actor.abilities?.[effect.attackAbility ?? "str"] ?? 10;
    hit = attackRoll({
      abilityScore: score,
      proficient: effect.proficient ?? false,
      level: actor.level ?? 1,
      bonus: effect.attackBonus ?? 0,
      advantage: effect.advantage ?? 0
    }, target.ac ?? 10, random);
  }
  if (!hit.hit) return { type: "miss", attack: hit };
  const damage = resolveDamage({
    expression: effect.dice,
    modifier: effect.modifier ?? 0,
    critical: hit.critical,
    resistance: target.resistances ?? [],
    vulnerability: target.vulnerabilities ?? [],
    immunity: target.immunities ?? []
  }, effect.damageType ?? "untyped", random);
  return { type: "damage", amount: damage.damage, damageType: damage.damageType, attack: hit, rolls: damage.rolls };
}

/**
 * Execute an authored class/weapon ability. This resolver handles generic
 * attack, save, damage, healing and condition effects; ability-specific rules
 * remain data/handler work. It is intended to run on the authoritative server.
 */
export function useClassAbility({ actor, targets, ability, random = Math.random }) {
  validateAbility(ability);
  if (!actor || typeof actor !== "object") throw new TypeError("Ability user is required");
  if (!Array.isArray(targets) || targets.length === 0) return { ok: false, reason: "target_required" };
  const actionCost = ability.actionCost ?? "action";
  const actionCheck = canPayAction(actor, actionCost);
  if (!actionCheck.ok) return actionCheck;
  const resourceCheck = canPayResources(actor, ability.resourceCosts ?? []);
  if (!resourceCheck.ok) return resourceCheck;

  const eligibleTargets = targets.filter(target => target && !target.defeated);
  if (eligibleTargets.length !== targets.length) return { ok: false, reason: "invalid_target" };
  const staged = [];
  for (const target of eligibleTargets) {
    const attackEffect = ability.effects.find(effect => effect.type === "damage" && !effect.save);
    const attack = attackEffect
      ? attackRoll({
          abilityScore: actor.abilities?.[attackEffect.attackAbility ?? "str"] ?? 10,
          proficient: attackEffect.proficient ?? false,
          level: actor.level ?? 1,
          bonus: attackEffect.attackBonus ?? 0,
          advantage: attackEffect.advantage ?? 0
        }, target.ac ?? 10, random)
      : null;
    staged.push({
      target,
      effects: ability.effects.map(effect => planEffect({ actor, target, effect, attack: effect === attackEffect ? attack : null, random }))
    });
  }

  if (actionCost !== "none" && !spendTurnResource(actor, actionCost)) {
    return { ok: false, reason: "action_unavailable", actionCost };
  }
  const spent = [];
  for (const cost of ability.resourceCosts ?? []) {
    const result = spendClassResource(actor, cost.resourceId, cost.amount);
    if (!result.ok) {
      // Resource balances are prevalidated above; this protects against state mutation by custom adapters.
      for (const prior of spent) actor.classResources[prior.resourceId].remaining += prior.amount;
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
        entry.target.hp = Math.min(entry.target.maxHp ?? before, before + effect.amount);
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
