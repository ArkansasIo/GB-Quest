const RECOVERY_TRIGGERS = new Set(["short_rest", "long_rest", "turn", "manual", "never"]);

function validateLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new RangeError("Class resource level must be an integer from 1 to 20");
  }
}

function resolveMaximum(maximum, level) {
  const value = Array.isArray(maximum) ? maximum[level - 1] : maximum;
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError("Resource maximum must resolve to a non-negative integer for this level");
  }
  return value;
}

function normalizeDefinition(definition, level) {
  if (!definition || typeof definition.id !== "string" || !definition.id.trim()) {
    throw new TypeError("Every class resource requires a stable id");
  }
  const recovery = definition.recovery ?? "long_rest";
  if (!RECOVERY_TRIGGERS.has(recovery)) throw new TypeError(`Unsupported recovery trigger: ${recovery}`);
  const maximum = resolveMaximum(definition.max, level);
  return {
    id: definition.id,
    name: definition.name ?? definition.id,
    maximum,
    recovery,
    spendable: definition.spendable !== false
  };
}

/**
 * Configure class resources from authored class data.
 *
 * Definitions are data-driven; max may be a constant or a 1-20 level array.
 * Existing remaining uses are preserved up to the new maximum on reconfigure.
 */
export function configureClassResources(character, definitions, classLevel) {
  if (!character || typeof character !== "object") throw new TypeError("Character state is required");
  if (!Array.isArray(definitions)) throw new TypeError("Class resource definitions must be an array");
  validateLevel(classLevel);
  const normalized = definitions.map(item => normalizeDefinition(item, classLevel));
  if (new Set(normalized.map(item => item.id)).size !== normalized.length) {
    throw new TypeError("Class resource IDs must be unique");
  }

  const previous = character.classResources ?? {};
  const next = {};
  for (const definition of normalized) {
    const old = previous[definition.id];
    const remaining = Number.isInteger(old?.remaining)
      ? Math.min(old.remaining, definition.maximum)
      : definition.maximum;
    next[definition.id] = { ...definition, remaining };
  }
  character.classResources = next;
  character.classResourceLevel = classLevel;
  return getClassResourceStatus(character);
}

function getResource(character, resourceId) {
  const resource = character?.classResources?.[resourceId];
  if (!resource) return null;
  return resource;
}

export function spendClassResource(character, resourceId, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1) throw new RangeError("Resource spend amount must be a positive integer");
  const resource = getResource(character, resourceId);
  if (!resource) return { ok: false, reason: "resource_not_found" };
  if (!resource.spendable) return { ok: false, reason: "resource_not_spendable" };
  if (resource.remaining < amount) return { ok: false, reason: "insufficient_resource" };
  resource.remaining -= amount;
  return { ok: true, resourceId, spent: amount, remaining: resource.remaining };
}

export function recoverClassResources(character, trigger) {
  if (!RECOVERY_TRIGGERS.has(trigger) || trigger === "never" || trigger === "manual") {
    return { ok: false, reason: "invalid_recovery_trigger" };
  }
  const recovered = [];
  for (const [resourceId, resource] of Object.entries(character?.classResources ?? {})) {
    if (resource.recovery !== trigger) continue;
    const amount = resource.maximum - resource.remaining;
    if (amount > 0) {
      resource.remaining = resource.maximum;
      recovered.push({ resourceId, amount, remaining: resource.remaining });
    }
  }
  return { ok: true, trigger, recovered };
}

export function restoreClassResource(character, resourceId, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1) throw new RangeError("Resource restore amount must be a positive integer");
  const resource = getResource(character, resourceId);
  if (!resource) return { ok: false, reason: "resource_not_found" };
  const restored = Math.min(amount, resource.maximum - resource.remaining);
  resource.remaining += restored;
  return { ok: true, resourceId, restored, remaining: resource.remaining };
}

export function getClassResourceStatus(character) {
  const resources = Object.values(character?.classResources ?? {}).map(resource => ({
    id: resource.id,
    name: resource.name,
    maximum: resource.maximum,
    remaining: resource.remaining,
    recovery: resource.recovery,
    spendable: resource.spendable
  }));
  return { classLevel: character?.classResourceLevel ?? null, resources };
}
