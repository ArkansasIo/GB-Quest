const MODES = new Set(["known", "prepared"]);

function ensureState(character) {
  if (!character?.spellState || typeof character.spellState !== "object") {
    throw new TypeError("Character spellState is required");
  }
  const state = character.spellState;
  if (!Array.isArray(state.known)) state.known = [];
  if (!Array.isArray(state.prepared)) state.prepared = [];
  return state;
}

function normalizePolicy(policy) {
  if (!policy || !MODES.has(policy.mode)) throw new TypeError("Spell access policy mode must be known or prepared");
  if (!Array.isArray(policy.allowedSpellIds)) throw new TypeError("Spell access policy requires allowedSpellIds");
  for (const id of policy.allowedSpellIds) {
    if (typeof id !== "string" || !id.trim()) throw new TypeError("Allowed spell IDs must be non-empty strings");
  }
  for (const key of ["maxKnown", "maxPrepared"]) {
    if (policy[key] !== undefined && (!Number.isInteger(policy[key]) || policy[key] < 0)) {
      throw new RangeError(`${key} must be a non-negative integer`);
    }
  }
  return policy;
}

/** Attach class/ruleset-specific access metadata supplied by the data layer. */
export function configureSpellAccess(character, policy) {
  const state = ensureState(character);
  state.accessPolicy = { ...normalizePolicy(policy), allowedSpellIds: [...new Set(policy.allowedSpellIds)] };
  state.known = state.known.filter(id => state.accessPolicy.allowedSpellIds.includes(id));
  state.prepared = state.prepared.filter(id => state.accessPolicy.allowedSpellIds.includes(id));
  return state.accessPolicy;
}

export function learnSpell(character, spellId) {
  const state = ensureState(character);
  const policy = normalizePolicy(state.accessPolicy);
  if (!policy.allowedSpellIds.includes(spellId)) return { ok: false, reason: "spell_not_available_to_class" };
  if (state.known.includes(spellId)) return { ok: false, reason: "already_known" };
  if (Number.isInteger(policy.maxKnown) && state.known.length >= policy.maxKnown) return { ok: false, reason: "known_spell_limit" };
  state.known.push(spellId);
  return { ok: true, spellId };
}

export function prepareSpell(character, spellId) {
  const state = ensureState(character);
  const policy = normalizePolicy(state.accessPolicy);
  if (!policy.allowedSpellIds.includes(spellId)) return { ok: false, reason: "spell_not_available_to_class" };
  if (policy.mode === "known" && !state.known.includes(spellId)) return { ok: false, reason: "spell_not_known" };
  if (state.prepared.includes(spellId)) return { ok: false, reason: "already_prepared" };
  if (Number.isInteger(policy.maxPrepared) && state.prepared.length >= policy.maxPrepared) return { ok: false, reason: "prepared_spell_limit" };
  state.prepared.push(spellId);
  return { ok: true, spellId };
}

export function unprepareSpell(character, spellId) {
  const state = ensureState(character);
  const index = state.prepared.indexOf(spellId);
  if (index < 0) return { ok: false, reason: "spell_not_prepared" };
  state.prepared.splice(index, 1);
  return { ok: true, spellId };
}

export function canCastSpell(character, spellId) {
  const state = character?.spellState;
  if (!state) return { ok: false, reason: "no_spell_state" };
  if (!state.accessPolicy) {
    const unrestricted = !state.known?.length && !state.prepared?.length;
    return unrestricted || state.known?.includes(spellId) || state.prepared?.includes(spellId)
      ? { ok: true } : { ok: false, reason: "spell_not_known_or_prepared" };
  }
  const policy = normalizePolicy(state.accessPolicy);
  if (!policy.allowedSpellIds.includes(spellId)) return { ok: false, reason: "spell_not_available_to_class" };
  if (policy.mode === "known" && !state.known.includes(spellId)) return { ok: false, reason: "spell_not_known" };
  if (policy.mode === "prepared" && !state.prepared.includes(spellId)) return { ok: false, reason: "spell_not_prepared" };
  return { ok: true };
}
