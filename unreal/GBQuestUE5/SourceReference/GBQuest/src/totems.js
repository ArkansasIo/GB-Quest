'use strict';
(() => { // own scope: the game loads every module as a classic script sharing one global scope
// ================================================================ TOTEMS: a 15th weapon family, five elements, three roles
// Five totem weapons - FLAME, FROST, STORM, EARTH, SPIRIT - are one-handed simple weapons, so every class can
// wield one (tanks keep their shield). A totem adapts to its wielder's ROLE (CLASSES[cls].role):
//   * PASSIVE (scales with the totem's gear tier):
//       TANK   resist, max HP, and the element's stat (EARTH: block)
//       DPS    damage and the element's damage (EARTH: crit damage)
//       HEALER healing and the element's damage (EARTH: resist)
//   * PLANT TOTEM (bonus action, once per battle; twice with a LEGENDARY+ totem). The planted totem's effect
//     depends on element x role (15 effects). Effects last 3 rounds (4 from gear tier 10):
//       TANK   temp HP (% of max HP), guard buffs on the party or self, debuffs on every foe
//       DPS    an elemental pulse hitting every foe, debuffs on every foe, a buff on the wielder
//       HEALER heals the whole party (% of max HP) and buffs everyone
//   AI companions holding a totem plant it on their first turn.
// Totems drop like any weapon. Pure rules are exported as GBQTotems for tests; game wiring runs only in the game.

const TOTEM_ROLES = ['tank', 'dps', 'healer'];
const TOTEM_ELEMENTS = {
  flame: { name: 'FLAME', weapon: 'flametotem', wname: 'FLAME TOTEM', dt: 'fire', stat: 'fire', school: 'flux', roles: {
    tank: { name: 'EMBER WARD', self: ['fortify'], foes: ['burning'], temp: 15 },
    dps: { name: 'INFERNO', foes: ['burning', 'burning'], self: ['might'], pulse: '2d6' },
    healer: { name: 'CAUTERIZE', party: ['regen'], heal: 10 },
  } },
  frost: { name: 'FROST', weapon: 'frosttotem', wname: 'FROST TOTEM', dt: 'cold', stat: 'cold', school: 'storm', roles: {
    tank: { name: 'GLACIER WALL', self: ['fortify'], foes: ['frostbite'], temp: 15 },
    dps: { name: 'BLIZZARD', foes: ['frostbite'], self: ['focus'], pulse: '2d6' },
    healer: { name: 'SNOWMELT', party: ['fortify'], heal: 12 },
  } },
  storm: { name: 'STORM', weapon: 'stormtotem', wname: 'STORM TOTEM', dt: 'lightning', stat: 'lightning', school: 'storm', roles: {
    tank: { name: 'THUNDER AEGIS', self: ['thornskin'], foes: ['shocked'], temp: 15 },
    dps: { name: 'TEMPEST', foes: ['shocked'], self: ['haste'], pulse: '2d6' },
    healer: { name: 'RAINCALL', party: ['regen', 'bless'], heal: 8 },
  } },
  earth: { name: 'EARTH', weapon: 'earthtotem', wname: 'EARTH TOTEM', dt: 'bludgeoning', stat: null, school: 'aegis', roles: {
    tank: { name: 'STONESKIN', party: ['fortify'], foes: [], temp: 20 },
    dps: { name: 'QUAKE', foes: ['sundered', 'sundered'], self: ['might'], pulse: '2d6' },
    healer: { name: 'DEEP ROOTS', party: ['fortify', 'regen'], heal: 10 },
  } },
  spirit: { name: 'SPIRIT', weapon: 'spirittotem', wname: 'SPIRIT TOTEM', dt: 'radiant', stat: 'radiant', school: 'calling', roles: {
    tank: { name: 'ANCESTOR GUARD', party: ['bless'], self: ['fortify'], temp: 15 },
    dps: { name: 'SOUL FIRE', foes: ['doomed'], self: ['focus'], pulse: '2d6' },
    healer: { name: 'ANCESTRAL MEND', party: ['regen', 'bless'], heal: 14 },
  } },
};
const TOTEM_IDS = Object.keys(TOTEM_ELEMENTS);
const TOTEM_WEAPONS = {};
for (const id of TOTEM_IDS) { const e = TOTEM_ELEMENTS[id]; TOTEM_WEAPONS[e.weapon] = { name: e.wname, dmg: '1d6', type: e.dt, cat: 'simple', props: '', fam: 'totem', icon: 'px_totem', cost: 40, focus: true, element: id }; }
// the element of a weapon base id (null when it is not a totem)
const totemOf = base => (TOTEM_WEAPONS[base] ? TOTEM_WEAPONS[base].element : null);
const roleOf = role => (TOTEM_ROLES.includes(role) ? role : 'dps');
// role passive stats for a totem of gear tier t
function rolePassive(elem, role, t) {
  const e = TOTEM_ELEMENTS[elem]; if (!e) return [];
  t = Math.max(1, Math.floor(Number(t) || 1)); role = roleOf(role);
  if (role === 'tank') return [['resist', 2 + Math.floor(t / 3)], ['hp', 5 + 4 * t], e.stat ? [e.stat, 2 + t] : ['block', 1 + Math.floor(t / 4)]];
  if (role === 'healer') return [['heal', 6 + 2 * t], e.stat ? [e.stat, 3 + t] : ['resist', 1 + Math.floor(t / 4)]];
  return [['dmg', 2 + t], e.stat ? [e.stat, 6 + 2 * t] : ['critdmg', 8 + 2 * t]];
}
// what planting does: effect lists, rounds, temp HP / heal %, pulse dice and uses per battle
function plantPlan(elem, role, rank, rarity) {
  const e = TOTEM_ELEMENTS[elem]; if (!e) return null;
  const r = e.roles[roleOf(role)], t = Math.max(1, Math.floor(Number(rank) || 1));
  return { element: elem, role: roleOf(role), name: r.name, dt: e.dt, school: e.school, self: r.self || [], foes: r.foes || [], party: r.party || [],
    temp: r.temp || 0, heal: r.heal ? r.heal + Math.floor(t / 2) : 0, pulse: r.pulse || null,
    rounds: 3 + (t >= 10 ? 1 : 0), uses: (Number(rarity) || 0) >= 5 ? 2 : 1 };
}
const roleWord = { tank: 'TANK', dps: 'DPS', healer: 'HEALER' };
function totemDesc(base) {
  const elem = totemOf(base); if (!elem) return '';
  const e = TOTEM_ELEMENTS[elem];
  return `${e.name} TOTEM. PLANT (bonus): ${TOTEM_ROLES.map(r => `${roleWord[r]} ${e.roles[r].name}`).join(', ')}.`;
}

if (typeof globalThis !== 'undefined') globalThis.GBQTotems = { TOTEM_ROLES, TOTEM_ELEMENTS, TOTEM_IDS, TOTEM_WEAPONS, totemOf, rolePassive, plantPlan, totemDesc };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof WEAPONS !== 'undefined' && typeof gearAffixes === 'function' && typeof Battle !== 'undefined') {
  Object.assign(WEAPONS, TOTEM_WEAPONS); // joins the loot pool (gen.js picks from WEAPONS)
  if (typeof WEAPON_CLASSES !== 'undefined') WEAPON_CLASSES.totem = { name: 'TOTEM', stats: t => [['resist', 1 + Math.floor(t / 5)]], desc: 'Elemental totem: adapts to your role. PLANT TOTEM in battle.' };
  const heldTotem = c => { const w = c && c.eq && c.eq.weapon; const el = w && totemOf(w.base); return el ? { w, el } : null; };
  const roleOfChar = c => roleOf(typeof CLASSES !== 'undefined' && CLASSES[c.cls] ? CLASSES[c.cls].role : 'dps');
  const buffName = id => (BUFFS[id] ? BUFFS[id].name : String(id).toUpperCase());

  // role passive
  { const ga0 = gearAffixes; gearAffixes = function (c) {
      const s = ga0.apply(this, arguments), h = heldTotem(c); if (!h) return s;
      for (const [k, v] of rolePassive(h.el, roleOfChar(c), h.w.rank || 1)) s[k] = (s[k] || 0) + v;
      return s;
    }; }
  // PLANT TOTEM
  function plant(b, u, p) {
    const c = u.ch, foes = b.enemiesOf(u), allies = b.party.filter(m => isChar(m) && !m.ch.dead);
    const en = TOTEM_ELEMENTS[p.element].name;
    let steps = [b.say(`${c.name} plants ${/^[AEIOU]/.test(en) ? 'an' : 'a'} ${en} TOTEM: ${p.name}!`, () => { if (SFX[p.school + '_cast']) SFX[p.school + '_cast'](); })];
    if (p.pulse && foes.length) steps = steps.concat(b.castSpell(u, { id: 'totem_' + p.element, name: p.name, school: p.school, lvl: 0, t: 'enemies', eff: 'dmg', save: 'CON', half: true, dice: p.pulse, dt: p.dt }, foes));
    if (p.temp) steps.push(b.say(`${c.name} gains a totem guard.`, () => { u.temp = (u.temp || 0) + Math.max(1, Math.round(maxHpOf(u) * p.temp / 100)); }));
    if (p.heal) steps.push(b.say(`The totem restores the party (${p.heal}% HP).`, () => { allies.forEach(m => b.heal(m, Math.max(1, Math.round(maxHpOf(m) * p.heal / 100)))); SFX.heal(); }));
    const fx = [];
    for (const id of p.self) if (BUFFS[id]) fx.push(() => addEffect(u, { id, rounds: p.rounds }));
    for (const id of p.party) if (BUFFS[id]) fx.push(() => allies.forEach(m => addEffect(m, { id, rounds: p.rounds })));
    for (const id of p.foes) if (BUFFS[id]) fx.push(() => b.enemiesOf(u).forEach(f => { if (alive(f)) addEffect(f, { id, rounds: p.rounds, src: u.id }); }));
    const names = [...new Set([...p.self, ...p.party, ...p.foes])].map(buffName);
    if (fx.length) steps.push(b.say(`Totem aura: ${names.join(', ')} for ${p.rounds} rounds.`, () => fx.forEach(f => f())));
    return steps;
  }
  { const ab0 = Battle.prototype.abilities; Battle.prototype.abilities = function (u) {
      const list = ab0.apply(this, arguments), c = u && u.ch, h = heldTotem(c);
      if (!c || !h) return list;
      const p = plantPlan(h.el, roleOfChar(c), h.w.rank || 1, h.w.rarity);
      this.totemUses = this.totemUses || {};
      const left = p.uses - (this.totemUses[u.id] || 0);
      list.unshift({ id: 'totem_plant', name: 'PLANT TOTEM', cost: left > 0 ? `${left}/${p.uses}` : 'USED', ok: left > 0 && !this.bonusUsed, bonus: true,
        fn: () => { this.totemUses[u.id] = (this.totemUses[u.id] || 0) + 1; return plant(this, u, p); } });
      return list;
    }; }
  // AI companions plant their totem on their first turn
  { const ai0 = Battle.prototype.aiTurn; Battle.prototype.aiTurn = function (u) {
      const c = u && u.ch, h = heldTotem(c);
      if (!h || this.bonusUsed || (this.totemUses && this.totemUses[u.id])) return ai0.apply(this, arguments);
      const a = this.abilities(u).find(x => x.id === 'totem_plant' && x.ok); if (!a) return ai0.apply(this, arguments);
      this.bonusUsed = true; const pre = a.fn();
      return pre.concat(ai0.apply(this, arguments) || []);
    }; }
  // item text
  if (typeof itemDesc === 'function') { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it); return it && it.kind === 'weapon' && totemOf(it.base) ? `${totemDesc(it.base)} ${s}` : s; }; }
}
})();
