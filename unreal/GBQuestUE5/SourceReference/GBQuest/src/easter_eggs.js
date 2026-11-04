// Hidden button-code discoveries and small in-world Easter egg rewards.
'use strict';
const GBQ_EASTER_EGGS = Object.freeze([
  { id: 'konami_legacy', name: 'THE OLD WORLD', sequence: ['up','up','down','down','left','right','left','right','b','a'], hint: 'A forgotten code from an older age.', reward: { gold: 1337, sigils: 1, xp: 2500 } },
  { id: 'developer_salute', name: 'HELLO, BUILDER', sequence: ['left','right','left','right','up','down','up','down','a'], hint: 'A salute to the hands that built this realm.', reward: { gold: 4242, xp: 4200 } },
  { id: 'slime_whisper', name: 'THE SLIME WHISPERER', sequence: ['up','up','up','down','a','b'], hint: 'Even the smallest creatures remember.', reward: { gold: 250, potions: 3, xp: 500 } },
  { id: 'lantern_secret', name: 'LIGHT IN THE DARK', sequence: ['down','left','up','right','a','start'], hint: 'Follow the lantern when no road remains.', reward: { gold: 777, sigils: 2, xp: 1777 } },
]);
let GBQ_EASTER_BUFFER = [];
function ensureEasterEggs(state) {
  if (!state || typeof state !== 'object') throw new TypeError('A game state is required.');
  state.easterEggs = state.easterEggs && typeof state.easterEggs === 'object' && !Array.isArray(state.easterEggs) ? state.easterEggs : {};
  return state.easterEggs;
}
function grantEasterEgg(state, egg) {
  const found = ensureEasterEggs(state);
  if (found[egg.id]) return { ok: false, duplicate: true, egg };
  found[egg.id] = { foundAt: Date.now() };
  const r = egg.reward;
  state.gold = Math.max(0, Number(state.gold) || 0) + r.gold;
  state.bossTokens = Math.max(0, Number(state.bossTokens) || 0) + (r.sigils || 0);
  state.inv = state.inv && typeof state.inv === 'object' ? state.inv : {};
  state.inv.potion = Math.max(0, Number(state.inv.potion) || 0) + (r.potions || 0);
  if (r.xp && typeof gainXP === 'function') gainXP(state, r.xp);
  state.stats = state.stats || {};
  state.stats.secretFinds = Math.max(0, Number(state.stats.secretFinds) || 0) + 1;
  if (typeof saveGame === 'function') saveGame();
  return { ok: true, egg, reward: r };
}
function feedEasterEggInput(state, key) {
  if (!GBQ_EASTER_EGGS.length || !['up','down','left','right','a','b','start'].includes(key)) return null;
  GBQ_EASTER_BUFFER.push(key);
  if (GBQ_EASTER_BUFFER.length > 24) GBQ_EASTER_BUFFER.shift();
  for (const egg of GBQ_EASTER_EGGS) {
    const seq = egg.sequence;
    if (GBQ_EASTER_BUFFER.length >= seq.length && seq.every((v, i) => GBQ_EASTER_BUFFER[GBQ_EASTER_BUFFER.length - seq.length + i] === v)) {
      GBQ_EASTER_BUFFER = [];
      const result = grantEasterEgg(state, egg);
      if (result.ok && typeof toast === 'function') toast('SECRET FOUND!', egg.name, 'px_crown', 'achievement');
      return result;
    }
  }
  const max = Math.max(...GBQ_EASTER_EGGS.map(e => e.sequence.length));
  if (GBQ_EASTER_BUFFER.length > max) GBQ_EASTER_BUFFER.splice(0, GBQ_EASTER_BUFFER.length - max);
  return null;
}
function easterEggSummary(state) {
  const found = ensureEasterEggs(state);
  return { total: GBQ_EASTER_EGGS.length, discovered: GBQ_EASTER_EGGS.filter(e => !!found[e.id]).length,
    entries: GBQ_EASTER_EGGS.map(e => ({ id: e.id, name: e.name, hint: e.hint, found: !!found[e.id], reward: e.reward })) };
}
const GBQEasterEggs = Object.freeze({ definitions: GBQ_EASTER_EGGS, ensure: ensureEasterEggs, feed: feedEasterEggInput, discover: grantEasterEgg, summary: easterEggSummary });
globalThis.GBQEasterEggs = GBQEasterEggs;
