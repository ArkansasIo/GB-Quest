'use strict';
// ================================================================ MISSING PIECES
//   * GEM LOOT: won battles drop socket gems (2% per foe, elites 10%, bosses 35%); the tier follows the foe's level.
//   * GEM CUTTER (MERCHANT > GEM CUTTER): buy tier 1-3 gems of any type, or cut three of a tier into one of the next.
//   * MINIMAP: click (or tap) the minimap to switch between a close view and a wide view; double-click opens the
//     world map.
//   * HIGH CONTRAST palette (SETTINGS > PALETTE): white, yellow, blue and black, safe for colour-blind players.
// Pure rules are exported as GBQExtras for tests.

const GEM_DROP = { normal: 0.02, elite: 0.1, boss: 0.35 };
const gemTierFor = lvl => Math.max(1, Math.min(9, 1 + Math.floor(Math.max(1, lvl || 1) / 25)));
const GEM_SHOP_TIERS = [1, 2, 3];
const gemPrice = tier => [0, 60, 220, 700][tier] || 0;
if (typeof globalThis !== 'undefined') globalThis.GBQExtras = { GEM_DROP, gemTierFor, GEM_SHOP_TIERS, gemPrice };

if (typeof window !== 'undefined' && typeof Battle !== 'undefined') {
  // ------------------------------------------------ high-contrast palette
  if (typeof PALS !== 'undefined' && !PALS.contrast) { PALS.contrast = { ui: [[255, 255, 255], [255, 214, 0], [0, 90, 181], [0, 0, 0]], name: 'HIGH CONTRAST' }; PAL_ORDER.push('contrast'); }
  // ------------------------------------------------ gem loot
  const gems = () => (G.gems ||= {});
  const gemTypes = () => Object.keys(GEM_TYPES);
  { const f0 = Battle.prototype.finish; Battle.prototype.finish = function (result) {
      try {
        if (result === 'win' && G && !this.noRewards) {
          const got = [];
          for (const f of this.foes || []) {
            const p = f.boss ? GEM_DROP.boss : f.elite ? GEM_DROP.elite : GEM_DROP.normal;
            if (R() < p) { const id = `${pick(gemTypes())}_t${gemTierFor(f.lvl)}`; gems()[id] = (gems()[id] || 0) + 1; got.push(id); }
          }
          if (got.length && typeof chatLog === 'function') chatLog('loot', 'LOOT', `Found gem${got.length > 1 ? 's' : ''}: ${got.map(id => GBQGems.gemDefinition(id).name).join(', ')}.`);
        }
      } catch (e) { console.warn('gem loot', e); }
      return f0.apply(this, arguments);
    }; }
  // ------------------------------------------------ gem cutter
  window.gemCutterMenu = function () {
    choose(['BUY GEMS', 'CUT 3 INTO 1', 'MY GEMS', 'LEAVE'], k => {
      if (k === 0) {
        const types = gemTypes();
        return choose(types.map(t => GEM_TYPES[t].name), ti => {
          if (ti < 0) return gemCutterMenu();
          const t = types[ti];
          choose(GEM_SHOP_TIERS.map(n => `T${n} ${GEM_TYPES[t].name} ${gemPrice(n)}G`), ni => {
            if (ni < 0) return gemCutterMenu();
            const n = GEM_SHOP_TIERS[ni], cost = gemPrice(n);
            if (G.gold < cost) { SFX.error(); return say(`That costs ${cost} G.`, gemCutterMenu); }
            G.gold -= cost; gems()[`${t}_t${n}`] = (gems()[`${t}_t${n}`] || 0) + 1; SFX.coin ? SFX.coin() : SFX.buff(); saveGame(); say(`Bought T${n} ${GEM_TYPES[t].name}. Socket it at a smith.`, gemCutterMenu);
          }, `${GEM_TYPES[t].name}: ${GEM_TYPES[t].label}.`);
        }, 'Which gem?');
      }
      if (k === 1) {
        const ready = Object.entries(gems()).filter(([id, n]) => n >= 3 && GBQGems.gemDefinition(id) && GBQGems.gemDefinition(id).tier < 9);
        if (!ready.length) return say('You need three gems of the same type and tier.', gemCutterMenu);
        return choose(ready.map(([id, n]) => `${GBQGems.gemDefinition(id).name} x${n}`), i => {
          if (i < 0) return gemCutterMenu();
          const [id] = ready[i], d = GBQGems.gemDefinition(id), next = `${d.type}_t${d.tier + 1}`, fee = 25 * d.tier;
          if (G.gold < fee) { SFX.error(); return say(`Cutting costs ${fee} G.`, gemCutterMenu); }
          G.gold -= fee; gems()[id] -= 3; gems()[next] = (gems()[next] || 0) + 1; SFX.craft(); saveGame(); say(`Cut into a ${GBQGems.gemDefinition(next).name}!`, gemCutterMenu);
        }, 'Three of a tier become one of the next (fee 25 G per tier).');
      }
      if (k === 2) { const L = Object.entries(gems()).filter(([, n]) => n > 0); return say(L.length ? L.slice(0, 8).map(([id, n]) => `${GBQGems.gemDefinition(id).name} x${n}`) : 'No gems yet. They drop in battle.', gemCutterMenu); }
    }, 'GEM CUTTER: gems for your sockets.');
  };
  // ------------------------------------------------ minimap click: zoom; double-click: world map
  if (typeof LCD !== 'undefined') {
    let last = 0;
    LCD.addEventListener('pointerdown', e => {
      try {
        if (!G || typeof hudMmo !== 'function' || !hudMmo() || !(scenes[scenes.length - 1] instanceof Field)) return;
        const r = LCD.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height, M = MMO_LAYOUT.map;
        if (x < M.x || x > M.x + M.s || y < M.y || y > M.y + M.s) return;
        e.stopImmediatePropagation(); e.preventDefault();
        const now = Date.now();
        if (now - last < 350) { last = 0; if (typeof WorldMap === 'function') push(new WorldMap()); return; }
        last = now; S.mapZoom = S.mapZoom === 2 ? 1 : 2; SFX.cursor(); try { saveSettings(); } catch (err) { /* settings only */ }
      } catch (err) { /* input must never break */ }
    }, true);
  }
}
