'use strict';
// ================================================================ NPC ART: role sprites for townsfolk (tools/gen_npcs.py)
// Each service NPC and profession trainer is drawn with its own role sprite (gh_npc_<role>_*): merchants with a
// satchel, guards with helm and spear, the innkeeper with a mug, smiths with apron and hammer, the oracle hooded
// with an orb staff, and so on. The REALM STONE is a glowing crystal. Standing NPCs blink now and then.
// Falls back to the old villager looks when a role sprite is missing (painted-tile mode keeps its own art).

const NPC_SVC_ROLE = {
  auction: 'auctioneer', bank: 'banker', inn: 'innkeeper', trainer: 'trainer', guild: 'guildmaster', vendor: 'merchant', honor: 'quartermaster',
  lfg: 'herald', difficulty: 'oracle', tower: 'spirekeeper', trials: 'trialsmaster', portal: 'harbormaster', server: 'realmstone', stable: 'stablemaster',
  arena: 'arenamaster', housing: 'steward', warden: 'warden', elder: 'elder', blacksmith: 'blacksmith', armorsmith: 'armorer', weaponsmith: 'weaponsmith',
  curator: 'curator', craftmaster: 'craftmaster',
};
const NPC_PROF_ROLE = {
  herb: 'herbalist', mining: 'miner', forestry: 'forester', hidecraft: 'hunter', fish: 'fisher', salvaging: 'salvager', relic: 'curator', cultivation: 'farmer',
  beast_lore: 'beastmaster', alch: 'alchemist', cook: 'cook', blacksmith: 'craftmaster', armorsmith: 'armorer', weaponsmith: 'weaponsmith', tailoring: 'tailor',
  leatherwork: 'leatherworker', jewelcraft: 'jeweller', enchanting: 'enchanter',
};
const NPC_NAME_ROLE = [[/DOCKHAND/, 'dockhand'], [/FISHMONGER/, 'fisher'], [/GUARD/, 'guard'], [/MERCHANT/, 'merchant']];
const NPC_FOLK = ['townsman', 'townswoman', 'noble', 'child'];
const npcHash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
let AP_WORLD_NPCS = null;
let AP_WORLD_CHARACTERS = null;
// The pack's people are large painted figures; shrunk to a 16px field sprite they turn into gray, muddy blobs.
// FULL DETAIL keeps the game's own coloured walkers and townsfolk in the field (pack art is still used for
// portraits, item icons, monsters and battle scenes). S.packField = true brings the old swap back.
const packFieldOn = () => S.art === 'packs' && S.packField === true;
function assetPackCharacter(character, dir = 'down', ghost = false) {
  if (!packFieldOn()) return null;
  AP_WORLD_CHARACTERS ||= Object.keys(IMG).filter(name => /^ap_characters_\d+$/.test(name)).sort();
  if (!AP_WORLD_CHARACTERS.length) return null;
  const key = [character && character.cls, character && character.species, character && character.look].join('|');
  const name = AP_WORLD_CHARACTERS[npcHash(key) % AP_WORLD_CHARACTERS.length];
  return IMG[name] ? spr(name, 16, 32, { flip: dir === 'left', ghost }) : null;
}
function assetPackNpc(e) {
  if (!packFieldOn()) return null;
  AP_WORLD_NPCS ||= Object.keys(IMG).filter(name => /^ap_npcs_\d+$/.test(name)).sort();
  AP_WORLD_CHARACTERS ||= Object.keys(IMG).filter(name => /^ap_characters_\d+$/.test(name)).sort();
  const pool = AP_WORLD_NPCS.length ? AP_WORLD_NPCS : AP_WORLD_CHARACTERS;
  if (!pool.length) return null;
  const name = pool[npcHash(e && (e.name || e.spr) || '') % pool.length];
  return IMG[name] ? spr(name, 16, 32) : null;
}
function npcRole(e) {
  if (!e) return null;
  if (e.prof && NPC_PROF_ROLE[e.prof]) return NPC_PROF_ROLE[e.prof];
  for (const [re, role] of NPC_NAME_ROLE) if (re.test(String(e.name || ''))) return role;
  if (e.svc && NPC_SVC_ROLE[e.svc]) return NPC_SVC_ROLE[e.svc];
  return NPC_FOLK[npcHash(e.name || e.spr || '') % NPC_FOLK.length];
}
// the sprite for an NPC this frame: role art when present (blinking every few seconds), else the old look
function npcSprite(e) {
  const packSprite = assetPackNpc(e);
  if (packSprite) return packSprite;
  const role = npcRole(e), base = `gh_npc_${role}`;
  const t = (frameN + npcHash(e.name || '') % 240) % 240, blink = role === 'realmstone' ? (frameN >> 4) % 2 === 1 : t < 7;
  const retro = typeof retroNpcArt === 'function' && retroNpcArt(role, blink, e.name);
  if (retro) return retro.startsWith('ka_') ? sprH(retro, 22) : spr(retro, 16, 16);
  if (!role || !IMG[`${base}_down0`]) return walker(npcLook(e.spr), 'down', 0);
  return spr(blink && IMG[`${base}_blink`] ? `${base}_blink` : `${base}_down0`, 16, 16);
}
window.npcRole = npcRole; window.npcSprite = npcSprite;
window.assetPackCharacter = assetPackCharacter; window.packFieldOn = packFieldOn;
