// LOST KINGDOM OF SHADOWBANE CHRONICLES systems: save slots, inventory, story chapters & side quests, achievements,
// bestiary, reputation, professions, waypoints, party/LFG, difficulty, the simulated realm,
// and NET (live multiplayer: presence, chat, host server, leaderboard).
'use strict';

// ================================================================ game state
let G = null;
const SLOT_KEYS = ['gbq2_slot1', 'gbq2_slot2', 'gbq2_slot3'];
function newGameState(o) {
  const c = newCharacter(o);
  Object.assign(c, {
    slot: o.slot || 0, created: Date.now(), playtime: 0, gold: BACKGROUNDS[o.bg].gold * 5, bag: [], inv: { potion: 3, ration: 2, campkit: 1, hearthstone: 1 },
    map: 'elderwood', x: 3, y: 7, dir: 'down', mounted: false, hasMount: false,
    chapter: 0, chProg: 0, sideq: {}, waypoints: { elderwood: true }, areas: {}, bestiary: {}, bossKills: {}, rep: { lantern: 0 }, honor: 0, rating: 1000,
    stats: { kills: 0, deaths: 0, nat20: 0, nat1: 0, stabilized: 0, elites: 0, worldBosses: 0, arcBosses: 0, dungeons: 0, raids: 0, trials: 0, fish: 0, crafted: 0, goldEarned: 0, legendaries: 0, spell9: 0, party4: 0, party12: 0, diff5: 0, diff9: 0, steps: 0, pvpWins: 0, pvpKills: 0, pvpDeaths: 0, battlegroundWins: 0, quests: 0 },
    ach: {}, prof: { herb: 1, mining: 0, forestry: 0, hidecraft: 0, alch: 1, fish: 1, salvaging: 0, relic: 0, cultivation: 0, beast_lore: 0, cook: 1, blacksmith: 0, armorsmith: 0, weaponsmith: 0, tailoring: 1, leatherwork: 1, jewelcraft: 0, enchanting: 0 }, profTalents: {}, profPerks: {}, profQuests: {}, blueprints: RECIPES.filter(recipe => recipe.skill <= 1).map(recipe => recipe.id), companions: [], difficulty: 2, playMode: o.mode || 'solo', guild: null, pets: [], pet: null,
    mail: [], ah: [], bank: [], homes: {}, hearth: { map: 'elderwood', x: 3, y: 7 }, visited: { elderwood: true }, nodes: {}, towerBest: 0, raidWeek: {}, daily: {}, renown: {}, inst: null, seenPrologue: true,
    pvpEnabled: false, pvpFaction: 'lantern', pvpDefeats: {}, eventDaily: {}, trackedEvent: null,
  });
  return c;
}
function saveGame() {
  if (!G) return false;
  G.saved = Date.now();
  const ok = store.set(SLOT_KEYS[G.slot], G); store.set('gbq2_last', G.slot);
  NET.publishHero && NET.publishHero();
  return ok;
}
function loadSlot(i) { const s = store.get(SLOT_KEYS[i]); if (!s) return false; G = s; G.slot = i; ITEM_UID = Math.max(ITEM_UID, ...[...(G.bag || []), ...Object.values(G.eq || {})].filter(Boolean).map(it => it.uid + 1), 1); fixupState(); return true; }
function slotInfo(i) { const s = store.get(SLOT_KEYS[i]); return s ? { name: s.name, lvl: s.lvl, cls: s.cls, portrait: s.portrait, look: s.look, zone: (ZONE_BY_ID[s.map] || { name: 'DUNGEON' }).name, saved: s.saved, chapter: s.chapter } : null; }
function lastSlot() { const l = store.get('gbq2_last'); return l != null && slotInfo(l) ? l : SLOT_KEYS.findIndex((_, i) => slotInfo(i)); }
function fixupState() {
  G.homes = G.homes && typeof G.homes === 'object' && !Array.isArray(G.homes) ? G.homes : {};
  G.skillPts = Math.max(0, Math.floor(Number(G.skillPts) || 0));
  G.activeSkills = Array.isArray(G.activeSkills) ? [...new Set(G.activeSkills.filter(id => ACTIVE_SKILLS.some(skill => skill.id === id && skill.classes.includes(G.cls))))] : [];
  G.passiveSkills = Array.isArray(G.passiveSkills) ? [...new Set(G.passiveSkills.filter(id => PASSIVE_SKILLS.some(skill => skill.id === id && skill.classes.includes(G.cls))))] : [];
  for (const home of Object.values(G.homes)) {
    home.level = Math.max(1, Math.min(5, Math.floor(Number(home.level) || 1)));
    home.decor = Array.isArray(home.decor) ? home.decor.filter(item => typeof item === 'string').slice(0, 8) : [];
    home.storage = Array.isArray(home.storage) ? home.storage : [];
  }
  G.prof = Object.assign({ herb: 1, mining: 0, forestry: 0, hidecraft: 0, alch: 1, fish: 1, salvaging: 0, relic: 0, cultivation: 0, beast_lore: 0, cook: 1, blacksmith: 0, armorsmith: 0, weaponsmith: 0, tailoring: 1, leatherwork: 1, jewelcraft: 0, enchanting: 0 }, G.prof);
  for (const key of Object.keys(PROFS)) G.prof[key] = Math.max(0, Math.min(PROF_CAP, Math.floor(Number(G.prof[key]) || 0)));
  const starterBlueprints = RECIPES.filter(recipe => recipe.skill <= 1).map(recipe => recipe.id);
  G.blueprints = Array.isArray(G.blueprints) ? [...new Set(G.blueprints.filter(id => RECIPES.some(recipe => recipe.id === id))) ] : starterBlueprints;
  for (const id of starterBlueprints) if (!G.blueprints.includes(id)) G.blueprints.push(id);
  G.profTalents = G.profTalents && typeof G.profTalents === 'object' ? G.profTalents : {};
  for (const key of Object.keys(PROFS)) {
    const saved = G.profTalents[key] && typeof G.profTalents[key] === 'object' ? G.profTalents[key] : {};
    G.profTalents[key] = Object.fromEntries(['yield', 'efficiency', 'mastery'].map(branch => [branch, Math.max(0, Math.min(240, Math.floor(Number(saved[branch]) || 0)))]));
    let remaining = G.prof[key];
    for (const branch of ['yield', 'efficiency', 'mastery']) { const rank = Math.min(remaining, G.profTalents[key][branch]); G.profTalents[key][branch] = rank; remaining -= rank; }
  }
  G.profQuests = G.profQuests && typeof G.profQuests === 'object' && !Array.isArray(G.profQuests) ? G.profQuests : {};
  for (const key of Object.keys(PROFS)) {
    const saved = G.profQuests[key] && typeof G.profQuests[key] === 'object' && !Array.isArray(G.profQuests[key]) ? G.profQuests[key] : {};
    G.profQuests[key] = {};
    for (const id of ['side', 'order']) {
      const raw = saved[id] && typeof saved[id] === 'object' && !Array.isArray(saved[id]) ? saved[id] : {};
      const target = id === 'side' ? PROFESSION_QUESTS[key].sideCount : PROFESSION_QUESTS[key].orderCount;
      G.profQuests[key][id] = { accepted: !!raw.accepted, progress: Math.max(0, Math.min(target, Math.floor(Number(raw.progress) || 0))), done: id === 'side' && !!raw.done };
    }
  }
  G.talents = Array.isArray(G.talents) ? G.talents.filter(id => TALENT_TREES.some(tree => tree.nodes.some(node => node.id === id))) : [];
  const talentMilestones = [5, 10, 15, 20].filter(level => G.lvl >= level).length;
  G.talentPts = Math.max(Number.isInteger(G.talentPts) ? G.talentPts : 0, talentMilestones - G.talents.length);
  G.stats = Object.assign(newGameState({ name: 'X', species: 'hearthkin', cls: 'warden', bg: 'wanderer' }).stats, G.stats);
  if (typeof G.pvpEnabled !== 'boolean') G.pvpEnabled = false;
  if (!['lantern', 'ashen'].includes(G.pvpFaction)) G.pvpFaction = 'lantern';
  G.pvpDefeats = G.pvpDefeats && typeof G.pvpDefeats === 'object' ? G.pvpDefeats : {};
  G.eventDaily = G.eventDaily && typeof G.eventDaily === 'object' ? G.eventDaily : {};
  if (typeof G.trackedEvent !== 'string') G.trackedEvent = null;
  G.companions = (G.companions || []).filter(c => c && c.cls);
  migrateGear(G); G.companions.forEach(migrateGear); if (typeof stashOf === 'function') stashOf();
  if (typeof retierGear === 'function') retierGear();
  if (typeof companionsMigrate === 'function') { companionsMigrate(); G.bench.forEach(migrateGear); }
  if (G.inst) { G.inst = null; const z = ZONE_BY_ID[G.map]; if (!z) { G.map = 'elderwood'; G.x = 3; G.y = 7; } }
}

// ================================================================ inventory helpers
function addItem(k, n = 1) { G.inv[k] = (G.inv[k] || 0) + n; }
function takeItem(k) { if (!G.inv[k]) return false; G.inv[k]--; if (!G.inv[k]) delete G.inv[k]; return true; }
const BAG_MAX = 40;
function addGear(it) {
  if (G.bag.length >= BAG_MAX) { G.mail.push({ from: 'LOST & FOUND', text: 'Your bags were full.', item: it }); return false; }
  G.bag.push(it); if (it.rarity >= 4) G.stats.epics = (G.stats.epics || 0) + 1; return true;
}

// ================================================================ difficulty & play mode
const diffOf = () => DIFFICULTY[(G.difficulty || 2) - 1];
const modeOf = () => PLAY_MODES.find(m => m.id === G.playMode) || PLAY_MODES[0];
const diffUnlocked = n => !DIFFICULTY[n - 1].req || G.lvl >= DIFFICULTY[n - 1].req;

// ================================================================ party building
function hireCompanion(role) {
  const cls = pick(ROLE_CLASSES[role]);
  const name = pick(SIM_NAMES.filter(n => !G.companions.some(c => c.name === n)));
  const c = makeAdventurer(cls, G.lvl, name);
  G.companions.push(c); return c;
}
function buildParty(size) {
  const party = [partyMember(G, 'local')];
  const roster = G.companions.slice(0, Math.max(0, size - 1));
  roster.forEach(c => party.push(partyMember(c, 'ai')));
  // real players joined to this host
  for (const r of NET.partyChars()) if (party.length < size) party.push(partyMember(r.ch, 'remote:' + r.peer));
  // fill with temporary AI adventurers (LFG / raid finder)
  const roles = ['tank', 'healer', 'dps', 'dps', 'healer', 'dps', 'tank', 'dps', 'dps', 'healer', 'dps'];
  let i = 0;
  while (party.length < size) { const role = roles[i++ % roles.length]; party.push(partyMember(makeAdventurer(pick(ROLE_CLASSES[role]), G.lvl, pick(SIM_NAMES)), 'ai')); }
  if (party.length >= 4) G.stats.party4++; if (party.length >= 12) G.stats.party12++;
  return party;
}
function fieldPartySize() { return Math.max(1 + G.companions.length, NET.partyChars().length + 1); }

// ================================================================ encounters
function zoneLevel(z) { const [a, b] = z.lvl; return Math.max(a, Math.min(b, Math.round(a + (b - a) * R()))); }
function rollEncounter(zoneDef, opts = {}) {
  const lvl0 = zoneLevel(zoneDef), table = spawnTable(zoneDef.biome, lvl0);
  const n = zoneDef.lvl[0] <= 2 && G.lvl <= 2 ? 1 : opts.group ? R() < 0.4 ? 3 : 2 : (R() < 0.3 ? 2 : 1);
  const lvl = zoneLevel(zoneDef);
  const foes = [];
  for (let i = 0; i < n; i++) foes.push(makeMonster(pick(table.length ? table : BESTIARY), Math.max(1, lvl - (i ? 1 : 0)), G.difficulty));
  if (R() < 0.05) { const elite = BESTIARY.filter(b => b.rank === 'elite' && BIOMES[zoneDef.biome].fam.includes(b.fam)); if (elite.length) foes[0] = makeMonster(pick(elite), lvl + 2, G.difficulty); }
  return foes;
}
function startBattle(foes, opts = {}) {
  const size = opts.size || fieldPartySize();
  const party = opts.party || buildParty(size);
  SFX.ambush();
  push(new Flash(() => push(new Battle(Object.assign({ party, foes, diff: G.difficulty, onEnd: opts.onEnd || defaultBattleEnd }, opts)))));
}
function defaultBattleEnd(result) {
  if (result === 'lose') return onPartyWipe();
  if (result === 'win') checkAchievements();
}
function onPartyWipe() {
  G.stats.deaths++;
  const z = ZONE_BY_ID[G.map] || ZONE_BY_ID[G.inst ? G.inst.return.map : 'elderwood'] || ZONE_BY_ID.elderwood;
  G.ghost = { map: G.inst ? G.inst.return.map : G.map, x: G.inst ? G.inst.return.x : G.x, y: G.inst ? G.inst.return.y : G.y };
  G.inst = null;
  const zone = ZONE_BY_ID[G.ghost.map] || ZONE_BY_ID.elderwood;
  const gy = zone.town ? [16, 12] : buildZoneCached(zone.id).hub;
  G.map = zone.id; G.x = gy[0]; G.y = gy[1] + 1; G.hp = 1;
  G.companions.forEach(c => c.hp = Math.max(1, Math.floor(derive(c).hpMax / 2)));
  checkAchievements();
  const f = currentField(); if (f) f.reload();
  say(['You have died.', 'Your spirit rises at the camp. Walk back to your body (the grave marker) to revive, or rest here.'], null, { who: 'SPIRIT' });
}

// ================================================================ victories: quests, bestiary, achievements
function recordVictory(b) {
  const zone = ZONE_BY_ID[G.map];
  for (const f of b.foes) {
    G.stats.kills++;
    if (f.bestId) { const e = G.bestiary[f.bestId] || (G.bestiary[f.bestId] = { kills: 0 }); e.kills++; }
    if (f.elite) G.stats.elites++;
    if (f.bossId) {
      const bd = BOSS_BY_ID[f.bossId]; G.bossKills[f.bossId] = Date.now();
      if (bd.cat === 'world') { G.stats.worldBosses++; questEvent('worldboss', f.bossId); }
      if (bd.cat === 'arc') { G.stats.arcBosses++; questEvent('arc', bd.act); }
    }
    questEvent('kill', f.fam, zone);
  }
  if (b.diff >= 5) G.stats.diff5++; if (b.diff >= 9) G.stats.diff9++;
  // party members still standing get loyalty: nothing more to track
}

// ---------------------------------------------------------------- main story
function chapterDef(i = G.chapter) { const c = CHAPTERS[i]; if (!c) return null; const [act, title, obj, line] = c; const [type, arg] = obj.split(':'); return { i, act, title, type, arg, line, region: ACTS[act - 1].zone }; }
function chapterGoal(ch) {
  if (!ch) return 'The story is complete. Endgame awaits!';
  const reg = REGIONS.find(r => r.id === ch.region);
  switch (ch.type) {
    case 'talk': return ch.arg === 'elder' ? 'Talk to the ELDER in Elderwood village.' : `Talk to the warden at the ${reg.name} camp.`;
    case 'kill': return `Defeat foes in ${reg.name} (${G.chProg}/${ch.arg}).`;
    case 'explore': return `Discover areas of ${reg.name} (${G.chProg}/${ch.arg}).`;
    case 'gather': return `Gather herbs in ${reg.name} (${G.chProg}/${ch.arg}).`;
    case 'dungeon': return `Clear the dungeon ${DUNGEONS.find(d => d.zone === ch.region).name}.`;
    case 'boss': return `Defeat ${BOSSES.find(b => b.cat === 'arc' && b.act === ch.act).name} in ${reg.name}.`;
    case 'travel': return `Travel to ${reg.name}.`;
  }
  return '';
}
function advanceChapter() {
  const ch = chapterDef(); if (!ch) return;
  const reg = REGIONS.find(r => r.id === ch.region);
  const xp = Math.round(xpForMonster(reg.lvl[1]) * 6), gold = 20 + reg.lvl[1] * 10;
  G.gold += gold; G.rep.lantern = (G.rep.lantern || 0) + 150; G.stats.quests++;
  const res = gainXP(G, xp);
  const actDone = !CHAPTERS[G.chapter + 1] || CHAPTERS[G.chapter + 1][0] !== ch.act;
  G.chapter++; G.chProg = 0;
  toast(actDone ? `ACT ${ch.act} COMPLETE!` : 'CHAPTER COMPLETE', `${ch.title} +${fmt(xp)}XP`, 'item_spellbook', actDone ? 'act_complete' : 'quest_done');
  if (actDone) addItem('codex_page');
  const next = chapterDef();
  if (next) setTimeout(() => toast(`CH.${next.i + 1}: ${next.title}`, next.line.slice(0, 22), 'px_map', 'quest_accept'), 2600);
  res.ups.forEach(g => toast(`LEVEL ${g.lvl}!`, g.notes[0] || 'You feel stronger.', 'px_crown', 'levelup'));
  if (next && next.type === 'travel' && regionOf(G.map) === next.region) advanceChapter();
  checkAchievements();
}
const regionOf = zid => { const z = ZONE_BY_ID[zid]; return z ? z.region : null; };
function questEvent(kind, arg, zone) {
  const ch = chapterDef();
  if (ch) {
    const inRegion = zone ? zone.region === ch.region : regionOf(G.map) === ch.region;
    if (kind === 'kill' && ch.type === 'kill' && inRegion) { G.chProg++; if (G.chProg >= +ch.arg) advanceChapter(); }
    else if (kind === 'discover' && ch.type === 'explore' && inRegion) { G.chProg++; if (G.chProg >= +ch.arg) advanceChapter(); }
    else if (kind === 'gather' && ch.type === 'gather' && inRegion) { G.chProg++; if (G.chProg >= +ch.arg) advanceChapter(); }
    else if (kind === 'enter' && ch.type === 'travel' && regionOf(arg) === ch.region) advanceChapter();
    else if (kind === 'dungeon' && ch.type === 'dungeon' && DUNGEONS.find(d => d.id === arg && d.zone === ch.region)) advanceChapter();
    else if (kind === 'arc' && ch.type === 'boss' && arg === ch.act) advanceChapter();
    else if (kind === 'talk' && ch.type === 'talk' && ((ch.arg === 'elder' && arg === 'elder') || (ch.arg === 'zone' && arg === 'warden:' + ch.region))) advanceChapter();
  }
  // side quests
  for (const id in G.sideq) {
    const sq = G.sideq[id]; if (sq.state !== 'active') continue;
    const d = sideQuestDef(id); if (!d) continue;
    const here = zone ? zone.id === d.zone : G.map === d.zone;
    if ((kind === 'kill' && (d.kind === 'kill' || d.kind === 'elite') && here && arg === d.target) ||
        (kind === 'gather' && d.kind === 'gather' && here) || (kind === 'fish' && d.kind === 'fish') ||
        (kind === 'discover' && d.kind === 'explore' && here) || (kind === 'worldboss' && d.kind === 'worldboss' && arg === d.target) ||
        (kind === 'discover' && d.kind === 'find' && here)) {
      sq.prog++;
      if (sq.prog >= d.count) { sq.state = 'ready'; toast('QUEST READY', d.name, 'px_map', 'quest_accept'); }
    }
  }
}
const SQ_CACHE = {};
function sideQuestsFor(zid) { return SQ_CACHE[zid] || (SQ_CACHE[zid] = sideQuests(ZONE_BY_ID[zid])); }
function sideQuestDef(id) { const zid = id.replace(/^sq_/, '').replace(/_\d+$/, ''); return sideQuestsFor(zid).find(q => q.id === id); }
function turnInSide(id) {
  const d = sideQuestDef(id), sq = G.sideq[id];
  sq.state = 'done'; G.stats.quests++; G.gold += d.gold;
  const res = gainXP(G, d.xp);
  G.renown[d.zone] = (G.renown[d.zone] || 0) + 1;
  const reg = REGIONS.find(r => r.id === ZONE_BY_ID[d.zone].region);
  const fac = { snow: 'stonekin', badlands: 'nomad', jungle: 'fey', crystal: 'haven' }[reg.biome] || 'lantern';
  G.rep[fac] = (G.rep[fac] || 0) + 120;
  if (R() < 0.5) addGear(makeItem({ lvl: Math.max(G.lvl, ZONE_BY_ID[d.zone].lvl[1]), mf: derive(G).mf }));
  toast('QUEST COMPLETE', `${d.name} +${fmt(d.xp)}XP`, 'px_map', 'quest_done');
  res.ups.forEach(g => toast(`LEVEL ${g.lvl}!`, g.notes[0] || '', 'px_crown', 'levelup'));
  checkAchievements();
}

// ================================================================ achievements
function checkAchievements() {
  if (!G) return;
  for (const a of ACHIEVEMENTS) if (!G.ach[a.id]) { let ok = false; try { ok = a.test(G.stats, G); } catch (e) {} if (ok) { G.ach[a.id] = Date.now(); toast('ACHIEVEMENT', a.name, 'px_crown'); } }
  if (G.stats.kills >= 100 && !G.pets.includes('slime')) { G.pets.push('slime'); toast('NEW PET', 'TINY SLIME', 'enemy_slime', 'pickup'); }
}
const achPoints = () => Object.keys(G.ach).length * 10;
const repTier = v => { let t = REP_TIERS[0]; for (const r of REP_TIERS) if (v >= r[0]) t = r; return t[1]; };

// ================================================================ professions
function profTalentRank(k, branch) { return G.profTalents && G.profTalents[k] ? G.profTalents[k][branch] || 0 : 0; }
function professionTalentSpend(k) { const tree = G.profTalents[k] || {}; return (tree.yield || 0) + (tree.efficiency || 0) + (tree.mastery || 0); }
function spendProfessionTalent(k, branch) {
  if (!PROFS[k] || !PROFESSION_TREES[k] || !Object.hasOwn(PROFESSION_TREES[k], branch)) return 'Unknown profession talent.';
  G.profTalents[k] ||= { yield: 0, efficiency: 0, mastery: 0 };
  const rank = profTalentRank(k, branch);
  if (rank >= 240) return 'That talent is at maximum rank (240).';
  if (G.prof[k] <= professionTalentSpend(k)) return 'No profession talent points available. Gain a profession skill level first.';
  G.profTalents[k][branch]++;
  return null;
}
function gainProf(k, diff = 1) {
  if (!PROFS[k]) return false;
  if (!Number.isInteger(G.prof[k]) || G.prof[k] < 0) G.prof[k] = 0;
  if (G.prof[k] === 0) G.prof[k] = 1;
  const bonus = Math.min(0.6, perkVal(k, 'xp') + profTalentRank(k, 'mastery') / 960 + (Object.values(G.homes || {}).some(home => home.decor && home.decor.includes('study')) ? 0.08 : 0));
  if (G.prof[k] < PROF_CAP && R() < Math.min(1, Math.max(0.15, 1 - (G.prof[k] - diff) / 40) + bonus)) { G.prof[k]++; return true; }
  return false;
}
function craft(rec) {
  if (!rec || !G.blueprints.includes(rec.id)) return 'You have not learned that recipe blueprint.';
  const reduction = Math.floor(profTalentRank(rec.prof, 'efficiency') / 24);
  const needs = Object.fromEntries(Object.entries(rec.needs).map(([item, quantity]) => [item, Math.max(1, quantity - reduction)]));
  for (const k in needs) if ((G.inv[k] || 0) < needs[k]) return 'Missing materials.';
  if (G.prof[rec.prof] < rec.skill) return `Need ${PROFS[rec.prof]} ${rec.skill}.`;
  const kept = R() < perkVal(rec.prof, 'save');
  if (!kept) for (const k in needs) for (let i = 0; i < needs[k]; i++) takeItem(k);
  let output = 1 + Math.floor(profTalentRank(rec.prof, 'yield') / 24);
  if (R() < perkVal(rec.prof, 'double')) output *= 2;
  if (R() < perkVal(rec.prof, 'extra')) output += 1;
  const perkNote = perkAfterWork(rec.prof);
  addItem(rec.makes, output); G.stats.crafted++;
  const up = gainProf(rec.prof, rec.skill);
  progressProfessionQuest(rec.prof, 'craft', 1);
  return `Made ${output} ${ITEMS[rec.makes].name}!${kept ? ' Materials kept!' : ''}${perkNote ? ` ${perkNote}` : ''}${up ? ` ${PROFS[rec.prof]} ${G.prof[rec.prof]}` : ''}`;
}
function recipeBlueprintCost(recipe) { return Math.max(15, Math.round(15 + recipe.skill * 1.5)); }
function learnRecipeBlueprint(recipeId) {
  const recipe = RECIPES.find(entry => entry.id === recipeId);
  if (!recipe) return 'Unknown recipe blueprint.';
  if (G.blueprints.includes(recipe.id)) return 'You already know this recipe.';
  if (G.prof[recipe.prof] < recipe.skill) return `Need ${PROFS[recipe.prof]} ${recipe.skill}.`;
  const cost = recipeBlueprintCost(recipe);
  if (G.gold < cost) return `Need ${cost} G for this blueprint.`;
  G.gold -= cost; G.blueprints.push(recipe.id);
  return `Learned ${recipe.name} blueprint!`;
}

function professionQuestRecord(professionId, questId) {
  const definition = PROFESSION_QUESTS[professionId];
  if (!definition || !['side', 'order'].includes(questId)) throw new RangeError('Unknown profession quest.');
  G.profQuests ||= {};
  G.profQuests[professionId] ||= {};
  G.profQuests[professionId][questId] ||= { accepted: false, progress: 0, done: false };
  return { definition, state: G.profQuests[professionId][questId] };
}
function professionQuestStatus(professionId, questId) {
  const { definition, state } = professionQuestRecord(professionId, questId);
  const count = questId === 'side' ? definition.sideCount : definition.orderCount;
  return { ...state, count, ready: state.accepted && !state.done && state.progress >= count,
    name: questId === 'side' ? definition.sideName : 'REPEATABLE WORK ORDER',
    text: questId === 'side' ? definition.sideText : definition.orderText };
}
function acceptProfessionQuest(professionId, questId) {
  const status = professionQuestStatus(professionId, questId);
  if (status.done || status.accepted) return false;
  const { state } = professionQuestRecord(professionId, questId);
  state.accepted = true;
  return true;
}
function progressProfessionQuest(professionId, action, amount = 1) {
  const definition = PROFESSION_QUESTS[professionId];
  if (!definition || definition.action !== action || !Number.isFinite(amount) || amount <= 0) return;
  for (const questId of ['side', 'order']) {
    const status = professionQuestStatus(professionId, questId);
    if (status.accepted && !status.done) {
      const { state } = professionQuestRecord(professionId, questId);
      state.progress = Math.min(status.count, state.progress + Math.floor(amount));
    }
  }
}
function claimProfessionQuest(professionId, questId) {
  const status = professionQuestStatus(professionId, questId);
  if (!status.ready) return { ok: false, reason: 'quest_not_ready' };
  const definition = status && PROFESSION_QUESTS[professionId];
  const state = professionQuestRecord(professionId, questId).state;
  const scale = questId === 'side' ? 3 : 1;
  const xp = definition.xp * scale, gold = Math.round(definition.gold * scale * (1 + perkVal(professionId, 'gold'))), skill = definition.skill * scale;
  G.gold += gold;
  const levelUps = gainXP(G, xp).ups;
  G.prof[professionId] = Math.min(PROF_CAP, G.prof[professionId] + skill);
  if (definition.item && ITEMS[definition.item]) addItem(definition.item, scale);
  if (questId === 'side') state.done = true;
  else { state.accepted = false; state.progress = 0; }
  checkAchievements();
  saveGame();
  return { ok: true, xp, gold, skill, item: definition.item, levelUps };
}

// ================================================================ zone cache
const ZONE_CACHE = {};
function buildZoneCached(id) { return ZONE_CACHE[id] || (ZONE_CACHE[id] = buildZone(ZONE_BY_ID[id])); }

// ================================================================ simulated realm: fake players & chat
const REALM = { players: [], log: [], tick: 0 };
const CHAT_UI = { filter: 'all', entries: [], maxEntries: 120 };
function realmTick() {
  REALM.tick++;
  if (REALM.tick % 600 === 0 || REALM.log.length === 0 && REALM.tick % 120 === 0) {
    const [ch, msg] = pick(CHAT_LINES); chatLog(ch, pick(SIM_NAMES), msg, true);
  }
}
function realmPlayersIn(zid) {
  if (!REALM.players[zid]) {
    const r = RNG('realm-' + zid), z = ZONE_BY_ID[zid], m = buildZoneCached(zid), out = [];
    const n = z.town ? 6 : 2;
    for (let i = 0; i < n; i++) {
      let x = m.hub[0] + r.int(-6, 6), y = m.hub[1] + r.int(-4, 4);
      for (let k = 0; k < 30 && !(m.tiles[(m.rows[y] || '')[x]] || [0, 0])[1]; k++) { x = r.int(2, 29); y = r.int(2, 21); }
      out.push({ id: `${zid}:${i}`, name: r.pick(SIM_NAMES), cls: r.pick(CLASS_ORDER), lvl: Math.max(z.lvl[0], Math.min(720, z.lvl[1] + r.int(-2, 2))), x, y, dir: 'down', guild: r.chance(0.5) ? r.pick(GUILD_NAMES) : null, faction: i % 2 === 0 ? 'ashen' : 'lantern', pvpEnabled: true, t: r.int(0, 200) });
    }
    REALM.players[zid] = out;
  }
  return REALM.players[zid];
}
function chatLog(channel, who, msg, sim) {
  const entry = { channel: String(channel || 'System').toLowerCase(), who: String(who || 'System').slice(0, 24), msg: String(msg || '').slice(0, 180), t: Date.now(), sim: !!sim };
  REALM.log.push(entry); if (REALM.log.length > 60) REALM.log.shift();
  CHAT_UI.entries.push(entry); if (CHAT_UI.entries.length > CHAT_UI.maxEntries) CHAT_UI.entries.shift();
  renderChatLog();
}
function renderChatLog() {
  const el = document.getElementById('chatlog'); if (!el) return;
  const socialChannels = ['whisper', 'world', 'trade', 'lfg', 'emote'];
  const visible = CHAT_UI.entries.filter(m => CHAT_UI.filter === 'all' || m.channel === CHAT_UI.filter || CHAT_UI.filter === 'social' && socialChannels.includes(m.channel));
  el.replaceChildren();
  for (const m of visible.slice(-60)) {
    const line = document.createElement('div'); line.className = 'ch-' + m.channel;
    const time = new Date(m.t), stamp = `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
    const tag = document.createElement('b'); tag.textContent = `${stamp} [${m.channel.toUpperCase()}] ${m.who}: `; line.appendChild(tag);
    line.appendChild(document.createTextNode(m.msg)); el.appendChild(line);
  }
  el.scrollTop = el.scrollHeight;
}
function setChatFilter(filter) {
  CHAT_UI.filter = ['all', 'say', 'party', 'guild', 'social'].includes(filter) ? filter : 'all';
  document.querySelectorAll('[data-chat-filter]').forEach(button => {
    const active = button.dataset.chatFilter === CHAT_UI.filter;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  renderChatLog();
}

// ================================================================ NET: live multiplayer through the artifact room + db
const NET = {
  room: null, db: null, user: null, myId: null, peers: [], hostOf: null, server: null, joined: {}, lastPres: '', remoteView: null,
  offline: false,
  // OFFLINE: nothing leaves this browser (no presence, chat, server or leaderboard). ONLINE: connect.
  setMode(mode) {
    S.netMode = mode; saveSettings();
    if (mode === 'offline') { this.offline = true; this.stopServer(); this.hostOf = null; this.peers = []; this.status = 'OFFLINE (BY CHOICE)'; if (this.room) this.room.presence({}).catch(() => {}); this.lastPres = ''; }
    else { this.offline = false; if (!this.room) this.init(); else { this.status = 'ONLINE'; this.lastPres = ''; this.publishHero(); } }
  },
  isOnline() { return !this.offline && !!this.room; },
  async init() {
    if (S.netMode === 'offline') { this.offline = true; this.status = 'OFFLINE (BY CHOICE)'; return; }
    this.offline = false;
    if (!window.claude || !window.claude.use) { this.status = 'OFFLINE'; return; }
    this.status = 'CONNECTING';
    try { this.user = await window.claude.use('user'); if (this.user && this.user.id) this.myId = await this.user.id(); } catch (e) {}
    try {
      this.room = await window.claude.use('room');
      if (this.room) {
        this.status = 'ONLINE';
        this.room.onPeers(ch => { if (this.offline) { this.peers = []; return; } this.peers = ch.peers.filter(p => !p.sameTab && p.kind === 'viewer'); this.onPeers(ch); }, () => { this.status = 'OFFLINE'; this.room = null; });
        ['srv_join', 'srv_char', 'srv_battle', 'srv_turn', 'srv_act', 'srv_end'].forEach(t => this.room.on(t, m => this.onMsg(t, m), () => {}));
        this.room.on('chat', m => this.receiveChat(m), () => {});
      } else this.status = 'OFFLINE';
    } catch (e) { this.status = 'OFFLINE'; }
    try { this.db = await window.claude.use('db'); } catch (e) { this.db = null; }
    this.publishHero();
  },
  tick() {
    realmTick();
    if (this.offline || !this.room || !G || frameN % 15) return;
    const pres = { n: (G.name || '').slice(0, 10), c: G.cls, l: G.lvl, z: G.inst ? 'inst' : G.map, x: G.x, y: G.y, d: G.dir, g: G.guild || null, m: G.mounted ? 1 : 0, w: G.pvpEnabled ? 1 : 0,
      h: this.server ? this.server.name : null, j: this.hostOf || null, uid: this.myId || null };
    const k = JSON.stringify(pres); if (k === this.lastPres) return; this.lastPres = k;
    this.room.presence(pres).catch(() => {});
  },
  onPeers(ch) {
    for (const p of ch.left) { delete this.joined[p.peer]; if (this.hostOf === p.peer) { this.hostOf = null; toast('SERVER', 'Host left the server', 'px_tower', 'error'); } }
  },
  sendChat(msg) {
    const raw = String(msg || '').trim(); if (!raw) return;
    const match = raw.match(/^\/(\S+)(?:\s+([\s\S]*))?$/);
    let channel = 'say', text = raw, to = '';
    if (match) {
      const cmd = match[1].toLowerCase(), rest = match[2] || '';
      const aliases = { s: 'say', say: 'say', y: 'yell', yell: 'yell', p: 'party', party: 'party', g: 'guild', guild: 'guild', '1': 'world', world: 'world', '2': 'trade', trade: 'trade', '4': 'lfg', lfg: 'lfg', e: 'emote', emote: 'emote' };
      if (cmd === 'help' || cmd === '?') { chatLog('system', 'CHAT', '/s /y /p /g /w name /1 /2 /4 /e · /r replies to last whisper'); return; }
      if (cmd === 'w' || cmd === 'whisper' || cmd === 'tell') {
        const w = rest.match(/^(\S+)\s+([\s\S]+)$/); if (!w) { chatLog('system', 'CHAT', 'Use /w playername message'); return; }
        channel = 'whisper'; to = w[1].slice(0, 24); text = w[2];
      } else if (cmd === 'r' || cmd === 'reply') {
        if (!this.lastWhisper) { chatLog('system', 'CHAT', 'There is nobody to reply to yet.'); return; }
        channel = 'whisper'; to = this.lastWhisper; text = rest;
      } else if (aliases[cmd]) { channel = aliases[cmd]; text = rest; }
      else { chatLog('system', 'CHAT', `Unknown chat command /${cmd}. Type /help.`); return; }
      if (!text.trim()) { chatLog('system', 'CHAT', 'Enter a message after the channel command.'); return; }
    }
    text = clean(text, 180); if (!text) return;
    if (['party', 'guild', 'whisper'].includes(channel) && !this.isOnline()) { chatLog('system', 'CHAT', 'This channel needs an online realm connection.'); return; }
    if (channel === 'party' && !this.server && !this.hostOf) { chatLog('system', 'CHAT', 'Join or host a party before using party chat.'); return; }
    if (channel === 'guild' && !(G && G.guild)) { chatLog('system', 'CHAT', 'Join a guild before using guild chat.'); return; }
    if (channel === 'whisper') {
      const target = this.peers.find(p => { const pr = p.presence || {}; return String(pr.n || '').toLowerCase() === to.toLowerCase() || String(p.name || '').toLowerCase() === to.toLowerCase(); });
      if (!target) { chatLog('system', 'CHAT', `${to} is not online in this realm.`); return; }
      to = target.peer; this.lastWhisper = (target.presence || {}).n || target.name || to;
    }
    if (this.offline || !this.room) {
      if (channel !== 'say' && channel !== 'yell' && channel !== 'emote') { chatLog('system', 'CHAT', 'You are offline. Switch to ONLINE to use this channel.'); return; }
      chatLog(channel, G ? G.name : 'YOU', text); return;
    }
    if (channel === 'say') { this.say = text; this.sayT = Date.now(); }
    const data = { channel, text, to, zone: G ? (G.inst ? 'inst' : G.map) : '', guild: G && G.guild || '' };
    chatLog(channel, G ? G.name : 'YOU', text);
    this.room.emit('chat', data).catch(() => chatLog('system', 'CHAT', 'Message could not be sent.'));
  },
  receiveChat(message) {
    const d = message && message.data || {}, channel = String(d.channel || '').toLowerCase(), text = clean(d.text, 180);
    const allowed = ['say', 'yell', 'party', 'guild', 'whisper', 'world', 'trade', 'lfg', 'emote'];
    if (!allowed.includes(channel) || !text) return;
    const peer = this.peers.find(p => p.peer === message.peer), presence = peer && peer.presence || {};
    if (channel === 'say' || channel === 'yell') {
      if (!peer || String(presence.z || '') !== String(G && (G.inst ? 'inst' : G.map) || '')) return;
      if (channel === 'say' && Math.abs((+presence.x || 0) - (G.x || 0)) + Math.abs((+presence.y || 0) - (G.y || 0)) > 12) return;
    }
    if (channel === 'guild' && (!G.guild || presence.g !== G.guild)) return;
    if (channel === 'party') {
      const host = this.hostOf || (this.server ? this.myPeer() : null), theirHost = presence.j || (presence.h ? message.peer : null);
      if (!host || host !== theirHost) return;
    }
    if (channel === 'whisper' && d.to !== this.myPeer()) return;
    const who = clean(d.name || presence.n || (peer && peer.name) || 'PLAYER', 24);
    if (channel === 'whisper') this.lastWhisper = who;
    chatLog(channel, who, text); if (channel === 'whisper') SFX.whisper();
  },
  peersInZone(zid) { return this.peers.filter(p => p.presence && p.presence.z === zid && typeof p.presence.x === 'number'); },
  servers() { return this.peers.filter(p => p.presence && p.presence.h).map(p => ({ peer: p.peer, name: clean(p.presence.h, 20), host: clean(p.presence.n), lvl: p.presence.l, players: this.peers.filter(q => q.presence && q.presence.j === p.peer).length + 1 })); },
  hostServer(name) { if (!this.isOnline()) { say(this.offline ? 'You are playing OFFLINE. Switch to ONLINE first (title screen or SETTINGS).' : 'No connection to other players right now.'); return false; } this.server = { name: name || `${G.name}'S REALM` }; this.hostOf = null; toast('SERVER ONLINE', this.server.name, 'px_tower', 'confirm'); },
  stopServer() { this.server = null; this.joined = {}; },
  joinServer(peer) {
    if (!this.isOnline()) { say('You are playing OFFLINE. Switch to ONLINE first.'); return; }
    this.hostOf = peer; this.server = null;
    if (this.room) this.room.emit('srv_char', { to: peer, ch: slimChar(G) }).catch(e => toast('SERVER', 'Joining needs Contributor access', 'px_tower', 'error'));
    toast('JOINED SERVER', 'You fight in the host party', 'px_tower', 'confirm');
  },
  partyChars() { return this.server ? Object.entries(this.joined).map(([peer, ch]) => ({ peer, ch })) : []; },
  onMsg(t, m) {
    if (this.offline) return;
    const d = m.data || {};
    if (t === 'srv_char' && this.server && d.to === this.myPeer()) { const ch = unslimChar(d.ch); if (ch) { this.joined[m.peer] = ch; toast('PLAYER JOINED', ch.name, 'px_tower', 'lfg_ready'); } }
    if (t === 'srv_battle' && this.hostOf === m.peer) { this.remoteView = d; const v = scenes.find(s => s instanceof RemoteBattleView); if (!v && d.active) push(new RemoteBattleView()); }
    if (t === 'srv_turn' && this.hostOf === m.peer && d.to === this.myPeer()) { this.myTurn = d; }
    if (t === 'srv_act' && this.server && this.joined[m.peer]) { const b = scenes.find(s => s instanceof Battle); if (b && b.actor && b.actor.ctrl === 'remote:' + m.peer) b.remoteAction(d); }
    if (t === 'srv_end' && this.hostOf === m.peer) { if (d.to === this.myPeer() || !d.to) { if (d.xp) { const r = gainXP(G, d.xp); G.gold += d.gold || 0; r.ups.forEach(g => toast(`LEVEL ${g.lvl}!`, '', 'px_crown', 'levelup')); } this.remoteView = null; const v = scenes.find(s => s instanceof RemoteBattleView); if (v) removeScene(v); } }
  },
  myPeer() { const me = this.room && this.room.peers().find(p => p.sameTab); return me ? me.peer : null; },
  battleSync(b) {
    if (!this.room || !this.server || !Object.keys(this.joined).length) return;
    if (frameN - (this.lastSync || 0) < 6 && b.state !== 'over') return; this.lastSync = frameN;
    const snap = { active: b.state !== 'over', text: (b.cur && b.cur.text || '').slice(0, 120), party: b.party.slice(0, 12).map(u => [u.name.slice(0, 8), Math.max(0, hpOf(u)), maxHpOf(u)]), foes: b.foes.slice(0, 6).map(f => [f.name.slice(0, 10), Math.max(0, f.hp), f.maxhp, f.id, f.spr]) };
    this.room.emit('srv_battle', snap).catch(() => {});
    if (b.state === 'over') for (const peer in this.joined) this.room.emit('srv_end', { to: peer, xp: b.foes.reduce((a, f) => a + (f.xp || 0), 0), gold: Math.round(b.foes.reduce((a, f) => a + (f.gold || 0), 0) / 2) }).catch(() => {});
  },
  requestTurn(b, u) { if (this.room) this.room.emit('srv_turn', { to: u.ctrl.slice(7), foes: b.foes.filter(alive).map(f => [f.id, f.name.slice(0, 10)]) }).catch(() => {}); },
  sendAct(a) { if (this.room) this.room.emit('srv_act', a).catch(() => {}); this.myTurn = null; },
  async publishHero() {
    if (this.offline) return;
    if (!this.db || !this.myId || !G) return;
    try { await this.db.doc('heroes/' + this.myId).set({ name: G.name.slice(0, 12), cls: G.cls, lvl: G.lvl, ach: achPoints(), tower: G.towerBest || 0, rating: G.rating || 1000, ch: G.chapter, ts: Date.now() }); } catch (e) {}
  },
  async leaderboard() {
    if (!this.db) return null;
    try { const snap = await this.db.collection('heroes').orderBy('lvl', 'desc').limit(20).get(); return snap.docs.map(d => d.data()); } catch (e) { return null; }
  },
};
window.NET = NET;
function clean(s, n = 12) { return String(s || '').replace(/[^\x20-\x7e]/g, '').slice(0, n); }
function slimChar(c) { return { name: c.name, species: c.species, cls: c.cls, bg: c.bg, sub: c.sub, lvl: c.lvl, base: c.base, feats: c.feats, ascAttr: c.ascAttr, ascSub: c.ascSub, boons: c.boons, eq: c.eq }; }
function unslimChar(o) {
  if (!o || !CLASSES[o.cls] || !SPECIES[o.species]) return null;
  const c = newCharacter({ name: clean(o.name), species: o.species, cls: o.cls, bg: BACKGROUNDS[o.bg] ? o.bg : 'wanderer' });
  c.lvl = Math.max(1, Math.min(LEVEL_CAP, +o.lvl || 1)); c.sub = o.sub; c.base = o.base || c.base; c.feats = (o.feats || []).filter(f => FEATS[f]);
  c.ascAttr = o.ascAttr || {}; c.ascSub = o.ascSub || {}; c.eq = o.eq || c.eq;
  const D = derive(c); c.hp = D.hpMax; c.res = resMax(c, D); c.ai = true;
  return c;
}
