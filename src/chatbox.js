// ================================================================ CHAT BOX (MMO-style edit box and chat frame)
// Builds on chatwow.js. The chat frame now works like a classic MMO chat box:
//   EDIT BOX   a coloured channel label in front of the input ("Say:", "Party:", "[1. General]:", "Tell NAME:")
//   STICKY     plain text goes to the last channel you used (say, party, guild, raid, instance, officer,
//              numbered channels and whispers stick; yell and emotes do not)
//   SWITCHING  typing "/p ", "/g ", "/2 ", "/w name " or "/r " at the start of the box switches channel
//   HISTORY    UP / DOWN in the edit box walk through what you sent (last 40 lines)
//   TAB        completes /commands, then player names; press again to cycle
//   KEYS       ENTER opens the edit box from the field (option), "/" opens it with a slash, ESC closes it
//   TOOLBAR    channel menu, emote menu, social (friends / ignore / who), jump to latest, text size, options
//   NAMES      click a name in the log to whisper; right-click for whisper / invite / friend / ignore / who
//   FRAME      drag the title bar to move, drag the corner grip to resize, fades when idle; tabs flash
//              with unread messages
const CHATBOX = {
  mode: { ch: 'say', to: '' }, prev: { ch: 'say', to: '' }, history: [], hi: -1, draft: '', unread: {}, tab: null, idleT: 0,
  opts: { enter: false, fade: true, stamps: true, size: 12 },
};
const CB_STICKY = ['say', 'party', 'raid', 'instance', 'guild', 'officer', 'whisper', 'world', 'trade', 'defense', 'lfg', 'custom'];
const CB_ALIAS = {
  s: 'say', say: 'say', y: 'yell', yell: 'yell', sh: 'yell', p: 'party', party: 'party', ra: 'raid', raid: 'raid', i: 'instance', instance: 'instance',
  g: 'guild', guild: 'guild', o: 'officer', officer: 'officer', e: 'emote', em: 'emote', me: 'emote', emote: 'emote',
  '1': 'world', general: 'world', '2': 'trade', trade: 'trade', '3': 'defense', localdefense: 'defense', defense: 'defense', '4': 'lfg', lfg: 'lfg',
};
const CB_CMD = { say: 's', yell: 'y', party: 'p', raid: 'ra', instance: 'i', guild: 'g', officer: 'o', emote: 'e', world: '1', trade: '2', defense: '3', lfg: '4' };
const CB_COLOR = Object.assign({}, CHAT_COLORS, { raid: '#ff7f00', instance: '#ff7f00', world: '#ffc0c0', trade: '#ffc0c0', defense: '#ffc0c0', lfg: '#ffc0c0', custom: '#ffc0c0' });
const CB_COMMANDS = ['s', 'say', 'y', 'yell', 'p', 'party', 'ra', 'raid', 'i', 'instance', 'g', 'guild', 'o', 'officer', 'e', 'emote', 'w', 'whisper', 'tell', 'r', 'reply',
  '1', '2', '3', '4', 'join', 'leave', 'chatlist', 'who', 'afk', 'dnd', 'roll', 'played', 'ignore', 'unignore', 'friend', 'unfriend', 'invite', 'clear', 'help', 'gm', 'admin']
  .concat(Object.keys(EMOTES));
function cbLoad() { try { Object.assign(CHATBOX.opts, JSON.parse(localStorage.getItem('gbq.chatbox') || '{}')); } catch (e) {} }
function cbSave() { try { localStorage.setItem('gbq.chatbox', JSON.stringify(CHATBOX.opts)); } catch (e) {} }

// the label in front of the edit box
function cbLabel(md) {
  const m = md || CHATBOX.mode;
  if (m.ch === 'whisper') return `Tell ${m.to}:`;
  if (m.ch === 'reply') return `Tell ${NET.lastWhisper || '?'}:`;
  if (m.ch === 'custom') return `[${chatPrefs().custom.indexOf(m.to) + 5}. ${String(m.to).replace(/^./, c => c.toUpperCase())}]:`;
  if (m.ch === 'world') return `[1. General]:`;
  if (m.ch === 'trade') return '[2. Trade]:';
  if (m.ch === 'defense') return '[3. LocalDefense]:';
  if (m.ch === 'lfg') return '[4. LookingForGroup]:';
  return m.ch.replace(/^./, c => c.toUpperCase()) + ':';
}
function cbWhisperToken(name) {
  const value = String(name || '').replace(/"/g, '');
  return /\s/.test(value) ? `"${value}"` : value;
}
// the command a mode sends with
function cbPrefix(m) {
  if (m.ch === 'whisper') return `/w ${cbWhisperToken(m.to)} `;
  if (m.ch === 'custom') return `/${chatPrefs().custom.indexOf(m.to) + 5} `;
  return `/${CB_CMD[m.ch] || 's'} `;
}
// "/p hello" -> { mode, rest } when the text starts with a channel command
function cbParse(v) {
  const w = v.match(/^\/(w|whisper|tell|t|send)\s+(?:"([^"]+)"|(\S+))\s+([\s\S]*)$/i); if (w) return { mode: { ch: 'whisper', to: (w[2] || w[3]).slice(0, 24).toUpperCase() }, rest: w[4] };
  const r = v.match(/^\/(r|reply)\s([\s\S]*)$/i); if (r) return NET.lastWhisper ? { mode: { ch: 'whisper', to: String(NET.lastWhisper).toUpperCase() }, rest: r[2] } : null;
  const c = v.match(/^\/(\S+)\s([\s\S]*)$/); if (!c) return null;
  const k = c[1].toLowerCase();
  if (/^[5-9]$/.test(k)) { const n = chatPrefs().custom[+k - 5]; return n ? { mode: { ch: 'custom', to: n }, rest: c[2] } : null; }
  return CB_ALIAS[k] ? { mode: { ch: CB_ALIAS[k], to: '' }, rest: c[2] } : null;
}
function cbSetMode(m, sticky) {
  if (sticky !== false && CB_STICKY.includes(CHATBOX.mode.ch)) CHATBOX.prev = { ...CHATBOX.mode };
  CHATBOX.mode = { ...m }; cbPaint();
}
function cbPaint() {
  const lab = document.getElementById('chatlabel'); if (!lab) return;
  lab.textContent = cbLabel(); const col = CB_COLOR[CHATBOX.mode.ch] || '#f4f4f4';
  lab.style.color = col; const inp = document.getElementById('chatinput'); if (inp) inp.style.color = col;
}

// ---------------------------------------------------------------- frame, toolbar and menus
const CB_CSS = `
.chat.cbx { gap: 4px !important; transition: background-color .4s, box-shadow .4s, border-color .4s; }
.game-viewport > .chat.cbx.cb-moved, body .chat.cbx.cb-moved { left: var(--cb-x) !important; top: var(--cb-y) !important; right: auto !important; bottom: auto !important; }
.game-viewport > .chat.cbx.cb-sized, body .chat.cbx.cb-sized { width: var(--cb-w) !important; height: var(--cb-h) !important; max-height: none !important; max-width: calc(100% - 8px) !important; }
.chat.cbx.cb-idle:not(:hover):not(:focus-within) { background: rgba(0,0,0,.25) !important; border-color: transparent !important; box-shadow: none !important; }
.chat.cbx.cb-idle:not(:hover):not(:focus-within) .chat-tabs, .chat.cbx.cb-idle:not(:hover):not(:focus-within) .cb-bar, .chat.cbx.cb-idle:not(:hover):not(:focus-within) .chat-titlebar,
.chat.cbx.cb-idle:not(:hover):not(:focus-within) .cb-grip { opacity: 0; }
.chat.cbx.cb-idle:not(:hover):not(:focus-within) .chatlog { background: transparent !important; border-color: transparent !important; }
.chat.cbx.cb-idle:not(:hover):not(:focus-within) .chatform { opacity: .35; }
.chat.cbx .chat-tabs, .chat.cbx .cb-bar, .chat.cbx .chat-titlebar, .chat.cbx .chatform, .chat.cbx .cb-grip { transition: opacity .4s; }
.chat.cbx .chat-titlebar { cursor: move; user-select: none; touch-action: none; }
.chat.cbx .chatlog { flex: 1; min-height: 40px; font-size: var(--cb-fs, 12px) !important; line-height: 1.35 !important; text-shadow: 0 1px 0 #000; }
.chat.cbx .chatlog .cb-name { cursor: pointer; } .chat.cbx .chatlog .cb-name:hover { text-decoration: underline; }
.chat.cbx .chatlog .cb-stamp { color: #8b8378; font-weight: 400; }
.chat.cbx .chat-tabs button { position: relative; }
.chat.cbx .chat-tabs button.cb-new { animation: cbflash 1s steps(2) infinite; }
.chat.cbx .chat-tabs button .cb-dot { position: absolute; top: 1px; right: 2px; font-size: 8px; color: #ffcf3a; }
@keyframes cbflash { 50% { color: #fff !important; background: #6a2a1a; } }
.cb-bar { display: flex; gap: 3px; align-items: center; }
.cb-bar button { min-width: 22px; height: 20px; padding: 0 5px; background: linear-gradient(#241a14, #120d0a); color: #d4ac60; border: 1px solid #5a4630; border-radius: 2px; font: 700 10px Arial, sans-serif; cursor: pointer; }
.cb-bar button:hover { border-color: #d4ac60; color: #fff3d2; }
.cb-bar .cb-sp { flex: 1; }
.cb-bar .cb-mode { color: #8b8378; font: 400 9px Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.chat.cbx .chatform { align-items: stretch; gap: 0 !important; }
.chat.cbx .chatform .cb-label { display: flex; align-items: center; padding: 0 5px 0 7px; background: #0a0807; border: 1px solid #3a2e22; border-right: 0; border-radius: 2px 0 0 2px; font: 700 11px Arial, sans-serif; white-space: nowrap; max-width: 46%; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.chat.cbx .chatform input { border-left: 0 !important; border-radius: 0 !important; font: 400 12px Arial, sans-serif !important; padding-left: 2px !important; }
.chat.cbx .chatform input:focus { outline: none !important; }
.chat.cbx .chatform:focus-within .cb-label, .chat.cbx .chatform:focus-within input { border-color: #d4ac60 !important; }
.chat.cbx .chatform button { margin-left: 4px; }
.cb-grip { position: absolute; right: 1px; bottom: 1px; width: 12px; height: 12px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, #8a6a3a 50%, #8a6a3a 60%, transparent 60%, transparent 70%, #8a6a3a 70%, #8a6a3a 80%, transparent 80%); }
.cb-menu { position: fixed; z-index: 60; min-width: 130px; max-height: 60vh; overflow-y: auto; padding: 3px; background: linear-gradient(#1a1310, #0b0807); border: 1px solid #8a6a3a;
  box-shadow: inset 0 0 0 1px #000, 0 6px 18px rgba(0,0,0,.75); font: 11px Arial, sans-serif; color: #e8dcc2; }
.cb-menu .cb-mh { padding: 3px 6px; color: #d4ac60; font-weight: 700; letter-spacing: .08em; font-size: 10px; border-bottom: 1px solid #3a2e22; margin-bottom: 2px; }
.cb-menu button { display: flex; width: 100%; gap: 6px; justify-content: space-between; padding: 3px 6px; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.cb-menu button:hover, .cb-menu button:focus { background: #3a1a12; color: #fff; outline: none; }
.cb-menu button small { color: #8b8378; }
.cb-menu.cb-grid { display: grid; grid-template-columns: repeat(3, 1fr); width: 220px; }
.cb-menu.cb-grid .cb-mh { grid-column: 1 / -1; }
`;
function cbMenu(anchor, title, items, grid) {
  cbCloseMenu();
  const m = document.createElement('div'); m.className = 'cb-menu' + (grid ? ' cb-grid' : ''); m.id = 'cbmenu'; m.setAttribute('role', 'menu');
  if (title) { const h = document.createElement('div'); h.className = 'cb-mh'; h.textContent = title; m.appendChild(h); }
  for (const it of items) {
    if (!it) continue;
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem');
    const l = document.createElement('span'); l.textContent = it.label; if (it.color) l.style.color = it.color; b.appendChild(l);
    if (it.hint) { const s = document.createElement('small'); s.textContent = it.hint; b.appendChild(s); }
    b.addEventListener('click', e => { e.stopPropagation(); cbCloseMenu(); it.run(); });
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, bottom: anchor.y };
  const mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(4, Math.min(innerWidth - mw - 4, r.left)) + 'px';
  m.style.top = Math.max(4, (r.top - mh - 4 > 0 ? r.top - mh - 4 : r.bottom + 4)) + 'px';
  const first = m.querySelector('button'); if (first) first.focus({ preventScroll: true });
  m.addEventListener('keydown', e => {
    const bs = [...m.querySelectorAll('button')], k = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); cbCloseMenu(); cbFocus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (bs[k + 1] || bs[0]).focus(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (bs[k - 1] || bs[bs.length - 1]).focus(); }
  });
}
function cbCloseMenu() { const m = document.getElementById('cbmenu'); if (m) m.remove(); }
addEventListener('pointerdown', e => { const m = document.getElementById('cbmenu'); if (m && !m.contains(e.target)) cbCloseMenu(); }, true);

function cbFocus(prefill) {
  const inp = document.getElementById('chatinput'); if (!inp) return;
  if (!document.body.classList.contains('chat-on')) { document.body.classList.add('chat-on'); try { localStorage.setItem('gbq.fs.chatpanel', '1'); } catch (e) {} }
  if (prefill != null) inp.value = prefill;
  inp.focus({ preventScroll: true }); inp.setSelectionRange(inp.value.length, inp.value.length);
  cbWake();
}
function cbWhisper(name) { if (!name) return; cbSetMode({ ch: 'whisper', to: String(name).slice(0, 24).toUpperCase() }); cbFocus(''); }

function cbChannelMenu(anchor) {
  const P2 = chatPrefs(), it = (ch, to, hint) => ({ label: cbLabel({ ch, to }).replace(/:$/, ''), color: CB_COLOR[ch], hint, run: () => { cbSetMode({ ch, to }); cbFocus(''); } });
  cbMenu(anchor, 'CHANNEL', [
    it('say', '', '/s'), it('yell', '', '/y'), it('party', '', '/p'), it('raid', '', '/ra'), it('instance', '', '/i'), it('guild', '', '/g'), it('officer', '', '/o'),
    it('world', '', '/1'), inCity() ? it('trade', '', '/2') : null, it('defense', '', '/3'), it('lfg', '', '/4'),
    ...P2.custom.map((n, i) => it('custom', n, '/' + (i + 5))),
    { label: 'Whisper…', color: CB_COLOR.whisper, hint: '/w', run: () => cbFocus('/w ') },
    NET.lastWhisper ? { label: `Reply to ${NET.lastWhisper}`, color: CB_COLOR.whisper, hint: '/r', run: () => cbWhisper(NET.lastWhisper) } : null,
    { label: 'Join channel…', hint: '/join', run: () => cbFocus('/join ') },
    { label: 'List channels', hint: '/chatlist', run: () => NET.sendChat('/chatlist') },
  ]);
}
function cbEmoteMenu(anchor) {
  cbMenu(anchor, 'EMOTES', Object.keys(EMOTES).map(k => ({ label: '/' + k, color: CB_COLOR.emote, run: () => NET.sendChat('/' + k) }))
    .concat([{ label: '/roll', color: CB_COLOR.roll, run: () => NET.sendChat('/roll') }]), true);
}
function cbSocialMenu(anchor) {
  const P2 = chatPrefs();
  cbMenu(anchor, `SOCIAL · ${P2.friends.length} FRIENDS`, [
    { label: 'Who is here', hint: '/who', run: () => NET.sendChat('/who') },
    ...P2.friends.slice(0, 8).map(n => ({ label: n, color: CB_COLOR.whisper, hint: 'whisper', run: () => cbWhisper(n) })),
    { label: 'Add friend…', hint: '/friend', run: () => cbFocus('/friend ') },
    { label: `Ignore list (${P2.ignore.length})`, hint: '/ignore', run: () => NET.sendChat('/ignore') },
    { label: CHAT_STATE.afk ? 'Back from AFK' : 'Go AFK', hint: '/afk', run: () => { if (CHAT_STATE.afk) { CHAT_STATE.afk = null; chatLog('system', 'CHAT', 'You are no longer AFK.'); } else NET.sendChat('/afk'); } },
    { label: CHAT_STATE.dnd ? 'Clear Do Not Disturb' : 'Do Not Disturb', hint: '/dnd', run: () => NET.sendChat('/dnd') },
    { label: 'Time played', hint: '/played', run: () => NET.sendChat('/played') },
  ]);
}
function cbNameMenu(pt, name) {
  cbMenu(pt, name, [
    { label: 'Whisper', color: CB_COLOR.whisper, run: () => cbWhisper(name) },
    { label: 'Invite to party', run: () => NET.sendChat('/invite ' + name) },
    { label: 'Add friend', run: () => NET.sendChat('/friend ' + name) },
    { label: 'Ignore', run: () => NET.sendChat('/ignore ' + name) },
    { label: 'Who', run: () => NET.sendChat('/who') },
    { label: 'Copy name', run: () => { try { navigator.clipboard.writeText(name).catch(() => {}); } catch (e) {} } },
  ]);
}
function cbOptionsMenu(anchor) {
  const o = CHATBOX.opts, onoff = v => v ? 'ON' : 'OFF', set = (k, v) => { o[k] = v; cbSave(); cbApply(); };
  cbMenu(anchor, 'CHAT OPTIONS', [
    { label: 'ENTER opens chat', hint: onoff(o.enter), run: () => set('enter', !o.enter) },
    { label: 'Fade when idle', hint: onoff(o.fade), run: () => set('fade', !o.fade) },
    { label: 'Timestamps', hint: onoff(o.stamps), run: () => { set('stamps', !o.stamps); renderChatLog(); } },
    { label: 'Chat bubbles', hint: onoff(S.bubbles !== false), run: () => { S.bubbles = S.bubbles === false; saveSettings(); } },
    { label: 'Combat log', hint: onoff(S.combatLog !== false), run: () => { S.combatLog = S.combatLog === false; saveSettings(); } },
    { label: 'Text size', hint: o.size + 'px', run: () => set('size', o.size >= 16 ? 10 : o.size + 2) },
    { label: 'Reset position and size', run: () => { delete o.x; delete o.y; delete o.w; delete o.h; cbSave(); cbApply(); } },
    { label: 'Clear chat', run: () => NET.sendChat('/clear') },
  ]);
}

function cbApply() {
  const box = document.querySelector('.chat'); if (!box) return; const o = CHATBOX.opts;
  box.style.setProperty('--cb-fs', o.size + 'px');
  const moved = o.x != null && o.y != null, sized = o.w != null && o.h != null;
  box.classList.toggle('cb-moved', moved); box.classList.toggle('cb-sized', sized);
  if (moved) { box.style.setProperty('--cb-x', o.x + 'px'); box.style.setProperty('--cb-y', o.y + 'px'); }
  if (sized) { box.style.setProperty('--cb-w', o.w + 'px'); box.style.setProperty('--cb-h', o.h + 'px'); }
  if (!o.fade) box.classList.remove('cb-idle');
}
function cbWake() {
  const box = document.querySelector('.chat'); if (!box) return;
  box.classList.remove('cb-idle'); clearTimeout(CHATBOX.idleT);
  if (CHATBOX.opts.fade) CHATBOX.idleT = setTimeout(() => box.classList.add('cb-idle'), 9000);
}
// drag (title bar) and resize (corner grip), kept inside the game viewport
function cbDrag(handle, box, resize) {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (!resize && e.target.closest('button'))) return;
    e.preventDefault(); handle.setPointerCapture(e.pointerId);
    const host = box.offsetParent || document.body, hr = host.getBoundingClientRect(), br = box.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, o = CHATBOX.opts;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (resize) { o.w = Math.round(Math.max(220, Math.min(hr.width - (br.left - hr.left) - 4, br.width + dx))); o.h = Math.round(Math.max(130, Math.min(hr.height - (br.top - hr.top) - 4, br.height + dy))); o.x = Math.round(br.left - hr.left); o.y = Math.round(br.top - hr.top); }
      else { o.x = Math.round(Math.max(0, Math.min(hr.width - br.width, br.left - hr.left + dx))); o.y = Math.round(Math.max(0, Math.min(hr.height - br.height, br.top - hr.top + dy))); if (o.w == null) { o.w = Math.round(br.width); o.h = Math.round(br.height); } }
      cbApply();
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); cbSave(); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
}

// ---------------------------------------------------------------- tab completion
function cbNames() {
  const out = new Set(), P2 = chatPrefs();
  for (const p of (NET.peers || [])) { const n = (p.presence || {}).n; if (n) out.add(String(n).toUpperCase()); }
  if (G) for (const p of realmPlayersIn(G.map)) out.add(p.name);
  for (const n of P2.friends) out.add(n);
  for (const m of CHAT_UI.entries.slice(-120)) if (m.who && !['system', 'loot', 'money', 'xp', 'achievement', 'combat', 'quest', 'roll'].includes(m.channel)) out.add(String(m.who).toUpperCase());
  if (G) { out.delete(String(G.name).toUpperCase()); for (const c of G.companions || []) out.add(String(c.name).toUpperCase()); }
  return [...out].filter(n => n && n.length < 25 && !/^(CHAT|SYSTEM|YOU)$/.test(n)).sort();
}
function cbComplete(inp, back) {
  const v = inp.value, T = CHATBOX.tab;
  if (T && T.after === v) { T.k = (T.k + (back ? T.list.length - 1 : 1)) % T.list.length; inp.value = T.before + T.list[T.k] + T.tail; T.after = inp.value; return true; }
  let before, word, list, tail = ' ';
  const cm = v.match(/^\/(\S*)$/);
  if (cm) { before = '/'; word = cm[1].toLowerCase(); list = CB_COMMANDS.filter(c => c.startsWith(word) && c !== word); }
  else {
    const m = v.match(/^([\s\S]*?)(\S*)$/); before = m[1]; word = m[2].toUpperCase();
    if (!word && !/^\/(w|whisper|tell|t|send|invite|inv|friend|ignore|unignore|unfriend)\s$/i.test(v)) return false;
    list = cbNames().filter(n => n.startsWith(word));
    const whisperPrefix = before.match(/^\/(?:w|whisper|tell|t|send)\s+("?)$/i);
    if (whisperPrefix) {
      const quoteOpen = whisperPrefix[1] === '"';
      list = list.map(n => quoteOpen ? String(n).replace(/"/g, '') + '"' : cbWhisperToken(n));
    }
  }
  if (!list.length) { SFX.error && SFX.error(); return true; }
  CHATBOX.tab = { before, list, k: 0, tail };
  inp.value = before + list[0] + tail; CHATBOX.tab.after = inp.value;
  if (list.length > 1) chatLog('system', 'CHAT', `${list.length} matches: ${list.slice(0, 10).map(x => cm ? '/' + x : x).join('  ')}${list.length > 10 ? ' …' : ''}`);
  return true;
}

// ---------------------------------------------------------------- the log: clickable names, optional timestamps, unread tabs
renderChatLog = function () {
  const el = document.getElementById('chatlog'); if (!el) return;
  const flt = CHAT_TABS[CHAT_UI.filter] || CHAT_TABS.all, ign = chatPrefs().ignore.map(n => n.toLowerCase());
  const visible = CHAT_UI.entries.filter(m => flt(m) && !ign.includes(String(m.who).toLowerCase()));
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24 || !el.dataset.cb;
  el.dataset.cb = '1'; el.replaceChildren();
  const sysCh = ['system', 'loot', 'money', 'xp', 'achievement', 'combat', 'quest', 'roll'];
  for (const m of visible.slice(-150)) {
    const col = CB_COLOR[m.channel] || '#ddd', line = document.createElement('div'); line.className = 'ch-' + m.channel; line.style.color = col;
    if (CHATBOX.opts.stamps) { const t = new Date(m.t), st = document.createElement('span'); st.className = 'cb-stamp'; st.textContent = `${pad2(t.getHours())}:${pad2(t.getMinutes())} `; line.appendChild(st); }
    const name = who => { const b = document.createElement('b'); b.className = 'cb-name'; b.dataset.who = String(who).toUpperCase(); b.style.color = col; b.textContent = `[${who}]`; return b; };
    const add = s => line.appendChild(document.createTextNode(s));
    if (sysCh.includes(m.channel)) add(m.msg);
    else if (m.channel === 'emote') { const b = name(m.who); b.textContent = m.who; line.appendChild(b); add(' ' + m.msg); }
    else if (m.channel === 'whisper') {
      const mine = G && String(m.who).toUpperCase() === String(G.name).toUpperCase() && m.to;
      if (mine) { add('To '); line.appendChild(name(m.to)); add(': ' + m.msg); } else { line.appendChild(name(m.who)); add(' whispers: ' + m.msg); }
    } else if (m.channel === 'say' || m.channel === 'yell' || m.channel === 'npc') { line.appendChild(name(m.who)); add(` ${m.channel === 'yell' ? 'yells' : 'says'}: ${m.msg}`); }
    else { const b = document.createElement('b'); b.style.color = col; b.textContent = `[${channelLabel(m.channel, m).replace(/\b([A-Z])([A-Z]+)\b/g, (x, a, r) => a + r.toLowerCase())}] `; line.appendChild(b); line.appendChild(name(m.who)); add(': ' + m.msg); }
    el.appendChild(line);
  }
  if (atBottom) el.scrollTop = el.scrollHeight;
};
// unread markers on the other tabs; whispers flash
{
  const cl1 = chatLog;
  chatLog = function (channel, who, msg, sim) {
    cl1(channel, who, msg, sim);
    const e = CHAT_UI.entries[CHAT_UI.entries.length - 1]; if (!e) return;
    for (const k in CHAT_TABS) if (k !== CHAT_UI.filter && CHAT_TABS[k](e) && e.channel !== 'combat') CHATBOX.unread[k] = (CHATBOX.unread[k] || 0) + 1;
    if (e.channel === 'whisper' && G && String(e.who).toUpperCase() !== String(G.name).toUpperCase()) CHATBOX.unread.flash = true;
    cbTabs(); if (!['combat'].includes(e.channel)) cbWake();
  };
  const sf0 = setChatFilter;
  setChatFilter = function (f) { sf0(f); delete CHATBOX.unread[CHAT_UI.filter]; if (CHAT_UI.filter === 'whisper') CHATBOX.unread.flash = false; cbTabs(); };
}
function cbTabs() {
  document.querySelectorAll('.chat-tabs [data-chat-filter]').forEach(b => {
    const k = b.dataset.chatFilter, n = CHATBOX.unread[k] || 0;
    let d = b.querySelector('.cb-dot'); if (n && !d) { d = document.createElement('span'); d.className = 'cb-dot'; d.textContent = '●'; b.appendChild(d); } if (!n && d) d.remove();
    b.classList.toggle('cb-new', k === 'whisper' && !!CHATBOX.unread.flash);
  });
}
// remember whom we whispered so the log can say "To [NAME]:"
{
  const send1 = NET.sendChat.bind(NET);
  NET.sendChat = function (raw) {
    const w = String(raw || '').trim().match(/^\/(w|whisper|tell|t|send)\s+(?:"([^"]+)"|(\S+))\s+[\s\S]+$/i);
    const target = w && (w[2] || w[3]);
    const n0 = CHAT_UI.entries.length, r = send1(raw);
    if (w) for (let i = n0; i < CHAT_UI.entries.length; i++) if (CHAT_UI.entries[i].channel === 'whisper') { CHAT_UI.entries[i].to = target.toUpperCase(); renderChatLog(); }
    return r;
  };
}

// ---------------------------------------------------------------- install
function installChatBox() {
  const box = document.querySelector('.chat'), form = document.getElementById('chatform'), inp = document.getElementById('chatinput');
  if (!box || !form || !inp || box.classList.contains('cbx')) return;
  cbLoad(); box.classList.add('cbx');
  const st = document.createElement('style'); st.id = 'chatbox-css'; st.textContent = CB_CSS; document.head.appendChild(st);
  // edit-box label
  const lab = document.createElement('label'); lab.id = 'chatlabel'; lab.className = 'cb-label'; lab.htmlFor = 'chatinput'; lab.title = 'Channel (click to change)';
  lab.addEventListener('click', e => { e.preventDefault(); cbChannelMenu(lab); });
  form.insertBefore(lab, inp); inp.placeholder = ''; inp.setAttribute('aria-describedby', 'chatlabel');
  // toolbar
  const bar = document.createElement('div'); bar.className = 'cb-bar';
  const btn = (t, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.title = label; b.setAttribute('aria-label', label); b.addEventListener('click', e => { e.stopPropagation(); fn(b); }); bar.appendChild(b); return b; };
  btn('💬', 'Channels', cbChannelMenu); btn('☺', 'Emotes', cbEmoteMenu); btn('👥', 'Social', cbSocialMenu);
  const hint = document.createElement('span'); hint.className = 'cb-mode'; hint.textContent = '/ chat · TAB complete · ↑↓ history'; bar.appendChild(hint);
  const sp = document.createElement('span'); sp.className = 'cb-sp'; bar.appendChild(sp);
  btn('A±', 'Text size', () => { CHATBOX.opts.size = CHATBOX.opts.size >= 16 ? 10 : CHATBOX.opts.size + 2; cbSave(); cbApply(); });
  btn('⤓', 'Jump to latest', () => { const el = document.getElementById('chatlog'); if (el) el.scrollTop = el.scrollHeight; });
  btn('⚙', 'Chat options', cbOptionsMenu);
  box.insertBefore(bar, document.getElementById('chatlog'));
  // grip, drag
  const grip = document.createElement('div'); grip.className = 'cb-grip'; grip.title = 'Resize'; box.appendChild(grip);
  const tb = box.querySelector('.chat-titlebar'); if (tb) { tb.firstElementChild.textContent = 'REALM CHAT · C hide · drag to move'; cbDrag(tb, box, false); tb.addEventListener('dblclick', () => { const o = CHATBOX.opts; delete o.x; delete o.y; delete o.w; delete o.h; cbSave(); cbApply(); }); }
  cbDrag(grip, box, true);
  // names in the log
  const log = document.getElementById('chatlog');
  log.addEventListener('click', e => { const n = e.target.closest('.cb-name'); if (n) cbWhisper(n.dataset.who); });
  log.addEventListener('contextmenu', e => { const n = e.target.closest('.cb-name'); if (!n) return; e.preventDefault(); cbNameMenu({ x: e.clientX, y: e.clientY }, n.dataset.who); });
  box.addEventListener('pointerenter', cbWake); box.addEventListener('pointermove', () => { if (box.classList.contains('cb-idle')) cbWake(); });
  // edit box behaviour: live channel switching
  inp.addEventListener('input', () => {
    CHATBOX.tab = null;
    const p = cbParse(inp.value); if (!p) return;
    cbSetMode(p.mode); inp.value = p.rest;
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Tab') { if (cbComplete(inp, e.shiftKey)) { e.preventDefault(); e.stopPropagation(); } return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const H2 = CHATBOX.history; if (!H2.length) return; e.preventDefault();
      if (CHATBOX.hi < 0) CHATBOX.draft = inp.value;
      CHATBOX.hi = e.key === 'ArrowUp' ? Math.min(H2.length - 1, CHATBOX.hi + 1) : CHATBOX.hi - 1;
      const v = CHATBOX.hi < 0 ? CHATBOX.draft : H2[H2.length - 1 - CHATBOX.hi];
      const p = CHATBOX.hi < 0 ? null : cbParse(v + (v.endsWith(' ') ? '' : ' '));
      if (p && !/^\/(w|whisper|tell|t)\s+\S+\s*$/i.test(v)) { cbSetMode(p.mode, false); inp.value = p.rest.replace(/ $/, ''); } else inp.value = v;
      return;
    }
    if (e.key === 'Backspace' && !inp.value && CHATBOX.mode.ch !== 'say') { cbSetMode({ ch: 'say', to: '' }); e.preventDefault(); }
    if (e.key === 'Escape') { inp.value = ''; CHATBOX.hi = -1; if (!CB_STICKY.includes(CHATBOX.mode.ch)) { CHATBOX.mode = { ...CHATBOX.prev }; cbPaint(); } }
  });
  // submit: plain text goes to the sticky channel (runs before the client's own submit handler)
  form.addEventListener('submit', () => {
    const v = inp.value.trim(); CHATBOX.hi = -1; CHATBOX.tab = null;
    if (!v) { if (!CB_STICKY.includes(CHATBOX.mode.ch)) { CHATBOX.mode = { ...CHATBOX.prev }; cbPaint(); } return; }
    const full = v.startsWith('/') ? v : cbPrefix(CHATBOX.mode) + v;
    if (CHATBOX.history[CHATBOX.history.length - 1] !== full) { CHATBOX.history.push(full); if (CHATBOX.history.length > 40) CHATBOX.history.shift(); }
    inp.value = CHATBOX.mode.ch === 'say' && !v.startsWith('/') ? v : full;
    if (!CB_STICKY.includes(CHATBOX.mode.ch)) CHATBOX.mode = { ...CHATBOX.prev };
    cbPaint();
  }, true);
  cbApply(); cbPaint(); cbTabs(); cbWake(); renderChatLog();
}
// global keys: ENTER opens the edit box from the field, "/" opens it with a slash
addEventListener('keydown', e => {
  if (e.repeat || e.defaultPrevented || typing() || keyCaptureHandler || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!document.querySelector('.chat.cbx')) return;
  const field = typeof Field !== 'undefined' && topScene() instanceof Field;
  if (e.key === '/' && G) { e.preventDefault(); e.stopImmediatePropagation(); cbFocus('/'); return; }
  if (e.key === 'Enter' && CHATBOX.opts.enter && field && document.body.classList.contains('chat-on')) { e.preventDefault(); e.stopImmediatePropagation(); cbFocus(); }
}, true);
installChatBox();
