export const EQUIPMENT_SLOTS = Object.freeze([
  "head", "neck", "shoulders", "back", "chest", "wrists", "hands", "waist",
  "legs", "feet", "ring1", "ring2", "trinket1", "trinket2", "mainHand", "offHand"
]);

const HAND_SLOTS = new Set(["mainHand", "offHand"]);
const propertiesOf = item => Array.isArray(item?.template?.properties)
  ? item.template.properties
  : Array.isArray(item?.properties) ? item.properties : [];
const isTwoHanded = item => propertiesOf(item).includes("two-handed");
const validLevel = level => Number.isSafeInteger(level) && level >= 1;

export function createEquipment() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null]));
}

function validateLoadout(loadout) {
  if (!loadout || typeof loadout !== "object" || !loadout.equipment ||
      typeof loadout.equipment !== "object" || Array.isArray(loadout.equipment)) {
    return { ok: false, reason: "invalid_loadout" };
  }
  return { ok: true };
}

function validateItemForSlot(loadout, item, slot) {
  if (!item || typeof item !== "object") return { ok: false, reason: "invalid_item" };
  if (!EQUIPMENT_SLOTS.includes(slot)) return { ok: false, reason: "invalid_slot" };
  if (item.slot !== slot) return { ok: false, reason: "slot_mismatch" };
  if (item.requiredLevel != null &&
      (!validLevel(item.requiredLevel) || !validLevel(loadout.level) || item.requiredLevel > loadout.level)) {
    return { ok: false, reason: "level_too_low" };
  }
  if (item.durability != null && (!Number.isFinite(item.durability) || item.durability <= 0)) {
    return { ok: false, reason: "broken_item" };
  }
  if (item.allowedClasses && (!Array.isArray(item.allowedClasses) ||
      !item.allowedClasses.includes(loadout.classId ?? loadout.class))) {
    return { ok: false, reason: "class_restricted" };
  }
  if (item.allowedRaces && (!Array.isArray(item.allowedRaces) ||
      !item.allowedRaces.includes(loadout.raceId ?? loadout.race))) {
    return { ok: false, reason: "race_restricted" };
  }
  return { ok: true };
}

export function equipItem(loadout, item) {
  const valid = validateLoadout(loadout);
  if (!valid.ok) return valid;
  const slot = item?.slot;
  const check = validateItemForSlot(loadout, item, slot);
  if (!check.ok) return check;

  const displaced = [];
  if (slot === "mainHand" && isTwoHanded(item) && loadout.equipment.offHand) {
    displaced.push({ slot: "offHand", item: loadout.equipment.offHand });
  }
  if (slot === "offHand" && isTwoHanded(loadout.equipment.mainHand)) {
    return { ok: false, reason: "main_hand_requires_both_hands" };
  }

  const previous = loadout.equipment[slot] ?? null;
  loadout.equipment[slot] = item;
  for (const entry of displaced) loadout.equipment[entry.slot] = null;
  return { ok: true, previous, displaced };
}

export function unequipItem(loadout, slot) {
  const valid = validateLoadout(loadout);
  if (!valid.ok) return valid;
  if (!EQUIPMENT_SLOTS.includes(slot)) return { ok: false, reason: "invalid_slot" };
  const item = loadout.equipment[slot] ?? null;
  if (!item) return { ok: false, reason: "empty_slot" };
  loadout.equipment[slot] = null;
  return { ok: true, item };
}

export function canEquipItem(loadout, item) {
  const valid = validateLoadout(loadout);
  if (!valid.ok) return valid;
  const check = validateItemForSlot(loadout, item, item?.slot);
  if (!check.ok) return check;
  if (item.slot === "offHand" && isTwoHanded(loadout.equipment.mainHand)) {
    return { ok: false, reason: "main_hand_requires_both_hands" };
  }
  return { ok: true };
}

export function calculateGearStats(loadout) {
  const valid = validateLoadout(loadout);
  if (!valid.ok) throw new TypeError("Valid equipment loadout required");
  return Object.values(loadout.equipment).filter(item =>
    item && (item.durability == null || item.durability > 0)
  ).reduce((out, item) => {
    for (const [key, value] of Object.entries(item.stats ?? {})) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError("Equipped item stats must contain finite numbers");
      }
      out[key] = (out[key] ?? 0) + value;
    }
    return out;
  }, {});
}
