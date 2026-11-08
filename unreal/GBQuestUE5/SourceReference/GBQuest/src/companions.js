// ================================================================ COMPANIONS
// Named, recruitable companions with a story, affinity (bond), battle stances, gifts and a bench.
//   * Recruit at any inn's COMPANION BOARD once you meet their level and pay their signing fee.
//   * Affinity 0-100 rises with victories (+1, +3 vs bosses), talks (+1/day) and gifts (+3, +10 if liked).
//   * Bond tiers grant real stats through c.bond (folded into derive like ascension substats).
//   * Stances steer the battle AI: BALANCED, AGGRESSIVE, DEFENSIVE, SUPPORT.
//   * Active party is capped by play mode; extra companions wait on the bench (G.bench).

const COMPANION_DEFS = [
  { id: 'bram', name: 'BRAM', cls: 'warden', species: 'stonekin', role: 'tank', lvl: 1, fee: 0, likes: 'ration', home: 'ARDENHOLD', bio: 'A gate warden who lost his post. Still guards everyone out of habit.' },
  { id: 'esme', name: 'ESME', cls: 'chaplain', species: 'hearthkin', role: 'healer', lvl: 1, fee: 0, likes: 'peacebloom', home: 'ARDENHOLD', bio: 'A lantern chaplain who hums hymns when she is nervous.' },
  { id: 'kestrel', name: 'KESTREL', cls: 'strider', species: 'thornelf', role: 'dps', lvl: 3, fee: 60, likes: 'big_fish', home: 'ELDERWOOD', bio: 'A ranger who counts every arrow and never misses twice.' },
  { id: 'oriel', name: 'ORIEL', cls: 'arcanist', species: 'wispling', role: 'dps', lvl: 5, fee: 120, likes: 'shard', home: 'SILVERHAVEN', bio: 'An academy dropout chasing a spell nobody believes exists.' },
  { id: 'gorran', name: 'GORRAN', cls: 'berserker', species: 'tuskborn', role: 'tank', lvl: 7, fee: 180, likes: 'ration', home: 'DUNE MARCH', bio: 'A pit fighter who swore to only fight for good causes. Mostly.' },
  { id: 'lys', name: 'LYS', cls: 'cantor', species: 'thornelf', role: 'healer', lvl: 9, fee: 240, likes: 'potion', home: 'THORN COURT', bio: 'A wandering singer whose songs mend wounds and hearts.' },
  { id: 'vex', name: 'VEX', cls: 'shade', species: 'twinblood', role: 'dps', lvl: 11, fee: 320, likes: 'ember', home: 'GLOAMPORT', bio: 'A thief who robs only the rich. The definition of rich varies.' },
  { id: 'moss', name: 'MOSS', cls: 'verdant', species: 'burrowkin', role: 'healer', lvl: 13, fee: 400, likes: 'sap', home: 'ELDERWOOD', bio: 'A tiny druid with a very large opinion about trees.' },
  { id: 'cinder', name: 'CINDER', cls: 'pactbound', species: 'emberborn', role: 'dps', lvl: 16, fee: 520, likes: 'ember', home: 'ASHFALL', bio: 'Bound to a patron she will not name. Her shadow moves late.' },
  { id: 'tamsin', name: 'TAMSIN', cls: 'vanguard', species: 'drakkin', role: 'tank', lvl: 19, fee: 640, likes: 'shard', home: 'SILVERHAVEN', bio: 'A paladin of the old oath, looking for an oath worth keeping.' },
  { id: 'wren', name: 'WREN', cls: 'ascetic', species: 'hearthkin', role: 'dps', lvl: 22, fee: 800, likes: 'ration', home: 'HIGH SPIRE', bio: 'A monk who walked down the mountain to see what all the noise was.' },
  { id: 'mordecai', name: 'MORDCAI', cls: 'necromancer', species: 'twinblood', role: 'dps', lvl: 25, fee: 1000, likes: 'relic_fragment', home: 'GRAVEMOOR', bio: 'A gentle necromancer who apologises to every skeleton he raises.' },
  { id: 'saoirse', name: 'SAOIRSE', cls: 'sunwarden', species: 'drakkin', role: 'healer', lvl: 28, fee: 1200, likes: 'potion', home: 'SUNREACH', bio: 'A priestess of the dawn who rises before it out of spite.' },
  { id: 'rook', name: 'ROOK', cls: 'runeblade', species: 'stonekin', role: 'tank', lvl: 32, fee: 1500, likes: 'iron_ore', home: 'IRONDEEP', bio: 'A rune-smith knight who carves a mark for every friend saved.' },
  { id: 'pip', name: 'PIP', cls: 'summoner', species: 'wispling', role: 'dps', lvl: 36, fee: 1800, likes: 'big_fish', home: 'GLOAMPORT', bio: 'A cheerful summoner whose familiars are all named Gerald.' },
  { id: 'hale', name: 'HALE', cls: 'wildblood', species: 'tuskborn', role: 'dps', lvl: 40, fee: 2200, likes: 'hide', home: 'DUNE MARCH', bio: 'Born in a storm. Claims the thunder is family.' },
].filter(d => CLASSES[d.cls]);
const COMP_BY_ID = Object.fromEntries(COMPANION_DEFS.map(d => [d.id, d]));

const BOND_TIERS = [
  { at: 0, name: 'STRANGER', bond: {} },
  { at: 20, name: 'ALLY', bond: { hp: 2 } },
  { at: 45, name: 'FRIEND', bond: { hp: 3, dmg: 1 } },
  { at: 70, name: 'TRUSTED', bond: { hp: 4, dmg: 2, crit: 2 } },
  { at: 100, name: 'SWORN', bond: { hp: 6, dmg: 3, crit: 3, resist: 3 } },
];
const STANCES = ['balanced', 'aggressive', 'defensive', 'support'];
const STANCE_NAME = { balanced: 'BALANCED', aggressive: 'AGGRESSIVE', defensive: 'DEFENSIVE', support: 'SUPPORT' };
const STANCE_HELP = {
  balanced: 'Fights by role: tanks hold bosses, healers heal, the rest pick off the weakest.',
  aggressive: 'All-out damage on the biggest threat. Heals only when someone falls.',
  defensive: 'Guards the party: holds the boss and heals earlier when hurt.',
  support: 'Heals at 70% and buffs first, attacks only when nobody needs help.',
};

const bondTier = c => { let t = BOND_TIERS[0]; for (const b of BOND_TIERS) if ((c.affinity || 0) >= b.at) t = b; return t; };
function applyBond(c) { c.bond = Object.assign({}, bondTier(c).bond); }
function ensureCompanion(c) {
  if (!c) return c;
  if (!Number.isFinite(c.affinity)) c.affinity = c.compId ? 10 : 0;
  if (!STANCES.includes(c.stance)) c.stance = 'balanced';
  applyBond(c); return c;
}
function addAffinity(c, n) {
  if (!c) return null;
  ensureCompanion(c);
  const before = bondTier(c);
  c.affinity = Math.max(0, Math.min(100, (c.affinity || 0) + n));
  applyBond(c);
  const after = bondTier(c);
  return after !== before && after.at > before.at ? after : null;
}
function companionMax() { return Math.max(3, modeOf().size - 1); }
function allCompanions() { return (G.companions || []).concat(G.bench || []); }
function companionAvailable(def) {
  return !allCompanions().some(c => c.compId === def.id);
}
function recruitCompanion(id) {
  const def = COMP_BY_ID[id];
  if (!def) return 'Unknown companion.';
  if (!companionAvailable(def)) return `${def.name} already travels with you.`;
  if (G.lvl < def.lvl) return `${def.name} wants a hero of level ${def.lvl}.`;
  if (G.gold < def.fee) return `${def.name}'s fee is ${def.fee} G.`;
  G.gold -= def.fee;
  const c = makeAdventurer(def.cls, G.lvl, def.name);
  c.species = def.species; c.compId = def.id; c.portrait = classPortrait(def.cls) || null;
  c.affinity = 10; c.stance = def.role === 'healer' ? 'support' : def.role === 'tank' ? 'defensive' : 'balanced';
  applyBond(c);
  G.bench ||= [];
  if (G.companions.length < companionMax()) G.companions.push(c); else G.bench.push(c);
  return null;
}
function benchCompanion(c) {
  const i = G.companions.indexOf(c); if (i < 0) return 'Not in the party.';
  G.companions.splice(i, 1); (G.bench ||= []).push(c); return null;
}
function joinCompanion(c) {
  G.bench ||= []; const i = G.bench.indexOf(c); if (i < 0) return 'Not on the bench.';
  if (G.companions.length >= companionMax()) return `Party is full (${companionMax()}).`;
  G.bench.splice(i, 1); G.companions.push(c); return null;
}
function dismissCompanion(c) {
  let i = G.companions.indexOf(c); if (i >= 0) G.companions.splice(i, 1);
  i = (G.bench || []).indexOf(c); if (i >= 0) G.bench.splice(i, 1);
}
const GIFT_TYPES = ['use', 'mat', 'food', 'consumable'];
function giftable() { return Object.keys(G.inv || {}).filter(k => G.inv[k] > 0 && ITEMS[k] && (GIFT_TYPES.includes(ITEMS[k].type) || ITEMS[k].heal || ITEMS[k].price)); }
function giveGift(c, item) {
  if (!G.inv[item]) return { err: 'You have none of that.' };
  takeItem(item);
  const def = COMP_BY_ID[c.compId], liked = def && def.likes === item;
  const up = addAffinity(c, liked ? 10 : 3);
  return { liked, up };
}
function talkTo(c) {
  const def = COMP_BY_ID[c.compId], day = Math.floor((G.stats.steps || 0) / 600);
  let up = null;
  if (c.talkDay !== day) { c.talkDay = day; up = addAffinity(c, 1); }
  const t = bondTier(c).name;
  const lines = {
    STRANGER: 'I go where the coin and the road go. For now, that is with you.',
    ALLY: 'You fight well. I will watch your back.',
    FRIEND: 'Strange. I do not mind the long roads with you.',
    TRUSTED: 'If I fall, carry on. But I do not plan to fall.',
    SWORN: 'Whatever comes for you comes through me first.',
  };
  return { text: [def ? def.bio : `${c.name} adjusts their gear.`, `"${lines[t]}"`], up };
}
// called once per won battle for the companions that fought
function companionVictory(party, boss) {
  const ups = [];
  for (const u of party) if (isChar(u) && u.ch !== G && u.ch.ai && G.companions.includes(u.ch)) {
    const up = addAffinity(u.ch, boss ? 3 : 1); if (up) ups.push(`${u.ch.name} is now ${up.name}!`);
  }
  return ups;
}
function companionsMigrate() {
  G.bench = Array.isArray(G.bench) ? G.bench.filter(c => c && c.cls) : [];
  allCompanions().forEach(ensureCompanion);
  // the two starting companions become named companions
  for (const c of G.companions) if (!c.compId) { const d = COMPANION_DEFS.find(d => d.name === c.name && d.cls === c.cls); if (d) { c.compId = d.id; ensureCompanion(c); } }
}

// ---------------------------------------------------------------- party screen
class CompanionScene {
  constructor() { this.opaque = true; this.i = 0; this.msg = ''; }
  list() { companionsMigrate(); return G.companions.map(c => ({ c, bench: false })).concat((G.bench || []).map(c => ({ c, bench: true }))); }
  update() {
    const L = this.list();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!L.length) { if (P('a')) say('No companions yet. Visit an inn: the COMPANION BOARD lists heroes for hire.'); return; }
    if (nav('up')) { this.i = (this.i + L.length - 1) % L.length; SFX.cursor(); this.msg = ''; }
    if (nav('down')) { this.i = (this.i + 1) % L.length; SFX.cursor(); this.msg = ''; }
    this.i = Math.min(this.i, L.length - 1);
    if (!P('a')) return;
    SFX.select();
    const { c, bench } = L[this.i];
    choose(['TALK', 'STANCE', 'GIFT', bench ? 'JOIN PARTY' : 'TO BENCH', 'DISMISS', 'BACK'], k => {
      if (k === 0) { const r = talkTo(c); say(r.up ? r.text.concat(`${c.name} is now ${r.up.name}!`) : r.text); saveGame(); }
      if (k === 1) choose(STANCES.map(s => (c.stance === s ? '> ' : '') + STANCE_NAME[s]), j => { if (j >= 0) { c.stance = STANCES[j]; this.msg = `${c.name}: ${STANCE_NAME[c.stance]}`; saveGame(); } }, STANCE_HELP[c.stance]);
      if (k === 2) {
        const items = giftable().slice(0, 8);
        if (!items.length) return say('You have nothing to give.');
        const def = COMP_BY_ID[c.compId];
        choose(items.map(it => `${ITEMS[it].name.slice(0, 13)} x${G.inv[it]}`), j => {
          if (j < 0) return;
          const r = giveGift(c, items[j]); if (r.err) return say(r.err);
          SFX[r.liked ? 'achievement' : 'confirm']();
          say([r.liked ? `${c.name} loves it!` : `${c.name} thanks you.`].concat(r.up ? [`${c.name} is now ${r.up.name}!`] : [])); saveGame();
        }, def ? `${def.name} likes ${(ITEMS[def.likes] || { name: def.likes }).name}.` : 'A gift builds trust.');
      }
      if (k === 3) { const e = bench ? joinCompanion(c) : benchCompanion(c); if (e) { SFX.error(); say(e); } else { this.msg = bench ? `${c.name} JOINS` : `${c.name} BENCHED`; saveGame(); } }
      if (k === 4) choose(['KEEP', `DISMISS ${c.name}`], j => { if (j === 1) { dismissCompanion(c); this.msg = `${c.name} LEFT`; saveGame(); } }, 'Dismissed companions return to the board.');
    }, `${c.name}: ${bondTier(c).name} ${c.affinity}/100`);
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    textC(`COMPANIONS ${G.companions.length}/${companionMax()}`, 80, 1, 'gold');
    const L = this.list();
    if (!L.length) { textC('NO COMPANIONS YET', 80, 60, 2); textC('VISIT AN INN BOARD', 80, 72, 1); return; }
    const top = Math.max(0, Math.min(this.i - 3, L.length - 6));
    L.slice(top, top + 6).forEach(({ c, bench }, j) => {
      const i = top + j, y = 14 + j * 11;
      if (i === this.i) fill(1, y - 1, 72, 11, 1);
      text(`${bench ? '-' : ' '}${c.name.slice(0, 7)}`, 2, y, bench ? 1 : i === this.i ? 'gold' : 3);
      textR(`${c.lvl}`, 72, y, 2);
    });
    const { c, bench } = L[this.i], D = derive(c), t = bondTier(c), def = COMP_BY_ID[c.compId];
    frame(75, 13, 84, 66);
    const por = c.portrait && IMG[c.portrait] ? c.portrait : classPortrait(c.cls);
    if (por) { const s = sprFit(por, 34); blit(s, 79, 17); } else blit(sprH(`c_${c.cls}_0`, 30), 81, 17);
    text(CLASSES[c.cls].name.slice(0, 7), 115, 17, 3);
    text(`LV ${c.lvl}`, 115, 27, 2);
    text(`HP${D.hpMax}`, 115, 37, 2);
    text(`AC${D.ac}`, 115, 47, 2);
    text(STANCE_NAME[c.stance].slice(0, 9), 79, 58, 'gold');
    text(bench ? 'BENCH' : 'ACTIVE', 79, 68, bench ? 1 : 'green');
    frame(1, 81, 158, 62);
    text(`${t.name}`, 5, 84, 'gold'); textR(`${c.affinity}/100`, 155, 84, 2);
    bar(5, 94, 150, 4, c.affinity, 100, 'xp');
    const bb = Object.entries(t.bond).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');
    text((bb || 'NO BOND BONUS YET').slice(0, 25), 5, 100, 2);
    text(wrap(def ? def.bio : 'A hired blade from the inn.', 25).slice(0, 2).join('\n'), 5, 110, 3);
    text(this.msg ? this.msg.slice(0, 25) : 'A: TALK STANCE GIFT', 5, 132, this.msg ? 'green' : 1);
  }
}

// inn board: named companions for hire
function companionBoard() {
  companionsMigrate();
  const open = COMPANION_DEFS.filter(companionAvailable);
  if (!open.length) return say('Every hero on the board already travels with you.');
  const rows = open.slice(0, 10);
  choose(rows.map(d => `${d.name.slice(0, 7)} L${d.lvl} ${d.fee ? d.fee + 'G' : 'FREE'}`), j => {
    if (j < 0) return;
    const d = rows[j];
    choose([`HIRE ${d.name}`, 'LEAVE'], k => {
      if (k !== 0) return;
      const e = recruitCompanion(d.id);
      if (e) { SFX.error(); return say(e); }
      SFX.achievement(); saveGame();
      const c = allCompanions().find(x => x.compId === d.id);
      say([`${d.name} joins you!`, d.bio, G.bench.includes(c) ? 'The party is full, so they wait on the bench. Swap in PARTY.' : `Stance: ${STANCE_NAME[c.stance]}. Change it in MENU > SOCIAL > PARTY.`]);
    }, `${d.name}: ${CLASSES[d.cls].name}, ${d.role.toUpperCase()}. From ${d.home}. ${d.bio}`);
  }, 'COMPANION BOARD: heroes looking for a cause.');
}
