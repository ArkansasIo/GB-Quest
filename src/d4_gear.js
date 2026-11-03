'use strict';
// ================================================================ ACTION-RPG GEAR: ASPECTS, GREATER AFFIXES, TEMPERING, MASTERWORK
// Gear effects in the style of modern action RPGs (Diablo IV and friends), on top of the existing affix system:
//   * LEGENDARY ASPECTS: legendary, mythic, ancestral and divine items roll one ASPECT, a combat power with its own
//     value (EXECUTIONER: +x% damage to foes under 35% HP, STORMSHARD: lucky hits arc lightning, CORPSEBURST: kills
//     explode, BULWARK: battles start behind a barrier, and 12 more). Named items always carry the same aspect.
//   * GREATER AFFIXES: every affix has a 6% chance (ancestral and divine: one guaranteed) to roll 1.5x, marked GREATER.
//   * OCCULTIST (MAIN MENU > OCCULTIST):
//       EXTRACT  destroy a legendary item to save its aspect in your CODEX OF POWER (the best value is kept)
//       IMPRINT  put a codex aspect on any rare-or-better item you own (gold cost by item level)
//       TEMPER   add an affix line from OFFENSIVE, DEFENSIVE or UTILITY recipes (2 per item; gold + scrap)
//       MASTERWORK raise an item 12 ranks: each rank +5% to its affixes, ranks 4/8/12 also boost one affix by 25%
// Aspects fire in battle through the damage pipeline. Pure rules are exported as GBQAspects for tests.

const ASPECTS = {
  executioner: { name: 'EXECUTIONER', lo: 25, hi: 60, kind: 'weapon', desc: v => `+${v}% damage to foes under 35% HP.` },
  firststrike: { name: 'FIRST STRIKE', lo: 30, hi: 80, kind: 'weapon', desc: v => `+${v}% damage to foes at full HP.` },
  slayer: { name: 'ELITE SLAYER', lo: 15, hi: 40, kind: 'any', desc: v => `+${v}% damage to elites and bosses.` },
  stormshard: { name: 'STORMSHARD', lo: 20, hi: 50, kind: 'weapon', desc: v => `Lucky hit (20%): lightning arcs to another foe for ${v}% of the hit.` },
  glacial: { name: 'GLACIAL', lo: 15, hi: 35, kind: 'weapon', desc: v => `Hits have ${v}% to frostbite (slow) the target.` },
  bloodletter: { name: 'BLOODLETTER', lo: 15, hi: 40, kind: 'weapon', desc: v => `Hits have ${v}% to make the target bleed.` },
  vampiric: { name: 'VAMPIRIC', lo: 3, hi: 8, kind: 'any', desc: v => `Lucky hit (15%): heal ${v}% of your max HP.` },
  corpseburst: { name: 'CORPSEBURST', lo: 15, hi: 40, kind: 'any', desc: v => `Kills explode for ${v}% of the foe's max HP to the others.` },
  bloodlust: { name: 'BLOODLUST', lo: 2, hi: 4, kind: 'any', desc: v => `Kills make you MIGHTY for ${v} rounds.` },
  bulwark: { name: 'BULWARK', lo: 10, hi: 25, kind: 'armor', desc: v => `Start battles with a barrier of ${v}% max HP.` },
  unbroken: { name: 'UNBROKEN', lo: 10, hi: 25, kind: 'armor', desc: v => `Take ${v}% less damage below 50% HP.` },
  brambles: { name: 'BRAMBLES', lo: 10, hi: 30, kind: 'armor', desc: v => `Reflect ${v}% of melee damage taken.` },
  windstrike: { name: 'WINDSTRIKE', lo: 1, hi: 3, kind: 'wondrous', desc: v => `Start battles HASTED for ${v} rounds.` },
  fortune: { name: 'FORTUNE', lo: 15, hi: 40, kind: 'wondrous', desc: v => `+${v}% gold find and magic find.` },
  sage: { name: 'SAGE', lo: 10, hi: 25, kind: 'wondrous', desc: v => `+${v}% spell and healing power.` },
  warlord: { name: 'WARLORD', lo: 1, hi: 3, kind: 'any', desc: v => `+${v} to hit and +${v * 2}% crit chance.` },
};
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
  // passive aspects as stats
  { const sb0 = armorSetBonus; armorSetBonus = function (c) {
      const out = sb0.apply(this, arguments); const a = aspectsOf(c);
      if (a.fortune) out.push(['gf', a.fortune], ['mf', a.fortune]);
      if (a.sage) out.push(['heal', a.sage], ['fire', a.sage], ['lightning', a.sage], ['cold', a.sage], ['necrotic', a.sage]);
      if (a.warlord) out.push(['hit', a.warlord], ['crit', a.warlord * 2]);
      return out;
    }; }
  // battle start: barrier and haste
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.apply(this, arguments);
      for (const u of this.party) if (isChar(u)) { const a = aspectsOf(u.ch);
        if (a.bulwark) addEffect(u, { id: 'barrier', rounds: 99, pool: Math.round(derive(u.ch).hpMax * a.bulwark / 100) });
        if (a.windstrike) addEffect(u, { id: 'haste', rounds: a.windstrike });
      }
    }; }
  // damage: aspect multipliers going out and coming in, then procs
  { const ad0 = Battle.prototype.applyDamage; Battle.prototype.applyDamage = function (src, tgt, amt, type, opt = {}) {
      let a = amt;
      const srcC = src && isChar(src) ? src.ch : null, A = srcC ? aspectsOf(srcC) : {};
      try {
        if (srcC && tgt && tgt.side === 'foe' && !opt.proc) {
          const frac = tgt.maxhp ? tgt.hp / tgt.maxhp : 1;
          if (A.executioner && frac < 0.35) a = Math.round(a * (1 + A.executioner / 100));
          if (A.firststrike && frac >= 1) a = Math.round(a * (1 + A.firststrike / 100));
          if (A.slayer && (tgt.elite || tgt.boss)) a = Math.round(a * (1 + A.slayer / 100));
        }
        if (tgt && isChar(tgt)) { const T = aspectsOf(tgt.ch); if (T.unbroken && hpOf(tgt) < maxHpOf(tgt) * 0.5) a = Math.round(a * (1 - T.unbroken / 100)); }
      } catch (e) { /* fall back to the plain hit */ }
      const wasAlive = tgt && hpOf(tgt) > 0;
      const dealt = ad0.call(this, src, tgt, a, type, opt);
      try {
        if (opt.proc || !dealt) return dealt;
        if (srcC && tgt && tgt.side === 'foe') {
          const others = this.foes.filter(f => f !== tgt && f.hp > 0);
          if (A.stormshard && others.length && R() < 0.2) { const o = pick(others), d = Math.max(1, Math.round(dealt * A.stormshard / 100)); this.applyDamage(src, o, d, 'lightning', { proc: true, magic: true }); }
          if (A.glacial && tgt.hp > 0 && R() * 100 < A.glacial) addEffect(tgt, { id: 'frostbite', rounds: 2 });
          if (A.bloodletter && tgt.hp > 0 && R() * 100 < A.bloodletter) addEffect(tgt, { id: 'bleeding', rounds: 3 });
          if (A.vampiric && R() < 0.15) this.heal(src, Math.max(1, Math.round(maxHpOf(src) * A.vampiric / 100)));
          if (wasAlive && tgt.hp <= 0) {
            if (A.corpseburst) for (const o of others) this.applyDamage(src, o, Math.max(1, Math.round(tgt.maxhp * A.corpseburst / 100)), 'necrotic', { proc: true, magic: true });
            if (A.bloodlust) addEffect(src, { id: 'might', rounds: A.bloodlust });
          }
        }
        if (src && !isChar(src) && tgt && isChar(tgt) && opt.attack) { const T = aspectsOf(tgt.ch); if (T.brambles && src.hp > 0) this.applyDamage(tgt, src, Math.max(1, Math.round(dealt * T.brambles / 100)), 'piercing', { proc: true }); }
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
        const a = o.it.aspect, had = codex[a.id] || 0; codex[a.id] = Math.max(had, a.val); G.bag.splice(G.bag.indexOf(o.it), 1); SFX.craft(); saveGame();
        say([`ASPECT OF ${ASPECTS[a.id].name} saved to your codex.`, had >= a.val ? `You already had a better one (${had}).` : `Value ${a.val}.`], occultistMenu);
      });
      if (k === 1) {
        const ids = Object.keys(codex); if (!ids.length) return say('Your codex is empty. EXTRACT aspects from legendary items first.', occultistMenu);
        return choose(ids.map(id => `${ASPECTS[id].name} ${codex[id]}`), j => {
          if (j < 0) return occultistMenu(); const id = ids[j];
          pickItem(`IMPRINT ${ASPECTS[id].name}`, o => (o.it.rarity || 0) >= 3 && fitsKind(id, o.it.kind), o => {
            const cost = imprintCost(o.it.ilvl); if (!pay(cost)) { SFX.error(); return say(`Imprinting costs ${fmt(cost)} G.`, occultistMenu); }
            o.it.aspect = { id, val: codex[id] }; SFX.craft(); saveGame(); say(`${o.it.name.slice(0, 18)} now carries ASPECT OF ${ASPECTS[id].name}.`, occultistMenu);
          });
        }, 'Which aspect?');
      }
      if (k === 2) return pickItem('TEMPER which item?', o => (o.it.tempers || 0) < TEMPER_MAX, o => {
        const cats = Object.keys(TEMPER_POOLS);
        choose(cats, j => {
          if (j < 0) return occultistMenu(); const c = temperCost(o.it.ilvl); if (!pay(c.gold, c.scrap)) { SFX.error(); return say(`Tempering costs ${fmt(c.gold)} G and ${c.scrap} SCRAP.`, occultistMenu); }
          const stat = pick(TEMPER_POOLS[cats[j]]), v = temperValue(stat, o.it.ilvl); o.it.affixes = (o.it.affixes || []).concat([[stat, v]]); if (o.it.mwBase) o.it.mwBase.push([stat, v]); o.it.tempers = (o.it.tempers || 0) + 1;
          if (typeof derive === 'function') derive(G); SFX.craft(); saveGame(); say(`Tempered: +${v} ${(SUBSTATS[stat] || { name: stat }).name}. (${o.it.tempers}/${TEMPER_MAX})`, occultistMenu);
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
