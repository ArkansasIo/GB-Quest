// GB QUEST — a tiny Game Boy style RPG. Engine + scenes.
// Screen: 160x144, 4-shade LCD palette (or original sheet colours), 60 fps.
'use strict';
(function () {
const W = 160, H = 144, T = 16;
const cv = document.getElementById('lcd');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Palette sampled from the LCD screens on the sheet (0 = lightest, 3 = darkest)
const LCD = [[160, 168, 104], [112, 124, 72], [60, 76, 42], [22, 32, 18]];
let CSS = LCD.map(c => `rgb(${c[0]},${c[1]},${c[2]})`);
const COLOR_PALETTES = {
  lcd: LCD,
  pocket: [[220,232,220],[150,190,160],[70,125,105],[20,55,55]],
  sunset: [[255,224,174],[238,160,105],[150,75,90],[48,38,70]],
  amber: [[255,239,190],[224,177,90],[145,95,45],[55,42,28]],
  ocean: [[205,235,245],[112,183,207],[48,111,151],[22,45,82]],
};

// ============================================================ storage & settings
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const S = Object.assign({ vol: 3, music: true, bright: 3, contrast: 3, palette: 'lcd', swap: false }, store.get('gbquest_settings') || {});
function applyFilter() { cv.style.filter = `brightness(${0.7 + S.bright * 0.1}) contrast(${0.7 + S.contrast * 0.1})`; }
function saveSettings() { store.set('gbquest_settings', S); applyFilter(); }
applyFilter();

// ============================================================ assets
const ENEMY_KEYS = Object.keys(ENEMIES);
const ITEM_SPRITES = ['iron_sword', 'dagger', 'steel_sword', 'leather_armor', 'goblin_mask', 'iron_helm', 'cap', 'health_potion', 'antidote', 'ether', 'mana_potion', 'elixir', 'tonic', 'bread', 'spellbook', 'scroll', 'key', 'herb', 'boots', 'coin', 'chest', 'chest_open'];
function assetNames() {
  if (window.GB_ASSETS) return Object.keys(window.GB_ASSETS);
  const a = ['font_6x9', 'screen_worldmap', 'fx_sparkle', 'fx_slash', 'fx_burst', 'fx_hit'];
  for (const w of ['villager', 'elder', 'hero']) for (let i = 0; i < 6; i++) a.push(`${w}_${i}`);
  ENEMY_KEYS.forEach(k => a.push('enemy_' + k));
  ITEM_SPRITES.forEach(k => a.push('item_' + k));
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) a.push(`world_${r}_${c}`);
    for (let c = 0; c < 7; c++) a.push(`dungeon_${r}_${c}`);
    for (let c = 0; c < 6; c++) a.push(`icon_${r}_${c}`);
  }
  return a;
}
const IMG = {};
function loadAssets() {
  return Promise.all(assetNames().map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; res(); };
    im.onerror = () => { console.warn('missing asset', n); res(); };
    im.src = (window.GB_ASSETS && window.GB_ASSETS[n]) || `assets/${n}.png`;
  })));
}

// ---- sprite processing: scale + quantise to the LCD palette, cached
const cache = new Map(), groupTh = {};
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function scaled(img, w, h) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.imageSmoothingEnabled = (w !== img.width || h !== img.height);
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, w, h);
  return c;
}
const lum = (d, i) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
function quantiles(datas, qs) {
  const L = [];
  for (const d of datas) for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 110) L.push(lum(d, i));
  L.sort((a, b) => a - b);
  return qs.map(q => L.length ? L[Math.floor(q * (L.length - 1))] : 128);
}
const GROUP_Q = { world: [0.1, 0.38, 0.72], dungeon: [0.25, 0.55, 0.85] };
function groupThresh(g, w, h) {
  const k = g + w + 'x' + h;
  if (!groupTh[k]) {
    const datas = Object.keys(IMG).filter(n => n.startsWith(g + '_')).map(n => scaled(IMG[n], w, h).getContext('2d').getImageData(0, 0, w, h).data);
    groupTh[k] = quantiles(datas, GROUP_Q[g]);
  }
  return groupTh[k];
}
function spr(name, w, h, opt) {
  const img = IMG[name]; if (!img) return null;
  opt = opt || {};
  w = w || img.width; h = h || Math.round(img.height * w / img.width);
  const key = `${name}|${w}|${h}|${S.palette}|${opt.flip ? 1 : 0}|${opt.rot ? 1 : 0}`;
  let c = cache.get(key); if (c) return c;
  c = scaled(img, w, h);
  const x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data;
  let th = null;
  if (S.palette !== 'original') {
    const g = name.split('_')[0];
    th = GROUP_Q[g] ? groupThresh(g, w, h) : quantiles([d], [0.22, 0.48, 0.78]);
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    if (th) {
      const l = lum(d, i), k = l < th[0] ? 3 : l < th[1] ? 2 : l < th[2] ? 1 : 0;
      const palette = COLOR_PALETTES[S.palette] || LCD;
      d[i] = palette[k][0]; d[i + 1] = palette[k][1]; d[i + 2] = palette[k][2];
    }
  }
  x.putImageData(id, 0, 0);
  if (opt.flip || opt.rot) {
    const f = canvas(w, h), fx = f.getContext('2d');
    if (opt.rot) { fx.translate(w / 2, h / 2); fx.rotate(Math.PI / 2); fx.translate(-w / 2, -h / 2); }
    if (opt.flip) { fx.translate(w, 0); fx.scale(-1, 1); }
    fx.drawImage(c, 0, 0); c = f;
  }
  cache.set(key, c); return c;
}
// sprite fitted to a height, keeping aspect
function sprH(name, h, opt) { const img = IMG[name]; if (!img) return null; return spr(name, Math.max(1, Math.round(img.width * h / img.height)), h, opt); }
function blit(c, x, y) { if (c) ctx.drawImage(c, Math.round(x), Math.round(y)); }

// ============================================================ text & UI
const fontC = {};
function applyPalette() {
  const p = COLOR_PALETTES[S.palette] || LCD;
  CSS = p.map(c => `rgb(${c[0]},${c[1]},${c[2]})`);
  cache.clear();
  for (const k of Object.keys(fontC)) delete fontC[k];
}
function font(col) {
  if (!fontC[col]) {
    const im = IMG.font_6x9, c = canvas(im.width, im.height), x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in';
    x.fillStyle = CSS[col]; x.fillRect(0, 0, c.width, c.height); fontC[col] = c;
  }
  return fontC[col];
}
function text(s, x, y, col = 3, sc = 1) {
  const f = font(col); let cx = x; s = String(s);
  for (const ch of s) {
    if (ch === '\n') { y += 10 * sc; cx = x; continue; }
    let code = ch.charCodeAt(0); if (code < 32 || code > 126) code = 63;
    if (code !== 32) ctx.drawImage(f, (code - 32) * 6, 0, 6, 9, cx, y, 6 * sc, 9 * sc);
    cx += 6 * sc;
  }
}
const textR = (s, rx, y, col) => text(s, rx - String(s).length * 6, y, col);
const textC = (s, cx, y, col, sc = 1) => text(s, Math.round(cx - String(s).length * 3 * sc), y, col, sc);
function fill(x, y, w, h, c) { ctx.fillStyle = CSS[c]; ctx.fillRect(x, y, w, h); }
function frame(x, y, w, h, bg = 0) {
  fill(x, y, w, h, 3); fill(x + 1, y + 1, w - 2, h - 2, bg);
  fill(x + 2, y + 2, w - 4, 1, 1); fill(x + 2, y + 2, 1, h - 4, 1);
}
function bar(x, y, w, h, v, max) {
  fill(x, y, w, h, 3); fill(x + 1, y + 1, w - 2, h - 2, 0);
  fill(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, v / max))), h - 2, 2);
}
function segBar(x, y, n, max) { for (let i = 0; i < max; i++) { fill(x + i * 7, y, 6, 7, 3); if (i >= n) fill(x + i * 7 + 1, y + 1, 4, 5, 0); } }
function checkbox(x, y, on) { fill(x, y, 7, 7, 3); fill(x + 1, y + 1, 5, 5, 0); if (on) { fill(x + 2, y + 2, 3, 3, 3); } }
const pad2 = n => String(n).padStart(2, '0');
function header() {
  fill(0, 0, W, 11, 0); fill(0, 11, W, 1, 3);
  const d = new Date(); text(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 3, 1);
  ['icon_3_0', 'icon_2_3', 'icon_2_5', 'icon_3_4'].forEach((n, i) => blit(spr(n, 9, 9), 42 + i * 12, 1));
  const g = String(G.gold); textR(g, W - 3, 1); blit(spr('icon_3_3', 8, 8), W - 13 - g.length * 6, 1);
}
function wrap(s, n = 23) {
  const out = []; let line = '';
  for (const word of s.split(' ')) {
    if ((line + (line ? ' ' : '') + word).length > n) { out.push(line); line = word; }
    else line += (line ? ' ' : '') + word;
  }
  if (line) out.push(line);
  return out;
}
function pages(lines) {
  const res = [];
  for (const l of lines) { const w = wrap(l); for (let i = 0; i < w.length; i += 3) res.push(w.slice(i, i + 3).join('\n')); }
  return res;
}

// ============================================================ input
const BTNS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
const held = {}, pressed = {}, rep = {};
function bDown(b) { audio(); if (!held[b]) { held[b] = true; pressed[b] = true; rep[b] = 0; } }
function bUp(b) { held[b] = false; }
const mapBtn = b => S.swap ? (b === 'a' ? 'b' : b === 'b' ? 'a' : b) : b;
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
  z: 'a', j: 'a', ' ': 'a', x: 'b', k: 'b', Escape: 'b', Backspace: 'b', Enter: 'start', Shift: 'select', Tab: 'select' };
addEventListener('keydown', e => { const b = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (b) { e.preventDefault(); bDown(mapBtn(b)); } });
addEventListener('keyup', e => { const b = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (b) { if (b === 'a' || b === 'b') { bUp('a'); bUp('b'); } else bUp(b); } });
addEventListener('blur', () => BTNS.forEach(bUp));
// touch buttons
document.querySelectorAll('[data-btn]').forEach(el => {
  const b = el.dataset.btn;
  const on = e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); el.classList.add('down'); bDown(mapBtn(b)); };
  const off = e => { e.preventDefault(); el.classList.remove('down'); bUp('a'); bUp('b'); bUp(b); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
});
const dpad = document.getElementById('dpad');
if (dpad) {
  let cur = null;
  const set = d => { if (cur === d) return; if (cur) bUp(cur); cur = d; if (d) bDown(d); dpad.dataset.dir = d || ''; };
  const at = e => {
    const r = dpad.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };
  dpad.addEventListener('pointerdown', e => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); set(at(e)); });
  dpad.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') set(at(e)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => dpad.addEventListener(t, () => set(null)));
}
const P = b => pressed[b];
const nav = b => pressed[b] || (held[b] && rep[b] > 18 && rep[b] % 5 === 0);

// ============================================================ audio (square/triangle beeps like the DMG APU)
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type = 'square', vol = 0.06, when = 0, slide = 0, music = false) {
  if (!AC || S.vol === 0 || (music && !S.music)) return;
  const t = AC.currentTime + Math.max(0, when), o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(vol * S.vol / 3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.03);
}
const seq = (notes, step, type = 'square', vol = 0.06) => notes.forEach((f, i) => tone(f, step * 0.9, type, vol, i * step));
const SFX = {
  blip: () => tone(1046, 0.035),
  sel: () => seq([784, 1175], 0.05),
  back: () => tone(392, 0.06),
  bump: () => tone(98, 0.06, 'square', 0.05),
  hit: () => tone(220, 0.14, 'sawtooth', 0.07, 0, -160),
  crit: () => { tone(330, 0.2, 'sawtooth', 0.08, 0, -260); tone(1200, 0.05, 'square', 0.05); },
  hurt: () => tone(140, 0.2, 'square', 0.08, 0, -90),
  miss: () => tone(600, 0.1, 'triangle', 0.07, 0, 300),
  heal: () => seq([523, 659, 784, 1046], 0.07, 'triangle', 0.09),
  coin: () => seq([988, 1319], 0.06),
  item: () => seq([659, 784, 988, 1319], 0.07),
  enc: () => seq([440, 349, 440, 349, 523, 659], 0.05),
  lvl: () => seq([523, 659, 784, 1046, 784, 1046, 1319], 0.09),
  win: () => seq([392, 523, 659, 784, 0, 659, 784], 0.11),
  lose: () => seq([392, 370, 349, 330, 262], 0.16, 'triangle', 0.09),
  magic: () => { tone(200, 0.35, 'sawtooth', 0.06, 0, 900); tone(1600, 0.2, 'square', 0.03, 0.1, -900); },
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const Music = {
  cur: null, step: 0, next: 0,
  play(name) {
    if (this.cur === name) return;
    this.cur = name; this.step = 0; this.next = AC ? AC.currentTime + 0.08 : 0;
  },
  stop() { this.cur = null; },
  tick() {
    if (!AC || !this.cur || !S.music || S.vol === 0) return;
    const s = SONGS[this.cur], dt = 60 / s.bpm / 2;
    if (this.next < AC.currentTime - 0.5) this.next = AC.currentTime + 0.05;
    while (this.next < AC.currentTime + 0.25) {
      const i = this.step % s.lead.length, t = this.next - AC.currentTime;
      if (s.lead[i]) tone(mtof(s.lead[i]), dt * 0.85, 'square', 0.022, t, 0, true);
      if (s.bass[i]) tone(mtof(s.bass[i]), dt * 1.5, 'triangle', 0.05, t, 0, true);
      this.step++; this.next += dt;
    }
  },
};
setInterval(() => Music.tick(), 60);

// ============================================================ game state
let G;
function newGame() {
  G = {
    lvl: 1, exp: 0, hp: 30, mhp: 30, mp: 12, mmp: 12, str: 8, def: 6, dex: 8, gold: 125,
    inv: { health_potion: 3, mana_potion: 2, bread: 5 },
    eq: { weapon: 'dagger', shield: null, helm: 'cap', armor: null, boots: null },
    map: START.map, x: START.x, y: START.y, dir: START.dir, poison: false, steps: 0,
    flags: { elder: false, herbs: 0, herbReward: false, relic: false, king: false, chests: {}, herbTaken: {} },
  };
}
newGame();
const saveGame = () => store.set('gbquest_save', G);
const hasSave = () => !!store.get('gbquest_save');
function loadGame() { const s = store.get('gbquest_save'); if (!s) return false; newGame(); Object.assign(G, s); G.flags = Object.assign(G.flags, s.flags); return true; }

const gearSum = k => SLOTS.reduce((a, s) => a + ((G.eq[s] && ITEMS[G.eq[s]][k]) || 0), 0);
const atkT = () => G.str + gearSum('atk');
const defT = () => G.def + gearSum('def');
const dexT = () => G.dex + gearSum('dex');
const expNext = lvl => Math.floor(12 * Math.pow(lvl, 1.6) + 8);
function addItem(k, n = 1) { G.inv[k] = (G.inv[k] || 0) + n; }
function takeItem(k) { if (!G.inv[k]) return false; G.inv[k]--; if (!G.inv[k]) delete G.inv[k]; return true; }
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const dmgCalc = (atk, def) => Math.max(1, Math.round(atk - def / 2 + rnd(-2, 2)));

function useItem(k) {
  const it = ITEMS[k];
  if (!it || it.type !== 'use') return { ok: false, msg: "Can't use that now." };
  const needHp = it.hp && G.hp < G.mhp, needMp = it.mp && G.mp < G.mmp, needCure = it.cure && G.poison;
  if (!needHp && !needMp && !needCure) return { ok: false, msg: it.cure && !it.hp ? 'You are not poisoned.' : 'It would have no effect.' };
  takeItem(k);
  const parts = [];
  if (it.hp) { const h = Math.min(it.hp, G.mhp - G.hp); G.hp += h; if (h) parts.push(`+${h} HP`); }
  if (it.mp) { const m = Math.min(it.mp, G.mmp - G.mp); G.mp += m; if (m) parts.push(`+${m} MP`); }
  if (it.cure && G.poison) { G.poison = false; parts.push('Cured!'); }
  return { ok: true, msg: `Used ${it.name}. ${parts.join(' ')}` };
}
function equip(k) {
  const it = ITEMS[k]; if (!it || it.type !== 'gear') return false;
  const old = G.eq[it.slot]; if (old) addItem(old);
  takeItem(k); G.eq[it.slot] = k; return true;
}
function levelUps() {
  const out = [];
  while (G.exp >= expNext(G.lvl)) {
    G.exp -= expNext(G.lvl);
    const g = { from: G.lvl, to: G.lvl + 1, hp: rnd(5, 8), mp: rnd(2, 4), str: rnd(1, 3), def: rnd(1, 2), dex: rnd(1, 2) };
    G.lvl++; G.mhp += g.hp; G.mmp += g.mp; G.str += g.str; G.def += g.def; G.dex += g.dex;
    G.hp = G.mhp; G.mp = G.mmp; out.push(g);
    const sk = SKILLS.find(s => s.lvl === G.lvl); if (sk) g.skill = sk.name;
  }
  return out;
}

// ============================================================ scene stack
const scenes = [];
let shake = 0, frameN = 0;
function push(s) { scenes.push(s); s.enter && s.enter(); }
function pop() { const s = scenes.pop(); const t = scenes[scenes.length - 1]; t && t.resume && t.resume(); return s; }
const top = () => scenes[scenes.length - 1];
function reset(s) { scenes.length = 0; push(s); }
function say(lines, cb) { push(new Dialog(Array.isArray(lines) ? lines : [lines], cb)); }

// ---------------------------------------------------------------- Dialog
class Dialog {
  constructor(lines, cb) { this.p = pages(lines); this.i = 0; this.c = 0; this.cb = cb; }
  update() {
    const L = this.p[this.i];
    if (this.c < L.length) { this.c += 1.5; if (P('a') || P('b')) this.c = L.length; return; }
    if (P('a') || P('b')) {
      SFX.blip(); this.i++; this.c = 0;
      if (this.i >= this.p.length) { pop(); this.cb && this.cb(); }
    }
  }
  draw() {
    const y = H - 44; frame(2, y, W - 4, 42);
    const L = this.p[this.i]; if (!L) return;
    text(L.slice(0, Math.floor(this.c)), 8, y + 6);
    if (this.c >= L.length && (frameN >> 4) % 2) text('v', W - 14, y + 31);
  }
}

// ---------------------------------------------------------------- Choice (with optional prompt)
class Choice {
  constructor(opts, cb, prompt) { this.o = opts; this.cb = cb; this.prompt = prompt; this.i = 0; }
  update() {
    const n = this.o.length;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.blip(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.blip(); }
    if (P('a')) { SFX.sel(); pop(); this.cb(this.i); }
    else if (P('b')) { SFX.back(); pop(); this.cb(-1); }
  }
  draw() {
    if (this.prompt) { frame(2, H - 44, W - 4, 42); text(wrap(this.prompt).join('\n'), 8, H - 38); }
    const w = Math.max(...this.o.map(s => s.length)) * 6 + 18, h = this.o.length * 11 + 8;
    const x = W - w - 2, y = (this.prompt ? H - 46 : H - 2) - h;
    frame(x, y, w, h);
    this.o.forEach((s, i) => { text(s, x + 13, y + 5 + i * 11); if (i === this.i) text('>', x + 5, y + 5 + i * 11); });
  }
}

// ---------------------------------------------------------------- transitions
class Flash {
  constructor(cb) { this.t = 0; this.cb = cb; }
  update() { if (++this.t > 40) { pop(); this.cb(); } }
  draw() {
    const k = this.t >> 3;
    if (k < 3) { if ((this.t >> 2) % 2) fill(0, 0, W, H, 3); }
    else { const n = Math.min(H, (this.t - 24) * 10); for (let y = 0; y < H; y += 8) fill(0, y, W, Math.min(8, n / 18 * 8), 3); }
  }
}
class Fade {
  constructor(cb) { this.t = 0; this.cb = cb; }
  update() {
    this.t++;
    if (this.t === 16) { this.cb(); const i = scenes.indexOf(this); if (i >= 0) scenes.splice(i, 1); scenes.push(this); } // stay on top for the fade-in
    if (this.t >= 32) { const i = scenes.indexOf(this); if (i >= 0) scenes.splice(i, 1); }
  }
  draw() { const a = this.t < 16 ? this.t / 16 : (32 - this.t) / 16; ctx.globalAlpha = Math.min(1, a); fill(0, 0, W, H, 3); ctx.globalAlpha = 1; }
}

// ============================================================ TITLE
class Title {
  constructor() { this.opaque = true; this.t = 0; this.menu = false; this.i = 0; }
  enter() { Music.play('title'); }
  resume() { Music.play('title'); }
  opts() { return hasSave() ? ['CONTINUE', 'CAMPAIGN', 'MULTIPLAYER', 'NEW GAME'] : ['CAMPAIGN', 'MULTIPLAYER', 'NEW GAME']; }
  update() {
    this.t++;
    if (!this.menu) { if (P('start') || P('a')) { SFX.sel(); this.menu = true; this.i = 0; } return; }
    const o = this.opts();
    if (nav('up') || nav('down')) { this.i = (this.i + 1) % o.length; SFX.blip(); }
    if (P('b')) { this.menu = false; SFX.back(); }
    if (P('a') || P('start')) {
      SFX.sel();
      const choice = o[this.i];
      if (choice === 'MULTIPLAYER') { push(new MultiplayerInfo()); return; }
      if (choice === 'CONTINUE') loadGame(); else newGame();
      push(new Fade(() => {
        reset(new Field());
        if (choice !== 'CONTINUE') say(['THE SHATTERED CROWN: ACT I', 'You wake outside the castle. The village OLD MAN wanted to see you...', 'START: menu   A: talk/check']);
      }));
    }
  }
  draw() {
    const bg = spr('screen_worldmap', 256, 144); // the sheet's own map screen, as a backdrop
    blit(bg, -48 + Math.round(Math.sin(this.t / 200) * 40), 0);
    ctx.globalAlpha = 0.55; fill(0, 0, W, H, 0); ctx.globalAlpha = 1;
    frame(14, 10, 132, 42);
    textC('GB QUEST', 81, 18, 2, 2); textC('GB QUEST', 80, 17, 3, 2);
    textC('A POCKET RPG', 80, 38, 2);
    const bob = Math.round(Math.sin(this.t / 12)) ;
    blit(spr('hero_4'), 34, 62 + bob);
    blit(spr('enemy_goblin', null, null, { flip: true }), 88, 66 - bob);
    if (!this.menu) { if ((this.t >> 5) % 2 === 0) { frame(40, 120, 80, 16); textC('PRESS START', 80, 124, 3); } }
    else {
      const o = this.opts(); frame(44, 114 - (o.length - 1) * 11, 72, 10 + o.length * 11);
      o.forEach((s, i) => { text(s, 58, 119 - (o.length - 1) * 11 + i * 11); if (i === this.i) text('>', 50, 119 - (o.length - 1) * 11 + i * 11); });
    }
  }
}


// ------------------------------------------------------------ multiplayer status screen
class MultiplayerInfo {
  constructor() { this.opaque = true; }
  update() { if (P('a') || P('b') || P('start')) { SFX.back(); pop(); } }
  draw() {
    fill(0,0,W,H,0); header(); frame(3,14,154,127);
    textC('MULTIPLAYER',80,22,3);
    textC('ONLINE SERVICE',80,42,2);
    textC('NOT CONNECTED',80,54,3);
    text('PARTY CO-OP: 1-5',10,76,3);
    text('RAIDS: UP TO 20',10,89,3);
    text('GUILDS / CHAT / QUESTS',10,102,3);
    text('SERVER SETUP REQUIRED',10,118,2);
    textC('A/B: BACK',80,132,3);
  }
}
\n// ============================================================ FIELD
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const HERO_F = { down: [0, 3], up: [3, 0], left: [5, 1], right: [4, 2] };
const NPCS = [
  { id: 'elder', m: 'world', x: 5, y: 16, spr: 'elder_0', talk: () => talkElder() },
  { id: 'v1', m: 'world', x: 4, y: 14, spr: 'villager_0', talk: () => say(['Herbs grow in the wild. Slimes drop them too!', 'The OLD MAN pays well for ten of them.']) },
  { id: 'v2', m: 'world', x: 7, y: 12, spr: 'villager_3', talk: () => say(['Forests hide stronger monsters. Level up on the plains first!']) },
  { id: 'guard', m: 'world', x: 2, y: 7, spr: 'villager_4', talk: () => say(['Rest at the castle gate to restore HP and MP. It also saves your game.']) },
  { id: 'king', m: 'dungeon', x: 17, y: 4, spr: 'enemy_goblinking', h: 26, boss: true, cond: () => !G.flags.king, talk: () => bossTalk() },
];
function entitiesOn(m) {
  const e = [];
  for (const id in CHESTS) { const c = CHESTS[id]; if (c.m === m) e.push({ kind: 'chest', id, x: c.x, y: c.y, open: !!G.flags.chests[id] }); }
  if (m === 'world') HERBS.forEach(([x, y], i) => { if (!G.flags.herbTaken[i]) e.push({ kind: 'herb', id: i, x, y }); });
  NPCS.forEach(n => { if (n.m === m && (!n.cond || n.cond())) e.push(Object.assign({ kind: 'npc' }, n)); });
  return e;
}
function tileDef(m, x, y) { const r = MAPS[m].rows[y]; if (!r || x < 0 || x >= r.length) return null; return MAPS[m].tiles[r[x]]; }
const tileCh = (m, x, y) => (MAPS[m].rows[y] || '')[x];

class Field {
  constructor() { this.opaque = true; this.ox = 0; this.oy = 0; this.walk = 0; this.since = 0; this.toast = 90; }
  enter() { Music.play(MAPS[G.map].music); }
  resume() { Music.play(MAPS[G.map].music); }
  warp(p) { G.map = p.map; G.x = p.x; G.y = p.y; G.dir = p.dir; this.ox = this.oy = 0; this.toast = 90; this.since = 0; Music.play(MAPS[G.map].music); }
  blocked(x, y) {
    const d = tileDef(G.map, x, y); if (!d || !d[1]) return true;
    return entitiesOn(G.map).some(e => e.x === x && e.y === y && e.kind !== 'herb');
  }
  update() {
    if (this.toast > 0) this.toast--;
    if (this.ox || this.oy) {
      this.ox -= Math.sign(this.ox) * 2; this.oy -= Math.sign(this.oy) * 2; this.walk += 2;
      if (!this.ox && !this.oy) this.onStep();
      return;
    }
    if (P('start')) { SFX.sel(); push(new MainMenu()); return; }
    if (P('select')) { SFX.sel(); push(new MapScreen()); return; }
    if (P('a')) { this.interact(); return; }
    for (const d of ['up', 'down', 'left', 'right']) {
      if (!held[d]) continue;
      G.dir = d;
      const [dx, dy] = DIRS[d], nx = G.x + dx, ny = G.y + dy;
      if (this.blocked(nx, ny)) {
        if (P(d) || rep[d] % 20 === 0) { if (!this.bumpAction(nx, ny)) SFX.bump(); }
      } else { G.x = nx; G.y = ny; this.ox = -dx * T; this.oy = -dy * T; }
      break;
    }
  }
  bumpAction(x, y) {
    const ch = tileCh(G.map, x, y);
    if (G.map === 'world' && (ch === 'a' || ch === 'k')) { this.interactAt(x, y); return true; }
    return false;
  }
  interact() { const [dx, dy] = DIRS[G.dir]; this.interactAt(G.x + dx, G.y + dy); }
  interactAt(x, y) {
    const e = entitiesOn(G.map).find(e => e.x === x && e.y === y);
    if (e && e.kind === 'npc') { SFX.blip(); e.talk(); return; }
    if (e && e.kind === 'chest') {
      if (e.open) { say('The chest is empty.'); return; }
      const c = CHESTS[e.id]; G.flags.chests[e.id] = true; addItem(c.item); SFX.item();
      say(`Found ${ITEMS[c.item].name}!` + (ITEMS[c.item].type === 'gear' ? ' Equip it from the menu.' : '')); return;
    }
    const ch = tileCh(G.map, x, y);
    if (G.map === 'world') {
      if (ch === 'a') {
        G.hp = G.mhp; G.mp = G.mmp; G.poison = false; saveGame(); SFX.heal();
        say(['You rest at the castle. HP and MP restored!', 'Game saved.']); return;
      }
      if (ch === 'k') {
        if (!G.inv.key) { say(['The great door is locked tight.', 'Maybe the OLD MAN in the village knows something.']); return; }
        SFX.sel(); push(new Fade(() => this.warp(KEEP_ENTRY))); return;
      }
      if (ch === 'H' || ch === 'J') { say('A cosy village house. Nobody answers.'); return; }
      if (ch === 'r' || ch === 'q') { say('A small stone shrine. You feel calm.'); return; }
      if (ch === 'A' || ch === 'K') { say('Tall stone walls.'); return; }
    } else {
      if (ch === 'n') { say(['The sign reads: BEWARE THE KING. He SMASHES every third blow.']); return; }
      if (ch === 'A') {
        if (G.flags.relic) { say('An empty altar.'); return; }
        G.flags.relic = true; addItem('relic'); SFX.lvl();
        say(['You found the LOST RELIC!', 'Bring it back to the OLD MAN.']); return;
      }
      if (ch === 't') { say('A torch flickers on the wall.'); return; }
      if (ch === 'b') { say('Barrels of goblin grog. Smells awful.'); return; }
      if (ch === 's') { say('A grim stone statue of a goblin.'); return; }
    }
  }
  onStep() {
    G.steps++; this.since++;
    if (G.poison && G.steps % 4 === 0 && G.hp > 1) { G.hp--; shake = 3; SFX.hurt(); }
    if (G.map === 'world') {
      const i = HERBS.findIndex(([x, y]) => x === G.x && y === G.y);
      if (i >= 0 && !G.flags.herbTaken[i]) {
        G.flags.herbTaken[i] = true; G.flags.herbs++; addItem('herb'); SFX.coin();
        say(`Picked a HERB! (${Math.min(10, G.flags.herbs)}/10)`); return;
      }
    }
    if (tileCh(G.map, G.x, G.y) === 'L' && G.map === 'dungeon') { SFX.sel(); push(new Fade(() => this.warp(KEEP_EXIT))); return; }
    const d = tileDef(G.map, G.x, G.y), zone = d && d[2];
    if (zone && this.since > 4 && Math.random() < ENCOUNTER_RATE[zone]) {
      this.since = 0; startBattle(pick(ZONES[zone]));
    }
  }
  draw() {
    const m = MAPS[G.map], cols = m.rows[0].length, rows = m.rows.length;
    const px = G.x * T + this.ox, py = G.y * T + this.oy;
    const cx = Math.max(0, Math.min(cols * T - W, px - 72)), cy = Math.max(0, Math.min(rows * T - H, py - 64));
    const sx = shake ? rnd(-1, 1) : 0;
    for (let ty = Math.floor(cy / T); ty <= Math.floor((cy + H) / T); ty++)
      for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + W) / T); tx++) {
        const d = tileDef(G.map, tx, ty); if (!d) continue;
        blit(spr(d[0], T, T, { rot: d[3] }), tx * T - cx + sx, ty * T - cy);
      }
    const list = entitiesOn(G.map).map(e => Object.assign(e, { sy: e.y * T }));
    list.push({ kind: 'player', sy: py });
    list.sort((a, b) => a.sy - b.sy);
    for (const e of list) {
      if (e.kind === 'player') {
        const f = HERO_F[G.dir][(this.ox || this.oy) ? (this.walk >> 3) % 2 : 0];
        const c = sprH('hero_' + f, 23); blit(c, px - cx + (T - c.width) / 2 + sx, py - cy + T - 23 - 1);
      } else if (e.kind === 'herb') {
        if ((frameN >> 5) % 4 !== 0) blit(sprH('item_herb', 11), e.x * T - cx + 3 + sx, e.y * T - cy + 3);
        else blit(sprH('item_herb', 11), e.x * T - cx + 3 + sx, e.y * T - cy + 2);
      } else if (e.kind === 'chest') {
        blit(spr(e.open ? 'item_chest_open' : 'item_chest', 14), e.x * T - cx + 1 + sx, e.y * T - cy + 2);
      } else if (e.kind === 'npc') {
        const h = e.h || 23, c = sprH(e.spr, h);
        const bob = e.boss ? Math.round(Math.sin(frameN / 10)) : 0;
        blit(c, e.x * T - cx + (T - c.width) / 2 + sx, e.y * T - cy + T - h - 1 + bob);
      }
    }
    if (this.toast > 0) { const n = m.name; frame(80 - n.length * 3 - 6, 4, n.length * 6 + 12, 15); textC(n, 80, 7); }
  }
}

function startBattle(key) {
  Music.stop(); SFX.enc();
  push(new Flash(() => push(new Battle(key))));
}
function bossTalk() {
  say(['GOBLIN KING: Who dares enter my hall?!', 'The relic is MINE! I will crush you!'], () => { Music.stop(); SFX.enc(); push(new Flash(() => push(new Battle('goblinking')))); });
}
function talkElder() {
  const F = G.flags;
  if (F.relic && F.king) {
    say(['OLD MAN: The LOST RELIC! And the Goblin King is beaten!', 'You are a true hero. The village will sing of you!'], () => {
      push(new Fade(() => reset(new Ending())));
    });
    return;
  }
  if (!F.elder) {
    F.elder = true; addItem('key'); addItem('health_potion', 2); SFX.item();
    say(['OLD MAN: Ah, you came! Goblins stole our LOST RELIC.', 'Their KING hides in the GOBLIN KEEP, across the river to the north-east.',
      'Take this OLD KEY, and these potions.', 'Got OLD KEY and 2 HEALTH POTIONS!', 'Bring me 10 HERBS too, and I shall reward you.'], openShop);
    return;
  }
  if (F.herbs >= 10 && !F.herbReward) {
    F.herbReward = true; addItem('elixir'); G.gold += 50; SFX.item();
    say(['Ten herbs! Splendid.', 'Got an ELIXIR and 50 G!'], openShop); return;
  }
  say(F.relic ? 'You have the relic! But the King still lives...' : `The keep lies north-east. Herbs so far: ${Math.min(10, F.herbs)}/10.`, openShop);
}
const SHOP = [['health_potion', 20], ['ether', 40], ['antidote', 10], ['bread', 5]];
function openShop() {
  push(new Choice(['POTION   20G', 'ETHER    40G', 'ANTIDOTE 10G', 'BREAD     5G', 'LEAVE'], i => {
    if (i < 0 || i === 4) return;
    const [k, price] = SHOP[i];
    if (G.gold < price) { say("You can't afford that.", openShop); return; }
    G.gold -= price; addItem(k); SFX.coin(); say(`Bought ${ITEMS[k].name}. Thank you!`, openShop);
  }, `Need supplies? You have ${G.gold} G.`));
}

// ============================================================ MAIN MENU
class MainMenu {
  constructor() { this.opaque = true; this.i = 0; this.o = ['ITEMS', 'EQUIP', 'STATUS', 'QUESTS', 'MAP', 'SETTINGS', 'SAVE', 'CLOSE']; }
  update() {
    const n = this.o.length;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.blip(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.blip(); }
    if (P('b') || P('start')) { SFX.back(); pop(); return; }
    if (P('a')) {
      SFX.sel();
      switch (this.o[this.i]) {
        case 'ITEMS': push(new Inventory('field')); break;
        case 'EQUIP': push(new Equip()); break;
        case 'STATUS': push(new Status()); break;
        case 'QUESTS': push(new Quests()); break;
        case 'MAP': push(new MapScreen()); break;
        case 'SETTINGS': push(new Settings()); break;
        case 'SAVE': saveGame(); say('Game saved.'); break;
        case 'CLOSE': pop(); break;
      }
    }
  }
  draw() {
    fill(0, 0, W, H, 0); header();
    fill(38, 12, 1, H - 12, 3); fill(110, 12, 1, H - 12, 3);
    blit(spr('hero_0'), 4, 30);
    textC(`LV${G.lvl}`, 19, 86);
    if (G.poison) textC('PSN', 19, 98, 2);
    this.o.forEach((s, i) => {
      const y = 16 + i * 15;
      if (i === this.i) { fill(41, y - 3, 67, 14, 3); textC(s, 74, y, 0); } else textC(s, 74, y);
    });
    const rows = [['icon_0_0', atkT()], ['icon_0_1', defT()], ['icon_3_1', G.hp], ['icon_1_0', G.mp], ['icon_1_5', dexT()]];
    rows.forEach(([ic, v], i) => { blit(spr(ic, 10, 10), 115, 17 + i * 18); textR(v, W - 4, 18 + i * 18); });
    text('HERBS', 116, 110); textR(`${Math.min(10, G.flags.herbs)}/10`, W - 4, 121);
  }
}

// ============================================================ INVENTORY / ITEM USE
class Inventory {
  constructor(mode, cb) { this.opaque = true; this.mode = mode; this.cb = cb; this.i = 0; this.top = 0; this.msg = null; this.mt = 0; }
  list() { return Object.keys(G.inv).filter(k => G.inv[k] > 0 && ITEMS[k] && (this.mode !== 'battle' || ITEMS[k].type === 'use')); }
  update() {
    const L = this.list(), n = L.length;
    if (this.mt > 0 && --this.mt === 0) this.msg = null;
    if (P('b')) { SFX.back(); pop(); return; }
    if (!n) return;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.blip(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.blip(); }
    this.i = Math.min(this.i, n - 1);
    if (this.i < this.top) this.top = this.i; if (this.i > this.top + 5) this.top = this.i - 5;
    if (P('a')) {
      const k = L[this.i], it = ITEMS[k];
      if (this.mode === 'battle') { pop(); this.cb(k); return; }
      if (it.type === 'gear') { equip(k); SFX.sel(); this.flash(`Equipped ${it.name}.`); }
      else if (it.type === 'use') { const r = useItem(k); if (r.ok) SFX.heal(); else SFX.bump(); this.flash(r.msg); }
      else { SFX.bump(); this.flash(it.desc); }
    }
  }
  flash(m) { this.msg = m; this.mt = 120; }
  draw() {
    fill(0, 0, W, H, 0); header();
    frame(3, 14, 154, 90);
    const L = this.list();
    if (!L.length) textC('No items.', 80, 52);
    L.slice(this.top, this.top + 6).forEach((k, j) => {
      const i = this.top + j, y = 19 + j * 14, it = ITEMS[k];
      if (i === this.i) fill(5, y - 2, 140, 14, 1);
      blit(spr(it.icon, 11, 11), 8, y);
      text(it.name, 22, y + 1); text(`x${String(G.inv[k]).padStart(2, ' ')}`, 120, y + 1);
    });
    if (L.length > 6) { fill(149, 18, 4, 82, 1); const h = Math.max(8, 82 * 6 / L.length); fill(149, 18 + (82 - h) * this.top / (L.length - 6), 4, h, 3); }
    frame(3, 107, 154, 34);
    const k = L[this.i], it = k && ITEMS[k];
    let d = this.msg || (it ? it.desc : '');
    if (!this.msg && it && it.type === 'gear') d += Object.values(G.eq).includes(k) ? '' : '  (A: equip)';
    if (!this.msg && G.poison && this.mode !== 'battle') d = d || 'You are poisoned!';
    text(wrap(d, 24).slice(0, 3).join('\n'), 8, 111);
  }
}

// ============================================================ STATUS
class Status {
  constructor() { this.opaque = true; }
  update() { if (P('b') || P('a')) { SFX.back(); pop(); } }
  draw() {
    fill(0, 0, W, H, 0); header();
    frame(3, 14, 154, 127);
    blit(spr('hero_0'), 10, 26); textC('HERO', 25, 82);
    if (G.poison) textC('PSN', 25, 94, 2);
    text('HP', 50, 22); textR(`${G.hp}/${G.mhp}`, 150, 22); bar(50, 32, 100, 5, G.hp, G.mhp);
    text('MP', 50, 42); textR(`${G.mp}/${G.mmp}`, 150, 42); bar(50, 52, 100, 5, G.mp, G.mmp);
    const st = [['STR', G.str, atkT() - G.str, 'ATK', atkT()], ['DEF', G.def, defT() - G.def], ['DEX', G.dex, dexT() - G.dex]];
    st.forEach(([n, v, b], i) => { text(n, 50, 62 + i * 11); textR(v, 92, 62 + i * 11); if (b) text(`+${b}`, 96, 62 + i * 11, 2); });
    text('ATK', 50, 96); textR(atkT(), 92, 96); text('G', 112, 96, 2); textR(G.gold, 150, 96);
    fill(5, 110, 150, 1, 3);
    text(`LVL ${pad2(G.lvl)}`, 9, 115); text('EXP', 66, 115); textR(`${G.exp}/${expNext(G.lvl)}`, 152, 115);
    bar(66, 127, 86, 5, G.exp, expNext(G.lvl));
  }
}

// ============================================================ EQUIPMENT
class Equip {
  constructor() { this.opaque = true; this.i = 0; }
  options(slot) { return [null, ...Object.keys(G.inv).filter(k => ITEMS[k] && ITEMS[k].slot === slot)]; }
  update() {
    if (P('b')) { SFX.back(); pop(); return; }
    if (nav('up')) { this.i = (this.i + 4) % 5; SFX.blip(); }
    if (nav('down')) { this.i = (this.i + 1) % 5; SFX.blip(); }
    const dir = nav('right') || P('a') ? 1 : nav('left') ? -1 : 0;
    if (dir) {
      const slot = SLOTS[this.i], cur = G.eq[slot];
      const opts = this.options(slot); // currently-equipped item is not in inv, so cycle: cur -> opts
      const ring = [cur, ...opts.filter(o => o !== null)];
      if (cur !== null) ring.push(null);
      const uniq = ring.filter((v, i, a) => a.indexOf(v) === i);
      if (uniq.length < 2) { SFX.bump(); return; }
      const next = uniq[(uniq.indexOf(cur) + dir + uniq.length) % uniq.length];
      if (cur) addItem(cur);
      G.eq[slot] = null;
      if (next) { takeItem(next); G.eq[slot] = next; }
      SFX.sel();
    }
  }
  draw() {
    fill(0, 0, W, H, 0); header();
    frame(3, 14, 154, 98);
    blit(spr('hero_0'), 65, 30);
    const pos = [[10, 22], [10, 52], [125, 22], [125, 52], [125, 82]];
    SLOTS.forEach((s, i) => {
      const [x, y] = pos[i], k = G.eq[s];
      fill(x - 2, y - 2, 26, 26, i === this.i ? 3 : 2); fill(x, y, 22, 22, i === this.i ? 1 : 0);
      if (k) blit(spr(ITEMS[k].icon, 18, 18), x + 2, y + 2);
      else { ctx.globalAlpha = 0.35; blit(spr(SLOT_ICON[s], 14, 14), x + 4, y + 4); ctx.globalAlpha = 1; }
    });
    text(`ATK ${atkT()}`, 8, 88); text(`DEF ${defT()}`, 8, 98); text(`DEX ${dexT()}`, 66, 98);
    frame(3, 114, 154, 27);
    const s = SLOTS[this.i], k = G.eq[s];
    text(s.toUpperCase(), 8, 118, 2); text(k ? ITEMS[k].name : '- NONE -', 56, 118);
    text(k ? ITEMS[k].desc.split('. ').pop() : '</> or A: change', 8, 129);
  }
}

// ============================================================ QUESTS
const QUESTS = [
  { name: () => 'FIND THE LOST RELIC', done: () => G.flags.relic },
  { name: () => 'DEFEAT THE GOBLIN KING', done: () => G.flags.king },
  { name: () => `COLLECT 10 HERBS ${Math.min(10, G.flags.herbs)}/10`, done: () => G.flags.herbs >= 10 },
  { name: () => 'VISIT THE OLD MAN', done: () => G.flags.elder },
];
class Quests {
  constructor() { this.opaque = true; }
  update() { if (P('b') || P('a')) { SFX.back(); pop(); } }
  draw() {
    fill(0, 0, W, H, 0); header();
    const act = QUESTS.filter(q => !q.done()), done = QUESTS.filter(q => q.done());
    frame(3, 14, 154, 60); text('ACTIVE', 8, 17, 2);
    act.forEach((q, i) => { fill(9, 30 + i * 11, 2, 6, 3); fill(9, 37 + i * 11, 2, 1, 3); text(q.name(), 16, 29 + i * 11); });
    if (!act.length) text('All done! See the OLD MAN.', 8, 30);
    frame(3, 77, 154, 64, 1); text('COMPLETE', 8, 80, 3);
    done.forEach((q, i) => { checkbox(8, 93 + i * 11, true); text(q.name(), 18, 92 + i * 11); });
  }
}

// ============================================================ MAP
class MapScreen {
  constructor() { this.opaque = true; }
  update() { if (P('b') || P('a') || P('select')) { SFX.back(); pop(); } }
  draw() {
    fill(0, 0, W, H, 0); header();
    const m = MAPS[G.map], cols = m.rows[0].length, rows = m.rows.length;
    const s = Math.min(Math.floor(152 / cols), Math.floor(110 / rows));
    const ox = Math.floor((W - cols * s) / 2), oy = 16;
    fill(ox - 2, oy - 2, cols * s + 4, rows * s + 4, 3);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const d = tileDef(G.map, x, y); blit(spr(d[0], s, s, { rot: d[3] }), ox + x * s, oy + y * s); }
    for (const e of entitiesOn(G.map)) {
      if (e.kind === 'npc' && e.id === 'elder') { fill(ox + e.x * s, oy + e.y * s, s, s, 0); }
      if (e.kind === 'npc' && e.boss) { fill(ox + e.x * s, oy + e.y * s, s, s, 3); }
    }
    if ((frameN >> 3) % 2) { fill(ox + G.x * s - 1, oy + G.y * s - 1, s + 2, s + 2, 3); fill(ox + G.x * s, oy + G.y * s, s, s, 0); }
    frame(3, 128, 154, 14); text(m.name, 8, 131); textR(`${pad2(G.x)},${pad2(G.y)}`, 152, 131);
  }
}

// ============================================================ SETTINGS
class Settings {
  constructor() { this.opaque = true; this.i = 0; this.rows = ['SOUND', 'MUSIC', 'BRIGHTNESS', 'CONTRAST', 'PALETTE', 'BUTTON MODE', 'RESET SAVE DATA']; }
  update() {
    const n = this.rows.length;
    if (P('b')) { SFX.back(); saveSettings(); pop(); return; }
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.blip(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.blip(); }
    const d = nav('right') ? 1 : nav('left') ? -1 : P('a') ? 2 : 0;
    if (!d) return;
    const r = this.rows[this.i], clamp = v => Math.max(0, Math.min(6, v));
    if (r === 'SOUND') S.vol = clamp(S.vol + (d === 2 ? 1 : d)) ;
    if (r === 'MUSIC') S.music = !S.music;
    if (r === 'BRIGHTNESS') S.bright = clamp(S.bright + (d === 2 ? 1 : d));
    if (r === 'CONTRAST') S.contrast = clamp(S.contrast + (d === 2 ? 1 : d));
    if (r === 'PALETTE') { const modes = ['lcd', 'pocket', 'sunset', 'amber', 'ocean', 'original']; S.palette = modes[(modes.indexOf(S.palette) + 1) % modes.length]; applyPalette(); }
    if (r === 'BUTTON MODE') S.swap = !S.swap;
    if (r === 'RESET SAVE DATA') {
      if (d !== 2) return;
      push(new Choice(['NO', 'YES'], i => { if (i === 1) { store.del('gbquest_save'); newGame(); push(new Fade(() => reset(new Title()))); } }, 'Erase all save data?'));
      return;
    }
    saveSettings(); SFX.blip();
  }
  draw() {
    fill(0, 0, W, H, 0); header();
    frame(3, 14, 154, 127);
    const val = [S.vol, S.music ? 'ON' : 'OFF', S.bright, S.contrast, ({lcd:'DMG',pocket:'POCKET',sunset:'SUNSET',amber:'AMBER',ocean:'OCEAN',original:'ORIGINAL'})[S.palette] || 'DMG', S.swap ? 'B' : 'A'];
    this.rows.forEach((r, i) => {
      const y = 20 + i * 15;
      if (i === 6) { fill(7, y - 3, 146, 15, 3); fill(8, y - 2, 144, 13, i === this.i ? 1 : 0); text(r, 12, y + 1); return; }
      if (i === this.i) fill(6, y - 2, 148, 13, 1);
      text(r, 9, y);
      const v = val[i];
      if (typeof v === 'number') segBar(104, y + 1, v, 6); else textR(v, 150, y);
    });
  }
}

// ============================================================ BATTLE
class Battle {
  constructor(key) {
    this.opaque = true;
    this.e = Object.assign({ key, dex: 8 }, ENEMIES[key]); this.e.mhp = this.e.hp;
    this.state = 'idle'; this.mi = 0; this.si = 0; this.turn = 0;
    this.fx = null; this.nums = []; this.eflash = 0; this.hflash = 0; this.lunge = 0; this.elunge = 0; this.dead = 0;
    this.run([{ text: `${this.e.boss ? '' : 'A wild '}${this.e.name} appears!` }], () => this.toMenu());
  }
  enter() { Music.play(this.e.boss ? 'boss' : 'battle'); }
  resume() { if (!this.dead) Music.play(this.e.boss ? 'boss' : 'battle'); }
  run(steps, then) { this.q = steps.slice(); this.then = then; this.state = 'msg'; this.next(); }
  next() {
    const s = this.q.shift();
    if (!s) { this.state = 'idle'; const t = this.then; this.then = null; t && t(); return; }
    this.cur = s; this.c = 0; this.hold = s.wait || 0; this.auto = 0; s.act && s.act();
  }
  toMenu() { this.state = 'menu'; }
  showFx(name, target, t = 20) { this.fx = { name, target, t, max: t }; }
  num(v, target) { this.nums.push({ v: String(v), target, t: 40 }); }
  update() {
    if (this.fx && --this.fx.t <= 0) this.fx = null;
    this.nums.forEach(n => n.t--); this.nums = this.nums.filter(n => n.t > 0);
    ['eflash', 'hflash', 'lunge', 'elunge'].forEach(k => { if (this[k] > 0) this[k]--; });
    if (this.dead > 0 && this.dead < 30) this.dead++;
    if (this.state === 'msg') {
      const L = this.cur.text;
      if (this.c < L.length) { this.c += 1.5; if (P('a')) this.c = L.length; return; }
      if (this.hold > 0) { this.hold--; return; }
      this.auto++;
      if (P('a') || P('b') || this.auto > 75) { this.next(); }
      return;
    }
    if (this.state === 'menu') {
      if (nav('up') || nav('down')) { this.mi ^= 2; SFX.blip(); }
      if (nav('left') || nav('right')) { this.mi ^= 1; SFX.blip(); }
      if (P('a')) {
        SFX.sel();
        if (this.mi === 0) this.playerAttack(1, 'fx_slash', 'You attack!');
        if (this.mi === 1) { this.state = 'skill'; this.si = 0; }
        if (this.mi === 2) push(new Inventory('battle', k => this.useItem(k)));
        if (this.mi === 3) this.tryRun();
      }
      return;
    }
    if (this.state === 'skill') {
      const sk = SKILLS.filter(s => s.lvl <= G.lvl), n = sk.length;
      if (nav('up')) { this.si = (this.si + n - 1) % n; SFX.blip(); }
      if (nav('down')) { this.si = (this.si + 1) % n; SFX.blip(); }
      if (P('b')) { SFX.back(); this.state = 'menu'; }
      if (P('a')) {
        const s = sk[this.si];
        if (G.mp < s.mp) { SFX.bump(); return; }
        G.mp -= s.mp; SFX.sel();
        if (s.id === 'fire') this.playerAttack(1.8, 'fx_burst', 'FIRE SLASH!', true);
        if (s.id === 'bolt') this.playerAttack(2.8, 'fx_hit', 'THUNDER!', true);
        if (s.id === 'heal') {
          const h = Math.min(G.mhp - G.hp, Math.ceil(G.mhp * 0.4));
          this.run([{ text: 'You cast HEAL!', act: () => { this.showFx('fx_sparkle', 'hero', 30); SFX.heal(); }, wait: 20 },
            { text: `Recovered ${h} HP.`, act: () => { G.hp += h; } }], () => this.enemyTurn());
        }
      }
    }
  }
  playerAttack(mult, fx, label, magic) {
    const e = this.e;
    const miss = !magic && Math.random() < 0.06;
    const crit = !miss && !magic && Math.random() < dexT() / 100;
    let d = dmgCalc(atkT() * mult, e.def * (magic ? 0.5 : 1)); if (crit) d *= 2;
    const after = Math.max(0, e.hp - d);
    const steps = [{ text: label, act: () => { this.lunge = 12; magic ? SFX.magic() : null; }, wait: 8 }];
    if (miss) steps.push({ text: `${e.name} dodged!`, act: () => SFX.miss() });
    else steps.push({
      text: (crit ? 'Critical hit! ' : '') + `You deal ${d} damage!\n${e.name} HP ${after}/${e.mhp}`,
      act: () => { this.showFx(fx, 'enemy'); crit ? SFX.crit() : SFX.hit(); e.hp = after; this.eflash = 24; this.num(d, 'enemy'); if (crit) shake = 8; },
    });
    this.run(steps, () => e.hp <= 0 ? this.win() : this.enemyTurn());
  }
  useItem(k) {
    const r = useItem(k);
    this.run([{ text: r.msg, act: () => { if (r.ok) { SFX.heal(); this.showFx('fx_sparkle', 'hero', 30); } else SFX.bump(); } }],
      () => r.ok ? this.enemyTurn() : this.toMenu());
  }
  tryRun() {
    if (this.e.boss) { this.run([{ text: "You can't escape!" }], () => this.enemyTurn()); return; }
    const ok = Math.random() < 0.55 + (dexT() - this.e.dex) / 40;
    if (ok) this.run([{ text: 'Got away safely!', act: () => SFX.miss() }], () => this.end());
    else this.run([{ text: "Couldn't escape!" }], () => this.enemyTurn());
  }
  enemyTurn() {
    const e = this.e; this.turn++;
    const smash = e.boss && this.turn % 3 === 0;
    const dodge = Math.random() < dexT() / 170;
    const d = dmgCalc(e.atk * (smash ? 1.6 : 1), defT());
    const steps = [{ text: smash ? `${e.name} uses SMASH!` : `${e.name} attacks!`, act: () => { this.elunge = 12; }, wait: 10 }];
    if (dodge) steps.push({ text: 'You dodged it!', act: () => SFX.miss() });
    else {
      steps.push({ text: `You take ${d} damage!`, act: () => { G.hp = Math.max(0, G.hp - d); this.showFx('fx_hit', 'hero', 14); this.hflash = 20; shake = smash ? 12 : 6; SFX.hurt(); this.num(d, 'hero'); } });
      if (e.poison && !G.poison && Math.random() < 0.3) steps.push({ text: 'You were poisoned!', act: () => { G.poison = true; SFX.hurt(); } });
    }
    this.run(steps, () => {
      if (G.hp <= 0) return this.lose();
      if (G.poison) {
        const p = Math.min(2, G.hp - 1);
        if (p > 0) return this.run([{ text: `Poison hurts! -${p} HP`, act: () => { G.hp -= p; this.hflash = 10; } }], () => this.toMenu());
      }
      this.toMenu();
    });
  }
  win() {
    const e = this.e, drop = e.drop && Math.random() < 0.4 ? e.drop : null;
    const steps = [
      { text: `${e.name} is defeated!`, act: () => { this.dead = 1; Music.stop(); SFX.win(); }, wait: 30 },
      { text: `Got ${e.exp} EXP and ${e.gold} G.`, act: () => { G.exp += e.exp; G.gold += e.gold; SFX.coin(); } },
    ];
    if (drop) steps.push({ text: `It dropped ${ITEMS[drop].name}!`, act: () => { addItem(drop); if (drop === 'herb') G.flags.herbs++; SFX.item(); } });
    if (e.boss) steps.push({ text: 'The Goblin King has fallen!', act: () => { G.flags.king = true; } });
    this.run(steps, () => {
      const ups = levelUps();
      const chain = () => { const g = ups.shift(); if (g) push(new LevelUp(g, chain)); else this.end(e.boss ? () => say(['The way to the altar is open.', 'The LOST RELIC must be there!']) : null); };
      chain();
    });
  }
  lose() {
    this.run([{ text: 'You fainted...', act: () => { Music.stop(); SFX.lose(); }, wait: 40 }], () => {
      G.hp = G.mhp; G.mp = G.mmp; G.poison = false; G.gold = Math.floor(G.gold / 2);
      push(new Fade(() => {
        scenes.length = 0; const f = new Field(); push(f); f.warp(START);
        say(['You wake up at the castle gate...', 'Half your gold is gone.']);
      }));
    });
  }
  end(after) {
    push(new Fade(() => {
      const i = scenes.indexOf(this), below = scenes[i - 1];
      scenes.splice(i, 1); below && below.resume && below.resume(); after && after();
    }));
  }
  draw() {
    fill(0, 0, W, H, 0); header();
    const e = this.e;
    // hero panel
    text(`HERO LV${G.lvl}`, 4, 14);
    text('HP', 4, 24); textR(`${G.hp}/${G.mhp}`, 68, 24); bar(4, 33, 64, 4, G.hp, G.mhp);
    text('MP', 4, 39); textR(`${G.mp}/${G.mmp}`, 68, 39); bar(4, 48, 64, 4, G.mp, G.mmp);
    if (G.poison) text('PSN', 4, 53, 2);
    // enemy panel
    textR(e.name, 156, 14); bar(92, 24, 64, 4, e.hp, e.mhp);
    fill(0, 93, W, 1, 2);
    // sprites
    const hero = spr('hero_4');
    if (!(this.hflash && (this.hflash >> 1) % 2)) blit(hero, 10 + (this.lunge ? Math.min(6, 12 - this.lunge) : 0) + (shake ? rnd(-1, 1) : 0), 92 - hero.height);
    const es = sprH('enemy_' + e.key, Math.min(54, IMG['enemy_' + e.key].height + (e.boss ? 8 : 0)), { flip: true });
    const ex = 122 - es.width / 2 - (this.elunge ? Math.min(6, 12 - this.elunge) : 0), ey = 92 - es.height;
    if (this.dead) { if (this.dead < 24 && (this.dead >> 1) % 2) blit(es, ex, ey); }
    else if (!(this.eflash && (this.eflash >> 1) % 2)) blit(es, ex + (this.eflash ? rnd(-1, 1) : 0), ey);
    // fx
    if (this.fx) {
      const f = spr(this.fx.name); const s = 36 / Math.max(f.width, f.height);
      const fc = spr(this.fx.name, Math.round(f.width * s), Math.round(f.height * s));
      const [tx, ty] = this.fx.target === 'enemy' ? [122, 66] : [25, 66];
      if ((this.fx.t >> 1) % 3 !== 0) blit(fc, tx - fc.width / 2, ty - fc.height / 2);
    }
    for (const n of this.nums) {
      const [tx, ty] = n.target === 'enemy' ? [122, 46] : [25, 46];
      const y = ty - (40 - n.t) / 2;
      text(n.v, tx - n.v.length * 3 + 1, y + 1, 0); text(n.v, tx - n.v.length * 3, y, 3);
    }
    // message box
    frame(2, 96, 156, 46);
    if (this.state === 'msg' && this.cur) text(this.cur.text.slice(0, Math.floor(this.c)), 8, 101);
    if (this.state === 'menu') {
      text('What will you do?', 8, 101);
      ['ATTACK', 'SKILL', 'ITEM', 'RUN'].forEach((s, i) => {
        const x = 20 + (i % 2) * 70, y = 115 + (i >> 1) * 12;
        if (i === this.mi) { fill(x - 9, y - 2, 64, 12, 3); text(s, x, y, 0); text('>', x - 8, y, 0); } else text(s, x, y);
      });
    }
    if (this.state === 'skill') {
      const sk = SKILLS.filter(s => s.lvl <= G.lvl);
      sk.forEach((s, i) => {
        const y = 101 + i * 12, col = G.mp >= s.mp ? 3 : 1;
        if (i === this.si) text('>', 8, y);
        text(s.name, 16, y, col); textR(`${s.mp}MP`, 152, y, col);
      });
      if (sk.length < 3) text(sk[this.si].desc, 16, 101 + 2 * 12 + 1, 2);
    }
  }
}

// ============================================================ LEVEL UP
class LevelUp {
  constructor(g, cb) { this.opaque = true; this.g = g; this.cb = cb; this.t = 0; }
  enter() { SFX.lvl(); }
  update() { this.t++; if (this.t > 30 && (P('a') || P('b') || P('start'))) { SFX.sel(); pop(); this.cb(); } }
  draw() {
    fill(0, 0, W, H, 0); header();
    frame(3, 14, 154, 127);
    const g = this.g;
    blit(spr('hero_0'), 10, 40 + (this.t < 20 ? Math.round(Math.sin(this.t / 2) * 3) : 0));
    for (let i = 0; i < 9; i++) {
      const x = 50 + ((i * 37) % 100), y = 20 + ((i * 53) % 110);
      if (((this.t >> 3) + i) % 3 === 0) text('+', x, y, 1);
    }
    if ((this.t >> 4) % 2) blit(spr('fx_sparkle', 14), 138, 98); else blit(spr('fx_sparkle', 10), 30, 104);
    textC('LEVEL UP!', 100, 20, 3, 2);
    text(`LVL ${pad2(g.from)}`, 52, 46); text('>', 106, 46, 2); text(pad2(g.to), 120, 46);
    text('You feel stronger!', 46, 60);
    text(`HP +${g.hp}`, 50, 76); text(`MP +${g.mp}`, 104, 76);
    text(`STR+${g.str}`, 50, 88); text(`DEF+${g.def}`, 104, 88); text(`DEX+${g.dex}`, 50, 100);
    if (g.skill) text(`Learned ${g.skill}!`, 46, 116, 2);
    if (this.t > 30 && (this.t >> 4) % 2) text('v', 146, 128);
  }
}

// ============================================================ ENDING
class Ending {
  constructor() { this.opaque = true; this.t = 0; }
  enter() { Music.play('title'); saveGame(); }
  update() { this.t++; if (this.t > 120 && (P('start') || P('a'))) { SFX.sel(); push(new Fade(() => reset(new Title()))); } }
  draw() {
    fill(0, 0, W, H, 0);
    frame(4, 4, 152, 136);
    textC('THE END', 80, 12, 3, 2);
    blit(spr('hero_0'), 40, 38); blit(spr('elder_0', null, null, { flip: true }), 92, 40);
    blit(spr('item_spellbook', 18), 71, 50 + Math.round(Math.sin(this.t / 15) * 2));
    textC('The relic is home.', 80, 94); textC('Peace returns.', 80, 104);
    textC(`LV${G.lvl}  STEPS ${G.steps}`, 80, 116, 2);
    if (this.t > 120 && (this.t >> 5) % 2) textC('PRESS START', 80, 128);
  }
}

// ============================================================ main loop
let last = 0, acc = 0;
function tick() {
  frameN++;
  const s = top(); if (s) s.update();
  if (shake > 0) shake--;
  for (const b of BTNS) { pressed[b] = false; if (held[b]) rep[b]++; }
}
function render() {
  let i = scenes.length - 1; while (i > 0 && !scenes[i].opaque) i--;
  for (; i < scenes.length; i++) scenes[i].draw();
}
function loop(t) {
  requestAnimationFrame(loop);
  if (!last) last = t;
  acc += Math.min(100, t - last); last = t;
  let n = 0;
  while (acc >= 1000 / 60 && n < 4) { acc -= 1000 / 60; tick(); n++; }
  render();
}
// debug/test hooks
window.GBQ = { get G() { return G; }, scenes, push, pop, reset, startBattle, Title, Field, MainMenu, Inventory, Status, Equip, Quests, MapScreen, Settings, MultiplayerInfo, Battle, LevelUp, Ending, bDown, bUp, tick, render, S, cache };

function start(data) {
  loadAssets().then(() => {
    applyPalette();
    document.body.classList.add('ready');
    if (data && data.G) { newGame(); Object.assign(G, data.G); reset(new Field()); } // resume after a live page update
    else reset(new Title());
    requestAnimationFrame(loop);
  });
}
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => (scenes.some(s => s instanceof Field) ? { G } : {}));
if (hot && hot.ready) hot.ready(start); else start(hot && hot.data || {});
})();
