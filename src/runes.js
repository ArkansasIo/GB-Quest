'use strict';

// Rune catalog and deterministic equipment socket operations.
const RUNE_TYPES = {
  flame: { name: 'FLAME', stat: 'fire', label: 'Fire damage', base: 2 },
  frost: { name: 'FROST', stat: 'cold', label: 'Cold damage', base: 2 },
  storm: { name: 'STORM', stat: 'lightning', label: 'Lightning damage', base: 2 },
  ward: { name: 'WARD', stat: 'resist', label: 'All resistance', base: 1 },
  vigor: { name: 'VIGOR', stat: 'hp', label: 'Maximum health', base: 5 },
  might: { name: 'MIGHT', stat: 'dmg', label: 'Weapon damage', base: 1 },
  precision: { name: 'PRECISION', stat: 'hit', label: 'Attack rating', base: 1 },
  shadow: { name: 'SHADOW', stat: 'crit', label: 'Critical chance', base: 1 },
  leech: { name: 'LEECH', stat: 'leech', label: 'Life leech', base: 1 },
};
const RUNE_TIER_MAX = 9;
const RUNE_SOCKET_LIMIT = 3;
function runeDefinition(id) {
  const m = /^([a-z]+)_r([1-9])$/.exec(String(id || ''));
  if (!m || !RUNE_TYPES[m[1]]) return null;
  const type = RUNE_TYPES[m[1]], tier = Number(m[2]);
  return { id: m[1] + '_r' + tier, type: m[1], name: 'R' + tier + ' ' + type.name, tier, stat: type.stat, label: type.label, value: type.base * tier };
}
function runeSocketCapacity(item) {
  if (!item || !['weapon', 'armor'].includes(item.kind)) return 0;
  const level = Math.max(1, Math.min(720, Number(item.ilvl) || 1));
  return Math.min(RUNE_SOCKET_LIMIT, 1 + Math.floor((level - 1) / 240));
}
function normalizeRuneSockets(item) {
  const capacity = runeSocketCapacity(item);
  if (!capacity) return [];
  const sockets = Array.isArray(item.runeSockets) ? item.runeSockets.slice(0, capacity) : [];
  while (sockets.length < capacity) sockets.push(null);
  return sockets;
}
function insertRune(item, runeId, index) {
  const rune = runeDefinition(runeId), capacity = runeSocketCapacity(item);
  if (!rune) return { ok: false, reason: 'Unknown rune.' };
  if (!capacity) return { ok: false, reason: 'Only weapons and armour can receive runes.' };
  if (!Number.isInteger(index) || index < 0 || index >= capacity) return { ok: false, reason: 'Rune socket index is invalid.' };
  const sockets = normalizeRuneSockets(item);
  if (sockets[index]) return { ok: false, reason: 'That rune socket is occupied.' };
  sockets[index] = rune.id;
  return { ok: true, item: { ...item, runeSockets: sockets }, rune: rune.id };
}
function extractRune(item, index) {
  const capacity = runeSocketCapacity(item);
  if (!capacity || !Number.isInteger(index) || index < 0 || index >= capacity) return { ok: false, reason: 'Invalid rune socket.' };
  const sockets = normalizeRuneSockets(item), rune = sockets[index];
  if (!rune) return { ok: false, reason: 'That rune socket is empty.' };
  sockets[index] = null;
  return { ok: true, item: { ...item, runeSockets: sockets }, rune };
}
function runeAffixes(item) {
  const out = {};
  for (const id of normalizeRuneSockets(item)) {
    const rune = id && runeDefinition(id);
    if (rune) out[rune.stat] = (out[rune.stat] || 0) + rune.value;
  }
  return out;
}
function addRuneToInventory(character, id, quantity = 1) {
  if (!character || !runeDefinition(id) || !Number.isInteger(quantity) || quantity < 1) return false;
  if (!character.runes || typeof character.runes !== 'object') character.runes = {};
  character.runes[id] = (character.runes[id] || 0) + quantity;
  return true;
}
function socketRuneFromInventory(character, item, id, index) {
  const count = character && character.runes && character.runes[id] || 0;
  if (count < 1) return { ok: false, reason: 'You do not own that rune.' };
  const result = insertRune(item, id, index);
  if (!result.ok) return result;
  character.runes[id] = count - 1;
  if (!character.runes[id]) delete character.runes[id];
  return result;
}
function unsocketRuneToInventory(character, item, index) {
  const result = extractRune(item, index);
  if (!result.ok) return result;
  addRuneToInventory(character, result.rune, 1);
  return result;
}
if (typeof globalThis !== 'undefined') globalThis.GBQRunes = { RUNE_TYPES, runeDefinition, runeSocketCapacity, normalizeRuneSockets, insertRune, extractRune, runeAffixes, addRuneToInventory, socketRuneFromInventory, unsocketRuneToInventory };
