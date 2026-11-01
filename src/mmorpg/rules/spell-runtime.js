import { spellAttackBonus, savingThrow, setConcentration, spendSpellSlot } from "./spellcasting.js";
import { resolveDamage, applyDamage } from "./combat.js";
import { rollDice } from "./dice.js";
import { addCondition, CONDITIONS } from "./conditions.js";
import { spendTurnResource } from "./encounter.js";

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
export function castSpell({ caster, targets, spell, slotLevel = spell?.level ?? 0, random = Math.random }) {
  if (!caster || !spell?.id || !Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9 ||
      !Number.isInteger(slotLevel) || slotLevel < spell.level || slotLevel > 9 ||
      !Array.isArray(targets) || targets.length < 1) {
    return { ok: false, reason: "invalid_cast_request" };
  }
  if (spell.damage && !validDice(spell.damage) || spell.healing && !validDice(spell.healing) ||
      spell.damagePerSlotLevel && !validDice(spell.damagePerSlotLevel)) {
    return { ok: false, reason: "invalid_spell_dice" };
  }
  if (spell.saveAbility && !["str","dex","con","int","wis","cha"].includes(spell.saveAbility)) {
    return { ok: false, reason: "invalid_save_ability" };
  }
  const state = caster.spellState;
  if (spell.level > 0 && (!state || !Array.isArray(state.slots))) return { ok: false, reason: "no_spell_slots" };
  if (state && state.known?.length && !state.known.includes(spell.id) &&
      !(state.prepared ?? []).includes(spell.id)) return { ok: false, reason: "spell_not_known_or_prepared" };

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
  if (spell.level > 0) {
    const slot = state.slots[slotLevel - 1];
    if (!slot || slot.remaining < 1) return { ok: false, reason: "slot_unavailable" };
  }
  const abilityScore = caster.spellcastingAbilityScore ?? caster.abilities?.[caster.spellcastingAbility];
  const proficiency = caster.proficiencyBonus ?? 2;
  if ((spell.attack || spell.saveAbility) && !Number.isFinite(abilityScore)) {
    return { ok: false, reason: "missing_spellcasting_ability" };
  }

  if (spell.level > 0 && !spendSpellSlot(state, slotLevel)) return { ok: false, reason: "slot_unavailable" };
  if (actionCost !== "none" && caster.actionAvailable !== undefined) {
    const resource = actionCost === "action" ? "action" : actionCost;
    if (!spendTurnResource(caster, resource)) {
      if (spell.level > 0) state.slots[slotLevel - 1].remaining++;
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
        expression, modifier: 0,
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
      target.hp = Math.min(target.maxHp ?? Number.POSITIVE_INFINITY, target.hp + rollHealing(spell.healing, random));
      healing = target.hp - hpBefore;
    }
    if (!save?.success && spell.condition) {
      addCondition(target, spell.condition, { duration: spell.conditionDuration ?? null, source: caster.id ?? null });
      conditionApplied = spell.condition;
    }
    results.push({ targetId: target.id ?? null, hit, save, damage, healing, conditionApplied, remainingHp: target.hp });
  }

  if (spell.concentration && state) setConcentration(state, spell.id);
  return { ok: true, spellId: spell.id, slotLevel, actionCost, results, concentration: spell.concentration ? spell.id : null };
}

function spellSaveDC(caster) {
  const abilityScore = caster.spellcastingAbilityScore ?? caster.abilities?.[caster.spellcastingAbility];
  const proficiency = caster.proficiencyBonus ?? 2;
  return 8 + Math.floor((abilityScore - 10) / 2) + proficiency + (caster.spellSaveBonus ?? 0);
}
