import { spellAttackBonus, setConcentration, spendSpellSlot } from "./spellcasting.js";
import { resolveDamage, applyDamage, savingThrow } from "./combat.js";
import { rollDice } from "./dice.js";
import { abilityModifier } from "./d20.js";
import { addCondition, CONDITIONS } from "./conditions.js";
import { spendTurnResource } from "./encounter.js";
import { canCastSpell } from "./spell-access.js";

function distanceBetween(a, b) {
  if (!a?.position || !b?.position) return null;
  const dx = (a.position.x ?? 0) - (b.position.x ?? 0);
  const dy = (a.position.y ?? 0) - (b.position.y ?? 0);
  const dz = (a.position.z ?? 0) - (b.position.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function validDice(value) {
  if (typeof value !== "string") return false;
  try { rollDice(value, () => 0); return true; } catch { return false; }
}
function rollHealing(expression, random) {
  return rollDice(expression, random).total;
}

const SPELL_EFFECT_TYPES = new Set([
  "damage", "healing", "control", "ward", "summoning", "movement",
  "divination", "transformation", "utility"
]);

export function effectiveArmorClass(entity) {
  const base = Number.isFinite(entity?.ac) ? entity.ac : 10;
  const bonus = (entity?.spellEffects || []).reduce((total, effect) =>
    total + (effect.type === "ward" && effect.subtype === "armor" && effect.durationRounds > 0 ? effect.amount : 0), 0);
  return base + bonus;
}

export function tickSpellEffects(entity, rounds = 1) {
  if (!entity || !Number.isInteger(rounds) || rounds < 1) throw new RangeError("Entity and positive round count are required");
  entity.spellEffects = (entity.spellEffects || []).map(effect => ({
    ...effect,
    durationRounds: effect.durationRounds === null ? null : effect.durationRounds - rounds
  })).filter(effect => effect.durationRounds === null || effect.durationRounds > 0);
  entity.summons = (entity.summons || []).map(summon => ({
    ...summon,
    durationRounds: summon.durationRounds - rounds
  })).filter(summon => summon.durationRounds > 0);
  entity.transformations = (entity.transformations || []).map(form => ({
    ...form,
    durationRounds: form.durationRounds - rounds
  })).filter(form => form.durationRounds > 0);
  entity.spellSenses = (entity.spellSenses || []).map(sense => ({
    ...sense,
    durationRounds: sense.durationRounds - rounds
  })).filter(sense => sense.durationRounds > 0);
  return entity;
}

/**
 * Resolve a data-driven spell record against one or more targets.
 * Spell records are supplied by the SRD data/catalog layer or game content;
 * this runtime deliberately does not invent spell descriptions or class lists.
 *
 * Supported spell fields:
 * id, level, rangeFeet, actionCost, attack (boolean), saveAbility,
 * damage, damageType, healing, condition, conditionDuration,
 * saveForHalf, concentration, damagePerSlotLevel.
 */
export function castSpell({
  caster, targets, spell, slotLevel = spell?.level ?? 0, random = Math.random,
  consumeSlot = true, source = "known"
}) {
  if (!caster || !spell?.id || !Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9 ||
      !Number.isInteger(slotLevel) || slotLevel < spell.level || slotLevel > 9 ||
      !Array.isArray(targets) || targets.length < 1 || typeof consumeSlot !== "boolean" ||
      !["known", "scroll"].includes(source)) {
    return { ok: false, reason: "invalid_cast_request" };
  }
  if (spell.damage && !validDice(spell.damage) || spell.healing && !validDice(spell.healing) ||
      spell.damagePerSlotLevel && !validDice(spell.damagePerSlotLevel) ||
      spell.healingPerSlotLevel && !validDice(spell.healingPerSlotLevel)) {
    return { ok: false, reason: "invalid_spell_dice" };
  }
  const effect = spell.effect || (spell.type ? { type: spell.type, subtype: spell.subtype, durationRounds: spell.subStats?.durationRounds } : null);
  if (effect && !SPELL_EFFECT_TYPES.has(effect.type)) return { ok: false, reason: "invalid_spell_effect" };
  if (effect && (!Number.isInteger(effect.durationRounds) || effect.durationRounds < 1)) return { ok: false, reason: "invalid_spell_effect_duration" };
  if (spell.saveAbility && !["str","dex","con","int","wis","cha"].includes(spell.saveAbility)) {
    return { ok: false, reason: "invalid_save_ability" };
  }
  const state = caster.spellState;
  if (consumeSlot && spell.level > 0 && (!state || !Array.isArray(state.slots))) return { ok: false, reason: "no_spell_slots" };
  if (source !== "scroll" && state) {
    const access = canCastSpell(caster, spell.id);
    if (!access.ok) return access;
  }

  if (spell.condition && !CONDITIONS[spell.condition]) return { ok: false, reason: "invalid_condition" };
  if (spell.conditionDuration !== undefined && spell.conditionDuration !== null && (!Number.isFinite(spell.conditionDuration) || spell.conditionDuration <= 0)) return { ok: false, reason: "invalid_condition_duration" };
  const actionCost = spell.actionCost ?? "action";
  if (actionCost !== "none" && !["action","bonusAction","reaction"].includes(actionCost)) {
    return { ok: false, reason: "invalid_action_cost" };
  }
  if (actionCost !== "none" && caster.actionAvailable !== undefined && caster[actionCost === "action" ? "actionAvailable" : actionCost === "bonusAction" ? "bonusActionAvailable" : "reactionAvailable"] === false) {
    return { ok: false, reason: "action_unavailable" };
  }
  if (targets.some(target => !target || !Number.isFinite(target.hp) || target.hp <= 0)) {
    return { ok: false, reason: "invalid_target" };
  }
  if (Number.isFinite(spell.rangeFeet)) {
    for (const target of targets) {
      const distance = distanceBetween(caster, target);
      if (distance !== null && distance > spell.rangeFeet) return { ok: false, reason: "out_of_range" };
    }
  }

  // Validate all stateful costs before mutating either action economy or spell slots.
  if (consumeSlot && spell.level > 0) {
    const slot = state.slots[slotLevel - 1];
    if (!slot || slot.remaining < 1) return { ok: false, reason: "slot_unavailable" };
  }
  const abilityScore = caster.spellcastingAbilityScore ?? caster.abilities?.[caster.spellcastingAbility];
  const proficiency = caster.proficiencyBonus ?? 2;
  if ((spell.attack || spell.saveAbility) && !Number.isFinite(abilityScore)) {
    return { ok: false, reason: "missing_spellcasting_ability" };
  }

  if (consumeSlot && spell.level > 0 && !spendSpellSlot(state, slotLevel)) return { ok: false, reason: "slot_unavailable" };
  if (actionCost !== "none" && caster.actionAvailable !== undefined) {
    const resource = actionCost === "action" ? "action" : actionCost;
    if (!spendTurnResource(caster, resource)) {
      if (consumeSlot && spell.level > 0) state.slots[slotLevel - 1].remaining++;
      return { ok: false, reason: "action_unavailable" };
    }
  }

  const results = [];
  for (const target of targets) {
    let hit = true, attackDie = null, save = null, damage = 0, healing = 0, conditionApplied = null;
    if (spell.attack) {
      const bonus = spellAttackBonus({ abilityScore, proficiency, bonus: caster.spellAttackBonus ?? 0 });
      const roll = random();
      if (!(roll >= 0 && roll < 1)) return { ok: false, reason: "invalid_random_source" };
      attackDie = 1 + Math.floor(roll * 20);
      hit = attackDie === 20 || (attackDie !== 1 && attackDie + bonus >= (target.ac ?? 10));
      if (!hit) { results.push({ targetId: target.id ?? null, hit: false, damage: 0, healing: 0 }); continue; }
    } else if (spell.saveAbility) {
      save = savingThrow({
        abilityScore: target.abilities?.[spell.saveAbility] ?? 10,
        proficient: target.savingThrowProficiencies?.includes(spell.saveAbility) ?? false,
        level: target.level ?? 1,
        dc: spellSaveDC(caster),
        advantage: 0
      }, random);
    }

    if (spell.damage) {
      const expression = spell.damage;
      const base = resolveDamage({
        expression, modifier: spell.damageModifier ?? 0,
        critical: !!spell.attack && hit && attackDie === 20,
        resistance: target.resistances ?? [],
        vulnerability: target.vulnerabilities ?? [],
        immunity: target.immunities ?? []
      }, spell.damageType ?? "force", random);
      damage = base.damage;
      if (save?.success) damage = spell.saveForHalf ? Math.floor(damage / 2) : 0;
      if (slotLevel > spell.level && spell.damagePerSlotLevel) {
        const extra = rollDice(spell.damagePerSlotLevel, random).total * (slotLevel - spell.level);
        damage += save?.success ? (spell.saveForHalf ? Math.floor(extra / 2) : 0) : extra;
      }
      applyDamage(target, damage, spell.damageType ?? "force");
    }
    if (!save?.success && spell.healing) {
      const hpBefore = target.hp;
      const healingBonus = Number.isFinite(spell.healingModifier) ? spell.healingModifier :
        spell.addSpellcastingModifier ? abilityModifier(abilityScore) : 0;
      const baseHealing = rollHealing(spell.healing, random);
      const extraHealing = slotLevel > spell.level && spell.healingPerSlotLevel
        ? rollHealing(spell.healingPerSlotLevel, random) * (slotLevel - spell.level) : 0;
      target.hp = Math.min(target.maxHp ?? Number.POSITIVE_INFINITY, target.hp + baseHealing + extraHealing + healingBonus);
      healing = target.hp - hpBefore;
    }
    if (!save?.success && spell.condition) {
      addCondition(target, spell.condition, { duration: spell.conditionDuration ?? null, source: caster.id ?? null });
      conditionApplied = spell.condition;
    }
    let effectApplied = null;
    if (!save?.success && effect) {
      if (effect.type === "ward") {
        target.spellEffects ||= [];
        if (Number.isInteger(spell.armorClassBonus) && spell.armorClassBonus > 0) {
          target.spellEffects.push({ spellId: spell.id, type: "ward", subtype: "armor", amount: spell.armorClassBonus, durationRounds: effect.durationRounds });
        }
        if (Number.isInteger(spell.temporaryHitPoints) && spell.temporaryHitPoints > 0) {
          target.temporaryHitPoints = Math.max(target.temporaryHitPoints || 0, spell.temporaryHitPoints);
        }
      } else if (effect.type === "summoning") {
        caster.summons ||= [];
        if (!caster.summons.some(summon => summon.spellId === spell.id)) {
          caster.summons.push({ spellId: spell.id, subtype: effect.subtype, durationRounds: effect.durationRounds });
        }
      } else if (effect.type === "divination") {
        target.spellSenses ||= [];
        target.spellSenses.push({ spellId: spell.id, sense: effect.subtype, durationRounds: effect.durationRounds });
      } else if (effect.type === "transformation") {
        target.transformations ||= [];
        target.transformations.push({ spellId: spell.id, form: effect.subtype, durationRounds: effect.durationRounds });
      } else if (effect.type !== "damage" && effect.type !== "healing" && effect.type !== "control") {
        target.spellEffects ||= [];
        target.spellEffects.push({ spellId: spell.id, type: effect.type, subtype: effect.subtype, durationRounds: effect.durationRounds });
      }
      effectApplied = effect.type;
    }
    results.push({ targetId: target.id ?? null, hit, save, damage, healing, conditionApplied, effectApplied, remainingHp: target.hp });
  }

  if (spell.concentration && state) setConcentration(state, spell.id);
  return { ok: true, spellId: spell.id, slotLevel, actionCost, consumeSlot, source, results, concentration: spell.concentration ? spell.id : null };
}

function spellSaveDC(caster) {
  const abilityScore = caster.spellcastingAbilityScore ?? caster.abilities?.[caster.spellcastingAbility];
  const proficiency = caster.proficiencyBonus ?? 2;
  return 8 + Math.floor((abilityScore - 10) / 2) + proficiency + (caster.spellSaveBonus ?? 0);
}
