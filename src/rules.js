// LOST KINGDOM OF SHADOWBANE CHRONICLES rules core: character derivation (9 attributes, proficiency, AC, saves, skills,
// substats), spells & slots, resources, checks, equipment/attunement, rests, levelling 1-720,
// and monster stat blocks built from level.
'use strict';

// ================================================================ characters
function newCharacter(o) {
  const cls = CLASSES[o.cls], sp = SPECIES[o.species];
  const prio = [cls.primary, ...['CON', 'DEX', 'WIS', 'STR', 'INT', 'CHA'].filter(a => a !== cls.primary)];
  if (cls.cast && cls.cast !== cls.primary) { prio.splice(prio.indexOf(cls.cast), 1); prio.splice(1, 0, cls.cast); }
  const base = {}; prio.slice(0, 6).forEach((a, i) => base[a] = STANDARD_ARRAY[i]);
  if (o.scores) for (const a of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) if (Number.isFinite(o.scores[a])) base[a] = Math.max(3, Math.min(18, o.scores[a])); // from the creator (before species bonus)
  for (const a in sp.asi) base[a] += sp.asi[a];
  base.LCK = 10 + (sp.traits.includes('lucky') ? 2 : 0); base.WIL = 10 + (o.cls === 'ascetic' || o.cls === 'chaplain' ? 2 : 0); base.SPD = 10 + (o.cls === 'shade' || o.cls === 'strider' ? 2 : 0);
  const c = { name: o.name, species: o.species, cls: o.cls, bg: o.bg || 'wanderer', sub: null, lvl: 1, xp: 0, base,
    feats: [], talents: [], talentPts: 0, skillPts: 0, activeSkills: [], passiveSkills: [], ascAttr: {}, ascSub: {}, boons: [], pending: { asi: 0, sub: false, boon: 0 }, ascPts: 0, subPts: 0,
    eq: {}, hp: 1, hd: 1, res: {}, buffs: [], ai: o.ai || false, look: o.look || null, portrait: o.portrait || null, extraSkill: sp.traits.includes('versatile') ? 'perception' : null };
  (cls.gear || []).forEach(b => { const it = WEAPONS[b] ? makeItem({ kind: 'weapon', base: b, rarity: 1, lvl: 1 }) : makeItem({ kind: 'armor', base: b, rarity: 1, lvl: 1 }); c.eq[itemSlot(it)] = it; });
  const D = derive(c); c.hp = D.hpMax; c.hd = D.hdMax; c.res = resMax(c, D);
  return c;
}
const classLevel = c => Math.min(c.lvl, CLASS_LEVEL_CAP);
// saves from before the 12-slot update kept rings and amulets in one 'trinket' slot
function migrateGear(c) {
  if (!c || !c.eq) return;
  const fixItem = it => { if (it && it.kind === 'wondrous') { const w = WONDROUS.find(x => x.id === it.base); if (w) it.slot = w.slot; } };
  (c.bag || []).forEach(fixItem); Object.values(c.eq).forEach(fixItem);
  if (c.eq.trinket) { const it = c.eq.trinket; delete c.eq.trinket; const to = it.slot === 'neck' ? 'neck' : !c.eq.ring1 ? 'ring1' : 'ring2'; if (c.eq[to]) (c.bag || (c.bag = [])).push(it); else c.eq[to] = it; }
}
// ability order a class wants: primary, casting stat, then CON DEX WIS STR INT CHA
function abilityPriority(clsId) {
  const cls = CLASSES[clsId], prio = [cls.primary, ...['CON', 'DEX', 'WIS', 'STR', 'INT', 'CHA'].filter(a => a !== cls.primary)];
  if (cls.cast && cls.cast !== cls.primary) { prio.splice(prio.indexOf(cls.cast), 1); prio.splice(1, 0, cls.cast); }
  return prio.slice(0, 6);
}
// the hero's chosen looks (fall back to the class art)
const heroLook = c => (c && c.look && IMG[`gh_${c.look}_down0`]) ? c.look : c ? c.cls : 'warden';
const heroPortrait = c => (c && c.portrait && IMG[c.portrait]) ? c.portrait : classPortrait(c.cls);
const hasFeature = (c, f) => CLASSES[c.cls].features.some(([l, id]) => id === f && classLevel(c) >= l);
const subKey = (c, k) => { if (!c.sub || classLevel(c) < 3) return 0; const s = CLASSES[c.cls].subs.find(x => x.id === c.sub); return (s && s.keys[k]) || 0; };
const profBonus = c => 2 + Math.floor((classLevel(c) - 1) / 4) + Math.floor(Math.max(0, c.lvl - 20) / 60);

function gearAffixes(c) {
  const s = {};
  for (const slot of SLOTS) { const it = c.eq[slot]; if (!it) continue; for (const [k, v] of it.affixes || []) s[k] = (s[k] || 0) + v; if (typeof gemAffixes === 'function') for (const [k, v] of Object.entries(gemAffixes(it))) s[k] = (s[k] || 0) + v; if (typeof runeAffixes === 'function') for (const [k, v] of Object.entries(runeAffixes(it))) s[k] = (s[k] || 0) + v; if (typeof tierImplicit === 'function') for (const [k, v] of tierImplicit(it)) s[k] = (s[k] || 0) + v; }
  for (const k in c.ascSub || {}) s[k] = (s[k] || 0) + c.ascSub[k] * (AFFIX_K[k] || 1);
  for (const k in c.bond || {}) s[k] = (s[k] || 0) + c.bond[k] * (AFFIX_K[k] || 1); // companion bond tier
  if (typeof armorSetBonus === 'function') for (const [k, v] of armorSetBonus(c)) s[k] = (s[k] || 0) + v; // armour class sets
  for (const tree of TALENT_TREES) for (const talent of tree.nodes) {
    if (c.talents && c.talents.includes(talent.id)) {
      for (const k in talent.mods) s[k] = (s[k] || 0) + talent.mods[k];
    }
  }
  for (const b of c.boons || []) { const bo = MYTHIC_BOONS.find(x => x.id === b); if (bo) for (const k in bo.sub) s[k] = (s[k] || 0) + bo.sub[k]; }
  for (const bf of c.buffs || []) { const def = BUFFS[bf.id]; if (def && def.mods) for (const k in def.mods) s[k] = (s[k] || 0) + def.mods[k] * (bf.stacks || 1); }
  return s;
}
// sum of wondrous bonuses of one kind over every equipped slot
function wondrousBonus(c, kind) { let n = 0; for (const slot of SLOTS) { const it = c.eq[slot]; if (it && it.kind === 'wondrous') { const w = WONDROUS.find(x => x.id === it.base); if (w && w.bonus === kind) n += Math.max(1, it.plus); } } return n; }
function derive(c) {
  const cls = CLASSES[c.cls], sp = SPECIES[c.species], CL = classLevel(c), pb = profBonus(c);
  const A = {}; for (const a of ATTRS) A[a] = (c.base[a] || 10) + (c.ascAttr[a] || 0);
  // wondrous 'abil' items raise the primary ability
  A[cls.primary] += 2 * wondrousBonus(c, 'abil');
  const M = {}; for (const a of ATTRS) M[a] = mod(A[a]);
  const sub = gearAffixes(c);
  // hit points
  const hd = cls.hd, conM = M.CON;
  let hpMax = hd + conM + (CL - 1) * (hd / 2 + 1 + conM) + Math.max(0, c.lvl - 20) * (hd / 2 + Math.max(1, conM));
  if (c.feats.includes('tough')) hpMax += 2 * c.lvl;
  if ((c.passiveSkills || []).includes('vitality')) hpMax = Math.round(hpMax * 1.1);
  hpMax += (sub.hp || 0); hpMax = Math.round(hpMax * (1 + (sub.hpPct || 0) / 100));
  hpMax += 6 * wondrousBonus(c, 'hp') * Math.max(1, Math.floor(c.lvl / 5));
  hpMax = Math.max(1, Math.round(hpMax));
  // armour class
  const armor = c.eq.armor && ARMORS[c.eq.armor.base], shield = c.eq.offhand && ARMORS[c.eq.offhand.base];
  let ac;
  if (armor) ac = armor.ac + (armor.dexMax == null ? M.DEX : Math.min(armor.dexMax, M.DEX)) + Math.max(0, c.eq.armor.plus) + (typeof tierAC === 'function' ? tierAC(c.eq.armor) : 0);
  else if (hasFeature(c, 'unarmored_con')) ac = 10 + M.DEX + M.CON;
  else if (hasFeature(c, 'unarmored_wis')) ac = 10 + M.DEX + M.WIS;
  else if (subKey(c, 'draconic')) ac = 13 + M.DEX;
  else ac = 10 + M.DEX;
  if (shield) ac += 2 + Math.max(0, c.eq.offhand.plus);
  if (armor && hasFeature(c, 'style_def')) ac += 1;
  ac += wondrousBonus(c, 'ac');
  ac += Math.min(SUBSTATS.acb.max, sub.acb || 0);
  // saves
  const saveProf = new Set(cls.saves); if (c.feats.includes('resilient')) saveProf.add('CON');
  const saveItem = wondrousBonus(c, 'save');
  const passiveSave = (c.passiveSkills || []).includes('resilience') ? 1 : 0;
  const saves = {}; for (const a of ATTRS) saves[a] = M[a] + (saveProf.has(a) ? pb : 0) + saveItem + (sub.saves || 0) + passiveSave;
  // skills
  const profSkills = new Set([...(cls.skills || []).slice(0, 3), ...BACKGROUNDS[c.bg].skills]); if (c.extraSkill) profSkills.add(c.extraSkill);
  if (sp.traits.includes('keen')) profSkills.add('perception');
  const expertise = new Set(cls.expertise || []);
  const skills = {}; for (const k in SKILLS) { const p = profSkills.has(k) ? (expertise.has(k) ? 2 * pb : pb) : (hasFeature(c, 'jack') ? Math.floor(pb / 2) : 0); skills[k] = M[SKILLS[k]] + p; }
  if ((c.passiveSkills || []).includes('nature_lore')) { skills.nature += 2; skills.animal += 2; }
  // weapon
  const wi = c.eq.weapon, wd = wi ? WEAPONS[wi.base] : null;
  const props = wd ? wd.props : '';
  const twoHand = props.includes('2');
  let dice = wd ? ((props.includes('v') && !shield) ? wd.vdmg : wd.dmg) : '1d1';
  let abil = props.includes('r') ? 'DEX' : props.includes('f') ? (M.DEX > M.STR ? 'DEX' : 'STR') : 'STR';
  if (hasFeature(c, 'martial') && (!wd || wd.cat === 'simple')) { const md = CL >= 17 ? 10 : CL >= 11 ? 8 : CL >= 5 ? 6 : 4; const cur = wd ? +dice.split('d')[1] : 1; if (md > cur) dice = `1d${md}`; abil = M.DEX > M.STR ? 'DEX' : 'STR'; }
  const profW = !wd || wd.cat === 'simple' || cls.weapons === 'martial' || (cls.weapons === 'finesse' && props.includes('f'));
  const magic = wi ? Math.max(0, wi.plus) : 0, rankDmg = wi ? (typeof tierDmg === 'function' ? tierDmg(wi) : 0) : 0; // gear tier adds flat damage
  const passivePrecision = (c.passiveSkills || []).includes('precision') ? 1 : 0;
  let hit = M[abil] + (profW ? pb : 0) + magic + (sub.hit || 0) + wondrousBonus(c, 'hit') + passivePrecision;
  if (props.includes('r') && hasFeature(c, 'style_arch')) hit += 2;
  if (props.includes('r') && c.feats.includes('sharpshot')) hit += 2;
  const weapon = { name: wd ? wd.name : 'FISTS', dice, type: wd ? wd.type : 'bludgeoning', abil, hit, dmg: M[abil] + magic + rankDmg, magic: magic > 0 || (wi && wi.legend), ranged: props.includes('r'), twoHand,
    extra: wi && wi.legend ? { dice: wi.legend.extra, type: wi.legend.etype } : null };
  let attacks = 1;
  if (hasFeature(c, 'extra3')) attacks = 4; else if (hasFeature(c, 'extra2')) attacks = 3; else if (hasFeature(c, 'extra1') || (subKey(c, 'valor') && CL >= 6)) attacks = 2;
  // spellcasting
  let spell = null;
  if (cls.caster) {
    const cm = M[cls.cast]; let slots = [], pact = null, maxL = 0;
    if (cls.caster === 'full') slots = FULL_SLOTS[CL - 1].slice();
    else if (cls.caster === 'half') slots = CL >= 2 ? FULL_SLOTS[Math.ceil(CL / 2) - 1].slice(0, 5) : [];
    else if (cls.caster === 'pact') { pact = { n: PACT_SLOTS[CL - 1], lvl: Math.min(5, Math.ceil(CL / 2)) }; }
    maxL = pact ? pact.lvl : slots.length;
    const arcanum = cls.caster === 'pact' ? [[11, 6], [13, 7], [15, 8], [17, 9]].filter(([l]) => CL >= l).map(([, s]) => s) : [];
    const known = SPELLS.filter(s => s.cls.includes(c.cls) && (s.lvl <= maxL || arcanum.includes(s.lvl)));
    if (c.species === 'emberborn' && !known.find(s => s.id === 'emberdart')) known.unshift(SPELLS.find(s => s.id === 'emberdart'));
    spell = { abil: cls.cast, mod: cm, dc: 8 + pb + cm + Math.floor((sub.hit || 0) / 2), atk: pb + cm + (sub.hit || 0) + passivePrecision, slots, pact, maxL, arcanum, known };
  } else if (c.species === 'emberborn') {
    const cm = M.CHA; spell = { abil: 'CHA', mod: cm, dc: 8 + pb + cm, atk: pb + cm + passivePrecision, slots: [], pact: null, maxL: 0, arcanum: [], known: [SPELLS.find(s => s.id === 'emberdart')] };
  }
  const res = new Set(sp.res || []);
  return {
    c, cls, sp, CL, pb, A, M, sub, hpMax, hdMax: Math.min(c.lvl, 20), ac, saves, skills, weapon, attacks, spell, res,
    init: M.DEX + M.SPD + (c.feats.includes('alert') ? 5 : 0) + ((c.passiveSkills || []).includes('swift') ? 2 : 0) + Math.floor((sub.haste || 0) / 10) + wondrousBonus(c, 'init'),
    passive: 10 + skills.perception,
    critRange: 20 - subKey(c, 'critRange'),
    crit: Math.min(SUBSTATS.crit.max, (sub.crit || 0) + Math.max(0, M.LCK)),
    critdmg: 100 + (sub.critdmg || 0),
    dodge: Math.min(SUBSTATS.dodge.max, (sub.dodge || 0) + ((c.passiveSkills || []).includes('swift') ? 5 : 0) + Math.max(0, Math.floor(M.SPD / 2))),
    block: Math.min(SUBSTATS.block.max, (sub.block || 0) + (shield ? 5 : 0)),
    leech: Math.min(SUBSTATS.leech.max, sub.leech || 0), haste: Math.min(SUBSTATS.haste.max, (sub.haste || 0) + Math.max(0, M.SPD) * 2),
    dmgPct: (sub.dmg || 0) + ((c.passiveSkills || []).includes('arcane_focus') ? 5 : 0) + ((c.passiveSkills || []).includes('ferocity') ? 5 : 0), healPct: (sub.heal || 0) + Math.max(0, M.WIS) + ((c.passiveSkills || []).includes('healing_hands') ? 10 : 0), resistAll: Math.min(SUBSTATS.resist.max, sub.resist || 0),
    thorns: sub.thorns || 0, mf: (sub.mf || 0) + Math.max(0, M.LCK) * 5, gf: sub.gf || 0, xpPct: sub.xp || 0,
    condSave: Math.max(0, M.WIL), elem: { fire: sub.fire || 0, cold: sub.cold || 0, lightning: sub.lightning || 0, necrotic: sub.necrotic || 0, radiant: sub.radiant || 0 },
  };
}

// ---------------------------------------------------------------- resources
function resMax(c, D) {
  D = D || derive(c); const CL = D.CL, r = {};
  if (D.spell) { r.slots = D.spell.slots.slice(); if (D.spell.pact) r.pact = D.spell.pact.n; r.arcanum = D.spell.arcanum.slice(); }
  if (hasFeature(c, 'rage')) r.rage = CL >= 17 ? 6 : CL >= 12 ? 5 : CL >= 6 ? 4 : CL >= 3 ? 3 : 2;
  if (hasFeature(c, 'ki')) r.ki = CL;
  if (hasFeature(c, 'sorcery')) r.sp = CL;
  if (hasFeature(c, 'inspire')) r.inspire = Math.max(1, D.M.CHA);
  if (hasFeature(c, 'channel')) r.channel = CL >= 18 ? 3 : CL >= 6 ? 2 : 1;
  if (hasFeature(c, 'wildshape')) r.wild = 2;
  if (hasFeature(c, 'surge')) r.surge = hasFeature(c, 'surge2') ? 2 : 1;
  if (hasFeature(c, 'secondwind')) r.wind = 1;
  if (hasFeature(c, 'layhands')) r.layhands = 5 * CL;
  if (hasFeature(c, 'indomitable')) r.indomitable = 1;
  if (c.species === 'drakkin') r.breath = 1;
  if (subKey(c, 'maneuver')) r.maneuver = 4;
  if (subKey(c, 'sacred') || subKey(c, 'feypresence') || subKey(c, 'tempest')) r.subpower = 1;
  if (hasFeature(c, 'recovery') || subKey(c, 'landrecover')) r.recovery = 1;
  if (c.feats.includes('lucky')) r.lucky = 3;
  return r;
}
const SHORT_KEYS = ['pact', 'ki', 'wild', 'surge', 'wind', 'channel', 'breath', 'maneuver', 'subpower'];
function shortRest(c, songOfRest = false) {
  const D = derive(c), max = resMax(c, D); const log = [];
  for (const k of SHORT_KEYS) if (max[k] != null) c.res[k] = max[k];
  if (D.CL >= 5 && max.inspire != null) c.res.inspire = max.inspire;
  // spend hit dice to heal
  let healed = 0;
  while (c.hp < D.hpMax && c.hd > 0) { const h = Math.max(1, roll(`1d${D.cls.hd}`).total + D.M.CON); c.hp = Math.min(D.hpMax, c.hp + h); healed += h; c.hd--; }
  if (songOfRest && healed) { const b = roll('1d6').total; c.hp = Math.min(D.hpMax, c.hp + b); healed += b; }
  // arcane / natural recovery: regain slot levels up to ceil(CL/2), once per long rest
  if (c.res.recovery && c.res.slots && max.slots) {
    let budget = Math.ceil(D.CL / 2);
    for (let l = Math.min(5, max.slots.length) - 1; l >= 0 && budget > 0; l--) while (c.res.slots[l] < max.slots[l] && budget >= l + 1) { c.res.slots[l]++; budget -= l + 1; }
    c.res.recovery = 0; log.push('Recovered spell slots.');
  }
  if (healed) log.push(`Spent hit dice: +${healed} HP.`);
  return log;
}
function longRest(c) {
  const D = derive(c); c.hp = D.hpMax; c.res = resMax(c, D);
  c.hd = Math.min(D.hdMax, c.hd + Math.max(1, Math.floor(D.hdMax / 2)));
  c.buffs = (c.buffs || []).filter(b => BUFFS[b.id] && BUFFS[b.id].good && b.fights > 0);
  delete c.dying; delete c.dead;
}

// ================================================================ checks (out of combat)
function skillCheck(c, skill, dc, adv = 0) {
  const D = derive(c); let r1 = d20(), r2 = d20();
  if (D.sp.traits.includes('lucky') && r1 === 1) r1 = d20();
  let r = adv > 0 ? Math.max(r1, r2) : adv < 0 ? Math.min(r1, r2) : r1;
  if (hasFeature(c, 'reliable') && r < 10 && D.skills[skill] > D.M[SKILLS[skill]]) r = 10;
  const total = r + D.skills[skill];
  return { roll: r, bonus: D.skills[skill], total, dc, ok: total >= dc, text: `${SKILL_NAME[skill]} d20 ${r}${D.skills[skill] >= 0 ? '+' : ''}${D.skills[skill]}=${total} vs DC${dc}` };
}

// ================================================================ equipment
function canEquip(c, it) {
  const cls = CLASSES[c.cls];
  if (it.kind === 'armor') { const a = ARMORS[it.base]; if (!cls.armor.includes(a.type)) return `${cls.name} can't use ${a.type} armour.`; if (a.type === 'shield' && c.eq.weapon && WEAPONS[c.eq.weapon.base].props.includes('2')) return 'Two-handed weapon equipped.'; }
  if (it.kind === 'weapon' && WEAPONS[it.base].props.includes('2') && c.eq.offhand) return 'Remove your shield first.';
  if (it.attune) { const n = SLOTS.filter(s => c.eq[s] && c.eq[s].attune && !slotsFor(it).includes(s)).length; if (n >= MAX_ATTUNE) return 'Attuned to 3 items already.'; }
  return null;
}
// which slots an item can go in (rings and trinkets: either of their two slots)
const slotsFor = it => { const s = itemSlot(it); return s === 'ring1' ? ['ring1', 'ring2'] : s === 'trinket1' ? ['trinket1', 'trinket2'] : [s]; };
const fitsSlot = (it, slot) => slotsFor(it).includes(slot);
function equipItem(c, it, bag, want) {
  const why = canEquip(c, it); if (why) return why;
  const opts = slotsFor(it), slot = want && opts.includes(want) ? want : (opts.find(s => !c.eq[s]) || opts[0]), old = c.eq[slot];
  const i = bag.indexOf(it); if (i >= 0) bag.splice(i, 1);
  if (old) bag.push(old);
  c.eq[slot] = it;
  const D = derive(c); c.hp = Math.min(c.hp, D.hpMax);
  return null;
}
function itemScore(c, it) { // rough value for "upgrade" arrows
  const p = Math.max(0, it.plus) * 10 + (it.ilvl || 1) * 0.5 + (it.affixes || []).reduce((a, [, v]) => a + v, 0) * 0.3;
  if (it.kind === 'weapon') return p + diceAvg(WEAPONS[it.base].dmg) * 3;
  if (it.kind === 'armor') return p + ARMORS[it.base].ac * 3;
  return p;
}

// ================================================================ levelling 1-720
function gainXP(c, amount) {
  const D = derive(c); amount = Math.round(amount * (1 + D.xpPct / 100));
  c.xp += amount; const ups = [];
  while (c.lvl < LEVEL_CAP && c.xp >= xpForLevel(c.lvl + 1)) {
    const before = derive(c);
    c.lvl++;
    const g = { lvl: c.lvl, notes: [] };
    if (c.lvl <= 20) {
      if ([4, 8, 12, 16, 19].includes(c.lvl)) { c.pending.asi++; g.notes.push('ABILITY SCORE INCREASE!'); }
      if (c.lvl === 3) { c.pending.sub = true; g.notes.push('CHOOSE A SUBCLASS!'); }
      CLASSES[c.cls].features.filter(([l]) => l === c.lvl).forEach(([, f]) => g.notes.push('NEW: ' + FEATURE_NAME[f]));
      const after = derive(c);
      if (after.spell && before.spell && after.spell.maxL > before.spell.maxL) g.notes.push(`SPELL LEVEL ${after.spell.maxL} UNLOCKED`);
    } else {
      c.ascPts += ASCENSION.attrPerLevel; c.subPts += ASCENSION.subPerLevel; g.notes.push('+1 ATTRIBUTE, +2 SUBSTAT POINTS');
      if (c.lvl % ASCENSION.boonEvery === 0) { c.pending.boon++; g.notes.push('MYTHIC BOON AVAILABLE!'); }
    }
    if ([5, 10, 15, 20].includes(c.lvl)) {
      c.talentPts = (c.talentPts || 0) + 1;
      g.notes.push('TALENT POINT AVAILABLE!');
    }
    if (c.lvl % 3 === 0) { c.skillPts = (c.skillPts || 0) + 1; g.notes.push('ACTIVE / PASSIVE SKILL POINT!'); }
    const D2 = derive(c); g.hp = D2.hpMax - before.hpMax; c.hp = D2.hpMax; c.res = resMax(c, D2); c.hd = D2.hdMax;
    ups.push(g);
  }
  return { amount, ups };
}

// ================================================================ monsters
const FAMILY_TRAITS = {
  undead: { imm: ['poison'], res: ['necrotic'], condImm: ['poisoned', 'charmed', 'asleep'] }, construct: { imm: ['poison', 'psychic'], condImm: ['poisoned', 'charmed', 'frightened'] },
  fiend: { res: ['fire'] }, ooze: { res: ['acid'], condImm: ['blinded', 'charmed', 'frightened', 'prone'] }, celestial: { res: ['radiant'] },
  aberration: { res: ['psychic'] }, elemental: { condImm: ['poisoned', 'asleep', 'paralyzed'] }, dragon: { condImm: ['frightened'] }, plant: { vuln: ['fire'] },
};
function abScores(role, L) {
  const g = Math.min(20, Math.floor(L / 2)) + Math.floor(Math.max(0, L - 40) / 4);
  const base = { STR: 10, DEX: 10, CON: 10, INT: 6, WIS: 10, CHA: 6 };
  const boost = { brute: ['STR', 'CON'], guard: ['CON', 'STR'], skirm: ['DEX', 'CON'], swift: ['DEX', 'WIS'], pack: ['DEX', 'STR'], venom: ['DEX', 'CON'], caster: ['INT', 'WIS', 'CHA'] }[role] || ['STR', 'CON'];
  boost.forEach((a, i) => base[a] += g + 4 - i * 2);
  return base;
}
function dmgDice(per) { per = Math.max(1, per); const n = Math.max(1, Math.round(per * 0.6 / 4.5)); const b = Math.max(0, Math.round(per - n * 4.5)); return `${n}d8${b ? '+' + b : ''}`; }
function makeMonster(src, L, diff = 2, extra = {}) {
  const D = DIFFICULTY[diff - 1] || DIFFICULTY[1];
  L = Math.max(1, Math.round(L + D.lvl));
  let name, spr, fam, role = 'brute', attacks, multi, res = [], imm = [], vuln = [], traits = [], spells = [], legendary = 0, summon = null, profile = {}, ab, boss = false, elite = false, mechs = [], scale = 1, uniqueKey = null, bestId = null;
  if (typeof src === 'string' && MONSTERS[src]) src = { unique: src };
  if (src.unique || (src.cat && MONSTERS[src.unique])) {
    const m = MONSTERS[src.unique]; uniqueKey = src.unique;
    name = src.name || m.name; spr = m.spr; fam = m.type; ab = m.ab.slice(); multi = m.multi || 1; res = (m.res || []).slice(); imm = (m.imm || []).slice(); vuln = (m.vuln || []).slice();
    traits = (m.tr || []).slice(); spells = (m.spells || []).slice(); legendary = m.legendary || 0; summon = m.summon || null; boss = !!m.boss || !!src.cat; elite = !!m.rare; scale = m.scale || 1;
    attacks = m.a.map(a => ({ name: a[0], type: a[3], eff: a[4] || null, share: diceAvg(a[2]) }));
    profile = { hp: boss ? 4 : elite ? 2.5 : 1, dmg: boss ? 1.3 : elite ? 1.3 : 1, ac: m.ac - 13 };
    if (src.cat) { mechs = src.mechs || []; profile.hp = src.cat === 'arc' ? 6 : 4; }
  } else {
    const b = src.cat ? BEAST_BY_ID[src.base] || BESTIARY[0] : src; bestId = b.id;
    name = src.cat ? src.name : b.name; spr = src.cat ? src.spr || b.spr : b.spr; fam = b.fam; role = b.role;
    const rp = ROLE_PROFILE[role] || ROLE_PROFILE.brute, rk = RANKS.find(r => r.id === b.rank) || RANKS[1];
    ab = (() => { const s = abScores(role, L); return ATTRS.slice(0, 6).map(a => s[a]); })();
    multi = rp.multi; res = b.res.slice();
    const atkName = { pack: 'BITE', swift: 'CLAW', venom: 'FANG', brute: 'SLAM', skirm: 'BLADE', caster: 'HEX BOLT', guard: 'STRIKE' }[role] || 'STRIKE';
    attacks = [{ name: atkName, type: b.dt, eff: rp.cond === 'venom' ? { buff: 'venom', save: 'CON' } : null, share: 1 }];
    profile = { hp: rp.hp * rk.hp, dmg: rp.dmg * rk.dmg, ac: rp.ac }; elite = !!rk.elite;
    if (src.cat) { boss = true; mechs = src.mechs; profile.hp *= src.cat === 'world' ? 6 : src.cat === 'raid' ? 7 : src.cat === 'trial' ? 5 : 4; profile.dmg *= 1.35; legendary = src.cat === 'raid' || src.cat === 'world' ? 2 : 1; scale = 1.3; summon = mechs.includes('summon') ? b.id : null; spr = src.spr || spr; }
    if (role === 'caster') spells = ['dread'];
  }
  const ft = FAMILY_TRAITS[fam] || {};
  res = [...new Set([...res, ...(ft.res || [])])]; imm = [...new Set([...imm, ...(ft.imm || [])])]; vuln = [...new Set([...vuln, ...(ft.vuln || [])])];
  const num = monsterNumbers(L, profile);
  const hp = Math.max(1, Math.round(num.hp * D.hp)), per = num.dpr * D.dmg / multi;
  const totalShare = attacks.reduce((a, x) => a + x.share, 0) / attacks.length;
  const atks = attacks.map(a => ({ name: a.name, type: a.type, eff: a.eff, hit: num.hit, dice: a.eff && a.eff.save && a.eff.aoe ? dmgDice(per * 1.8) : dmgDice(per * a.share / totalShare) }));
  const saveFor = a => mod(ab[ATTRS.indexOf(a)]) + (boss && ['DEX', 'CON', 'WIS'].includes(a) ? num.pb : 0);
  if (bestId && BEAST_BY_ID[bestId] && BEAST_BY_ID[bestId].ccArt && IMG[BEAST_BY_ID[bestId].ccArt]) spr = BEAST_BY_ID[bestId].ccArt;
  else if (typeof monsterArt === 'function' && artOn()) { const art = src.cat ? (BOSS_BY_ID[src.id] || src) : (bestId ? BEAST_BY_ID[bestId] : null); if (art && art.nspr && IMG[art.nspr]) spr = art.nspr; }
  return Object.assign({
    side: 'foe', name, lvl: L, hp, maxhp: hp, ac: num.ac, hit: num.hit, dc: num.dc, ab, attacks: atks, multi, res, imm, vuln,
    condImm: ft.condImm || [], traits, spells, legendary, legLeft: legendary, legRes: traits.includes('legres') ? 3 : 0, summon, mechs, spr, boss, elite, fam, bestId, uniqueKey, scale,
    saves: Object.fromEntries(ATTRS.slice(0, 6).map(a => [a, saveFor(a)])), init: mod(ab[1]),
    xp: Math.round(xpForMonster(L) * (boss ? 8 : elite ? 3 : 1) * D.xp), gold: Math.round((2 + L * 1.5) * (boss ? 10 : elite ? 3 : 1) * (0.5 + R())),
    effects: [], threat: {}, recharge: {}, turn: 0, phase: 0,
  }, extra);
}

// NPC adventurers (companions, AI raiders, arena opponents)
function makeAdventurer(clsId, lvl, name, rng = R) {
  const sp = rng.pick ? rng.pick(Object.keys(SPECIES)) : 'hearthkin';
  const c = newCharacter({ name, species: sp, cls: clsId, bg: 'soldier', ai: true });
  c.lvl = lvl; c.sub = CLASSES[clsId].subs[Math.floor(R() * 2)].id; c.xp = xpForLevel(lvl);
  const plus = Math.min(3, Math.floor(lvl / 6)), rar = plus >= 3 ? 4 : plus >= 2 ? 3 : plus >= 1 ? 2 : 1;
  for (const slot of ['weapon', 'armor', 'offhand']) { const it = c.eq[slot]; if (it) { it.plus = plus; it.rarity = rar; it.ilvl = lvl; it.name = itemBaseName(it); } }
  if (lvl > 20) { const D = derive(c); c.ascAttr[CLASSES[clsId].primary] = Math.floor((lvl - 20) * 0.6); c.ascAttr.CON = Math.floor((lvl - 20) * 0.4); c.ascSub = { dmg: Math.floor((lvl - 20) * 0.5), hp: Math.floor((lvl - 20)) }; }
  const D = derive(c); c.hp = D.hpMax; c.hd = D.hdMax; c.res = resMax(c, D);
  return c;
}
const ROLE_CLASSES = { tank: ['warden', 'vanguard', 'berserker'], healer: ['chaplain', 'cantor', 'verdant'], dps: ['arcanist', 'strider', 'shade', 'wildblood', 'pactbound', 'ascetic'] };
