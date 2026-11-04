// ================================================================ SANCTUM UI THEME (dark ARPG look)
// A black-and-bronze interface in the style of modern dark action RPGs:
//   * every menu, dialog and panel: near-black fill, bronze border, gold corner studs, bone-white text
//   * a top bar: level, name and gold
//   * a bottom HUD: red LIFE orb (left), blue resource orb (right: spell slots, ki, rage...),
//     the four equipped combat arts in the middle and a gold XP bar
// The theme is chosen in the settings screen (UI THEME: SANCTUM / CLASSIC). The four Game Boy shades are
// remapped, so every existing screen follows without changes. Single-tone palettes (DMG, POCKET, ...)
// keep their classic look.

const SANCTUM = [[12, 10, 10], [104, 82, 58], [178, 152, 112], [236, 224, 200]];
const SAN = { trim: [118, 90, 54], trimDark: [44, 34, 26], stud: [212, 172, 96], panel: [16, 13, 12], panel2: [24, 19, 17] };
if (S.uiTheme == null) S.uiTheme = 'sanctum';
const uiDark = () => (S.uiTheme === 'sanctum' || S.uiTheme === 'diablo' || S.uiTheme === 'mu' || S.uiTheme === 'blackbird') && !MONO(S.palette);
{
  const col0 = col;
  col = function (c) { if (typeof c === 'number' && uiDark()) return css(SANCTUM[c] || SANCTUM[3]); return col0(c); };
  const font0 = font;
  font = function (c) { const k = String(c) + S.palette; if (fontC[k] && fontC[k].__theme !== S.uiTheme) delete fontC[k]; const f = font0(c); f.__theme = S.uiTheme; return f; };
  const frame0 = frame;
  frame = function (x, y, w, h, bg = 0) {
    if (!uiDark()) return frame0(x, y, w, h, bg);
    fill(x, y, w, h, css(SAN.trim));
    fill(x + 1, y + 1, w - 2, h - 2, bg === 0 ? css(SAN.panel) : col(bg));
    fill(x + 1, y + 1, w - 2, 1, css(SAN.trimDark)); fill(x + 1, y + h - 2, w - 2, 1, css(SAN.trimDark));
    fill(x + 1, y + 1, 1, h - 2, css(SAN.trimDark)); fill(x + w - 2, y + 1, 1, h - 2, css(SAN.trimDark));
    for (const [sx, sy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) fill(sx, sy, 2, 2, css(SAN.stud));
    if (w > 24) { fill(x + (w >> 1) - 2, y, 4, 1, css(SAN.stud)); fill(x + (w >> 1) - 2, y + h - 1, 4, 1, css(SAN.stud)); }
  };
  const bar0 = bar;
  bar = function (x, y, w, h, v, max, c = 2) {
    if (!uiDark()) return bar0(x, y, w, h, v, max, c);
    fill(x, y, w, h, css(SAN.trimDark)); fill(x + 1, y + 1, w - 2, h - 2, css([8, 6, 6]));
    const f = Math.round((w - 2) * Math.max(0, Math.min(1, max ? v / max : 0)));
    if (f > 0) { fill(x + 1, y + 1, f, h - 2, col(c)); if (h > 3) fill(x + 1, y + 1, f, 1, 'rgba(255,255,255,0.25)'); }
  };
}
// menu header (clock / level / gold) as a dark top bar
{
  const hdr0 = hdr;
  hdr = function () {
    if (!uiDark()) return hdr0();
    fill(0, 0, W, 11, css(SAN.panel)); fill(0, 11, W, 1, css(SAN.trim)); fill(0, 10, W, 1, css(SAN.trimDark));
    const d = new Date(); text(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 3, 1, 2);
    text(`LV${G.lvl}`, 40, 1, 'gold');
    if (NET.room) text(NET.server ? 'HOST' : NET.hostOf ? 'JOIN' : 'LIVE', 72, 1, 'blue');
    const g = fmt(G.gold); textR(g, W - 3, 1, 'gold'); blit(sprFit('icon_3_3', 8), W - 13 - g.length * 6, 1);
  };
}

// ---------------------------------------------------------------- orbs and HUD
function resourceFrac(c) {
  const D = derive(c), mx = typeof resMax === 'function' ? resMax(c, D) : {}, r = c.res || {};
  let cur = 0, tot = 0;
  for (const k in mx) { const m = mx[k], v = r[k]; if (Array.isArray(m)) { tot += m.reduce((a, b) => a + b, 0); cur += (Array.isArray(v) ? v : []).reduce((a, b) => a + b, 0); } else if (typeof m === 'number' && m > 0 && k !== 'hd') { tot += m; cur += Math.max(0, +v || 0); } }
  return tot ? Math.max(0, Math.min(1, cur / tot)) : 1;
}
function drawOrb(cx, cy, r, frac, rgb) {
  const level = cy + r - 2 * r * frac;
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d > r + 1.2) continue;
    let c;
    if (d > r - 0.2) c = d > r + 0.6 ? SAN.trimDark : SAN.trim;
    else {
      if (cy + y >= level) { const k = 0.55 + 0.45 * (1 - (y + r) / (2 * r)) + (x < 0 ? 0.08 : -0.05); c = rgb.map(v => Math.max(0, Math.min(255, Math.round(v * k)))); }
      else c = [10, 8, 8];
      if (x > -r * 0.55 && x < -r * 0.15 && y > -r * 0.7 && y < -r * 0.35) c = c.map(v => Math.min(255, v + 70)); // gloss
    }
    ctx.fillStyle = css(c); ctx.fillRect(cx + x, cy + y, 1, 1);
  }
  fill(cx - 1, cy - r - 2, 2, 1, css(SAN.stud));
}
function drawSanctumMinimap(field) {
  const cx = W - 15, cy = 25, r = 12, px = G.x, py = G.y;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = css([9, 8, 8]); ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const tile = field.tileAt(px + dx, py + dy);
    if (!tile) continue;
    ctx.fillStyle = css(tile[1] ? [105, 94, 70] : [48, 43, 36]);
    ctx.fillRect(cx + dx * 3 - 1, cy + dy * 3 - 1, 3, 3);
  }
  for (const e of field.entities()) {
    const dx = e.x - px, dy = e.y - py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) continue;
    const rgb = e.kind === 'boss' || e.kind === 'pull' ? [230, 65, 48] : e.kind === 'waypoint' ? [70, 190, 220] : e.kind === 'npc' ? [220, 180, 90] : [120, 160, 190];
    ctx.fillStyle = css(rgb); ctx.fillRect(cx + dx * 3 - 1, cy + dy * 3 - 1, 2, 2);
  }
  ctx.fillStyle = css([255, 225, 130]); ctx.fillRect(cx - 1, cy - 1, 3, 3);
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = css(SAN.trim); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.strokeStyle = css(SAN.stud); ctx.lineWidth = 1; ctx.stroke();
}
function drawSanctumHud(field) {
  const D = derive(G), hpF = Math.max(0, Math.min(1, G.hp / D.hpMax)), mpF = resourceFrac(G);
  // bottom panel
  fill(0, H - 15, W, 15, css(SAN.panel)); fill(0, H - 15, W, 1, css(SAN.trim)); fill(0, H - 14, W, 1, css(SAN.trimDark));
  drawOrb(12, H - 12, 10, hpF, G.hp < D.hpMax * 0.3 && (frameN >> 3) % 2 ? [255, 70, 50] : [200, 28, 24]);
  drawOrb(W - 13, H - 12, 10, mpF, [44, 92, 220]);
  // combat arts slots
  const arts = typeof artLoadout === 'function' ? artLoadout(G) : [];
  for (let i = 0; i < 4; i++) {
    const x = 42 + i * 19, y = H - 13;
    fill(x, y, 17, 11, css(SAN.trim)); fill(x + 1, y + 1, 15, 9, css([8, 6, 6]));
    const a = arts[i];
    if (a) { const ic = a.kind === 'physical' ? 'sk_power_strike' : 'sk_arcane_burst'; if (IMG[ic]) blit(sprFit(ic, 9), x + 4, y + 1); fill(x + 1, y + 9, 15, 1, a.kind === 'physical' ? css([170, 50, 40]) : css([60, 110, 220])); }
  }
  // Circular local minimap in the upper-right HUD corner.
  drawSanctumMinimap(field);
  // XP bar
  const x0 = xpForLevel(G.lvl), x1 = xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)), xf = Math.max(0, Math.min(1, (G.xp - x0) / Math.max(1, x1 - x0)));
  fill(26, H - 2, 108, 2, css([30, 24, 18])); fill(26, H - 2, Math.round(108 * xf), 2, css([214, 170, 64]));
  // top bar (hidden while a zone banner is showing)
  if (!(field.toast > 0)) {
    fill(0, 0, W, 9, 'rgba(12,10,10,0.82)'); fill(0, 9, W, 1, css(SAN.trim));
    text(`L${G.lvl} ${G.name}`.slice(0, 14), 2, 0, 3);
    const g = fmt(G.gold); textR(g + 'G', W - 2, 0, 'gold');
  }
}
{
  const draw0 = Field.prototype.draw;
  Field.prototype.draw = function () {
    draw0.call(this);
    if (uiDark() && G && S.uiTheme !== 'mu' && S.uiTheme !== 'blackbird') drawSanctumHud(this);
  };
}
