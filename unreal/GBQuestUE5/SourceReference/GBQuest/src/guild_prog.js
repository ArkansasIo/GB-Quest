'use strict';
// ================================================================ GUILD PROGRESSION: levels, perks, guild bank, guild quests
// MAIN MENU > SOCIAL > GUILD (or a guild hall NPC). A guild is shared by every hero on this device who
// belongs to it (stored per guild name, so alts in the same guild share its level, bank and gold).
//   * GUILD XP: members' play earns guild XP (kills, dungeons, raids, quests, crafting, world bosses...).
//     The guild's other members also chip in 200 XP a day (up to 7 days at a time). 25 levels.
//   * PERKS unlock by level: XP, gold find, magic find, repair discounts and extra bank tabs.
//   * GUILD BANK: up to 3 tabs of 20 items plus a gold vault. Soulbound items (heirlooms) cannot be stored.
//   * GUILD QUESTS: 3 weekly guild objectives (from the bounty templates, triple size) for guild XP and gold.
// Pure rules are exported as GBQGuild for tests; the game wiring runs only inside the game.

const GUILD_MAX_LEVEL = 25;
// total guild XP needed to reach a level (level 1 = 0)
const guildXpFor = lvl => lvl <= 1 ? 0 : Math.round(1000 * Math.pow(lvl - 1, 1.6));
const guildLevelOf = xp => { let l = 1; while (l < GUILD_MAX_LEVEL && xp >= guildXpFor(l + 1)) l++; return l; };
const GUILD_PERKS = [
  { lvl: 2, id: 'fast_track', name: 'FAST TRACK', desc: '+5% XP', stats: [['xp', 5]] },
  { lvl: 3, id: 'cash_flow', name: 'CASH FLOW', desc: '+5% gold find', stats: [['gf', 5]] },
  { lvl: 4, id: 'repair_1', name: 'DISCOUNTED REPAIRS', desc: '10% off repairs', repair: 0.1 },
  { lvl: 5, id: 'bank_2', name: 'SECOND BANK TAB', desc: 'Guild bank tab 2', tabs: 1 },
  { lvl: 7, id: 'fast_track_2', name: 'FAST TRACK II', desc: '+5% more XP', stats: [['xp', 5]] },
  { lvl: 8, id: 'repair_2', name: 'MASS REPAIRS', desc: '25% off repairs', repair: 0.25 },
  { lvl: 10, id: 'bank_3', name: 'THIRD BANK TAB', desc: 'Guild bank tab 3', tabs: 1 },
  { lvl: 12, id: 'cash_flow_2', name: 'CASH FLOW II', desc: '+5% more gold find', stats: [['gf', 5]] },
  { lvl: 15, id: 'treasure', name: 'TREASURE HUNTERS', desc: '+10% magic find', stats: [['mf', 10]] },
  { lvl: 20, id: 'repair_3', name: 'GUILD ARMOURERS', desc: '50% off repairs', repair: 0.5 },
  { lvl: 25, id: 'legends', name: 'LEGENDS OF VALENDRIA', desc: '+10% XP and +5% damage', stats: [['xp', 10], ['dmg', 5]] },
];
const perksAt = lvl => GUILD_PERKS.filter(p => lvl >= p.lvl);
const perkStats = lvl => perksAt(lvl).flatMap(p => p.stats || []);
const repairDiscount = lvl => Math.max(0, ...perksAt(lvl).map(p => p.repair || 0));
const bankTabs = lvl => 1 + perksAt(lvl).reduce((a, p) => a + (p.tabs || 0), 0);
const BANK_TAB_SIZE = 20;
// guild XP from a member's activity
const GUILD_WEIGHTS = { kills: 2, elites: 8, dungeons: 150, raids: 400, trials: 200, quests: 50, worldBosses: 200, crafted: 10, fish: 3, keystones: 250, bounties: 60 };
function guildXpFrom(stats, base) { let xp = 0; for (const [k, w] of Object.entries(GUILD_WEIGHTS)) xp += Math.max(0, (Number(stats && stats[k]) || 0) - (Number(base && base[k]) || 0)) * w; return Math.floor(xp); }
// the guild's other members: 200 XP a day missed, at most 7 days
const memberDays = (lastDay, today) => { if (!lastDay) return 0; const d = Math.round((Date.parse(today) - Date.parse(lastDay)) / 864e5); return Math.max(0, Math.min(7, d)); };
function normalizeGuild(raw, name) {
  const g = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const xp = Math.max(0, Math.floor(Number(g.xp) || 0)), lvl = guildLevelOf(xp), tabs = bankTabs(lvl);
  const bank = Array.from({ length: 3 }, (_, i) => (Array.isArray(g.bank && g.bank[i]) ? g.bank[i] : []).filter(it => it && typeof it === 'object').slice(0, BANK_TAB_SIZE));
  return { v: 1, name: String(name || g.name || 'GUILD').slice(0, 20), xp, level: lvl, tabs, bank, gold: Math.max(0, Math.floor(Number(g.gold) || 0)), lastDay: g.lastDay || null,
    log: (Array.isArray(g.log) ? g.log : []).filter(x => typeof x === 'string').slice(-30), quests: g.quests && typeof g.quests === 'object' ? g.quests : null };
}
function addGuildXp(guild, n, note) {
  const g = normalizeGuild(guild), before = g.level; g.xp += Math.max(0, Math.floor(n) || 0); g.level = guildLevelOf(g.xp); g.tabs = bankTabs(g.level);
  if (note) g.log.push(note);
  const unlocked = GUILD_PERKS.filter(p => p.lvl > before && p.lvl <= g.level);
  for (const p of unlocked) g.log.push(`PERK: ${p.name}`);
  g.log = g.log.slice(-30);
  return { guild: g, leveled: g.level > before, unlocked };
}
// bank: deposit / withdraw (pure on copies)
function depositItem(guild, tab, item) {
  const g = normalizeGuild(guild); if (tab < 0 || tab >= g.tabs) return { ok: false, error: 'That tab is locked.' };
  if (!item || item.bound || item.heirloom) return { ok: false, error: 'Soulbound items cannot be stored.' };
  if (g.bank[tab].length >= BANK_TAB_SIZE) return { ok: false, error: 'That tab is full.' };
  g.bank[tab].push(item); return { ok: true, guild: g };
}
function withdrawItem(guild, tab, index) { const g = normalizeGuild(guild), list = g.bank[tab] || []; if (!list[index]) return { ok: false, error: 'Empty slot.' }; const [item] = list.splice(index, 1); return { ok: true, guild: g, item }; }

if (typeof globalThis !== 'undefined') globalThis.GBQGuild = { GUILD_MAX_LEVEL, guildXpFor, guildLevelOf, GUILD_PERKS, perksAt, perkStats, repairDiscount, bankTabs, BANK_TAB_SIZE, guildXpFrom, memberDays, normalizeGuild, addGuildXp, depositItem, withdrawItem };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof guildMenu === 'function' && typeof store !== 'undefined') {
  const KEYS = Object.keys(GUILD_WEIGHTS), snap = () => Object.fromEntries(KEYS.map(k => [k, Number(G.stats[k]) || 0]));
  const keyFor = name => 'gbq2_guild_' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
  const loadG = () => G && G.guild ? normalizeGuild(store.get(keyFor(G.guild)), G.guild) : null;
  const saveG = g => { cached = { guild: g.name, level: g.level }; return store.set(keyFor(g.name), g); };
  const today = () => (typeof dayKey === 'function' ? dayKey() : new Date().toISOString().slice(0, 10));
  // guild level cached for the hot paths (derive runs every frame); refreshed by guildTick and on save
  let cached = { guild: null, level: 0 };
  const cachedLevel = () => G && G.guild && cached.guild === G.guild ? cached.level : 0;
  window.guildPerkValue = kind => kind === 'repair' ? repairDiscount(cachedLevel()) : 0;
  // perk stats ride on the set-bonus hook that derive() reads (only for the hero)
  { const sb0 = armorSetBonus; armorSetBonus = function (c) { const out = sb0(c), lvl = G && c === G ? cachedLevel() : 0; return lvl > 1 ? out.concat(perkStats(lvl)) : out; }; }

  // contribution: credit the hero's activity since the last check; members' daily share
  function guildTick() {
    if (!G || !G.guild) return;
    let g = loadG(); const gp = G.guildProg = G.guildProg && G.guildProg.guild === G.guild ? G.guildProg : { guild: G.guild, base: snap() };
    const gain = guildXpFrom(G.stats, gp.base), days = memberDays(g.lastDay, today());
    let r = null;
    if (gain > 0) { r = addGuildXp(g, gain); g = r.guild; gp.base = snap(); }
    if (!g.lastDay || days > 0) { const m = addGuildXp(g, days * 200, days ? `MEMBERS EARNED ${days * 200} XP` : null); if (m.leveled) r = m; g = m.guild; g.lastDay = today(); }
    // weekly guild quests from the bounty templates (x3 targets)
    const week = typeof weekKeyOf === 'function' ? weekKeyOf() : today();
    if (typeof rollBounties === 'function' && (!g.quests || g.quests.week !== week)) g.quests = { week, list: rollBounties('guild|' + g.name + week, 'week', G.lvl, G.stats).map(b => ({ ...b, target: b.target * 3, base: Number(G.stats[b.stat]) || 0, claimed: false })) };
    saveG(g);
    if (r && r.leveled) { toast('GUILD LEVEL UP', `<${g.name}> LEVEL ${g.level}`, 'px_crown', 'levelup'); for (const p of r.unlocked) chatLog('guild', 'GUILD', `Perk unlocked: ${p.name} (${p.desc}).`); }
  }
  (window.LOOP_HOOKS ||= []).push(guildTick);

  function infoLines(g) { const next = g.level < GUILD_MAX_LEVEL ? guildXpFor(g.level + 1) : null; return [`<${g.name}> LEVEL ${g.level}`, next ? `GUILD XP ${fmt(g.xp)} / ${fmt(next)}` : `GUILD XP ${fmt(g.xp)} (MAX)`, `BANK ${g.tabs} TAB${g.tabs > 1 ? 'S' : ''}, ${fmt(g.gold)} G`, `PERKS: ${perksAt(g.level).map(p => p.name).join(', ') || 'none yet'}`]; }
  function perksMenu(g) { say(GUILD_PERKS.map(p => `${g.level >= p.lvl ? '# ' : `L${p.lvl} `}${p.name}: ${p.desc}`), guildHub); }
  function bankMenu(tab = 0) {
    const g = loadG(); if (!g) return;
    const items = g.bank[tab] || [], opts = [`< TAB ${tab + 1}/${g.tabs} >`, 'DEPOSIT ITEM', 'GOLD VAULT', ...items.map(it => `${it.name.slice(0, 18)} IL${it.ilvl || 1}`), 'BACK'];
    choose(opts, k => {
      if (k < 0 || opts[k] === 'BACK') return guildHub();
      if (k === 0) return bankMenu((tab + 1) % g.tabs);
      if (k === 1) {
        const pool = G.bag.filter(it => !it.bound && !it.heirloom && !it.fav);
        if (!pool.length) return say('Nothing in your bag can be stored.', () => bankMenu(tab));
        return choose(pool.map(it => it.name.slice(0, 22)), j => { if (j < 0) return bankMenu(tab); const it = pool[j], r = depositItem(loadG(), tab, it); if (!r.ok) return say(r.error, () => bankMenu(tab)); G.bag.splice(G.bag.indexOf(it), 1); saveG(r.guild); saveGame(); SFX.confirm(); bankMenu(tab); }, `DEPOSIT TO TAB ${tab + 1}`);
      }
      if (k === 2) return choose(['DEPOSIT 100 G', 'DEPOSIT 1,000 G', 'WITHDRAW 100 G', 'WITHDRAW 1,000 G', 'BACK'], j => {
        const amt = [100, 1000, 100, 1000][j]; if (amt == null) return bankMenu(tab); const g2 = loadG();
        if (j < 2) { if (G.gold < amt) return say('Not enough gold.', () => bankMenu(tab)); G.gold -= amt; g2.gold += amt; } else { if (g2.gold < amt) return say('The vault does not hold that much.', () => bankMenu(tab)); g2.gold -= amt; G.gold += amt; }
        saveG(g2); saveGame(); SFX.coin(); bankMenu(tab);
      }, `VAULT ${fmt(g.gold)} G  YOU ${fmt(G.gold)} G`);
      const r = withdrawItem(g, tab, k - 3); if (!r.ok) return bankMenu(tab);
      if (G.bag.length >= BAG_MAX) return say('Your bag is full.', () => bankMenu(tab));
      r.item.uid = ITEM_UID++; G.bag.push(r.item); saveG(r.guild); saveGame(); SFX.confirm(); bankMenu(tab);
    }, `GUILD BANK TAB ${tab + 1}: ${items.length}/${BANK_TAB_SIZE}`);
  }
  function questsMenu() {
    guildTick(); const g = loadG(), list = (g.quests && g.quests.list) || [];
    choose(list.map(b => `${b.claimed ? '# ' : bountyDone(b, G.stats) ? '! ' : ''}${(BOUNTY_TYPES.find(t => t.id === b.id) || { name: b.id }).name} ${fmt(bountyProgress(b, G.stats))}/${fmt(b.target)}`.slice(0, 24)).concat(['BACK']), k => {
      const b = list[k]; if (!b) return guildHub();
      if (b.claimed || !bountyDone(b, G.stats)) return say(b.claimed ? 'Already turned in. New guild quests on Monday.' : 'Not finished yet.', questsMenu);
      const g2 = loadG(), q = g2.quests.list.find(x => x.id === b.id); q.claimed = true;
      const r = addGuildXp(g2, 2000, `${G.name} FINISHED A GUILD QUEST`), gold = 200 + G.lvl * 40; saveG(r.guild); G.gold += gold; saveGame(); SFX.levelup();
      say([`Guild quest complete!`, `+2,000 guild XP, +${fmt(gold)} G.`], questsMenu);
    }, 'WEEKLY GUILD QUESTS');
  }
  function guildHub() {
    guildTick(); const g = loadG(); if (!g) return;
    const opts = ['GUILD INFO', 'PERKS', 'GUILD BANK', 'GUILD QUESTS', 'GUILD LOG', 'ROSTER', 'LEAVE GUILD', 'BACK'];
    choose(opts, k => {
      const o = opts[k];
      if (o === 'GUILD INFO') say(infoLines(g), guildHub); else if (o === 'PERKS') perksMenu(g); else if (o === 'GUILD BANK') bankMenu(0);
      else if (o === 'GUILD QUESTS') questsMenu(); else if (o === 'GUILD LOG') say(g.log.slice(-6).reverse().concat(g.log.length ? [] : ['Nothing yet.']), guildHub);
      else if (o === 'ROSTER') say([`<${g.name}>`, `Members: ${G.name}, ${SIM_NAMES.slice(0, 5).join(', ')}`], guildHub);
      else if (o === 'LEAVE GUILD') choose(['LEAVE', 'STAY'], y => { if (y === 0) { G.guild = null; G.guildProg = null; SFX.back(); } }, 'The guild keeps its level and bank.');
    }, `<${g.name}> LV ${g.level}`);
  }
  { const gm0 = guildMenu; guildMenu = function () { if (G && G.guild) return guildHub(); return gm0.apply(this, arguments); }; }
  window.guildHub = guildHub;
}
