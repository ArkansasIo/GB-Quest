'use strict';
(() => { // own scope: the game loads every module as a classic script sharing one global scope
// ================================================================ THRONE-STYLE SYSTEMS II (MAIN MENU > ADVENTURE)
// Five systems that build on tnl_systems.js (mastery, amitoi, day/night, morph):
//   * DUNGEON TOKENS: up to 10, one refills every 2 real hours (start with 5). A dungeon clear made while you
//     hold a token spends it for a BONUS CHEST (a rare+ item), 10+ DUNGEON MARKS and a TRAIT STONE. Without a token
//     a clear still pays 2 marks. Tokens can be switched off to save them. Marks buy from the MARKS SHOP.
//   * CONTRACTS: three factions post six contracts a day (kill, elite, dungeon, quest, craft, fish, world boss,
//     travel). Hold up to three at once; progress counts from the moment you accept. Turn in for CONTRACT COINS,
//     gold and XP. Coins buy from the CONTRACT SHOP.
//   * GEAR TRAITS: any weapon, armour or wondrous item can hold three traits (rank 1-5). Unlock a random trait
//     or rank one up with trait stones, or EXTRACT a trait from a bag item onto an equipped one (the bag item
//     is destroyed). BOSS SLAYER adds damage against bosses; the rest add substats.
//   * CODEX: every monster family is a page (30 kills completes it) and every dungeon is a page (one clear).
//     Each completed page gives a permanent bonus; every 5 pages also add +2% damage and +2% healing.
//   * FIELD EVENTS: every 30 minutes an event opens for 12 minutes in a zone near your level. Win the event's
//     battles in that zone (RIFT SURGE foes are elite more often) for gold, XP, marks, coins and gear.
// Pure rules are exported as GBQTnlx for tests; the game wiring runs only inside the game.

// ---------------------------------------------------------------- shared helpers
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = seed => { let a = hashStr(seed) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------------------------------------------------------------- dungeon tokens
const TOKEN_MAX = 10, TOKEN_START = 5, TOKEN_MS = 2 * 3600 * 1000;
// refill: whole tokens earned since `last`; the remainder carries over
function regenTokens(tok, now) {
  const t = { n: Math.max(0, Math.min(TOKEN_MAX, Math.floor(Number(tok && tok.n) || 0))), last: Number.isFinite(Number(tok && tok.last)) && tok.last !== null ? Number(tok.last) : now };
  if (t.n >= TOKEN_MAX) return { n: TOKEN_MAX, last: now };
  const gained = Math.floor(Math.max(0, now - t.last) / TOKEN_MS);
  if (!gained) return t;
  const n = Math.min(TOKEN_MAX, t.n + gained);
  return { n, last: n >= TOKEN_MAX ? now : t.last + gained * TOKEN_MS };
}
const nextTokenIn = (tok, now) => (tok.n >= TOKEN_MAX ? 0 : Math.max(0, TOKEN_MS - (now - tok.last)));
const clearMarks = (dungeonLvl, withToken) => (withToken ? 10 + Math.floor(Math.max(0, Number(dungeonLvl) || 0) / 10) : 2);
const MARKS_SHOP = [
  { id: 'stones', name: 'TRAIT STONES x3', cost: 15 },
  { id: 'token', name: 'DUNGEON TOKEN', cost: 25 },
  { id: 'cache', name: 'GEAR CACHE (RARE)', cost: 40 },
  { id: 'mythic', name: 'MYTHIC CACHE', cost: 150 },
];

// ---------------------------------------------------------------- contracts
const FACTIONS = {
  guard: { name: 'LANTERN GUARD' },
  artisans: { name: "ARTISANS' GUILD" },
  delvers: { name: "DELVERS' LEAGUE" },
};
const CONTRACTS = [
  { id: 'cull', faction: 'guard', stat: 'kills', n: 12, name: 'CULL THE WILDS', desc: 'Defeat {n} foes.' },
  { id: 'patrol', faction: 'guard', stat: 'steps', n: 400, name: 'ROAD PATROL', desc: 'Travel {n} steps.' },
  { id: 'warlord', faction: 'guard', stat: 'worldBosses', n: 1, name: 'WARLORD BOUNTY', desc: 'Defeat {n} world boss.', minLvl: 5 },
  { id: 'quests', faction: 'guard', stat: 'quests', n: 2, name: 'TOWN REQUESTS', desc: 'Complete {n} quests.' },
  { id: 'craft', faction: 'artisans', stat: 'crafted', n: 5, name: 'WORK ORDER', desc: 'Craft {n} items.' },
  { id: 'fish', faction: 'artisans', stat: 'fish', n: 4, name: 'FRESH CATCH', desc: 'Catch {n} fish.' },
  { id: 'elites', faction: 'delvers', stat: 'elites', n: 2, name: 'ELITE HUNT', desc: 'Defeat {n} elites.' },
  { id: 'delve', faction: 'delvers', stat: 'dungeons', n: 1, name: 'DEEP DELVE', desc: 'Clear {n} dungeon.' },
  { id: 'delve2', faction: 'delvers', stat: 'dungeons', n: 2, name: 'TWIN DELVE', desc: 'Clear {n} dungeons.', minLvl: 10 },
];
const CONTRACT_SLOTS = 3, CONTRACT_OFFERS = 6;
// today's board: six distinct contracts for this hero (seeded by day + hero)
function contractOffers(day, hero, lvl) {
  const pool = CONTRACTS.filter(c => (lvl || 1) >= (c.minLvl || 0)), r = seeded(`${day}|${hero}`), out = [];
  const bag = pool.slice();
  while (out.length < Math.min(CONTRACT_OFFERS, pool.length)) out.push(bag.splice(Math.floor(r() * bag.length), 1)[0].id);
  return out;
}
const contractDef = id => CONTRACTS.find(c => c.id === id) || null;
const contractText = c => c.desc.replace('{n}', c.n);
function contractReward(id, lvl) {
  const c = contractDef(id); if (!c) return null; const L = Math.max(1, Number(lvl) || 1), big = c.stat === 'dungeons' || c.stat === 'worldBosses';
  return { coins: big ? 12 : 6, gold: Math.round((big ? 120 : 50) * (1 + L / 10)), xp: Math.round((big ? 400 : 160) * (1 + L / 8)) };
}
const CONTRACT_SHOP = [
  { id: 'stone', name: 'TRAIT STONE', cost: 8 },
  { id: 'token', name: 'DUNGEON TOKEN', cost: 12 },
  { id: 'gold', name: 'GOLD PURSE', cost: 5 },
  { id: 'cache', name: 'GEAR CACHE (RARE)', cost: 30 },
];

// ---------------------------------------------------------------- gear traits
const TRAIT_MAX = 3, TRAIT_RANK_MAX = 5;
const TRAITS = {
  bossdmg: { name: 'BOSS SLAYER', per: 4, unit: '%', desc: 'damage vs bosses' },
  crit: { name: 'KEEN EDGE', per: 1.5, unit: '%', stat: 'crit' },
  critdmg: { name: 'BRUTALITY', per: 6, unit: '%', stat: 'critdmg' },
  dmg: { name: 'MIGHT', per: 3, unit: '%', stat: 'dmg' },
  heal: { name: 'MERCY', per: 4, unit: '%', stat: 'heal' },
  resist: { name: 'WARDING', per: 2, unit: '%', stat: 'resist' },
  hpPct: { name: 'VIGOR', per: 2, unit: '%', stat: 'hpPct' },
  haste: { name: 'SWIFTNESS', per: 2, unit: '%', stat: 'haste' },
  leech: { name: 'THIRST', per: 0.6, unit: '%', stat: 'leech' },
  dodge: { name: 'EVASION', per: 1.2, unit: '%', stat: 'dodge' },
  block: { name: 'BULWARK', per: 1.5, unit: '%', stat: 'block' },
  mf: { name: 'FORTUNE', per: 5, unit: '%', stat: 'mf' },
};
const TRAIT_IDS = Object.keys(TRAITS);
const TRAIT_KINDS = ['weapon', 'armor', 'wondrous'];
const unlockCost = traits => 1 + (traits || []).length;
const upgradeCost = rank => rank + 1;
const EXTRACT_COST = 2;
const traitValue = (id, rank) => (TRAITS[id] ? Math.round(TRAITS[id].per * Math.max(1, Math.min(TRAIT_RANK_MAX, rank)) * 10) / 10 : 0);
const traitText = t => (TRAITS[t.id] ? `${TRAITS[t.id].name} R${t.r} +${traitValue(t.id, t.r)}%${TRAITS[t.id].desc ? ' ' + TRAITS[t.id].desc : ''}` : '');
// a new random trait the item does not already hold
function rollTrait(traits, rnd) {
  const have = new Set((traits || []).map(t => t.id)), pool = TRAIT_IDS.filter(id => !have.has(id));
  return pool.length ? { id: pool[Math.floor(rnd() * pool.length) % pool.length], r: 1 } : null;
}
// summed trait bonuses over a set of items -> { stat: value, bossdmg }
function traitTotals(items) {
  const s = {};
  for (const it of items || []) for (const t of (it && it.traits) || []) { const d = TRAITS[t.id]; if (!d) continue; const k = d.stat || t.id; s[k] = Math.round(((s[k] || 0) + traitValue(t.id, t.r)) * 10) / 10; }
  return s;
}

// ---------------------------------------------------------------- codex
const CODEX_KILLS = 30;
const CODEX_FAMILY_BONUS = {
  beast: ['crit', 1], humanoid: ['hit', 1], undead: ['radiant', 3], fiend: ['resist', 1], fey: ['dodge', 1], elemental: ['fire', 3],
  construct: ['block', 1.5], dragon: ['critdmg', 5], giant: ['hp', 25], ooze: ['leech', 0.5], aberration: ['haste', 1.5],
  monstrosity: ['dmg', 2], plant: ['heal', 3], celestial: ['necrotic', 3],
};
const CODEX_DUNGEON_BONUS = [['hp', 10], ['mf', 2]];
// pages from a codex record: { fam: { id: kills }, dg: { id: 1 } }
function codexPages(cx) {
  const fams = Object.keys(CODEX_FAMILY_BONUS).filter(f => ((cx && cx.fam && cx.fam[f]) || 0) >= CODEX_KILLS);
  const dgs = Object.keys((cx && cx.dg) || {}).filter(k => cx.dg[k]);
  return { fams, dgs, total: fams.length + dgs.length };
}
function codexBonus(cx) {
  const s = {}, add = (k, v) => { s[k] = Math.round(((s[k] || 0) + v) * 10) / 10; }, p = codexPages(cx);
  for (const f of p.fams) add(...CODEX_FAMILY_BONUS[f]);
  for (let i = 0; i < p.dgs.length; i++) for (const [k, v] of CODEX_DUNGEON_BONUS) add(k, v);
  const tiers = Math.floor(p.total / 5); if (tiers) { add('dmg', 2 * tiers); add('heal', 2 * tiers); }
  return s;
}

// ---------------------------------------------------------------- field events
const EVENT_EVERY = 30 * 60 * 1000, EVENT_OPEN = 12 * 60 * 1000;
const EVENT_TYPES = [
  { id: 'invasion', name: 'INVASION', need: 4, desc: 'Raiders pour into the zone. Win 4 battles here.' },
  { id: 'rift', name: 'RIFT SURGE', need: 3, elite: 0.4, desc: 'A rift spills elites. Win 3 battles here.' },
  { id: 'hunt', name: 'GREAT HUNT', need: 3, desc: 'The beasts are restless. Win 3 battles here.' },
];
// the event slot for a moment in time: slot number, open?, time left, type
function eventSlot(now) {
  const slot = Math.floor(now / EVENT_EVERY), into = now - slot * EVENT_EVERY;
  return { slot, open: into < EVENT_OPEN, left: Math.max(0, EVENT_OPEN - into), type: EVENT_TYPES[hashStr('ev' + slot) % EVENT_TYPES.length] };
}
// the zone for a slot: a non-town zone near the hero's level (zones: [{id, lvl:[a,b], town}])
function eventZone(slot, zones, lvl) {
  const near = zones.filter(z => !z.town && z.lvl[0] <= lvl + 5 && z.lvl[1] >= lvl - 15);
  const pool = near.length ? near : zones.filter(z => !z.town).sort((a, b) => Math.abs(a.lvl[0] - lvl) - Math.abs(b.lvl[0] - lvl)).slice(0, 3);
  return pool.length ? pool[hashStr('zone' + slot) % pool.length].id : null;
}
const eventReward = lvl => { const L = Math.max(1, Number(lvl) || 1); return { gold: Math.round(80 * (1 + L / 8)), xp: Math.round(300 * (1 + L / 6)), marks: 5, coins: 3 }; };

if (typeof globalThis !== 'undefined') globalThis.GBQTnlx = {
  hashStr, seeded, dayKey, TOKEN_MAX, TOKEN_START, TOKEN_MS, regenTokens, nextTokenIn, clearMarks, MARKS_SHOP,
  FACTIONS, CONTRACTS, CONTRACT_SLOTS, CONTRACT_OFFERS, contractOffers, contractDef, contractText, contractReward, CONTRACT_SHOP,
  TRAITS, TRAIT_IDS, TRAIT_MAX, TRAIT_RANK_MAX, TRAIT_KINDS, unlockCost, upgradeCost, EXTRACT_COST, traitValue, traitText, rollTrait, traitTotals,
  CODEX_KILLS, CODEX_FAMILY_BONUS, CODEX_DUNGEON_BONUS, codexPages, codexBonus,
  EVENT_EVERY, EVENT_OPEN, EVENT_TYPES, eventSlot, eventZone, eventReward,
};

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined' && typeof gearAffixes === 'function' && typeof DUNGEONS !== 'undefined') {
  const X = () => {
    const s = G.tnlx = G.tnlx && typeof G.tnlx === 'object' ? G.tnlx : {};
    if (!s.tok) s.tok = { n: TOKEN_START, last: Date.now() };
    if (s.useTokens === undefined) s.useTokens = true;
    s.marks = s.marks || 0; s.coins = s.coins || 0; s.stones = s.stones || 0;
    if (!s.ct) s.ct = { day: null, offers: [], taken: [], active: [] };
    if (!s.cx) s.cx = { fam: {}, dg: {} };
    if (!s.ev) s.ev = { slot: -1, wins: 0, done: false, zone: null };
    if (s.lastDungeons === undefined) s.lastDungeons = (G.stats && G.stats.dungeons) || 0;
    return s;
  };
  const fmt = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}H${String(m % 60).padStart(2, '0')}` : `${m}M`; };
  const gearCache = rarity => addGear(makeItem({ lvl: G.lvl, rarity, boss: true }));
  const pay = (gold, xp) => { if (gold) G.gold += gold; if (xp && typeof gainXP === 'function') gainXP(G, xp); };
  const equipped = c => SLOTS.map(s => c.eq && c.eq[s]).filter(Boolean);
  const famName = f => (typeof FAMILIES !== 'undefined' && FAMILIES[f] ? FAMILIES[f].name : String(f).toUpperCase());

  // ------------------------------------------------ stats: traits + codex
  { const ga0 = gearAffixes; gearAffixes = function (c) {
      const s = ga0.apply(this, arguments); if (!c) return s;
      for (const [k, v] of Object.entries(traitTotals(equipped(c)))) if (k !== 'bossdmg') s[k] = (s[k] || 0) + v;
      if (c === G && G.tnlx && G.tnlx.cx) for (const [k, v] of Object.entries(codexBonus(G.tnlx.cx))) s[k] = (s[k] || 0) + v;
      return s;
    }; }
  // BOSS SLAYER
  { const ad0 = Battle.prototype.applyDamage; Battle.prototype.applyDamage = function (src, tgt, amt) {
      const args = Array.prototype.slice.call(arguments);
      if (src && src.ch && tgt && tgt.boss && typeof amt === 'number') { const b = traitTotals(equipped(src.ch)).bossdmg || 0; if (b) args[2] = Math.round(amt * (1 + b / 100)); }
      return ad0.apply(this, args);
    }; }
  // item text
  if (typeof itemDesc === 'function') { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it); return it && it.traits && it.traits.length ? `TRAITS: ${it.traits.map(traitText).join('; ')}. ${s}` : s; }; }

  // ------------------------------------------------ battle results: codex kills, field events
  { const f0 = Battle.prototype.finish; Battle.prototype.finish = function (result) {
      try {
        if (result === 'win' && G) {
          const s = X();
          for (const f of this.foes || []) if (f && f.fam && CODEX_FAMILY_BONUS[f.fam]) {
            const before = s.cx.fam[f.fam] || 0; s.cx.fam[f.fam] = before + 1;
            if (before + 1 === CODEX_KILLS) toast('CODEX PAGE', famName(f.fam), 'item_spellbook', 'achievement');
          }
          const ev = eventSlot(Date.now());
          if (ev.open && !G.inst && s.ev.slot === ev.slot && !s.ev.done && G.map === s.ev.zone) {
            s.ev.wins++;
            if (s.ev.wins >= ev.type.need) { s.ev.done = true; const r = eventReward(G.lvl); pay(r.gold, r.xp); s.marks += r.marks; s.coins += r.coins; gearCache(ev.type.id === 'rift' ? 4 : 3);
              toast('EVENT COMPLETE', ev.type.name, 'px_crown', 'act_complete'); if (typeof chatLog === 'function') chatLog('system', 'EVENT', `${ev.type.name} complete: +${r.gold}G, +${r.marks} marks, +${r.coins} coins, gear.`); }
          }
        }
      } catch (e) { /* never block the battle ending */ }
      return f0.apply(this, arguments);
    }; }
  // rift surge: more elites in the event zone
  if (typeof rollEncounter === 'function') { const re0 = rollEncounter; rollEncounter = function (zoneDef) {
      const foes = re0.apply(this, arguments);
      try { const ev = eventSlot(Date.now()), s = G && G.tnlx; if (s && ev.open && ev.type.elite && s.ev.slot === ev.slot && zoneDef && zoneDef.id === s.ev.zone && !G.inst)
        for (const f of foes) if (!f.elite && !f.boss && R() < ev.type.elite) { f.elite = true; f.maxhp = Math.round(f.maxhp * 1.5); f.hp = f.maxhp; f.name = ('ELITE ' + f.name).slice(0, 16); } } catch (e) { /* keep the encounter */ }
      return foes;
    }; }

  // ------------------------------------------------ poll: tokens, dungeon clears, contracts, events
  let lastInst = null;
  function poll() {
    if (!G || !G.stats) return; const s = X(), now = Date.now();
    s.tok = regenTokens(s.tok, now);
    if (G.inst && G.inst.kind === 'dungeon') lastInst = G.inst.def;
    const d = G.stats.dungeons || 0;
    if (d > s.lastDungeons) {
      for (let i = s.lastDungeons; i < d; i++) {
        const def = lastInst || { id: 'unknown', name: 'DUNGEON', lvl: G.lvl }, use = s.useTokens && s.tok.n > 0;
        if (use) { if (s.tok.n === TOKEN_MAX) s.tok.last = now; s.tok.n--; gearCache(4); s.stones++; }
        const m = clearMarks(def.lvl, use); s.marks += m;
        if (def.id !== 'unknown' && !s.cx.dg[def.id]) { s.cx.dg[def.id] = 1; toast('CODEX PAGE', def.name.slice(0, 20), 'item_spellbook', 'achievement'); }
        if (typeof chatLog === 'function') chatLog('system', 'DUNGEON', use ? `Token spent: bonus chest, trait stone, +${m} marks.` : `+${m} marks (no token used).`);
        if (use) toast('DUNGEON TOKEN', `BONUS CHEST +${m} MARKS`, 'item_chest', 'achievement');
      }
      s.lastDungeons = d;
    }
    for (const a of s.ct.active) { const c = contractDef(a.id); if (c && !a.ready && (G.stats[c.stat] || 0) - a.base >= c.n) { a.ready = true; toast('CONTRACT READY', c.name, 'item_key', 'quest_done'); } }
    const ev = eventSlot(now);
    if (ev.open && s.ev.slot !== ev.slot) {
      s.ev = { slot: ev.slot, wins: 0, done: false, zone: eventZone(ev.slot, ZONES, G.lvl) };
      const z = ZONE_BY_ID[s.ev.zone]; if (z) { toast(`EVENT: ${ev.type.name}`, z.name.slice(0, 22), 'px_skull', 'boss_appear'); if (typeof chatLog === 'function') chatLog('system', 'EVENT', `${ev.type.name} at ${z.name} for ${fmt(ev.left)}. ${ev.type.desc}`); }
    }
  }
  { let n = 0; const t0 = tick; window.tick = tick = function () { const r = t0.apply(this, arguments); if (G && ++n % 30 === 0) { try { poll(); } catch (e) { /* keep the game loop alive */ } } return r; }; }
  // event progress on the field
  if (typeof Field !== 'undefined') { const d0 = Field.prototype.draw; Field.prototype.draw = function () {
      d0.apply(this, arguments);
      const s = G && G.tnlx; if (!s || G.inst) return; const ev = eventSlot(Date.now());
      if (!ev.open || s.ev.slot !== ev.slot || G.map !== s.ev.zone) return;
      fill(1, 22, 74, 9, 0); text(s.ev.done ? `${ev.type.name.slice(0, 9)} DONE` : `${ev.type.name.slice(0, 9)} ${s.ev.wins}/${ev.type.need} ${fmt(ev.left)}`, 3, 23, s.ev.done ? 'green' : 'gold');
    }; }

  // ------------------------------------------------ menus
  function buy(id) {
    const s = X();
    if (id === 'stones') s.stones += 3; else if (id === 'stone') s.stones += 1;
    else if (id === 'token') { if (s.tok.n >= TOKEN_MAX) return false; s.tok.n++; }
    else if (id === 'cache') gearCache(4); else if (id === 'mythic') gearCache(5);
    else if (id === 'gold') G.gold += Math.round(60 * (1 + G.lvl / 10));
    return true;
  }
  function shopMenu(label, list, have, spend, back) {
    choose([...list.map(x => `${x.name} ${x.cost}`), 'BACK'], i => {
      const x = list[i], again = () => shopMenu(label, list, have, spend, back); if (!x) return back();
      if (have() < x.cost) { SFX.error(); return say(`Needs ${x.cost} ${label.toLowerCase()}.`, again); }
      if (!buy(x.id)) { SFX.error(); return say('You cannot hold more of that.', again); }
      spend(x.cost); saveGame(); SFX.confirm(); again();
    }, `${label} SHOP: ${have()}`);
  }
  function tokenMenu() {
    const s = X(); s.tok = regenTokens(s.tok, Date.now());
    choose([`USE TOKENS: ${s.useTokens ? 'ON' : 'OFF'}`, `MARKS SHOP (${s.marks})`, 'HOW IT WORKS', 'BACK'], i => {
      if (i === 0) { s.useTokens = !s.useTokens; saveGame(); return tokenMenu(); }
      if (i === 1) return shopMenu('MARKS', MARKS_SHOP, () => s.marks, v => { s.marks -= v; }, tokenMenu);
      if (i === 2) return say([`You hold up to ${TOKEN_MAX} dungeon tokens. One refills every 2 hours.`, 'Clearing a dungeon spends one for a bonus chest, a trait stone and 10+ marks.', 'With tokens OFF (or none left) a clear pays 2 marks.'], tokenMenu);
      adventureMenu();
    }, `TOKENS ${s.tok.n}/${TOKEN_MAX}${s.tok.n < TOKEN_MAX ? ' NEXT ' + fmt(nextTokenIn(s.tok, Date.now())) : ''}  MARKS ${s.marks}`);
  }
  function contractsMenu() {
    const s = X(), day = dayKey(Date.now());
    if (s.ct.day !== day) { s.ct.day = day; s.ct.offers = contractOffers(day, G.name, G.lvl); s.ct.taken = []; }
    const rows = s.ct.active.filter(a => contractDef(a.id)).map(a => { const c = contractDef(a.id), p = Math.max(0, Math.min(c.n, (G.stats[c.stat] || 0) - a.base)); return { a, c, label: `${a.ready ? '* ' : ''}${c.name.slice(0, 14)} ${p}/${c.n}` }; });
    const open = s.ct.offers.filter(id => !s.ct.taken.includes(id));
    choose([...rows.map(r => r.label), `BOARD (${open.length})`, `COIN SHOP (${s.coins})`, 'BACK'], i => {
      if (i >= 0 && i < rows.length) {
        const { a, c } = rows[i];
        if (!a.ready) return choose(['KEEP', 'ABANDON'], k => { if (k === 1) { s.ct.active = s.ct.active.filter(x => x !== a); saveGame(); } contractsMenu(); }, `${FACTIONS[c.faction].name}: ${contractText(c)}`);
        const r = contractReward(c.id, G.lvl); s.coins += r.coins; pay(r.gold, r.xp); s.ct.active = s.ct.active.filter(x => x !== a); saveGame(); SFX.confirm();
        return say(`${c.name} done: +${r.coins} coins, +${r.gold}G, +${r.xp} XP.`, contractsMenu);
      }
      if (i === rows.length) {
        if (!open.length) return say('The board is empty until tomorrow.', contractsMenu);
        return choose([...open.map(id => contractDef(id).name), 'BACK'], k => {
          const id = open[k]; if (!id) return contractsMenu();
          if (s.ct.active.length >= CONTRACT_SLOTS) { SFX.error(); return say(`You can hold ${CONTRACT_SLOTS} contracts at once.`, contractsMenu); }
          const c = contractDef(id), r = contractReward(id, G.lvl);
          choose(['ACCEPT', 'BACK'], j => { if (j === 0) { s.ct.taken.push(id); s.ct.active.push({ id, base: G.stats[c.stat] || 0, ready: false }); saveGame(); SFX.confirm(); } contractsMenu(); },
            `${FACTIONS[c.faction].name}: ${contractText(c)} Pays ${r.coins} coins, ${r.gold}G.`);
        }, `CONTRACT BOARD ${day}`);
      }
      if (i === rows.length + 1) return shopMenu('COINS', CONTRACT_SHOP, () => s.coins, v => { s.coins -= v; }, contractsMenu);
      adventureMenu();
    }, `CONTRACTS ${s.ct.active.length}/${CONTRACT_SLOTS}  COINS ${s.coins}`);
  }
  function traitItemMenu(slot) {
    const s = X(), it = G.eq[slot]; if (!it) return traitsMenu();
    it.traits = Array.isArray(it.traits) ? it.traits.filter(t => t && TRAITS[t.id]) : [];
    const opts = it.traits.map(t => `${TRAITS[t.id].name.slice(0, 11)} R${t.r}${t.r < TRAIT_RANK_MAX ? ' +' + upgradeCost(t.r) : ''}`);
    if (it.traits.length < TRAIT_MAX) opts.push(`UNLOCK TRAIT ${unlockCost(it.traits)}`, `EXTRACT ONTO ${EXTRACT_COST}`);
    opts.push('BACK');
    choose(opts, i => {
      const back = () => traitItemMenu(slot), o = opts[i] || 'BACK';
      if (i >= 0 && i < it.traits.length) {
        const t = it.traits[i]; if (t.r >= TRAIT_RANK_MAX) return say('That trait is at maximum rank.', back);
        if (s.stones < upgradeCost(t.r)) { SFX.error(); return say(`Needs ${upgradeCost(t.r)} trait stones.`, back); }
        s.stones -= upgradeCost(t.r); t.r++; saveGame(); SFX.confirm(); return say(`${traitText(t)}.`, back);
      }
      if (o.startsWith('UNLOCK')) {
        if (s.stones < unlockCost(it.traits)) { SFX.error(); return say(`Needs ${unlockCost(it.traits)} trait stones.`, back); }
        const t = rollTrait(it.traits, R); if (!t) return say('No traits left to learn.', back);
        s.stones -= unlockCost(it.traits); it.traits.push(t); saveGame(); SFX.chest(); return say(`New trait: ${traitText(t)}.`, back);
      }
      if (o.startsWith('EXTRACT')) {
        const src = (G.bag || []).filter(b => b && b.traits && b.traits.length && b !== it);
        if (!src.length) return say('No bag item has a trait to extract.', back);
        return choose([...src.map(b => b.name.slice(0, 20)), 'BACK'], k => {
          const b = src[k]; if (!b) return back();
          const free = b.traits.filter(t => TRAITS[t.id] && !it.traits.some(x => x.id === t.id)); if (!free.length) return say('This item already has those traits.', back);
          choose([...free.map(t => `${TRAITS[t.id].name.slice(0, 12)} R${t.r}`), 'BACK'], j => {
            const t = free[j]; if (!t) return back();
            if (s.stones < EXTRACT_COST) { SFX.error(); return say(`Needs ${EXTRACT_COST} trait stones.`, back); }
            s.stones -= EXTRACT_COST; it.traits.push({ id: t.id, r: t.r }); G.bag.splice(G.bag.indexOf(b), 1); saveGame(); SFX.chest();
            say([`${traitText(t)} moves onto ${it.name}.`, `${b.name} crumbles to dust.`], back);
          }, `Extract from ${b.name.slice(0, 18)} (destroys it)`);
        }, 'Extract a trait from which bag item?');
      }
      traitsMenu();
    }, `${it.name.slice(0, 22)}  STONES ${s.stones}`);
  }
  function traitsMenu() {
    const s = X(), slots = SLOTS.filter(k => G.eq[k] && TRAIT_KINDS.includes(G.eq[k].kind));
    if (!slots.length) return say('Equip some gear first.', adventureMenu);
    choose([...slots.map(k => `${k.toUpperCase().slice(0, 7)} ${((G.eq[k].traits || []).length)}/${TRAIT_MAX}`), 'BACK'], i => { const k = slots[i]; if (!k) return adventureMenu(); traitItemMenu(k); }, `GEAR TRAITS  STONES ${s.stones}`);
  }
  function codexMenu() {
    const s = X(), p = codexPages(s.cx), fams = Object.keys(CODEX_FAMILY_BONUS);
    const lines = fams.map(f => { const n = Math.min(CODEX_KILLS, s.cx.fam[f] || 0), [k, v] = CODEX_FAMILY_BONUS[f]; return `${n >= CODEX_KILLS ? '*' : ' '}${famName(f).slice(0, 11)} ${n}/${CODEX_KILLS} +${v} ${k.toUpperCase()}`; });
    const dl = DUNGEONS.map(dg => `${s.cx.dg[dg.id] ? '*' : ' '}${dg.name}`);
    const btxt = Object.entries(codexBonus(s.cx)).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') || 'none yet';
    choose(['MONSTER PAGES', 'DUNGEON PAGES', 'TOTAL BONUS', 'BACK'], i => {
      if (i === 0) return say(lines, codexMenu);
      if (i === 1) return say([...dl, 'Each dungeon page: +10 HP, +2% magic find.'], codexMenu);
      if (i === 2) return say([`${p.total} pages. Every 5 pages: +2% damage and healing.`, btxt], codexMenu);
      adventureMenu();
    }, `CODEX ${p.total}/${fams.length + DUNGEONS.length} PAGES`);
  }
  function eventsMenu() {
    const s = X(), now = Date.now(), ev = eventSlot(now), z = ev.open && s.ev.slot === ev.slot ? ZONE_BY_ID[s.ev.zone] : null;
    say(z ? [`${ev.type.name} at ${z.name} (LV ${z.lvl[0]}-${z.lvl[1]}).`, ev.type.desc, s.ev.done ? 'You completed this event.' : `Progress ${s.ev.wins}/${ev.type.need}. ${fmt(ev.left)} left.`]
      : [`No event is open. The next opens in ${fmt(EVENT_EVERY - (now % EVENT_EVERY))}.`, 'Events open every 30 minutes for 12 minutes in a zone near your level.'], adventureMenu);
  }
  const hasNews = () => { const s = G && G.tnlx; if (!s || !s.ct || !s.ev) return false; const ev = eventSlot(Date.now()); return s.ct.active.some(a => a.ready) || (ev.open && s.ev.slot === ev.slot && !s.ev.done); };
  function adventureMenu() {
    const s = X(); s.tok = regenTokens(s.tok, Date.now());
    const ev = eventSlot(Date.now()), evOn = ev.open && s.ev.slot === ev.slot && !s.ev.done, go = [tokenMenu, contractsMenu, traitsMenu, codexMenu, eventsMenu];
    choose([`DUNGEON TOKENS ${s.tok.n}/${TOKEN_MAX}`, `CONTRACTS${s.ct.active.some(a => a.ready) ? ' (!)' : ''}`, `GEAR TRAITS (${s.stones})`, 'CODEX', `FIELD EVENTS${evOn ? ' (!)' : ''}`, 'BACK'], i => { if (go[i]) go[i](); },
      `MARKS ${s.marks}  COINS ${s.coins}  STONES ${s.stones}`);
  }
  window.adventureMenu = adventureMenu;
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { ADVENTURE: 'Dungeon tokens, contracts, gear traits, codex and field events.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('CHALLENGES') + 1; L.splice(at > 0 ? at : L.length, 0, hasNews() ? 'ADVENTURE (!)' : 'ADVENTURE'); return L; };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && (this.items()[this.i] || '').replace(' (!)', '') === 'ADVENTURE') { SFX.select(); return adventureMenu(); } return u0.apply(this, arguments); };
  }
}
})();
