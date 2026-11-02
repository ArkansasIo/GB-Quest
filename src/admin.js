// ================================================================ ADMIN CONTROL (in-game GM console with menus and sub-menus)
// Who can open it:
//   * the owner of the shared page (claude.ai user capability: isOwner)
//   * realm staff on the realm server (root / admin / moderator from GET /api/admin/me)
//   * anyone in developer mode: open the game with #admin, or SETTINGS > DEVELOPER MODE (single player)
// Open it from SETTINGS > ADMIN CONTROL, the F10 key, or the /gm chat command.
// Local tools change your own game. REALM SERVER tools call the server's admin API, need a staff
// account, and are audited server-side. Destructive actions ask for confirmation.

const ADMIN = { role: null, owner: false, checked: false, async check() {
  try { if (NET.user && typeof NET.user.isOwner === 'function') this.owner = !!(await NET.user.isOwner()); } catch (e) {}
  try { if (typeof LocalRealm !== 'undefined' && LocalRealm.available && LocalRealm.token) { const r = await LocalRealm.api('/api/admin/me'); this.role = r.role || null; } } catch (e) { this.role = null; }
  this.checked = true;
} };
if (/(^|#|&)admin\b/.test(location.hash)) S.devMode = true;
const adminAllowed = () => !!(S.devMode || ADMIN.owner || ADMIN.role);
const staffRole = () => ADMIN.role;
setTimeout(() => ADMIN.check(), 2500);

const A_ok = (msg) => { SFX.confirm(); toast('ADMIN', String(msg).slice(0, 24), 'pp_xp', 'confirm'); if (typeof chatLog === 'function') chatLog('system', 'ADMIN', msg); };
const needG = () => { if (!G) { say('Load a hero first.'); return false; } return true; };
const confirmThen = (q, fn) => choose(['NO', 'YES, DO IT'], k => { if (k === 1) fn(); }, q);

// ---------------------------------------------------------------- menu tree
// node: { label, value?: () => string, run?: () => void, kids?: () => node[] }
function adminTree() {
  const lvlTo = n => () => { if (!needG()) return; const tgt = Math.max(1, Math.min(LEVEL_CAP, n === 'max' ? LEVEL_CAP : G.lvl + n)); gainXP(G, Math.max(0, xpForLevel(tgt) - G.xp)); const D = derive(G); G.hp = D.hpMax; A_ok(`Level ${G.lvl}`); };
  const gold = n => () => { if (!needG()) return; G.gold += n; A_ok(`+${fmt(n)} gold`); };
  const zonesOf = w => ZONES.filter(z => worldOf(z) === w);
  const worlds = [0].concat(EXPANSIONS.filter(x => x.world).map(x => x.n));
  const regionsIn = w => REGIONS.filter(r => zonesOf(w).some(z => z.region === r.id));
  const gearKid = (kind) => ({ label: kind.toUpperCase(), kids: () => [1, 5, 10, 15, 20, 23].map(t => ({ label: `TIER ${t} ${ITEM_RANKS[t - 1].name}`, kids: () => [1, 2, 3, 4, 5, 6, 7, 8].map(r => ({ label: `${RARITY[r].name}`, run: () => { if (!needG()) return; const it = makeItem({ kind, lvl: ITEM_RANKS[t - 1].min, rarity: r }); addGear(it); A_ok(`Got ${it.name}`); } })) })) });
  const tree = [
    { label: 'PLAYER', kids: () => [
      { label: 'LEVEL', value: () => G ? String(G.lvl) : '-', kids: () => [{ label: '+1 LEVEL', run: lvlTo(1) }, { label: '+10 LEVELS', run: lvlTo(10) }, { label: '+100 LEVELS', run: lvlTo(100) }, { label: 'MAX LEVEL 720', run: lvlTo('max') }] },
      { label: 'GOLD', value: () => G ? fmt(G.gold) : '-', kids: () => [{ label: '+1,000', run: gold(1000) }, { label: '+100,000', run: gold(100000) }, { label: '+10,000,000', run: gold(1e7) }, { label: 'SET TO 0', run: () => { if (needG()) { G.gold = 0; A_ok('Gold reset'); } } }] },
      { label: 'HEAL AND RESTORE', run: () => { if (!needG()) return; longRest(G); G.companions.forEach(longRest); G.ghost = null; A_ok('Fully restored'); } },
      { label: 'GOD MODE', value: () => DBG.god ? 'ON' : 'OFF', run: () => { DBG.god = !DBG.god; A_ok(`God mode ${DBG.god ? 'on' : 'off'}`); } },
      { label: 'NO ENCOUNTERS', value: () => DBG.noEnc ? 'ON' : 'OFF', run: () => { DBG.noEnc = !DBG.noEnc; A_ok(`Encounters ${DBG.noEnc ? 'off' : 'on'}`); } },
      { label: 'GIVE GEAR', kids: () => [gearKid('weapon'), gearKid('armor'), gearKid('wondrous')] },
      { label: 'GIVE MATERIALS', kids: () => [1, 6, 11, 16, 21, 23].map(t => ({ label: `TIER ${t} PACK (x20)`, run: () => { if (!needG()) return; for (const m of MATERIALS.filter(m => m.tier <= t && m.tierMax >= t)) addItem(m.id, 20); A_ok(`Tier ${t} materials`); } })) },
      { label: 'PROFESSIONS', kids: () => [{ label: 'ALL TO 100', run: () => { if (needG()) { for (const k in PROFS) G.prof[k] = Math.max(G.prof[k] || 0, 100); A_ok('Professions 100'); } } }, { label: 'ALL TO 720', run: () => { if (needG()) { for (const k in PROFS) G.prof[k] = PROF_CAP; A_ok('Professions maxed'); } } }, { label: 'LEARN ALL BLUEPRINTS', run: () => { if (needG()) { G.blueprints = RECIPES.map(r => r.id); A_ok(`${RECIPES.length} blueprints`); } } }, { label: 'SMITH PATH: WEAPON', run: () => { if (needG()) { G.smithPath = 'weaponsmith'; A_ok('Weaponsmith'); } } }, { label: 'SMITH PATH: ARMOR', run: () => { if (needG()) { G.smithPath = 'armorsmith'; A_ok('Armorsmith'); } } }] },
      { label: 'COLLECTIONS', kids: () => [{ label: 'ALL 120 MOUNTS', run: () => { if (!needG()) return; G.mounts = MOUNTS.map(m => m.id); G.hasMount = true; G.mount = G.mount || G.mounts[0]; A_ok('All mounts'); } }, { label: 'ALL COMPANIONS', run: () => { if (!needG()) return; for (const d of COMPANION_DEFS) if (companionAvailable(d)) { const g = G.gold; G.gold += d.fee; recruitCompanion(d.id); G.gold = g; } A_ok('All companions'); } }, { label: 'FULL BESTIARY', run: () => { if (!needG()) return; for (const b of BESTIARY) G.bestiary[b.id] = G.bestiary[b.id] || { kills: 1 }; A_ok(`${BESTIARY.length} creatures`); } }, { label: 'ALL WAYPOINTS', run: () => { if (!needG()) return; for (const z of ZONES) { G.waypoints[z.id] = true; G.visited[z.id] = true; } A_ok('All waypoints'); } }, { label: 'ALL ACHIEVEMENTS', run: () => { if (!needG()) return; for (const a of ACHIEVEMENTS) G.ach[a.id] = G.ach[a.id] || Date.now(); A_ok('All achievements'); } }] },
      { label: 'RESET TALENTS & PERKS', run: () => { if (!needG()) return; confirmThen('Refund every profession perk?', () => { for (const k in PROFS) G.profPerks && (G.profPerks[k] = []); A_ok('Perks refunded'); }); } },
    ] },
    { label: 'WORLD', kids: () => [
      { label: 'TELEPORT', kids: () => worlds.map(w => ({ label: worldName(w).slice(0, 18), kids: () => regionsIn(w).map(r => ({ label: r.name.slice(0, 18), value: () => `L${r.lvl[0]}`, kids: () => ZONES.filter(z => z.region === r.id).map(z => ({ label: z.name.slice(0, 18), value: () => `L${z.lvl[0]}`, run: () => { if (!needG()) return; removeAdmin(); G.inst = null; G.waypoints[z.id] = true; travelTo(z.id); A_ok(`Teleported to ${z.name}`); } })) })) })) },
      { label: 'TIME OF DAY', value: () => Clock.override == null ? 'LIVE' : `${Clock.override}:00`, kids: () => [['DAWN', 6], ['NOON', 12], ['DUSK', 18], ['MIDNIGHT', 0], ['LIVE CLOCK', null]].map(([n, h]) => ({ label: n, run: () => { Clock.override = h; A_ok(`Time: ${n}`); } })) },
      { label: 'WEATHER', value: () => S.weather ? 'ON' : 'OFF', run: () => { S.weather = !S.weather; saveSettings(); A_ok(`Weather ${S.weather ? 'on' : 'off'}`); } },
      { label: 'SPAWN ENCOUNTER', kids: () => [{ label: 'NORMAL GROUP', run: () => { if (!needG() || G.inst) return; removeAdmin(); startBattle(rollEncounter(ZONE_BY_ID[G.map], { group: true })); } }, { label: 'COLLECTOR CREATURE', run: () => { if (!needG()) return; const c = CREATURES.filter(c => c.minLvl <= G.lvl + 10); removeAdmin(); startBattle([makeMonster(BEAST_BY_ID[pick(c.length ? c : CREATURES).id], G.lvl, G.difficulty)]); } }, { label: 'WORLD BOSS', run: () => { if (!needG()) return; const b = BOSSES.filter(b => b.cat === 'world'); removeAdmin(); startBattle([makeMonster(pick(b), Math.max(G.lvl, 10), G.difficulty)]); } }] },
      { label: 'RESPAWN NODES & BOSSES', run: () => { if (!needG()) return; G.nodes = {}; G.bossKills = {}; A_ok('World reset'); } },
      { label: 'ENTER INSTANCE', kids: () => [{ label: 'DUNGEONS', kids: () => DUNGEONS.slice(0, 40).map(d => ({ label: d.name.slice(0, 18), value: () => `L${d.lvl}`, run: () => { if (!needG()) return; removeAdmin(); enterInstance('dungeon', d); } })) }, { label: 'RAIDS', kids: () => RAIDS.map(d => ({ label: d.name.slice(0, 18), value: () => `L${d.lvl}`, run: () => { if (!needG()) return; removeAdmin(); enterInstance('raid', d); } })) }] },
    ] },
    { label: 'ECONOMY', kids: () => [
      { label: 'REFRESH NPC MARKET', run: () => { Market._npc = null; A_ok('Market restocked'); } },
      { label: 'SETTLE MY LISTINGS', run: () => { if (!needG()) return; for (const l of G.ah || []) l.steps = -9999; Market.settleLocal(); A_ok('Listings settled'); } },
      { label: 'CLEAR MY LISTINGS', run: () => { if (!needG()) return; confirmThen('Return every offline listing to you?', () => { for (const l of (G.ah || []).splice(0)) { if (l.stack) addItem(l.stack.id, l.stack.n); else addGear(l.item); } A_ok('Listings returned'); }); } },
    ] },
    { label: 'CHAT & BROADCAST', kids: () => [
      { label: 'BROADCAST MESSAGE', run: () => { const msgs = ['Server restart in 10 minutes.', 'Double XP weekend is live!', 'Welcome to the realm, adventurers.', 'The auction house is back online.']; choose(msgs, k => { if (k < 0) return; chatLog('system', 'GM', msgs[k]); if (NET.room && !NET.offline) NET.room.emit('chat', { channel: 'world', text: `[GM] ${msgs[k]}`, zone: '' }).catch(() => {}); A_ok('Broadcast sent'); }, 'Pick a broadcast'); } },
      { label: 'CLEAR CHAT', run: () => { CHAT_UI.entries.length = 0; renderChatLog(); A_ok('Chat cleared'); } },
    ] },
    { label: 'REALM SERVER', value: () => staffRole() ? staffRole().toUpperCase() : 'NO ACCESS', kids: () => realmTree() },
    { label: 'SAVES', kids: () => [
      { label: 'SAVE NOW', run: () => { if (needG()) { saveGame(); A_ok('Saved'); } } },
      { label: 'REPAIR THIS SAVE', run: () => { if (!needG()) return; fixupState(); saveGame(); A_ok('Save repaired'); } },
      { label: 'COPY TO SLOT', kids: () => SLOT_KEYS.map((k, i) => ({ label: `SLOT ${i + 1}`, value: () => (slotInfo(i) ? slotInfo(i).name : 'EMPTY'), run: () => { if (!needG()) return; confirmThen(`Overwrite slot ${i + 1}?`, () => { store.set(k, JSON.parse(JSON.stringify(G))); A_ok(`Copied to slot ${i + 1}`); }); } })) },
      { label: 'WIPE A SLOT', kids: () => SLOT_KEYS.map((k, i) => ({ label: `SLOT ${i + 1}`, value: () => (slotInfo(i) ? slotInfo(i).name : 'EMPTY'), run: () => confirmThen(`Delete slot ${i + 1} forever?`, () => { store.set(k, null); A_ok(`Slot ${i + 1} wiped`); }) })) },
    ] },
    { label: 'GM COMMANDS', kids: () => GM_HELP.map(([cmd, what]) => ({ label: cmd.slice(0, 19), run: () => say([cmd, what]) })) },
    { label: 'OPTIONS', kids: () => [
      { label: 'XP RATE', value: () => `x${S.xpRate || 1}`, run: () => { const o = [1, 2, 5, 10]; S.xpRate = o[(o.indexOf(S.xpRate || 1) + 1) % o.length]; saveSettings(); A_ok(`XP rate x${S.xpRate}`); } },
      { label: 'ENCOUNTER RATE', value: () => `x${S.encRate || 1}`, run: () => { const o = [1, 0.5, 0, 2]; S.encRate = o[(o.indexOf(S.encRate == null ? 1 : S.encRate) + 1) % o.length]; saveSettings(); A_ok(`Encounters x${S.encRate}`); } },
      { label: 'CHAT BUBBLES', value: () => S.bubbles === false ? 'OFF' : 'ON', run: () => { S.bubbles = S.bubbles === false; saveSettings(); A_ok(`Bubbles ${S.bubbles ? 'on' : 'off'}`); } },
      { label: 'SCREEN CHAT', value: () => S.screenChat === false ? 'OFF' : 'ON', run: () => { S.screenChat = S.screenChat === false; saveSettings(); A_ok(`Screen chat ${S.screenChat ? 'on' : 'off'}`); } },
      { label: 'COMBAT LOG', value: () => S.combatLog === false ? 'OFF' : 'ON', run: () => { S.combatLog = S.combatLog === false; saveSettings(); A_ok(`Combat log ${S.combatLog ? 'on' : 'off'}`); } },
      { label: 'UI THEME', value: () => (S.uiTheme || 'sanctum').toUpperCase(), run: () => { S.uiTheme = S.uiTheme === 'classic' ? 'sanctum' : 'classic'; clearCaches(); saveSettings(); A_ok(`Theme ${S.uiTheme}`); } },
      { label: 'BATTLE BG', value: () => (S.battleBg || 'clean').toUpperCase(), run: () => { S.battleBg = S.battleBg === 'painted' ? 'clean' : 'painted'; saveSettings(); A_ok(`Battle bg ${S.battleBg}`); } },
    ] },
    { label: 'DEBUG', kids: () => [
      { label: 'DEBUG PANEL (F9)', run: () => { removeAdmin(); if (DBG.toggle) DBG.toggle(); } },
      { label: 'COLLISION GRID', value: () => DBG.grid ? 'ON' : 'OFF', run: () => { DBG.grid = !DBG.grid; A_ok(`Grid ${DBG.grid ? 'on' : 'off'}`); } },
      { label: 'PROFILER (F3)', value: () => Profiler.on ? 'ON' : 'OFF', run: () => { Profiler.on = !Profiler.on; A_ok(`Profiler ${Profiler.on ? 'on' : 'off'}`); } },
      { label: 'GAME INFO', run: () => say([`${BUILD.game} ${BUILD.version}`, `Zones ${ZONES.length}  Creatures ${BESTIARY.length}`, `Recipes ${RECIPES.length}  Mounts ${MOUNTS.length}`, `Items ${Object.keys(ITEMS).length}  Weapons ${Object.keys(WEAPONS).length}`]) },
      { label: 'DEVELOPER MODE', value: () => S.devMode ? 'ON' : 'OFF', run: () => { S.devMode = !S.devMode; saveSettings(); A_ok(`Developer mode ${S.devMode ? 'on' : 'off'}`); } },
    ] },
  ];
  return tree;
}
// realm server sub-menus (staff API)
function realmTree() {
  if (!(typeof LocalRealm !== 'undefined' && LocalRealm.available)) return [{ label: 'NO REALM SERVER HERE', run: () => say(['Run the realm server and log in with a staff account:', 'node backend/server.cjs', 'then open /admin for the web control plane.']) }];
  if (!staffRole()) return [{ label: 'CHECK MY ACCESS', run: () => ADMIN.check().then(() => say(staffRole() ? `Role: ${staffRole()}` : 'This account has no staff role.')) }];
  const api = (p, opts) => LocalRealm.api(p, opts);
  return [
    { label: 'OVERVIEW', run: () => api('/api/admin/overview').then(o => say(['REALM OVERVIEW'].concat(Object.entries(o).filter(([, v]) => typeof v !== 'object').slice(0, 8).map(([k, v]) => `${k}: ${v}`)))).catch(e => say(String(e.message))) },
    { label: 'PLAYERS', kids: () => (ADMIN._players || []).slice(0, 20).map(p => ({ label: String(p.name).slice(0, 14), value: () => (p.banned ? 'BANNED' : p.role || 'player').toUpperCase().slice(0, 8), kids: () => [
      { label: 'BAN', run: () => confirmThen(`Ban ${p.name}?`, () => api(`/api/admin/players/${p.id}/ban`, { method: 'POST', body: { reason: 'GM action' } }).then(() => A_ok(`${p.name} banned`)).catch(e => say(e.message))) },
      { label: 'UNBAN', run: () => api(`/api/admin/players/${p.id}/unban`, { method: 'POST' }).then(() => A_ok(`${p.name} restored`)).catch(e => say(e.message)) },
      { label: 'MAKE MODERATOR', run: () => api(`/api/admin/players/${p.id}/role`, { method: 'PUT', body: { role: 'moderator' } }).then(() => A_ok('Role set')).catch(e => say(e.message)) },
      { label: 'MAKE PLAYER', run: () => api(`/api/admin/players/${p.id}/role`, { method: 'PUT', body: { role: 'player' } }).then(() => A_ok('Role set')).catch(e => say(e.message)) },
    ] })).concat([{ label: 'RELOAD LIST', run: () => api('/api/admin/players').then(r => { ADMIN._players = r.players || []; A_ok(`${ADMIN._players.length} players`); }).catch(e => say(e.message)) }]) },
    { label: 'REALM SETTINGS', kids: () => Object.entries(ADMIN._settings || {}).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => ({ label: k.toUpperCase().slice(0, 16), value: () => (ADMIN._settings[k] ? 'ON' : 'OFF'), run: () => api('/api/admin/settings', { method: 'PUT', body: { [k]: !ADMIN._settings[k] } }).then(r => { ADMIN._settings = r.settings || Object.assign(ADMIN._settings, { [k]: !ADMIN._settings[k] }); A_ok(`${k} ${ADMIN._settings[k] ? 'on' : 'off'}`); }).catch(e => say(e.message)) })).concat([{ label: 'RELOAD SETTINGS', run: () => api('/api/admin/settings').then(r => { ADMIN._settings = r.settings || r; A_ok('Settings loaded'); }).catch(e => say(e.message)) }]) },
    { label: 'AUDIT LOG', run: () => api('/api/admin/audit?limit=6').then(r => say(['AUDIT LOG (NEWEST)'].concat((r.audit || r.entries || []).slice(0, 6).map(a => `${a.outcome && a.outcome !== 'success' ? '!' : ''}${String(a.action || a.type).replace(/^admin\./, '').slice(0, 12)} ${String(a.actor || a.target || a.by || '').slice(0, 10)}`)))).catch(e => say(e.message)) },
  ];
}

const ADMIN_ICON = { PLAYER: 'ad_player', WORLD: 'ad_world', ECONOMY: 'ad_economy', 'CHAT & BROADCAST': 'ad_chat', 'REALM SERVER': 'ad_realm', SAVES: 'ad_saves', DEBUG: 'ad_debug', 'GM COMMANDS': 'ad_gm', OPTIONS: 'ad_settings' };
// ---------------------------------------------------------------- the console scene
class AdminScene {
  constructor() { this.opaque = true; this.stack = [{ label: 'ADMIN CONTROL', kids: adminTree }]; this.i = [0]; this.top = 0; }
  level() { const n = this.stack[this.stack.length - 1]; return n.kids(); }
  update() {
    const L = this.level(), d = this.stack.length - 1;
    if (P('b')) { SFX.back(); if (d > 0) { this.stack.pop(); this.i.pop(); this.top = 0; } else removeScene(this); return; }
    if (!L.length) return;
    if (nav('up')) { this.i[d] = (this.i[d] + L.length - 1) % L.length; SFX.cursor(); }
    if (nav('down')) { this.i[d] = (this.i[d] + 1) % L.length; SFX.cursor(); }
    if (P('a')) {
      const n = L[this.i[d]]; if (!n) return;
      if (n.kids) { this.stack.push(n); this.i.push(0); this.top = 0; SFX.select(); }
      else if (n.run) { SFX.select(); n.run(); }
    }
  }
  draw() {
    const L = this.level(), d = this.stack.length - 1, sel = Math.min(this.i[d], Math.max(0, L.length - 1));
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    if (IMG.ad_gm) blit(sprFit('ad_gm', 9), 40, 1); textC('ADMIN CONTROL', 84, 1, 'red');
    const crumb = this.stack.slice(1).map(n => n.label.split(' ')[0]).join(' > ') || (staffRole() ? `REALM ${staffRole().toUpperCase()}` : ADMIN.owner ? 'PAGE OWNER' : 'DEVELOPER');
    text(crumb.slice(-25), 3, 13, 'gold');
    if (sel < this.top) this.top = sel; if (sel > this.top + 9) this.top = sel - 9;
    L.slice(this.top, this.top + 10).forEach((n, j) => {
      const i = this.top + j, y = 24 + j * 10;
      if (i === sel) fill(1, y - 1, 158, 10, 1);
      const ic = d === 0 ? ADMIN_ICON[n.label] : null;
      if (ic && IMG[ic]) { blit(sprFit(ic, 8), 3, y); text(n.label.slice(0, 18), 13, y, i === sel ? 'gold' : 3); }
      else text(`${n.kids ? '+' : ' '}${n.label}`.slice(0, 19), 4, y, i === sel ? 'gold' : 3);
      if (n.value) textR(String(n.value()).slice(0, 8), 156, y, 2);
    });
    if (!L.length) textC('NOTHING HERE YET', 80, 60, 2);
    text('A: OPEN/RUN  B: BACK', 4, 134, 1);
  }
}
function openAdmin() { if (!adminAllowed()) { SFX.error(); return say(['Admin control is for the page owner, realm staff,', 'or developer mode (open the game with #admin).']); } push(new AdminScene()); SFX.open(); }
function removeAdmin() { for (const s of scenes.slice()) if (s instanceof AdminScene) removeScene(s); }
// ---------------------------------------------------------------- typed GM commands (/gm <command> ...)
const GM_HELP = [
  ['/gm', 'open the ADMIN CONTROL console'], ['/gm level 50', 'set your level (1-720)'], ['/gm gold 1000', 'add gold'], ['/gm heal', 'restore HP, slots and companions'],
  ['/gm god', 'toggle god mode'], ['/gm noenc', 'toggle random encounters'], ['/gm tp ardenhold', 'teleport to a zone (id or name)'], ['/gm item weapon 10 5', 'make gear: kind, tier 1-23, rarity 1-8'],
  ['/gm mats 11', 'tier materials pack'], ['/gm prof 720', 'set every profession skill'], ['/gm mount all', 'grant all mounts (or a mount id)'], ['/gm time noon', 'dawn noon dusk night live'],
  ['/gm weather', 'toggle weather'], ['/gm spawn boss', 'start a battle: boss, creature or normal'], ['/gm reveal', 'all waypoints and the full map'], ['/gm bestiary', 'record every creature'],
  ['/gm xp 5', 'XP rate multiplier'], ['/gm say text', 'broadcast a GM message'], ['/gm save', 'save now'],
];
function gmCommand(args) {
  if (!adminAllowed()) return chatLog('system', 'GM', 'You do not have GM access. Open the game with #admin for developer mode.');
  const [cmd = '', ...rest] = args, a = rest.join(' '), n = parseInt(rest[0], 10), out = m => { chatLog('system', 'GM', m); SFX.confirm(); };
  if (!cmd) return openAdmin();
  if (cmd === 'help') { GM_HELP.forEach(([c, w]) => chatLog('system', 'GM', `${c} - ${w}`)); return; }
  if (!G && !['time', 'weather', 'xp', 'say'].includes(cmd)) return out('Load a hero first.');
  switch (cmd) {
    case 'level': { const tgt = Math.max(1, Math.min(LEVEL_CAP, n || G.lvl)); if (tgt > G.lvl) gainXP(G, xpForLevel(tgt) - G.xp); return out(`Level ${G.lvl}`); }
    case 'gold': G.gold += Math.max(0, n || 1000); return out(`Gold ${fmt(G.gold)}`);
    case 'heal': longRest(G); G.companions.forEach(longRest); G.ghost = null; return out('Restored');
    case 'god': DBG.god = !DBG.god; return out(`God mode ${DBG.god ? 'on' : 'off'}`);
    case 'noenc': DBG.noEnc = !DBG.noEnc; return out(`Encounters ${DBG.noEnc ? 'off' : 'on'}`);
    case 'tp': { const q = a.toLowerCase(), z = ZONE_BY_ID[q] || ZONES.find(z => z.name.toLowerCase().startsWith(q)) || ZONES.find(z => z.name.toLowerCase().includes(q)); if (!z) return out(`No zone "${a}"`); G.inst = null; G.waypoints[z.id] = true; travelTo(z.id); return out(`Teleported to ${z.name}`); }
    case 'item': { const kind = ['weapon', 'armor', 'wondrous'].includes(rest[0]) ? rest[0] : 'weapon', t = Math.max(1, Math.min(23, +rest[1] || 1)), r = Math.max(1, Math.min(8, +rest[2] || 3)); const it = makeItem({ kind, lvl: ITEM_RANKS[t - 1].min, rarity: r }); addGear(it); return out(`Made ${it.name}`); }
    case 'mats': { const t = Math.max(1, Math.min(23, n || 1)); for (const m of MATERIALS.filter(m => m.tier <= t && m.tierMax >= t)) addItem(m.id, 20); return out(`Tier ${t} materials`); }
    case 'prof': { const v = Math.max(0, Math.min(PROF_CAP, n || PROF_CAP)); for (const k in PROFS) G.prof[k] = v; return out(`Professions ${v}`); }
    case 'mount': { if (rest[0] === 'all') { G.mounts = MOUNTS.map(m => m.id); G.hasMount = true; G.mount = G.mount || G.mounts[0]; return out('All mounts'); } return grantMount(rest[0]) ? out(`Mount ${rest[0]}`) : out(`No mount "${rest[0]}" (or owned)`); }
    case 'time': { const h = { dawn: 6, noon: 12, dusk: 18, night: 0, midnight: 0, live: null }[rest[0]]; Clock.override = h === undefined ? (isNaN(n) ? null : n % 24) : h; return out(`Time ${Clock.override == null ? 'live' : Clock.override + ':00'}`); }
    case 'weather': S.weather = !S.weather; saveSettings(); return out(`Weather ${S.weather ? 'on' : 'off'}`);
    case 'spawn': { const k = rest[0] || 'normal'; let foes; if (k === 'boss') foes = [makeMonster(pick(BOSSES.filter(b => b.cat === 'world')), Math.max(G.lvl, 10), G.difficulty)]; else if (k === 'creature') foes = [makeMonster(BEAST_BY_ID[pick(CREATURES).id], G.lvl, G.difficulty)]; else foes = rollEncounter(ZONE_BY_ID[G.map], { group: true }); startBattle(foes); return out(`Spawned ${k}`); }
    case 'reveal': for (const z of ZONES) { G.waypoints[z.id] = true; G.visited[z.id] = true; } return out('Map revealed');
    case 'bestiary': for (const b of BESTIARY) G.bestiary[b.id] = G.bestiary[b.id] || { kills: 1 }; return out('Bestiary complete');
    case 'xp': S.xpRate = Math.max(1, Math.min(100, n || 1)); saveSettings(); return out(`XP rate x${S.xpRate}`);
    case 'say': if (!a) return out('Use /gm say message'); chatLog('system', 'GM', a); if (NET.room && !NET.offline) NET.room.emit('chat', { channel: 'world', text: `[GM] ${clean(a, 160)}`, zone: '' }).catch(() => {}); return;
    case 'save': saveGame(); return out('Saved');
    default: return out(`Unknown GM command "${cmd}". Try /gm help`);
  }
}
// XP rate option (developer / GM)
{
  const gx0 = gainXP;
  gainXP = function (c, amount) { return gx0(c, c === G && amount > 0 && (S.xpRate || 1) > 1 ? Math.round(amount * S.xpRate) : amount); };
}
// F10 opens the console
addEventListener('keydown', e => { if (e.key === 'F10') { e.preventDefault(); if (!scenes.some(s => s instanceof AdminScene)) openAdmin(); } });
// /gm in chat
{
  const s0 = NET.sendChat.bind(NET);
  NET.sendChat = function (raw) { const m = String(raw || '').trim().match(/^\/(gm|admin)\b\s*(.*)$/i); if (m) return gmCommand(m[2] ? m[2].trim().split(/\s+/).map((x, i) => i ? x : x.toLowerCase()) : []); return s0(raw); };
}
