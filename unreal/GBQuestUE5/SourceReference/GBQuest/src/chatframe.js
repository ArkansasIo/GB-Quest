'use strict';
// ================================================================ CHAT FRAME: WoW-style tabs, channel switches, in-game chat settings
// Builds on chatwow.js (channels, commands) and chatbox.js (edit box, toolbar, drag/resize).
//   SWITCHES  turn whole channels off: 1 GENERAL (world chat), 2 TRADE, 3 LOCAL DEFENSE, 4 LOOKING FOR GROUP,
//             joined channels, and the simulated adventurer chatter. Muted channels are neither shown nor sendable.
//             A master switch turns the whole chat off (panel, on-screen lines and bubbles).
//   TABS      WoW-style chat tabs, each showing a chosen set of channels: GENERAL, COMBAT LOG, LOOT, WHISPERS,
//             WORLD and GUILD by default. Right-click a tab (or use the + tab / chat options) to pick its
//             channels, rename it, add new tabs (up to 8) or delete them.
//   FRAME     docked bottom-left like WoW, translucent, with tabs on top.
//   IN GAME   SETTINGS > CHAT SETTINGS: every switch in the game's own menu.
//   COMMANDS  /chatoff [general|trade|defense|lfg|custom|npc|all], /chaton ..., /leave 1-4, /join general|trade|defense|lfg
// Settings are per browser (localStorage 'gbq.chatframe'). Pure rules are exported as GBQChat for tests.

const CHAT_CHANNELS = [
  ['say', 'SAY'], ['yell', 'YELL'], ['emote', 'EMOTE'], ['party', 'PARTY'], ['raid', 'RAID'], ['instance', 'INSTANCE'], ['guild', 'GUILD'], ['officer', 'OFFICER'],
  ['whisper', 'WHISPER'], ['world', '1. GENERAL'], ['trade', '2. TRADE'], ['defense', '3. LOCAL DEFENSE'], ['lfg', '4. LOOKING FOR GROUP'], ['custom', 'JOINED CHANNELS'],
  ['npc', 'NPC SPEECH'], ['system', 'SYSTEM'], ['loot', 'LOOT'], ['money', 'MONEY'], ['xp', 'EXPERIENCE'], ['achievement', 'ACHIEVEMENTS'], ['quest', 'QUESTS'], ['roll', 'ROLLS'], ['combat', 'COMBAT'],
];
const CHAT_CHANNEL_IDS = CHAT_CHANNELS.map(([id]) => id);
// channels that can be switched off, as WoW lets you leave public channels
const MUTABLE = { world: 'GENERAL (WORLD)', trade: 'TRADE', defense: 'LOCAL DEFENSE', lfg: 'LOOKING FOR GROUP', custom: 'JOINED CHANNELS' };
const CHAN_ALIASES = { '1': 'world', general: 'world', world: 'world', '2': 'trade', trade: 'trade', '3': 'defense', defense: 'defense', localdefense: 'defense', '4': 'lfg', lfg: 'lfg', custom: 'custom', channels: 'custom', npc: 'npc', chatter: 'npc', all: 'all' };
const LOOT_CH = ['loot', 'money', 'xp', 'achievement', 'quest', 'roll'];
const DEFAULT_TABS = [
  { id: 'general', name: 'GENERAL', ch: CHAT_CHANNEL_IDS.filter(c => c !== 'combat') },
  { id: 'combat', name: 'COMBAT LOG', ch: ['combat'] },
  { id: 'loot', name: 'LOOT', ch: LOOT_CH },
  { id: 'whisper', name: 'WHISPERS', ch: ['whisper'] },
  { id: 'world', name: 'WORLD', ch: ['world', 'trade', 'defense', 'lfg', 'custom'] },
  { id: 'guild', name: 'GUILD', ch: ['guild', 'officer', 'party', 'raid', 'instance'] },
];
const MAX_TABS = 8;
const clone = v => JSON.parse(JSON.stringify(v));
const cleanName = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 12);

function normalizeChatConfig(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const muted = {}; for (const k of Object.keys(MUTABLE)) muted[k] = !!(r.muted && r.muted[k] === true);
  let tabs = Array.isArray(r.tabs) ? r.tabs.filter(t => t && typeof t.id === 'string' && /^[a-z0-9_]{1,20}$/.test(t.id)).map(t => ({ id: t.id, name: cleanName(t.name) || 'TAB', ch: (Array.isArray(t.ch) ? t.ch : []).filter(c => CHAT_CHANNEL_IDS.includes(c)) })) : [];
  tabs = tabs.filter((t, i) => tabs.findIndex(x => x.id === t.id) === i).slice(0, MAX_TABS);
  if (!tabs.length) tabs = clone(DEFAULT_TABS);
  if (!tabs.some(t => t.id === 'general')) tabs.unshift(clone(DEFAULT_TABS[0]));
  const active = tabs.some(t => t.id === r.active) ? r.active : 'general';
  return { v: 1, master: r.master !== false, npc: r.npc !== false, muted, tabs, active };
}
// should a message be kept? (muted channels and, optionally, simulated chatter are dropped)
const chatAllowed = (cfg, m) => !(m && ((MUTABLE[m.channel] && cfg.muted[m.channel]) || (m.sim && !cfg.npc)));
const tabShows = (tab, m) => !!(tab && m && tab.ch.includes(m.channel));
function addTab(cfg, name, ch) {
  const c = normalizeChatConfig(cfg); if (c.tabs.length >= MAX_TABS) return { ok: false, error: `Up to ${MAX_TABS} tabs.` };
  let n = 1; while (c.tabs.some(t => t.id === 'tab' + n)) n++;
  const tab = { id: 'tab' + n, name: cleanName(name) || 'TAB ' + n, ch: (ch || ['say', 'party', 'guild', 'whisper']).filter(x => CHAT_CHANNEL_IDS.includes(x)) };
  c.tabs.push(tab); c.active = tab.id; return { ok: true, cfg: c, tab };
}
function removeTab(cfg, id) {
  const c = normalizeChatConfig(cfg); if (id === 'general') return { ok: false, error: 'The GENERAL tab cannot be removed.' };
  const before = c.tabs.length; c.tabs = c.tabs.filter(t => t.id !== id); if (c.tabs.length === before) return { ok: false, error: 'No such tab.' };
  if (c.active === id) c.active = 'general'; return { ok: true, cfg: c };
}
function renameTab(cfg, id, name) { const c = normalizeChatConfig(cfg), t = c.tabs.find(x => x.id === id), n = cleanName(name); if (!t || !n) return { ok: false, error: 'Name: letters and digits, 12 at most.' }; t.name = n; return { ok: true, cfg: c }; }
function toggleTabChannel(cfg, id, ch) { const c = normalizeChatConfig(cfg), t = c.tabs.find(x => x.id === id); if (!t || !CHAT_CHANNEL_IDS.includes(ch)) return { ok: false }; t.ch = t.ch.includes(ch) ? t.ch.filter(x => x !== ch) : [...t.ch, ch]; return { ok: true, cfg: c }; }
// switch one channel group (or all / npc) on or off
function setChannel(cfg, key, on) {
  const c = normalizeChatConfig(cfg), k = CHAN_ALIASES[String(key || '').toLowerCase()] || null;
  if (!k) return { ok: false, error: 'Use general, trade, defense, lfg, custom, npc or all.' };
  if (k === 'npc') c.npc = !!on; else if (k === 'all') { for (const m of Object.keys(MUTABLE)) c.muted[m] = !on; c.npc = !!on; } else c.muted[k] = !on;
  return { ok: true, cfg: c, key: k };
}
// a typed message's public channel, if it targets one ('/1 hi' -> world)
function sendTarget(raw) { const m = String(raw || '').trim().match(/^\/(1|2|3|4|general|trade|defense|localdefense|lfg|[5-9])(\s|$)/i); if (!m) return null; return /^[5-9]$/.test(m[1]) ? 'custom' : CHAN_ALIASES[m[1].toLowerCase()]; }

if (typeof globalThis !== 'undefined') globalThis.GBQChat = { CHAT_CHANNELS, MUTABLE, DEFAULT_TABS, MAX_TABS, normalizeChatConfig, chatAllowed, tabShows, addTab, removeTab, renameTab, toggleTabChannel, setChannel, sendTarget };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof chatLog === 'function' && typeof CHAT_TABS !== 'undefined') {
  let CFG = normalizeChatConfig((() => { try { return JSON.parse(localStorage.getItem('gbq.chatframe') || 'null'); } catch (e) { return null; } })());
  const sys = t => chatLog('system', 'CHAT', t);
  function commit(next, quiet) {
    CFG = normalizeChatConfig(next); try { localStorage.setItem('gbq.chatframe', JSON.stringify(CFG)); } catch (e) { /* keep in memory */ }
    applyFrame(); if (!quiet) renderChatLog();
  }
  window.chatConfig = () => clone(CFG);

  // tabs become the chat filters (CHAT_TABS is what renderChatLog and the unread counter read)
  function syncFilters() {
    for (const k of Object.keys(CHAT_TABS)) if (k !== 'all') delete CHAT_TABS[k];
    for (const t of CFG.tabs) CHAT_TABS[t.id] = m => tabShows(t, m);
    CHAT_TABS.all = CHAT_TABS.general;
    if (!CHAT_TABS[CHAT_UI.filter] || CHAT_UI.filter === 'all') CHAT_UI.filter = CFG.active;
  }
  // drop muted channels before anything stores them
  { const cl0 = chatLog; chatLog = function (channel, who, msg, sim) { const ch = String(channel || 'system').toLowerCase(); if (!chatAllowed(CFG, { channel: ch, sim: !!sim })) return; return cl0(channel, who, msg, sim); }; }
  // master switch hides the on-screen lines and bubbles too
  if (typeof drawFieldChat === 'function') { const df0 = drawFieldChat; drawFieldChat = function (f) { if (CFG.master) return df0(f); }; }
  // remember the active tab
  { const sf0 = setChatFilter; setChatFilter = function (f) { sf0(f); if (CFG.tabs.some(t => t.id === CHAT_UI.filter) && CFG.active !== CHAT_UI.filter) { CFG.active = CHAT_UI.filter; commit(CFG, true); } paintTabs(); }; }

  // ---------------------------------------------------------------- commands
  {
    const send0 = NET.sendChat.bind(NET);
    NET.sendChat = function (raw0) {
      const raw = String(raw0 || '').trim(), m = raw.match(/^\/(\S+)(?:\s+([\s\S]*))?$/), cmd = m && m[1].toLowerCase(), rest = m ? (m[2] || '').trim().toLowerCase() : '';
      if (cmd === 'chatoff' || cmd === 'chaton') {
        const on = cmd === 'chaton', r = setChannel(CFG, rest || 'general', on); if (!r.ok) return sys(r.error);
        commit(r.cfg); return sys(r.key === 'all' ? `All public channels and chatter ${on ? 'on' : 'off'}.` : r.key === 'npc' ? `Adventurer chatter ${on ? 'on' : 'off'}.` : `${MUTABLE[r.key]} chat ${on ? 'on' : 'off'}.`);
      }
      if (cmd === 'leave' && /^[1-4]$/.test(rest)) { const r = setChannel(CFG, rest, false); commit(r.cfg); return sys(`Left channel ${rest}: ${MUTABLE[r.key]}. /join ${['', 'general', 'trade', 'defense', 'lfg'][+rest]} to come back.`); }
      if (cmd === 'join' && ['general', 'world', 'trade', 'defense', 'localdefense', 'lfg'].includes(rest)) { const r = setChannel(CFG, rest, true); commit(r.cfg); return sys(`Joined ${MUTABLE[r.key]}.`); }
      const target = sendTarget(raw);
      if (target && CFG.muted[target]) return sys(`${MUTABLE[target]} chat is off. Turn it on: /chaton ${target === 'world' ? 'general' : target}, or SETTINGS > CHAT SETTINGS.`);
      if (!CFG.master && raw) return sys('Chat is turned off. SETTINGS > CHAT SETTINGS turns it back on.');
      return send0(raw0);
    };
  }

  // ---------------------------------------------------------------- frame: WoW-style tabs and dock
  const CSS = `
body.chat-disabled .game-viewport > .chat, body.chat-disabled .chat, body.chat-disabled #chatShow { display: none !important; }
/* WoW: bottom-left, just above the action bar / HUD strip */
.game-viewport > .chat.cbx.wowchat:not(.cb-moved) { left: 12px !important; right: auto !important; bottom: calc(15% + 12px) !important; top: auto !important; width: min(420px, 48%) !important; }
body #chatShow, body .game-viewport > #chatShow { left: 12px; right: auto; width: auto; } /* a compact button, not a bar across the screen */
.chat.cbx.wowchat { background: rgba(8,6,5,.62) !important; border-color: rgba(118,90,54,.55) !important; backdrop-filter: blur(1px); }
.chat.wowchat .chat-tabs { gap: 2px !important; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid rgba(212,172,96,.45); padding: 0 2px; min-height: 20px !important; }
.chat.wowchat .chat-tabs::-webkit-scrollbar { display: none; }
.chat.wowchat .chat-tabs button { flex: 0 0 auto !important; min-width: 0 !important; padding: 3px 6px 2px !important; border-radius: 6px 6px 0 0 !important; border-bottom: 0 !important;
  background: linear-gradient(rgba(52,38,28,.85), rgba(20,14,10,.85)) !important; font: 700 9px Arial, sans-serif !important; color: #c9b38a !important; white-space: nowrap; }
.chat.wowchat .chat-tabs button[aria-pressed="true"] { background: linear-gradient(rgba(120,82,40,.95), rgba(46,30,16,.95)) !important; color: #ffe6a8 !important; }
.chat.wowchat .chat-tabs button.cf-add { padding: 3px 7px 2px !important; color: #8b8378 !important; }
.chat.wowchat .chatlog { background: transparent !important; border-color: transparent !important; }
.cf-off { opacity: .5; }`;
  function paintTabs() {
    const row = document.querySelector('.chat .chat-tabs'); if (!row) return;
    row.dataset.mmo = '1'; row.replaceChildren();
    for (const t of CFG.tabs) {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.chatFilter = t.id; b.textContent = t.name; b.title = 'Click: show. Right-click: tab settings';
      b.setAttribute('aria-pressed', CHAT_UI.filter === t.id ? 'true' : 'false');
      b.addEventListener('click', () => setChatFilter(t.id));
      b.addEventListener('contextmenu', e => { e.preventDefault(); tabMenu(b, t.id); });
      row.appendChild(b);
    }
    if (CFG.tabs.length < MAX_TABS) { const add = document.createElement('button'); add.type = 'button'; add.className = 'cf-add'; add.textContent = '+'; add.title = 'New chat tab'; add.addEventListener('click', () => newTab()); row.appendChild(add); }
    if (typeof cbTabs === 'function') cbTabs();
  }
  function applyFrame() {
    document.body.classList.toggle('chat-disabled', !CFG.master);
    const box = document.querySelector('.chat'); if (box) box.classList.add('wowchat');
    syncFilters(); paintTabs();
  }
  const ask = (q, v) => { try { return window.prompt(q, v); } catch (e) { return null; } };
  function newTab() { const name = ask('Name for the new chat tab:', 'TAB'); if (name === null) return; const r = addTab(CFG, name); if (!r.ok) return sys(r.error); commit(r.cfg); setChatFilter(r.tab.id); tabMenu(document.querySelector(`.chat-tabs [data-chat-filter="${r.tab.id}"]`), r.tab.id); }
  function tabMenu(anchor, id) {
    const t = CFG.tabs.find(x => x.id === id); if (!t || typeof cbMenu !== 'function') return;
    cbMenu(anchor, `${t.name} TAB`, [
      { label: 'Channels shown…', run: () => channelPicker(anchor, id) },
      { label: 'Rename', run: () => { const n = ask('Tab name:', t.name); if (n === null) return; const r = renameTab(CFG, id, n); if (!r.ok) return sys(r.error); commit(r.cfg); } },
      { label: 'New tab', run: newTab },
      id === 'general' ? null : { label: 'Delete tab', color: '#ff8e86', run: () => { const r = removeTab(CFG, id); if (r.ok) { commit(r.cfg); setChatFilter('general'); } } },
      { label: 'Reset all tabs', run: () => { CFG.tabs = clone(DEFAULT_TABS); CFG.active = 'general'; commit(CFG); setChatFilter('general'); } },
    ]);
  }
  // per-tab channel checklist; stays open so several channels can be toggled
  function channelPicker(anchor, id) {
    const t = CFG.tabs.find(x => x.id === id); if (!t) return;
    cbMenu(anchor, `${t.name}: CHANNELS`, CHAT_CHANNELS.map(([ch, label]) => ({ label, hint: t.ch.includes(ch) ? 'ON' : 'off', color: (typeof CB_COLOR !== 'undefined' && CB_COLOR[ch]) || null,
      run: () => { const r = toggleTabChannel(CFG, id, ch); if (r.ok) commit(r.cfg); channelPicker(anchor, id); } })), true);
  }
  function switchesMenu(anchor) {
    const onoff = v => v ? 'ON' : 'OFF';
    cbMenu(anchor, 'CHAT CHANNELS', [
      { label: 'Chat (master)', hint: onoff(CFG.master), run: () => { CFG.master = !CFG.master; commit(CFG); } },
      ...Object.entries(MUTABLE).map(([k, label]) => ({ label, hint: onoff(!CFG.muted[k]), run: () => { const r = setChannel(CFG, k, !!CFG.muted[k]); commit(r.cfg); switchesMenu(anchor); } })),
      { label: 'Adventurer chatter', hint: onoff(CFG.npc), run: () => { CFG.npc = !CFG.npc; commit(CFG); switchesMenu(anchor); } },
      { label: 'Tab settings…', run: () => tabMenu(anchor, CHAT_UI.filter) },
    ]);
  }
  // the toolbar's options button gets a CHANNELS entry: replace it with a copy that opens both menus
  function patchOptionsButton() {
    const old = document.querySelector('.cb-bar button[title="Chat options"]'); if (!old || old.dataset.cf) return;
    const b = old.cloneNode(true); b.dataset.cf = '1'; old.replaceWith(b);
    b.addEventListener('click', e => { e.stopPropagation(); cbMenu(b, 'CHAT', [{ label: 'Channels and world chat…', run: () => switchesMenu(b) }, { label: 'Tabs…', run: () => tabMenu(b, CHAT_UI.filter) }, { label: 'Frame and text options…', run: () => cbOptionsMenu(b) }]); });
  }
  const css = document.createElement('style'); css.id = 'chatframe-css'; css.textContent = CSS; document.head.appendChild(css);
  CHAT_UI.filter = CFG.active;
  const install = () => { applyFrame(); patchOptionsButton(); renderChatLog(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();

  // ---------------------------------------------------------------- in-game menu: SETTINGS > CHAT SETTINGS
  class ChatSettingsScene extends ListScene {
    constructor() { super(11); }
    opts() {
      return [
        ['CHAT', () => CFG.master, () => { CFG.master = !CFG.master; }],
        ['CHAT PANEL', () => document.body.classList.contains('chat-on'), () => { const on = !document.body.classList.contains('chat-on'); document.body.classList.toggle('chat-on', on); try { localStorage.setItem('gbq.fs.chatpanel', on ? '1' : '0'); } catch (e) {} }],
        ...Object.entries(MUTABLE).map(([k, label]) => [label.replace('GENERAL (WORLD)', 'WORLD CHAT'), () => !CFG.muted[k], () => { CFG = setChannel(CFG, k, !!CFG.muted[k]).cfg; }]),
        ['NPC CHATTER', () => CFG.npc, () => { CFG.npc = !CFG.npc; }],
        ['CHAT BUBBLES', () => S.bubbles !== false, () => { S.bubbles = S.bubbles === false; saveSettings(); }],
        ['SCREEN CHAT', () => S.screenChat !== false, () => { S.screenChat = S.screenChat === false; saveSettings(); }],
        ['NAME TAGS', () => S.nameTags !== false, () => { S.nameTags = S.nameTags === false; saveSettings(); }],
        ['COMBAT LOG', () => S.combatLog !== false, () => { S.combatLog = S.combatLog === false; saveSettings(); }],
        ['RESET TABS', null, () => { CFG.tabs = clone(DEFAULT_TABS); CFG.active = 'general'; }],
      ];
    }
    items() { return this.opts(); }
    update() {
      this.navList();
      if (P('b')) { SFX.back(); removeScene(this); return; }
      if (P('a') || nav('left') || nav('right')) { const r = this.opts()[this.i]; r[2](); commit(CFG); SFX.toggle(); }
    }
    draw() {
      fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3); textC('CHAT SETTINGS', 80, 1, 'gold');
      this.opts().slice(this.top, this.top + this.rows).forEach(([label, get], j) => {
        const i = this.top + j, y = 15 + j * 10; if (i === this.i) fill(2, y - 1, 156, 10, 1);
        text(label, 5, y, 3); if (get) textR(get() ? 'ON' : 'OFF', 154, y, get() ? 'green' : 'red'); else textR('A', 154, y, 2);
      });
      frame(1, 128, 158, 15); text('TABS: RIGHT-CLICK A TAB', 5, 132, 1);
    }
  }
  window.ChatSettingsScene = ChatSettingsScene;
}
