'use strict';

// Socketable gems. This module is loaded after items.js and before runtime play begins.
const GEM_TYPES = {
  ruby: { name: 'RUBY', stat: 'dmg', label: 'Weapon damage', base: 1 },
  sapphire: { name: 'SAPPHIRE', stat: 'resist', label: 'All resistance', base: 1 },
  emerald: { name: 'EMERALD', stat: 'hit', label: 'Attack rating', base: 1 },
  amethyst: { name: 'AMETHYST', stat: 'hp', label: 'Maximum health', base: 5 },
  topaz: { name: 'TOPAZ', stat: 'haste', label: 'Haste', base: 1 },
  diamond: { name: 'DIAMOND', stat: 'saves', label: 'Saving throws', base: 1 },
  onyx: { name: 'ONYX', stat: 'crit', label: 'Critical chance', base: 1 },
  opal: { name: 'OPAL', stat: 'mf', label: 'Magic find', base: 1 },
  garnet: { name: 'GARNET', stat: 'leech', label: 'Life leech', base: 1 },
};
const GEM_TIER_MAX = 9;
const GEM_SOCKET_LIMIT = 4;
function gemDefinition(id) {
  const m = /^([a-z]+)_t([1-9])$/.exec(String(id || ''));
  if (!m || !GEM_TYPES[m[1]]) return null;
  const type = GEM_TYPES[m[1]], tier = Number(m[2]);
  return { id: m[1] + '_t' + tier, type: m[1], name: 'T' + tier + ' ' + type.name, tier, stat: type.stat, label: type.label, value: type.base * tier };
}
function gemSocketCapacity(item) {
  if (!item || !['weapon', 'armor'].includes(item.kind)) return 0;
  const level = Math.max(1, Math.min(720, Number(item.ilvl) || 1));
  return Math.min(GEM_SOCKET_LIMIT, 1 + Math.floor((level - 1) / 180));
}
function normalizeGemSockets(item) {
  const capacity = gemSocketCapacity(item);
  if (!capacity) return [];
  const current = Array.isArray(item.sockets) ? item.sockets.slice(0, capacity) : [];
  while (current.length < capacity) current.push(null);
  return current;
}
function insertGem(item, gemId, socketIndex) {
  const gem = gemDefinition(gemId), capacity = gemSocketCapacity(item);
  if (!gem) return { ok: false, reason: 'Unknown gem.' };
  if (!capacity) return { ok: false, reason: 'Only weapons and armour can receive gem sockets.' };
  if (!Number.isInteger(socketIndex) || socketIndex < 0 || socketIndex >= capacity) return { ok: false, reason: 'Socket index is outside this item capacity.' };
  const sockets = normalizeGemSockets(item);
  if (sockets[socketIndex]) return { ok: false, reason: 'That socket is already occupied.' };
  sockets[socketIndex] = gem.id;
  return { ok: true, item: { ...item, sockets }, gem: gem.id };
}
function extractGem(item, socketIndex) {
  const capacity = gemSocketCapacity(item);
  if (!capacity || !Number.isInteger(socketIndex) || socketIndex < 0 || socketIndex >= capacity) return { ok: false, reason: 'Invalid socket.' };
  const sockets = normalizeGemSockets(item), gemId = sockets[socketIndex];
  if (!gemId) return { ok: false, reason: 'That socket is empty.' };
  sockets[socketIndex] = null;
  return { ok: true, item: { ...item, sockets }, gem: gemId };
}
function gemAffixes(item) {
  const out = {};
  for (const id of normalizeGemSockets(item)) {
    if (!id) continue;
    const gem = gemDefinition(id);
    if (gem) out[gem.stat] = (out[gem.stat] || 0) + gem.value;
  }
  return out;
}
function addGemToInventory(character, gemId, quantity = 1) {
  if (!character || !gemDefinition(gemId) || !Number.isInteger(quantity) || quantity < 1) return false;
  if (!character.gems || typeof character.gems !== 'object') character.gems = {};
  character.gems[gemId] = (character.gems[gemId] || 0) + quantity;
  return true;
}
function socketGemFromInventory(character, item, gemId, socketIndex) {
  const count = character && character.gems && character.gems[gemId] || 0;
  if (count < 1) return { ok: false, reason: 'You do not have that gem.' };
  const result = insertGem(item, gemId, socketIndex);
  if (!result.ok) return result;
  character.gems[gemId] = count - 1;
  if (!character.gems[gemId]) delete character.gems[gemId];
  return result;
}
function unsocketGemToInventory(character, item, socketIndex) {
  const result = extractGem(item, socketIndex);
  if (!result.ok) return result;
  addGemToInventory(character, result.gem, 1);
  return result;
}

if (typeof globalThis !== 'undefined') globalThis.GBQGems = { GEM_TYPES, gemDefinition, gemSocketCapacity, normalizeGemSockets, insertGem, extractGem, gemAffixes, addGemToInventory, socketGemFromInventory, unsocketGemToInventory };
