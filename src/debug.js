'use strict';
// ================================================================ DEBUG PANEL
// Open with F9 (or ` + D), or by adding #debug to the page link. A dockable HTML panel beside the
// screen with live state, cheats, warps, battle controls, frame stepping, overlays and an error log.
// Nothing here runs until the panel is opened, apart from the error recorder.

const DBG = {
  open: false, paused: false, steps: 0, speed: 1, god: false, grid: false, hitbox: false, errors: [], el: null, timer: null,
  log(kind, msg) { this.errors.unshift({ t: new Date().toLocaleTimeString(), kind, msg: String(msg).slice(0, 400) }); this.errors.length = Math.min(this.errors.length, 60); if (this.open) this.renderLog(); },
  toggle() { this.open ? this.close() : this.show(); },
  show() {
    if (!this.el) this.build();
    this.open = true; this.el.hidden = false; this.refresh(); this.renderLog();
    clearInterval(this.timer); this.timer = setInterval(() => this.refresh(), 250);
  },
  close() { this.open = false; if (this.el) this.el.hidden = true; clearInterval(this.timer); },
  // ---------------------------------------------------------------- UI
  build() {
    const css = document.createElement('style');
    css.textContent = `
#dbg{position:fixed;z-index:200;right:max(8px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 8px);width:min(330px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;
 background:#0d100ef2;color:#c9d0b0;border:1px solid #7fa52c;border-radius:8px;font:11px/1.45 ui-monospace,"Courier New",monospace;box-shadow:0 10px 30px #000a}
#dbg header{position:sticky;top:0;display:flex;align-items:center;gap:6px;padding:6px 8px;background:#1a2016;border-bottom:1px solid #39403a;cursor:move}
#dbg header b{flex:1;color:#9fd36a;letter-spacing:.1em}
#dbg section{padding:6px 8px;border-bottom:1px solid #222a22}
#dbg h4{margin:0 0 4px;font-size:9px;color:#7c8570;letter-spacing:.14em;font-weight:400}
#dbg button,#dbg select,#dbg input{font:inherit;background:#1d1f1c;color:#c9d0b0;border:1px solid #39403a;border-radius:4px;padding:3px 6px;cursor:pointer}
#dbg button:hover{border-color:#9fd36a;color:#e6f5d0}
#dbg button[aria-pressed=true]{background:#2f4a1c;border-color:#9fd36a;color:#e6f5d0}
#dbg .row{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
#dbg .kv{display:grid;grid-template-columns:auto 1fr;gap:0 8px}
#dbg .kv span:nth-child(odd){color:#7c8570}
#dbg .kv span:nth-child(even){color:#e6f5d0;overflow-wrap:anywhere}
#dbg select{max-width:100%;flex:1;min-width:0}
#dbg input[type=range]{flex:1;padding:0}
#dbg .log{max-height:160px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
#dbg .log div{border-bottom:1px dashed #2a302b;padding:2px 0}
#dbg .log .error{color:#ff8a7a}#dbg .log .warn{color:#f0c860}#dbg .log .info{color:#9fd7ff}
#dbg .ok{color:#9fd36a}`;
    document.head.appendChild(css);
    const d = this.el = document.createElement('aside'); d.id = 'dbg'; d.setAttribute('aria-label', 'Debug panel'); d.hidden = true;
    const zones = ZONES.map(z => `<option value="${z.id}">${z.name} (${z.lvl[0]}-${z.lvl[1]})</option>`).join('');
    d.innerHTML = `
<header><b>GBQ DEBUG</b><span id="dbgFps"></span><button data-a="close" title="Close (F9)">✕</button></header>
<section><h4>STATE</h4><div class="kv" id="dbgState"></div></section>
<section><h4>RUN</h4><div class="row">
 <button data-a="pause">PAUSE</button><button data-a="step">STEP 1</button><button data-a="step10">STEP 10</button>
 <select id="dbgSpeed" title="Game speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></div></section>
<section><h4>HERO</h4><div class="row">
 <button data-a="god">GOD MODE</button><button data-a="heal">HEAL ALL</button><button data-a="lvl1">+1 LV</button><button data-a="lvl10">+10 LV</button><button data-a="lvl100">+100 LV</button>
 <button data-a="gold">+10K GOLD</button><button data-a="items">+LOOT</button><button data-a="potions">+POTIONS</button><button data-a="revive">UN-GHOST</button></div></section>
<section><h4>WORLD</h4><div class="row" style="margin-bottom:4px"><select id="dbgZone">${zones}</select><button data-a="warp">WARP</button></div>
 <div class="row"><button data-a="reveal">REVEAL MAP</button><button data-a="waypoints">ALL WAYPOINTS</button><button data-a="noenc">NO ENCOUNTERS</button><button data-a="grid">COLLISION</button><button data-a="atlas">ATLAS</button></div>
 <div class="row" style="margin-top:4px"><span>TIME</span><input id="dbgTime" type="range" min="-1" max="24" step="0.5" value="-1" aria-label="Time of day"><span id="dbgTimeV">real</span></div></section>
<section><h4>BATTLE</h4><div class="row">
 <button data-a="enc">ENCOUNTER</button><button data-a="boss">ZONE BOSS</button><button data-a="win">WIN</button><button data-a="lose">LOSE</button><button data-a="auto">AUTO</button></div></section>
<section><h4>MODES</h4><div class="row">
 <button data-a="video">64-BIT VIDEO</button><button data-a="audio">64-BIT AUDIO</button><button data-a="prof">PROFILER</button><button data-a="pal">NEXT PALETTE</button></div></section>
<section><h4>DATA</h4><div class="row">
 <button data-a="save">SAVE NOW</button><button data-a="copy">COPY STATE</button><button data-a="check">SELF-CHECK</button><button data-a="clear">CLEAR LOG</button></div></section>
<section><h4>LOG</h4><div class="log" id="dbgLog"></div></section>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (b) { this.act(b.dataset.a); this.refresh(); } });
    d.querySelector('#dbgSpeed').onchange = e => { this.speed = +e.target.value; };
    const tm = d.querySelector('#dbgTime'); tm.oninput = () => { const v = +tm.value; Clock.override = v < 0 ? null : v; d.querySelector('#dbgTimeV').textContent = v < 0 ? 'real' : v + 'h'; };
    // drag by the header
    const hd = d.querySelector('header'); let drag = null;
    hd.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = [e.clientX - d.offsetLeft, e.clientY - d.offsetTop]; hd.setPointerCapture(e.pointerId); });
    hd.addEventListener('pointermove', e => { if (!drag) return; d.style.left = Math.max(0, e.clientX - drag[0]) + 'px'; d.style.top = Math.max(0, e.clientY - drag[1]) + 'px'; d.style.right = 'auto'; });
    hd.addEventListener('pointerup', () => drag = null);
  },
  press(a, on) { const b = this.el && this.el.querySelector(`[data-a="${a}"]`); if (b) b.setAttribute('aria-pressed', !!on); },
  refresh() {
    if (!this.el) return;
    const $ = id => this.el.querySelector(id);
    $('#dbgFps').textContent = (typeof Profiler !== 'undefined' ? Profiler.fps.toFixed(0) : '?') + ' fps';
    const D = G ? derive(G) : null, z = G && ZONE_BY_ID[G.map];
    const rows = G ? [
      ['scenes', scenes.map(s => s.constructor.name).join(' › ')],
      ['hero', `${G.name} · ${G.cls} · ${G.species}`], ['level', `${G.lvl} (xp ${Math.round(G.xp).toLocaleString()})`],
      ['hp', `${G.hp} / ${D.hpMax}  AC ${D.ac}`], ['gold', G.gold.toLocaleString()],
      ['zone', z ? `${z.name} [${G.map}]` : G.map], ['tile', `${G.x}, ${G.y}${G.inst ? ` · in ${G.inst.kind} F${G.inst.floor}` : ''}`],
      ['party', (G.party || []).map(c => c.name).join(', ') || '—'], ['ghost', G.ghost ? 'YES' : 'no'],
      ['modes', `${S.video} · ${S.audio} · ${S.palette} · ${S.tiles} · ${S.art || 'nes'}`], ['time', `${Clock.hour.toFixed(1)}h ${Clock.phase}`], ['frame', frameN],
    ] : [['scenes', scenes.map(s => s.constructor.name).join(' › ')], ['state', 'no game loaded']];
    $('#dbgState').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${String(v).replace(/</g, '&lt;')}</span>`).join('');
    this.press('pause', this.paused); this.press('god', this.god); this.press('grid', this.grid); this.press('noenc', this.noEnc);
    this.press('video', S.video === 'hd64'); this.press('audio', S.audio === 'hd64'); this.press('prof', Profiler.on); this.press('auto', S.autoBattle);
  },
  renderLog() { const l = this.el && this.el.querySelector('#dbgLog'); if (l) l.innerHTML = this.errors.map(e => `<div class="${e.kind}">[${e.t}] ${e.kind.toUpperCase()} ${e.msg.replace(/</g, '&lt;')}</div>`).join('') || '<div class="ok">no errors</div>'; },
  battle() { return scenes.find(s => s instanceof Battle); },
  need() { if (!G) { this.log('warn', 'start or load a game first'); return false; } return true; },
  act(a) {
    const B = this.battle();
    switch (a) {
      case 'close': return this.close();
      case 'pause': this.paused = !this.paused; break;
      case 'step': this.paused = true; this.steps += 1; break;
      case 'step10': this.paused = true; this.steps += 10; break;
      case 'god': this.god = !this.god; break;
      case 'grid': this.grid = !this.grid; break;
      case 'noenc': this.noEnc = !this.noEnc; break;
      case 'prof': Profiler.on = !Profiler.on; break;
      case 'auto': S.autoBattle = !S.autoBattle; break;
      case 'video': if (S.video === 'hd64') { S.video = 'gb'; S.palette = S.palPrev || 'gbc'; } else { S.video = 'hd64'; S.palPrev = S.palette; S.palette = 'full'; } UI = PALS[S.palette]; clearCaches(); saveSettings(); break;
      case 'audio': S.audio = S.audio === 'hd64' ? 'chip' : 'hd64'; { const c = Music.cur; Music.cur = null; if (c) Music.play(c); } saveSettings(); break;
      case 'pal': S.palette = PAL_ORDER[(PAL_ORDER.indexOf(S.palette) + 1) % PAL_ORDER.length]; UI = PALS[S.palette]; clearCaches(); saveSettings(); break;
      case 'atlas': openAtlas(); break;
      case 'clear': this.errors = []; this.renderLog(); break;
      case 'check': this.selfCheck(); break;
      default: if (!this.need()) return;
    }
    if (!G) return;
    switch (a) {
      case 'heal': G.hp = derive(G).hpMax; (G.party || []).forEach(c => { c.hp = derive(c).hpMax; }); if (B) B.party.forEach(u => { if (u.ch) u.ch.hp = derive(u.ch).hpMax; }); toast('DEBUG', 'PARTY HEALED', 'item_chest', 'heal'); break;
      case 'lvl1': case 'lvl10': case 'lvl100': { const n = +a.slice(3), to = Math.min(720, G.lvl + n); gainXP(G, Math.max(0, xpForLevel(to) - G.xp) / (1 + derive(G).xpPct / 100) + 1); toast('DEBUG', 'LEVEL ' + G.lvl, 'px_tower', 'levelup'); break; }
      case 'gold': G.gold += 10000; SFX.coin(); break;
      case 'items': for (const rarity of [2, 3, 4, 5, 3]) addGear(makeItem({ lvl: G.lvl, rarity })); toast('DEBUG', '5 ITEMS ADDED', 'item_chest', 'chest'); break;
      case 'potions': G.inv.potion = (G.inv.potion || 0) + 20; G.inv.ration = (G.inv.ration || 0) + 10; break;
      case 'revive': G.ghost = false; G.hp = derive(G).hpMax; break;
      case 'warp': { const id = this.el.querySelector('#dbgZone').value; if (B) { this.log('warn', 'finish the battle first'); break; } G.inst = null; G.visited[id] = true; travelTo(id); break; }
      case 'reveal': ZONES.forEach(z => G.visited[z.id] = true); toast('DEBUG', 'MAP REVEALED', 'px_map', 'discover'); break;
      case 'waypoints': ZONES.forEach(z => { if (buildZoneCached(z.id).poi.waypoint) G.waypoints[z.id] = true; }); toast('DEBUG', 'ALL WAYPOINTS', 'px_map', 'waypoint'); break;
      case 'enc': if (B) break; startBattle(rollEncounter(ZONE_BY_ID[G.map] || ZONE_BY_ID.elderwood)); break;
      case 'boss': { if (B) break; const m = buildZoneCached(G.map), b = m.bosses && m.bosses[0]; if (!b) { this.log('info', 'this zone has no boss'); break; } fightBoss(b); break; }
      case 'win': if (B) { B.foes.forEach(f => { f.hp = 0; }); B.checkEnd(); } break;
      case 'lose': if (B) { B.party.forEach(u => { if (u.ch) u.ch.hp = 0; }); B.checkEnd(); } break;
      case 'save': saveGame(); toast('DEBUG', 'SAVED SLOT ' + (G.slot + 1), 'px_map', 'confirm'); break;
      case 'copy': { const txt = JSON.stringify(G); try { navigator.clipboard.writeText(txt).then(() => this.log('info', `state copied (${txt.length} chars)`), () => this.log('warn', 'clipboard refused — state printed to console')); } catch (e) { this.log('warn', 'clipboard unavailable'); } console.log('GBQ state', G); break; }
    }
  },
  // per-tick hooks
  tick() {
    if (!this.god || !G) return;
    const mx = derive(G).hpMax; if (G.hp < mx) G.hp = mx;
    const B = this.battle(); if (B) B.party.forEach(u => { if (u.ch && u.ch.hp < derive(u.ch).hpMax * 0.5) u.ch.hp = derive(u.ch).hpMax; });
  },
  overlay() {
    if (!this.grid) return;
    const f = scenes.slice().reverse().find(s => s.opaque);
    if (!(f instanceof Field) || !f.cam) return;
    const [cx, cy] = f.cam; ctx.save(); ctx.globalAlpha = 0.35;
    for (let ty = Math.floor(cy / T); ty <= Math.floor((cy + H) / T); ty++) for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + W) / T); tx++) {
      let blk = false; try { blk = f.blocked(tx, ty); } catch (e) {}
      if (blk) { ctx.fillStyle = '#ff2a2a'; ctx.fillRect(tx * T - cx, ty * T - cy, T, T); }
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = '#00ff88'; ctx.strokeRect(G.x * T - cx + 0.5, G.y * T - cy + 0.5, T - 1, T - 1);
    if (f.m && f.m.exits) { ctx.fillStyle = '#3bd1ff'; for (const e of Object.values(f.m.exits)) ctx.fillRect(e.x * T - cx + 4, e.y * T - cy + 4, 8, 8); }
    ctx.restore();
  },
  // quick in-page integrity check of the loaded data and current hero
  selfCheck() {
    const out = [], bad = (m) => out.push(m);
    const zoneIds = new Set(ZONES.map(z => z.id));
    for (const z of ZONES) { const m = buildZoneCached(z.id); for (const e of Object.values(m.exits)) if (!zoneIds.has(e.to)) bad(`zone ${z.id}: exit to missing ${e.to}`); }
    for (const b of BOSSES) if (!Number.isFinite(b.lvl)) bad(`boss ${b.id}: level ${b.lvl}`);
    for (const x of BESTIARY.slice(0, 400)) if (!x.name || !x.fam) bad(`beast ${x.id}: missing name/family`);
    if (G) { const D = derive(G); for (const k of ['ac', 'hpMax', 'init']) if (!Number.isFinite(D[k])) bad(`hero derive.${k} = ${D[k]}`); if (!Number.isFinite(G.gold)) bad('gold not finite'); if (!ZONE_BY_ID[G.map]) bad('hero map unknown: ' + G.map); }
    this.log(out.length ? 'error' : 'info', out.length ? `self-check: ${out.length} problem(s)\n` + out.slice(0, 12).join('\n') : `self-check OK: ${ZONES.length} zones, ${BOSSES.length} bosses, ${BESTIARY.length} creatures${G ? ', hero valid' : ''}`);
  },
};
window.DBG = DBG;
// record every error, even with the panel closed
addEventListener('error', e => DBG.log('error', `${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', e => DBG.log('error', 'promise: ' + (e.reason && e.reason.message || e.reason)));
{ const ce = console.error.bind(console), cw = console.warn.bind(console); console.error = (...a) => { DBG.log('error', a.join(' ')); ce(...a); }; console.warn = (...a) => { DBG.log('warn', a.join(' ')); cw(...a); }; }
addEventListener('keydown', e => { if (e.key === 'F9') { e.preventDefault(); DBG.toggle(); } });
// god mode rides on the engine tick
{ const t0 = tick; window.tick = tick = function () { DBG.tick(); return t0(); }; }
if (location.hash === '#debug') setTimeout(() => DBG.show(), 500);
