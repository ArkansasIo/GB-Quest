'use strict';
// ================================================================ 64-BIT VIDEO + ENGINE SYSTEMS
// SETTINGS > VIDEO: 64-BIT turns the 160x144 framebuffer into a 640x576 presentation:
//   1. Scale4x (two EPX/Scale2x passes): edge-aware upscaling that rounds diagonals of every sprite and tile
//   2. full-colour palette (all art in its original colours)
//   3. dynamic lighting: day/night cycle, player lantern, glowing points of interest, darker dungeons
//   4. bloom, colour grading and vignette
// Also here: Tween, Events (bus), Cam (zoom pulses + shake), Clock (game time), Profiler (F3).

// ---------------------------------------------------------------- engine systems
const Events = { h: {}, on(k, f) { (this.h[k] = this.h[k] || []).push(f); return () => this.off(k, f); }, off(k, f) { this.h[k] = (this.h[k] || []).filter(x => x !== f); }, emit(k, v) { for (const f of this.h[k] || []) try { f(v); } catch (e) { console.warn(e); } } };
const EASE = { linear: t => t, inOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, out: t => 1 - Math.pow(1 - t, 3), back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
const Tween = {
  list: [],
  to(obj, props, frames = 30, ease = 'inOut', done) { const from = {}; for (const k in props) from[k] = obj[k]; const tw = { obj, from, props, f: 0, n: Math.max(1, frames), ease: EASE[ease] || EASE.inOut, done }; this.list.push(tw); return tw; },
  tick() { this.list = this.list.filter(tw => { tw.f++; const k = tw.ease(Math.min(1, tw.f / tw.n)); for (const p in tw.props) tw.obj[p] = tw.from[p] + (tw.props[p] - tw.from[p]) * k; if (tw.f >= tw.n) { tw.done && tw.done(); return false; } return true; }); },
};
const Cam = { zoom: 1, pulse(z = 1.06, f = 20) { this.zoom = z; Tween.to(this, { zoom: 1 }, f, 'out'); } };
// game clock: one in-game day = 24 real minutes; hour 0..24
const Clock = { override: null, get hour() { return this.override != null ? this.override : ((Date.now() / 60000) % 24 + 24) % 24; }, get phase() { const h = this.hour; return h < 5 || h >= 21 ? 'NIGHT' : h < 8 ? 'DAWN' : h < 18 ? 'DAY' : 'DUSK'; } };
const Profiler = {
  on: false, last: performance.now(), fps: 60, ms: 0,
  frame(ms) { const n = performance.now(), dt = n - this.last; this.last = n; this.fps = this.fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05; this.ms = this.ms * 0.9 + ms * 0.1; },
  draw(x) { if (!this.on) return; x.save(); x.fillStyle = '#000a'; x.fillRect(4, 4, 168, 46); x.fillStyle = '#9fd36a'; x.font = '11px monospace';
    x.fillText(`FPS ${this.fps.toFixed(0)}  FRAME ${this.ms.toFixed(2)}ms`, 10, 18); x.fillText(`SCENES ${scenes.length}  BODIES ${Physics.bodies ? Physics.bodies.length : 0}`, 10, 31); x.fillText(`${S.video.toUpperCase()} · ${S.audio.toUpperCase()} · ${Clock.phase} ${Clock.hour.toFixed(1)}h`, 10, 44); x.restore(); },
};
addEventListener('keydown', e => { if (e.key === 'F3' || e.key === '`') { Profiler.on = !Profiler.on; e.preventDefault(); } });

// ---------------------------------------------------------------- Scale2x on a Uint32 image
// colour grade on the small frame (saturation 1.18, contrast 1.06) — far cheaper than a CSS filter at 640x576
const GRADE = new Map();
function grade(src) {
  for (let i = 0; i < src.length; i++) {
    const p = src[i]; let g = GRADE.get(p);
    if (g === undefined) {
      const r = p & 255, gg = (p >> 8) & 255, b = (p >> 16) & 255, a = p >>> 24, l = (r + gg + b) / 3;
      const f = v => Math.max(0, Math.min(255, Math.round(((l + (v - l) * 1.18) - 128) * 1.06 + 128)));
      g = ((a << 24) | (f(b) << 16) | (f(gg) << 8) | f(r)) >>> 0; if (GRADE.size < 65536) GRADE.set(p, g);
    }
    src[i] = g;
  }
  return src;
}
// bright-pass for bloom: keep only pixels brighter than the threshold
function brightPass(src, out) {
  for (let i = 0; i < src.length; i++) { const p = src[i], l = ((p & 255) * 54 + ((p >> 8) & 255) * 183 + ((p >> 16) & 255) * 19) >> 8; out[i] = l > 170 ? p : 0; }
  return out;
}
function scale2x(src, w, h) {
  const out = new Uint32Array(w * h * 4), W2 = w * 2;
  for (let y = 0; y < h; y++) {
    const ym = y > 0 ? y - 1 : y, yp = y < h - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : x, xp = x < w - 1 ? x + 1 : x;
      const E = src[y * w + x], B = src[ym * w + x], D = src[y * w + xm], F = src[y * w + xp], Hh = src[yp * w + x];
      let e0 = E, e1 = E, e2 = E, e3 = E;
      if (B !== Hh && D !== F) { if (D === B) e0 = D; if (B === F) e1 = F; if (D === Hh) e2 = D; if (Hh === F) e3 = F; }
      const o = y * 2 * W2 + x * 2; out[o] = e0; out[o + 1] = e1; out[o + W2] = e2; out[o + W2 + 1] = e3;
    }
  }
  return out;
}

// ---------------------------------------------------------------- lights
const Light64 = {
  list: [],
  add(x, y, r, c = '255,214,150', a = 1) { this.list.push({ x, y, r, c, a }); },
  fromField(f) { // called by Field.draw with its camera
    if (!f || !f.cam) return; const [cx, cy] = f.cam, flick = 1 + Math.sin(frameN * 0.21) * 0.04 + Math.sin(frameN * 0.53) * 0.03;
    this.add(G.x * T + (f.ox || 0) - cx + 8, G.y * T + (f.oy || 0) - cy + 8, 46 * flick, '255,220,160', 1);
    const poi = f.m && f.m.poi || {};
    for (const [k, c] of [['waypoint', '140,210,255'], ['dungeon', '255,150,80'], ['raid', '255,90,110']]) { const p = poi[k]; if (p) this.add(p.x * T - cx + 8, p.y * T - cy + 8, 30 * flick, c, 0.9); }
    if (G.inst && G.inst.map.chest && !G.inst.chest) { const c = G.inst.map.chest; this.add(c.x * T - cx + 8, c.y * T - cy + 8, 22, '255,230,120', 0.8); }
    if (G.inst) for (const p of G.inst.map.pulls || []) if (!G.inst.cleared.includes(p.id)) this.add(p.x * T - cx + 8, p.y * T - cy + 8, 18, '255,70,70', 0.6);
    if (G.inst && f.m.rows) { // torches and braziers light the halls
      const rows = f.m.rows;
      for (let ty = Math.floor(cy / T); ty <= Math.floor((cy + H) / T); ty++) for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + W) / T); tx++) {
        const c = rows[ty] && rows[ty][tx]; if (c === 'B') this.add(tx * T - cx + 8, ty * T - cy + 6, 34 * flick, '255,170,80', 0.9); else if (c === 't') this.add(tx * T - cx + 8, ty * T - cy + 10, 26 * flick, '255,190,110', 0.75); else if (c === 'A') this.add(tx * T - cx + 8, ty * T - cy + 8, 20, '180,220,255', 0.7);
      }
    }
    this.dark = G.inst ? 0.62 : this.ambient();
    this.tint = G.inst ? '30,24,48' : this.tintFor();
  },
  ambient() { const h = Clock.hour; if (h >= 8 && h < 18) return 0; if (h >= 21 || h < 5) return 0.55; return h < 8 ? 0.55 * (8 - h) / 3 : 0.55 * (h - 18) / 3; },
  tintFor() { const p = Clock.phase; return p === 'NIGHT' ? '20,28,70' : p === 'DUSK' ? '90,40,60' : p === 'DAWN' ? '70,50,80' : '0,0,0'; },
};

// ---------------------------------------------------------------- presentation
const V64 = { big: null, bx: null, light: null, lx: null, bloom: null, blx: null, img: null, stage: null, sx: null };
function present64(LCD, lctx, outW = W * 4, outH = H * 4) {
  const t0 = performance.now(), SC = 4, BW = W * SC, BH = H * SC;
  if (!V64.big) {
    V64.big = mkCanvas(BW, BH); V64.bx = V64.big.getContext('2d');
    V64.light = mkCanvas(BW, BH); V64.lx = V64.light.getContext('2d');
    V64.bloom = mkCanvas(W, H); V64.blx = V64.bloom.getContext('2d');
    V64.img = V64.bx.createImageData(BW, BH);
    V64.stage = mkCanvas(BW, BH); V64.sx = V64.stage.getContext('2d');
  }
  const screen = V64.sx;
  let src;
  // Full-detail pack mode smooth-scales the rendered scene; retro modes keep Scale4x.
  if (S.art === 'packs') {
    src = new Uint32Array(ctx.getImageData(0, 0, W, H).data.buffer);
    V64.bx.imageSmoothingEnabled = false;
    V64.bx.clearRect(0, 0, BW, BH);
    V64.bx.drawImage(cv, 0, 0, BW, BH);
  } else {
    src = grade(new Uint32Array(ctx.getImageData(0, 0, W, H).data.buffer));
    const s4 = scale2x(scale2x(src, W, H), W * 2, H * 2);
    new Uint32Array(V64.img.data.buffer).set(s4);
    V64.bx.putImageData(V64.img, 0, 0);
  }
  const z = Cam.zoom;
  screen.save(); screen.imageSmoothingEnabled = false;
  if (Math.abs(z - 1) < 0.001) screen.drawImage(V64.big, 0, 0);
  else { screen.translate(BW / 2, BH / 2); screen.scale(z, z); screen.translate(-BW / 2, -BH / 2); screen.drawImage(V64.big, 0, 0); }
  // title key art: draw it sharp at full size, then put the live menu and footer back from the framebuffer
  const topSc = scenes[scenes.length - 1];
  if (topSc && topSc.constructor && topSc.constructor.name === 'Title' && topSc.keep && IMG.title_aelmoor_hi) {
    screen.imageSmoothingEnabled = true; screen.drawImage(IMG.title_aelmoor_hi, 0, 0, BW, BH); screen.imageSmoothingEnabled = false;
    for (const [x, y, w, h] of topSc.keep) screen.drawImage(V64.big, x * SC, y * SC, w * SC, h * SC, x * SC, y * SC, w * SC, h * SC);
  }
  // 2. lighting (field scenes only)
  const base = scenes.findLast ? scenes.findLast(s => s.opaque) : scenes.slice().reverse().find(s => s.opaque);
  if (base instanceof Field && Light64.dark > 0.01) {
    const lx = V64.lx; lx.clearRect(0, 0, BW, BH); lx.globalCompositeOperation = 'source-over'; lx.fillStyle = `rgba(${Light64.tint},${Light64.dark})`; lx.fillRect(0, 0, BW, BH);
    lx.globalCompositeOperation = 'destination-out';
    for (const L of Light64.list) { const g = lx.createRadialGradient(L.x * SC, L.y * SC, 0, L.x * SC, L.y * SC, L.r * SC); g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(0.55, `rgba(0,0,0,${L.a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.fillRect(L.x * SC - L.r * SC, L.y * SC - L.r * SC, L.r * SC * 2, L.r * SC * 2); }
    screen.drawImage(V64.light, 0, 0);
    screen.globalCompositeOperation = 'lighter';
    for (const L of Light64.list) { const g = screen.createRadialGradient(L.x * SC, L.y * SC, 0, L.x * SC, L.y * SC, L.r * SC * 0.8); g.addColorStop(0, `rgba(${L.c},${0.16 * Light64.dark * L.a})`); g.addColorStop(1, `rgba(${L.c},0)`); screen.fillStyle = g; screen.fillRect(L.x * SC - L.r * SC, L.y * SC - L.r * SC, L.r * SC * 2, L.r * SC * 2); }
    screen.globalCompositeOperation = 'source-over';
  }
  Light64.list.length = 0;
  // 3. bloom
  // bloom: bright-pass at 80x72, then the browser's smoothing spreads it when drawn up to 640x576
  if (!V64.bp) { V64.bp = mkCanvas(W, H); V64.bpx = V64.bp.getContext('2d'); V64.bpd = V64.bpx.createImageData(W, H); V64.half = mkCanvas(W / 2, H / 2); V64.hx = V64.half.getContext('2d'); }
  brightPass(src, new Uint32Array(V64.bpd.data.buffer)); V64.bpx.putImageData(V64.bpd, 0, 0);
  const bx = V64.hx; bx.imageSmoothingEnabled = true; bx.clearRect(0, 0, W / 2, H / 2); bx.drawImage(V64.bp, 0, 0, W / 2, H / 2);
  V64.bloom = V64.half;
  screen.globalCompositeOperation = 'screen'; screen.globalAlpha = 0.24; screen.imageSmoothingEnabled = true; screen.drawImage(V64.bloom, 0, 0, BW, BH);
  screen.globalAlpha = 1; screen.globalCompositeOperation = 'source-over';
  // 4. vignette
  if (!V64.vig) { V64.vig = mkCanvas(BW, BH); const vx = V64.vig.getContext('2d'), vg = vx.createRadialGradient(BW / 2, BH / 2, BH * 0.45, BW / 2, BH / 2, BH * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); vx.fillStyle = vg; vx.fillRect(0, 0, BW, BH); }
  screen.setTransform(1, 0, 0, 1, 0, 0); screen.drawImage(V64.vig, 0, 0);
  screen.restore();
  Profiler.frame(performance.now() - t0); Profiler.draw(screen);
  if (LCD.width !== outW || LCD.height !== outH) { LCD.width = outW; LCD.height = outH; }
  lctx.save(); lctx.imageSmoothingEnabled = S.art === 'packs'; lctx.drawImage(V64.stage, 0, 0, outW, outH); lctx.restore();
}
Events.on('sfx', k => { if (S.video === 'hd64' && ['crit', 'nat20', 'levelup', 'boss_appear', 'storm_hit', 'boss_die', 'world_boss'].includes(k)) Cam.pulse(k === 'levelup' ? 1.04 : 1.07, 24); });
