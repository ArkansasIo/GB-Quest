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

if (typeof globalThis !== 'undefined') globalThis.GBQFrontEnd = { NAME_RE, checkCredentials, passwordStrength, suggestRealm, loadOf, TYPE_RULES };

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
    if (!online()) { SFX.error(); this.msg = 'No realm server here. Start start-realm-server.bat.'; this.msgColor = 'red'; return; }
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

// ---- ONLINE / ACCOUNT hub
class OnlineHubScene {
  constructor() { this.opaque = true; this.i = 0; this.me = null; this.saves = null; this.refresh(); }
  async refresh() {
    if (!signedIn()) return;
    try { this.me = await LocalRealm.me(); } catch (e) { this.me = null; }
    try { this.saves = await LocalRealm.listSaves(); } catch (e) { this.saves = null; }
  }
  opts() {
    if (!online()) return ['RETRY', 'BACK'];
    if (!signedIn()) return ['LOG IN', 'CREATE ACCOUNT', 'BACK'];
    return ['CHOOSE REALM', 'CLOUD SAVES', 'CHANGE PASSWORD', 'LOG OUT', 'BACK'];
  }
  update() {
    const o = this.opts(); this.i = Math.min(this.i, o.length - 1);
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('up')) { this.i = (this.i + o.length - 1) % o.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % o.length; SFX.cursor(); }
    if (!P('a')) return;
    const c = o[this.i]; SFX.select();
    if (c === 'BACK') return removeScene(this);
    if (c === 'RETRY') { if (LocalRealm.detect) LocalRealm.detect().then(() => this.refresh()); return; }
    if (c === 'LOG IN' || c === 'CREATE ACCOUNT') return push(new LoginScene(c === 'LOG IN' ? 'login' : 'register', () => this.refresh()));
    if (c === 'CHOOSE REALM') return push(new RealmListScene());
    if (c === 'CLOUD SAVES' && typeof AccountScene === 'function') return push(new AccountScene());
    if (c === 'CHANGE PASSWORD') return push(new ChangePasswordScene());
    if (c === 'LOG OUT') return choose(['LOG OUT', 'STAY'], async k => { if (k !== 0) return; await LocalRealm.logout(); if (typeof NET !== 'undefined') { NET.room = null; NET.peers = []; } this.me = null; this.saves = null; toast('LOGGED OUT', 'SEE YOU SOON', 'item_key', 'close'); }, 'Log out of this realm server?');
  }
  draw() {
    fill(0, 0, W, H, 0); screenTitle('ONLINE');
    frame(2, 14, 156, 42);
    if (!online()) { text('NO REALM SERVER FOUND', 6, 18, 'red'); text('RUN START-REALM-SERVER.BAT', 6, 28, 2); text('AND OPEN :8787 TO PLAY', 6, 37, 2); text('ONLINE. OFFLINE STILL WORKS.', 6, 46, 2); }
    else if (!signedIn()) { const info = LocalRealm.info || {}; text(String(info.realm || 'REALM SERVER').slice(0, 24), 6, 18, 'gold'); text(`${info.players || 0} ONLINE  ${info.accounts || 0} ACCOUNTS`, 6, 28, 2); text('SIGN IN TO KEEP YOUR HEROES', 6, 38, 3); text('ON THE SERVER.', 6, 47, 3); }
    else {
      const a = LocalRealm.account, realm = REALMS.find(r => r.id === (LocalRealm.realm || (this.me && this.me.account && this.me.account.realm)));
      text(`SIGNED IN: ${a.name}`.slice(0, 25), 6, 18, 'green');
      text(`REALM ${realm ? realm.name.toUpperCase() + ' (' + realm.type + ')' : '-'}`.slice(0, 25), 6, 28, 3);
      const n = this.saves ? this.saves.filter(Boolean).length : null;
      text(`CLOUD HEROES ${n == null ? '-' : n + '/' + this.saves.length}`, 6, 38, 2);
      text(this.me && this.me.role && this.me.role !== 'player' ? `ROLE ${String(this.me.role).toUpperCase()}` : `ACCOUNT ID ${String(a.uid || a.id || '').slice(0, 12)}`, 6, 47, 2);
    }
    this.opts().forEach((c, k) => { const y = 62 + k * 12; if (k === this.i) fill(4, y - 1, 152, 11, 1); text(c, 10, y + 1, 3); });
    footer('A:SELECT', 'B:BACK');
  }
}
Object.assign(window, { LoginScene, ChangePasswordScene, RealmListScene, OnlineHubScene });

// the start-up check for a realm server can time out while the page is still loading; keep looking every few
// seconds until one answers, then switch the game to it (also covers starting the server after the page)
if (typeof LocalRealm !== 'undefined' && /^https?:$/.test(location.protocol)) {
  let tries = 0;
  const poll = setInterval(() => {
    if (LocalRealm.available || ++tries > 60) return clearInterval(poll);
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
