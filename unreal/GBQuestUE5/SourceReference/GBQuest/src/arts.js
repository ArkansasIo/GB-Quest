// ================================================================ COMBAT ARTS: physical and casting skills
// Two attack systems for skills and abilities, both on 5e resolution:
//   PHYSICAL ARTS  weapon attack roll: d20 + weapon hit bonus vs AC. Damage = weapon dice + ability mod
//                  + gear tier + the art's bonus dice. Can crit, triggers on-hit effects, uses the weapon's
//                  damage type. Riders (bleed, stun, prone...) land on a hit.
//   CASTING ARTS   spell attack roll (d20 + proficiency + casting mod vs AC) or a saving throw against
//                  your spell DC (8 + proficiency + casting mod), half damage on a save when noted.
//                  Damage dice scale like cantrips (x1 / x2 / x3 / x4 at levels 1 / 5 / 11 / 17, then +1
//                  per 50 levels). Elemental, so elemental damage substats apply.
// Arts cost no spell slots: each has a cooldown in rounds. A hero equips up to 4 (MENU > COMBAT ARTS);
// equipped arts appear in battle under SKILLS and on the realtime hotbar. Companions use theirs too.

const ART_GROUPS = {
  blade: ['warden', 'vanguard', 'berserker', 'strider', 'shade', 'ascetic', 'runeblade', 'sunwarden'],
  brute: ['warden', 'berserker', 'vanguard', 'runeblade'],
  agile: ['strider', 'shade', 'ascetic'],
  arcane: ['arcanist', 'wildblood', 'pactbound', 'runeblade', 'summoner'],
  divine: ['chaplain', 'cantor', 'sunwarden', 'vanguard'],
  primal: ['verdant', 'strider', 'wildblood', 'summoner'],
  shadow: ['necromancer', 'pactbound', 'shade'],
};
// physical: hits, all (each foe), bonus [count, die, perLevels], rider, stun, prone
// casting:  atk | save + half, dice, dt, all, rider, heal
const ARTS = [
  // ---- physical
  { id: 'cleave', name: 'CLEAVE', kind: 'physical', g: 'brute', lvl: 1, cd: 3, all: true, bonus: [0, 6, 0], desc: 'Swing through every foe in reach.' },
  { id: 'heavy_blow', name: 'HEAVY BLOW', kind: 'physical', g: 'blade', lvl: 1, cd: 2, bonus: [1, 8, 10], desc: 'A committed strike for extra damage.' },
  { id: 'quick_jab', name: 'QUICK JAB', kind: 'physical', g: 'agile', lvl: 1, cd: 2, hits: 2, bonus: [0, 4, 0], desc: 'Two fast attacks.' },
  { id: 'rend', name: 'REND', kind: 'physical', g: 'blade', lvl: 3, cd: 3, bonus: [1, 6, 12], rider: 'bleeding', desc: 'A tearing cut that leaves the foe BLEEDING.' },
  { id: 'shield_bash', name: 'SHIELD BASH', kind: 'physical', g: 'brute', lvl: 4, cd: 4, bonus: [1, 4, 15], prone: true, desc: 'Slam a foe and knock it PRONE.' },
  { id: 'hamstring', name: 'HAMSTRING', kind: 'physical', g: 'agile', lvl: 5, cd: 3, bonus: [1, 6, 15], rider: 'slowed', desc: 'Cut low: the foe is SLOWED.' },
  { id: 'sunder', name: 'SUNDER ARMOR', kind: 'physical', g: 'brute', lvl: 7, cd: 4, bonus: [1, 8, 15], rider: 'sundered', desc: 'Crack the foe\'s armour (SUNDERED: lower AC).' },
  { id: 'flurry_cut', name: 'FLURRY CUT', kind: 'physical', g: 'agile', lvl: 9, cd: 4, hits: 3, bonus: [0, 6, 0], desc: 'Three blurred strikes.' },
  { id: 'skull_crack', name: 'SKULL CRACK', kind: 'physical', g: 'blade', lvl: 11, cd: 5, bonus: [2, 6, 15], stun: true, desc: 'A blow to the head that can STUN.' },
  { id: 'whirlwind', name: 'WHIRLWIND', kind: 'physical', g: 'blade', lvl: 13, cd: 5, all: true, bonus: [2, 6, 20], desc: 'Spin and strike every foe.' },
  { id: 'execute', name: 'EXECUTE', kind: 'physical', g: 'brute', lvl: 15, cd: 5, bonus: [4, 10, 15], execute: true, desc: 'Huge damage; doubled on foes below half health.' },
  { id: 'shadow_strike', name: 'SHADOW STRIKE', kind: 'physical', g: 'shadow', lvl: 6, cd: 3, bonus: [2, 6, 12], rider: 'weakened', desc: 'Strike from the dark: the foe is WEAKENED.' },
  { id: 'rain_arrows', name: 'ARROW STORM', kind: 'physical', g: 'primal', lvl: 10, cd: 5, all: true, bonus: [1, 8, 18], desc: 'A volley that hits every foe.' },
  { id: 'warcry_blow', name: 'WARCRY BLOW', kind: 'physical', g: 'divine', lvl: 8, cd: 4, bonus: [2, 8, 15], selfBuff: 'might', desc: 'A rallying strike: you become MIGHTY.' },
  { id: 'earthshatter', name: 'EARTHSHATTER', kind: 'physical', g: 'brute', lvl: 20, cd: 6, all: true, bonus: [4, 8, 20], prone: true, desc: 'Split the ground: all foes, knocked PRONE.' },
  { id: 'thousand_cuts', name: 'THOUSAND CUTS', kind: 'physical', g: 'agile', lvl: 20, cd: 6, hits: 5, bonus: [1, 6, 30], rider: 'bleeding', desc: 'Five strikes that leave the foe BLEEDING.' },
  { id: 'titan_swing', name: 'TITAN SWING', kind: 'physical', g: 'blade', lvl: 40, cd: 6, all: true, bonus: [6, 10, 25], desc: 'A paragon sweep through every foe.' },
  { id: 'world_splitter', name: 'WORLD SPLITTER', kind: 'physical', g: 'blade', lvl: 100, cd: 8, bonus: [12, 12, 25], execute: true, rider: 'sundered', desc: 'The end of all armour.' },
  // ---- casting
  { id: 'firebolt_art', name: 'EMBER LANCE', kind: 'casting', g: 'arcane', lvl: 1, cd: 2, atk: true, dice: '2d10', dt: 'fire', rider: 'burning', desc: 'Spell attack: a lance of fire that can set the foe BURNING.' },
  { id: 'frost_shard', name: 'FROST SHARD', kind: 'casting', g: 'arcane', lvl: 1, cd: 2, atk: true, dice: '2d8', dt: 'cold', rider: 'frostbite', desc: 'Spell attack: ice that leaves FROSTBITE.' },
  { id: 'smite_light', name: 'RADIANT LASH', kind: 'casting', g: 'divine', lvl: 1, cd: 2, save: 'DEX', dice: '2d8', dt: 'radiant', desc: 'DEX save: searing radiant light.' },
  { id: 'thorn_whip', name: 'BRIAR WHIP', kind: 'casting', g: 'primal', lvl: 1, cd: 2, atk: true, dice: '2d6', dt: 'piercing', rider: 'slowed', desc: 'Spell attack: thorny vines SLOW the foe.' },
  { id: 'grave_touch', name: 'GRAVE TOUCH', kind: 'casting', g: 'shadow', lvl: 1, cd: 2, atk: true, dice: '2d8', dt: 'necrotic', drain: 0.5, desc: 'Spell attack: steal life (heal half).' },
  { id: 'arc_chain', name: 'CHAIN ARC', kind: 'casting', g: 'arcane', lvl: 5, cd: 4, save: 'DEX', half: true, all: true, dice: '2d6', dt: 'lightning', rider: 'shocked', desc: 'DEX save, half: lightning jumps to every foe.' },
  { id: 'mind_spike', name: 'MIND SPIKE', kind: 'casting', g: 'shadow', lvl: 4, cd: 3, save: 'WIS', dice: '3d6', dt: 'psychic', rider: 'bane', desc: 'WIS save: psychic pain, the foe is BANED.' },
  { id: 'holy_nova', name: 'HOLY NOVA', kind: 'casting', g: 'divine', lvl: 6, cd: 5, save: 'CON', half: true, all: true, dice: '2d8', dt: 'radiant', heal: '2d8', desc: 'CON save, half: radiant burst that also heals the party.' },
  { id: 'acid_splash_art', name: 'CORRODE', kind: 'casting', g: 'primal', lvl: 6, cd: 3, save: 'DEX', dice: '3d6', dt: 'acid', rider: 'vulnerable', desc: 'DEX save: acid makes the foe VULNERABLE.' },
  { id: 'venom_cloud', name: 'VENOM CLOUD', kind: 'casting', g: 'shadow', lvl: 8, cd: 5, save: 'CON', half: true, all: true, dice: '2d8', dt: 'poison', rider: 'venom', desc: 'CON save, half: a poison cloud over every foe.' },
  { id: 'meteor_art', name: 'FALLING STAR', kind: 'casting', g: 'arcane', lvl: 11, cd: 6, save: 'DEX', half: true, all: true, dice: '3d10', dt: 'fire', rider: 'burning', desc: 'DEX save, half: a burning star hits every foe.' },
  { id: 'glacier', name: 'GLACIAL TOMB', kind: 'casting', g: 'arcane', lvl: 13, cd: 6, save: 'CON', dice: '5d8', dt: 'cold', rider: 'slowed', desc: 'CON save: encase the foe in ice.' },
  { id: 'judgement', name: 'JUDGEMENT', kind: 'casting', g: 'divine', lvl: 15, cd: 6, atk: true, dice: '5d10', dt: 'radiant', rider: 'doomed', desc: 'Spell attack: the foe is DOOMED.' },
  { id: 'soul_harvest', name: 'SOUL HARVEST', kind: 'casting', g: 'shadow', lvl: 17, cd: 7, save: 'CON', half: true, all: true, dice: '4d8', dt: 'necrotic', drain: 0.3, desc: 'CON save, half: drain life from every foe.' },
  { id: 'tempest_art', name: 'TEMPEST', kind: 'casting', g: 'primal', lvl: 20, cd: 7, save: 'DEX', half: true, all: true, dice: '5d8', dt: 'lightning', rider: 'shocked', desc: 'DEX save, half: a storm over the battlefield.' },
  { id: 'starfire', name: 'STARFIRE', kind: 'casting', g: 'arcane', lvl: 40, cd: 7, atk: true, dice: '8d12', dt: 'force', rider: 'vulnerable', desc: 'Spell attack: concentrated starlight.' },
  { id: 'dawn_requiem', name: 'DAWN REQUIEM', kind: 'casting', g: 'divine', lvl: 100, cd: 9, save: 'WIS', half: true, all: true, dice: '10d10', dt: 'radiant', heal: '6d10', desc: 'WIS save, half: the last lantern burns for everyone.' },
  { id: 'void_collapse', name: 'VOID COLLAPSE', kind: 'casting', g: 'shadow', lvl: 100, cd: 9, save: 'CON', half: true, all: true, dice: '10d10', dt: 'force', rider: 'doomed', desc: 'CON save, half: the dark folds inward.' },
];
const ART_BY_ID = Object.fromEntries(ARTS.map(a => [a.id, a]));
const ART_SCHOOL = { fire: 'storm', cold: 'storm', lightning: 'storm', force: 'storm', thunder: 'storm', radiant: 'aegis', necrotic: 'grave', poison: 'grave', psychic: 'omen', acid: 'flux', piercing: 'calling' };
const ART_MAX = 4;

function artsFor(c) { return ARTS.filter(a => (ART_GROUPS[a.g] || []).includes(c.cls) && (c.lvl || 1) >= a.lvl); }
function artLoadout(c) {
  const known = artsFor(c), ids = new Set(known.map(a => a.id));
  if (!Array.isArray(c.arts)) c.arts = [];
  c.arts = c.arts.filter(id => ids.has(id)).slice(0, ART_MAX);
  if (!c.arts.length || c.ai) { // auto: newest physical + casting mix
    const sorted = known.slice().sort((a, b) => b.lvl - a.lvl);
    for (const a of sorted) if (c.arts.length < ART_MAX && !c.arts.includes(a.id)) c.arts.push(a.id);
  }
  return c.arts.map(id => ART_BY_ID[id]).filter(Boolean);
}
const artDice = (a, c) => { const [n, d, per] = a.bonus || [0, 6, 0]; const k = n + (per ? Math.floor((c.lvl || 1) / per) : 0); return k > 0 ? `${k}d${d}` : null; };
function artLine(a, c) {
  if (a.kind === 'physical') { const b = artDice(a, c); return `WEAPON${a.hits ? ' x' + a.hits : ''}${a.all ? ' ALL' : ''}${b ? ' +' + b : ''}`; }
  return `${a.atk ? 'SPELL ATK' : a.save + ' SAVE'} ${a.dice} ${a.dt.toUpperCase()}${a.all ? ' ALL' : ''}`;
}

// battle hooks --------------------------------------------------------------
function artReady(b, u, a) { const k = u.id + ':' + a.id; return !(b.artCd && b.artCd[k] > b.round); }
function artUse(b, u, a, t) {
  b.artCd ||= {}; b.artCd[u.id + ':' + a.id] = b.round + a.cd;
  const c = u.ch, D = derive(c), steps = [];
  if (!u.ch.ai) G.stats.artsUsed = (G.stats.artsUsed || 0) + 1;
  if (a.kind === 'physical') {
    const foes = a.all ? b.enemiesOf(u).filter(alive) : [t];
    steps.push(b.say(`${c.name}: ${a.name}!`, () => { SFX.select(); b.anim.lunge = u.id; }));
    for (const f of foes) {
      const opt = { single: true, skillBonus: artDice(a, c), stun: a.stun, prone: a.prone, rider: a.rider, execute: a.execute };
      for (let h = 0; h < (a.hits || 1); h++) steps.push(...b.weaponAttack(u, f, opt));
    }
    if (a.selfBuff) steps.push(b.say(`${c.name} is ${BUFFS[a.selfBuff].name}!`, () => addEffect(u, { id: a.selfBuff, rounds: 3 })));
    return steps;
  }
  // casting: reuse the spell pipeline (attack roll or save, cantrip-style scaling, elemental bonuses)
  const sp = { id: 'art_' + a.id, name: a.name, school: ART_SCHOOL[a.dt] || 'storm', lvl: 0, t: a.all ? 'enemies' : 'enemy', eff: 'dmg', atk: !!a.atk, save: a.save, half: !!a.half, dice: a.dice, dt: a.dt };
  const foes = a.all ? b.enemiesOf(u).filter(alive) : [t];
  const before = foes.map(f => hpOf(f));
  steps.push(...b.castSpell(u, sp, foes));
  steps.push({ text: '', dyn: () => {
    const bits = [];
    if (a.rider) foes.forEach((f, i) => { if (alive(f) && hpOf(f) < before[i] && !(f.condImm || []).includes(a.rider)) { addEffect(f, { id: a.rider, rounds: 3, lvl: c.lvl, src: u.id }); bits.push(f.name); } });
    if (a.drain) { const dealt = foes.reduce((s, f, i) => s + Math.max(0, before[i] - hpOf(f)), 0); if (dealt) b.heal(u, Math.ceil(dealt * a.drain)); }
    if (a.heal) b.party.filter(x => isChar(x) && alive(x)).forEach(x => b.heal(x, roll(a.heal).total + Math.floor(c.lvl / 4)));
    const msg = [a.rider && bits.length ? `${bits.slice(0, 2).join(', ')} ${BUFFS[a.rider].name}` : '', a.drain ? 'LIFE DRAINED' : '', a.heal ? 'PARTY HEALED' : ''].filter(Boolean).join('. ');
    return msg ? { text: msg } : null;
  } });
  return steps;
}
// entries for Battle.abilities()
function artAbilities(b, u) {
  if (!isChar(u)) return [];
  return artLoadout(u.ch).map(a => {
    const ok = artReady(b, u, a), left = ok ? 0 : b.artCd[u.id + ':' + a.id] - b.round;
    return { id: 'art_' + a.id, name: a.name, cost: ok ? `CD${a.cd}` : `${left}R`, ok, bonus: false, fn: t => artUse(b, u, a, t), target: a.all ? null : 'enemy' };
  });
}
// companion AI: use a ready art about half the time
function aiArt(b, u, foes, boss, weakest) {
  const ready = artLoadout(u.ch).filter(a => artReady(b, u, a));
  if (!ready.length || R() > 0.55) return null;
  const aoe = ready.find(a => a.all && foes.length >= 2);
  const a = aoe || ready.sort((x, y) => y.lvl - x.lvl)[0];
  return artUse(b, u, a, boss && boss.boss ? boss : weakest);
}

// ---------------------------------------------------------------- loadout scene
class ArtsScene {
  constructor() { this.opaque = true; this.i = 0; this.top = 0; this.msg = ''; }
  list() { return artsFor(G).sort((a, b) => a.lvl - b.lvl); }
  update() {
    const L = this.list();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!L.length) return;
    if (nav('up')) { this.i = (this.i + L.length - 1) % L.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % L.length; SFX.cursor(); }
    if (this.i < this.top) this.top = this.i; if (this.i > this.top + 6) this.top = this.i - 6;
    if (P('a')) {
      artLoadout(G); const a = L[this.i], k = G.arts.indexOf(a.id);
      if (k >= 0) { G.arts.splice(k, 1); this.msg = `${a.name} UNEQUIPPED`; SFX.back(); }
      else if (G.arts.length >= ART_MAX) { this.msg = 'ALL 4 SLOTS FULL'; SFX.error(); }
      else { G.arts.push(a.id); this.msg = `${a.name} EQUIPPED`; SFX.confirm(); }
      saveGame();
    }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    const L = this.list(); artLoadout(G);
    textC(`COMBAT ARTS ${G.arts.length}/${ART_MAX}`, 80, 1, 'gold');
    if (!L.length) { textC('NO ARTS FOR THIS CLASS', 80, 60, 2); return; }
    L.slice(this.top, this.top + 7).forEach((a, j) => {
      const i = this.top + j, y = 14 + j * 11, on = G.arts.includes(a.id);
      if (i === this.i) fill(1, y - 1, 158, 11, 1);
      text(on ? '*' : ' ', 3, y, 'gold');
      text(a.name.slice(0, 14), 10, y, on ? 'gold' : 3);
      textR(`${a.kind === 'physical' ? 'PHY' : 'CAST'} L${a.lvl}`, 157, y, a.kind === 'physical' ? 'red' : 'blue');
    });
    const a = L[this.i];
    frame(1, 92, 158, 51);
    text(artLine(a, G).slice(0, 25), 5, 95, 'gold');
    text(`COOLDOWN ${a.cd} ROUNDS`, 5, 104, 2);
    text(wrap(a.desc, 25).slice(0, 2).join('\n'), 5, 113, 3);
    text((this.msg || 'A: EQUIP / UNEQUIP').slice(0, 25), 5, 133, this.msg ? 'green' : 1);
  }
}
