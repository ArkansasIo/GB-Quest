// ================================================================ IDENTITY: account name, account UID, player ID, username
//   ACCOUNT    name + a 9-digit UID (100000000-999999999), e.g. ACCOUNT ID 482-913-057
//              realm server account -> the server's UID; Claude sign-in -> a UID derived from the sign-in id;
//              offline -> a device account created on first run (rename it in TITLE > ACCOUNT)
//   CHARACTER  every hero has its own 9-digit PLAYER ID and a USERNAME (NAME#1234), and remembers the
//              account UID that created it. Old saves get theirs when loaded.
//   SHOWN IN   TITLE > ACCOUNT (account card + the heroes in each slot), CHARACTER SHEET, /id, /who,
//              presence (player ID only; the account UID is never sent to other players)
const UID_MIN = 100000000, UID_SPAN = 900000000;
const fmtUid = n => { const s = String(n || 0).padStart(9, '0'); return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`; };
const validUid = n => Number.isInteger(n) && n >= UID_MIN && n < UID_MIN + UID_SPAN;
function randomUid() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return UID_MIN + a[0] % UID_SPAN; } catch (e) { return UID_MIN + Math.floor(Math.random() * UID_SPAN); }
}
function uidFromString(s) { // stable FNV-1a hash -> 9 digits
  let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return UID_MIN + h % UID_SPAN;
}
const DeviceAccount = {
  data: null,
  get() {
    if (this.data) return this.data;
    try { this.data = JSON.parse(localStorage.getItem('gbq.deviceAccount') || 'null'); } catch (e) { this.data = null; }
    if (!this.data || !validUid(this.data.uid)) { this.data = { uid: randomUid(), name: 'ADVENTURER', created: Date.now() }; this.save(); }
    return this.data;
  },
  save() { try { localStorage.setItem('gbq.deviceAccount', JSON.stringify(this.data)); } catch (e) {} },
  rename(n) { const v = String(n || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16); if (v.length < 3) return false; this.get().name = v; this.save(); return true; },
};
// the account this session plays under
function currentAccount() {
  const ra = typeof LocalRealm !== 'undefined' && LocalRealm.account;
  if (ra) return { kind: 'REALM', name: String(ra.name || 'PLAYER').toUpperCase(), uid: validUid(ra.uid) ? ra.uid : uidFromString(ra.id || ra.name) };
  if (!NET.offline && NET.db && NET.myId) return { kind: 'CLAUDE', name: 'CLAUDE PLAYER', uid: uidFromString(NET.myId) };
  const d = DeviceAccount.get(); return { kind: 'DEVICE', name: d.name, uid: d.uid };
}
function slotHeroes() {
  const out = [];
  for (let i = 0; i < 3; i++) { let s = null; try { s = store.get(SLOT_KEYS[i]); } catch (e) {} out.push(s); }
  return out;
}
// give a hero its IDs (new heroes and old saves)
function ensureIdentity(g) {
  if (!g) return g;
  const others = slotHeroes().filter((s, i) => s && i !== g.slot);
  const usedP = new Set(others.map(s => s.pid)), usedT = new Set(others.map(s => s.username));
  if (!validUid(g.pid)) { let p; do p = randomUid(); while (usedP.has(p)); g.pid = p; }
  const base = String(g.name || 'HERO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'HERO';
  if (!g.username || !g.username.startsWith(base + '#')) { let t; do t = `${base}#${1000 + (randomUid() % 9000)}`; while (usedT.has(t)); g.username = t; }
  if (!validUid(g.acct)) g.acct = currentAccount().uid;
  return g;
}
{
  const ng0 = newGameState;
  newGameState = function (o) { return ensureIdentity(ng0(o)); };
  const fx0 = fixupState;
  fixupState = function () { const r = fx0.apply(this, arguments); ensureIdentity(G); return r; };
}

// ---------------------------------------------------------------- account card on TITLE > ACCOUNT
function renameAccountForm() {
  return new Promise(resolve => {
    const old = document.getElementById('acctForm'); if (old) old.remove();
    const wrap = document.createElement('div'); wrap.id = 'acctForm';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:150;display:grid;place-items:center;background:#000a;padding:16px';
    wrap.innerHTML = `<form style="width:min(320px,100%);background:#120d0a;border:1px solid #8a6a3a;border-radius:2px;padding:16px;display:grid;gap:10px;font:12px Arial,sans-serif;color:#e8dcc2">
      <b style="font-size:14px;color:#d4ac60;letter-spacing:.08em">ACCOUNT NAME</b>
      <label style="display:grid;gap:4px">NAME<input name="u" minlength="3" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" required style="font:inherit;padding:8px;background:#0a0807;color:#f0e6c8;border:1px solid #5a4630;border-radius:2px;text-transform:uppercase"></label>
      <small style="color:#8b8378">3-16 letters, digits or _. Your account ID stays the same.</small>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-x style="font:inherit;padding:8px 12px;background:#1a1310;color:#e8dcc2;border:1px solid #5a4630;cursor:pointer">CANCEL</button><button style="font:inherit;padding:8px 12px;background:#4a1c14;color:#ffe6b0;border:1px solid #d4ac60;cursor:pointer">SAVE</button></div></form>`;
    document.body.appendChild(wrap);
    const f = wrap.querySelector('form'); f.u.value = DeviceAccount.get().name; f.u.focus(); f.u.select();
    const done = v => { wrap.remove(); resolve(v); };
    wrap.querySelector('[data-x]').onclick = () => done(null);
    f.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); e.stopPropagation(); });
    f.addEventListener('submit', e => { e.preventDefault(); done(DeviceAccount.rename(f.u.value) ? DeviceAccount.get().name : null); });
  });
}
{
  const op0 = AccountScene.prototype.opts;
  AccountScene.prototype.opts = function () {
    const o = op0.call(this).slice(); const k = o.indexOf('BACK');
    const extra = ['HEROES & IDS']; if (currentAccount().kind === 'DEVICE') extra.push('ACCOUNT NAME');
    o.splice(k < 0 ? o.length : k, 0, ...extra); return o;
  };
  const run0 = AccountScene.prototype.run;
  AccountScene.prototype.run = async function (o) {
    if (o === 'ACCOUNT NAME') { const n = await renameAccountForm(); if (n) { SFX.confirm(); this.msg = `ACCOUNT NAME: ${n}`; } return; }
    if (o === 'HEROES & IDS') { push(new IdentityScene()); return; }
    return run0.call(this, o);
  };
  const dr0 = AccountScene.prototype.draw;
  AccountScene.prototype.draw = function () {
    dr0.call(this);
    // account strip under the header
    const a = currentAccount();
    fill(0, 0, W, 11, 3); textC(`${a.name.slice(0, 12)} · ID ${fmtUid(a.uid)}`, 80, 1, 0);
  };
}
class IdentityScene {
  constructor() { this.opaque = true; this.i = 0; }
  update() {
    if (P('b') || P('a')) { SFX.back(); removeScene(this); return; }
    if (nav('up')) { this.i = (this.i + 2) % 3; SFX.cursor(); } if (nav('down')) { this.i = (this.i + 1) % 3; SFX.cursor(); }
  }
  draw() {
    const a = currentAccount();
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3); textC('ACCOUNT & HEROES', 80, 1, 0);
    frame(2, 13, 156, 32);
    text(`ACCOUNT ${a.name}`.slice(0, 25), 6, 16, 'gold');
    text(`ACCOUNT ID ${fmtUid(a.uid)}`, 6, 26, 3);
    text(a.kind === 'REALM' ? 'REALM SERVER ACCOUNT' : a.kind === 'CLAUDE' ? 'SIGNED IN WITH CLAUDE' : 'DEVICE ACCOUNT (OFFLINE)', 6, 35, 2);
    slotHeroes().forEach((s0, j) => {
      const s = G && G.slot === j ? G : s0, y = 48 + j * 31; frame(2, y, 156, 30); if (j === this.i) fill(4, y + 2, 2, 26, 'gold');
      if (!s) { text(`SLOT ${j + 1}  EMPTY`, 9, y + 11, 1); return; }
      const h = s; // stored slots are only read here
      text(`SLOT ${j + 1} ${String(h.name).slice(0, 10)} L${h.lvl}`, 9, y + 3, 'gold');
      text(h.username ? `USER ${h.username}`.slice(0, 24) : 'USER (SET WHEN LOADED)', 9, y + 12, 3);
      text(validUid(h.pid) ? `PLAYER ID ${fmtUid(h.pid)}` : 'PLAYER ID (SET WHEN LOADED)', 9, y + 21, 2);
    });
    text('A/B: BACK', 110, 138, 1);
  }
}

// ---------------------------------------------------------------- character sheet footer, chat commands, presence
{
  const cs0 = CharSheet.prototype.draw;
  CharSheet.prototype.draw = function () {
    cs0.call(this);
    if (!G || this.page !== 0) return;
    ensureIdentity(G);
    fill(0, H - 9, W, 9, 0); text(`${G.username}  ID ${fmtUid(G.pid)}`.slice(0, 26), 2, H - 8, 2);
  };
}
{
  const s2 = NET.sendChat.bind(NET);
  NET.sendChat = function (raw) {
    const m = String(raw || '').trim().match(/^\/(id|whoami|account)\b/i);
    if (m) {
      const a = currentAccount(), sys = t => chatLog('system', 'ID', t);
      sys(`ACCOUNT ${a.name}  ·  ACCOUNT ID ${fmtUid(a.uid)}  (${a.kind.toLowerCase()})`);
      if (G) { ensureIdentity(G); sys(`HERO ${G.name}  ·  USERNAME ${G.username}  ·  PLAYER ID ${fmtUid(G.pid)}`); }
      return;
    }
    return s2(raw);
  };
}
if (typeof CB_COMMANDS !== 'undefined') CB_COMMANDS.push('id', 'whoami');
