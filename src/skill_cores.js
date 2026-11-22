'use strict';
// ================================================================ SKILL CORES: ONE CORE SOCKET ON EVERY WEAPON AND ARMOUR PIECE
// Throne-style skill cores. Every weapon and every armour piece (chest, shield and the HELM CLOAK GLOVES BELT
// LEGGINGS BOOTS pieces) has exactly one CORE socket, separate from gem and rune sockets.
//   WEAPON CORES (14, one per weapon subclass) add a battle SKILL with a cooldown, e.g. BLADE DANCE, REND, RAIN OF ARROWS.
//   ARMOUR CORES (8, one per armour category and shields) add an always-on PASSIVE, e.g. BULWARK, SWIFTNESS, AEGIS.
// Any weapon core fits any weapon and any armour core fits any armour piece; a core in its own subclass or category
// RESONATES for +1 rank. Cores have ranks 1-5: they drop from battles (elites and bosses more often), can be forged
// for gold at MAIN MENU > SKILL CORES, and three of a rank combine into one of the next rank. Removing a core returns it.
// Storage: character.cores = { 'sword_r2': count }, item.core = 'sword_r2'. Pure rules are exported as GBQSkillCores.

const CORE_RANK_MAX = 5;
const WEAPON_CORES = {
  sword: { name: 'BLADE DANCE', cd: 3, mode: 'strike', hits: 2, desc: 'Two quick strikes with bonus damage.' },
  axe: { name: 'REND', cd: 3, mode: 'strike', hits: 1, rider: 'bleeding', desc: 'A heavy strike that makes the foe bleed.' },
  mace: { name: 'SKULL CRACK', cd: 4, mode: 'strike', hits: 1, rider: 'stunned', riderRounds: 1, desc: 'A crushing strike that stuns.' },
  hammer: { name: 'EARTHSHAKER', cd: 5, mode: 'strike', aoe: true, rider: 'prone', desc: 'Strike every foe and knock them prone.' },
  dagger: { name: 'TWIN FANGS', cd: 3, mode: 'strike', hits: 2, rider: 'venom', desc: 'Two strikes that envenom.' },
  polearm: { name: 'SWEEPING ARC', cd: 4, mode: 'strike', aoe: true, desc: 'Strike every foe in reach.' },
  staff: { name: 'ARCANE NOVA', cd: 4, mode: 'spell', aoe: true, dt: 'force', desc: 'A burst of force hits every foe.' },
  wand: { name: 'SOUL BOLT', cd: 3, mode: 'spell', dt: 'necrotic', drain: 0.5, desc: 'A shadow bolt that heals you for half.' },
  bow: { name: 'RAIN OF ARROWS', cd: 4, mode: 'strike', aoe: true, desc: 'Arrows fall on every foe.' },
  crossbow: { name: 'PIERCING BOLT', cd: 4, mode: 'strike', hits: 1, extra: 2, rider: 'vulnerable', desc: 'A huge bolt that leaves the foe vulnerable.' },
  thrown: { name: 'FAN OF BLADES', cd: 4, mode: 'strike', aoe: true, rider: 'slowed', desc: 'Blades hit every foe and slow them.' },
  scythe: { name: 'REAP', cd: 5, mode: 'strike', aoe: true, drain: 0.3, desc: 'Reap every foe and heal for part of it.' },
  grimoire: { name: 'CHAIN SPELL', cd: 4, mode: 'spell', aoe: true, dt: 'lightning', rider: 'shocked', desc: 'Lightning arcs through every foe and shocks them.' },
  fist: { name: 'HUNDRED FISTS', cd: 4, mode: 'strike', hits: 3, desc: 'Three lightning-fast blows.' },
};
const ARMOUR_CORES = {
  head: { name: 'CLARITY', cat: 'HELM', stats: [['cdr', 2], ['ccReduce', 4]], desc: 'Shorter cooldowns; control on you ends sooner.' },
  back: { name: 'SHADOWVEIL', cat: 'CLOAK', stats: [['dodge', 2], ['drRanged', 3]], desc: 'Dodge, and less damage from range.' },
  armor: { name: 'BULWARK', cat: 'CHEST', stats: [['dr', 2], ['hpPct', 3]], desc: 'Damage reduction and max HP.' },
  hands: { name: 'PREDATOR', cat: 'GLOVES', stats: [['crit', 2], ['luckyHit', 4]], desc: 'Crit chance and lucky hit chance.' },
  waist: { name: 'VITALITY', cat: 'BELT', stats: [['healRecv', 6], ['barrierGen', 8]], desc: 'Stronger healing and barriers on you.' },
  legs: { name: 'IRONROOT', cat: 'LEGGINGS', stats: [['unstoppable', 4], ['drMelee', 3]], desc: 'Break free of control; less melee damage.' },
  feet: { name: 'SWIFTNESS', cat: 'BOOTS', stats: [['moveSpeed', 5], ['haste', 2]], desc: 'Move speed (initiative) and haste.' },
  offhand: { name: 'AEGIS', cat: 'SHIELD', stats: [['block', 2], ['fortify', 3]], desc: 'Block, and a barrier at the start of battle.' },
};
const CORE_KEYS = [...Object.keys(WEAPON_CORES), ...Object.keys(ARMOUR_CORES)];
const ARMOUR_CORE_SLOTS = ['head', 'back', 'armor', 'hands', 'waist', 'legs', 'feet'];

// 'sword_r2' -> definition, or null
function coreDefinition(id) {
  const m = /^([a-z]+)_r([1-9])$/.exec(String(id || ''));
  if (!m) return null;
  const key = m[1], rank = Number(m[2]);
  if (rank < 1 || rank > CORE_RANK_MAX) return null;
  if (WEAPON_CORES[key]) return Object.assign({ id: `${key}_r${rank}`, key, rank, kind: 'weapon' }, WEAPON_CORES[key]);
  if (ARMOUR_CORES[key]) return Object.assign({ id: `${key}_r${rank}`, key, rank, kind: 'armour' }, ARMOUR_CORES[key]);
  return null;
}
const coreId = (key, rank) => `${key}_r${rank}`;
const coreLabel = d => `R${d.rank} ${d.name}`;
// which kind of core an item takes ('weapon' / 'armour') and the subclass or category it resonates with.
// info: { kind, fam (weapon subclass), armourType ('shield' or other, for kind 'armor'), slot (wondrous slot) }
function coreSlotOf(info) {
  if (!info) return null;
  if (info.kind === 'weapon') return { kind: 'weapon', key: info.fam || null };
  if (info.kind === 'armor') return { kind: 'armour', key: info.armourType === 'shield' ? 'offhand' : 'armor' };
  if (info.kind === 'wondrous' && ARMOUR_CORE_SLOTS.includes(info.slot)) return { kind: 'armour', key: info.slot };
  return null;
}
// a core's working rank in an item: +1 when it resonates with the item's subclass / category
const effectiveRank = (def, slot) => (def ? def.rank + (slot && slot.key === def.key ? 1 : 0) : 0);
// armour core passive stats at a working rank
const armourCoreStats = (def, eff) => (def && def.kind === 'armour' ? def.stats.map(([k, per]) => [k, per * eff]) : []);
// weapon core skill numbers at a working rank and hero level
function weaponCoreSkill(def, eff, lvl) {
  if (!def || def.kind !== 'weapon') return null;
  const dice = 1 + eff + (def.extra || 0) + Math.floor(Math.max(0, (Number(lvl) || 1) - 1) / 40);
  return { name: def.name, cd: Math.max(2, def.cd - (eff >= 5 ? 1 : 0)), mode: def.mode, hits: def.aoe ? 1 : (def.hits || 1), aoe: !!def.aoe, dice: def.mode === 'spell' ? `${dice}d8` : `${dice}d6`, dt: def.dt, rider: def.rider, riderRounds: def.riderRounds || 2, drain: def.drain || 0 };
}
// ---------------------------------------------------------------- inventory
function addCore(c, id, n = 1) {
  if (!c || !coreDefinition(id) || !Number.isInteger(n) || n < 1) return false;
  if (!c.cores || typeof c.cores !== 'object') c.cores = {};
  c.cores[id] = (c.cores[id] || 0) + n; return true;
}
function takeCore(c, id) {
  if (!c || !c.cores || !(c.cores[id] > 0)) return false;
  c.cores[id]--; if (!c.cores[id]) delete c.cores[id]; return true;
}
// socket a core from the character's cores into an item; whatever was there goes back to the inventory
function socketCore(c, item, slot, id) {
  const def = coreDefinition(id);
  if (!def) return { ok: false, reason: 'Unknown core.' };
  if (!slot) return { ok: false, reason: 'Only weapons and armour have a core socket.' };
  if (slot.kind !== def.kind) return { ok: false, reason: def.kind === 'weapon' ? 'Weapon cores go in weapons.' : 'Armour cores go in armour.' };
  if (!c || !c.cores || !(c.cores[id] > 0)) return { ok: false, reason: 'You do not have that core.' };
  takeCore(c, id);
  const old = item.core && coreDefinition(item.core) ? item.core : null;
  if (old) addCore(c, old, 1);
  item.core = def.id;
  return { ok: true, core: def.id, returned: old };
}
function unsocketCore(c, item) {
  const old = item && item.core && coreDefinition(item.core) ? item.core : null;
  if (!old) return { ok: false, reason: 'The core socket is empty.' };
  addCore(c, old, 1); item.core = null;
  return { ok: true, core: old };
}
// three of one core and rank -> one of the next rank
function combineCores(c, id) {
  const def = coreDefinition(id);
  if (!def) return { ok: false, reason: 'Unknown core.' };
  if (def.rank >= CORE_RANK_MAX) return { ok: false, reason: 'Already max rank.' };
  if (!c || !c.cores || (c.cores[id] || 0) < 3) return { ok: false, reason: 'Need 3 of the same core.' };
  c.cores[id] -= 3; if (!c.cores[id]) delete c.cores[id];
  const up = coreId(def.key, def.rank + 1); addCore(c, up, 1);
  return { ok: true, core: up };
}
const forgeCost = lvl => 250 + 25 * Math.max(1, Math.floor(Number(lvl) || 1));
// battle drops: chance per foe (percent) and the rank rolled
const coreDropChance = foe => (foe && foe.boss ? 40 : foe && foe.elite ? 12 : 3);
function rollCoreDrop(rng, foe) {
  const key = CORE_KEYS[Math.floor(rng() * CORE_KEYS.length) % CORE_KEYS.length], r = rng();
  let rank = r < 0.85 ? 1 : r < 0.98 ? 2 : 3;
  if (foe && foe.boss) rank = Math.min(CORE_RANK_MAX, rank + 1);
  return coreId(key, rank);
}

if (typeof globalThis !== 'undefined') globalThis.GBQSkillCores = { CORE_RANK_MAX, WEAPON_CORES, ARMOUR_CORES, CORE_KEYS, coreDefinition, coreId, coreLabel, coreSlotOf, effectiveRank, armourCoreStats, weaponCoreSkill, addCore, takeCore, socketCore, unsocketCore, combineCores, forgeCost, coreDropChance, rollCoreDrop };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined' && typeof makeItem === 'function') {
  const slotOfItem = it => {
    if (!it) return null;
    const w = it.kind === 'weapon' ? WEAPONS[it.base] : null, a = it.kind === 'armor' ? ARMORS[it.base] : null;
    return coreSlotOf({ kind: it.kind, fam: w && w.fam, armourType: a && a.type, slot: it.slot });
  };
  window.coreSlotOfItem = slotOfItem;
  const coreOf = it => (it && it.core ? coreDefinition(it.core) : null);
  const CORE_SLOTS = ['weapon', 'offhand', 'armor', 'head', 'back', 'hands', 'waist', 'legs', 'feet'];
  const CORE_SLOT_LABEL = { weapon: 'WEAPON', offhand: 'OFFHAND', armor: 'CHEST', head: 'HELM', back: 'CLOAK', hands: 'GLOVES', waist: 'BELT', legs: 'LEGS', feet: 'BOOTS' };
  const iconOf = d => `ne_gem_${Math.min(8, (d ? d.rank : 1) * 2 - 1)}`;
  // ------------------------------------------------ armour core passives count as gear stats
  if (typeof gearAffixes === 'function') { const ga0 = gearAffixes; gearAffixes = function (c) {
      const s = ga0.apply(this, arguments);
      try { for (const slot of (typeof SLOTS !== 'undefined' ? SLOTS : CORE_SLOTS)) { const it = c && c.eq && c.eq[slot], d = coreOf(it); if (d && d.kind === 'armour') for (const [k, v] of armourCoreStats(d, effectiveRank(d, slotOfItem(it)))) s[k] = (s[k] || 0) + v; } } catch (e) { /* stats stay as they were */ }
      return s;
    }; }
  // ------------------------------------------------ weapon core skills in battle (cooldown in rounds, like combat arts)
  const coreSkillOf = u => { const it = u && u.ch && u.ch.eq && u.ch.eq.weapon, d = coreOf(it); return d && d.kind === 'weapon' ? { d, sk: weaponCoreSkill(d, effectiveRank(d, slotOfItem(it)), u.ch.lvl) } : null; };
  const ready = (b, u) => !(b.coreCd && b.coreCd[u.id] > b.round);
  function useCoreSkill(b, u, sk, t) {
    b.coreCd ||= {}; b.coreCd[u.id] = b.round + sk.cd;
    const foes = sk.aoe ? b.enemiesOf(u).filter(alive) : [t].filter(Boolean);
    const before = foes.map(f => hpOf(f)), steps = [b.say(`${u.name} unleashes ${sk.name}!`, () => { if (typeof SFX !== 'undefined' && SFX.bless) SFX.bless(); })];
    if (sk.mode === 'spell') {
      const school = (typeof ART_SCHOOL !== 'undefined' && ART_SCHOOL[sk.dt]) || 'storm';
      steps.push(...b.castSpell(u, { id: 'core_' + sk.name.toLowerCase().replace(/ /g, '_'), name: sk.name, school, lvl: 0, t: sk.aoe ? 'enemies' : 'enemy', eff: 'dmg', atk: true, dice: sk.dice, dt: sk.dt }, foes));
    } else {
      for (const f of foes) for (let i = 0; i < sk.hits; i++) steps.push(...b.weaponAttack(u, f, { single: true, skillBonus: sk.dice }));
    }
    steps.push({ text: '', dyn: () => {
      const bits = [];
      if (sk.rider) foes.forEach((f, i) => { if (alive(f) && hpOf(f) < before[i] && !(f.condImm || []).includes(sk.rider)) { addEffect(f, { id: sk.rider, rounds: sk.riderRounds, lvl: u.ch.lvl, src: u.id }); bits.push(f.name); } });
      if (sk.drain) { const dealt = foes.reduce((a, f, i) => a + Math.max(0, before[i] - hpOf(f)), 0); if (dealt && hpOf(u) > 0) { b.heal(u, Math.max(1, Math.ceil(dealt * sk.drain))); bits.push('LIFE DRAINED'); } }
      const nm = sk.rider ? ((typeof CONDITIONS !== 'undefined' && CONDITIONS[sk.rider]) || (typeof BUFFS !== 'undefined' && BUFFS[sk.rider]) || { name: sk.rider }).name : '';
      const msg = [sk.rider && bits.length && bits[0] !== 'LIFE DRAINED' ? `${bits.filter(x => x !== 'LIFE DRAINED').slice(0, 2).join(', ')}: ${nm}` : '', bits.includes('LIFE DRAINED') ? 'LIFE DRAINED' : ''].filter(Boolean).join('. ');
      return msg ? { text: msg } : null;
    } });
    return steps;
  }
  { const ab0 = Battle.prototype.abilities; Battle.prototype.abilities = function (u) {
      const list = ab0.apply(this, arguments);
      try {
        const cs = isChar(u) && coreSkillOf(u);
        if (cs) {
          const ok = ready(this, u), left = ok ? 0 : this.coreCd[u.id] - this.round;
          list.unshift({ id: 'core_' + cs.d.key, name: `${cs.sk.name}`.slice(0, 15), cost: ok ? `CORE CD${cs.sk.cd}` : `${left}R`, ok, bonus: false, fn: t => useCoreSkill(this, u, cs.sk, t), target: cs.sk.aoe ? null : 'enemy' });
        }
      } catch (e) { /* abilities unchanged */ }
      return list;
    }; }
  // ------------------------------------------------ drops after a won battle
  if (typeof recordVictory === 'function') { const rv0 = recordVictory; recordVictory = function (b) {
      const r = rv0.apply(this, arguments);
      try {
        if (b && !b.noRewards && G) {
          const got = [];
          for (const f of b.foes || []) if (got.length < 2 && R() * 100 < coreDropChance(f)) { const id = rollCoreDrop(R, f); addCore(G, id, 1); got.push(coreDefinition(id)); }
          if (got.length) toast('SKILL CORE', got.map(coreLabel).join(', ').slice(0, 24), iconOf(got[0]), 'pickup');
        }
      } catch (e) { /* no drop */ }
      return r;
    }; }
  // ------------------------------------------------ item text
  if (typeof itemDesc === 'function') { const d0 = itemDesc; itemDesc = function (it) {
      const s = d0.apply(this, arguments);
      try {
        const slot = slotOfItem(it); if (!slot) return s;
        const d = coreOf(it);
        if (!d) return `${s} CORE: EMPTY (${slot.kind === 'weapon' ? 'SKILL' : 'PASSIVE'}).`;
        const eff = effectiveRank(d, slot), res = eff > d.rank ? ' RESONANT' : '';
        return `${s} CORE: ${coreLabel(d)}${res}. ${d.kind === 'armour' ? armourCoreStats(d, eff).map(([k, v]) => `+${v}${SUBSTATS[k].unit} ${SUBSTATS[k].name}`).join(', ') : d.desc}`;
      } catch (e) { return s; }
    }; }
  // ------------------------------------------------ socket menu for one item (from the bag, or a SOCKETS row)
  function coreMenuFor(it, done) {
    const slot = slotOfItem(it); if (!slot) { SFX.error(); return; }
    const own = Object.keys(G.cores || {}).map(coreDefinition).filter(d => d && d.kind === slot.kind && G.cores[d.id] > 0).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
    const cur = coreOf(it), opts = [];
    if (cur) opts.push(`REMOVE ${coreLabel(cur)}`.slice(0, 24));
    own.forEach(d => opts.push(`${coreLabel(d)}${d.key === slot.key ? '*' : ''} x${G.cores[d.id]}`.slice(0, 24)));
    if (!opts.length) { say([`No ${slot.kind} cores yet.`, 'Win battles (elites and bosses drop more) or forge one at MAIN MENU > SKILL CORES.']); return; }
    opts.push('BACK');
    choose(opts, k => {
      if (cur && k === 0) { const r = unsocketCore(G, it); SFX[r.ok ? 'equip' : 'error'](); if (done) done(); return; }
      const d = own[k - (cur ? 1 : 0)]; if (!d) return;
      const r = socketCore(G, it, slot, d.id); SFX[r.ok ? 'equip' : 'error'](); if (!r.ok) say(r.reason); if (done) done();
    }, `${it.name.slice(0, 18)} CORE (*=RESONANT)`);
  }
  window.coreMenuFor = coreMenuFor;
  // ------------------------------------------------ MAIN MENU > SKILL CORES: sockets, owned cores (combine), forge
  class SkillCoreScene {
    constructor() { this.opaque = true; this.tab = 0; this.i = 0; }
    rows() {
      if (this.tab === 0) return CORE_SLOTS.map(s => ({ s, it: G.eq[s] })).filter(r => r.it && slotOfItem(r.it));
      if (this.tab === 1) return Object.keys(G.cores || {}).map(coreDefinition).filter(d => d && G.cores[d.id] > 0).sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key) || a.rank - b.rank);
      return CORE_KEYS.map(k => coreDefinition(coreId(k, 1)));
    }
    update() {
      const L = this.rows();
      if (P('b')) { SFX.back(); removeScene(this); return; }
      if (P('left') || P('right') || P('select')) { this.tab = (this.tab + (P('left') ? 2 : 1)) % 3; this.i = 0; SFX.page(); return; }
      if (!L.length) return;
      this.i = Math.min(this.i, L.length - 1);
      if (nav('up')) { this.i = (this.i + L.length - 1) % L.length; SFX.cursor(); }
      if (nav('down')) { this.i = (this.i + 1) % L.length; SFX.cursor(); }
      if (!P('a')) return;
      const row = L[this.i];
      if (this.tab === 0) coreMenuFor(row.it);
      else if (this.tab === 1) { const r = combineCores(G, row.id); SFX[r.ok ? 'craft' : 'error'](); say(r.ok ? `Combined into ${coreLabel(coreDefinition(r.core))}!` : r.reason); }
      else {
        const cost = forgeCost(G.lvl);
        if (G.gold < cost) { SFX.error(); say(`Forging a core costs ${cost} G.`); return; }
        choose([`FORGE ${row.name} (${cost} G)`.slice(0, 24), 'BACK'], k => { if (k !== 0) return; G.gold -= cost; addCore(G, row.id, 1); SFX.craft(); say(`Forged ${coreLabel(row)}.`); });
      }
    }
    draw() {
      const L = this.rows();
      fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
      textC(['< CORE SOCKETS >', '< YOUR CORES >', '< FORGE CORES >'][this.tab], 80, 1, 'gold');
      const top = Math.max(0, Math.min(this.i - 3, L.length - 7));
      if (!L.length) textC(this.tab === 0 ? 'EQUIP A WEAPON OR ARMOUR' : 'NO CORES YET', 80, 40, 2);
      L.slice(top, top + 7).forEach((row, j) => {
        const i = top + j, y = 15 + j * 10; if (i === this.i) fill(1, y - 1, 158, 10, 1);
        if (this.tab === 0) { const d = coreOf(row.it), slot = slotOfItem(row.it); text(CORE_SLOT_LABEL[row.s] || row.s.toUpperCase(), 4, y, 2); textR(d ? `${coreLabel(d)}${effectiveRank(d, slot) > d.rank ? '*' : ''}`.slice(0, 16) : '- EMPTY -', 156, y, d ? 'gold' : 1); }
        else if (this.tab === 1) { text(coreLabel(row).slice(0, 18), 4, y, row.kind === 'weapon' ? 3 : 'green'); textR(`x${G.cores[row.id]}`, 156, y, 2); }
        else { text(row.name.slice(0, 15), 4, y, row.kind === 'weapon' ? 3 : 'green'); textR(row.kind === 'weapon' ? (WEAPON_CLASSES[row.key] || { name: row.key }).name : row.cat, 156, y, 2); }
      });
      frame(1, 88, 158, 55);
      const row = L[this.i];
      let d = null, slot = null, lines = [];
      if (row) { if (this.tab === 0) { d = coreOf(row.it); slot = slotOfItem(row.it); } else d = row; }
      if (this.tab === 0 && row && !d) lines = [row.it.name.slice(0, 25), `EMPTY ${slot.kind === 'weapon' ? 'SKILL' : 'PASSIVE'} SOCKET`, 'A: SOCKET A CORE'];
      else if (d) {
        const eff = this.tab === 0 ? effectiveRank(d, slot) : d.rank;
        lines = [`${coreLabel(d)}${eff > d.rank ? ' =R' + eff : ''}`.slice(0, 25), ...wrap(d.desc, 25).slice(0, 2)];
        if (d.kind === 'weapon') { const sk = weaponCoreSkill(d, eff, G.lvl); lines.push(`${sk.dice} ${sk.aoe ? 'ALL FOES' : sk.hits > 1 ? sk.hits + ' HITS' : '1 FOE'} CD${sk.cd}`); }
        else lines.push(armourCoreStats(d, eff).map(([k, v]) => `+${v}${SUBSTATS[k].unit} ${SUBSTATS[k].name}`).join(' ').slice(0, 25));
      }
      lines.forEach((l, k) => text(l, 5, 92 + k * 10, k === 0 ? 'gold' : 3));
      text(this.tab === 0 ? 'A:SOCKET  <>:TAB' : this.tab === 1 ? 'A:COMBINE 3  <>:TAB' : `A:FORGE ${forgeCost(G.lvl)}G  <>:TAB`, 5, 134, 1);
    }
  }
  window.SkillCoreScene = SkillCoreScene;
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items;
    MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('ARMOURY'); L.splice(at >= 0 ? at + 1 : L.length, 0, 'SKILL CORES'); return L; };
    const u0 = MainMenu.prototype.update;
    MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'SKILL CORES') { SFX.select(); return push(new SkillCoreScene()); } return u0.apply(this, arguments); };
  }
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { 'SKILL CORES': 'One core per weapon (a battle skill) and armour piece (a passive).' });
}
