// ================================================================ SETTLEMENT TRAINERS: city, towns and villages
// Every settlement has profession trainers and a curator, placed by district:
//   CITY (Ardenhold): all 18 profession trainers + the craft master + the curator, by quarter:
//     forge quarter (craft master, miner, salvager, leatherworker, armorsmith, weaponsmith),
//     market quarter (jeweller, enchanter, tailor), temple & library quarter (alchemist, curator),
//     gardens by the gate (herbalist, cultivator), the town edge (forester, hidecrafter, beastmaster).
//   HARBOR WARD (city docks): fisher, cook, salvager.
//   TOWNS (every third region hub): craft master, curator and four biome trainers.
//   VILLAGES (other region hubs): three trainers, mostly gatherers for the land around them, and a
//     travelling curator near ruins (badlands, volcanic, dusk, crystal).
// Every trainer: LEARN / LESSONS, a STARTER QUEST from level 10, BLUEPRINTS (crafting) or a
// FIELD GUIDE (gathering), and the profession PERK TREE.
// The craft master teaches blacksmithing and, at level 20, sets your smith path: WEAPONSMITH or
// ARMORSMITH. The two smith trainers only teach the path you chose (switching costs 1000 G).
// The curator teaches Relic Survey, appraises and buys relics and artifacts, and exchanges relics up a tier.

const TRAINER_TITLE = {
  herb: 'HERBALIST', mining: 'MINER', forestry: 'FORESTER', hidecraft: 'HIDECRAFTER', fish: 'FISHER', salvaging: 'SALVAGER',
  relic: 'CURATOR', cultivation: 'CULTIVATOR', beast_lore: 'BEASTMASTER', alch: 'ALCHEMIST', cook: 'COOK', blacksmith: 'CRAFT MASTER',
  armorsmith: 'ARMORSMITH', weaponsmith: 'WEAPONSMITH', tailoring: 'TAILOR', leatherwork: 'LEATHERWORKER', jewelcraft: 'JEWELLER', enchanting: 'ENCHANTER',
};
const GATHER_SET = ['herb', 'mining', 'forestry', 'hidecraft', 'fish', 'salvaging', 'relic', 'cultivation', 'beast_lore'];
const isGatherProf = p => GATHER_SET.includes(p);
// district anchors on the 32x24 city map: [x, y, district, professions]
const CITY_DISTRICTS = [
  [6, 13, 'FORGE QUARTER', ['blacksmith', 'mining', 'salvaging', 'leatherwork', 'armorsmith', 'weaponsmith']],
  [16, 9, 'MARKET QUARTER', ['jewelcraft', 'enchanting', 'tailoring']],
  [14, 4, 'TEMPLE QUARTER', ['alch', 'relic']],
  [22, 20, 'GARDENS', ['herb', 'cultivation']],
  [28, 15, 'TOWN EDGE', ['forestry', 'hidecraft', 'beast_lore']],
];
const DOCK_DISTRICT = [16, 12, 'DOCKS', ['fish', 'cook', 'salvaging']];
const BIOME_GATHER = {
  meadow: ['herb', 'cultivation', 'forestry'], coast: ['fish', 'salvaging', 'herb'], marsh: ['herb', 'hidecraft', 'beast_lore'],
  jungle: ['herb', 'forestry', 'beast_lore'], snow: ['mining', 'hidecraft', 'fish'], badlands: ['mining', 'salvaging', 'relic'],
  volcanic: ['mining', 'salvaging', 'relic'], dusk: ['relic', 'beast_lore', 'herb'], crystal: ['mining', 'relic', 'cultivation'],
};
const BIOME_CRAFT = {
  meadow: ['cook', 'tailoring', 'alch'], coast: ['cook', 'jewelcraft', 'tailoring'], marsh: ['alch', 'leatherwork', 'cook'],
  jungle: ['alch', 'leatherwork', 'tailoring'], snow: ['leatherwork', 'cook', 'blacksmith'], badlands: ['jewelcraft', 'blacksmith', 'enchanting'],
  volcanic: ['blacksmith', 'enchanting', 'jewelcraft'], dusk: ['enchanting', 'alch', 'tailoring'], crystal: ['jewelcraft', 'enchanting', 'alch'],
};
const RUIN_BIOMES = ['badlands', 'volcanic', 'dusk', 'crystal'];
const NPC_LOOKS = ['villager_0', 'villager_1', 'villager_2', 'villager_3', 'villager_4', 'villager_5', 'elder_0', 'elder_1', 'elder_2', 'elder_3', 'elder_4', 'elder_5', 'hero_0', 'hero_1', 'hero_2', 'hero_3'];

function settlementOf(z) {
  if (!z || G.inst) return null;
  if (z.town && z.id === z.region) return { kind: 'CITY', name: z.name, districts: CITY_DISTRICTS.map(d => d.slice()) };
  if (z.town) return { kind: 'DOCKS', name: z.name, districts: [DOCK_DISTRICT.slice()] };
  if (z.id !== z.region) return null;
  if (z.exp) { const g = BIOME_GATHER[z.biome] || BIOME_GATHER.meadow, c = BIOME_CRAFT[z.biome] || BIOME_CRAFT.meadow; return /_0$/.test(z.region) ? { kind: 'TOWN', name: z.name, hubCentred: true, profs: ['blacksmith', g[0], g[1], c[0], c[1], 'relic'] } : { kind: 'VILLAGE', name: z.name, hubCentred: true, profs: [g[0], g[1], c[0]] }; }
  const idx = REGIONS.findIndex(r => r.id === z.region), r = RNG('settle-' + z.id);
  const g = BIOME_GATHER[z.biome] || BIOME_GATHER.meadow, c = BIOME_CRAFT[z.biome] || BIOME_CRAFT.meadow;
  if (idx % 3 === 0) return { kind: 'TOWN', name: z.name, hubCentred: true, profs: ['blacksmith', g[0], g[1], c[0], c[1], 'relic'] };
  const v = [g[0], g[1], r.pick([g[2], c[0]])];
  if (RUIN_BIOMES.includes(z.biome) && !v.includes('relic')) v.push('relic');
  return { kind: 'VILLAGE', name: z.name, hubCentred: true, profs: v };
}

// find free, walkable, non-road tiles near an anchor (spiral search), cached per zone
const TRAINER_CACHE = {};
const SKIP_CH = new Set(['H', 'J', 'r', 'q', 'a', 'Q', 'R', 'K', 'k', '|', 'h', 'X', '=', 'J', '~', 'w', 'v', 'W']);
function trainerSpots(field, base, anchor, n, taken) {
  const out = [], [ax, ay] = anchor;
  for (let rad = 0; rad < 14 && out.length < n; rad++) for (let dy = -rad; dy <= rad && out.length < n; dy++) for (let dx = -rad; dx <= rad && out.length < n; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const x = ax + dx, y = ay + dy;
    if (x < 2 || y < 2 || x > ZW - 3 || y > ZH - 3) continue;
    const t = field.tileAt(x, y); if (!t || !t[1]) continue;
    const ch = field.chAt(x, y); if (SKIP_CH.has(ch)) continue;
    const key = x + ',' + y; if (taken.has(key)) continue;
    if (base.some(e => Math.abs(e.x - x) + Math.abs(e.y - y) < 1)) continue;
    // keep the tile from walling off paths: at least 3 walkable neighbours
    let nb = 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = field.tileAt(x + ox, y + oy); if (q && q[1]) nb++; }
    if (nb < 3) continue;
    // spacing between trainers
    let close = false; for (const k of taken) { const [tx, ty] = k.split(',').map(Number); if (Math.abs(tx - x) + Math.abs(ty - y) < 2) { close = true; break; } } if (close) continue;
    out.push([x, y]); taken.add(key);
  }
  return out;
}
function townTrainers(field, base) {
  const z = field.zone, st = settlementOf(z); if (!st) return [];
  if (TRAINER_CACHE[z.id]) return TRAINER_CACHE[z.id];
  const taken = new Set(base.filter(e => !e.walk).map(e => e.x + ',' + e.y)), r = RNG('trainers-' + z.id), out = [];
  const groups = st.districts || [[field.m.hub[0], field.m.hub[1] + 2, st.kind, st.profs]];
  for (const [ax, ay, district, profs] of groups) {
    const spots = trainerSpots(field, base, [ax, ay], profs.length, taken);
    profs.forEach((p, i) => {
      if (!spots[i]) return;
      const first = r.pick(NPC_FIRST), title = TRAINER_TITLE[p];
      const traveling = p === 'relic' && st.kind === 'VILLAGE';
      out.push({ kind: 'npc', x: spots[i][0], y: spots[i][1], spr: r.pick(NPC_LOOKS), name: `${traveling ? 'TRAVELING ' : ''}${title}${traveling ? '' : ' ' + first}`.slice(0, 22),
        svc: p === 'relic' ? 'curator' : p === 'blacksmith' ? 'craftmaster' : 'proftrainer', prof: p, district, settlement: st.kind });
    });
  }
  TRAINER_CACHE[z.id] = out;
  return out;
}
{
  const ent0 = Field.prototype.entities;
  Field.prototype.entities = function () {
    const e = ent0.call(this);
    if (G.inst || !this.zone) return e;
    if (!TRAINER_CACHE[this.zone.id]) { // place against every NPC, including the level-20 smiths
      const lv = G.lvl; G.lvl = Math.max(lv, 20); let full; try { full = ent0.call(this); } finally { G.lvl = lv; }
      townTrainers(this, full);
    }
    return e.concat(TRAINER_CACHE[this.zone.id] || []);
  };
}

// ---------------------------------------------------------------- starter quests (from level 10)
const STARTER_LVL = 10;
const starterGoal = p => isGatherProf(p) ? { action: p === 'fish' ? 'fish' : 'gather', n: 8, verb: p === 'fish' ? 'Catch' : 'Gather' } : { action: 'craft', n: 4, verb: 'Craft' };
function starterState(p) { G.starterQ ||= {}; return (G.starterQ[p] ||= { accepted: false, progress: 0, done: false }); }
{
  const pq0 = progressProfessionQuest;
  progressProfessionQuest = function (professionId, action, amount = 1) {
    pq0(professionId, action, amount);
    if (!G || !G.starterQ || !G.starterQ[professionId]) return;
    const s = G.starterQ[professionId], g = starterGoal(professionId);
    if (s.accepted && !s.done && action === g.action) s.progress = Math.min(g.n, s.progress + Math.max(1, Math.floor(amount)));
  };
}
function starterQuestTalk(p) {
  const name = PROFS[p], g = starterGoal(p), s = starterState(p);
  if (G.lvl < STARTER_LVL) return say([`Come back when you are level ${STARTER_LVL}.`, `I will have real ${name.toLowerCase()} work for you then.`]);
  if (s.done) return say([`You have finished my starter work. Keep practising ${name.toLowerCase()}.`]);
  if (!s.accepted) return choose(['ACCEPT', 'NOT NOW'], k => { if (k !== 0) return; s.accepted = true; s.progress = 0; SFX.quest_new && SFX.quest_new(); saveGame(); say([`STARTER QUEST: FIRST ${name}`, `${g.verb} ${g.n} times using ${name.toLowerCase()}, then come back to any ${TRAINER_TITLE[p].toLowerCase()}.`]); },
    `FIRST ${name}: ${g.verb} ${g.n} times. Reward: gold, XP, +15 skill${isGatherProf(p) ? ' and materials' : ' and a free blueprint'}.`);
  if (s.progress < g.n) return say([`FIRST ${name}: ${s.progress}/${g.n}.`, `${g.verb} a little more and come back.`]);
  // claim
  s.done = true;
  const gold = 150 + G.lvl * 12, xp = 300 + G.lvl * 60;
  G.gold += gold; G.stats.goldEarned += gold; const ups = gainXP(G, xp).ups;
  G.prof[p] = Math.min(PROF_CAP, Math.max(1, G.prof[p] || 0) + 15);
  const lines = [`STARTER QUEST COMPLETE!`, `+${gold} G  +${xp} XP  +15 ${name}`];
  if (isGatherProf(p)) { const m = typeof gatherMaterial === 'function' ? gatherMaterial(p, G.lvl, G.prof[p]) : null; if (m) { addItem(m.id, 10); lines.push(`+10 ${m.name}`); } }
  else { const bp = RECIPES.filter(r => r.prof === p && !G.blueprints.includes(r.id) && r.skill <= G.prof[p] + 20).sort((a, b) => a.skill - b.skill)[0]; if (bp) { G.blueprints.push(bp.id); lines.push(`Blueprint learned: ${bp.name}`); } }
  if (ups && ups.length) lines.push(`LEVEL UP! You are level ${G.lvl}.`);
  SFX.quest_done(); checkAchievements(); saveGame();
  toast('STARTER QUEST', `FIRST ${name}`.slice(0, 22), 'pp_xp', 'achievement');
  say(lines);
}

// ---------------------------------------------------------------- training
const lessonCost = p => 10 + (G.prof[p] || 0) * 3;
const lessonCap = () => Math.min(PROF_CAP, Math.max(30, G.lvl * 10));
function trainProfession(p) {
  const name = PROFS[p], s = G.prof[p] || 0;
  if (!s) { G.prof[p] = 1; SFX.levelup(); saveGame(); return say([`You learn ${name}!`, isGatherProf(p) ? 'Look for gathering spots out in the wild.' : 'Check MENU > CRAFTING for your first recipes.']); }
  if (s >= PROF_CAP) return say(`You have mastered ${name}.`);
  if (s >= lessonCap()) return say([`Lessons can take you to ${lessonCap()} at your level.`, 'Practise in the field, or come back when you are stronger.']);
  const cost = lessonCost(p);
  choose([`LESSON ${fmt(cost)} G (+3)`, 'LEAVE'], k => {
    if (k !== 0) return;
    if (G.gold < cost) return say('Not enough gold.');
    G.gold -= cost; G.prof[p] = Math.min(lessonCap(), s + 3); SFX.levelup(); saveGame();
    say(`${name} is now ${G.prof[p]}.`);
  }, `${name} ${s}/${PROF_CAP}. Lesson cap at your level: ${lessonCap()}.`);
}
function fieldGuide(p) {
  const fam = typeof PROF_FAMILY !== 'undefined' ? PROF_FAMILY[p] : null;
  if (!fam || typeof MATERIALS === 'undefined') return say('Gather what the land gives you.');
  const mats = MATERIALS.filter(m => m.family === fam), skill = G.prof[p] || 0;
  say([`${PROFS[p]} FIELD GUIDE (skill ${skill})`].concat(mats.map(m => `${m.lvl <= Math.max(1, skill) ? '+' : '-'} ${m.name} T${m.tier} L${m.lvl}`)).concat(['+ means your skill can gather it.']));
}
function profTrainerMenu(e) {
  const p = e.prof, name = PROFS[p], title = TRAINER_TITLE[p];
  if ((p === 'armorsmith' || p === 'weaponsmith')) {
    if (G.lvl < 20) return say([`${title}: The ${p === 'armorsmith' ? 'armour' : 'weapon'} path opens at level 20.`, 'Learn blacksmithing with a craft master first.']);
    if (G.smithPath && G.smithPath !== p) return say([`${title}: You walk the ${G.smithPath === 'armorsmith' ? 'armour' : 'weapon'} path.`, 'A craft master can change your path for 1000 G.']);
    if (!G.smithPath) return say([`${title}: Choose your path at a craft master first.`, 'At level 20 they will let you pick weapons or armour.']);
  }
  const known = (G.prof[p] || 0) > 0;
  const opts = [known ? 'TRAINING' : `LEARN ${name}`, `STARTER QUEST${G.lvl < STARTER_LVL ? ' (LV10)' : ''}`, isGatherProf(p) ? 'FIELD GUIDE' : 'BLUEPRINTS', 'PERK TREE', 'WORK ORDERS', 'LEAVE'];
  choose(opts, k => {
    if (k === 0) trainProfession(p);
    if (k === 1) starterQuestTalk(p);
    if (k === 2) { if (isGatherProf(p)) fieldGuide(p); else push(new BlueprintScene(Math.max(0, CRAFT_PROFS.indexOf(p)))); }
    if (k === 3) push(new PerkTreeScene(p));
    if (k === 4) { const s = new ProfessionQuestScene(); const i = s.professionIds.indexOf(p); if (i >= 0) s.professionIndex = i; push(s); }
  }, `${title}${e.district ? ' - ' + e.district : ''}: ${name} ${G.prof[p] || 0}/${PROF_CAP}.`);
}
function craftMasterMenu(e) {
  const opts = ['BLACKSMITH TRAINING', `STARTER QUEST${G.lvl < STARTER_LVL ? ' (LV10)' : ''}`, 'BLUEPRINTS', 'PERK TREE', G.smithPath ? 'CHANGE PATH 1000G' : `SMITH PATH${G.lvl < 20 ? ' (LV20)' : ''}`, 'LEAVE'];
  choose(opts, k => {
    if (k === 0) trainProfession('blacksmith');
    if (k === 1) starterQuestTalk('blacksmith');
    if (k === 2) push(new BlueprintScene(Math.max(0, CRAFT_PROFS.indexOf('blacksmith'))));
    if (k === 3) push(new PerkTreeScene('blacksmith'));
    if (k === 4) {
      if (G.lvl < 20) return say(['At level 20 a blacksmith chooses a path:', 'WEAPONSMITH (blades, bows, staves) or ARMORSMITH (plate, mail, shields).']);
      if (!(G.prof.blacksmith > 0)) return say('Learn blacksmithing first.');
      if (G.smithPath && G.gold < 1000) return say('Changing your path costs 1000 G.');
      choose(['WEAPONSMITH', 'ARMORSMITH', 'NOT YET'], j => {
        if (j < 0 || j > 1) return;
        const path = j === 0 ? 'weaponsmith' : 'armorsmith';
        if (G.smithPath === path) return say('You already walk that path.');
        if (G.smithPath) G.gold -= 1000;
        G.smithPath = path; G.prof[path] = Math.max(G.prof[path] || 0, 1 + Math.floor((G.prof.blacksmith || 0) / 4));
        SFX.achievement(); saveGame(); toast('SMITH PATH', TRAINER_TITLE[path], 'pp_extra', 'achievement');
        say([`You are now a ${TRAINER_TITLE[path]}!`, `${PROFS[path]} starts at ${G.prof[path]} (a quarter of your blacksmithing).`, `Find the ${TRAINER_TITLE[path].toLowerCase()} in the forge quarter for training.`]);
      }, 'Pick the trade you will master. Blacksmithing stays with you.');
    }
  }, `CRAFT MASTER${e.district ? ' - ' + e.district : ''}: BLACKSMITHING ${G.prof.blacksmith || 0}/${PROF_CAP}${G.smithPath ? ', path ' + TRAINER_TITLE[G.smithPath] : ''}.`);
}
// smith path gates the tiered weaponsmith / armorsmith blueprints
{
  const c0 = craft;
  craft = function (rec) {
    if (rec && (rec.prof === 'armorsmith' || rec.prof === 'weaponsmith') && rec.gear) {
      if (!G.smithPath) return 'Choose a smith path at a craft master (level 20).';
      if (G.smithPath !== rec.prof) return `You walk the ${TRAINER_TITLE[G.smithPath].toLowerCase()} path.`;
    }
    return c0(rec);
  };
}

// ---------------------------------------------------------------- curator: relics and artifacts
const relicMats = () => (typeof MATERIALS !== 'undefined' ? MATERIALS : []).filter(m => m.family === 'relic' && (G.inv[m.id] || 0) > 0);
const artifacts = () => G.bag.filter(it => it.named || it.legend || it.rarity >= 5);
function curatorMenu(e) {
  const opts = [(G.prof.relic || 0) > 0 ? 'RELIC SURVEY TRAINING' : 'LEARN RELIC SURVEY', `STARTER QUEST${G.lvl < STARTER_LVL ? ' (LV10)' : ''}`, 'APPRAISE', 'SELL RELICS', 'SELL ARTIFACT', 'RARE EXCHANGE', 'FIELD GUIDE', 'PERK TREE', 'LEAVE'];
  choose(opts, k => {
    if (k === 0) trainProfession('relic');
    if (k === 1) starterQuestTalk('relic');
    if (k === 2) {
      const R0 = relicMats(), A = artifacts();
      if (!R0.length && !A.length) return say('Bring me relics from the ruins, or artifacts from great foes.');
      say(['APPRAISAL'].concat(R0.map(m => `${m.name} x${G.inv[m.id]}: ${fmt(Math.round(ITEMS[m.id].price * 1.5) * G.inv[m.id])} G`), A.slice(0, 6).map(it => `${it.name.slice(0, 16)}: ${fmt(Math.round((it.value || 1) * 1.2))} G`)));
    }
    if (k === 3) {
      const R0 = relicMats(); if (!R0.length) return say('You carry no relics.');
      const total = R0.reduce((s, m) => s + Math.round(ITEMS[m.id].price * 1.5) * G.inv[m.id], 0);
      choose([`SELL ALL FOR ${fmt(total)} G`, 'KEEP THEM'], j => { if (j !== 0) return; for (const m of R0) { while (G.inv[m.id] > 0) takeItem(m.id); } G.gold += total; G.stats.goldEarned += total; SFX.coin(); saveGame(); say(`The curator pays ${fmt(total)} G. History thanks you.`); }, 'The museum pays 150% of market value for relics.');
    }
    if (k === 4) {
      const A = artifacts().slice(0, 8); if (!A.length) return say('No artifacts to sell. Named, legendary and better gear counts.');
      choose(A.map(it => `${it.name.slice(0, 14)} ${fmt(Math.round((it.value || 1) * 1.2))}G`), j => { if (j < 0) return; const it = A[j], v = Math.round((it.value || 1) * 1.2); G.bag.splice(G.bag.indexOf(it), 1); G.gold += v; G.stats.goldEarned += v; SFX.coin(); saveGame(); say(`${it.name} joins the museum. +${fmt(v)} G.`); }, 'Artifacts sell for 120% of their value.');
    }
    if (k === 5) {
      const all = (typeof MATERIALS !== 'undefined' ? MATERIALS : []).filter(m => m.family === 'relic');
      const can = all.filter((m, i) => i < all.length - 1 && (G.inv[m.id] || 0) >= 5);
      if (!can.length) return say('Bring 5 of one relic and I will trade it for 1 of the next kind.');
      choose(can.map(m => { const nx = all[all.indexOf(m) + 1]; return `5 ${m.name.slice(0, 8)} > ${nx.name.slice(0, 8)}`; }), j => {
        if (j < 0) return; const m = can[j], nx = all[all.indexOf(m) + 1], fee = 50 * nx.tier;
        if (G.gold < fee) return say(`The exchange fee is ${fee} G.`);
        for (let i = 0; i < 5; i++) takeItem(m.id); addItem(nx.id, 1); G.gold -= fee; SFX.craft(); saveGame(); say(`Exchanged for ${nx.name} (T${nx.tier}). Fee ${fee} G.`);
      }, 'RARE EXCHANGE: 5 relics for 1 of the next tier, plus a fee.');
    }
    if (k === 6) fieldGuide('relic');
    if (k === 7) push(new PerkTreeScene('relic'));
  }, `${e.name}: relics, artifacts and Relic Survey ${G.prof.relic || 0}/${PROF_CAP}.`);
}
{
  const ns0 = npcService;
  npcService = function (e) {
    if (e && e.svc === 'proftrainer') { SFX.open(); return profTrainerMenu(e); }
    if (e && e.svc === 'craftmaster') { SFX.open(); return craftMasterMenu(e); }
    if (e && e.svc === 'curator') { SFX.open(); return curatorMenu(e); }
    return ns0(e);
  };
}
