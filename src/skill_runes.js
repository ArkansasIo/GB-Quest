'use strict';
(() => {
// ================================================================ SKILL RUNES (MAIN MENU > SKILL RUNES)
// Every active skill has three runes that add to what it does when you use it in battle. Equip one rune
// per skill; change them any time outside battle. Runes unlock at the skill's level +5, +15 and +30.
// Rune effects use the game's own buffs, conditions and healing, so resistances and immunities still apply.
// Pure rules are exported as GBQSkillRunes for tests; the game wiring runs only inside the game.

const RUNE_UNLOCK = [5, 15, 30];
// effect kinds: buffSelf / buffParty / debuffTarget / debuffFoes {id, rounds}; healSelf / healParty {pct};
// healTarget {pct}; extraHit (strike a second foe); summon {kind}; echo {chance} (skill may stay ready)
const SKILL_RUNES = {
  power_strike: [
    { id: 'cleave', name: 'CLEAVE', desc: 'Also strikes a second foe.', fx: [{ k: 'extraHit' }] },
    { id: 'sunder', name: 'SUNDER', desc: 'The target is SUNDERED for 2 rounds.', fx: [{ k: 'debuffTarget', id: 'sundered', rounds: 2 }] },
    { id: 'bloodletting', name: 'BLOODLETTING', desc: 'Heal yourself for 12% of max HP.', fx: [{ k: 'healSelf', pct: 12 }] },
  ],
  rally: [
    { id: 'war_cry', name: 'WAR CRY', desc: 'The party is MIGHTY for 2 rounds.', fx: [{ k: 'buffParty', id: 'might', rounds: 2 }] },
    { id: 'steadfast', name: 'STEADFAST', desc: 'The party is FORTIFIED for 2 rounds.', fx: [{ k: 'buffParty', id: 'fortify', rounds: 2 }] },
    { id: 'second_wind', name: 'SECOND WIND', desc: 'The party heals 10% of max HP.', fx: [{ k: 'healParty', pct: 10 }] },
  ],
  field_mend: [
    { id: 'renewal', name: 'RENEWAL', desc: 'The ally REGENERATES for 3 rounds.', fx: [{ k: 'buffTarget', id: 'regen', rounds: 3 }] },
    { id: 'sanctify', name: 'SANCTIFY', desc: 'The ally is BLESSED for 2 rounds.', fx: [{ k: 'buffTarget', id: 'bless', rounds: 2 }] },
    { id: 'overflow', name: 'OVERFLOW', desc: 'The whole party heals 6% of max HP.', fx: [{ k: 'healParty', pct: 6 }] },
  ],
  shadowstep: [
    { id: 'smoke', name: 'SMOKE BOMB', desc: 'All foes are BLINDED for 1 round.', fx: [{ k: 'debuffFoes', id: 'blinded', rounds: 1 }] },
    { id: 'swiftness', name: 'SWIFTNESS', desc: 'You are HASTED for 2 rounds.', fx: [{ k: 'buffSelf', id: 'haste', rounds: 2 }] },
    { id: 'predator', name: 'PREDATOR', desc: 'You gain FOCUS for 3 rounds.', fx: [{ k: 'buffSelf', id: 'focus', rounds: 3 }] },
  ],
  arcane_burst: [
    { id: 'frostbolt', name: 'FROSTBOLT', desc: 'The target gets FROSTBITE for 2 rounds.', fx: [{ k: 'debuffTarget', id: 'frostbite', rounds: 2 }] },
    { id: 'echo', name: 'ECHO', desc: '40% chance the burst stays ready.', fx: [{ k: 'echo', chance: 0.4 }] },
    { id: 'unravel', name: 'UNRAVEL', desc: 'All foes are WEAKENED for 2 rounds.', fx: [{ k: 'debuffFoes', id: 'weakened', rounds: 2 }] },
  ],
  spirit_call: [
    { id: 'pack', name: 'PACK LEADER', desc: 'A second spirit wolf answers.', fx: [{ k: 'summon', kind: 'wolf' }] },
    { id: 'howl', name: 'HOWL', desc: 'The party is MIGHTY for 2 rounds.', fx: [{ k: 'buffParty', id: 'might', rounds: 2 }] },
    { id: 'bond', name: 'SPIRIT BOND', desc: 'Heal yourself for 15% of max HP.', fx: [{ k: 'healSelf', pct: 15 }] },
  ],
  sunflare: [
    { id: 'dazzle', name: 'DAZZLE', desc: 'The target is BLINDED for 1 round.', fx: [{ k: 'debuffTarget', id: 'blinded', rounds: 1 }] },
    { id: 'judgement', name: 'JUDGEMENT', desc: 'The target is VULNERABLE for 2 rounds.', fx: [{ k: 'debuffTarget', id: 'vulnerable', rounds: 2 }] },
    { id: 'dawnlight', name: 'DAWNLIGHT', desc: 'The party heals 8% of max HP.', fx: [{ k: 'healParty', pct: 8 }] },
  ],
  warding_aura: [
    { id: 'briar', name: 'BRIAR WARD', desc: 'The party gains THORNSKIN for 3 rounds.', fx: [{ k: 'buffParty', id: 'thornskin', rounds: 3 }] },
    { id: 'quicken', name: 'QUICKENING', desc: 'The party is HASTED for 1 round.', fx: [{ k: 'buffParty', id: 'haste', rounds: 1 }] },
    { id: 'restore', name: 'RESTORATION', desc: 'The party heals 10% of max HP.', fx: [{ k: 'healParty', pct: 10 }] },
  ],
};
const runeUnlockLevel = (skillLevel, index) => Math.max(1, Math.floor(skillLevel) || 1) + RUNE_UNLOCK[index];
const runesUnlocked = (skillLevel, heroLvl) => RUNE_UNLOCK.filter((_, i) => heroLvl >= runeUnlockLevel(skillLevel, i)).length;
// the rune a hero can actually use for a skill (null when none chosen or it is still locked)
function activeRune(skillId, skillLevel, heroLvl, chosen) {
  const list = SKILL_RUNES[skillId] || [], i = list.findIndex(r => r.id === chosen);
  return i >= 0 && heroLvl >= runeUnlockLevel(skillLevel, i) ? list[i] : null;
}

if (typeof globalThis !== 'undefined') globalThis.GBQSkillRunes = { RUNE_UNLOCK, SKILL_RUNES, runeUnlockLevel, runesUnlocked, activeRune };

// ---------------------------------------------------------------- game wiring
if (typeof window === 'undefined' || typeof ACTIVE_SKILLS === 'undefined' || typeof Battle === 'undefined') return;

const skillDef = id => ACTIVE_SKILLS.find(s => s.id === id);
const runeOf = (c, id) => { const d = skillDef(id); return d ? activeRune(id, d.level, c.lvl, (c.skillRunes || {})[id]) : null; };
const effectOk = id => (typeof BUFFS !== 'undefined' && BUFFS[id]) || (typeof CONDITIONS !== 'undefined' && CONDITIONS[id]);

// apply a rune's effects after its skill resolves
function runeSteps(battle, u, t, skillId, rune) {
  const party = battle.party.filter(m => hpOf(m) > 0 && (!isChar(m) || !m.ch.dead)), foes = battle.foes.filter(f => hpOf(f) > 0);
  const heal = (m, pct) => battle.heal(m, Math.max(1, Math.round(maxHpOf(m) * pct / 100)));
  const instant = () => {
    if (SFX.buff) SFX.buff();
    for (const fx of rune.fx) {
      if (fx.k === 'echo') { if (R() < fx.chance) battle.skillUses.delete(skillId); continue; }
      if (fx.k === 'healSelf') { heal(u, fx.pct); continue; }
      if (fx.k === 'healParty') { party.forEach(m => heal(m, fx.pct)); continue; }
      if (fx.k === 'healTarget') { if (t) heal(t, fx.pct); continue; }
      if (!fx.id || !effectOk(fx.id)) continue;
      const hit = f => { if (hpOf(f) > 0 && !(f.condImm && f.condImm.includes(fx.id))) addEffect(f, { id: fx.id, rounds: fx.rounds, src: u.id }); };
      if (fx.k === 'buffSelf') addEffect(u, { id: fx.id, rounds: fx.rounds });
      else if (fx.k === 'buffParty') party.forEach(m => addEffect(m, { id: fx.id, rounds: fx.rounds }));
      else if (fx.k === 'buffTarget' && t) addEffect(t, { id: fx.id, rounds: fx.rounds });
      else if (fx.k === 'debuffTarget' && t) hit(t);
      else if (fx.k === 'debuffFoes') foes.forEach(hit);
    }
  };
  const steps = [battle.say(`RUNE ${rune.name}: ${rune.desc}`, instant)];
  for (const fx of rune.fx) {
    if (fx.k === 'extraHit') { const other = foes.filter(f => f !== t); if (other.length) steps.push(...battle.weaponAttack(u, pick(other), { single: true })); }
    if (fx.k === 'summon' && battle.party.length < 12 && typeof battle.addSummon === 'function') steps.push(battle.say('Another spirit answers!', () => battle.addSummon(u, fx.kind)));
  }
  return steps.filter(Boolean);
}
// wrap each active skill in the battle menu with its rune
{
  const ab0 = Battle.prototype.abilities;
  Battle.prototype.abilities = function (u) {
    const list = ab0.apply(this, arguments), c = u && u.ch; if (!c || c.ai) return list;
    for (const e of list) {
      const m = /^skill_(.+)$/.exec(e.id || ''); if (!m) continue;
      const rune = runeOf(c, m[1]); if (!rune) continue;
      const f0 = e.fn, battle = this, skillId = m[1];
      e.name = `${e.name}`.slice(0, 13) + '*';
      e.fn = function (t) { const out = f0.apply(this, arguments); return (Array.isArray(out) ? out : out ? [out] : []).concat(runeSteps(battle, u, t, skillId, rune)); };
    }
    return list;
  };
}

class SkillRuneScene extends ListScene {
  constructor() { super(5); }
  items() { return (G.activeSkills || []).map(skillDef).filter(d => d && d.classes.includes(G.cls)); }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    const d = this.items()[this.i]; if (!d) return;
    const runes = SKILL_RUNES[d.id] || [], open = runesUnlocked(d.level, G.lvl);
    const step = P('a') || P('select') ? 1 : 0;
    if (!step || !runes.length) return;
    G.skillRunes = G.skillRunes || {};
    const cur = runes.findIndex(r => r.id === G.skillRunes[d.id]);
    // cycle NONE -> unlocked runes -> NONE
    const order = [-1, ...runes.map((_, i) => i).filter(i => i < open)], next = order[(order.indexOf(cur) + 1) % order.length];
    if (order.length === 1) { SFX.error(); return say(`${d.name} runes unlock at level ${runeUnlockLevel(d.level, 0)}.`); }
    if (next < 0) delete G.skillRunes[d.id]; else G.skillRunes[d.id] = runes[next].id;
    SFX.toggle(); saveGame();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const L = this.items();
    text('SKILL RUNES', 4, 13, 'gold'); textR(`${L.length} SKILLS`, 156, 13, 2);
    if (!L.length) { textC('LEARN AN ACTIVE SKILL', 80, 60, 2); textC('IN GROWTH > SKILLS', 80, 70, 2); fill(0, 135, W, 9, 0); text('B:BACK', 3, 136, 2); return; }
    for (let r = 0; r < this.rows; r++) {
      const k = this.top + r, d = L[k]; if (!d) break;
      const y = 23 + r * 11, rn = runeOf(G, d.id);
      if (k === this.i) fill(2, y - 1, 152, 11, 1);
      text(d.name, 6, y + 1, 3); textR(rn ? rn.name : 'NO RUNE', 152, y + 1, rn ? 'gold' : 2);
    }
    this.scrollbar(155, 23, 54);
    const d = L[this.i]; if (!d) return;
    frame(2, 80, 156, 54);
    const runes = SKILL_RUNES[d.id] || [], onId = (G.skillRunes || {})[d.id];
    runes.forEach((rn, i) => {
      const y = 83 + i * 9, need = runeUnlockLevel(d.level, i), open = G.lvl >= need, on = onId === rn.id;
      text(`${on ? '>' : ' '}${rn.name}`, 6, y, on ? 'gold' : open ? 3 : 2, 1, 120);
      textR(open ? (on ? 'ON' : '') : `LV${need}`, 154, y, open ? 'gold' : 'red');
    });
    const show = runes.find(r => r.id === onId) || runes[0];
    if (show) wrap(show.desc, 25).slice(0, 2).forEach((l, i) => text(l, 6, 112 + i * 9, 2, 1, 154));
    fill(0, 135, W, 9, 0); text('A:NEXT RUNE', 3, 136, 'gold'); textR('B:BACK', 157, 136, 2);
  }
}
window.SkillRuneScene = SkillRuneScene;

if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('COMBAT ARTS'); L.splice(at >= 0 ? at + 1 : L.length, 0, 'SKILL RUNES'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'SKILL RUNES') { SFX.select(); return push(new SkillRuneScene()); } return u0.apply(this, arguments); };
}
window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { 'SKILL RUNES': 'Three runes per active skill change what it does in battle.' });
})();
