'use strict';
// ================================================================ NPC AI ENGINE
// Townsfolk, service NPCs and wardens now live in the world instead of standing still:
//   * BRAIN: each NPC has a stable personality (sociable, restless, early riser) from its name, a home tile and a leash
//     (service NPCs stay within 1 tile of their counter so they are always easy to find; townsfolk roam 3-4 tiles).
//   * UTILITY AI: every think tick the NPC scores its options and takes the best one:
//       WORK (stay at the post), WANDER (a random spot near home), SOCIALIZE (walk up to another NPC and chat),
//       GREET (turn to face the hero and say something), SHELTER (head home in rain or at night),
//       SLEEP (late night: stay home, Zzz), RETURN (back inside the leash), IDLE.
//   * SCHEDULE: dawn 6-9 opening up, day 9-18 busy, evening 18-22 winding down, night 22-6 asleep (the game clock).
//   * BARKS: short speech bubbles that depend on role, time of day, weather, the hero's level and class,
//     and memory (how often you have talked to them).
//   * MEMORY: every NPC you talk to remembers you (G.npcMem): first meeting, regular, old friend.
//   * MOVEMENT: one tile at a time with simple steering; NPCs never block the hero and walk around each other.
// Speech bubbles follow CHAT SETTINGS > CHAT BUBBLES (off: greetings go to the chat log instead).
// It only moves NPCs near the hero (boards, stones and other fixtures never move). Pure rules are exported as GBQNpcAI for tests.

const NPC_ACTIONS = ['work', 'wander', 'socialize', 'greet', 'shelter', 'sleep', 'return', 'idle'];
function npcAiHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// a stable personality from the NPC's name: values 0..1
function npcPersonality(name) {
  const h = npcAiHash('npc|' + name);
  return { social: (h & 255) / 255, restless: ((h >>> 8) & 255) / 255, early: ((h >>> 16) & 255) / 255 };
}
const dayPhase = hour => hour >= 22 || hour < 6 ? 'night' : hour < 9 ? 'dawn' : hour < 18 ? 'day' : 'evening';
const SERVICE_SVCS = ['vendor', 'inn', 'trainer', 'blacksmith', 'armorsmith', 'weaponsmith', 'auction', 'mail', 'bank', 'portal', 'housing', 'tower', 'arena', 'stable', 'guild', 'elder', 'warden', 'profession', 'heirloom'];
const isServiceNpc = npc => !!npc.svc && (SERVICE_SVCS.includes(npc.svc) || !!npc.prof);
const leashOf = npc => isServiceNpc(npc) ? 1 : 3 + Math.round(npcPersonality(npc.name).restless);
const tileDist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
// utility scores: ctx = { hour, raining, heroDist, greetedAgo (frames), nearNpc (bool), homeDist }
function scoreNpcActions(npc, ctx) {
  const P = npcPersonality(npc.name), phase = dayPhase(ctx.hour), service = isServiceNpc(npc), leash = leashOf(npc), s = {};
  for (const a of NPC_ACTIONS) s[a] = 0;
  s.idle = 0.2;
  s.return = ctx.homeDist > leash ? 2 + ctx.homeDist : 0;
  s.greet = ctx.heroDist <= 2 && ctx.greetedAgo > 900 ? 1.6 : 0;
  if (service) { s.work = phase === 'night' ? 0.6 : 0.55; s.wander = phase === 'night' ? 0.1 : 0.35 + 0.5 * P.restless; }
  else {
    s.wander = (phase === 'day' ? 0.6 : phase === 'dawn' || phase === 'evening' ? 0.35 : 0.05) + 0.4 * P.restless;
    s.socialize = ctx.nearNpc ? (phase === 'day' || phase === 'evening' ? 0.5 : 0.1) + 0.6 * P.social : 0;
    s.shelter = (ctx.raining ? 1.1 : 0) + (phase === 'evening' ? 0.4 : 0);
    s.sleep = phase === 'night' ? 1.2 - 0.6 * P.early : phase === 'dawn' && P.early < 0.3 ? 0.7 : 0;
  }
  return s;
}
const bestNpcAction = scores => Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
// one step from a toward b, trying the longer axis first then the other; blocked(x, y) says if a tile is taken
function stepToward(a, b, blocked) {
  const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
  const tries = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [sx, sy] of tries) if ((sx || sy) && !blocked(a[0] + sx, a[1] + sy)) return [a[0] + sx, a[1] + sy, sx > 0 ? 'right' : sx < 0 ? 'left' : sy > 0 ? 'down' : 'up'];
  return null;
}
// what an NPC says: ctx = { hour, raining, role, svc, heroName, heroLvl, heroCls, talks, action }
const BARKS = {
  greetNew: ['Well met, traveller.', 'Haven\'t seen you before.', 'Welcome to town!', 'Mind the mud.'],
  greetRegular: ['Back again, {hero}?', 'Good to see you, {hero}.', 'Hello again!'],
  greetFriend: ['{hero}! My old friend!', 'The hero returns!', 'Always a pleasure, {hero}.'],
  strong: ['They say you are LV{lvl}...', 'A true champion walks by.', 'Your gear... impressive.'],
  dawn: ['Early start today.', 'Smell that? Fresh bread.', 'Opening up soon.'],
  day: ['Fine day for it.', 'Busy, busy, busy.', 'Prices are fair, honest.', 'Heard of the rares lately?'],
  evening: ['Long day. Almost done.', 'Inn will be full tonight.', 'Watch the roads at dusk.'],
  night: ['Zzz...', '*yawn*', 'Shh. People sleep.'],
  rain: ['Ugh, this rain!', 'Get under a roof!', 'Good for the crops.'],
  socialize: ['Did you hear the news?', 'Ha! You don\'t say.', 'Same as always.', 'My cousin saw a dragon.'],
  work: { vendor: ['Fresh stock in!', 'Potions! Get potions!'], trainer: ['Keep your guard up!', 'Again! From the top!'], inn: ['Rooms! Warm beds!'], blacksmith: ['*clang* *clang*', 'Steel needs fire.'],
    warden: ['The wilds are restless.', 'Stay on the road.'], elder: ['The lantern remembers.', 'Patience, child.'], guard: ['Move along.', 'Keep the peace.'], default: ['Work, work.', 'Hm, where was I?'] },
  cls: { necromancer: ['Is that... bones?', 'Keep your dead outside.'], dreadknight: ['Cold in here suddenly.'], bladedancer: ['Dance for us!'], corsair: ['Pirates! ...oh, just you.'], wyrmlancer: ['Where is your wyvern?'] },
};
function npcBark(ctx, r) {
  const fill = s => s.replace('{hero}', ctx.heroName || 'friend').replace('{lvl}', ctx.heroLvl || 1);
  const pickR = L => L[Math.floor((r == null ? Math.random() : r) * L.length) % L.length];
  const phase = dayPhase(ctx.hour);
  if (ctx.action === 'greet') {
    if (BARKS.cls[ctx.heroCls] && (r || 0) < 0.25) return fill(pickR(BARKS.cls[ctx.heroCls]));
    if (ctx.heroLvl >= 60 && (r || 0) < 0.5) return fill(pickR(BARKS.strong));
    return fill(pickR(ctx.talks >= 8 ? BARKS.greetFriend : ctx.talks >= 2 ? BARKS.greetRegular : BARKS.greetNew));
  }
  if (ctx.action === 'sleep' || phase === 'night') return pickR(BARKS.night);
  if (ctx.raining) return pickR(BARKS.rain);
  if (ctx.action === 'socialize') return pickR(BARKS.socialize);
  if (ctx.action === 'work') return pickR(BARKS.work[ctx.svc] || BARKS.work[ctx.role] || BARKS.work.default);
  return pickR(BARKS[phase]);
}

if (typeof globalThis !== 'undefined') globalThis.GBQNpcAI = { NPC_ACTIONS, npcPersonality, dayPhase, isServiceNpc, leashOf, scoreNpcActions, bestNpcAction, stepToward, npcBark, tileDist };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Field !== 'undefined') {
  const STATE = {};  // zone -> key -> brain
  const keyOf = e => `${e.name}|${e.x0 != null ? e.x0 : e.x},${e.y0 != null ? e.y0 : e.y}`;
  const zoneKey = f => (f && f.zone ? f.zone.id : '') + (G && G.inst ? ':inst' : '');
  const hourNow = () => typeof Clock !== 'undefined' ? Clock.hour : new Date().getHours();
  const raining = f => !!(S.weather && f && f.zone && typeof WEATHER !== 'undefined' && /rain|storm/.test(String(WEATHER[f.zone.biome] || '')));
  const brainFor = (f, e) => { const z = (STATE[zoneKey(f)] ||= {}), k = keyOf(e); return (z[k] ||= { x: e.x, y: e.y, home: [e.x, e.y], dir: 'down', action: 'idle', target: null, next: Math.floor(R() * 60), greeted: -9999, bark: null, barkT: 0, step: 0 }); };
  // NPC entities report their live position
  { const ent0 = Field.prototype.entities; Field.prototype.entities = function () {
      const list = ent0.apply(this, arguments);
      if (!G || G.inst || this._npcAiOff) return list;
      for (const e of list) if (e.kind === 'npc' && e.svc !== 'realmstone' && !/STONE|BOARD|STATUE|PORTAL|MAILBOX|CHEST|SHRINE|SIGN|CRYSTAL/.test(e.name || '')) {
        const b = brainFor(this, e); e.x0 = b.home[0]; e.y0 = b.home[1]; e.x = b.x; e.y = b.y; e.dir = b.dir; e.walkF = b.step % 2; e.ai = b;
      }
      return list;
    }; }
  // think and move (on-screen NPCs only)
  function think(f) {
    const list = f.entities().filter(e => e.ai), me = [G.x, G.y];
    const blocked = (x, y) => (x === G.x && y === G.y) || f.blocked(x, y);
    for (const e of list) {
      const b = e.ai; if (tileDist([b.x, b.y], me) > 12) continue;
      if (b.barkT > 0) b.barkT -= 10;
      if (frameN < b.next) continue;
      const others = list.filter(o => o !== e && tileDist([o.x, o.y], [b.x, b.y]) <= 4);
      const ctx = { hour: hourNow(), raining: raining(f), heroDist: tileDist([b.x, b.y], me), greetedAgo: frameN - b.greeted, nearNpc: others.length > 0, homeDist: tileDist([b.x, b.y], b.home) };
      const act = bestNpcAction(scoreNpcActions(e, ctx)); b.action = act;
      const say1 = text => { if (S.bubbles === false) { if (act === 'greet' && typeof chatLog === 'function') chatLog('say', e.name, text); return; } b.bark = text; b.barkT = 200; };
      const ctxB = { hour: ctx.hour, raining: ctx.raining, role: typeof npcRole === 'function' ? npcRole(e) : null, svc: e.svc, heroName: G.name, heroLvl: G.lvl, heroCls: G.cls, talks: ((G.npcMem || {})[e.name] || {}).talks || 0, action: act };
      if (act === 'greet') { b.greeted = frameN; const dx = G.x - b.x, dy = G.y - b.y; b.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'; say1(npcBark(ctxB, R())); b.next = frameN + 120; continue; }
      if (act === 'wander' && (!b.target || tileDist([b.x, b.y], b.target) === 0)) { const L = leashOf(e); b.target = [b.home[0] + Math.round((R() * 2 - 1) * L), b.home[1] + Math.round((R() * 2 - 1) * L)]; }
      if (act === 'return' || act === 'shelter' || act === 'sleep' || act === 'work') b.target = b.home.slice();
      if (act === 'socialize' && others.length) { const o = others[Math.floor(R() * others.length)]; b.target = [o.x, o.y]; if (tileDist([b.x, b.y], [o.x, o.y]) <= 1 && R() < 0.5) say1(npcBark(ctxB, R())); }
      if (act === 'idle') { if (R() < 0.3) b.dir = pick(['down', 'left', 'right', 'up']); }
      if (b.target && tileDist([b.x, b.y], b.target) > (act === 'socialize' ? 1 : 0)) {
        const st = stepToward([b.x, b.y], b.target, (x, y) => blocked(x, y) || tileDist([x, y], b.home) > leashOf(e) + (act === 'return' ? 99 : 0));
        if (st) { b.x = st[0]; b.y = st[1]; b.dir = st[2]; b.step++; } else b.target = null;
      }
      if ((act === 'work' || act === 'sleep' || act === 'idle') && R() < 0.05) say1(npcBark(ctxB, R()));
      const P = npcPersonality(e.name);
      b.next = frameN + (act === 'sleep' ? 240 : 40 + Math.round(60 * (1 - P.restless)) + Math.floor(R() * 40));
    }
  }
  { const u0 = Field.prototype.update; Field.prototype.update = function () {
      const r = u0.apply(this, arguments);
      try { if (G && !G.inst && scenes[scenes.length - 1] === this && frameN % 10 === 0) think(this); } catch (e) { console.warn('npc ai', e); }
      return r;
    }; }
  // facing and walking frames
  if (typeof npcSprite === 'function') {
    const s0 = npcSprite;
    npcSprite = function (e) {
      if (!e || !e.ai || !e.dir || e.dir === 'down' && !e.walkF) return s0.apply(this, arguments);
      const role = typeof npcRole === 'function' ? npcRole(e) : null, base = role ? `gh_npc_${role}` : null, d = e.dir === 'left' || e.dir === 'right' ? 'side' : e.dir;
      if (role && S.art === 'packs' && IMG[`fdn_${role}_${d}${e.walkF ? 1 : 0}`]) return spr(`fdn_${role}_${d}${e.walkF ? 1 : 0}`, 16, 24, { flip: e.dir === 'left' });
      if (base && IMG[`${base}_${d}${e.walkF}`]) return spr(`${base}_${d}${e.walkF}`, 16, 16, { flip: e.dir === 'left' });
      return walker(npcLook(e.spr), e.dir, e.walkF);
    };
  }
  // speech bubbles and sleepy Zzz
  { const d0 = Field.prototype.draw; Field.prototype.draw = function () {
      d0.apply(this, arguments);
      try {
        if (!G || G.inst || !this.cam) return;
        for (const e of this.entities()) {
          const b = e.ai; if (!b) continue;
          const sx = e.x * 16 - this.cam[0] + 8, sy = e.y * 16 - this.cam[1] - 4;
          if (sx < -20 || sx > W + 20 || sy < 0 || sy > H) continue;
          if (b.barkT > 0 && b.bark && typeof chatBubble === 'function') chatBubble(b.bark, sx, sy, false);
          else if (b.action === 'sleep' && (frameN >> 5) % 2) text('z', sx + 3, sy - 6 - ((frameN >> 4) % 3), 'blue');
        }
      } catch (e) { /* drawing only */ }
    }; }
  // memory: NPCs remember the hero
  if (typeof npcService === 'function') { const n0 = npcService; npcService = function (e) {
      if (e && e.name && G) { G.npcMem ||= {}; const m = (G.npcMem[e.name] ||= { talks: 0, first: Date.now() }); m.talks++; m.last = Date.now(); if (e.ai) { e.ai.greeted = frameN; const dx = G.x - e.ai.x, dy = G.y - e.ai.y; e.ai.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'; e.ai.next = frameN + 180; } }
      return n0.apply(this, arguments);
    }; }
  window.npcAiState = () => STATE;
}
