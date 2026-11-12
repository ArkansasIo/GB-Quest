'use strict';
// ================================================================ ACTION-RPG GEAR: ASPECTS, GREATER AFFIXES, TEMPERING, MASTERWORK
// Gear effects in the style of modern action RPGs (Diablo IV and friends), on top of the existing affix system:
//   * LEGENDARY ASPECTS: legendary, mythic, ancestral and divine items roll one of 160+ ASPECTS (src/aspects_data.js):
//     every family of legendary power (conditional damage, elemental brands and fangs, chains, kill explosions,
//     debuffs to inflict and exploit, buffs on kill or at battle start, barriers, damage reduction, reflection and
//     passive stats), each with its own value range. Named items always carry the same aspect.
//   * GREATER AFFIXES: every affix has a 6% chance (ancestral and divine: one guaranteed) to roll 1.5x, marked GREATER.
//   * OCCULTIST (MAIN MENU > OCCULTIST):
//       EXTRACT  destroy a legendary item to save its aspect in your CODEX OF POWER (the best value is kept)
//       IMPRINT  put a codex aspect on any rare-or-better item you own (gold cost by item level)
//       TEMPER   add an affix line from OFFENSIVE, DEFENSIVE or UTILITY recipes (2 per item; gold + scrap)
//       MASTERWORK raise an item 12 ranks: each rank +5% to its affixes, ranks 4/8/12 also boost one affix by 25%
// Aspects fire in battle through the damage pipeline. Pure rules are exported as GBQAspects for tests.

// ASPECTS come from ASPECT_SPECS (src/aspects_data.js): 160+ powers in every action-RPG family, with text built from the spec
const ASPECT_EL_NAME = { slashing: 'physical', piercing: 'physical', bludgeoning: 'physical' };
const aspNameOf = id => (typeof BUFFS !== 'undefined' && BUFFS[id] && BUFFS[id].name) || (typeof CONDITIONS !== 'undefined' && CONDITIONS[id] && CONDITIONS[id].name) || String(id).toUpperCase();
const ASP_WHEN = { lowhp: 'to foes under 35% HP', fullhp: 'to foes at full HP', elite: 'to elites and bosses', crowd: 'while 3+ foes stand', crit: 'on critical hits', first: 'with your first hit each battle', selfhigh: 'while you are above 80% HP', selflow: 'while you are below 35% HP', phys: 'with physical hits', spell: 'with spells' };
const ASP_STAT = { gf: 'gold find', mf: 'magic find', heal: 'healing', fire: 'fire dmg', lightning: 'shock dmg', cold: 'cold dmg', necrotic: 'shadow dmg', hit: 'accuracy', crit: 'crit chance', critdmg: 'crit damage', leech: 'lifesteal', haste: 'haste', block: 'block', dodge: 'dodge', hp: 'max HP', acb: 'armour', resist: 'resist all', thorns: 'thorns', xp: 'XP', dmg: 'damage' };
const elName = el => (ASPECT_EL_NAME[el] || el);
const aspStatVal = (v, m) => Math.max(1, Math.floor(v * m));
function aspectText(e, v) {
  const when = w => ASP_WHEN[w] || (w.startsWith('el:') ? `with ${elName(w.slice(3))} damage` : w.startsWith('cond:') ? `to ${aspNameOf(w.slice(5)).toLowerCase()} foes` : w.startsWith('buff:') ? `while ${aspNameOf(w.slice(5)).toLowerCase()}` : '');
  const a = e.act || {}, ch = e.pv ? v : e.p;
  if (e.t === 'dmg') return `+${v}% damage ${when(e.when)}.`;
  if (e.t === 'stat') return e.stats.map(([k, m]) => `+${aspStatVal(v, m)}${['hp', 'acb', 'hit', 'thorns'].includes(k) ? '' : '%'} ${ASP_STAT[k] || k}`).join(', ') + '.';
  if (e.t === 'proc') return a.cond ? `Hits have ${ch}% to inflict ${aspNameOf(a.cond)}.` : a.bonus ? `${ch}% of hits add ${v}% as ${elName(a.bonus)} damage.` : a.chain ? `Lucky hit (${ch}%): ${elName(a.chain)} arcs to another foe for ${v}% of the hit.` : a.heal ? `Lucky hit (${ch}%): heal ${v}% of max HP.` : a.barrier ? `Lucky hit (${ch}%): a barrier of ${v}% max HP.` : `Hits have ${ch}% to grant ${aspNameOf(a.buff)} for ${a.rounds || 2} rounds.`;
  if (e.t === 'kill') return a.explode ? `Kills explode for ${v}% of the foe's max HP as ${elName(a.explode)}.` : a.buff ? `Kills grant ${aspNameOf(a.buff)} for ${v} rounds.` : a.heal ? `Kills heal ${v}% of max HP.` : `Kills grant a barrier of ${v}% max HP.`;
  if (e.t === 'start') return a.buff ? `Start battles ${aspNameOf(a.buff)} for ${v} rounds.` : `Start battles behind a barrier of ${v}% max HP.`;
  if (e.t === 'hit') return a.reflect ? `Reflect ${v}% of damage taken.` : a.curse ? `Attackers have ${v}% to become ${aspNameOf(a.curse)}.` : a.when === 'always' ? `Take ${v}% less damage.` : `Take ${v}% less damage ${a.when === 'lowhp' ? 'below 50% HP' : a.when === 'elite' ? 'from elites and bosses' : a.when === 'barrier' ? 'while you have a barrier' : `from ${elName(String(a.when).slice(3))}`}.`;
  return '';
}
const ASPECTS = Object.fromEntries(Object.entries(typeof ASPECT_SPECS !== 'undefined' ? ASPECT_SPECS : {}).map(([id, A]) => [id, Object.assign({}, A, { desc: v => aspectText(A.e, v) })]));
const ASPECT_IDS = Object.keys(ASPECTS);
const GREATER_CHANCE = 0.06, GREATER_MULT = 1.5, TEMPER_MAX = 2, MW_MAX = 12, MW_STEP = 0.05, MW_CRIT = 1.25;
const TEMPER_POOLS = { OFFENSIVE: ['dmg', 'crit', 'critdmg', 'hit', 'haste', 'fire', 'lightning', 'necrotic'], DEFENSIVE: ['hp', 'acb', 'resist', 'block', 'dodge'], UTILITY: ['mf', 'gf', 'xp', 'leech', 'heal'] };
const TEMPER_BASE = { dmg: 4, crit: 2, critdmg: 8, hit: 1, haste: 3, fire: 6, lightning: 6, necrotic: 6, hp: 15, acb: 1, resist: 3, block: 2, dodge: 2, mf: 6, gf: 6, xp: 4, leech: 1, heal: 4 };
function aspectHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const fitsKind = (id, kind) => ASPECTS[id].kind === 'any' || ASPECTS[id].kind === kind;
// roll an aspect for an item: value grows with rarity (5..8) and a 0..1 roll
function rollAspect(kind, rarity, r1, r2) {
  const pool = ASPECT_IDS.filter(id => fitsKind(id, kind)), id = pool[Math.floor(r1 * pool.length) % pool.length], A = ASPECTS[id];
  const q = Math.min(1, Math.max(0, (Math.max(5, rarity) - 5) / 4 * 0.5 + r2 * 0.5));
  return { id, val: Math.round(A.lo + (A.hi - A.lo) * q) };
}
// greater affixes: which affix indices roll 1.5x (ancestral+ get at least one)
function rollGreater(n, rarity, rolls) {
  const out = []; for (let i = 0; i < n; i++) if ((rolls[i] || 1) < GREATER_CHANCE) out.push(i);
  if (rarity >= 7 && n && !out.length) out.push(Math.floor((rolls[n] || 0) * n) % n);
  return out;
}
const temperValue = (stat, ilvl) => Math.max(1, Math.round((TEMPER_BASE[stat] || 2) * (1 + Math.max(1, ilvl || 1) / 60)));
// affixes after masterwork: base * (1 + 5% per rank), crit ranks (4/8/12) boost the chosen affixes 25%
function masterworkAffixes(base, rank, critIdx) {
  return base.map(([k, v], i) => [k, Math.max(1, Math.round(v * (1 + MW_STEP * rank) * Math.pow(MW_CRIT, (critIdx || []).filter(c => c === i).length)))]);
}
const masterworkCost = (rank, ilvl) => ({ gold: Math.round((80 + (ilvl || 1) * 4) * Math.pow(1.35, rank)), scrap: 2 + rank * 2 });
const imprintCost = ilvl => 150 + (ilvl || 1) * 8;
const temperCost = ilvl => ({ gold: 100 + (ilvl || 1) * 5, scrap: 4 });

if (typeof globalThis !== 'undefined') globalThis.GBQAspects = { ASPECTS, ASPECT_IDS, rollAspect, rollGreater, temperValue, masterworkAffixes, masterworkCost, imprintCost, temperCost, TEMPER_POOLS, TEMPER_MAX, MW_MAX, GREATER_MULT, fitsKind };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof makeItem === 'function' && typeof Battle !== 'undefined') {
  const GEARK = ['weapon', 'armor', 'wondrous'];
  // ------------------------------------------------ rolling aspects and greater affixes on new items
  { const mk0 = makeItem; makeItem = function (opts) {
      const it = mk0.apply(this, arguments);
      try {
        if (it && GEARK.includes(it.kind) && !it.d4) {
          it.d4 = true;
          const n = (it.affixes || []).length, rolls = Array.from({ length: n + 1 }, () => R());
          const gr = rollGreater(n, it.rarity || 0, rolls);
          if (gr.length) { it.greater = gr; it.affixes = it.affixes.map(([k, v], i) => gr.includes(i) ? [k, Math.max(v + 1, Math.round(v * GREATER_MULT))] : [k, v]); }
          if ((it.rarity || 0) >= 5) it.aspect = it.named ? (() => { const h = aspectHash(it.named || it.name), pool = ASPECT_IDS.filter(id => fitsKind(id, it.kind)), id = pool[h % pool.length]; return { id, val: ASPECTS[id].hi }; })() : rollAspect(it.kind, it.rarity, R(), R());
        }
      } catch (e) { /* the item is still fine */ }
      return it;
    }; }
  // ------------------------------------------------ aspect lookup for a hero
  const aspectsOf = c => { const out = {}; for (const it of Object.values((c && c.eq) || {})) if (it && it.aspect && ASPECTS[it.aspect.id]) out[it.aspect.id] = Math.max(out[it.aspect.id] || 0, it.aspect.val); return out; };
  window.aspectsOf = aspectsOf;
  const ASP = id => ASPECTS[id] && ASPECTS[id].e;
  const each = (A, t, fn) => { for (const [id, v] of Object.entries(A)) { const e = ASP(id); if (e && e.t === t) fn(e, v, id); } };
  // passive aspects as stats
  { const sb0 = armorSetBonus; armorSetBonus = function (c) { const out = sb0.apply(this, arguments); each(aspectsOf(c), 'stat', (e, v) => { for (const [k, m] of e.stats) out.push([k, aspStatVal(v, m)]); }); return out; }; }
  // battle start: buffs and barriers
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.apply(this, arguments);
      for (const u of this.party) if (isChar(u)) each(aspectsOf(u.ch), 'start', (e, v) => {
        if (e.act.barrier) { const pool = Math.round(derive(u.ch).hpMax * v / 100), cur = effOf(u, 'barrier'); addEffect(u, { id: 'barrier', rounds: 99, pool: Math.max(pool, (cur && cur.pool) || 0) }); }
        else if (e.act.buff) addEffect(u, { id: e.act.buff, rounds: v });
      });
    }; }
  const condMet = (w, b, src, tgt, type, opt) => {
    if (!w) return true;
    const frac = tgt && tgt.maxhp ? tgt.hp / tgt.maxhp : (tgt ? hpOf(tgt) / Math.max(1, maxHpOf(tgt)) : 1), sf = src ? hpOf(src) / Math.max(1, maxHpOf(src)) : 1;
    if (w === 'lowhp') return frac < 0.35; if (w === 'fullhp') return frac >= 1; if (w === 'elite') return !!(tgt && (tgt.elite || tgt.boss));
    if (w === 'crowd') return b.foes.filter(f => f.hp > 0).length >= 3; if (w === 'crit') return !!opt.crit; if (w === 'first') return !(b.aspFirst && b.aspFirst.has(src.id));
    if (w === 'selfhigh') return sf > 0.8; if (w === 'selflow') return sf < 0.35; if (w === 'phys') return ['slashing', 'piercing', 'bludgeoning'].includes(type) && !opt.magic; if (w === 'spell') return !!opt.magic;
    if (w.startsWith('el:')) { const el = w.slice(3); return el === 'slashing' ? ['slashing', 'piercing', 'bludgeoning'].includes(type) : type === el; }
    if (w.startsWith('cond:')) return !!(tgt && hasEff(tgt, w.slice(5))); if (w.startsWith('buff:')) return !!(src && hasEff(src, w.slice(5)));
    return false;
  };
  // damage: aspect multipliers going out and coming in, then procs
  { const ad0 = Battle.prototype.applyDamage; Battle.prototype.applyDamage = function (src, tgt, amt, type, opt = {}) {
      let a = amt;
      const srcC = src && isChar(src) ? src.ch : null, A = srcC ? aspectsOf(srcC) : {}, T = tgt && isChar(tgt) ? aspectsOf(tgt.ch) : {};
      try {
        if (srcC && tgt && tgt.side === 'foe' && !opt.proc) { let mult = 0; each(A, 'dmg', (e, v) => { if (condMet(e.when, this, src, tgt, type, opt)) mult += v; }); if (mult) a = Math.round(a * (1 + mult / 100)); (this.aspFirst ||= new Set()).add(src.id); }
        if (tgt && isChar(tgt)) { let red = 0; each(T, 'hit', (e, v) => { const w = e.act.when; if (e.act.reduce && (w === 'always' || (w === 'lowhp' && hpOf(tgt) < maxHpOf(tgt) * 0.5) || (w === 'elite' && src && (src.elite || src.boss)) || (w === 'barrier' && hasEff(tgt, 'barrier')) || (String(w).startsWith('el:') && condMet(w, this, src, tgt, type, opt)))) red += v; }); if (red) a = Math.round(a * (1 - Math.min(75, red) / 100)); }
      } catch (e) { /* fall back to the plain hit */ }
      const wasAlive = tgt && hpOf(tgt) > 0;
      const dealt = ad0.call(this, src, tgt, a, type, opt);
      try {
        if (opt.proc || !dealt) return dealt;
        if (srcC && tgt && tgt.side === 'foe') {
          const others = () => this.foes.filter(f => f !== tgt && f.hp > 0), mhp = Math.max(1, maxHpOf(src));
          each(A, 'proc', (e, v) => {
            const chance = e.pv ? v : e.p, x = e.act; if (R() * 100 >= chance) return;
            if (x.cond && tgt.hp > 0 && !(tgt.condImm || []).includes(x.cond)) addEffect(tgt, { id: x.cond, rounds: x.rounds || 2 });
            else if (x.bonus && tgt.hp > 0) this.applyDamage(src, tgt, Math.max(1, Math.round(dealt * v / 100)), x.bonus, { proc: true, magic: true });
            else if (x.chain) { const L = others(); if (L.length) this.applyDamage(src, pick(L), Math.max(1, Math.round(dealt * v / 100)), x.chain, { proc: true, magic: true }); }
            else if (x.heal) this.heal(src, Math.max(1, Math.round(mhp * v / 100)));
            else if (x.barrier) { const cur = effOf(src, 'barrier'), pool = Math.round(mhp * v / 100); addEffect(src, { id: 'barrier', rounds: 99, pool: ((cur && cur.pool) || 0) + pool }); }
            else if (x.buff) addEffect(src, { id: x.buff, rounds: x.rounds || 2 });
          });
          if (wasAlive && tgt.hp <= 0) each(A, 'kill', (e, v) => {
            const x = e.act;
            if (x.explode) for (const o of others()) this.applyDamage(src, o, Math.max(1, Math.round(tgt.maxhp * v / 100)), x.explode, { proc: true, magic: true });
            else if (x.buff) addEffect(src, { id: x.buff, rounds: v });
            else if (x.heal) this.heal(src, Math.max(1, Math.round(mhp * v / 100)));
            else if (x.barrier) { const cur = effOf(src, 'barrier'); addEffect(src, { id: 'barrier', rounds: 99, pool: ((cur && cur.pool) || 0) + Math.round(mhp * v / 100) }); }
          });
        }
        if (src && !isChar(src) && tgt && isChar(tgt) && src.hp > 0) each(T, 'hit', (e, v) => {
          if (e.act.reflect && opt.attack) this.applyDamage(tgt, src, Math.max(1, Math.round(dealt * v / 100)), 'piercing', { proc: true });
          if (e.act.curse && R() * 100 < v) addEffect(src, { id: e.act.curse, rounds: 2 });
        });
      } catch (e) { console.warn('aspect proc', e); }
      return dealt;
    }; }
  // ------------------------------------------------ item text
  { const d0 = itemDesc; itemDesc = function (it) {
      const s = d0.apply(this, arguments); if (!it || !GEARK.includes(it.kind)) return s;
      const bits = [];
      if (it.aspect && ASPECTS[it.aspect.id]) bits.push(`ASPECT OF ${ASPECTS[it.aspect.id].name}: ${ASPECTS[it.aspect.id].desc(it.aspect.val)}`);
      if (it.greater && it.greater.length) bits.push(`${it.greater.length} GREATER AFFIX${it.greater.length > 1 ? 'ES' : ''}.`);
      if (it.tempers) bits.push(`TEMPERED ${it.tempers}/${TEMPER_MAX}.`);
      if (it.mw) bits.push(`MASTERWORK ${it.mw}/${MW_MAX}.`);
      return bits.length ? `${bits.join(' ')} ${s}` : s;
    }; }
  // ------------------------------------------------ occultist
  const owned = () => [...Object.entries(G.eq || {}).filter(([, it]) => it && GEARK.includes(it.kind)).map(([slot, it]) => ({ it, where: 'eq', slot })), ...(G.bag || []).filter(it => it && GEARK.includes(it.kind)).map(it => ({ it, where: 'bag' }))];
  const label = o => `${o.where === 'eq' ? '*' : ' '}${o.it.name}`.slice(0, 20);
  const pay = (gold, scrap) => { if (G.gold < gold || (G.inv.scrap || 0) < (scrap || 0)) return false; G.gold -= gold; if (scrap) G.inv.scrap -= scrap; return true; };
  function pickItem(title, filter, cb) { const L = owned().filter(filter); if (!L.length) return say('No item fits.', occultistMenu); choose(L.slice(0, 20).map(label), i => { if (i < 0 || i >= L.length) return occultistMenu(); cb(L[i]); }, title); }
  function occultistMenu() {
    const codex = (G.codex ||= {});
    choose(['EXTRACT ASPECT', 'IMPRINT ASPECT', 'TEMPER', 'MASTERWORK', `CODEX (${Object.keys(codex).length}/${ASPECT_IDS.length})`, 'LEAVE'], k => {
      if (k === 0) return pickItem('EXTRACT: the item is destroyed.', o => o.it.aspect && o.where === 'bag', o => {
        const a = o.it.aspect, had = codex[a.id] || 0; codex[a.id] = Math.max(had, a.val); G.bag.splice(G.bag.indexOf(o.it), 1); SFX.extract(); saveGame();
        say([`ASPECT OF ${ASPECTS[a.id].name} saved to your codex.`, had >= a.val ? `You already had a better one (${had}).` : `Value ${a.val}.`], occultistMenu);
      });
      if (k === 1) {
        const ids = Object.keys(codex); if (!ids.length) return say('Your codex is empty. EXTRACT aspects from legendary items first.', occultistMenu);
        return choose(ids.map(id => `${ASPECTS[id].name} ${codex[id]}`), j => {
          if (j < 0) return occultistMenu(); const id = ids[j];
          pickItem(`IMPRINT ${ASPECTS[id].name}`, o => (o.it.rarity || 0) >= 3 && fitsKind(id, o.it.kind), o => {
            const cost = imprintCost(o.it.ilvl); if (!pay(cost)) { SFX.error(); return say(`Imprinting costs ${fmt(cost)} G.`, occultistMenu); }
            o.it.aspect = { id, val: codex[id] }; SFX.imprint(); saveGame(); say(`${o.it.name.slice(0, 18)} now carries ASPECT OF ${ASPECTS[id].name}.`, occultistMenu);
          });
        }, 'Which aspect?');
      }
      if (k === 2) return pickItem('TEMPER which item?', o => (o.it.tempers || 0) < TEMPER_MAX, o => {
        const cats = Object.keys(TEMPER_POOLS);
        choose(cats, j => {
          if (j < 0) return occultistMenu(); const c = temperCost(o.it.ilvl); if (!pay(c.gold, c.scrap)) { SFX.error(); return say(`Tempering costs ${fmt(c.gold)} G and ${c.scrap} SCRAP.`, occultistMenu); }
          const stat = pick(TEMPER_POOLS[cats[j]]), v = temperValue(stat, o.it.ilvl); o.it.affixes = (o.it.affixes || []).concat([[stat, v]]); if (o.it.mwBase) o.it.mwBase.push([stat, v]); o.it.tempers = (o.it.tempers || 0) + 1;
          if (typeof derive === 'function') derive(G); SFX.temper(); saveGame(); say(`Tempered: +${v} ${(SUBSTATS[stat] || { name: stat }).name}. (${o.it.tempers}/${TEMPER_MAX})`, occultistMenu);
        }, `TEMPER ${o.it.name.slice(0, 14)}: pick a recipe. Cost ${fmt(temperCost(o.it.ilvl).gold)} G + ${temperCost(o.it.ilvl).scrap} SCRAP.`);
      });
      if (k === 3) return pickItem('MASTERWORK which item?', o => (o.it.mw || 0) < MW_MAX && (o.it.affixes || []).length, o => {
        const it = o.it, rank = it.mw || 0, c = masterworkCost(rank, it.ilvl);
        choose(['UPGRADE', 'BACK'], j => {
          if (j !== 0) return occultistMenu(); if (!pay(c.gold, c.scrap)) { SFX.error(); return say(`Rank ${rank + 1} costs ${fmt(c.gold)} G and ${c.scrap} SCRAP.`, occultistMenu); }
          it.mwBase ||= it.affixes.map(([s, v]) => [s, v]); it.mw = rank + 1; it.mwCrit ||= [];
          let note = '';
          if (it.mw % 4 === 0) { const ci = Math.floor(R() * it.mwBase.length); it.mwCrit.push(ci); note = ` CRITICAL: ${(SUBSTATS[it.mwBase[ci][0]] || { name: it.mwBase[ci][0] }).name} +25%!`; }
          it.affixes = masterworkAffixes(it.mwBase, it.mw, it.mwCrit); SFX[note ? 'levelup' : 'craft'](); saveGame();
          say(`MASTERWORK ${it.mw}/${MW_MAX}: affixes +${Math.round(it.mw * MW_STEP * 100)}%.${note}`, occultistMenu);
        }, `${it.name.slice(0, 16)} rank ${rank}/${MW_MAX} -> ${rank + 1}. Cost ${fmt(c.gold)} G + ${c.scrap} SCRAP. Ranks 4/8/12 are critical.`);
      });
      if (k === 4) { const ids = Object.keys(codex); return say(ids.length ? ids.map(id => `${ASPECTS[id].name}: ${ASPECTS[id].desc(codex[id])}`) : 'Empty. Extract aspects from legendary gear.', occultistMenu); }
    }, 'OCCULTIST: aspects, tempering and masterwork.');
  }
  window.occultistMenu = occultistMenu;
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { OCCULTIST: 'Aspects, temper, masterwork.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = Math.max(0, L.indexOf('CRAFTING') + 1); L.splice(at, 0, 'OCCULTIST'); return L; };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'OCCULTIST') { SFX.select(); return occultistMenu(); } return u0.apply(this, arguments); };
  }
}
