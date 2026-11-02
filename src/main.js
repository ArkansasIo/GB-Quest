// GB QUEST entry point: load assets behind the studio boot screen, wire chat, network, live updates.
'use strict';
(function main() {
  let progress = 0;
  const loading = loadAssets(p => { progress = p; }).then(() => { progress = 1; document.body.classList.add('ready'); });
  // chat box under the handheld
  const input = document.getElementById('chatinput');
  const form = document.getElementById('chatform');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; if (G) NET.sendChat(v); else chatLog('Say', 'YOU', v); input.value = ''; input.blur(); });
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
  window.GBQ = { get G() { return G; }, scenes, push, reset, startBattle, rollEncounter, enterWorld, Battle, makeMonster, makeAdventurer, buildParty, bDown, bUp, tick, render, S, ZONES, BESTIARY, BOSSES, buildZoneCached, newGameState, saveGame, loadSlot, travelTo, enterInstance, DUNGEONS, RAIDS, gainXP, derive };
})();
