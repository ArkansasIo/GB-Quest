'use strict';
(() => {
// ================================================================ FRONT END: ACCOUNT & REALM SELECT
// The online front end, in the title menu's style:
//   * LOGIN / CREATE ACCOUNT: name and password fields typed straight into the game screen (a hidden input
//     carries the keyboard, so phones, paste and password managers work). ENTER submits, UP/DOWN/TAB move.
//   * REALM SELECT: region tabs (NA / EU / AP), each realm's type, live population and load, how many of your
//     heroes live there, a SUGGESTED pick, and a details panel with the realm type's rules.
//   * ONLINE (title menu, when a realm server is running) and ACCOUNT (main menu): sign in, choose a realm,
//     change password, cloud saves, log out.
//   * NEW GAME on a realm server: sign in (or play offline) -> choose a realm -> create the hero there.
// Pure helpers are exported as GBQFrontEnd for tests; the game wiring runs only inside the game.

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
function checkCredentials(name, pw, confirm, register) {
  if (!NAME_RE.test(String(name || ''))) return 'Name: 3-16 letters, digits or _.';
  const p = String(pw || '');
  if (p.length < 8 || p.length > 72) return 'Password: 8-72 characters.';
  if (register && p !== String(confirm || '')) return 'Passwords do not match.';
  return null;
}
// a rough strength label for new passwords (length + character classes)
function passwordStrength(pw) {
  const p = String(pw || ''); if (!p) return '';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  const score = (p.length >= 8) + (p.length >= 12) + (p.length >= 16) + Math.max(0, classes - 1);
  return score <= 1 ? 'WEAK' : score <= 3 ? 'FAIR' : 'STRONG';
}
// suggested realm: online, not full, fewest players; ties go to PvE, then list order
function suggestRealm(realms) {
  const ok = (realms || []).filter(r => r.status === 'online' && (r.population || 0) < (r.maxPlayers || 1000));
  return ok.slice().sort((a, b) => (a.population || 0) - (b.population || 0) || (b.type === 'PvE') - (a.type === 'PvE'))[0] || null;
}
const loadOf = r => r.status !== 'online' ? 'OFFLINE' : (r.population || 0) >= (r.maxPlayers || 1000) ? 'FULL' : (r.population || 0) >= (r.maxPlayers || 1000) * 0.75 ? 'HIGH' : (r.population || 0) >= (r.maxPlayers || 1000) * 0.35 ? 'MEDIUM' : 'LOW';
const TYPE_RULES = {
  PvE: ['PvE', 'Monsters and bosses. Players', 'fight each other only when', 'both are flagged.'],
  PvP: ['PvP', 'Open-world PvP in contested', 'zones. Guards protect the', 'capital.'],
  Roleplay: ['ROLEPLAY', 'In-character names and chat.', 'Story events and taverns', 'are busier here.'],
  Seasonal: ['SEASONAL', 'A fresh start each season.', 'Season rewards carry over', 'to your account.'],
};

// Character roster: merge this device's save slots with the account's cloud slots. Each slot shows one hero:
// the same hero in both places is BOTH (the newer copy is loaded); different heroes in one slot show the newer.
//   locals[i]: a save state or null; clouds[i]: { name, lvl, cls, realm, saved } or null
function mergeRoster(locals, clouds, fallbackRealm) {
  const n = Math.max((locals || []).length, (clouds || []).length), out = [];
  for (let i = 0; i < n; i++) {
    const l = locals && locals[i], c = clouds && clouds[i];
    if (!l && !c) { out.push(null); continue; }
    const lr = l ? { name: l.name, lvl: +l.lvl || 1, cls: l.cls, realm: l.realm || fallbackRealm || null, saved: +l.saved || 0, zone: l.map || null } : null;
    const cr = c ? { name: c.name, lvl: +c.lvl || 1, cls: c.cls, realm: c.realm || fallbackRealm || null, saved: +c.saved || 0, zone: null } : null;
    let e;
    if (lr && cr && lr.name === cr.name) e = Object.assign({}, cr.saved > lr.saved ? cr : lr, { where: 'BOTH', newer: cr.saved > lr.saved ? 'cloud' : 'local', zone: lr.zone });
    else if (lr && cr) e = cr.saved > lr.saved ? Object.assign({}, cr, { where: 'CLOUD', newer: 'cloud', hidden: lr.name }) : Object.assign({}, lr, { where: 'LOCAL', newer: 'local', hidden: cr.name });
    else e = Object.assign({}, lr || cr, { where: lr ? 'LOCAL' : 'CLOUD', newer: lr ? 'local' : 'cloud' });
    e.slot = i; out.push(e);
  }
  return out;
}
const rosterOn = (roster, realm) => roster.filter(e => e && e.realm === realm);
const otherRealmCounts = (roster, realm) => roster.reduce((m, e) => { if (e && e.realm !== realm) m[e.realm || '?'] = (m[e.realm || '?'] || 0) + 1; return m; }, {});
// a new hero needs a slot that is empty on this device and in the cloud
const freeSlot = (locals, clouds, n) => { for (let i = 0; i < n; i++) if (!(locals && locals[i]) && !(clouds && clouds[i])) return i; return -1; };

// friends list: online first, then friends on your realm, then by name
function sortFriends(list, myRealm) {
  return [...(list || [])].sort((a, b) => (b.online - a.online) || ((b.realm === myRealm) - (a.realm === myRealm)) || String(a.name).localeCompare(String(b.name)));
}
// "5M AGO", "3H AGO", "2D AGO"; "NOW" under a minute; "-" when unknown
function agoText(ts, now = Date.now()) {
  if (!ts) return '-';
  const m = Math.max(0, Math.floor((now - ts) / 60000));
  if (m < 1) return 'NOW'; if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60); if (h < 48) return `${h}H AGO`;
  return `${Math.floor(h / 24)}D AGO`;
}
// what A does on a friend: whisper needs them online on your realm
function friendActions(f, myRealm) {
  const out = [];
  if (f.online && f.realm === myRealm) out.push('WHISPER');
  out.push('REMOVE FRIEND');
  return out;
}

if (typeof globalThis !== 'undefined') globalThis.GBQFrontEnd = { NAME_RE, checkCredentials, passwordStrength, suggestRealm, loadOf, TYPE_RULES, mergeRoster, rosterOn, otherRealmCounts, freeSlot, sortFriends, agoText, friendActions };

// ---------------------------------------------------------------- game wiring
if (typeof window === 'undefined' || typeof document === 'undefined' || typeof REALMS === 'undefined') return;

const online = () => typeof LocalRealm !== 'undefined' && LocalRealm.available;
const signedIn = () => online() && !!LocalRealm.account;
const REGION_NAMES = { hydaelyn: 'HYDAELYN', lordeon: 'LORDEON', aether: 'AETHER' };
const regionIds = () => Object.keys(typeof REALM_INFO !== 'undefined' ? REALM_INFO : { hydaelyn: 1 });
const realmsIn = rid => (REALM_INFO[rid] ? REALM_INFO[rid].realms : []).map(id => REALMS.find(r => r.id === id)).filter(Boolean);
const backToGame = () => { try { if (typeof LCD !== 'undefined') LCD.focus({ preventScroll: true }); } catch (e) {} };
function screenTitle(t) { fill(0, 0, W, 11, 'rgba(14,12,40,.96)'); fill(0, 10, W, 1, '#e8b94c'); fill(0, 11, W, 1, '#8a5a1c'); textC(t, 80, 1, '#fff3d6'); }
function footer(l, r) { fill(0, 135, W, 9, 0); text(l, 3, 136, 'gold'); if (r) textR(r, 157, 136, 2); }

// ---- text fields on the game screen, typed through one hidden <input>
const Fields = (() => {
  let el = null, owner = null, field = null, focusedAt = 0;
  const get = () => {
    if (el) return el;
    el = document.createElement('input'); el.id = 'gbqTextIn'; el.autocomplete = 'off'; el.spellcheck = false;
    Object.assign(el.style, { position: 'fixed', left: '-1000px', top: '0', width: '1px', height: '1px', opacity: '0' });
    el.addEventListener('keydown', e => {
      if (!owner) return;
      const k = e.key;
      if (k === 'Enter') { e.preventDefault(); owner.onEnter && owner.onEnter(); }
      else if (k === 'Escape') { e.preventDefault(); owner.onEscape && owner.onEscape(); }
      else if (k === 'ArrowDown' || (k === 'Tab' && !e.shiftKey)) { e.preventDefault(); owner.move && owner.move(1, true); }
      else if (k === 'ArrowUp' || (k === 'Tab' && e.shiftKey)) { e.preventDefault(); owner.move && owner.move(-1, true); }
    });
    // the key that moved focus here (e.g. A on a button) must not land in the field: ignore input for a moment
    el.addEventListener('input', () => { if (!field) return; if (performance.now() - focusedAt < 120) { el.value = field.value; return; } let v = el.value; if (field.filter) v = v.replace(field.filter, ''); if (v.length > field.max) v = v.slice(0, field.max); if (v !== el.value) el.value = v; field.value = v; });
    document.body.appendChild(el);
    // a tap on the game while a field is active opens the phone keyboard (focus needs a real user gesture)
    addEventListener('pointerdown', () => { if (field && el) setTimeout(() => el.focus({ preventScroll: true }), 0); }, true);
    return el;
  };
  return {
    // fromInput: moved here from another field (Tab/arrows), so typing can follow at once
    focus(o, f, fromInput) { const i = get(); owner = o; field = f; focusedAt = fromInput ? 0 : performance.now(); i.type = f.secret ? 'password' : 'text'; i.maxLength = f.max; i.autocomplete = f.auto || 'off'; i.value = f.value || ''; try { i.focus({ preventScroll: true }); } catch (e) {} },
    blur(o) { if (owner !== o) return; owner = null; field = null; if (el) { el.blur(); el.value = ''; } backToGame(); },
    active: f => field === f,
  };
})();
const mkField = (label, opts = {}) => ({ label, value: opts.value || '', secret: !!opts.secret, max: opts.max || 16, filter: opts.filter || null, auto: opts.auto || 'off' });

// base for screens with fields and buttons: rows = [{ field } | { button, label }]
class FormScene {
  constructor() { this.opaque = true; this.i = 0; this.msg = ''; this.msgColor = 2; this.busy = false; this.blink = 0; }
  rows() { return []; }
  current() { return this.rows()[this.i]; }
  move(d, fromInput) { const n = this.rows().length; this.i = (this.i + d + n) % n; SFX.cursor(); this.syncFocus(fromInput); }
  syncFocus(fromInput) { const r = this.current(); if (r && r.field) Fields.focus(this, r.field, fromInput); else Fields.blur(this); }
  onEnter() { const r = this.current(); if (r && r.field) { const idx = this.rows().findIndex(x => x.button); if (this.rows().slice(this.i + 1).some(x => x.field)) this.move(1, true); else this.press(this.rows()[idx]); } else this.press(r); }
  onEscape() { Fields.blur(this); this.back(); }
  back() { SFX.back(); Fields.blur(this); removeScene(this); }
  press() {}
  update() {
    this.blink++;
    if (this.busy) return;
    const r = this.current();
    if (r && r.field && !Fields.active(r.field)) Fields.focus(this, r.field);
    if (P('b')) return this.back();
    if (nav('up')) return this.move(-1);
    if (nav('down')) return this.move(1);
    if (P('a') || P('start')) { if (r && !r.field) this.press(r); }
  }
  drawRows(y0) {
    this.rows().forEach((r, k) => {
      const y = y0 + k * 13, sel = k === this.i;
      if (r.field) {
        text(r.field.label, 8, y + 2, sel ? 'gold' : 2);
        fill(62, y, 92, 11, sel ? '#4a3410' : 'rgba(10,8,30,.9)'); ctx.save(); ctx.strokeStyle = sel ? '#ffd875' : '#8a5a1c'; ctx.lineWidth = 1; ctx.strokeRect(62.5, y + .5, 91, 10); ctx.restore();
        const shown = r.field.secret ? '*'.repeat(r.field.value.length) : r.field.value, vis = shown.slice(-14);
        text(vis, 65, y + 1, '#fff3d6');
        if (sel && Fields.active(r.field) && (this.blink >> 4) % 2 === 0) fill(65 + vis.length * 6, y + 2, 1, 7, '#fff3d6');
      } else { if (sel) fill(6, y - 1, 148, 11, 1); text(r.label, 10, y + 1, r.dim ? 1 : 3); }
    });
  }
  drawMsg(y) { if (this.msg) wrap(this.msg, 25).slice(0, 2).forEach((l, i) => textC(l, 80, y + i * 9, this.msgColor)); }
}

class LoginScene extends FormScene {
  // mode 'login' | 'register'; done(account|null) runs after success (null = play offline)
  constructor(mode = 'login', done = null) {
    super(); this.mode = mode; this.done = done;
    let last = ''; try { last = localStorage.getItem('gbq_last_user') || ''; } catch (e) {}
    this.name = mkField('NAME', { value: mode === 'login' ? last : '', filter: /[^A-Za-z0-9_]/g, auto: 'username' });
    this.pw = mkField('PASSWORD', { secret: true, max: 72, auto: mode === 'register' ? 'new-password' : 'current-password' });
    this.pw2 = mkField('CONFIRM', { secret: true, max: 72, auto: 'new-password' });
    this.i = mode === 'login' && last ? 1 : 0;
  }
  rows() {
    const f = [{ field: this.name }, { field: this.pw }];
    if (this.mode === 'register') f.push({ field: this.pw2 });
    return f.concat([{ button: 'submit', label: this.mode === 'register' ? 'CREATE ACCOUNT' : 'LOG IN' }, { button: 'switch', label: this.mode === 'register' ? 'I HAVE AN ACCOUNT' : 'NEW? CREATE ACCOUNT' }, { button: 'offline', label: 'PLAY OFFLINE' }, { button: 'back', label: 'BACK' }]);
  }
  async press(r) {
    if (!r) return;
    if (r.button === 'back') return this.back();
    if (r.button === 'switch') { SFX.page(); this.mode = this.mode === 'login' ? 'register' : 'login'; this.msg = ''; this.i = 0; return this.syncFocus(); }
    if (r.button === 'offline') { SFX.select(); Fields.blur(this); if (typeof NET !== 'undefined' && NET.setMode) NET.setMode('offline'); removeScene(this); return this.done && this.done(null); }
    const why = checkCredentials(this.name.value, this.pw.value, this.pw2.value, this.mode === 'register');
    if (why) { SFX.error(); this.msg = why; this.msgColor = 'red'; return; }
    if (!online()) { SFX.error(); this.msg = (LocalRealm.lastError || 'NO REALM SERVER FOUND') + '. SET ONE IN ONLINE > SERVER ADDRESS.'; this.msgColor = 'red'; return; }
    this.busy = true; this.msg = this.mode === 'register' ? 'CREATING ACCOUNT...' : 'SIGNING IN...'; this.msgColor = 2;
    try {
      const a = this.mode === 'register' ? await LocalRealm.register(this.name.value, this.pw.value) : await LocalRealm.login(this.name.value, this.pw.value);
      try { localStorage.setItem('gbq_last_user', this.name.value); } catch (e) {}
      SFX.confirm(); Fields.blur(this);
      if (typeof NET !== 'undefined' && NET.init) { try { await NET.init(); } catch (e) {} }
      if (typeof ADMIN !== 'undefined' && ADMIN.check) { try { await ADMIN.check(); } catch (e) {} }
      removeScene(this); toast(this.mode === 'register' ? 'ACCOUNT CREATED' : 'WELCOME BACK', String((a && a.name) || this.name.value).toUpperCase(), 'item_key', 'confirm');
      if (this.done) this.done(a);
    } catch (e) { SFX.error(); this.msg = String(e.message || e); this.msgColor = 'red'; this.busy = false; }
  }
  draw() {
    fill(0, 0, W, H, 0); screenTitle(this.mode === 'register' ? 'CREATE ACCOUNT' : 'ACCOUNT LOGIN');
    const info = online() ? LocalRealm.info || {} : null;
    frame(2, 14, 156, 22);
    if (info) { text(String(info.realm || 'REALM SERVER').slice(0, 24), 6, 17, 'gold'); text(`${info.players || 0} ONLINE  ${info.accounts || 0} ACCOUNTS`, 6, 26, 2); }
    else { text('NO REALM SERVER FOUND', 6, 17, 'red'); text('OFFLINE PLAY STILL WORKS', 6, 26, 2); }
    frame(2, 38, 156, 96);
    this.drawRows(43);
    if (this.mode === 'register' && this.pw.value) textR(passwordStrength(this.pw.value), 154, 43 + 13 * 2 + 2 + 13, passwordStrength(this.pw.value) === 'WEAK' ? 'red' : 'green');
    this.drawMsg(this.mode === 'register' ? 124 : 124);
    footer(this.busy ? 'PLEASE WAIT' : 'ENTER:OK TAB:NEXT', 'ESC:BACK');
  }
}

class ChangePasswordScene extends FormScene {
  constructor() { super(); this.cur = mkField('CURRENT', { secret: true, max: 72, auto: 'current-password' }); this.pw = mkField('NEW', { secret: true, max: 72, auto: 'new-password' }); this.pw2 = mkField('CONFIRM', { secret: true, max: 72, auto: 'new-password' }); }
  rows() { return [{ field: this.cur }, { field: this.pw }, { field: this.pw2 }, { button: 'save', label: 'CHANGE PASSWORD' }, { button: 'back', label: 'BACK' }]; }
  async press(r) {
    if (!r) return; if (r.button === 'back') return this.back();
    const why = checkCredentials(LocalRealm.account ? LocalRealm.account.name : 'xxx', this.pw.value, this.pw2.value, true);
    if (why) { SFX.error(); this.msg = why; this.msgColor = 'red'; return; }
    this.busy = true; this.msg = 'SAVING...'; this.msgColor = 2;
    try { await LocalRealm.api('/api/password', { method: 'POST', body: { oldPassword: this.cur.value, newPassword: this.pw.value } }); SFX.confirm(); Fields.blur(this); removeScene(this); toast('PASSWORD CHANGED', 'USE IT NEXT TIME', 'item_key', 'confirm'); }
    catch (e) { SFX.error(); this.msg = String(e.message || e); this.msgColor = 'red'; this.busy = false; }
  }
  draw() {
    fill(0, 0, W, H, 0); screenTitle('CHANGE PASSWORD');
    frame(2, 14, 156, 120); text(`ACCOUNT ${LocalRealm.account ? LocalRealm.account.name : '-'}`.slice(0, 25), 6, 18, 'gold');
    this.drawRows(32);
    if (this.pw.value) textR(passwordStrength(this.pw.value), 154, 32 + 13 + 2 + 13 + 13 + 2, passwordStrength(this.pw.value) === 'WEAK' ? 'red' : 'green');
    this.drawMsg(110);
    footer(this.busy ? 'PLEASE WAIT' : 'ENTER:OK TAB:NEXT', 'ESC:BACK');
  }
}

// ---- SERVER ADDRESS: point a game hosted elsewhere (itch.io, a web host, a local file) at a realm server
class ServerAddressScene extends FormScene {
  constructor(done = null) {
    super(); this.done = done;
    this.addr = mkField('ADDRESS', { value: LocalRealm.savedServerUrl() || LocalRealm.serverUrl(), max: 120, filter: /\s/g, auto: 'url' });
  }
  rows() {
    const r = [{ field: this.addr }, { button: 'connect', label: 'CONNECT' }];
    if (LocalRealm.savedServerUrl()) r.push({ button: 'clear', label: 'FORGET THIS ADDRESS' });
    return r.concat([{ button: 'back', label: 'BACK' }]);
  }
  async press(r) {
    if (!r) return;
    if (r.button === 'back') return this.back();
    const raw = r.button === 'clear' ? '' : this.addr.value;
    if (r.button === 'connect' && !raw.trim()) { SFX.error(); this.msg = 'TYPE THE REALM SERVER ADDRESS'; this.msgColor = 'red'; return; }
    try { LocalRealm.normalizeServerUrl(raw); } catch (e) { SFX.error(); this.msg = e.message; this.msgColor = 'red'; return; }
    this.busy = true; this.msg = raw ? 'LOOKING FOR THE REALM...' : 'FORGETTING ADDRESS...'; this.msgColor = 2;
    const ok = await LocalRealm.setServerUrl(raw);
    this.busy = false;
    if (r.button === 'clear') this.addr.value = '';
    if (ok) {
      SFX.confirm(); Fields.blur(this); removeScene(this);
      toast('REALM FOUND', String((LocalRealm.info && LocalRealm.info.realm) || 'REALM SERVER').toUpperCase().slice(0, 18), 'item_key', 'confirm');
      return this.done && this.done(true);
    }
    if (!raw) { SFX.page(); this.msg = 'ADDRESS FORGOTTEN. OFFLINE PLAY STILL WORKS.'; this.msgColor = 2; this.i = 0; return this.syncFocus(); }
    SFX.error(); this.msg = LocalRealm.lastError || 'NO REALM SERVER FOUND'; this.msgColor = 'red';
  }
  draw() {
    fill(0, 0, W, H, 0); screenTitle('SERVER ADDRESS');
    frame(2, 14, 156, 40);
    text('REALM SERVER ADDRESS, E.G.', 6, 18, 2);
    text('HTTPS://REALM.EXAMPLE.COM', 6, 27, 'gold');
    text('OR LOCALHOST:8787 ON THIS PC', 6, 36, 2);
    text(online() ? 'NOW: ' + (LocalRealm.base ? LocalRealm.base.replace(/^https?:\/\//, '') : 'THIS PAGE') : 'NOW: NOT CONNECTED', 6, 45, online() ? 'green' : 2, 1, 148);
    frame(2, 56, 156, 78);
    this.drawRows(60);
    this.drawMsg(115);
    footer(this.busy ? 'PLEASE WAIT' : 'ENTER:CONNECT', 'ESC:BACK');
  }
}

// ---- REALM SELECT (replaces the older screen everywhere it is opened)
// opts.mode: 'new' (then create a hero) | 'switch' (move the current hero's account) ; opts.next(realmId)
class RealmListScene {
  constructor(opts = {}) {
    this.opaque = true; this.opts = opts; this.mode = opts.mode || ((typeof G !== 'undefined' && G && scenes.some(s => s instanceof Field)) ? 'switch' : 'new');
    const cur = (typeof G !== 'undefined' && G && G.realm) || (online() && LocalRealm.realm) || null;
    this.rid = regionIds().find(r => cur && REALM_INFO[r].realms.includes(cur)) || regionIds()[0];
    this.j = Math.max(0, REALM_INFO[this.rid].realms.indexOf(cur));
    this.busy = false; this.msg = ''; this.loaded = !online(); this.refresh();
  }
  refresh() {
    if (!online()) return;
    LocalRealm.api('/api/realms').then(j => {
      for (const r of (j && j.realms) || []) { const m = REALMS.find(x => x.id === r.id); if (m) Object.assign(m, { population: r.population || 0, status: r.status || m.status, maxPlayers: r.maxPlayers || m.maxPlayers, type: r.type || m.type, characters: r.characters }); }
      this.loaded = true;
    }).catch(() => { this.loaded = true; this.msg = 'COULD NOT REACH THE REALM SERVER'; });
  }
  list() { return realmsIn(this.rid); }
  update() {
    if (this.busy) return;
    const ids = regionIds(), L = this.list();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('left') || nav('right') || P('select')) { const k = ids.indexOf(this.rid), d = nav('left') ? -1 : 1; this.rid = ids[(k + d + ids.length) % ids.length]; this.j = 0; SFX.page(); }
    if (nav('up')) { this.j = (this.j + L.length - 1) % L.length; SFX.cursor(); }
    if (nav('down')) { this.j = (this.j + 1) % L.length; SFX.cursor(); }
    if (P('start')) { const s = suggestRealm(REALMS); if (s) { this.rid = s.regionId || this.rid; this.j = Math.max(0, REALM_INFO[this.rid].realms.indexOf(s.id)); SFX.toggle(); } }
    if (P('a')) { const r = this.list()[this.j]; if (r) this.enter(r); }
  }
  enter(r) {
    if (r.status !== 'online') { SFX.error(); return say(`${r.name} is offline.`); }
    const done = () => {
      this.busy = false;
      window.PENDING_REALM = r.id;
      if (typeof G !== 'undefined' && G && this.mode === 'switch') { G.realm = r.id; saveGame(); if (typeof NET !== 'undefined' && NET.init && signedIn()) NET.init(); removeScene(this); return toast('REALM', `${r.name.toUpperCase()} (${r.type})`, 'px_waypoint', 'confirm'); }
      if (typeof G !== 'undefined' && G) G.realm = r.id;
      if (this.opts.next) return this.opts.next(r.id);
      const AM = window.GBQAelmoorMenus;
      if (typeof CharacterSelectScene === 'function') return push(new CharacterSelectScene(r.id));
      fadeTo(() => { scenes.length = 0; push(AM && AM.AelNewGame ? new AM.AelNewGame() : new SlotPicker('new')); });
    };
    SFX.select();
    if (signedIn()) { this.busy = true; LocalRealm.selectRealm(r.id).then(done).catch(e => { this.busy = false; SFX.error(); say([`${r.name}:`, String(e.message || e)]); }); }
    else done();
  }
  draw() {
    const L = this.list(), r = L[this.j], sug = suggestRealm(REALMS);
    fill(0, 0, W, H, 0); screenTitle('REALM SELECT');
    regionIds().forEach((id, k) => { const x = 2 + k * 52, on = id === this.rid; fill(x, 13, 51, 10, on ? 3 : 'rgba(28,24,62,.92)'); textC(REALM_INFO[id].tag, x + 25, 14, on ? 0 : 2); });
    frame(2, 25, 156, 50);
    text(REGION_NAMES[this.rid] || this.rid.toUpperCase(), 6, 28, 'gold', 1, 64); text('TYPE', 66, 28, 2); text('LOAD', 106, 28, 2); textR('YOU', 154, 28, 2);
    L.forEach((x, k) => {
      const y = 38 + k * 11, sel = k === this.j, ld = x.status === 'online' ? loadOf(x) : 'OFFLINE';
      if (sel) fill(4, y - 1, 152, 10, 1);
      if (sug && sug.id === x.id) text('*', 5, y, 'gold'); text(x.name, 11, y, 3, 1, 64);
      text({ Roleplay: 'RP', Seasonal: 'SEAS' }[x.type] || x.type, 66, y, x.type === 'PvP' ? 'red' : 3);
      text(ld, 106, y, ld === 'LOW' ? 'green' : ld === 'MEDIUM' ? 'gold' : 'red');
      textR(x.characters != null ? String(x.characters) : '-', 154, y, x.characters ? 'gold' : 2);
    });
    frame(2, 77, 156, 57);
    if (r) {
      const rules = TYPE_RULES[r.type] || [r.type];
      text(`${r.name.toUpperCase()}  ${rules[0]}`, 6, 81, 'gold', 1, 154);
      rules.slice(1).forEach((l, i) => text(l, 6, 90 + i * 8, 2, 1, 154));
      const pop = r.population || 0, max = r.maxPlayers || 1000;
      fill(6, 117, 100, 4, 2); fill(6, 117, Math.max(1, Math.round(100 * pop / max)), 4, pop / max >= 0.75 ? 'red' : pop / max >= 0.35 ? 'gold' : 'green');
      textR(online() ? `${pop}/${max}` : 'OFFLINE PLAY', 154, 115, 2);
      if (this.msg || (!this.loaded && online())) text(this.msg || 'LOADING REALMS...', 6, 124, this.msg ? 'red' : 2, 1, 154);
      else text(signedIn() ? `SIGNED IN: ${LocalRealm.account.name}` : online() ? 'NOT SIGNED IN' : 'NO REALM SERVER', 6, 124, signedIn() ? 'green' : 2, 1, 154);
    }
    footer(this.busy ? 'ENTERING...' : 'A:ENTER L/R:REGION', 'ST:BEST');
  }
}

// ---- CHARACTER SELECT: your heroes on the chosen realm (this device + cloud), WoW style
class CharacterSelectScene {
  constructor(realmId) {
    this.opaque = true; this.realm = realmId; this.j = 0; this.busy = false; this.msg = ''; this.cloud = null; this.loaded = !signedIn();
    this.reload();
  }
  locals() { return SLOT_KEYS.map(k => store.get(k)); }
  reload() {
    this.build();
    if (!signedIn()) return;
    LocalRealm.listSaves().then(sl => { this.cloud = sl; this.loaded = true; this.build(); }).catch(e => { this.loaded = true; this.msg = 'CLOUD SAVES UNAVAILABLE'; this.build(); });
  }
  build() {
    const fb = (LocalRealm && LocalRealm.realm) || this.realm;
    this.roster = mergeRoster(this.locals(), this.cloud || [], fb);
    this.heroes = rosterOn(this.roster, this.realm);
    this.others = otherRealmCounts(this.roster, this.realm);
    this.free = freeSlot(this.locals(), this.cloud || [], SLOT_KEYS.length);
    this.j = Math.min(this.j, this.rows().length - 1);
  }
  rows() { return [...this.heroes.map(h => ({ hero: h })), { act: 'CREATE NEW HERO' }, { act: 'CHANGE REALM' }]; }
  realmObj() { return REALMS.find(r => r.id === this.realm) || { name: this.realm, type: '' }; }
  update() {
    if (this.busy) return;
    const R = this.rows();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('up')) { this.j = (this.j + R.length - 1) % R.length; SFX.cursor(); }
    if (nav('down')) { this.j = (this.j + 1) % R.length; SFX.cursor(); }
    const row = R[this.j];
    if (P('select') && row && row.hero) return this.remove(row.hero);
    if (!(P('a') || P('start')) || !row) return;
    if (row.hero) return this.enterWorld(row.hero);
    if (row.act === 'CHANGE REALM') { SFX.back(); return removeScene(this); }
    if (row.act === 'CREATE NEW HERO') {
      if (this.free < 0) { SFX.error(); this.msg = 'ALL 5 SLOTS USED: DELETE ONE'; return; }
      SFX.select(); window.PENDING_REALM = this.realm;
      const AM = window.GBQAelmoorMenus, slot = this.free;
      fadeTo(() => { scenes.length = 0; push(AM && AM.AelNewGame ? new AM.AelNewGame(slot) : new SlotPicker('new')); });
    }
  }
  async enterWorld(h) {
    SFX.select(); this.busy = true; this.msg = 'ENTERING WORLD...';
    try {
      if (h.newer === 'cloud' && signedIn()) await LocalRealm.download(h.slot);
      if (!loadSlot(h.slot)) throw new Error('That save could not be loaded.');
      G.realm = this.realm; saveGame();
      if (h.where === 'LOCAL' && signedIn() && !h.hidden) LocalRealm.upload(h.slot).catch(() => {});
      window.PENDING_REALM = null;
      if (typeof NET !== 'undefined' && NET.init && signedIn()) NET.init().catch(() => {});
      fadeTo(() => { scenes.length = 0; enterWorld(); });
    } catch (e) { this.busy = false; SFX.error(); this.msg = String(e.message || e).toUpperCase().slice(0, 30); }
  }
  remove(h) {
    SFX.select();
    choose(['KEEP', 'DELETE'], async k => {
      if (k !== 1) return;
      try {
        if (h.where !== 'CLOUD') store.del(SLOT_KEYS[h.slot]);
        if (h.where !== 'LOCAL' && signedIn()) await LocalRealm.api(`/api/saves/${h.slot}`, { method: 'DELETE' });
        if (store.get('gbq2_last') === h.slot) store.del('gbq2_last');
        SFX.confirm(); this.msg = `${h.name} DELETED`;
        if (signedIn()) this.cloud = await LocalRealm.listSaves().catch(() => this.cloud);
        this.build();
      } catch (e) { SFX.error(); this.msg = String(e.message || e).toUpperCase().slice(0, 30); }
    }, `Delete ${h.name} (L${h.lvl}) for good? This cannot be undone.`);
  }
  draw() {
    const R = this.rows(), row = R[this.j], realm = this.realmObj();
    fill(0, 0, W, H, 0); screenTitle('CHARACTERS');
    fill(0, 12, W, 10, 'rgba(28,24,62,.92)');
    text(String(realm.name).toUpperCase(), 4, 13, 'gold', 1, 100); textR(realm.type === 'Roleplay' ? 'RP' : String(realm.type || ''), 156, 13, realm.type === 'PvP' ? 'red' : 2);
    frame(2, 24, 156, 66);
    if (!this.loaded) text('LOADING HEROES...', 8, 30, 2);
    R.forEach((r, k) => {
      const y = 28 + k * 10; if (y > 82) return;
      if (k === this.j) fill(4, y - 1, 152, 10, 1);
      if (r.hero) {
        const h = r.hero, c = (typeof CLASSES !== 'undefined' && CLASSES[h.cls]) ? CLASSES[h.cls].name : String(h.cls || '').toUpperCase();
        text(h.name, 7, y, 3, 1, 56); text(c, 64, y, 2, 1, 56); textR(`L${h.lvl}`, 140, y, 'gold');
        text(h.where === 'BOTH' ? '=' : h.where === 'CLOUD' ? '^' : '.', 147, y, h.where === 'LOCAL' ? 2 : 'green');
      } else text(r.act, 7, y, k === this.j ? 3 : r.act === 'CREATE NEW HERO' ? (this.free < 0 ? 2 : 'green') : 3);
    });
    frame(2, 92, 156, 42);
    if (row && row.hero) {
      const h = row.hero, z = h.zone && typeof ZONE_BY_ID !== 'undefined' && ZONE_BY_ID[h.zone] ? ZONE_BY_ID[h.zone].name : null;
      text(`SLOT ${h.slot + 1}  ${h.where === 'BOTH' ? 'DEVICE + CLOUD' : h.where === 'CLOUD' ? 'CLOUD ONLY' : 'THIS DEVICE'}`, 6, 96, 'gold', 1, 150);
      text(z ? String(z).toUpperCase() : (h.where === 'CLOUD' ? 'DOWNLOADS ON ENTER' : '-'), 6, 105, 2, 1, 150);
      text(h.saved ? `SAVED ${new Date(h.saved).toLocaleDateString()}` : 'NOT SAVED YET', 6, 114, 2, 1, 150);
      if (h.hidden) text(`REPLACES ${h.hidden} IN SLOT`, 6, 123, 'red', 1, 150);
    } else {
      const o = Object.entries(this.others), on = o.reduce((a, [, n]) => a + n, 0);
      text(row && row.act === 'CREATE NEW HERO' ? (this.free < 0 ? 'NO FREE SLOT' : `NEW HERO IN SLOT ${this.free + 1}`) : 'PICK ANOTHER REALM', 6, 96, 'gold', 1, 150);
      text(`HERE ${this.heroes.length}  OTHER REALMS ${on}`, 6, 105, 2, 1, 150);
      o.slice(0, 2).forEach(([id, n], i) => { const r = REALMS.find(x => x.id === id); text(`${r ? r.name.toUpperCase() : id}: ${n}`, 6, 114 + i * 9, 2, 1, 150); });
    }
    if (this.msg) { fill(4, 124, 152, 9, 0); text(this.msg, 6, 125, /DELETED|ENTERING/.test(this.msg) ? 'green' : 'red', 1, 150); }
    footer(this.busy ? 'PLEASE WAIT' : (row && row.hero ? 'A:PLAY SEL:DELETE' : 'A:SELECT'), 'B:BACK');
  }
}

// ---- FRIENDS: account friends across every realm, with requests; updates live from the realm server
class AddFriendScene extends FormScene {
  constructor(done) { super(); this.done = done; this.name = mkField('NAME', { max: 16, filter: /[^A-Za-z0-9_]/g }); }
  rows() { return [{ field: this.name }, { button: 'send', label: 'SEND REQUEST' }, { button: 'back', label: 'BACK' }]; }
  async press(r) {
    if (!r) return; if (r.button === 'back') return this.back();
    const n = this.name.value.trim();
    if (!NAME_RE.test(n)) { SFX.error(); this.msg = 'ACCOUNT NAMES ARE 3-16 LETTERS, NUMBERS OR _'; this.msgColor = 'red'; return; }
    if (LocalRealm.account && n.toLowerCase() === String(LocalRealm.account.name).toLowerCase()) { SFX.error(); this.msg = 'THAT IS YOU'; this.msgColor = 'red'; return; }
    this.busy = true; this.msg = 'SENDING...'; this.msgColor = 2;
    try {
      const res = await LocalRealm.requestFriend(n);
      SFX.confirm(); Fields.blur(this); removeScene(this);
      toast(res.accepted ? 'NEW FRIEND' : 'REQUEST SENT', n.toUpperCase(), 'item_scroll', 'confirm');
      if (this.done) this.done();
    } catch (e) { SFX.error(); this.msg = String(e.message || e).toUpperCase(); this.msgColor = 'red'; this.busy = false; }
  }
  draw() {
    fill(0, 0, W, H, 0); screenTitle('ADD FRIEND');
    frame(2, 14, 156, 120);
    wrap('TYPE THEIR ACCOUNT NAME (THE NAME THEY SIGN IN WITH), NOT A HERO NAME.', 25).slice(0, 3).forEach((l, i) => text(l, 6, 18 + i * 9, 2));
    this.drawRows(52);
    this.drawMsg(100);
    footer(this.busy ? 'PLEASE WAIT' : 'ENTER:SEND', 'ESC:BACK');
  }
}

class FriendsScene {
  constructor() {
    this.opaque = true; this.tab = 0; this.j = 0; this.top = 0; this.data = null; this.msg = ''; this.t = 0;
    this.onEvent = () => this.refresh();
    window.addEventListener('gbq-friends', this.onEvent);
    this.refresh();
  }
  myRealm() { return (typeof G !== 'undefined' && G && G.realm) || LocalRealm.realm || null; }
  async refresh() {
    if (!signedIn()) { this.msg = 'SIGN IN TO USE FRIENDS'; return; }
    try { this.data = await LocalRealm.friends(); this.msg = ''; } catch (e) { this.msg = String(e.message || e).toUpperCase().slice(0, 30); }
    this.j = Math.min(this.j, Math.max(0, this.rows().length - 1));
  }
  close() { window.removeEventListener('gbq-friends', this.onEvent); SFX.back(); removeScene(this); }
  rows() {
    const d = this.data || { friends: [], requests: [], sent: [] };
    if (this.tab === 0) return [{ act: 'ADD FRIEND' }, ...sortFriends(d.friends, this.myRealm()).map(f => ({ friend: f }))];
    return [...(d.requests || []).map(f => ({ incoming: f })), ...(d.sent || []).map(f => ({ sent: f }))];
  }
  realmName(id) { const r = (typeof REALMS !== 'undefined' ? REALMS : []).find(x => x.id === id); return r ? r.name : (id || '-'); }
  update() {
    this.t++;
    if (this.t % 900 === 0) this.refresh(); // every 15 s: hero names and levels change without an event
    if (P('b')) return this.close();
    if (nav('left') || nav('right')) { this.tab = 1 - this.tab; this.j = 0; this.top = 0; SFX.cursor(); }
    const R = this.rows(); if (!R.length) return;
    if (nav('up')) { this.j = (this.j + R.length - 1) % R.length; SFX.cursor(); }
    if (nav('down')) { this.j = (this.j + 1) % R.length; SFX.cursor(); }
    if (this.j < this.top) this.top = this.j; if (this.j >= this.top + 7) this.top = this.j - 6;
    if (!(P('a') || P('start'))) return;
    const r = R[this.j]; SFX.select();
    if (r.act) return push(new AddFriendScene(() => this.refresh()));
    const act = (fn, ok) => fn().then(() => { toast(ok[0], ok[1], 'item_scroll', 'confirm'); this.refresh(); }).catch(e => { SFX.error(); this.msg = String(e.message || e).toUpperCase().slice(0, 30); });
    if (r.incoming) return choose(['ACCEPT', 'DECLINE'], k => {
      if (k === 0) act(() => LocalRealm.acceptFriend(r.incoming.id), ['NEW FRIEND', r.incoming.name.toUpperCase()]);
      if (k === 1) act(() => LocalRealm.removeFriend(r.incoming.id), ['DECLINED', r.incoming.name.toUpperCase()]);
    }, `FRIEND REQUEST FROM ${r.incoming.name}`);
    if (r.sent) return choose(['CANCEL REQUEST', 'KEEP'], k => { if (k === 0) act(() => LocalRealm.removeFriend(r.sent.id), ['CANCELLED', r.sent.name.toUpperCase()]); }, `REQUEST TO ${r.sent.name}`);
    const f = r.friend, acts = friendActions(f, this.myRealm());
    choose(acts.concat(['BACK']), k => {
      const a = acts[k];
      if (a === 'WHISPER') {
        if (typeof cbWhisper === 'function') { this.close(); cbWhisper((f.hero && f.hero.name) || f.name); }
        else say(`WHISPER: TYPE /w ${(f.hero && f.hero.name) || f.name} IN CHAT`);
      }
      if (a === 'REMOVE FRIEND') choose(['KEEP', 'REMOVE'], c => { if (c === 1) act(() => LocalRealm.removeFriend(f.id), ['FRIEND REMOVED', f.name.toUpperCase()]); }, `Remove ${f.name} from your friends?`);
    }, f.name);
  }
  draw() {
    const d = this.data || { friends: [], requests: [], sent: [] }, R = this.rows(), row = R[this.j], me = this.myRealm();
    const on = (d.friends || []).filter(f => f.online).length, inc = (d.requests || []).length;
    fill(0, 0, W, H, 0); screenTitle('FRIENDS');
    // tabs
    [[`FRIENDS ${on}/${(d.friends || []).length}`, 0], [`REQUESTS${inc ? ' ' + inc : ''}`, 1]].forEach(([l, k]) => {
      const x = k ? 81 : 2; fill(x, 12, 77, 10, this.tab === k ? '#4a3410' : 'rgba(28,24,62,.92)');
      textC(l, x + 38, 13, this.tab === k ? 'gold' : (k && inc ? 'green' : 2));
    });
    frame(2, 24, 156, 76);
    if (!this.data) text(this.msg || 'LOADING...', 8, 30, this.msg ? 'red' : 2);
    else if (!R.length) wrap(this.tab ? 'NO FRIEND REQUESTS.' : '', 25).forEach((l, i) => text(l, 8, 30 + i * 9, 2));
    R.slice(this.top, this.top + 7).forEach((r, i) => {
      const k = this.top + i, y = 28 + i * 10, sel = k === this.j;
      if (sel) fill(4, y - 1, 152, 10, 1);
      if (r.act) return text(r.act, 8, y, sel ? 3 : 'green');
      if (r.friend) {
        const f = r.friend; fill(7, y + 2, 4, 4, f.online ? '#58d858' : '#5a5a6a');
        // account names are up to 16 letters: the full name, then the level if they are playing; realm is in the panel
        text(f.name, 14, y, f.online ? (f.realm === me || sel ? 3 : 'gold') : 2, 1, 112);
        if (f.online && f.hero && f.hero.lvl) textR(`L${f.hero.lvl}`, 154, y, sel ? 3 : 2);
      } else {
        const f = r.incoming || r.sent;
        text(r.incoming ? 'FROM' : 'TO', 8, y, r.incoming ? (sel ? 3 : 'green') : 2); text(f.name, 36, y, 3, 1, 90);
        textR(r.incoming ? 'A:ANSWER' : 'PENDING', 154, y, 2);
      }
    });
    if (R.length > 7) textR(`${this.j + 1}/${R.length}`, 154, 92, 2);
    frame(2, 102, 156, 32);
    if (row && row.friend) {
      const f = row.friend;
      text(f.online ? `ONLINE ON ${this.realmName(f.realm).toUpperCase()}` : `OFFLINE  SEEN ${agoText(f.lastSeen)}`, 6, 106, f.online ? 'green' : 2, 1, 150);
      if (!f.online) text(`REALM ${this.realmName(f.realm).toUpperCase()}`, 6, 115, 2, 1, 150);
      if (f.hero) text(`${f.hero.name}${f.hero.cls && typeof CLASSES !== 'undefined' && CLASSES[f.hero.cls] ? '  ' + CLASSES[f.hero.cls].name : ''}`.toUpperCase(), 6, 115, 3, 1, 150);
      text(f.online && f.realm !== me ? 'ANOTHER REALM: NO WHISPERS' : f.online ? 'A: WHISPER OR REMOVE' : 'A: REMOVE', 6, 124, 2, 1, 150);
    } else if (row && row.act) {
      text(`${(d.friends || []).length}/${d.limit || 100} FRIENDS`, 6, 106, 'gold'); text('ADD BY ACCOUNT NAME.', 6, 115, 2); text('GOLD NAME: ANOTHER REALM', 6, 124, 2, 1, 150);
    } else if (row) {
      text(row.incoming ? 'WANTS TO BE YOUR FRIEND' : 'WAITING FOR AN ANSWER', 6, 106, 'gold', 1, 150);
      text(row.incoming ? 'A: ACCEPT OR DECLINE' : 'A: CANCEL REQUEST', 6, 115, 2);
    }
    if (this.msg && this.data) { fill(4, 124, 152, 9, 0); text(this.msg, 6, 125, 'red', 1, 150); }
    footer('A:SELECT L/R:TAB', 'B:BACK');
  }
}

// ---- ONLINE / ACCOUNT hub
class OnlineHubScene {
  constructor() { this.opaque = true; this.i = 0; this.me = null; this.saves = null; this.refresh(); }
  async refresh() {
    if (!signedIn()) return;
    try { this.me = await LocalRealm.me(); } catch (e) { this.me = null; }
    try { this.saves = await LocalRealm.listSaves(); } catch (e) { this.saves = null; }
  }
  opts() {
    if (!online()) return ['RETRY', 'SERVER ADDRESS', 'BACK'];
    if (!signedIn()) return ['LOG IN', 'CREATE ACCOUNT', 'SERVER ADDRESS', 'BACK'];
    return ['CHARACTERS', 'FRIENDS', 'CHOOSE REALM', 'CLOUD SAVES', 'CHANGE PASSWORD', 'LOG OUT', 'BACK'];
  }
  update() {
    const o = this.opts(); this.i = Math.min(this.i, o.length - 1);
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('up')) { this.i = (this.i + o.length - 1) % o.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % o.length; SFX.cursor(); }
    if (!P('a')) return;
    const c = o[this.i]; SFX.select();
    if (c === 'BACK') return removeScene(this);
    if (c === 'RETRY') { if (LocalRealm.detect) LocalRealm.detect(true).then(ok => { if (ok && typeof NET !== 'undefined' && NET.init) NET.init().catch(() => {}); this.refresh(); }); return; }
    if (c === 'SERVER ADDRESS') return push(new ServerAddressScene(() => this.refresh()));
    if (c === 'LOG IN' || c === 'CREATE ACCOUNT') return push(new LoginScene(c === 'LOG IN' ? 'login' : 'register', () => this.refresh()));
    if (c === 'CHARACTERS') return push(new CharacterSelectScene((typeof G !== 'undefined' && G && G.realm) || LocalRealm.realm || (REALMS[0] && REALMS[0].id)));
    if (c === 'FRIENDS') return push(new FriendsScene());
    if (c === 'CHOOSE REALM') return push(new RealmListScene());
    if (c === 'CLOUD SAVES' && typeof AccountScene === 'function') return push(new AccountScene());
    if (c === 'CHANGE PASSWORD') return push(new ChangePasswordScene());
    if (c === 'LOG OUT') return choose(['LOG OUT', 'STAY'], async k => { if (k !== 0) return; await LocalRealm.logout(); if (typeof NET !== 'undefined') { NET.room = null; NET.peers = []; } this.me = null; this.saves = null; toast('LOGGED OUT', 'SEE YOU SOON', 'item_key', 'close'); }, 'Log out of this realm server?');
  }
  draw() {
    fill(0, 0, W, H, 0); screenTitle('ONLINE');
    frame(2, 14, 156, 42);
    if (!online()) { text(String(LocalRealm.lastError || 'NO REALM SERVER FOUND').slice(0, 25), 6, 18, 'red'); text(LocalRealm.base ? LocalRealm.base.replace(/^https?:\/\//, '').slice(0, 25) : 'SET A SERVER ADDRESS BELOW,', 6, 28, 2); text(LocalRealm.base ? 'CHECK THE SERVER IS RUNNING.' : 'OR OPEN THE GAME FROM THE', 6, 37, 2); text(LocalRealm.base ? 'OFFLINE PLAY STILL WORKS.' : 'REALM SERVER ITSELF.', 6, 46, 2); }
    else if (!signedIn()) { const info = LocalRealm.info || {}; text(String(info.realm || 'REALM SERVER').slice(0, 24), 6, 18, 'gold'); text(`${info.players || 0} ONLINE  ${info.accounts || 0} ACCOUNTS`, 6, 28, 2); text('SIGN IN TO KEEP YOUR HEROES', 6, 38, 3); text('ON THE SERVER.', 6, 47, 3); }
    else {
      const a = LocalRealm.account, realm = REALMS.find(r => r.id === (LocalRealm.realm || (this.me && this.me.account && this.me.account.realm)));
      text(`SIGNED IN: ${a.name}`.slice(0, 25), 6, 18, 'green');
      text(`REALM ${realm ? realm.name.toUpperCase() + ' (' + realm.type + ')' : '-'}`.slice(0, 25), 6, 28, 3);
      const n = this.saves ? this.saves.filter(Boolean).length : null;
      text(`CLOUD HEROES ${n == null ? '-' : n + '/' + this.saves.length}`, 6, 38, 2);
      text(this.me && this.me.role && this.me.role !== 'player' ? `ROLE ${String(this.me.role).toUpperCase()}` : `ACCOUNT ID ${String(a.uid || a.id || '').slice(0, 12)}`, 6, 47, 2);
    }
    const o = this.opts(), gap = o.length > 6 ? 10 : 12; o.forEach((c, k) => { const y = 60 + k * gap; if (k === this.i) fill(4, y - 1, 152, gap - 1, 1); text(c, 10, y + (gap > 10 ? 1 : 0), 3); });
    footer('A:SELECT', 'B:BACK');
  }
}
Object.assign(window, { LoginScene, ChangePasswordScene, ServerAddressScene, RealmListScene, CharacterSelectScene, AddFriendScene, FriendsScene, OnlineHubScene });

// the start-up check for a realm server can time out while the page is still loading; keep looking every few
// seconds until one answers, then switch the game to it (also covers starting the server after the page)
// A 404/405 from /api/health means this host has no realm server at all (e.g. a static web host), so stop.
if (typeof LocalRealm !== 'undefined' && (LocalRealm.serverUrl() || (/^https?:$/.test(location.protocol) && !window.GBQ_STATIC_HOST))) {
  let tries = 0;
  const poll = setInterval(() => {
    if (LocalRealm.available || LocalRealm.noServer || ++tries > 60) return clearInterval(poll);
    LocalRealm.detect().then(ok => { if (ok) { clearInterval(poll); if (typeof NET !== 'undefined' && NET.init && NET.transport !== 'server') NET.init().catch(() => {}); } }).catch(() => {});
  }, 4000);
}

// every place that opened the old realm screen now gets the new one
if (typeof RealmSelect !== 'undefined') RealmSelect = RealmListScene; // eslint-disable-line no-global-assign

// new heroes start on the realm chosen in REALM SELECT
if (typeof newGameState === 'function') { const ng0 = newGameState; newGameState = function () { const g = ng0.apply(this, arguments); if (g && window.PENDING_REALM) g.realm = window.PENDING_REALM; return g; }; }

// title menu: ONLINE entry when a realm server is running; NEW GAME goes through sign-in and realm select
if (typeof Title !== 'undefined') {
  const o0 = Title.prototype.opts;
  Title.prototype.opts = function () { const o = o0.apply(this, arguments); if (online() && !o.includes('ONLINE')) o.splice(Math.max(0, o.indexOf('OPTIONS')), 0, 'ONLINE'); return o; };
  const u0 = Title.prototype.update;
  Title.prototype.update = function () {
    if ((P('a') || P('start')) && !(typeof titleLoading === 'function' && titleLoading())) {
      const c = this.opts()[this.i];
      if (c === 'ONLINE') { SFX.select(); return push(new OnlineHubScene()); }
      if (c === 'NEW GAME' && online()) {
        SFX.select();
        const realms = () => push(new RealmListScene({ mode: 'new' }));
        const AM = window.GBQAelmoorMenus, offline = () => { window.PENDING_REALM = null; push(AM && AM.AelNewGame ? new AM.AelNewGame() : new SlotPicker('new')); };
        return signedIn() ? realms() : push(new LoginScene('login', a => a ? realms() : offline()));
      }
    }
    return u0.apply(this, arguments);
  };
}
// the account page's LOG IN / CREATE ACCOUNT use the in-game form instead of the HTML pop-up
if (typeof AccountScene !== 'undefined') {
  const r0 = AccountScene.prototype.run;
  AccountScene.prototype.run = async function (o) {
    if (o === 'LOG IN' || o === 'CREATE ACCOUNT') return push(new LoginScene(o === 'LOG IN' ? 'login' : 'register', () => { this.msg = 'SIGNED IN'; this.refresh && this.refresh(); }));
    return r0.apply(this, arguments);
  };
}
if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('SETTINGS'); L.splice(at >= 0 ? at : L.length, 0, 'ACCOUNT'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'ACCOUNT') { SFX.select(); return push(new OnlineHubScene()); } return u0.apply(this, arguments); };
}
window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { ACCOUNT: 'Sign in, choose a realm, cloud saves, change password.' });
})();
