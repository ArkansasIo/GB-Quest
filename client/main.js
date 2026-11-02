// LOST KINGDOM OF SHADOWBANE CHRONICLES entry point: load assets behind the studio boot screen, wire chat, network, live updates.
'use strict';
(function main() {
  let progress = 0;
  const loading = loadAssets(p => { progress = p; }).then(() => { progress = 1; document.body.classList.add('ready'); });
  // chat box under the handheld
  const input = document.getElementById('chatinput');
  const form = document.getElementById('chatform');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; if (G) NET.sendChat(v); else chatLog('say', 'YOU', v); input.value = ''; input.blur(); focusGame(); });
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); input.blur(); focusGame(); } });
  document.querySelectorAll('[data-chat-filter]').forEach(button => button.addEventListener('click', () => setChatFilter(button.dataset.chatFilter)));
  chatLog('System', BUILD.studio, `${BUILD.game} v${BUILD.version} - welcome to AELMOOR!`);
  // live page updates keep your run
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => (G ? { G } : {}));
  const start = data => {
    if (data && data.G) { loading.then(() => { G = data.G; fixupState(); enterWorld(); }); }
    else push(new Boot(() => progress));
    requestAnimationFrame(loop);
    NET.init();
  };
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
  // autosave every 2 minutes
  setInterval(() => { if (G && scenes.some(s => s instanceof Field)) { G.playtime += 120; saveGame(); } }, 120000);
  window.GBQ = { openAtlas, closeAtlas, get G() { return G; }, newGame(o) { G = newGameState(o); return G; }, scenes, push, reset, startBattle, rollEncounter, enterWorld, Battle, makeMonster, makeAdventurer, buildParty, bDown, bUp, tick, render, S, ZONES, BESTIARY, BOSSES, buildZoneCached, newGameState, saveGame, loadSlot, travelTo, enterInstance, DUNGEONS, RAIDS, gainXP, derive };
})();

// ---- Atlas of Dunia: the full interactive map, embedded in the game (button, or M key) ----
let atlasLoadPromise = null, atlasOpenPending = false, atlasCleanup = null;
function toggleAtlas() {
  if (document.getElementById('atlasOverlay')) { closeAtlas(); return; }
  if (atlasOpenPending) { atlasOpenPending = false; return; }
  openAtlas();
}
function openAtlas() {
  if (document.getElementById('atlasOverlay')) return;
  if (!window.ATLAS_HTML) {
    atlasOpenPending = true;
    if (!atlasLoadPromise) atlasLoadPromise = fetch('dist/atlas.html').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }).then(html => { window.ATLAS_HTML = html; return true; }).catch(error => { console.error('Atlas failed to load:', error); atlasLoadPromise = null; return false; });
    atlasLoadPromise.then(ok => {
      if (!atlasOpenPending) return;
      atlasOpenPending = false;
      if (ok) openAtlas(); else chatLog('System', 'MAP', 'The World Atlas could not be loaded.');
    });
    return;
  }
  atlasOpenPending = false;
  const here = G ? (G.inst ? G.inst.return.map : G.map) : 'ardenhold';
  const st = { here, visited: Object.assign({}, G && G.visited, G && G.waypoints) };
  const html = ATLAS_HTML.replace('<script>\nconst DATA', '<script>window.ATLAS_STATE=' + JSON.stringify(st) + ';<\/script><script>\nconst DATA');
  const ov = document.createElement('div'); ov.id = 'atlasOverlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'World Atlas');
  ov.style.cssText = 'position:fixed;z-index:100;background:#16120d;box-shadow:0 0 0 2px #0b0c0b;overflow:hidden';
  const fr = document.createElement('iframe'); fr.title = 'Atlas of Dunia'; fr.srcdoc = html;
  fr.style.cssText = 'border:0;width:100%;height:100%;display:block';
  const big = document.createElement('button'); big.type = 'button'; big.textContent = '⤢'; big.title = 'Fit to game screen / whole window'; big.setAttribute('aria-label', big.title);
  big.style.cssText = 'position:absolute;right:6px;bottom:6px;z-index:2;width:30px;height:30px;background:#0e0b07e6;color:#efe2c2;border:1px solid #5a4a33;border-radius:3px;font-size:16px;cursor:pointer';
  ov.append(fr, big); document.body.appendChild(ov);
  // the atlas sits exactly over the game's LCD; ⤢ toggles the whole window
  let full = false;
  const fit = () => {
    if (!document.body.contains(ov)) return;
    if (full) { Object.assign(ov.style, { left: '0', top: '0', width: '100vw', height: '100dvh', borderRadius: '0' }); return; }
    const r = LCD.getBoundingClientRect(), w = Math.max(r.width, 280), h = Math.max(r.height, 252);
    Object.assign(ov.style, { left: Math.max(0, r.left - (w - r.width) / 2) + 'px', top: Math.max(0, r.top - (h - r.height) / 2) + 'px', width: w + 'px', height: h + 'px', borderRadius: '3px' });
  };
  big.onclick = () => { full = !full; fit(); };
  const onResize = () => fit(), onScroll = () => fit();
  fit(); addEventListener('resize', onResize); addEventListener('scroll', onScroll, { passive: true });
  atlasCleanup = () => { removeEventListener('resize', onResize); removeEventListener('scroll', onScroll); };
  try { SFX.open(); } catch (e) {}
  fr.addEventListener('load', () => {
    if (!document.body.contains(ov)) return;
    try {
      fr.contentWindow.addEventListener('keydown', e => {
        const tag = e.target && e.target.tagName;
        if (!e.repeat && (e.key === 'm' || e.key === 'M') && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); closeAtlas(); }
      });
      fr.contentWindow.focus();
    } catch (e) {}
  });
}
function closeAtlas() {
  atlasOpenPending = false;
  if (atlasCleanup) { atlasCleanup(); atlasCleanup = null; }
  const ov = document.getElementById('atlasOverlay'); if (ov) { ov.remove(); try { SFX.close(); } catch (e) {} }
}
function toggleBrowserFullscreen() {
  const active = !!(document.fullscreenElement || document.webkitFullscreenElement);
  applyDisplayMode(active ? 'borderless' : 'fullscreen');
}
addEventListener('message', e => {
  const m = e.data; if (!m || !m.gbqAtlas) return;
  if (m.gbqAtlas === 'close') closeAtlas();
  if (m.gbqAtlas === 'show' && G && ZONE_BY_ID[m.zone]) {
    closeAtlas();
    let wm = scenes.find(s => s instanceof WorldMap);
    if (!wm) wm = new WorldMap();
    if (topScene() !== wm) { removeScene(wm); push(wm); }
    if (wm) { wm.sel = ZONE_BY_ID[m.zone]; wm.zoom = 1; }
  }
});
addEventListener('keydown', e => {
  if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.defaultPrevented && !typing() && !keyCaptureHandler) { e.preventDefault(); toggleAtlas(); }
  if ((e.key === 'f' || e.key === 'F') && !e.repeat && !e.defaultPrevented && !typing() && !keyCaptureHandler && !document.getElementById('fsFull')) { e.preventDefault(); toggleBrowserFullscreen(); }
});
document.querySelectorAll('[data-atlas]').forEach(b => b.addEventListener('click', toggleAtlas));
document.querySelectorAll('[data-fullscreen]').forEach(b => b.addEventListener('click', toggleBrowserFullscreen));
