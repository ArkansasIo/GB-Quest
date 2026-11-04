'use strict';
// ================================================================ JOBS: job change, support jobs, job abilities, racial traits, monster jobs
// MAIN MENU > JOBS.
//   * JOB CHANGE: in any town (not in battle or an instance) change your main job to any of the 27 classes. Each job
//     keeps its own level, XP, attributes, subclass, talents, skills, combat arts and hotbar. A job you have never
//     played starts at level 1 with that class's starting gear (put in your bag). Armour the new job can't wear goes
//     to your bag.
//   * SUPPORT JOB: from main job level 18, set a second job as your support job. It works at half your main level
//     (and never above its own level): you gain its SUPPORT TRAITS (substats) and the job abilities it has learned
//     up to that level.
//   * JOB ABILITIES: the eleven new jobs each have 2-3 once-per-battle abilities (MEIKYO STRIKE, PAPER IMAGE, JUMP...).
//   * RACIAL TRAITS: the six new races carry passive bonuses and two have a once-per-battle racial ability.
//   * MONSTER JOBS: about a third of humanoid, giant, fey, fiend and undead foes now have a job: HEXER, GUARDIAN,
//     ARCHER, BRUTE or MENDER, with their own strengths and a name tag.
// Pure rules are exported as GBQJobs for tests; the game wiring runs only inside the game.

const SUPPORT_UNLOCK = 18;
// what a job keeps for itself while another job is active
const JOB_FIELDS = ['lvl', 'xp', 'base', 'sub', 'feats', 'talents', 'talentPts', 'skillPts', 'activeSkills', 'passiveSkills', 'ascAttr', 'ascSub', 'boons', 'pending', 'ascPts', 'subPts', 'arts', 'hotbar', 'loadouts'];
const jobClone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const jobSnapshot = c => Object.fromEntries(JOB_FIELDS.filter(k => c[k] !== undefined).map(k => [k, jobClone(c[k])]));
function jobRestore(c, snap) { for (const k of JOB_FIELDS) if (snap[k] !== undefined) c[k] = jobClone(snap[k]); else if (k === 'loadouts' || k === 'hotbar') delete c[k]; return c; }
// a fresh job: level 1, no picks, the class's own attribute spread; arts and loadouts start empty
function freshJob(base) { return { lvl: 1, xp: 0, base: jobClone(base), sub: null, feats: [], talents: [], talentPts: 0, skillPts: 0, activeSkills: [], passiveSkills: [], ascAttr: {}, ascSub: {}, boons: [], pending: { asi: 0, sub: false, boon: 0 }, ascPts: 0, subPts: 0, arts: [], hotbar: [] }; }
const jobLevelOf = (c, cls) => !c ? 1 : cls === c.cls ? c.lvl : (c.jobs && c.jobs[cls] && c.jobs[cls].lvl) || 1;
// support job level: half the main job (rounded down), capped by the support job's own level
const supportLevel = (mainLvl, supOwnLvl) => mainLvl < SUPPORT_UNLOCK ? 0 : Math.max(1, Math.min(supOwnLvl || 1, Math.floor(mainLvl / 2)));

// support traits: substats per 10 support levels (at least one step), capped
const SUPPORT_TRAITS = {
  warden: [['hp', 6], ['block', 1]], vanguard: [['acb', 0.5], ['resist', 1]], berserker: [['dmg', 2], ['hp', 4]], strider: [['hit', 0.5], ['crit', 1]],
  shade: [['crit', 1], ['dodge', 1]], ascetic: [['dodge', 1], ['haste', 1]], arcanist: [['fire', 2], ['cold', 2]], wildblood: [['dmg', 2], ['lightning', 2]],
  pactbound: [['necrotic', 3], ['leech', 0.5]], chaplain: [['heal', 3], ['resist', 1]], cantor: [['heal', 2], ['haste', 1]], verdant: [['heal', 2], ['hp', 4]],
  runeblade: [['dmg', 1], ['acb', 0.5]], sunwarden: [['heal', 2], ['block', 1]], summoner: [['dmg', 2], ['heal', 1]], necromancer: [['necrotic', 3], ['leech', 0.5]],
  ronin: [['crit', 1], ['critdmg', 3]], shinobi: [['dodge', 1.5], ['crit', 0.5]], bladedancer: [['heal', 2], ['dodge', 1]], wyrmlancer: [['dmg', 2], ['hit', 0.5]],
  corsair: [['gf', 3], ['crit', 1]], beastcaller: [['hp', 5], ['thorns', 1]], puppeteer: [['acb', 0.5], ['hp', 4]], dreadknight: [['leech', 1], ['hp', 4]],
  voidhunter: [['haste', 1], ['dmg', 2]], scalesage: [['fire', 3], ['heal', 2]], stormcaller: [['lightning', 3], ['heal', 2]],
};
const SUPPORT_CAPS = { hp: 120, block: 8, acb: 4, resist: 10, dmg: 25, hit: 5, crit: 8, critdmg: 30, dodge: 10, haste: 10, fire: 30, cold: 30, lightning: 30, necrotic: 30, leech: 5, heal: 25, gf: 30, thorns: 25 };
function supportBonus(cls, lvl) {
  if (!lvl || !SUPPORT_TRAITS[cls]) return [];
  const steps = Math.max(1, Math.floor(lvl / 10));
  return SUPPORT_TRAITS[cls].map(([k, v]) => [k, Math.min(SUPPORT_CAPS[k] || 20, Math.max(1, Math.floor(v * steps)))]);
}
// racial passive substats for the new races
function raceBonus(species, lvl) {
  const L = Math.max(1, lvl || 1);
  switch (species) {
    case 'hornfolk': return [['hp', Math.min(150, 4 + L)]];
    case 'felinar': return [['dodge', 5]];
    case 'pipkin': return [['fire', 10], ['cold', 10], ['lightning', 10]];
    case 'wolfkin': return [['crit', 4], ['critdmg', 15]];
    case 'starkin': return [['heal', 15]];
    case 'lunari': return [['dodge', 2], ['necrotic', 5]];
    default: return [];
  }
}

// monster jobs: chance a foe has one, and what each does to a stat block
const MONSTER_JOB_FAMS = ['humanoid', 'giant', 'fey', 'fiend', 'undead'];
const MONSTER_JOB_CHANCE = 0.35;
const MONSTER_JOBS = {
  hexer: { name: 'HEXER', desc: 'Casts offensive spells; frail.' },
  guardian: { name: 'GUARDIAN', desc: '+3 AC and +30% HP.' },
  archer: { name: 'ARCHER', desc: '+2 to hit.' },
  brute: { name: 'BRUTE', desc: 'Hits 30% harder; -1 AC.' },
  mender: { name: 'MENDER', desc: 'Its allies regenerate.' },
};
const MONSTER_JOB_IDS = Object.keys(MONSTER_JOBS);
const canHaveJob = m => !!m && !m.boss && !m.rare && !m.job && m.side !== 'party' && MONSTER_JOB_FAMS.includes(m.fam);
// apply a job to a monster object (pure apart from mutating it); scale dice with the given helpers
function applyMonsterJob(m, job, helpers = {}) {
  if (!m || !MONSTER_JOBS[job]) return m;
  const avg = helpers.diceAvg, dice = helpers.dmgDice;
  m.job = job;
  if (job === 'hexer') { m.spells = [...new Set([...(m.spells || []), 'emberdart', 'lance', 'flamefan'])]; m.maxhp = Math.max(1, Math.round(m.maxhp * 0.85)); }
  if (job === 'guardian') { m.ac = (m.ac || 10) + 3; m.maxhp = Math.round(m.maxhp * 1.3); }
  if (job === 'archer') { m.hit = (m.hit || 0) + 2; (m.attacks || []).forEach(a => { a.hit = (a.hit || 0) + 2; }); }
  if (job === 'brute') { m.ac = (m.ac || 10) - 1; if (avg && dice) (m.attacks || []).forEach(a => { if (a.dice) a.dice = dice(avg(a.dice) * 1.3); }); }
  if (job === 'mender') m.mender = true;
  m.hp = m.maxhp; m.xp = Math.round((m.xp || 1) * 1.2);
  m.name = `${m.name} ${MONSTER_JOBS[job].name}`.slice(0, 16);
  return m;
}
const rollMonsterJob = (m, r1, r2) => canHaveJob(m) && r1 < MONSTER_JOB_CHANCE ? MONSTER_JOB_IDS[Math.floor(r2 * MONSTER_JOB_IDS.length) % MONSTER_JOB_IDS.length] : null;

// job abilities (data; battle code fills in what they do)
const JOB_ABILITIES = {
  ronin: [{ id: 'meikyo', name: 'MEIKYO STRIKE', lvl: 1, t: 'enemy', desc: 'Focus (+15% crit) then a heavy blow.' }, { id: 'thirdeye', name: 'THIRD EYE', lvl: 15, bonus: true, desc: 'Foresee the next attacks: dodge for 2 rounds.' }],
  shinobi: [{ id: 'paperimage', name: 'PAPER IMAGE', lvl: 1, bonus: true, desc: 'Three paper decoys take hits for you.' }, { id: 'shuriken', name: 'SHURIKEN', lvl: 10, t: 'enemy', desc: 'A strike that leaves the foe bleeding.' }],
  bladedancer: [{ id: 'waltz', name: 'HEALING WALTZ', lvl: 1, t: 'ally', desc: 'Heal an ally.' }, { id: 'boxstep', name: 'BOX STEP', lvl: 8, t: 'enemy', desc: 'Strike and sunder its armour.' }, { id: 'fandance', name: 'FAN DANCE', lvl: 20, bonus: true, desc: 'Party regenerates for 3 rounds.' }],
  wyrmlancer: [{ id: 'jump', name: 'JUMP', lvl: 1, t: 'enemy', desc: 'Leap from the sky for heavy damage.' }, { id: 'callwyvern', name: 'CALL WYVERN', lvl: 5, desc: 'A wyvern joins the fight.' }, { id: 'ancientcircle', name: 'ANCIENT CIRCLE', lvl: 25, bonus: true, desc: 'Party fortified for 3 rounds.' }],
  corsair: [{ id: 'phantomroll', name: 'PHANTOM ROLL', lvl: 1, bonus: true, desc: 'Roll the dice: a random buff for the party.' }, { id: 'quickdraw', name: 'QUICK DRAW', lvl: 10, t: 'enemy', desc: 'An elemental shot.' }],
  beastcaller: [{ id: 'callbeast', name: 'CALL BEAST', lvl: 1, desc: 'A beast companion joins the fight.' }, { id: 'feralhowl', name: 'FERAL HOWL', lvl: 12, desc: 'Frighten every foe that fails a WIS save.' }],
  puppeteer: [{ id: 'automaton', name: 'DEPLOY AUTOMATON', lvl: 1, desc: 'A clockwork automaton joins the fight.' }, { id: 'overdrive', name: 'OVERDRIVE', lvl: 15, bonus: true, desc: 'Haste and might for 3 rounds.' }],
  dreadknight: [{ id: 'deathstrike', name: 'DEATH STRIKE', lvl: 1, t: 'enemy', desc: 'Strike and heal yourself.' }, { id: 'darkgrasp', name: 'DARK GRASP', lvl: 5, t: 'enemy', desc: 'Pull a foe to you: it attacks you.' }, { id: 'boneshield', name: 'BONE SHIELD', lvl: 15, bonus: true, desc: 'Fortified for 4 rounds.' }],
  voidhunter: [{ id: 'chaosstrike', name: 'CHAOS STRIKE', lvl: 1, t: 'enemy', desc: 'A double glaive strike.' }, { id: 'blur', name: 'BLUR', lvl: 8, bonus: true, desc: 'Dodge for 2 rounds.' }, { id: 'metamorph', name: 'METAMORPHOSIS', lvl: 25, desc: 'Become a demon: haste and might.' }],
  scalesage: [{ id: 'dragonbreath', name: 'DRAGON BREATH', lvl: 1, desc: 'Fire on every foe (DEX half).' }, { id: 'verdant', name: 'VERDANT EMBRACE', lvl: 5, t: 'ally', desc: 'A strong heal.' }],
  stormcaller: [{ id: 'totem', name: 'TOTEM OF MIGHT', lvl: 1, bonus: true, desc: 'Party mighty for 3 rounds.' }, { id: 'chainsurge', name: 'CHAIN SURGE', lvl: 8, desc: 'Lightning arcs to every foe.' }, { id: 'healingtide', name: 'HEALING TIDE', lvl: 20, desc: 'Heal every ally.' }],
};
// abilities a hero has: the main job's up to its level, then the support job's up to the support level
function jobAbilityList(cls, lvl, supCls, supLvl) {
  const out = (JOB_ABILITIES[cls] || []).filter(a => lvl >= a.lvl).map(a => ({ ...a, from: cls }));
  if (supCls && supCls !== cls && supLvl) for (const a of JOB_ABILITIES[supCls] || []) if (supLvl >= a.lvl && !out.some(x => x.id === a.id)) out.push({ ...a, from: supCls, sup: true });
  return out;
}
const RACE_ABILITIES = { hornfolk: { id: 'warstomp', name: 'WAR STOMP', desc: 'Foes that fail a CON save are stunned.' }, starkin: { id: 'giftoflight', name: 'GIFT OF LIGHT', t: 'ally', desc: 'Heal an ally.' } };

if (typeof globalThis !== 'undefined') globalThis.GBQJobs = { SUPPORT_UNLOCK, JOB_FIELDS, jobSnapshot, jobRestore, freshJob, jobLevelOf, supportLevel, SUPPORT_TRAITS, supportBonus, raceBonus, MONSTER_JOBS, MONSTER_JOB_FAMS, MONSTER_JOB_CHANCE, canHaveJob, applyMonsterJob, rollMonsterJob, JOB_ABILITIES, jobAbilityList, RACE_ABILITIES };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined' && typeof derive === 'function') {
  // combat arts: the new jobs join the right art groups
  if (typeof ART_GROUPS !== 'undefined') {
    const join = (g, ids) => { if (ART_GROUPS[g]) for (const id of ids) if (!ART_GROUPS[g].includes(id)) ART_GROUPS[g].push(id); };
    join('blade', ['ronin', 'shinobi', 'bladedancer', 'wyrmlancer', 'corsair', 'beastcaller', 'dreadknight', 'voidhunter']);
    join('brute', ['ronin', 'wyrmlancer', 'dreadknight', 'beastcaller']); join('agile', ['shinobi', 'bladedancer', 'corsair', 'voidhunter']);
    join('arcane', ['puppeteer', 'scalesage']); join('divine', ['bladedancer', 'stormcaller']); join('primal', ['beastcaller', 'stormcaller', 'scalesage']); join('shadow', ['shinobi', 'dreadknight', 'voidhunter']);
  }

  const supInfo = c => { if (!c || c !== G || !c.supJob || c.supJob === c.cls) return null; const lvl = supportLevel(c.lvl, jobLevelOf(c, c.supJob)); return lvl ? { cls: c.supJob, lvl } : null; };
  window.supportJobOf = supInfo;

  // support traits and racial traits as substats
  { const sb0 = armorSetBonus; armorSetBonus = function (c) {
      const out = sb0.apply(this, arguments); if (!c) return out;
      const s = supInfo(c); if (s) out.push(...supportBonus(s.cls, s.lvl));
      out.push(...raceBonus(c.species, c.lvl));
      return out;
    }; }

  // job and race abilities in battle (once per battle each)
  function jobFns(b, u, ab, D) {
    const c = u.ch, CL = Math.max(1, D.CL || c.lvl), allies = () => b.party.filter(m => isChar(m) && !m.ch.dead), foes = () => b.enemiesOf(u);
    const buffAll = (id, rounds, text, sfx) => [b.say(text, () => { allies().forEach(m => addEffect(m, { id, rounds })); (SFX[sfx] || SFX.buff)(); })];
    const heal = (t, n, text) => [b.say(`${text}: +${n} HP`, () => { b.heal(t, n); SFX.heal(); })];
    const dice = n => `${n + Math.floor(CL / 8)}d8`;
    const blast = (name, dt, n, save) => { const dc = 8 + (D.pb || 2) + Math.max(D.M.INT || 0, D.M.WIS || 0, D.M.CHA || 0, D.M.DEX || 0); return [b.say(`${c.name}: ${name}!`, () => SFX.storm_cast())].concat(foes().map(f => ({ text: '', dyn: () => { const sv = b.save(f, save, dc); const d = Math.floor(roll(dice(n)).total * (sv.ok ? 0.5 : 1) * (1 + (D.dmgPct || 0) / 100)); return { text: `${f.name} ${save} ${sv.total} vs DC${dc}\n${d} ${dt}`, act: () => b.applyDamage(u, f, d, dt, { magic: true }) }; } }))); };
    const summon = (name, text, sfx) => [b.say(text, () => { const before = b.party.length; b.addSummon(u, 'wolf'); const m = b.party[before]; if (m) m.name = name; (SFX[sfx] || SFX.growl)(); })];
    switch (ab.id) {
      case 'meikyo': return t => { addEffect(u, { id: 'focus', rounds: 2 }); return [b.say(`${c.name} clears the mind...`, () => SFX.buff())].concat(b.weaponAttack(u, t, { single: true, skillBonus: dice(2) })); };
      case 'thirdeye': return () => [b.say(`${c.name} opens the third eye.`, () => { addEffect(u, { id: 'dodging', rounds: 2 }); SFX.dodge(); })];
      case 'paperimage': return () => [b.say(`${c.name} weaves three paper images!`, () => { addEffect(u, { id: 'mirror', rounds: 10, stacks: 3 }); SFX.veil_cast(); })];
      case 'shuriken': return t => b.weaponAttack(u, t, { single: true, skillBonus: dice(1) }).concat([b.say(`${t.name} is bleeding.`, () => alive(t) && addEffect(t, { id: 'bleeding', rounds: 3 }))]);
      case 'waltz': return t => heal(t, roll(dice(2)).total + Math.max(1, D.M.CHA || 0), `${c.name} dances a healing waltz for ${t.name}`);
      case 'boxstep': return t => b.weaponAttack(u, t, { single: true }).concat([b.say(`${t.name}'s guard is broken.`, () => alive(t) && addEffect(t, { id: 'sundered', rounds: 3 }))]);
      case 'fandance': return () => buffAll('regen', 3, `${c.name} performs the fan dance!`, 'charm');
      case 'jump': return t => [b.say(`${c.name} leaps high into the sky...`, () => SFX.dodge())].concat(b.weaponAttack(u, t, { single: true, skillBonus: dice(3) }));
      case 'callwyvern': return () => summon('WYVERN', `${c.name} calls a wyvern!`, 'roar');
      case 'ancientcircle': return () => buffAll('fortify', 3, `${c.name} draws the ancient circle.`, 'bless');
      case 'phantomroll': return () => { const n = 1 + Math.floor(R() * 6), id = ['bless', 'might', 'haste', 'regen', 'fortify', 'focus'][n - 1]; return buffAll(id, 3, `${c.name} rolls a ${n}! ${(BUFFS[id] || { name: id }).name} for the party.`, 'charm'); };
      case 'quickdraw': return t => b.castSpell(u, { id: 'job_quickdraw', name: 'QUICK DRAW', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: dice(2), dt: pick(['fire', 'cold', 'lightning']) }, [t]);
      case 'callbeast': return () => summon(pick(['BOAR', 'WOLF', 'BEAR CUB', 'RAPTOR']), `${c.name} calls a beast!`, 'growl');
      case 'feralhowl': return () => { const dc = 8 + (D.pb || 2) + (D.M.CHA || 0); return [b.say(`${c.name} lets out a feral howl!`, () => SFX.roar())].concat(foes().filter(f => !f.boss).map(f => ({ text: '', dyn: () => { const sv = b.save(f, 'WIS', dc); return sv.ok ? { text: `${f.name} stands firm.` } : { text: `${f.name} is frightened!`, act: () => addEffect(f, { id: 'frightened', rounds: 2 }) }; } }))); };
      case 'automaton': return () => summon('AUTOMATON', `${c.name} deploys the automaton!`, 'buff');
      case 'overdrive': return () => [b.say(`${c.name} hits OVERDRIVE!`, () => { addEffect(u, { id: 'haste', rounds: 3 }); addEffect(u, { id: 'might', rounds: 3 }); SFX.buff(); })];
      case 'deathstrike': return t => b.weaponAttack(u, t, { single: true, skillBonus: dice(1) }).concat(heal(u, roll(dice(1)).total + CL, `${c.name} drinks the life`));
      case 'darkgrasp': return t => [b.say(`${c.name} grips ${t.name} with dark power!`, () => { if (t.threat) t.threat[u.id] = (Math.max(0, ...Object.values(t.threat)) || 0) + 50 + CL * 4; SFX.thrall_hit ? SFX.thrall_hit() : SFX.stun(); })];
      case 'boneshield': return () => [b.say(`Bones whirl around ${c.name}.`, () => { addEffect(u, { id: 'fortify', rounds: 4 }); SFX.buff(); })];
      case 'chaosstrike': return t => b.weaponAttack(u, t, { single: true }).concat(b.weaponAttack(u, t, { single: true, skillBonus: dice(1) }));
      case 'blur': return () => [b.say(`${c.name} blurs.`, () => { addEffect(u, { id: 'dodging', rounds: 2 }); SFX.dodge(); })];
      case 'metamorph': return () => [b.say(`${c.name} becomes a demon!`, () => { addEffect(u, { id: 'haste', rounds: 4 }); addEffect(u, { id: 'might', rounds: 4 }); SFX.roar(); })];
      case 'dragonbreath': return () => blast('DRAGON BREATH', 'fire', 2, 'DEX');
      case 'verdant': return t => heal(t, roll(dice(3)).total + Math.max(1, D.M.INT || 0), `Emerald light embraces ${t.name}`);
      case 'totem': return () => buffAll('might', 3, `${c.name} plants a totem of might.`, 'bless');
      case 'chainsurge': return () => blast('CHAIN SURGE', 'lightning', 2, 'DEX');
      case 'healingtide': return () => { const n = roll(dice(1)).total + Math.max(1, D.M.WIS || 0); return [b.say(`A healing tide washes over the party: +${n} HP`, () => { allies().filter(m => m.ch.hp > 0).forEach(m => b.heal(m, n)); SFX.heal(); })]; };
      case 'warstomp': return () => { const dc = 8 + (D.pb || 2) + (D.M.STR || 0); return [b.say(`${c.name} stomps the earth!`, () => SFX.roar())].concat(foes().filter(f => !f.boss).map(f => ({ text: '', dyn: () => { const sv = b.save(f, 'CON', dc); return sv.ok ? { text: `${f.name} keeps its footing.` } : { text: `${f.name} is stunned!`, act: () => addEffect(f, { id: 'stunned', rounds: 1 }) }; } }))); };
      case 'giftoflight': return t => heal(t, roll(dice(2)).total + Math.max(1, D.M.WIS || 0), `${c.name}'s gift of light touches ${t.name}`);
    }
    return null;
  }
  { const a0 = Battle.prototype.abilities; Battle.prototype.abilities = function (u) {
      const list = a0.apply(this, arguments);
      try {
        const c = u && u.ch; if (!c) return list;
        const uses = this.jobUses || (this.jobUses = new Set()), D = derive(c), s = supInfo(c);
        const defs = jobAbilityList(c.cls, c.lvl, s && s.cls, s && s.lvl);
        if (RACE_ABILITIES[c.species]) defs.push({ ...RACE_ABILITIES[c.species], race: true });
        const at = list.findIndex(x => x.id === 'dodge'), add = [];
        for (const ab of defs) {
          const key = `${u.id || c.name}:${ab.id}`, used = uses.has(key), fn = jobFns(this, u, ab, D); if (!fn) continue;
          add.push({ id: 'job_' + ab.id, name: ab.name, cost: used ? 'USED' : ab.sup ? 'SUP' : ab.race ? 'RACE' : 'JOB', ok: !used && (!ab.bonus || !this.bonusUsed), bonus: !!ab.bonus, target: ab.t, fn: t => { uses.add(key); return fn(t); } });
        }
        list.splice(at < 0 ? list.length : at, 0, ...add);
      } catch (e) { console.warn('job abilities', e); }
      return list;
    }; }
  // companions and NPC adventurers of the new jobs use their abilities too
  { const ai0 = Battle.prototype.aiTurn; Battle.prototype.aiTurn = function (u) {
      try {
        const c = u && u.ch;
        if (c && JOB_ABILITIES[c.cls] && R() < 0.4) {
          const foes = this.enemiesOf(u); if (!foes.length) return ai0.apply(this, arguments);
          const allies = this.party.filter(m => isChar(m) && !m.ch.dead && m.ch.hp > 0), hurt = allies.filter(m => hpOf(m) < maxHpOf(m) * 0.5).sort((a, b) => hpOf(a) - hpOf(b))[0];
          const opts = this.abilities(u).filter(a => a.ok && a.id.startsWith('job_') && !a.bonus);
          const pickA = opts.find(a => a.target === 'ally' && hurt) || opts.find(a => a.target !== 'ally');
          if (pickA) { const t = pickA.target === 'ally' ? hurt : pickA.target === 'enemy' ? foes.slice().sort((a, b) => hpOf(a) - hpOf(b))[0] : null; return pickA.fn(t); }
        }
      } catch (e) { console.warn('job ai', e); }
      return ai0.apply(this, arguments);
    }; }
  // lunari start hidden; menders make their allies regenerate
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.apply(this, arguments);
      for (const u of this.party) if (isChar(u) && u.ch.species === 'lunari') addEffect(u, { id: 'hidden', rounds: 2 });
      if ((this.foes || []).some(f => f.mender)) for (const f of this.foes) addEffect(f, { id: 'regen', rounds: 4 });
    }; }
  // monster jobs on ordinary foes
  { const mm0 = makeMonster; makeMonster = function (src, L, diff, extra) {
      const m = mm0.apply(this, arguments);
      try { if (!(extra && (extra.side === 'party' || extra.ally))) { const job = rollMonsterJob(m, R(), R()); if (job) applyMonsterJob(m, job, { diceAvg, dmgDice }); } } catch (e) { console.warn('monster job', e); }
      return m;
    }; }

  // ---------------------------------------------------------------- job change
  const inBattle = () => scenes.some(s => s instanceof Battle);
  const inTown = () => !G.inst && ZONE_BY_ID[G.map] && ZONE_BY_ID[G.map].town;
  function changeJob(cls) {
    if (!CLASSES[cls]) return 'Unknown job.'; if (cls === G.cls) return 'That is your main job already.';
    if (inBattle()) return 'Not during a battle.'; if (!inTown()) return 'Change jobs in a town (your home or an inn).';
    G.jobs = G.jobs && typeof G.jobs === 'object' ? G.jobs : {};
    G.jobs[G.cls] = jobSnapshot(G);
    const fresh = !G.jobs[cls];
    const snap = G.jobs[cls] || freshJob(newCharacter({ name: G.name, species: G.species, cls }).base);
    delete G.jobs[cls];
    const from = G.cls; G.cls = cls; jobRestore(G, snap);
    if (G.supJob === cls) G.supJob = from;
    G.bag = G.bag || [];
    const off = () => { for (const [sl, it] of Object.entries(G.eq)) if (it && canEquip(G, it)) { delete G.eq[sl]; G.bag.push(it); } };
    off();
    if (fresh) for (const b of CLASSES[cls].gear || []) { const it = makeItem(WEAPONS[b] ? { kind: 'weapon', base: b, rarity: 1, lvl: 1 } : { kind: 'armor', base: b, rarity: 1, lvl: 1 }); const sl = itemSlot(it); if (!G.eq[sl] && !canEquip(G, it)) G.eq[sl] = it; else G.bag.push(it); }
    off();
    const D = derive(G); G.hp = D.hpMax; G.hd = D.hdMax; G.res = resMax(G, D);
    if (typeof chatLog === 'function') chatLog('system', 'JOB', `Main job is now ${CLASSES[cls].name} LV${G.lvl}.`);
    return null;
  }
  window.changeJob = changeJob;
  const jobRow = cls => `${cls === G.cls ? '* ' : cls === G.supJob ? '+ ' : ''}${CLASSES[cls].name.slice(0, 11)} LV${jobLevelOf(G, cls)}`;
  function pickJob(title, cb, skip) { const ids = CLASS_ORDER.filter(id => id !== skip); choose([...ids.map(jobRow), 'BACK'], k => { if (k >= 0 && k < ids.length) cb(ids[k]); else jobsMenu(); }, title); }
  function jobInfo(cls) {
    const c = CLASSES[cls], ab = (JOB_ABILITIES[cls] || []).map(a => `${a.name} (LV${a.lvl})`).join(', ');
    const tr = (SUPPORT_TRAITS[cls] || []).map(([k]) => (SUBSTATS[k] || { name: k }).name).join(', ');
    return [`${c.name} LV${jobLevelOf(G, cls)}: ${c.role.toUpperCase()} D${c.hd} ${c.primary}`, c.desc, ab ? `Job abilities: ${ab}.` : 'Core class: its own features and spells.', `Support traits: ${tr}.`];
  }
  function jobsMenu() {
    const s = supInfo(G);
    const opts = ['CHANGE MAIN JOB', 'SET SUPPORT JOB', ...(G.supJob ? ['CLEAR SUPPORT JOB'] : []), 'JOB INFO', 'BACK'];
    choose(opts, k => {
      const o = opts[k]; if (!o || o === 'BACK') return;
      if (o === 'CHANGE MAIN JOB') return pickJob('CHANGE MAIN JOB', cls => {
        const why = changeJob(cls); if (why) { SFX.error(); return say(why, jobsMenu); }
        SFX.levelup(); saveGame(); say([`You are now a ${CLASSES[cls].name}! (LV${G.lvl})`, G.lvl === 1 ? 'A new job starts at level 1. Starting gear is in your bag.' : 'Your progress in this job is restored.'], jobsMenu);
      }, G.cls);
      if (o === 'SET SUPPORT JOB') {
        if (G.lvl < SUPPORT_UNLOCK) { SFX.error(); return say(`Support jobs open at main job level ${SUPPORT_UNLOCK}.`, jobsMenu); }
        if (inBattle()) return say('Not during a battle.', jobsMenu);
        return pickJob('SUPPORT JOB (HALF LEVEL)', cls => { G.supJob = cls; const t = supInfo(G); SFX.buff(); saveGame(); say([`Support job: ${CLASSES[cls].name} LV${t ? t.lvl : 1}.`, 'You gain its support traits and job abilities up to that level.'], jobsMenu); }, G.cls);
      }
      if (o === 'CLEAR SUPPORT JOB') { G.supJob = null; SFX.toggle(); return jobsMenu(); }
      if (o === 'JOB INFO') return pickJob('JOB INFO', cls => say(jobInfo(cls), jobsMenu));
    }, `MAIN ${CLASSES[G.cls].name} ${G.lvl}${s ? ` / ${CLASSES[s.cls].name.slice(0, 8)} ${s.lvl}` : G.lvl >= SUPPORT_UNLOCK ? ' / NO SUPPORT' : ''}`.slice(0, 30));
  }
  window.jobsMenu = jobsMenu;

}
