'use strict';
// ================================================================ 64-BIT AUDIO ENGINE
// A second sound engine in the style of 64-bit-era consoles: stereo, reverb, a compressor on the master,
// 8 music voices playing synthesized instruments (strings, brass, flute, harp, FM bells, choir, organ, piano, bass)
// and a sampled-style drum kit. Pick it in SETTINGS > AUDIO. Every chip SFX is upgraded automatically and
// the important ones have hand-made layered versions (SFX64). The 24 tracks get full arrangements (ARR64).

let A64 = null;
function a64() {
  if (A64) return A64;
  const ac = audioCtx(); if (!ac) return null;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
  // reverb: 2.4 s stereo impulse (decaying filtered noise), shared send
  const len = Math.floor(ac.sampleRate * 2.4), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / len, 3.2); } }
  const verb = ac.createConvolver(); verb.buffer = ir; const verbGain = ac.createGain(); verbGain.gain.value = 0.55; verb.connect(verbGain); verbGain.connect(master);
  // stereo echo for leads
  const dl = ac.createDelay(1.0), fb = ac.createGain(), dlOut = ac.createGain(), dlf = ac.createBiquadFilter();
  dl.delayTime.value = 0.28; fb.gain.value = 0.32; dlOut.gain.value = 0.28; dlf.type = 'lowpass'; dlf.frequency.value = 2600;
  dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dlOut); dlOut.connect(master);
  const white = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const music = ac.createGain(), sfx = ac.createGain(); music.connect(master); sfx.connect(master);
  return (A64 = { ac, master, verb, delay: dl, white, music, sfx });
}
const busGain = bus => { const v = bus === 'music' ? S.music : S.vol; return v / 3; };

// ---------------------------------------------------------------- one synth voice
// o: {wave|waves, f, f1, t, dur, vol, a(attack), r(release), pan, lp, lpEnd, q, hp, bp, vib, vibDepth, detune, fm:{ratio,index}, rev, echo, bus, noise}
function voice64(o) {
  const X = a64(); if (!X) return; const ac = X.ac;
  const bv = busGain(o.bus || 'sfx'); if (!bv) return;
  const t = Math.max(ac.currentTime, o.t || ac.currentTime), dur = Math.max(0.01, o.dur || 0.2), a = o.a ?? 0.005, r = o.r ?? 0.08;
  const vol = (o.vol ?? 0.1) * bv, end = t + dur + r;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
  if (o.sustain != null) { g.gain.setTargetAtTime(vol * o.sustain, t + a, (o.decay || 0.2) / 3); g.gain.setValueAtTime(vol * o.sustain, t + dur); }
  else g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.25), t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  // filter chain
  let head = g;
  const chain = [];
  if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 0.8; f.frequency.setValueAtTime(o.lp, t); if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, t + (o.lpTime || dur)); chain.push(f); }
  if (o.hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; chain.push(f); }
  if (o.bp) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = o.q || 1.2; f.frequency.setValueAtTime(o.bp, t); if (o.bpEnd) f.frequency.exponentialRampToValueAtTime(o.bpEnd, t + dur); chain.push(f); }
  const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
  if (pan) pan.pan.value = Math.max(-1, Math.min(1, o.pan || 0));
  let node = g; for (const f of chain) { node.connect(f); node = f; }
  const out = pan || node; if (pan) node.connect(pan);
  out.connect(o.bus === 'music' ? X.music : X.sfx);
  if (o.rev) { const s = ac.createGain(); s.gain.value = o.rev; out.connect(s); s.connect(X.verb); }
  if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; out.connect(s); s.connect(X.delay); }
  // sources
  const srcs = [];
  if (o.noise) {
    const s = ac.createBufferSource(); s.buffer = X.white; s.loop = true; s.playbackRate.value = o.rate || 1; s.connect(head); srcs.push(s);
  } else {
    const waves = o.waves || [o.wave || 'sine'], det = o.detune || 0;
    waves.forEach((w, i) => {
      const osc = ac.createOscillator();
      if (w === 'pulse25') osc.setPeriodicWave(pulse25); else if (w === 'pulse12') osc.setPeriodicWave(pulse12); else osc.type = w;
      const mul = o.mults ? o.mults[i] : 1;
      osc.frequency.setValueAtTime(Math.max(20, o.f * mul), t);
      if (o.f1 && o.f1 !== o.f) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 * mul), t + (o.glide || dur));
      if (waves.length > 1 && det) osc.detune.value = (i - (waves.length - 1) / 2) * det;
      if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vibDepth || 6, t + Math.min(0.3, dur)); l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(end + 0.05); }
      if (o.fm) { const m = ac.createOscillator(), mg = ac.createGain(); m.frequency.value = o.f * o.fm.ratio; mg.gain.setValueAtTime(o.f * o.fm.index, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f * 0.05), t + dur); m.connect(mg); mg.connect(osc.frequency); m.start(t); m.stop(end + 0.05); }
      let dst = head;
      if (o.levels) { const lg = ac.createGain(); lg.gain.value = o.levels[i]; lg.connect(head); dst = lg; }
      osc.connect(dst); srcs.push(osc);
    });
  }
  for (const s of srcs) { s.start(t); s.stop(end + 0.05); }
}

// ---------------------------------------------------------------- instruments
const INST64 = {
  strings: (f, t, d, v, o) => voice64({ ...o, waves: ['sawtooth', 'sawtooth', 'sawtooth'], detune: 9, f, t, dur: d, vol: v * 0.55, a: 0.18, r: 0.45, lp: 2400, sustain: 0.8, vib: 5, vibDepth: 5, rev: 0.45 }),
  pad: (f, t, d, v, o) => voice64({ ...o, waves: ['sawtooth', 'triangle', 'sawtooth'], detune: 12, f, t, dur: d, vol: v * 0.4, a: 0.35, r: 0.8, lp: 1500, sustain: 0.9, rev: 0.6 }),
  brass: (f, t, d, v, o) => voice64({ ...o, waves: ['sawtooth', 'sawtooth'], detune: 6, f, t, dur: d, vol: v * 0.6, a: 0.04, r: 0.15, lp: 700, lpEnd: 2800, lpTime: 0.09, sustain: 0.7, vib: 5.5, vibDepth: 4, rev: 0.3 }),
  flute: (f, t, d, v, o) => { voice64({ ...o, waves: ['sine', 'triangle'], levels: [1, 0.35], mults: [1, 2], f, t, dur: d, vol: v * 0.8, a: 0.05, r: 0.12, sustain: 0.85, vib: 5, vibDepth: 9, rev: 0.35, echo: 0.35 }); voice64({ ...o, noise: true, bp: f * 2, q: 2, t, dur: d * 0.5, vol: v * 0.08, a: 0.02, r: 0.05 }); },
  harp: (f, t, d, v, o) => voice64({ ...o, waves: ['triangle', 'sine'], levels: [0.7, 0.6], mults: [1, 2], f, t, dur: Math.max(d, 0.9), vol: v * 0.7, a: 0.003, r: 0.4, lp: 4200, lpEnd: 900, lpTime: 0.8, rev: 0.4 }),
  piano: (f, t, d, v, o) => voice64({ ...o, waves: ['triangle', 'square', 'sine'], levels: [0.8, 0.12, 0.5], mults: [1, 1, 2], f, t, dur: Math.max(d, 0.7), vol: v * 0.75, a: 0.003, r: 0.3, lp: 3600, lpEnd: 1000, lpTime: 0.6, rev: 0.3 }),
  bell: (f, t, d, v, o) => voice64({ ...o, wave: 'sine', fm: { ratio: 3.5, index: 2.2 }, f, t, dur: Math.max(d, 1.2), vol: v * 0.55, a: 0.002, r: 0.8, rev: 0.55, echo: 0.2 }),
  choir: (f, t, d, v, o) => voice64({ ...o, waves: ['sawtooth', 'sawtooth'], detune: 14, f, t, dur: d, vol: v * 0.5, a: 0.25, r: 0.5, bp: 900, q: 1.1, sustain: 0.9, vib: 4.5, vibDepth: 7, rev: 0.6 }),
  organ: (f, t, d, v, o) => voice64({ ...o, waves: ['sine', 'sine', 'sine', 'sine'], mults: [0.5, 1, 2, 3], levels: [0.6, 1, 0.5, 0.25], f, t, dur: d, vol: v * 0.45, a: 0.01, r: 0.1, sustain: 1, vib: 6.5, vibDepth: 3, rev: 0.35 }),
  synth: (f, t, d, v, o) => voice64({ ...o, waves: ['pulse25', 'square'], detune: 10, f, t, dur: d, vol: v * 0.4, a: 0.01, r: 0.12, lp: 3000, lpEnd: 1400, lpTime: 0.2, sustain: 0.7, rev: 0.25, echo: 0.3 }),
  bass: (f, t, d, v, o) => voice64({ ...o, waves: ['sine', 'sawtooth'], levels: [1, 0.35], f, t, dur: d, vol: v, a: 0.006, r: 0.08, lp: 900, lpEnd: 380, lpTime: 0.25, sustain: 0.6 }),
  slap: (f, t, d, v, o) => voice64({ ...o, waves: ['square', 'sine'], levels: [0.4, 1], f, t, dur: d, vol: v, a: 0.002, r: 0.06, lp: 2200, lpEnd: 300, lpTime: 0.12 }),
  timpani: (f, t, d, v, o) => { voice64({ ...o, wave: 'sine', f: f * 1.5, f1: f, glide: 0.08, t, dur: 0.9, vol: v * 1.2, a: 0.002, r: 0.4, rev: 0.4 }); voice64({ ...o, noise: true, lp: 500, t, dur: 0.25, vol: v * 0.3, a: 0.002, r: 0.1 }); },
};
const DRUM64 = {
  k: (t, v, b) => { voice64({ bus: b, wave: 'sine', f: 160, f1: 42, glide: 0.11, t, dur: 0.22, vol: v * 1.4, a: 0.001, r: 0.06 }); voice64({ bus: b, noise: true, lp: 1800, t, dur: 0.02, vol: v * 0.3, a: 0.001, r: 0.01 }); },
  s: (t, v, b) => { voice64({ bus: b, noise: true, bp: 1900, q: 0.7, t, dur: 0.16, vol: v * 0.9, a: 0.001, r: 0.08, rev: 0.25 }); voice64({ bus: b, wave: 'triangle', f: 200, f1: 150, t, dur: 0.08, vol: v * 0.6, a: 0.001, r: 0.03 }); },
  h: (t, v, b) => voice64({ bus: b, noise: true, hp: 7500, t, dur: 0.035, vol: v * 0.35, a: 0.001, r: 0.02, pan: 0.3 }),
  o: (t, v, b) => voice64({ bus: b, noise: true, hp: 6500, t, dur: 0.22, vol: v * 0.3, a: 0.001, r: 0.1, pan: 0.3 }),
  t: (t, v, b) => voice64({ bus: b, wave: 'sine', f: 180, f1: 90, t, dur: 0.25, vol: v * 0.9, a: 0.001, r: 0.08, rev: 0.25, pan: -0.25 }),
  c: (t, v, b) => voice64({ bus: b, noise: true, hp: 4200, t, dur: 1.4, vol: v * 0.35, a: 0.001, r: 0.6, rev: 0.4, pan: -0.2 }),
  x: (t, v, b) => voice64({ bus: b, noise: true, bp: 6000, q: 3, t, dur: 0.05, vol: v * 0.25, a: 0.01, r: 0.02, pan: 0.4 }), // shaker
};

// ---------------------------------------------------------------- arrangements for all 24 tracks
// lead / counter / pad / bass instrument, drum kit feel, counter style ('arp' | 'echo' | 'none')
const ARR64 = {
  boot: { lead: 'bell', pad: 'strings', bass: 'bass' },
  title: { lead: 'brass', counter: 'harp', pad: 'strings', bass: 'bass', cstyle: 'arp', crash: true },
  character: { lead: 'flute', counter: 'harp', pad: 'pad', bass: 'bass', cstyle: 'arp' },
  prologue: { lead: 'choir', counter: 'bell', pad: 'strings', bass: 'bass', cstyle: 'echo', timp: true },
  town: { lead: 'flute', counter: 'piano', pad: 'pad', bass: 'slap', cstyle: 'arp', shaker: true },
  field: { lead: 'brass', counter: 'harp', pad: 'strings', bass: 'bass', cstyle: 'arp', crash: true },
  coast: { lead: 'flute', counter: 'harp', pad: 'pad', bass: 'slap', cstyle: 'arp', shaker: true },
  marsh: { lead: 'synth', counter: 'bell', pad: 'choir', bass: 'bass', cstyle: 'echo' },
  jungle: { lead: 'flute', counter: 'piano', pad: 'pad', bass: 'slap', cstyle: 'arp', shaker: true, toms: true },
  snow: { lead: 'bell', counter: 'harp', pad: 'strings', bass: 'bass', cstyle: 'echo' },
  desert: { lead: 'synth', counter: 'harp', pad: 'pad', bass: 'bass', cstyle: 'arp', toms: true },
  volcano: { lead: 'brass', counter: 'organ', pad: 'choir', bass: 'bass', cstyle: 'arp', timp: true, crash: true },
  dusk: { lead: 'choir', counter: 'bell', pad: 'pad', bass: 'bass', cstyle: 'echo' },
  crystal: { lead: 'bell', counter: 'harp', pad: 'pad', bass: 'bass', cstyle: 'arp' },
  dungeon: { lead: 'organ', counter: 'bell', pad: 'choir', bass: 'bass', cstyle: 'echo', timp: true },
  raid: { lead: 'brass', counter: 'strings', pad: 'choir', bass: 'bass', cstyle: 'arp', timp: true, crash: true },
  tower: { lead: 'synth', counter: 'harp', pad: 'strings', bass: 'bass', cstyle: 'arp', crash: true },
  battle: { lead: 'brass', counter: 'strings', pad: 'pad', bass: 'bass', cstyle: 'arp', crash: true, toms: true },
  boss: { lead: 'brass', counter: 'organ', pad: 'choir', bass: 'bass', cstyle: 'arp', timp: true, crash: true, toms: true },
  arcboss: { lead: 'choir', counter: 'brass', pad: 'strings', bass: 'bass', cstyle: 'arp', timp: true, crash: true, toms: true },
  victory: { lead: 'brass', pad: 'strings', bass: 'bass' }, defeat: { lead: 'strings', pad: 'choir', bass: 'bass' },
  inn: { lead: 'piano', counter: 'harp', pad: 'pad', bass: 'bass', cstyle: 'arp' },
  credits: { lead: 'flute', counter: 'harp', pad: 'strings', bass: 'slap', cstyle: 'arp', crash: true, shaker: true },
};
// Composes an A and a B section per track: legato lead, triad pads, arpeggio/echo counter-melody, walking bass, drum fills.
function compose64(id) {
  const t = TRACKS[id], arr = ARR64[id] || ARR64.field, r = RNG('music64-' + id), sc = SCALES[t.scale];
  const deg = (d, oct = 0) => t.root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
  const ev = []; // {s: step, i: instrument, m: midi, d: steps, v}
  const prog = t.prog.length < 4 ? [...t.prog, ...t.prog, ...t.prog, ...t.prog].slice(0, 4) : t.prog;
  const sections = [{ prog, lift: 0 }, { prog: prog.map((c, i) => i % 2 ? c + 1 : c + 5 - 7 * (c + 5 > 6)), lift: 2 }];
  let step = 0;
  for (const sec of sections) for (let rep = 0; rep < 2; rep++) sec.prog.forEach((ch, bi) => {
    const bar = step;
    // pad: full triad held for the bar
    if (arr.pad) [0, 2, 4].forEach(k => ev.push({ s: bar, i: arr.pad, m: deg(ch + k), d: 8, v: 0.05 }));
    // lead: rhythmic phrase, notes held until the next onset
    const rhythm = r.pick(['x.x.xx.x', 'x..xx.x.', 'xx.x.xx.', 'x.xxx.x.', 'x...x.x.', 'x..x..x.']);
    let last = ch + 7 + sec.lift, ons = [];
    for (let i = 0; i < 8; i++) if (rhythm[i] === 'x') { last = r.pick([ch + 7, ch + 9, ch + 11, last + 1, last - 1, ch + 14].map(x => x + (rep && r() < 0.3 ? sec.lift : 0))); ons.push([i, deg(last)]); }
    ons.forEach(([i, m], k) => { const nx = k + 1 < ons.length ? ons[k + 1][0] : 8; ev.push({ s: bar + i, i: arr.lead, m, d: nx - i, v: 0.075 }); });
    // counter melody
    if (arr.counter && arr.cstyle === 'arp') for (let i = 0; i < 8; i++) ev.push({ s: bar + i, i: arr.counter, m: deg(ch + [0, 2, 4, 7, 4, 2, 0, 4][i], 1) - (arr.counter === 'strings' || arr.counter === 'brass' || arr.counter === 'organ' ? 12 : 0), d: 1, v: 0.035 });
    if (arr.counter && arr.cstyle === 'echo') ons.forEach(([i, m]) => ev.push({ s: bar + i + 2, i: arr.counter, m: m + 12, d: 2, v: 0.03 }));
    // bass: root / fifth / walk to next chord
    const next = sec.prog[(bi + 1) % sec.prog.length];
    [[0, ch], [2, ch], [3, ch + 4], [4, ch], [6, ch + 4], [7, next - 1]].forEach(([i, d]) => ev.push({ s: bar + i, i: arr.bass, m: deg(d, -1) - 12 * (deg(d, -1) > 55), d: 1, v: 0.12 }));
    if (arr.timp && bi === 0) ev.push({ s: bar, i: 'timpani', m: deg(ch, -1), d: 2, v: 0.12 });
    // drums
    const dp = t.drums || '';
    if (dp) for (let i = 0; i < 8; i++) { const c = dp[(bar + i) % dp.length]; if (c && c !== '.') ev.push({ s: bar + i, dr: c, v: 0.11 }); if (arr.shaker && i % 2) ev.push({ s: bar + i, dr: 'x', v: 0.08 }); }
    if (arr.crash && bi === 0 && rep === 0) ev.push({ s: bar, dr: 'c', v: 0.1 });
    if (arr.toms && bi === sec.prog.length - 1 && rep === 1) [4, 5, 6, 7].forEach(i => ev.push({ s: bar + i, dr: 't', v: 0.1 }));
    step += 8;
  });
  const by = Array.from({ length: step }, () => []); ev.forEach(e => by[e.s % step].push(e));
  return { by, len: step, bpm: t.bpm };
}
const JINGLE64 = {
  boot: [[72, 'bell', 0, 2], [79, 'bell', 1, 2], [84, 'bell', 2, 6], [60, 'strings', 0, 8], [64, 'strings', 0, 8], [67, 'strings', 0, 8]],
  victory: [[72, 'brass', 0, 1], [76, 'brass', 1, 1], [79, 'brass', 2, 1], [84, 'brass', 3, 3], [79, 'brass', 6, 1], [84, 'brass', 7, 1], [88, 'brass', 8, 6], [48, 'timpani', 0, 2], [48, 'timpani', 8, 2], [60, 'strings', 8, 6], [64, 'strings', 8, 6], [67, 'strings', 8, 6]],
  defeat: [[67, 'strings', 0, 2], [65, 'strings', 2, 2], [63, 'strings', 4, 2], [60, 'strings', 6, 6], [48, 'choir', 0, 12], [51, 'choir', 0, 12], [43, 'bass', 6, 6]],
};
function jingle64(id) {
  const X = a64(); if (!X) return; const t0 = X.ac.currentTime + 0.05, st = 60 / (TRACKS[id].bpm || 120) / 2;
  for (const [m, ins, s, d] of JINGLE64[id] || []) INST64[ins](N(m), t0 + s * st, d * st, 0.09, { bus: 'music', pan: ins === 'strings' ? -0.2 : 0.15 });
}
function music64Tick(M) {
  const X = a64(); if (!X) return;
  if (!M.song64 || M.song64.id !== M.cur) { const tr = TRACKS[M.cur]; if (!tr || tr.jingle) return; M.song64 = M.cache64[M.cur] || (M.cache64[M.cur] = Object.assign(compose64(M.cur), { id: M.cur })); }
  const s = M.song64, dt = 60 / s.bpm / 2, ac = X.ac;
  if (M.next < ac.currentTime - 0.5) M.next = ac.currentTime + 0.05;
  while (M.next < ac.currentTime + 0.3) {
    for (const e of s.by[M.step % s.len]) {
      if (e.dr) DRUM64[e.dr](M.next, e.v, 'music');
      else INST64[e.i](N(e.m), M.next, e.d * dt * 0.95, e.v, { bus: 'music', pan: e.i === ARR64[M.cur]?.counter ? 0.35 : e.i === ARR64[M.cur]?.pad ? -0.3 : 0 });
    }
    M.step++; M.next += dt;
  }
}

// ---------------------------------------------------------------- SFX: auto-upgrade of every chip sound
function play64(notes, bus = 'sfx') {
  const X = a64(); if (!X) return; const now = X.ac.currentTime;
  for (const [wv, f0, f1, dur, vol, del = 0] of notes) {
    const t = now + Math.max(0, del), pan = (Math.random() - 0.5) * 0.5;
    if (wv === 'n') {
      const fc = Math.max(80, Math.min(12000, f0 * 1.4)), fe = Math.max(80, Math.min(12000, f1 * 1.4));
      voice64({ bus, noise: true, bp: fc, bpEnd: fe, q: 0.9, t, dur, vol: vol * 1.6, a: 0.002, r: 0.06, pan, rev: 0.2 });
    } else if (wv === 't') {
      voice64({ bus, waves: ['sine', 'triangle'], levels: [0.8, 0.5], mults: [1, 2], f: f0, f1, t, dur, vol: vol * 1.3, a: 0.004, r: 0.15, pan, rev: 0.35, echo: bus === 'sfx' ? 0.15 : 0 });
    } else {
      const w = wv === 'w' ? 'sawtooth' : wv === 's' ? 'square' : wv === 'p' ? 'pulse25' : 'pulse12';
      voice64({ bus, waves: [w, w, 'sine'], levels: [0.5, 0.5, 0.4], mults: [1, 1, 0.5], detune: 8, f: f0, f1, t, dur, vol: vol * 1.1, a: 0.003, r: 0.1, lp: Math.min(9000, f0 * 6 + 800), pan, rev: 0.25 });
    }
  }
}
// hand-made layered 64-bit versions of the key sounds (and a few 64-bit-only ambience sounds)
const SFX64 = (() => {
  const L = layers => () => { const X = a64(); if (!X) return; const t = X.ac.currentTime; layers.forEach(([kind, o]) => {
    if (INST64[kind]) INST64[kind](o.f, t + (o.at || 0), o.dur || 0.3, o.vol || 0.08, { bus: 'sfx', pan: o.pan || 0 });
    else if (DRUM64[kind]) DRUM64[kind](t + (o.at || 0), o.vol || 0.1, 'sfx');
    else voice64({ bus: 'sfx', ...o, t: t + (o.at || 0) }); }); };
  const chord = (ins, ms, gap, d, v) => ms.map((m, i) => [ins, { f: N(m), at: i * gap, dur: d, vol: v }]);
  return {
    cursor: L([['v', { wave: 'sine', f: 1760, dur: 0.03, vol: 0.05, r: 0.05, rev: 0.15 }]]),
    select: L(chord('bell', [84, 91], 0.05, 0.25, 0.07)),
    confirm: L(chord('harp', [76, 84, 88], 0.04, 0.4, 0.09)),
    swing: L([['v', { noise: true, bp: 900, bpEnd: 3500, q: 1.5, dur: 0.16, vol: 0.18, a: 0.03, r: 0.05, pan: -0.3 }]]),
    hit_slash: L([['v', { noise: true, bp: 3500, bpEnd: 900, q: 0.8, dur: 0.12, vol: 0.22, r: 0.08, rev: 0.2 }], ['v', { waves: ['square', 'sawtooth'], f: 520, f1: 140, dur: 0.1, vol: 0.06, lp: 2500 }], ['k', { vol: 0.08 }]]),
    hit_pierce: L([['v', { noise: true, hp: 3000, dur: 0.06, vol: 0.18, r: 0.04 }], ['v', { wave: 'triangle', f: 1400, f1: 500, dur: 0.07, vol: 0.08 }]]),
    hit_blunt: L([['k', { vol: 0.16 }], ['v', { noise: true, lp: 700, dur: 0.18, vol: 0.25, r: 0.1, rev: 0.2 }]]),
    crit: L([['k', { vol: 0.18 }], ['v', { noise: true, bp: 2500, bpEnd: 400, dur: 0.25, vol: 0.25, r: 0.1, rev: 0.3 }], ['v', { waves: ['sawtooth', 'sawtooth'], detune: 20, f: 1300, f1: 220, dur: 0.25, vol: 0.07, lp: 4000, rev: 0.3 }], ['c', { vol: 0.08, at: 0.02 }]]),
    block: L([['v', { wave: 'sine', fm: { ratio: 2.7, index: 3 }, f: 620, dur: 0.35, vol: 0.09, r: 0.3, rev: 0.4 }], ['v', { noise: true, hp: 2500, dur: 0.04, vol: 0.12 }]]),
    miss: L([['v', { noise: true, bp: 2000, bpEnd: 5000, dur: 0.14, vol: 0.1, a: 0.02, pan: 0.4 }]]),
    hurt: L([['v', { waves: ['square', 'sawtooth'], f: 240, f1: 90, dur: 0.2, vol: 0.08, lp: 1400, rev: 0.2 }], ['k', { vol: 0.1 }]]),
    heal: L(chord('harp', [72, 76, 79, 84, 88], 0.06, 0.6, 0.07).concat(chord('bell', [96], 0, 1, 0.04))),
    revive: L(chord('choir', [60, 67, 72], 0, 1.2, 0.08).concat(chord('bell', [84, 88, 91, 96], 0.12, 1, 0.05))),
    levelup: L(chord('brass', [72, 76, 79, 84], 0.09, 0.3, 0.08).concat([['timpani', { f: N(48), vol: 0.1 }], ['c', { at: 0.36, vol: 0.08 }]], chord('strings', [72, 76, 79, 84], 0, 1.2, 0.05).map(([k, o]) => [k, { ...o, at: 0.36 }]))),
    quest_done: L(chord('harp', [72, 76, 79, 84, 88, 91], 0.06, 0.6, 0.07).concat(chord('pad', [60, 64, 67], 0, 1, 0.05))),
    achievement: L(chord('bell', [79, 83, 86, 91, 95], 0.07, 0.8, 0.06).concat([['c', { vol: 0.05, at: 0.3 }]])),
    chest: L(chord('harp', [72, 76, 79, 84, 79, 84, 88], 0.06, 0.4, 0.07).concat(chord('bell', [96], 0, 1, 0.04).map(([k, o]) => [k, { ...o, at: 0.42 }]))),
    coin: L([['bell', { f: N(88), dur: 0.3, vol: 0.06 }], ['bell', { f: N(95), at: 0.06, dur: 0.5, vol: 0.06 }]]),
    pickup: L(chord('bell', [84, 91], 0.05, 0.3, 0.06)),
    door: L([['v', { noise: true, lp: 600, dur: 0.35, vol: 0.18, a: 0.05, r: 0.15, rev: 0.4 }], ['v', { wave: 'sawtooth', f: 90, f1: 70, dur: 0.3, vol: 0.04, lp: 400 }], ['k', { at: 0.3, vol: 0.08 }]]),
    splash: L([['v', { noise: true, lp: 4000, lpEnd: 500, dur: 0.45, vol: 0.2, r: 0.2, rev: 0.4 }], ['v', { wave: 'sine', f: 900, f1: 300, dur: 0.12, vol: 0.05 }]]),
    waypoint: L(chord('bell', [72, 79, 84, 91], 0.1, 1, 0.06).concat(chord('pad', [60, 67, 72], 0, 1.4, 0.05))),
    discover: L(chord('harp', [67, 72, 76, 79, 84], 0.09, 0.8, 0.07).concat(chord('strings', [55, 60, 64], 0, 1.2, 0.04))),
    storm_hit: L([['v', { noise: true, lp: 6000, lpEnd: 200, dur: 1.1, vol: 0.3, a: 0.002, r: 0.4, rev: 0.6 }], ['k', { vol: 0.2 }], ['c', { vol: 0.12 }]]),
    storm_cast: L([['v', { waves: ['sawtooth', 'sawtooth'], detune: 30, f: 200, f1: 1600, dur: 0.35, vol: 0.06, lp: 3000, rev: 0.4 }], ['v', { noise: true, hp: 5000, dur: 0.35, vol: 0.06 }]]),
    burn: L([['v', { noise: true, bp: 1200, q: 0.5, dur: 0.5, vol: 0.18, a: 0.05, r: 0.2, rev: 0.2 }], ['v', { noise: true, hp: 6000, dur: 0.3, vol: 0.05, rate: 0.5 }]]),
    freeze: L([['bell', { f: N(96), dur: 0.8, vol: 0.05 }], ['bell', { f: N(103), at: 0.05, dur: 0.8, vol: 0.04 }], ['v', { noise: true, hp: 8000, dur: 0.4, vol: 0.06 }]]),
    shock: L([['v', { waves: ['square', 'sawtooth'], detune: 50, f: 1800, f1: 300, dur: 0.15, vol: 0.06, lp: 6000 }], ['v', { noise: true, bp: 5000, dur: 0.15, vol: 0.15 }]]),
    nat20: L(chord('brass', [72, 79, 84, 88, 91, 96], 0.05, 0.35, 0.06).concat([['c', { at: 0.3, vol: 0.1 }], ['timpani', { f: N(48), vol: 0.12 }]])),
    nat1: L(chord('brass', [55, 54, 53, 52], 0.12, 0.25, 0.06)),
    monster_die: L([['v', { waves: ['sawtooth', 'square'], f: 420, f1: 50, dur: 0.5, vol: 0.07, lp: 1800, rev: 0.35 }], ['v', { noise: true, lp: 1500, lpEnd: 200, dur: 0.5, vol: 0.12, rev: 0.3 }]]),
    boss_die: L([['timpani', { f: N(36), vol: 0.16 }], ['v', { noise: true, lp: 3000, lpEnd: 80, dur: 2, vol: 0.25, r: 0.8, rev: 0.7 }], ['c', { vol: 0.12 }]].concat(chord('choir', [48, 55, 60], 0, 2, 0.07))),
    boss_appear: L([['timpani', { f: N(40), vol: 0.15 }], ['timpani', { f: N(40), at: 0.5, vol: 0.15 }]].concat(chord('brass', [40, 47, 52], 0, 1.2, 0.07))),
    world_boss: L([['v', { waves: ['sawtooth', 'sawtooth'], detune: 25, f: 70, f1: 160, dur: 1.4, vol: 0.12, lp: 600, rev: 0.6 }], ['timpani', { f: N(36), vol: 0.16 }], ['c', { vol: 0.1, at: 0.8 }]]),
    roar: L([['v', { waves: ['sawtooth', 'sawtooth', 'square'], detune: 30, f: 170, f1: 60, dur: 0.9, vol: 0.1, lp: 1200, rev: 0.5, vib: 18, vibDepth: 60 }], ['v', { noise: true, lp: 800, dur: 0.9, vol: 0.15, rev: 0.4 }]]),
    death: L(chord('strings', [67, 63, 60, 55, 48], 0.22, 0.6, 0.07)),
    // 64-bit-only ambience / extra sounds
    thunder: L([['v', { noise: true, lp: 1200, lpEnd: 60, dur: 2.6, vol: 0.35, a: 0.01, r: 1, rev: 0.7 }], ['k', { vol: 0.22 }]]),
    sword_draw: L([['v', { noise: true, hp: 3500, dur: 0.5, vol: 0.1, a: 0.08, r: 0.1, pan: 0.3 }], ['v', { wave: 'sine', fm: { ratio: 3.1, index: 1.5 }, f: 1900, dur: 0.6, vol: 0.05, a: 0.3, rev: 0.4 }]]),
    magic_charge: L([['v', { waves: ['sawtooth', 'sawtooth', 'sawtooth'], detune: 18, f: 220, f1: 880, dur: 1.2, vol: 0.06, a: 0.6, lp: 600, lpEnd: 5000, lpTime: 1.2, rev: 0.6 }]]),
    portal: L([['v', { waves: ['sine', 'sine'], detune: 30, f: 300, f1: 1200, dur: 1.4, vol: 0.08, a: 0.3, rev: 0.7, echo: 0.4, vib: 7, vibDepth: 40 }], ['v', { noise: true, bp: 2000, bpEnd: 6000, dur: 1.4, vol: 0.06, a: 0.4, rev: 0.5 }]]),
    bell_toll: L([['bell', { f: N(55), dur: 3, vol: 0.12 }], ['bell', { f: N(67), dur: 3, vol: 0.05 }]]),
    wind: L([['v', { noise: true, bp: 500, bpEnd: 1400, q: 3, dur: 2.5, vol: 0.12, a: 0.8, r: 1, rev: 0.4, pan: -0.5 }]]),
    fanfare: L(chord('brass', [67, 72, 76, 79], 0.12, 0.25, 0.08).concat(chord('brass', [72, 76, 79, 84], 0, 1.2, 0.07).map(([k, o]) => [k, { ...o, at: 0.5 }]), [['timpani', { f: N(43), vol: 0.12 }], ['c', { at: 0.5, vol: 0.1 }]])),
    heartbeat: L([['k', { vol: 0.16 }], ['k', { at: 0.22, vol: 0.11 }]]),
  };
})();
const SFX64_ONLY = ['thunder', 'sword_draw', 'magic_charge', 'portal', 'bell_toll', 'wind', 'fanfare', 'heartbeat'];
function sfx64(k) { if (SFX64[k]) SFX64[k](); else play64(SFX_BANK[k] || SFX_BANK.cursor); }
