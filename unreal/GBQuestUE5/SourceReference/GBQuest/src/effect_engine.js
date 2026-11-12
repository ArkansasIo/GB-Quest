'use strict';
// ================================================================ EFFECT ENGINE: what active buffs and debuffs do in combat
// One place that turns a unit's active effects (BUFFS in src/data_world.js) into combat numbers, so every buff and
// debuff changes the fight the way its description says, for heroes, companions and monsters alike.
// Pure functions: no game state, no randomness. src/combat.js calls them for attack rolls, AC, saves, crits, dodge,
// haste, damage dealt and taken, resistance, thorns and extra attacks.
//
// A BUFFS entry may carry:
//   mods   numeric deltas, multiplied by stacks (see MOD_KEYS)
//   dice   dice added to a roll each time it is made, e.g. { hit: '1d4', saves: '1d4' } (BLESSED)
//   once   a bonus spent by the next roll of that kind, e.g. { hit: 3, saves: 3 } (INSPIRED is used up by either)
//   flags  advantage-style switches read by condFlag(): attackAdv, attackedDis, saveAdv
//
// Heroes' saved buffs (food, potions, tier guards kept between fights: character.buffs, marked persist: true in
// battle) are already part of derive() through gearAffixes(), so their DERIVED_KEYS are skipped here for heroes;
// counting them again was how a saved HASTED once gave +4 AC.
(() => {
  const MOD_KEYS = {
    hit: 'attack rolls (weapon, spell and monster attacks)',
    saves: 'saving throws',
    acb: 'armour class',
    crit: '% chance that a hit becomes a critical hit',
    dodge: '% chance to dodge an attack that hits',
    haste: '% chance of an extra action at the start of each turn',
    dmg: '% damage dealt (every kind of damage)',
    resist: '% less damage taken (every kind)',
    takenPct: '% more damage taken (every kind)',
    thorns: 'damage dealt back to melee attackers',
    extraAttack: 'extra attacks with each attack action',
    hpPct: '% maximum HP (saved buffs only: applied through derive)',
  };
  // keys derive() already includes for a hero's saved buffs (gearAffixes sums character.buffs[].mods)
  const DERIVED_KEYS = new Set(['hit', 'saves', 'acb', 'crit', 'dodge', 'haste', 'dmg', 'resist', 'thorns', 'hpPct', 'hp', 'heal', 'leech', 'block', 'critdmg']);
  // combined gear + effect ceilings in combat (gear alone stays at SUBSTATS[].max; effects may push past it)
  const CAPS = { crit: 75, dodge: 60, haste: 75, resist: 75 };

  const stacksOf = e => Math.max(1, Number(e.stacks) || 1);
  const skip = (e, hero, key) => hero && e.persist && DERIVED_KEYS.has(key);

  // summed numeric mods of every active effect (stacks multiply); hero = the unit is a player character
  function mods(effects, table, hero = false) {
    const out = {};
    for (const e of effects || []) {
      const def = table[e.id]; if (!def || !def.mods) continue;
      for (const k in def.mods) {
        if (skip(e, hero, k)) continue;
        const v = Number(def.mods[k]); if (!Number.isFinite(v)) continue;
        out[k] = (out[k] || 0) + v * stacksOf(e);
      }
    }
    return out;
  }
  // dice expressions added to a roll of this kind ('hit' or 'saves'), one per stack
  function dice(effects, table, kind) {
    const out = [];
    for (const e of effects || []) { const d = table[e.id] && table[e.id].dice && table[e.id].dice[kind]; if (d) for (let i = 0; i < stacksOf(e); i++) out.push(d); }
    return out;
  }
  // one-shot bonuses for a roll of this kind: [{ id, value }]; the caller removes each effect after using it
  function onceBonuses(effects, table, kind) {
    const out = [];
    for (const e of effects || []) { const o = table[e.id] && table[e.id].once; if (o && Number.isFinite(o[kind])) out.push({ id: e.id, value: o[kind] }); }
    return out;
  }
  const flag = (effects, table, name) => (effects || []).some(e => table[e.id] && table[e.id].flags && table[e.id].flags[name]);
  const cap = (key, v) => Math.max(key === 'resist' ? -100 : 0, Math.min(CAPS[key] == null ? Infinity : CAPS[key], v));

  // a one-line, player-facing description generated from the numbers, so text and effect cannot drift apart
  function describe(def) {
    if (!def) return '';
    const parts = [], m = def.mods || {}, sign = v => (v > 0 ? '+' : '') + v;
    if (def.dice && def.dice.hit) parts.push(`+${def.dice.hit} to attack rolls`);
    if (def.dice && def.dice.saves) parts.push(`+${def.dice.saves} to saving throws`);
    if (def.once) parts.push(`${sign(def.once.hit || def.once.saves)} to the next attack roll or saving throw`);
    if (m.hit) parts.push(`${sign(m.hit)} to attack rolls`);
    if (m.saves) parts.push(`${sign(m.saves)} to saving throws`);
    if (m.acb) parts.push(`${sign(m.acb)} AC`);
    if (m.extraAttack) parts.push(`${m.extraAttack} extra attack${m.extraAttack > 1 ? 's' : ''} per attack action`);
    if (m.haste) parts.push(m.haste > 0 ? `${m.haste}% chance of an extra action each turn` : `${-m.haste}% less chance of extra actions`);
    if (m.crit) parts.push(`${sign(m.crit)}% critical chance`);
    if (m.dodge) parts.push(`${sign(m.dodge)}% dodge`);
    if (m.dmg) parts.push(`${sign(m.dmg)}% damage dealt`);
    if (m.resist) parts.push(`${m.resist}% less damage taken`);
    if (m.takenPct) parts.push(`${m.takenPct}% more damage taken`);
    if (m.thorns) parts.push(`melee attackers take ${m.thorns} damage`);
    if (m.hpPct) parts.push(`${sign(m.hpPct)}% maximum HP`);
    if (def.tick && def.tick.healPct) parts.push(`heals ${def.tick.healPct}% of maximum HP each turn`);
    if (def.tick && def.tick.dice) parts.push(`${def.tick.dice} ${def.tick.type} damage each turn per stack, +1 per 3 levels of whoever applied it`);
    if (def.flags && def.flags.attackAdv) parts.push('advantage on attacks');
    if (def.flags && def.flags.attackedDis) parts.push('attacks against you have disadvantage');
    if (def.flags && def.flags.saveAdv) parts.push('advantage on saving throws');
    let s = parts.join(', ');
    if (def.stack) s += ` (stacks up to ${def.stack})`;
    return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : '';
  }

  const api = { MOD_KEYS, DERIVED_KEYS, CAPS, mods, dice, onceBonuses, flag, cap, describe };
  // give every buff/debuff without a hand-written description one generated from its numbers
  if (typeof BUFFS !== 'undefined') for (const id in BUFFS) if (!BUFFS[id].desc) BUFFS[id].desc = describe(BUFFS[id]);
  if (typeof window !== 'undefined') window.GBQEffects = api;
  if (typeof globalThis !== 'undefined') globalThis.GBQEffects = api;
})();
