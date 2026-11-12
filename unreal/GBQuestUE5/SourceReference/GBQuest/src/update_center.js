'use strict';
(() => {
// ================================================================ UPDATES & PATCH NOTES (MAIN MENU > PATCH NOTES)
// * PATCH NOTES: every release in patch-notes.json (window.GBQ_PATCH_NOTES), newest first. UP/DOWN pick a
//   version, LEFT/RIGHT scroll its notes.
// * UPDATE CHECK: asks the GitHub releases API for the latest release of the game's repo (once per session,
//   4 s timeout, silent when offline). A newer version shows UPDATE AVAILABLE; A opens its release page.
// * WHAT'S NEW: the first time a new version runs, a toast points to the patch notes.
if (typeof window === 'undefined') return;
const NOTES = window.GBQ_PATCH_NOTES || { releases: [] };
const REPO = NOTES.repo || 'ArkansasIo/GB-Quest';
const CUR = (typeof BUILD !== 'undefined' && BUILD.version) || (NOTES.releases[0] && NOTES.releases[0].version) || '0.0.0';
const cmpVer = (a, b) => { const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; } return 0; };
const UPD = { state: 'idle', latest: null, url: null };

function checkForUpdate(force) {
  if (UPD.state === 'checking' || (UPD.state !== 'idle' && !force)) return;
  if (typeof fetch !== 'function') { UPD.state = 'offline'; return; }
  UPD.state = 'checking';
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), 4000);
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/vnd.github+json' } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(j => {
      const tag = String(j.tag_name || '').replace(/^v/, '');
      if (!/^\d+\.\d+\.\d+$/.test(tag)) { UPD.state = 'current'; return; }
      UPD.latest = tag; UPD.url = j.html_url || `https://github.com/${REPO}/releases/latest`;
      UPD.state = cmpVer(tag, CUR) > 0 ? 'available' : 'current';
      if (UPD.state === 'available' && typeof toast === 'function') toast('UPDATE AVAILABLE', `v${tag} - MENU > PATCH NOTES`, 'item_key', 'confirm');
    })
    .catch(() => { UPD.state = 'offline'; })
    .finally(() => clearTimeout(t));
}
window.GBQUpdates = { check: checkForUpdate, state: () => Object.assign({}, UPD), current: CUR, cmpVer };

class PatchNotesScene {
  constructor() { this.opaque = true; this.v = 0; this.scroll = 0; checkForUpdate(); }
  lines() {
    const r = NOTES.releases[this.v]; if (!r) return [];
    const out = [];
    for (const s of r.sections || []) { out.push({ t: s.name.toUpperCase(), c: 'gold' }); for (const n of s.notes) wrap('- ' + n, 25).forEach((l, i) => out.push({ t: i ? '  ' + l : l, c: 3 })); }
    return out;
  }
  update() {
    const n = NOTES.releases.length;
    if (P('b') || P('start')) { SFX.back(); removeScene(this); return; }
    if (nav('up') && this.v > 0) { this.v--; this.scroll = 0; SFX.cursor(); }
    if (nav('down') && this.v < n - 1) { this.v++; this.scroll = 0; SFX.cursor(); }
    const max = Math.max(0, this.lines().length - 9);
    if (nav('right')) { this.scroll = Math.min(max, this.scroll + 3); SFX.cursor(); }
    if (nav('left')) { this.scroll = Math.max(0, this.scroll - 3); SFX.cursor(); }
    if (P('select')) { SFX.select(); checkForUpdate(true); }
    if (P('a') && UPD.state === 'available' && UPD.url) { SFX.select(); try { window.open(UPD.url, '_blank', 'noopener'); } catch (e) {} }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const r = NOTES.releases[this.v];
    text('PATCH NOTES', 4, 13, 'gold'); textR(`v${CUR}`, 156, 13, 2);
    // update status bar
    const st = UPD.state, msg = st === 'available' ? `UPDATE v${UPD.latest} - A: GET IT` : st === 'checking' ? 'CHECKING FOR UPDATES...' : st === 'current' ? 'UP TO DATE' : st === 'offline' ? 'OFFLINE - SEL: RETRY' : '';
    if (msg) { fill(2, 23, 156, 10, st === 'available' ? 3 : 'rgba(28,24,62,.92)'); textC(msg, 80, 24, st === 'available' ? 0 : 2); }
    if (!r) { textC('NO NOTES', 80, 70, 2); return; }
    // version selector
    fill(2, 35, 156, 11, 'rgba(28,24,62,.92)');
    text(this.v > 0 ? '<' : ' ', 4, 36, 'gold'); textR(this.v < NOTES.releases.length - 1 ? '>' : ' ', 156, 36, 'gold');
    textC(`v${r.version}  ${r.date || ''}`, 80, 36, cmpVer(r.version, CUR) === 0 ? 'gold' : 3);
    frame(2, 48, 156, 86);
    text(r.title || '', 6, 51, 'gold', 1, 154);
    const L = this.lines();
    L.slice(this.scroll, this.scroll + 8).forEach((l, i) => text(l.t, 6, 62 + i * 9, l.c, 1, 154));
    if (L.length > 8) { const h = 70, bh = Math.max(6, h * 8 / L.length); fill(153, 62, 2, h, 2); fill(153, 62 + (h - bh) * this.scroll / Math.max(1, L.length - 8), 2, bh, 'gold'); }
    fill(0, 135, W, 9, 0);
    text('UP/DN: VERSION', 3, 136, 2); textR('L/R: SCROLL', 157, 136, 2);
  }
}
window.PatchNotesScene = PatchNotesScene;

if (typeof MainMenu !== 'undefined') {
  const i0 = MainMenu.prototype.items;
  MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('SETTINGS'); L.splice(at >= 0 ? at : L.length, 0, UPD.state === 'available' ? 'PATCH NOTES (!)' : 'PATCH NOTES'); return L; };
  const u0 = MainMenu.prototype.update;
  MainMenu.prototype.update = function () { if (P('a') && String(this.items()[this.i] || '').startsWith('PATCH NOTES')) { SFX.select(); return push(new PatchNotesScene()); } return u0.apply(this, arguments); };
}
if (typeof MainMenu !== 'undefined') window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { 'PATCH NOTES': 'What changed in each version, and an update check.' });

// what's new: once per version, a little after the game starts
setTimeout(() => {
  try {
    const seen = typeof store !== 'undefined' ? store.get('gbq_seen_version') : null;
    if (seen !== CUR) {
      if (seen && typeof toast === 'function') toast(`UPDATED TO v${CUR}`, 'MENU > PATCH NOTES', 'item_key', 'confirm');
      if (typeof store !== 'undefined') store.set('gbq_seen_version', CUR);
    }
  } catch (e) {}
  checkForUpdate();
}, 6000);
})();
