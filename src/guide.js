'use strict';
// ================================================================ ADVENTURER'S GUIDE (in-game encyclopedia)
// MAIN MENU > GUIDE. Every system explained in short handheld pages, with numbers read from the live game data, so the
// guide never drifts from the rules:
//   BASICS, CLASSES AND JOBS (all 27, with role, hit die, primary and job abilities), RACES (all 15, with bonuses and traits),
//   SPELLS (school list and the spell-level curve 1-720), COMBAT (initiative, conditions, buffs), GEAR (rarities, affixes,
//   aspects, greater affixes, tempering, masterwork, gems, durability), the ASPECT CODEX (all aspects by category, with the
//   ones you have saved marked), WORLD (regions, biomes, day and night, weather, morphs, mounts), CONTENT (dungeons,
//   raids, trials, tower, world quests, rares, invasions, keystones), GUILD AND CONQUEST, PROGRESSION (levels, mastery,
//   season, heirlooms, amitoi), NPCS (the NPC AI), and SETTINGS (themes, art modes, chat and accessibility).
// The topic list is exported as GBQGuide for tests.

const GUIDE_TOPICS = ['BASICS', 'CLASSES & JOBS', 'RACES', 'SPELLS', 'COMBAT', 'GEAR', 'ASPECT CODEX', 'WORLD', 'CONTENT', 'GUILD & CONQUEST', 'PROGRESSION', 'NPCS', 'SETTINGS'];
// split long text into dialogue pages of at most n lines of the wrapped text
function guidePages(lines, width = 25, perPage = 3) {
  const flat = []; for (const l of lines) { const words = String(l).split(' '); let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > width) { flat.push(cur.trim()); cur = w; } else cur += ' ' + w; } if (cur.trim()) flat.push(cur.trim()); }
  const out = []; for (let i = 0; i < flat.length; i += perPage) out.push(flat.slice(i, i + perPage).join(' '));
  return out;
}
if (typeof globalThis !== 'undefined') globalThis.GBQGuide = { GUIDE_TOPICS, guidePages };

if (typeof window !== 'undefined' && typeof MainMenu !== 'undefined') {
  const read = (lines, back) => say(lines, back);
  // ---------------------------------------------------------------- topics
  const T = {
    'BASICS': () => [
      ['MOVING', ['D-pad or arrows walk. A talks, opens and confirms; B goes back, rides your mount or ends WOLF FORM. START opens the menu.', 'Step onto stairs or an exit to use them. Touch a waypoint to unlock fast travel.']],
      ['SAVING', ['SAVE from the menu, or SAVE & QUIT. Your heroes live in save slots; heirlooms, amitoi-free account items and guilds are shared across slots on this device.']],
      ['DYING', ['If your party falls you become a spirit at the nearest camp. Walk back to your grave to revive, or ask a warden. Death costs 10% durability on everything you wear.']],
      ['THE SCREEN', ['Top left: your unit frame and party. Top right: the minimap (click to zoom, double-click for the world map). Bottom: HP and MP orbs with your hotbar. Pop-ups appear mid-screen.']],
    ],
    'CLASSES & JOBS': () => {
      const list = CLASS_ORDER.map(id => { const c = CLASSES[id], ab = typeof JOB_ABILITIES !== 'undefined' && JOB_ABILITIES[id] ? ` Job: ${JOB_ABILITIES[id].map(a => a.name).join(', ')}.` : ''; return [c.name, [`${c.role.toUpperCase()}. Hit die D${c.hd}, primary ${c.primary}, saves ${c.saves.join('/')}. ${c.caster ? c.caster.toUpperCase() + ' CASTER (' + c.cast + ').' : 'MARTIAL.'}`, c.desc + ab, `Subclasses: ${(c.subs || []).map(s => s.name).join(', ')}.`]]; });
      return [['HOW JOBS WORK', ['Change your MAIN JOB in any town (MENU > JOBS). Every job keeps its own level, attributes, talents and hotbar. From level 18 add a SUPPORT JOB at half your level for its traits and abilities.']], ...list];
    },
    'RACES': () => Object.entries(SPECIES).map(([id, s]) => [s.name, [`${Object.entries(s.asi).map(([a, v]) => `${a}+${v}`).join(' ')}. Traits: ${s.traits.map(t => t.toUpperCase()).join(', ')}.`, s.desc]]),
    'SPELLS': () => {
      const unlock = typeof SPELL_UNLOCK !== 'undefined' ? SPELL_UNLOCK : [];
      return [['SPELL LEVELS', ['Full casters first cast each spell level at character level: ' + unlock.map((l, i) => `L${i + 1}@${l}`).join(', ') + '. Half casters reach 5th level; pact casters gain arcanum 6-9 on the same curve.']],
        ['SLOTS AND REST', ['Spell slots come back on a LONG REST (camp kit or inn). Cantrips are free. Concentration spells end if you fail a CON save when hit.']],
        ...Object.entries(SCHOOLS).map(([id, s]) => [s.name, [s.desc || '', `${SPELLS.filter(x => x.school === id).length} spells.`]])];
    },
    'COMBAT': () => [
      ['TURNS', ['Battles roll initiative. On your turn pick ATTACK, a SPELL, an ABILITY, an ITEM or a COMBAT ART. Bonus actions (marked) can come before your main action. Settings switch between turn-based and real-time.']],
      ['HITTING', ['Attacks roll d20 + bonus against armour class. Natural 20s are critical hits. Saves roll d20 + save bonus against a difficulty.']],
      ['BUFFS', [Object.values(BUFFS).filter(b => b.good).map(b => b.name).join(', ') + '.']],
      ['DEBUFFS', [Object.values(BUFFS).filter(b => !b.good).map(b => b.name).join(', ') + '.']],
      ['MONSTER JOBS', ['About a third of humanoid, giant, fey, fiend and undead foes have a job: HEXER casts, GUARDIAN is armoured, ARCHER aims true, BRUTE hits hard, MENDER heals its side.']],
      ['NIGHT', ['At night foes are 15% tougher and pay 25% more XP and gold, and NOCTURNAL elites prowl.']],
    ],
    'GEAR': () => [
      ['RARITY', [RARITY.map(r => r.name).join(' > ') + '. Higher rarities roll more affixes and stronger bonuses.']],
      ['ASPECTS', ['Legendary and better items carry an ASPECT, a combat power. The OCCULTIST can EXTRACT it into your codex and IMPRINT it onto other gear.']],
      ['GREATER AFFIXES', ['Each affix has a 6% chance to roll 1.5x (ancestral and divine items always get one).']],
      ['TEMPER AND MASTERWORK', ['TEMPER adds up to two affix lines (offensive, defensive or utility). MASTERWORK raises an item through 12 ranks: +5% affixes per rank, and ranks 4, 8 and 12 boost one affix by 25%.']],
      ['GEMS AND RUNES', ['Weapons and armour get 1-4 gem sockets by item level. Gems drop in battle and are sold or cut by the GEM CUTTER. Runes slot into their own sockets at the RUNE FORGE.']],
      ['DURABILITY', ['Battles wear gear down; at 0 an item gives no stats. Repair at a merchant or with a REPAIR KIT. Crafted gear rolls FINE, SUPERIOR or MASTERWORK quality.']],
      ['MASTERY', ['Each weapon family levels 1-30 from battles won with it. Ranks ADEPT (10), EXPERT (20) and MASTER (30) give bigger steps.']],
    ],
    'ASPECT CODEX': () => null, // its own browser
    'WORLD': () => [
      ['REGIONS', [REGIONS.map(r => r.name).join(', ') + '.']],
      ['BIOMES', ['Each region has a biome with its own monsters, weather and trees: ' + Object.keys(BIOMES).map(b => b.toUpperCase()).join(', ') + '.']],
      ['DAY AND NIGHT', ['One game hour passes each real minute. Night runs from 21:00 to 5:00. NPCs keep a schedule: they open up at dawn, work by day, head home in the evening and sleep at night.']],
      ['MORPHS', ['WOLF FORM (level 5) runs like a fast mount and scares off some encounters. SWIM FORM (level 10) crosses water. Not in instances.']],
      ['MOUNTS', [`${typeof MOUNTS !== 'undefined' ? MOUNTS.length : 'Many'} mounts from stables, reputation, dungeons, crafting and bosses. B mounts and dismounts.`]],
    ],
    'CONTENT': () => [
      ['DUNGEONS', [`${DUNGEONS.length} dungeons, one per wild region. Rooms hang off a main path to the throne room; guardians seal the boss door until they fall.`]],
      ['RAIDS AND TRIALS', [`${RAIDS.length} raids with guardian chambers per boss, and ${TRIALS.length} trials where waves come one at a time.`]],
      ['THE SPIRE', ['100 floors, a boss every 5th. Each floor has a layout and a modifier; take the up stairs once the guardian falls.']],
      ['WORLD QUESTS', ['Four a day near your level: SLAY, ELITES or HUNT the rare. Every zone has a rare elite a day, and every 4 hours a zone is INVADED.']],
      ['KEYSTONES AND BOUNTIES', ['CHALLENGES holds daily and weekly bounties, keystone dungeons with timers and affixes, the weekly vault and the season pass.']],
    ],
    'GUILD & CONQUEST': () => [
      ['GUILDS', ["Guilds level 1-25 from members' play and unlock perks, a shared bank and weekly guild quests."]],
      ['BOONSTONES', ['Every wild region has a boonstone held by a guild. CHALLENGE it (two waves and the STONE WARDEN) for +10% XP and gold there and daily tax. Defend against counterattacks within 20 minutes.']],
      ['CASTLE SIEGE', ['With 3 stones your guild can besiege ARDENHOLD KEEP: GATE, COURTYARD, CASTLE LORD. The castle gives +5% damage, +5% resist, +10% XP, a big tax and the CASTLE LORD title.']],
    ],
    'PROGRESSION': () => [
      ['LEVELS 1-720', ['Levels 1-20 follow the 5e class table. Beyond 20 you earn attribute and substat points every level, mythic boons, talents and the spell-level curve to 720.']],
      ['JOBS AND SUPPORT', ['Every job levels on its own. A support job (from 18) works at half your level.']],
      ['NECROMANCER ARMY', ['Necromancers raise up to 9 minions (6 warriors, 2 mages, a golem) each battle and shape them in the BOOK OF THE DEAD.']],
      ['AMITOI', ['Send pet spirits on 15 minute, 1 hour or 4 hour expeditions for gold, materials and gear. They level to 10; adopt up to four.']],
      ['HEIRLOOMS', ['Account-wide gear usable from level 1 by every hero, bought once from the heirloom vendor.']],
    ],
    'NPCS': () => [
      ['THEIR LIVES', ['Townsfolk have personalities and a home. They wander, chat with neighbours, shelter from rain and sleep at night. Shopkeepers never stray more than a tile from their counter.']],
      ['MEMORY', ['NPCs remember how often you talk to them: stranger, regular, old friend. They greet you by name and notice strong heroes.']],
    ],
    'SETTINGS': () => [
      ['THEMES', ['UI THEME: 8-BIT MMO, CRIMSON, CLASSIC, SANCTUM, BLACKBIRD, QUEST WINDOWS (A on nothing opens COMMAND). ART: FULL DETAIL, NES, CLASSIC, RETRO 8-BIT, AELMOOR HD. BATTLE BG: CLEAN, PAINTED, SCENES.']],
      ['CHAT', ['The chat panel starts closed (C opens it). CHAT SETTINGS turns screen chat, bubbles, name tags and NPC chatter on or off.']],
      ['ACCESSIBILITY', ['PALETTE includes HIGH CONTRAST for colour-blind players. TEXT SPEED, BRIGHTNESS, CONTRAST and KEY BINDINGS are in SETTINGS.']],
    ],
  };
  // ---------------------------------------------------------------- aspect browser
  function codexMenu(back) {
    if (typeof ASPECTS === 'undefined') return read('No aspects in this build.', back);
    const cats = [...new Set(Object.values(ASPECTS).map(a => a.cat))], mine = (G && G.codex) || {};
    choose([...cats.map(c => `${c} (${Object.values(ASPECTS).filter(a => a.cat === c).length})`), 'BACK'], k => {
      if (k < 0 || k >= cats.length) return back();
      const ids = Object.keys(ASPECTS).filter(id => ASPECTS[id].cat === cats[k]);
      const list = () => choose(ids.map(id => `${mine[id] ? '# ' : ''}${ASPECTS[id].name}`.slice(0, 22)), j => {
        if (j < 0) return codexMenu(back);
        const A = ASPECTS[ids[j]];
        read([`ASPECT OF ${A.name} (${A.kind.toUpperCase()})`, `${A.desc(A.lo)} (rolls ${A.lo}-${A.hi})`, mine[ids[j]] ? `In your codex at ${mine[ids[j]]}.` : 'Not in your codex yet.'], list);
      }, `${cats[k]}: # = in your codex.`);
      list();
    }, `ASPECT CODEX: ${Object.keys(mine).length}/${Object.keys(ASPECTS).length} saved.`);
  }
  // ---------------------------------------------------------------- menus
  function topicMenu(name) {
    if (name === 'ASPECT CODEX') return codexMenu(guideMenu);
    const entries = (T[name] && T[name]()) || [];
    choose([...entries.map(([t]) => t.slice(0, 22)), 'BACK'], k => {
      if (k < 0 || k >= entries.length) return guideMenu();
      const [title, lines] = entries[k];
      read([title, ...guidePages(lines)], () => topicMenu(name));
    }, name);
  }
  function guideMenu() { choose([...GUIDE_TOPICS, 'CLOSE'], k => { if (k >= 0 && k < GUIDE_TOPICS.length) topicMenu(GUIDE_TOPICS[k]); }, "ADVENTURER'S GUIDE"); }
  window.guideMenu = guideMenu; window.GUIDE_DATA = T;
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { GUIDE: 'Every system explained.' });
  const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('SETTINGS'); L.splice(at < 0 ? L.length : at, 0, 'GUIDE'); return L; };
  const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'GUIDE') { SFX.select(); return guideMenu(); } return u0.apply(this, arguments); };
}
