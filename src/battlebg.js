// ================================================================ CLEAN BATTLE BACKGROUNDS (handheld creature-RPG style)
// Flat, clean scenes instead of the busy painted strip: banded sky, a distant silhouette, flat ground
// and two oval platforms (the foe's on the far side, the party's in front). One look per biome plus
// dungeon, raid/arena and town. Drawn once per scene into a cached canvas. SETTINGS > BATTLE BG
// switches between CLEAN and PAINTED.

if (S.battleBg == null) S.battleBg = 'clean';
const BBG = {
  meadow: { sky: [[118, 188, 240], [176, 220, 250]], far: [96, 164, 88], far2: [124, 186, 104], ground: [148, 204, 104], line: [128, 186, 88], plat: [176, 222, 124], rim: [102, 156, 72], deco: 'hills' },
  coast: { sky: [[104, 180, 236], [180, 222, 250]], far: [58, 136, 200], far2: [96, 170, 220], ground: [232, 214, 156], line: [212, 192, 132], plat: [244, 228, 176], rim: [194, 170, 110], deco: 'sea' },
  marsh: { sky: [[146, 168, 160], [196, 206, 184]], far: [86, 110, 84], far2: [108, 132, 98], ground: [118, 140, 96], line: [98, 120, 80], plat: [140, 162, 112], rim: [86, 104, 70], deco: 'reeds' },
  jungle: { sky: [[128, 198, 168], [188, 228, 196]], far: [40, 104, 56], far2: [64, 132, 70], ground: [96, 160, 76], line: [78, 138, 62], plat: [124, 184, 92], rim: [64, 116, 52], deco: 'trees' },
  snow: { sky: [[176, 202, 236], [226, 238, 250]], far: [196, 212, 232], far2: [222, 232, 244], ground: [236, 242, 248], line: [214, 224, 236], plat: [250, 252, 255], rim: [180, 196, 216], deco: 'peaks' },
  badlands: { sky: [[238, 180, 120], [250, 222, 170]], far: [186, 108, 66], far2: [208, 136, 86], ground: [214, 160, 106], line: [194, 140, 90], plat: [232, 184, 126], rim: [170, 112, 68], deco: 'mesas' },
  volcanic: { sky: [[64, 36, 48], [156, 64, 42]], far: [54, 36, 40], far2: [84, 50, 46], ground: [86, 64, 58], line: [110, 54, 36], plat: [112, 86, 76], rim: [60, 40, 36], deco: 'lava' },
  dusk: { sky: [[54, 46, 88], [136, 92, 132]], far: [44, 38, 62], far2: [66, 56, 86], ground: [86, 78, 104], line: [70, 62, 88], plat: [108, 98, 128], rim: [58, 50, 76], deco: 'moon' },
  crystal: { sky: [[140, 196, 232], [210, 232, 250]], far: [120, 170, 210], far2: [160, 204, 232], ground: [176, 206, 224], line: [150, 186, 210], plat: [204, 228, 244], rim: [124, 160, 190], deco: 'crystals' },
  dungeon: { sky: [[44, 40, 54], [70, 64, 82]], far: [56, 52, 68], far2: [66, 62, 80], ground: [92, 86, 102], line: [76, 70, 86], plat: [114, 108, 124], rim: [64, 58, 74], deco: 'bricks' },
  arena: { sky: [[120, 150, 210], [196, 214, 240]], far: [150, 120, 96], far2: [176, 146, 116], ground: [206, 184, 140], line: [186, 162, 120], plat: [222, 204, 160], rim: [160, 136, 96], deco: 'stands' },
};
const BBG_TOP = 38, BBG_BOT = 94;
function bbgKind(kind) {
  const z = ZONE_BY_ID[G && G.map];
  if (kind === 'dungeon' || kind === 'tower' || kind === 'trial' || (G && G.inst && G.inst.kind !== 'raid')) return 'dungeon';
  if (kind === 'raid' || kind === 'arena' || kind === 'pvp' || (z && z.town)) return 'arena';
  return (z && BBG[z.biome]) ? z.biome : 'meadow';
}
function hd64BattleBackdrop(kind) {
  if (S.video !== 'hd64' || S.battleBg === 'scenes') return null;
  const z = ZONE_BY_ID[G && G.map];
  const biome = z && z.biome;
  let scene = 'forest';
  if (['dungeon', 'tower', 'trial'].includes(kind) || (G && G.inst && G.inst.kind !== 'raid')) scene = 'crypt';
  else if (kind === 'raid' || ['volcanic', 'badlands'].includes(biome)) scene = 'volcanic';
  else if (['snow', 'crystal'].includes(biome)) scene = 'frost';
  else if (['marsh', 'jungle', 'dusk'].includes(biome)) scene = 'marsh';
  const name = `hd64_battle_${scene}`;
  return IMG[name] || null;
}
function bbgColor(rgb) {
  if (!MONO(S.palette)) return css(rgb);
  const l = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2];
  return css(UI.ui[l > 190 ? 0 : l > 130 ? 1 : l > 70 ? 2 : 3]);
}
const BBG_CACHE = {};
function bbgCanvas(key, foes) {
  const ck = `${key}|${foes > 1 ? 2 : 1}|${S.palette}`;
  if (BBG_CACHE[ck]) return BBG_CACHE[ck];
  const P = BBG[key], c = mkCanvas(W, BBG_BOT - BBG_TOP), x = c.getContext('2d'), h = c.height, C = bbgColor;
  const f = (px, py, w, hh, rgb) => { x.fillStyle = C(rgb); x.fillRect(px, py, w, hh); };
  const ell = (cx, cy, rx, ry, rgb) => { x.fillStyle = C(rgb); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
  // sky: three flat bands blending top to horizon
  const [s0, s1] = P.sky, mid = s0.map((v, i) => Math.round((v + s1[i]) / 2));
  f(0, 0, W, 8, s0); f(0, 8, W, 6, mid); f(0, 14, W, 10, s1);
  const horizon = 22;
  // distant silhouette
  if (P.deco === 'hills' || P.deco === 'trees') { for (let i = 0; i < 6; i++) ell(10 + i * 30, horizon + 2, 22, 7 + (i % 2) * 3, i % 2 ? P.far : P.far2); if (P.deco === 'trees') for (let i = 0; i < 14; i++) { ell(6 + i * 12, horizon - 3 - (i % 3), 5, 6, P.far); f(5 + i * 12, horizon - 1, 2, 4, P.rim); } }
  if (P.deco === 'sea') { f(0, horizon - 2, W, 6, P.far); f(0, horizon + 3, W, 2, P.far2); for (let i = 0; i < W; i += 14) f(i + 4, horizon, 6, 1, [230, 244, 252]); }
  if (P.deco === 'reeds') { f(0, horizon - 1, W, 5, P.far); for (let i = 0; i < W; i += 5) f(i, horizon - 5 - (i * 7 % 4), 1, 6, P.far2); }
  if (P.deco === 'peaks' || P.deco === 'crystals') { for (let i = 0; i < 7; i++) { const px = i * 26 - 4, ph = 12 + (i * 5 % 7); x.fillStyle = C(i % 2 ? P.far : P.far2); x.beginPath(); x.moveTo(px, horizon + 3); x.lineTo(px + 14, horizon + 3 - ph); x.lineTo(px + 28, horizon + 3); x.fill(); if (P.deco === 'peaks') { x.fillStyle = C([250, 252, 255]); x.beginPath(); x.moveTo(px + 10, horizon + 7 - ph); x.lineTo(px + 14, horizon + 3 - ph); x.lineTo(px + 18, horizon + 7 - ph); x.fill(); } else { f(px + 13, horizon + 1 - ph, 2, ph, [236, 248, 255]); } } }
  if (P.deco === 'mesas') { for (let i = 0; i < 5; i++) { const px = i * 36 + 4, w = 20 + (i * 7 % 10), ph = 8 + (i * 3 % 6); f(px, horizon + 3 - ph, w, ph, i % 2 ? P.far : P.far2); f(px, horizon + 3 - ph, w, 1, P.plat); } }
  if (P.deco === 'lava') { for (let i = 0; i < 4; i++) { const px = i * 44 + 6; x.fillStyle = C(P.far2); x.beginPath(); x.moveTo(px, horizon + 3); x.lineTo(px + 14, horizon - 9); x.lineTo(px + 22, horizon - 9); x.lineTo(px + 36, horizon + 3); x.fill(); f(px + 15, horizon - 10, 6, 2, [240, 110, 40]); } }
  if (P.deco === 'moon') { ell(132, 8, 6, 6, [236, 226, 200]); ell(134, 7, 5, 5, P.sky[0]); for (let i = 0; i < 6; i++) ell(10 + i * 30, horizon + 3, 20, 6, i % 2 ? P.far : P.far2); }
  if (P.deco === 'bricks') { f(0, 0, W, horizon + 3, P.far); for (let ry = 0; ry < horizon + 3; ry += 5) for (let rx = (ry / 5) % 2 ? 0 : 6; rx < W; rx += 12) { f(rx, ry, 11, 4, P.far2); } f(18, 4, 3, 5, [240, 180, 80]); f(138, 4, 3, 5, [240, 180, 80]); }
  if (P.deco === 'stands') { f(0, 4, W, horizon - 1, P.far); for (let ry = 6; ry < horizon; ry += 4) for (let rx = 2 + (ry % 8); rx < W; rx += 6) f(rx, ry, 2, 2, [(rx * 37) % 200 + 40, (rx * 53) % 160 + 60, (rx * 91) % 200 + 40]); f(0, horizon + 1, W, 2, P.rim); }
  // ground: flat with a few soft stripes receding toward the horizon
  f(0, horizon + 3, W, h - horizon - 3, P.ground);
  for (const [yy, ww] of [[horizon + 7, 1], [horizon + 13, 1], [horizon + 22, 1]]) f(0, yy, W, ww, P.line);
  // platforms: foe (far, right), party (near, left)
  const plat = (cx, cy, rx, ry) => { ell(cx, cy + 2, rx, ry, P.rim); ell(cx, cy, rx, ry, P.plat); ell(cx - rx * 0.25, cy - ry * 0.25, rx * 0.55, ry * 0.45, P.plat.map(v => Math.min(255, v + 14))); };
  if (foes > 1) { plat(117, 70 - BBG_TOP, 32, 4); plat(117, 89 - BBG_TOP, 34, 4); } else plat(118, 88 - BBG_TOP, 38, 5);
  plat(32, 88 - BBG_TOP, 34, 5);
  BBG_CACHE[ck] = c;
  return c;
}
function drawBattleBackdrop(b) {
  const hd = hd64BattleBackdrop(b.kind);
  if (hd) {
    const smooth = ctx.imageSmoothingEnabled, quality = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hd, 0, 38, W, 56);
    ctx.imageSmoothingEnabled = smooth; ctx.imageSmoothingQuality = quality;
    ctx.fillStyle = 'rgba(8,10,18,0.18)'; ctx.fillRect(0, 38, W, 56);
    fill(0, BBG_BOT - 1, W, 1, 3);
    return;
  }
  // CITADEL vector environment art is the default painted scene layer.
  const citadel = S.citadelArt !== false && battleBackdrop(b.kind);
  if (citadel && IMG[citadel]) {
    const smooth = ctx.imageSmoothingEnabled, quality = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(IMG[citadel], 0, 38, W, 56);
    ctx.imageSmoothingEnabled = smooth; ctx.imageSmoothingQuality = quality;
    ctx.fillStyle = 'rgba(8,10,18,0.12)'; ctx.fillRect(0, 38, W, 56);
    fill(0, BBG_BOT - 1, W, 1, 3);
    return;
  }
  if (S.battleBg === 'painted') {
    const bgn = battleBackdrop(b.kind);
    if (bgn && IMG[bgn]) { const im = IMG[bgn], sh = Math.round(im.width * 56 / 160); const bs = spr(bgn, im.width, im.height); ctx.drawImage(bs, 0, Math.max(0, Math.round(im.height * 0.45 - sh / 2)), im.width, sh, 0, 38, W, 56); }
    fill(0, 93, W, 1, 2); for (let x = 0; x < W; x += 8) fill(x + ((frameN >> 4) % 8), 92, 3, 1, 1);
    return;
  }
  const key = bbgKind(b.kind), cv = bbgCanvas(key, Math.min(4, b.foes.length));
  ctx.drawImage(cv, 0, BBG_TOP);
  // a little life: drifting clouds over open-sky biomes
  if (!['dungeon', 'volcanic', 'dusk'].includes(key)) { const cx = ((frameN >> 2) % (W + 40)) - 20; fill(cx, BBG_TOP + 4, 14, 2, '#f4f8fc'); fill(cx + 3, BBG_TOP + 3, 7, 1, '#f4f8fc'); }
  fill(0, BBG_BOT - 1, W, 1, 3);
}
