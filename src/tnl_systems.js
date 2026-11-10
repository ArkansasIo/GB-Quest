'use strict';
// ================================================================ THRONE-STYLE WORLD SYSTEMS
// Four systems in the spirit of modern open-world MMOs:
//   * WEAPON MASTERY (MAIN MENU > MASTERY): every weapon family (sword, dagger, axe, mace, polearm, bow, crossbow,
//     staff, wand) levels 1-30 from the battles you win with it equipped. Each level adds that family's bonuses
//     while you wield it; levels 10, 20 and 30 are SPECIALIZATION ranks (ADEPT, EXPERT, MASTER) with a bigger step.
//   * AMITOI EXPEDITIONS (MAIN MENU > AMITOI): small companion spirits you send on real-time expeditions
//     (15 min, 1 hour, 4 hours) to a zone you have visited. They come back with gold, materials and sometimes gear,
//     and level up (1-10) for better hauls. Start with one, adopt up to four.
//   * DAY AND NIGHT: the world clock (one game hour per real minute) now matters. At night foes are 15% tougher and
//     give 25% more XP and gold, NOCTURNAL elites prowl (5% of night encounters) and the screen darkens.
//   * MORPH (MAIN MENU > MORPH): WOLF FORM (level 5) runs like a fast mount and scares off some encounters;
//     SWIM FORM (level 10) crosses water. Not in instances.
// Pure rules are exported as GBQTnl for tests; the game wiring runs only inside the game.

// ---------------------------------------------------------------- weapon mastery
const MASTERY_MAX = 30;
const MASTERY_FAMS = ['sword', 'dagger', 'axe', 'mace', 'polearm', 'bow', 'crossbow', 'staff', 'wand'];
const MASTERY_BONUS = { sword: [['hit', 0.2], ['crit', 0.3]], dagger: [['crit', 0.4], ['critdmg', 1.5]], axe: [['dmg', 0.6], ['critdmg', 1]], mace: [['dmg', 0.5], ['acb', 0.1]],
  polearm: [['hit', 0.2], ['dmg', 0.5]], bow: [['hit', 0.25], ['crit', 0.3]], crossbow: [['dmg', 0.5], ['crit', 0.25]], staff: [['heal', 0.6], ['fire', 0.6]], wand: [['lightning', 0.6], ['cold', 0.6]] };
const MASTERY_RANKS = [[30, 'MASTER'], [20, 'EXPERT'], [10, 'ADEPT'], [1, 'NOVICE']];
const masteryXpFor = lvl => Math.round(40 * Math.pow(lvl, 1.5));                 // xp to go from lvl to lvl+1
function masteryAdd(m, xp) {                                                        // m = { lvl, xp } -> levels gained
  m.lvl = m.lvl || 1; m.xp = (m.xp || 0) + Math.max(0, xp); let ups = 0;
  while (m.lvl < MASTERY_MAX && m.xp >= masteryXpFor(m.lvl)) { m.xp -= masteryXpFor(m.lvl); m.lvl++; ups++; }
  if (m.lvl >= MASTERY_MAX) m.xp = 0;
  return ups;
}
const masteryRank = lvl => (MASTERY_RANKS.find(([l]) => lvl >= l) || MASTERY_RANKS[3])[1];
function masteryBonus(fam, lvl) {
  if (!MASTERY_BONUS[fam] || !(lvl > 1)) return [];
  const steps = (lvl - 1) + 3 * [10, 20, 30].filter(l => lvl >= l).length;       // specialization ranks count triple
  return MASTERY_BONUS[fam].map(([k, v]) => [k, Math.max(1, Math.floor(v * steps))]);
}
// ---------------------------------------------------------------- amitoi
const AMITOI_KINDS = [{ id: 'sprout', name: 'SPROUT' }, { id: 'ember', name: 'EMBERKIT' }, { id: 'pebble', name: 'PEBBLE' }, { id: 'mist', name: 'MISTLING' }, { id: 'nib', name: 'NIB' }];
const AMITOI_MAX = 4, AMITOI_ADOPT = [0, 400, 1500, 5000];
const EXPEDITIONS = [{ id: 'short', name: '15 MIN', ms: 15 * 6e4, mult: 1 }, { id: 'mid', name: '1 HOUR', ms: 60 * 6e4, mult: 3.2 }, { id: 'long', name: '4 HOURS', ms: 240 * 6e4, mult: 10 }];
// reward for one expedition: deterministic from a seed so tests can check it
function expeditionReward(exp, petLvl, heroLvl, seed) {
  const E = EXPEDITIONS.find(e => e.id === exp) || EXPEDITIONS[0], L = Math.max(1, petLvl || 1), H = Math.max(1, heroLvl || 1);
  let h = (seed >>> 0) || 1; const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const mats = Math.round((2 + L) * E.mult * (0.8 + r() * 0.4));
  return { gold: Math.round((20 + H * 6) * E.mult * (1 + L * 0.1)), mats, gear: r() < 0.08 * E.mult * (1 + L * 0.05) ? Math.min(4, 1 + Math.floor(r() * (1 + L / 4))) : 0, petXp: Math.round(10 * E.mult) };
}
const amitoiLevel = xp => Math.min(10, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 15)));
// ---------------------------------------------------------------- day and night
const isNight = hour => hour >= 21 || hour < 5;
const NIGHT = { hp: 1.15, dmg: 1.1, xp: 1.25, gold: 1.25, nocturnal: 0.05 };

if (typeof globalThis !== 'undefined') globalThis.GBQTnl = { MASTERY_MAX, MASTERY_FAMS, masteryXpFor, masteryAdd, masteryRank, masteryBonus, AMITOI_KINDS, AMITOI_MAX, AMITOI_ADOPT, EXPEDITIONS, expeditionReward, amitoiLevel, isNight, NIGHT };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined' && typeof derive === 'function') {
  const hour = () => typeof Clock !== 'undefined' ? Clock.hour : new Date().getHours();
  const night = () => isNight(hour());
  // ------------------------------------------------ mastery
  const famOf = it => { if (!it || it.kind !== 'weapon') return null; const f = (typeof WEAPON_ART !== 'undefined' && WEAPON_ART[it.base]) || (WEAPONS[it.base] && WEAPONS[it.base].fam) || 'sword'; return MASTERY_FAMS.includes(f) ? f : 'sword'; };
  const M = () => (G.mastery ||= {});
  { const sb0 = armorSetBonus; armorSetBonus = function (c) { const out = sb0.apply(this, arguments); if (c && c.mastery) { const f = famOf(c.eq && c.eq.weapon); if (f && c.mastery[f]) out.push(...masteryBonus(f, c.mastery[f].lvl)); } return out; }; }
  { const f0 = Battle.prototype.finish; Battle.prototype.finish = function (result) {
      try {
        if (result === 'win' && G && !this.noRewards) {
          const f = famOf(G.eq.weapon);
          if (f) { const m = (M()[f] ||= { lvl: 1, xp: 0 }), before = m.lvl, ups = masteryAdd(m, (this.foes || []).length * 6 + (this.foes || []).filter(x => x.boss || x.elite).length * 20);
            if (ups) { toast(`${f.toUpperCase()} MASTERY ${m.lvl}`, m.lvl % 10 === 0 && before < m.lvl ? `SPECIALIZATION: ${masteryRank(m.lvl)}` : 'Weapon bonuses up', 'pp_xp', 'levelup'); if (typeof chatLog === 'function') chatLog('xp', 'MASTERY', `${f.toUpperCase()} mastery reached ${m.lvl} (${masteryRank(m.lvl)}).`); } }
        }
      } catch (e) { console.warn('mastery', e); }
      return f0.apply(this, arguments);
    }; }
  function masteryMenu() {
    const cur = famOf(G.eq.weapon);
    choose([...MASTERY_FAMS.map(f => { const m = M()[f] || { lvl: 1 }; return `${f === cur ? '* ' : ''}${f.toUpperCase()} ${m.lvl} ${masteryRank(m.lvl)}`.slice(0, 22); }), 'BACK'], k => {
      if (k < 0 || k >= MASTERY_FAMS.length) return;
      const f = MASTERY_FAMS[k], m = M()[f] || { lvl: 1, xp: 0 }, b = masteryBonus(f, m.lvl), nb = masteryBonus(f, Math.min(MASTERY_MAX, m.lvl + 1));
      say([`${f.toUpperCase()} MASTERY ${m.lvl}/${MASTERY_MAX} (${masteryRank(m.lvl)})`, m.lvl < MASTERY_MAX ? `XP ${m.xp || 0}/${masteryXpFor(m.lvl)}. Win battles with a ${f} equipped.` : 'Fully mastered.',
        `Now: ${b.length ? b.map(([s, v]) => `${(SUBSTATS[s] || { name: s }).name} +${v}`).join(', ') : 'no bonus yet'}.`, `Next: ${nb.map(([s, v]) => `${(SUBSTATS[s] || { name: s }).name} +${v}`).join(', ')}. Ranks at 10/20/30 count triple.`], masteryMenu);
    }, `WEAPON MASTERY${cur ? ` - wielding ${cur.toUpperCase()}` : ''}`);
  }
  // ------------------------------------------------ amitoi
  const A = () => { G.amitoi ||= { pets: [{ kind: 'sprout', name: 'SPROUT', xp: 0 }], exp: [] }; return G.amitoi; };
  const MATS = () => ['scrap', 'shard', 'ember', 'peacebloom', 'sandroot', 'frostbloom', 'gold_dust', 'small_fish'].filter(k => ITEMS[k]);
  const visited = () => ZONES.filter(z => !z.town && z.lvl && (G.waypoints || {})[z.id]);
  function claim(ex, i) {
    const a = A(), pet = a.pets[ex.pet], r = expeditionReward(ex.type, amitoiLevel(pet.xp), G.lvl, ex.seed);
    G.gold += r.gold; const mats = MATS(); for (let n = 0; n < r.mats; n++) addItem(mats[(ex.seed + n * 7) % mats.length]);
    if (r.gear) addGear(makeItem({ lvl: G.lvl, rarity: r.gear }));
    const lv0 = amitoiLevel(pet.xp); pet.xp += r.petXp; a.exp.splice(i, 1);
    return `${pet.name}: +${fmt(r.gold)} G, ${r.mats} materials${r.gear ? ', an item' : ''}${amitoiLevel(pet.xp) > lv0 ? `. LEVEL ${amitoiLevel(pet.xp)}!` : '.'}`;
  }
  (window.LOOP_HOOKS ||= []).push(() => { if (!G || !G.amitoi) return; for (const ex of G.amitoi.exp) if (!ex.told && Date.now() >= ex.end) { ex.told = true; toast('AMITOI RETURNED', `${G.amitoi.pets[ex.pet].name} is back!`, 'pp_xp', 'quest_done'); } });
  function amitoiMenu() {
    const a = A(), busy = new Set(a.exp.map(e => e.pet)), now = Date.now();
    const rows = a.pets.map((p, i) => { const ex = a.exp.find(e => e.pet === i); return `${p.name.slice(0, 8)} L${amitoiLevel(p.xp)} ${ex ? (now >= ex.end ? 'DONE!' : `${Math.ceil((ex.end - now) / 6e4)}m`) : 'HOME'}`; });
    const opts = [...rows, ...(a.exp.some(e => now >= e.end) ? ['CLAIM ALL'] : []), ...(a.pets.length < AMITOI_MAX ? [`ADOPT (${fmt(AMITOI_ADOPT[a.pets.length])} G)`] : []), 'BACK'];
    choose(opts, k => {
      const o = opts[k]; if (!o || o === 'BACK') return;
      if (o === 'CLAIM ALL') { const out = []; for (let i = a.exp.length - 1; i >= 0; i--) if (Date.now() >= a.exp[i].end) out.push(claim(a.exp[i], i)); SFX.coin ? SFX.coin() : SFX.buff(); saveGame(); return say(out, amitoiMenu); }
      if (o.startsWith('ADOPT')) { const cost = AMITOI_ADOPT[a.pets.length]; if (G.gold < cost) { SFX.error(); return say(`Adopting costs ${fmt(cost)} G.`, amitoiMenu); } G.gold -= cost; const kd = AMITOI_KINDS[a.pets.length % AMITOI_KINDS.length]; a.pets.push({ kind: kd.id, name: kd.name, xp: 0 }); SFX.levelup(); saveGame(); return say(`${kd.name} joins your amitoi!`, amitoiMenu); }
      if (k < a.pets.length) {
        const ex = a.exp.find(e => e.pet === k);
        if (ex) { if (Date.now() >= ex.end) { const i = a.exp.indexOf(ex); const msg = claim(ex, i); SFX.buff(); saveGame(); return say(msg, amitoiMenu); } return say(`${a.pets[k].name} is exploring ${(ZONE_BY_ID[ex.zone] || { name: '?' }).name}. Back in ${Math.ceil((ex.end - Date.now()) / 6e4)} min.`, amitoiMenu); }
        const zs = visited(); if (!zs.length) return say('Visit a zone first (touch its waypoint).', amitoiMenu);
        choose([...EXPEDITIONS.map(e => e.name), 'BACK'], t => {
          if (t < 0 || t >= EXPEDITIONS.length) return amitoiMenu();
          choose(zs.slice(0, 12).map(z => z.name.slice(0, 20)), zi => {
            if (zi < 0) return amitoiMenu();
            const E = EXPEDITIONS[t]; a.exp.push({ pet: k, zone: zs[zi].id, type: E.id, start: Date.now(), end: Date.now() + E.ms, seed: (Date.now() ^ (k * 2654435761)) >>> 0 }); SFX.select(); saveGame();
            say(`${a.pets[k].name} sets off for ${zs[zi].name}. Back in ${E.name}.`, amitoiMenu);
          }, 'Where to?');
        }, `Send ${a.pets[k].name} (L${amitoiLevel(a.pets[k].xp)}) on an expedition. Longer trips bring more.`);
      }
    }, `AMITOI ${a.pets.length}/${AMITOI_MAX}. Expeditions run in real time.`);
  }
  // ------------------------------------------------ day and night
  { const mm0 = makeMonster; makeMonster = function (src, L, diff, extra) {
      const m = mm0.apply(this, arguments);
      try { if (night() && m && m.side !== 'party' && !(extra && (extra.side === 'party' || extra.ally)) && !m.boss) { m.maxhp = Math.round(m.maxhp * NIGHT.hp); m.hp = m.maxhp; (m.attacks || []).forEach(a => { a.dice = dmgDice(diceAvg(a.dice) * NIGHT.dmg); }); m.xp = Math.round((m.xp || 1) * NIGHT.xp); m.gold = Math.round((m.gold || 1) * NIGHT.gold); m.night = true; } } catch (e) { /* keep the monster */ }
      return m;
    }; }
  { const re0 = rollEncounter; rollEncounter = function (zoneDef) {
      const foes = re0.apply(this, arguments);
      try {
        if (night() && G && !G.inst && zoneDef && !zoneDef.town && foes && foes.length && !foes.some(f => f.rare || f.boss) && R() < NIGHT.nocturnal) {
          const f = foes[0]; f.elite = true; f.maxhp = Math.round(f.maxhp * 1.8); f.hp = f.maxhp; f.xp = Math.round((f.xp || 1) * 3); f.gold = Math.round((f.gold || 1) * 3); f.name = `NOCTURNAL ${f.name}`.slice(0, 16);
          toast('NOCTURNAL ELITE', 'Something stirs in the dark...', 'px_skull', 'boss_appear');
        }
      } catch (e) { /* keep the encounter */ }
      return foes;
    }; }
  { const d0 = Field.prototype.draw; Field.prototype.draw = function () {
      d0.apply(this, arguments);
      try {
        if (!G || G.inst || S.video === 'hd64') return;
        const h = hour(), a = isNight(h) ? 0.32 : (h >= 19 && h < 21) || (h >= 5 && h < 7) ? 0.14 : 0;
        if (a) { ctx.fillStyle = `rgba(16,20,64,${a})`; ctx.fillRect(0, 0, W, H); }
        if (typeof hudMmo === 'function' && hudMmo()) { const L = MMO_LAYOUT.map, x = L.x - 9, y = L.y + 2; if (isNight(h)) { fill(x, y, 7, 7, '#e8e4c0'); fill(x + 3, y, 4, 5, '#20284a'); } else { fill(x + 1, y + 1, 5, 5, '#f8d040'); } }
      } catch (e) { /* drawing only */ }
    }; }
  // ------------------------------------------------ morph
  if (typeof MOUNT_BY_ID !== 'undefined') MOUNT_BY_ID.morph_wolf = { id: 'morph_wolf', name: 'WOLF FORM', speed: 5, enc: 0.4, source: 'morph' };
  const WATER = ['~', 'W', 'w', 'v'];
  { const b0 = Field.prototype.blocked; Field.prototype.blocked = function (x, y) {
      if (G && G.morph === 'swim' && !G.inst && WATER.includes(this.chAt(x, y)) && !this.entities().some(e => e.x === x && e.y === y && !e.walk)) return false;
      return b0.apply(this, arguments);
    }; }
  // Keep the player's original mount state while moving between forms. Morphs are temporary
  // movement modes, not entries in the player's collectible mount inventory.
  function endMorph(silent, restoreRide = true) {
    if (!G || !G.morph) return false;
    const previousMount = Object.prototype.hasOwnProperty.call(G, 'morphPrevMount') ? G.morphPrevMount : ((G.mounts && G.mounts[0]) || null);
    const previousMounted = Object.prototype.hasOwnProperty.call(G, 'morphPrevMounted') ? !!G.morphPrevMounted : false;
    G.morph = null;
    G.mount = previousMount;
    G.mounted = restoreRide ? previousMounted : false;
    delete G.morphPrevMount;
    delete G.morphPrevMounted;
    if (!silent) SFX.cursor();
    return true;
  }
  function setMorphForm(form) {
    if (!G || G.inst || !['wolf', 'swim'].includes(form)) return false;
    const requiredLevel = form === 'wolf' ? 5 : 10;
    if (G.lvl < requiredLevel) return false;
    if (!G.morph) {
      G.morphPrevMount = G.mount || null;
      G.morphPrevMounted = !!G.mounted;
    }
    G.morph = form;
    if (form === 'wolf') { G.mount = 'morph_wolf'; G.mounted = true; }
    else { G.mount = G.morphPrevMount; G.mounted = false; }
    return true;
  }
  window.endMorph = endMorph;
  window.setMorphForm = setMorphForm;
  function morphMenu() {
    if (G.inst) return say('You cannot morph inside an instance.');
    const opts = [`WOLF FORM${G.lvl < 5 ? ' (LV5)' : ''}`, `SWIM FORM${G.lvl < 10 ? ' (LV10)' : ''}`, ...(G.morph ? ['HUMAN FORM'] : []), 'BACK'];
    choose(opts, k => {
      const o = opts[k]; if (!o || o === 'BACK') return;
      if (o === 'HUMAN FORM') {
        const f = scenes.find(s => s instanceof Field);
        if (G.morph === 'swim' && f && WATER.includes(f.chAt(G.x, G.y))) return say('Reach the shore first.');
        endMorph(); return;
      }
      if (o.startsWith('WOLF')) {
        if (!setMorphForm('wolf')) return say('WOLF FORM opens at level 5.');
        SFX.howl ? SFX.howl() : SFX.buff();
        toast('WOLF FORM', 'Run fast. B: back to human.', 'pp_xp', 'buff'); return;
      }
      if (o.startsWith('SWIM')) {
        if (!setMorphForm('swim')) return say('SWIM FORM opens at level 10.');
        SFX.buff(); toast('SWIM FORM', 'You can cross water. B: back to human.', 'pp_xp', 'buff');
      }
    }, `MORPH${G.morph ? ` (now: ${G.morph.toUpperCase()})` : ''}. Wolf runs, swim crosses water.`);
  }
  // B returns from a morph directly instead of relying on G.hasMount (morphs are not owned mounts).
  { const u0 = Field.prototype.update; Field.prototype.update = function () {
      if (G && G.morph && G.inst) endMorph(true, false);
      if (G && G.morph === 'wolf' && !G.mounted) endMorph(true);
      if (G && G.morph && P('b') && !G.inst && !G.ghost) {
        if (G.morph === 'swim' && WATER.includes(this.chAt(G.x, G.y))) return say('Reach the shore before leaving SWIM FORM.');
        endMorph(); return;
      }
      return u0.apply(this, arguments);
    }; }
  { const wolfArt = () => { const b = typeof BEAST_BY_ID !== 'undefined' && BEAST_BY_ID.beast_wolf_base; const n = b && (b.nspr && IMG[b.nspr] ? b.nspr : b.spr); if (n && IMG[n] && !IMG.mt_morph_wolf) IMG.mt_morph_wolf = IMG[n]; };
    const w = setInterval(() => { if (typeof IMG !== 'undefined' && IMG.gh_warden_down0) { clearInterval(w); wolfArt(); } }, 300); setTimeout(() => clearInterval(w), 30000); }
  // swim: a water line over the hero
  { const d0 = Field.prototype.draw; Field.prototype.draw = function () {
      d0.apply(this, arguments);
      try { if (G && G.morph === 'swim' && this.cam && WATER.includes(this.chAt(G.x, G.y))) { const px = G.x * 16 - this.cam[0], py = G.y * 16 - this.cam[1]; ctx.globalAlpha = 0.75; fill(px, py + 8, 16, 6, '#3c78d8'); ctx.globalAlpha = 1; fill(px + 2 + ((frameN >> 3) % 4), py + 8, 4, 1, '#d8ecff'); } } catch (e) { /* drawing only */ }
    }; }
  // ------------------------------------------------ main menu entries
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { MASTERY: 'Weapon mastery levels.', AMITOI: 'Send pets on expeditions.', MORPH: 'Wolf or swim form.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () {
      const L = i0.apply(this, arguments), at = Math.max(0, L.indexOf('MOUNTS'));
      const amiReady = G && G.amitoi && G.amitoi.exp.some(e => Date.now() >= e.end);
      L.splice(at, 0, 'MASTERY', amiReady ? 'AMITOI (!)' : 'AMITOI', 'MORPH'); return L;
    };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () {
      if (P('a')) { const o = (this.items()[this.i] || '').replace(' (!)', ''); if (o === 'MASTERY') { SFX.select(); return masteryMenu(); } if (o === 'AMITOI') { SFX.select(); return amitoiMenu(); } if (o === 'MORPH') { SFX.select(); return morphMenu(); } }
      return u0.apply(this, arguments);
    };
  }
}
