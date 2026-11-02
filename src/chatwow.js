// ================================================================ WOW-STYLE CHAT SYSTEM
// Built on NET.sendChat / chatLog. Adds:
//   CHANNELS  numbered like an MMO: 1 GENERAL - <zone>, 2 TRADE (cities only), 3 LOCAL DEFENSE,
//             4 LOOKING FOR GROUP, plus /join <name> custom channels; /raid /i /o (party, instance, officer)
//   COMMANDS  /join /leave /chatlist /who /afk /dnd /roll /played /ignore /unignore /friend /unfriend
//             /invite /emote shortcuts (/wave /dance /cheer /bow /laugh /cry /flex /sit /sleep ...), /clear
//   TABS      GENERAL, COMBAT (combat log), LOOT (loot, XP, money, achievements), WHISPER, SOCIAL
//   AUTO      loot, gold, XP, level-ups, achievements, quests and battle lines post to their tabs
//   BUBBLES   chat bubbles above heroes, players and townsfolk in the field (say / yell / emote)
//   SCREEN    the last lines show inside the game screen while the chat panel is hidden

const CHAT_COLORS = {
  say: '#f4f4f4', yell: '#ff4040', emote: '#ff8a3d', party: '#9fd0ff', raid: '#ff9c2e', instance: '#ff9c2e', guild: '#5cff66', officer: '#38b84a',
  whisper: '#ff8cff', world: '#ffc896', trade: '#ffc896', defense: '#ffc896', lfg: '#ffc896', custom: '#ffc896', system: '#ffe066',
  loot: '#4ddc4d', money: '#ffd84a', xp: '#b38cff', achievement: '#ffcf3a', combat: '#b8b0a4', quest: '#ffd27a', roll: '#ffe066', npc: '#f0e6c8',
};
const CHAT_TABS = {
  all: m => !['combat'].includes(m.channel),
  combat: m => m.channel === 'combat',
  loot: m => ['loot', 'money', 'xp', 'achievement', 'quest', 'roll'].includes(m.channel),
  whisper: m => m.channel === 'whisper',
  social: m => ['world', 'trade', 'lfg', 'defense', 'custom', 'emote', 'guild', 'officer', 'party', 'raid', 'instance'].includes(m.channel),
};
const EMOTES = {
  wave: 'waves', dance: 'bursts into dance', cheer: 'cheers', bow: 'bows deeply', laugh: 'laughs', cry: 'cries', flex: 'flexes', sit: 'sits down',
  sleep: 'falls asleep', salute: 'salutes', thank: 'gives thanks', hug: 'gives a big hug', clap: 'claps', roar: 'roars', shrug: 'shrugs', point: 'points',
  kneel: 'kneels', taunt: 'taunts', yawn: 'yawns', kiss: 'blows a kiss',
};
CHAT_UI.maxEntries = 400;
const CHAT_STATE = { joined: ['general', 'trade', 'defense', 'lfg'], custom: [], ignore: [], friends: [], afk: null, dnd: null, bubbles: {}, playedStart: Date.now() };
function chatPrefs() { if (G) { G.chat = G.chat || {}; for (const k of ['custom', 'ignore', 'friends']) if (!Array.isArray(G.chat[k])) G.chat[k] = []; return G.chat; } return CHAT_STATE; }
const zoneLabel = () => { const z = G && ZONE_BY_ID[G.map]; return z ? z.name : 'VALENDRIA'; };
const inCity = () => { const z = G && ZONE_BY_ID[G.map]; return !!(z && z.town); };
function channelLabel(ch, m) {
  if (ch === 'world') return `1. GENERAL - ${zoneLabel()}`;
  if (ch === 'trade') return '2. TRADE - CITY';
  if (ch === 'defense') return '3. LOCAL DEFENSE';
  if (ch === 'lfg') return '4. LOOKING FOR GROUP';
  if (ch === 'custom') return `${m && m.custom ? (chatPrefs().custom.indexOf(m.custom) + 5) + '. ' + m.custom.toUpperCase() : 'CHANNEL'}`;
  return ch.toUpperCase();
}

// ---------------------------------------------------------------- rendering (HTML chat panel)
renderChatLog = function () {
  const el = document.getElementById('chatlog'); if (!el) return;
  const flt = CHAT_TABS[CHAT_UI.filter] || CHAT_TABS.all, ign = chatPrefs().ignore.map(n => n.toLowerCase());
  const visible = CHAT_UI.entries.filter(m => flt(m) && !ign.includes(String(m.who).toLowerCase()));
  el.replaceChildren();
  for (const m of visible.slice(-80)) {
    const line = document.createElement('div'); line.className = 'ch-' + m.channel; line.style.color = CHAT_COLORS[m.channel] || '#ddd';
    const time = new Date(m.t), stamp = `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
    const tag = document.createElement('b'); tag.style.color = CHAT_COLORS[m.channel] || '#ddd';
    const sys = ['system', 'loot', 'money', 'xp', 'achievement', 'combat', 'quest', 'roll'].includes(m.channel);
    tag.textContent = m.channel === 'emote' ? `${stamp} ` : sys ? `${stamp} ` : m.channel === 'whisper' ? `${stamp} [${m.who}] whispers: ` : `${stamp} [${channelLabel(m.channel, m)}] [${m.who}]: `;
    line.appendChild(tag);
    line.appendChild(document.createTextNode(m.channel === 'emote' ? `${m.who} ${m.msg}` : m.msg)); el.appendChild(line);
  }
  el.scrollTop = el.scrollHeight;
};
setChatFilter = function (filter) {
  CHAT_UI.filter = CHAT_TABS[filter] ? filter : 'all';
  document.querySelectorAll('[data-chat-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.chatFilter === CHAT_UI.filter ? 'true' : 'false'));
  renderChatLog();
};
// replace the panel's tab row with the MMO tab set
function installChatTabs() {
  const row = document.querySelector('.chat-tabs'); if (!row || row.dataset.mmo) return;
  row.dataset.mmo = '1'; row.replaceChildren();
  for (const [k, label] of [['all', 'GENERAL'], ['combat', 'COMBAT'], ['loot', 'LOOT'], ['whisper', 'WHISPER'], ['social', 'SOCIAL']]) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.chatFilter = k; b.textContent = label;
    b.setAttribute('aria-pressed', CHAT_UI.filter === k ? 'true' : 'false'); b.addEventListener('click', () => setChatFilter(k)); row.appendChild(b);
  }
  const input = document.getElementById('chatinput'); if (input) input.placeholder = 'Say something · /1 general /2 trade /p /g /w name · /help';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installChatTabs); else installChatTabs();

// bubbles: remember the latest say / yell / emote per speaker
{
  const cl0 = chatLog;
  chatLog = function (channel, who, msg, sim) {
    const ch = String(channel || 'system').toLowerCase();
    cl0(ch, who, msg, sim);
    if (['say', 'yell', 'emote', 'npc'].includes(ch)) CHAT_STATE.bubbles[String(who).toUpperCase()] = { msg: ch === 'emote' ? `*${msg}*` : String(msg), t: Date.now(), yell: ch === 'yell' };
  };
}

// ---------------------------------------------------------------- commands
{
  const send0 = NET.sendChat.bind(NET);
  NET.sendChat = function (raw0) {
    const raw = String(raw0 || '').trim(); if (!raw) return;
    const m = raw.match(/^\/(\S+)(?:\s+([\s\S]*))?$/), me = G ? G.name : 'YOU', P2 = chatPrefs();
    if (CHAT_STATE.afk && !/^\/afk/i.test(raw)) { CHAT_STATE.afk = null; chatLog('system', 'CHAT', 'You are no longer AFK.'); }
    if (!m) return send0(raw);
    const cmd = m[1].toLowerCase(), rest = (m[2] || '').trim();
    const sys = t => chatLog('system', 'CHAT', t);
    if (cmd === 'help' || cmd === '?') { sys('CHANNELS: /s say /y yell /p party /ra raid /i instance /g guild /o officer /w name whisper /r reply'); sys('/1 general /2 trade (cities) /3 local defense /4 looking for group /5+ joined channels'); sys('/join name /leave n /chatlist /who /afk /dnd /roll [max] /played /ignore name /friend name /invite name /clear'); sys('EMOTES: /' + Object.keys(EMOTES).join(' /')); return; }
    if (EMOTES[cmd]) return send0(`/e ${EMOTES[cmd]}${rest ? ' at ' + rest.slice(0, 20) : ''}.`);
    if (cmd === 'ra' || cmd === 'raid' || cmd === 'i' || cmd === 'instance') return send0(`/p ${rest}`);
    if (cmd === 'o' || cmd === 'officer') return send0(`/g ${rest}`);
    if (cmd === '1' || cmd === 'general') return send0(`/1 ${rest}`);
    if (cmd === '2' || cmd === 'trade') { if (!inCity()) return sys('TRADE is only available in cities.'); return send0(`/2 ${rest}`); }
    if (cmd === '3' || cmd === 'localdefense' || cmd === 'defense') { if (!rest) return sys('Enter a message.'); chatLog('defense', me, clean(rest, 180)); return; }
    if (/^[5-9]$/.test(cmd)) { const name = P2.custom[+cmd - 5]; if (!name) return sys(`You are not in channel ${cmd}.`); if (!rest) return sys('Enter a message.'); const e = { channel: 'custom', who: me, msg: clean(rest, 180), t: Date.now(), custom: name }; CHAT_UI.entries.push(e); REALM.log.push(e); renderChatLog(); if (NET.room && !NET.offline) NET.room.emit('chat', { channel: 'world', text: `[${name.toUpperCase()}] ${clean(rest, 160)}`, zone: G ? G.map : '' }).catch(() => {}); return; }
    if (cmd === 'join') { const n = rest.replace(/[^a-z0-9]/gi, '').slice(0, 14).toLowerCase(); if (!n) return sys('Use /join channelname'); if (!P2.custom.includes(n)) { if (P2.custom.length >= 5) return sys('You can join up to 5 custom channels.'); P2.custom.push(n); } return sys(`Joined channel ${P2.custom.indexOf(n) + 5}. ${n.toUpperCase()}`); }
    if (cmd === 'leave') { const k = /^\d+$/.test(rest) ? +rest - 5 : P2.custom.indexOf(rest.toLowerCase()); if (k < 0 || !P2.custom[k]) return sys('Use /leave <number or name> for a joined channel.'); const n = P2.custom.splice(k, 1)[0]; return sys(`Left channel ${n.toUpperCase()}.`); }
    if (cmd === 'chatlist' || cmd === 'channels') { sys(`1. GENERAL - ${zoneLabel()}  2. TRADE${inCity() ? '' : ' (city only)'}  3. LOCAL DEFENSE  4. LOOKING FOR GROUP`); P2.custom.forEach((n, i) => sys(`${i + 5}. ${n.toUpperCase()}`)); return; }
    if (cmd === 'who') { const real = (NET.peers || []).map(p => p.presence || {}).filter(p => p.n); const sims = G ? realmPlayersIn(G.map).slice(0, 6) : []; sys(`WHO: ${real.length} online player(s), ${sims.length} adventurer(s) in ${zoneLabel()}`); real.slice(0, 8).forEach(p => sys(`[${p.n}]${p.p ? ' #' + fmtUid(p.p) : ''} L${p.l} ${(CLASSES[p.c] || { name: '' }).name}${p.g ? ' <' + p.g + '>' : ''}`)); sims.forEach(p => sys(`[${p.name}] L${p.lvl} ${(CLASSES[p.cls] || { name: '' }).name}${p.guild ? ' <' + p.guild + '>' : ''}`)); return; }
    if (cmd === 'afk') { CHAT_STATE.afk = rest || 'Away'; return sys(`You are now AFK: ${CHAT_STATE.afk}`); }
    if (cmd === 'dnd') { CHAT_STATE.dnd = CHAT_STATE.dnd ? null : (rest || 'Busy'); return sys(CHAT_STATE.dnd ? `Do Not Disturb: ${CHAT_STATE.dnd}` : 'You are no longer busy.'); }
    if (cmd === 'roll' || cmd === 'random') { const mx = Math.max(2, Math.min(1000000, parseInt(rest, 10) || 100)), r = 1 + Math.floor(R() * mx); chatLog('roll', 'ROLL', `${me} rolls ${r} (1-${mx})`); if (NET.room && !NET.offline) NET.room.emit('chat', { channel: 'emote', text: `rolls ${r} (1-${mx})`, zone: G ? G.map : '' }).catch(() => {}); return; }
    if (cmd === 'played') { const mins = Math.round((G && G.stats && G.stats.steps || 0) / 60 + (Date.now() - CHAT_STATE.playedStart) / 60000); return sys(`Time played this hero: about ${Math.floor(mins / 60)}h ${mins % 60}m. Level ${G ? G.lvl : 1}.`); }
    if (cmd === 'ignore') { const n = rest.slice(0, 24).toUpperCase(); if (!n) return sys(`Ignoring: ${P2.ignore.join(', ') || 'nobody'}`); if (!P2.ignore.includes(n)) P2.ignore.push(n); renderChatLog(); return sys(`${n} is now ignored.`); }
    if (cmd === 'unignore') { const n = rest.toUpperCase(), k = P2.ignore.indexOf(n); if (k >= 0) P2.ignore.splice(k, 1); renderChatLog(); return sys(`${n} is no longer ignored.`); }
    if (cmd === 'friend' || cmd === 'friends') { const n = rest.slice(0, 24).toUpperCase(); if (!n) return sys(`Friends: ${P2.friends.join(', ') || 'none yet'}`); if (!P2.friends.includes(n)) P2.friends.push(n); return sys(`${n} added to friends.`); }
    if (cmd === 'unfriend') { const n = rest.toUpperCase(), k = P2.friends.indexOf(n); if (k >= 0) P2.friends.splice(k, 1); return sys(`${n} removed from friends.`); }
    if (cmd === 'invite' || cmd === 'inv') { const n = rest.toUpperCase(); const sim = G && realmPlayersIn(G.map).find(p => p.name === n); if (sim) { const max = Math.max(3, modeOf().size - 1); if (G.companions.length >= max) return sys('Your party is full.'); const c = makeAdventurer(sim.cls, G.lvl, sim.name); G.companions.push(c); return sys(`${n} joins your party.`); } return sys(n ? `${n} is not nearby. Party up with real players from MENU > SOCIAL.` : 'Use /invite name'); }
    if (cmd === 'clear') { CHAT_UI.entries.length = 0; renderChatLog(); return; }
    return send0(raw);
  };
}
// incoming whispers while AFK / DND get an auto-reply note
{
  const rc0 = NET.receiveChat.bind(NET);
  NET.receiveChat = function (message) {
    const d = message && message.data || {}, who = String((d.name || '')).toUpperCase();
    if (chatPrefs().ignore.includes(who)) return;
    rc0(message);
    if (String(d.channel).toLowerCase() === 'whisper' && (CHAT_STATE.afk || CHAT_STATE.dnd)) chatLog('system', 'CHAT', `Auto-reply sent: ${CHAT_STATE.afk ? 'AFK - ' + CHAT_STATE.afk : 'Busy - ' + CHAT_STATE.dnd}`);
  };
}

// ---------------------------------------------------------------- automatic game messages
{
  const t0 = toast;
  toast = function (title, sub, icon, sfx) {
    t0(title, sub, icon, sfx);
    const T = String(title || ''), s = String(sub || '');
    const ch = /ACHIEVEMENT/.test(T) ? 'achievement' : /LEVEL/.test(T) ? 'xp' : /QUEST/.test(T) ? 'quest' : /SOLD|GOLD|\bG\b/.test(T + ' ' + s) ? 'money' : /^\+|CAUGHT|LOOT|MOUNT|NAMED|FORGED/.test(T) ? 'loot' : 'system';
    chatLog(ch, ch.toUpperCase(), `${T}${s ? ' - ' + s : ''}`);
  };
  const gx0 = gainXP;
  gainXP = function (c, amount) {
    const r = gx0(c, amount);
    if (c === G && amount > 0) { chatLog('xp', 'XP', `You gain ${fmt(Math.round(amount))} experience.`); if (r && r.ups && r.ups.length) chatLog('xp', 'LEVEL', `Congratulations, you have reached level ${G.lvl}!`); }
    return r;
  };
  const ag0 = addGear;
  addGear = function (it) { const r = ag0(it); if (it && G) chatLog('loot', 'LOOT', `You receive loot: [${it.name}]${RARITY[it.rarity] ? ' (' + RARITY[it.rarity].name + ')' : ''}`); return r; };
  // combat log: every battle line
  const say0 = Battle.prototype.say;
  Battle.prototype.say = function (text, act, wait) {
    const t = String(text || '').replace(/\n/g, ' · ').trim();
    if (t && S.combatLog !== false) chatLog('combat', 'COMBAT', t.slice(0, 170));
    return say0.call(this, text, act, wait);
  };
}
// townsfolk and adventurers bark now and then (bubbles + chat)
const NPC_BARKS = ['Fresh bread, warm from the oven!', 'Have you seen the lanterns tonight?', 'Watch the roads after dark.', 'LFG for the tower, need a healer!', 'WTS ore, cheap!', 'Anyone up for the crypt?', 'The trainers here are the best in the realm.', 'Stay safe out there.'];
{
  const rt0 = realmTick;
  realmTick = function () {
    rt0();
    if (!G || G.inst || REALM.tick % 420 !== 210) return;
    const ps = realmPlayersIn(G.map); if (!ps.length) return;
    const p = pick(ps), line = pick(NPC_BARKS);
    chatLog(line.startsWith('LFG') ? 'lfg' : line.startsWith('WTS') ? (inCity() ? 'trade' : 'world') : 'say', p.name, line, true);
  };
}

// ---------------------------------------------------------------- bubbles and in-screen chat lines
function chatBubble(msg, cx, top, yell) {
  const s = String(msg).slice(0, 22), w = Math.min(150, s.length * 6 + 6), x = Math.max(1, Math.min(W - w - 1, Math.round(cx - w / 2))), y = Math.max(12, top - 13);
  fill(x, y, w, 11, yell ? '#3a0c0c' : '#f4efe2'); fill(x, y, w, 1, '#2a2018'); fill(x, y + 10, w, 1, '#2a2018'); fill(x, y, 1, 11, '#2a2018'); fill(x + w - 1, y, 1, 11, '#2a2018');
  fill(Math.round(cx) - 1, y + 11, 3, 2, yell ? '#3a0c0c' : '#f4efe2');
  text(s, x + 3, y + 1, yell ? 'red' : '#1c1610');
}
function drawFieldChat(field) {
  if (!field.cam || G.inst) return;
  const now = Date.now(), B = S.bubbles === false ? {} : CHAT_STATE.bubbles, T0 = 16;
  const at = (name, tx, ty) => { const b = B[String(name).toUpperCase()]; if (!b || now - b.t > 4500) return; chatBubble(b.msg, tx * T0 - field.cam[0] + 8, ty * T0 - field.cam[1] - 2, b.yell); };
  at(G.name, G.x, G.y);
  for (const p of realmPlayersIn(G.map)) at(p.name, p.x, p.y);
  for (const p of NET.peersInZone(G.map)) at(p.presence.n || '', p.presence.x, p.presence.y);
  // in-screen chat lines when the chat panel is hidden
  if (!document.body.classList.contains('chat-on') && S.screenChat !== false) {
    const lines = CHAT_UI.entries.filter(m => m.channel !== 'combat' && now - m.t < 12000).slice(-3);
    lines.forEach((m, i) => {
      const y = H - 27 - (lines.length - 1 - i) * 9, s = `${m.channel === 'emote' ? m.who + ' ' + m.msg : (['system', 'loot', 'xp', 'money', 'achievement', 'quest', 'roll'].includes(m.channel) ? '' : m.who + ': ') + m.msg}`.slice(0, 26);
      ctx.globalAlpha = 0.7; fill(0, y - 1, s.length * 6 + 4, 9, '#0c0a0a'); ctx.globalAlpha = 1;
      text(s, 2, y, CHAT_COLORS[m.channel] || '#ddd');
    });
  }
}
{
  const fd0 = Field.prototype.draw;
  Field.prototype.draw = function () { fd0.call(this); try { drawFieldChat(this); } catch (e) { /* never break the frame for chat */ } };
}
