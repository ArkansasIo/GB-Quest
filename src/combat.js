// GB QUEST combat: d20 initiative, attack rolls vs AC, saving throws vs DC, spells by slot,
// class features, conditions & buffs, death saves, threat, legendary actions, boss mechanics,
// companion & monster AI, loot and XP. Host-authoritative for multiplayer.
'use strict';

let CB_ID = 1;
function partyMember(ch, ctrl = 'ai') { return { id: 'p' + (CB_ID++), side: 'party', ch, ctrl, name: ch.name, effects: [], threat: {}, acted: false, temp: 0 }; }
function foeMember(m) { m.id = 'f' + (CB_ID++); return m; }
const isChar = u => !!u.ch;
const hpOf = u => isChar(u) ? u.ch.hp : u.hp;
const maxHpOf = u => isChar(u) ? derive(u.ch).hpMax : u.maxhp;
function setHp(u, v) { if (isChar(u)) u.ch.hp = v; else u.hp = v; }
const hasEff = (u, id) => u.effects.some(e => e.id === id);
const effOf = (u, id) => u.effects.find(e => e.id === id);
const condFlag = (u, flag) => u.effects.some(e => CONDITIONS[e.id] && CONDITIONS[e.id][flag]) || u.effects.some(e => BUFFS[e.id] && BUFFS[e.id].mods && BUFFS[e.id].mods[flag]);
const downed = u => isChar(u) ? (u.ch.hp <= 0) : u.hp <= 0;
const alive = u => !downed(u) && !hasEff(u, 'banished');
function acOf(u) {
  let ac = isChar(u) ? derive(u.ch).ac : u.ac;
  for (const e of u.effects) { if (e.id === 'ac') ac += e.val || 0; if (e.id === 'haste') ac += 2; if (e.id === 'frostbite') ac -= 1 * (e.stacks || 1); if (e.id === 'sundered') ac -= 2 * (e.stacks || 1); if (e.id === 'slowed') ac -= 2; }
  return ac;
}
function addEffect(u, e) {
  const def = BUFFS[e.id];
  const ex = effOf(u, e.id);
  if (ex && def && def.stack) { ex.stacks = Math.min(def.stack, (ex.stacks || 1) + 1); ex.rounds = Math.max(ex.rounds || 0, e.rounds || 0); return; }
  if (ex) { Object.assign(ex, e); return; }
  u.effects.push(Object.assign({ stacks: 1 }, e));
}
function removeEffect(u, id) { u.effects = u.effects.filter(e => e.id !== id); }

class Battle {
  constructor(opt) {
    this.opaque = true;
    this.kind = opt.kind || 'field'; this.diff = opt.diff || 2; this.onEnd = opt.onEnd; this.rule = opt.rule || null; this.noRewards = opt.noRewards === true;
    this.party = opt.party; this.foes = opt.foes.map(foeMember); this.all = [...this.party, ...this.foes];
    this.noFlee = opt.noFlee || this.foes.some(f => f.boss) || ['dungeon', 'raid', 'trial', 'tower', 'arena'].includes(this.kind);
    this.round = 0; this.order = []; this.turnIdx = -1; this.q = []; this.state = 'idle'; this.cur = null; this.log = [];
    this.menu = 0; this.sub = 0; this.subTop = 0; this.targets = []; this.ti = 0; this.pending = null; this.skillUses = new Set(); this.anim = { lunge: null, flash: {}, fx: null };
    this.surprise = opt.surprise || null; this.music = opt.music || (this.foes.some(f => f.boss) ? (this.kind === 'arc' || this.foes.some(f => f.cat === 'arc') ? 'arcboss' : 'boss') : 'battle');
    this.title = opt.title || null; this.combatMode = opt.combatMode || S.combatMode || 'turn-based';
    combatHotkeyHandler = index => this.useHotbar(index);
    for (const u of this.party) { if (u.ch.ai === false && this.rule === 'frail') u.ch.hp = Math.ceil(u.ch.hp / 2); }
    this.setupEffects();
    const intro = this.foes.length === 1 ? `${this.foes[0].boss ? '' : 'A '}${this.foes[0].name} ${this.foes[0].boss ? 'blocks the way!' : 'appears!'}` : `${this.foes.length} foes appear!`;
    const steps = [{ text: intro, act: () => { if (this.foes.some(f => f.boss)) SFX.boss_appear(); } }];
    if (this.surprise === 'party') steps.push({ text: 'You catch them off guard!\nThey lose their first turn.', act: () => SFX.ambush() });
    if (this.surprise === 'foe') steps.push({ text: 'Ambush! You are surprised!', act: () => SFX.ambush() });
    this.run(steps, () => this.combatMode === 'realtime' ? this.startRealtime() : this.rollInit());
  }
  startRealtime() {
    const player = this.party.find(u => u.ch === G);
    if (!player) { this.rollInit(); return; }
    this.round = 1; this.turnIdx = 0; this.actor = player; this.bonusUsed = false;
    this.rt = { player, ticks: 0, gcd: 0, cooldowns: {}, paused: false, nextEnemy: 100, nextAlly: 150, nextDecay: 180 };
    this.state = 'realtime';
  }
  updateRealtime() {
    if (P('start')) { this.rt.paused = !this.rt.paused; SFX.toggle(); }
    if (this.rt.paused) return;
    this.rt.ticks++; if (this.rt.gcd > 0) this.rt.gcd--;
    for (const id in this.rt.cooldowns) if (this.rt.cooldowns[id] > 0) this.rt.cooldowns[id]--;
    if (P('b')) {
      const dodge = this.abilities(this.rt.player).find(a => a.id === 'dodge');
      if (dodge && this.rt.gcd <= 0) { this.rt.gcd = 90; this.actor = this.rt.player; this.bonusUsed = false; this.doPlayerSteps(dodge.fn(), false); return; }
    }
    // pad / touch controls: LEFT/RIGHT pick a hotbar slot, A uses it; SELECT auto-battle fights for you
    const me = this.rt.player, meUp = me && isChar(me) && me.ch.hp > 0 && !me.ch.dead;
    const slots = meUp ? this.hotbarEntries(me) : [];
    if (slots.length) {
      this.rt.slot = Math.min(this.rt.slot || 0, slots.length - 1);
      if (nav('left')) { this.rt.slot = (this.rt.slot + slots.length - 1) % slots.length; SFX.cursor(); }
      if (nav('right')) { this.rt.slot = (this.rt.slot + 1) % slots.length; SFX.cursor(); }
      if (P('a')) { this.actor = me; this.bonusUsed = false; this.useHotbar(this.rt.slot); return; }
      if (S.autoBattle && this.rt.gcd <= 0) {
        this.rt.gcd = 90; this.actor = me; this.bonusUsed = false;
        const steps = this.aiTurn(me);
        if (steps) { this.run(steps, () => { if (this.checkEnd()) return; this.actor = me; this.bonusUsed = false; this.state = 'realtime'; }); return; }
      }
    }
    if (this.checkEnd()) return;
    if (this.rt.ticks >= this.rt.nextDecay) {
      this.rt.nextDecay += 180; this.round++; this.onRound();
      for (const u of this.all) if (alive(u)) {
        for (const e of u.effects.slice()) {
          const tick = BUFFS[e.id]?.tick;
          if (tick?.healPct) this.heal(u, Math.ceil(maxHpOf(u) * tick.healPct / 100));
          if (tick?.dice) this.applyDamage(null, u, roll(tick.dice).total * (e.stacks || 1) + Math.floor((e.lvl || 0) / 3), tick.type, { tick: true });
        }
        this.decay(u);
      }
      if (this.checkEnd() || this.state !== 'realtime') return;
    }
    let unit = null, steps = null;
    if (this.rt.ticks >= this.rt.nextEnemy) {
      this.rt.nextEnemy += 100;
      unit = this.foes.filter(alive).sort((a, b) => (a.rtNext || 0) - (b.rtNext || 0))[0];
      if (unit) { unit.rtNext = this.rt.ticks + 100 * Math.max(1, unit.multi || 1); unit.turn = unit.turn || 0; this.actor = unit; steps = this.monsterTurn(unit); }
    } else if (this.rt.ticks >= this.rt.nextAlly) {
      this.rt.nextAlly += 150;
      unit = this.party.filter(u => u !== this.rt.player && isChar(u) && u.ch.hp > 0 && !u.ch.dead && (u.rtNext || 0) <= this.rt.ticks).sort((a, b) => (a.rtNext || 0) - (b.rtNext || 0))[0];
      if (unit) { unit.rtNext = this.rt.ticks + 150; this.actor = unit; steps = this.aiTurn(unit); }
    }
    if (unit && steps) {
      this.actor = unit; this.run(steps, () => {
        if (this.checkEnd()) return;
        this.actor = this.rt.player; this.bonusUsed = false; this.state = 'realtime';
      });
    }
  }
  enter() { Music.play(this.music); }
  resume() { if (this.state !== 'over') Music.play(this.music); }
  setupEffects() {
    for (const u of this.party.slice()) {
      if (!isChar(u)) continue;
      const c = u.ch; c.buffs = (c.buffs || []);
      c.buffs.forEach(b => addEffect(u, { id: b.id, rounds: 99, persist: true }));
      if (subKey(c, 'ward')) u.temp += 2 * c.lvl + derive(c).M.INT;
      if (subKey(c, 'shadowstart')) addEffect(u, { id: 'invisible', rounds: 2 });
      if (subKey(c, 'wolf')) this.party.length < 12 && this.addSummon(u, 'wolf');
    }
  }
  addSummon(owner, kind) {
    const L = owner.ch.lvl;
    const m = makeMonster(BEAST_BY_ID['beast_wolf_base'], Math.max(1, L - 1), 2, { name: 'WOLF', side: 'party', ally: owner.id });
    m.side = 'party'; m.id = 'p' + (CB_ID++); m.ctrl = 'ai'; m.effects = []; m.threat = {}; this.party.push(m); this.all.push(m);
  }
  // ------------------------------------------------------------------ flow
  run(steps, then) { this.q = steps.slice(); this.then = then; this.state = 'msg'; this.nextStep(); }
  nextStep() {
    const s = this.q.shift();
    if (!s) { this.state = 'idle'; const t = this.then; this.then = null; t && t(); return; }
    this.cur = s; this.c = 0; this.hold = s.wait || 0; this.auto = 0; s.act && s.act();
    NET.battleSync && NET.battleSync(this);
  }
  say(text, act, wait) { return { text, act, wait }; }
  rollInit() {
    for (const u of this.all) {
      const bonus = isChar(u) ? derive(u.ch).init : u.init;
      u.initRoll = d20() + bonus + R() * 0.1;
      if (this.surprise === 'party' && u.side === 'foe') u.skipFirst = true;
      if (this.surprise === 'foe' && u.side === 'party' && !(isChar(u) && u.ch.feats.includes('alert'))) u.skipFirst = true;
    }
    this.order = this.all.slice().sort((a, b) => b.initRoll - a.initRoll);
    SFX.initiative();
    const first = this.order[0];
    this.run([this.say(`Roll initiative!\n${first.name} goes first.`)], () => this.nextTurn());
  }
  nextTurn() {
    if (this.checkEnd()) return;
    this.turnIdx++;
    if (this.turnIdx >= this.order.length || this.turnIdx === 0) { this.turnIdx = 0; this.round++; this.onRound(); if (this.state === 'over') return; }
    this.order = this.order.filter(u => this.all.includes(u));
    const u = this.order[this.turnIdx];
    if (!u) return this.nextTurn();
    this.actor = u; u.acted = true; this.bonusUsed = false; this.extraAction = false; this.quicken = false; this.sneakUsed = false; this.maneuverUsed = false; this.uncannyUsed = false;
    if (u.side === 'foe' && u.legendary) u.legLeft = u.legendary;
    const steps = this.startTurn(u);
    if (steps === 'skip') return this.after();
    if (steps === null) return;
    if (steps.length) this.run(steps, () => this.beginAction(u));
    else this.beginAction(u);
  }
  onRound() {
    if (this.rule === 'timed' && this.round > 12) { this.run([this.say('Time is up! The trial is failed.')], () => this.finish('lose')); this.state = 'msg'; return; }
    // frenzy mechanic & round-based boss logic handled per-turn
  }
  startTurn(u) {
    const steps = [];
    if (u.skipFirst) { u.skipFirst = false; this.run([this.say(`${u.name} is surprised and loses the turn.`)], () => this.after()); return null; }
    if (isChar(u) && u.ch.hp <= 0) return this.deathSave(u);
    if (!isChar(u) && u.hp <= 0) return 'skip';
    // ticking effects
    for (const e of u.effects.slice()) {
      const def = BUFFS[e.id];
      if (def && def.tick) {
        if (def.tick.healPct) { const h = Math.ceil(maxHpOf(u) * def.tick.healPct / 100); this.heal(u, h); steps.push(this.say(`${u.name} regenerates ${h} HP.`)); }
        if (def.tick.dice) { const d = roll(def.tick.dice).total * (e.stacks || 1) + Math.floor((e.lvl || 0) / 3); steps.push(this.say(`${def.name}: ${u.name} takes ${d}.`, () => this.applyDamage(null, u, d, def.tick.type, { tick: true }))); }
      }
      if (e.id === 'host' && e.src === u.id) {
        const dc = this.spellDC(u);
        for (const f of this.enemiesOf(u)) { const sv = this.save(f, 'WIS', dc, { spell: true }); const d = Math.ceil(roll('3d8').total / (sv.ok ? 2 : 1)); steps.push(this.say(`Spirits sear ${f.name}: ${d}`, () => this.applyDamage(u, f, d, 'radiant', { magic: true }))); }
      }
      if (e.saveEnd && e.rounds > 0) {
        const sv = this.save(u, e.saveEnd.abil, e.saveEnd.dc, { cond: true });
        if (sv.ok) { removeEffect(u, e.id); steps.push(this.say(`${u.name} shakes off ${(CONDITIONS[e.id] || BUFFS[e.id] || { name: e.id }).name}!`)); }
      }
    }
    if (!isChar(u)) {
      if (u.traits.includes('regen') && !u.burned && u.hp > 0) { const h = Math.ceil(u.maxhp * 0.06); u.hp = Math.min(u.maxhp, u.hp + h); steps.push(this.say(`${u.name} regenerates ${h} HP.`)); }
      u.burned = false;
      if (u.mechs.includes('regen')) { const h = Math.ceil(u.maxhp * 0.03); u.hp = Math.min(u.maxhp, u.hp + h); }
      for (const a of u.attacks) if (a.eff && a.eff.recharge && !u.recharge[a.name]) { if (roll('1d6').total >= a.eff.recharge) u.recharge[a.name] = true; }
    }
    if (u.effects.some(e => CONDITIONS[e.id] && CONDITIONS[e.id].skip)) {
      const e = u.effects.find(e => CONDITIONS[e.id] && CONDITIONS[e.id].skip);
      steps.push(this.say(`${u.name} is ${CONDITIONS[e.id].name.toLowerCase()}!`));
      this.decay(u);
      this.run(steps, () => this.after()); return null;
    }
    if (hasEff(u, 'prone')) { removeEffect(u, 'prone'); steps.push(this.say(`${u.name} stands up.`)); }
    // haste substat: chance of a bonus extra action
    const hasteP = isChar(u) ? derive(u.ch).haste : (effOf(u, 'frenzy') ? 10 * effOf(u, 'frenzy').stacks : 0);
    if (hasteP && R() * 100 < hasteP) { this.extraAction = true; steps.push(this.say(`${u.name} moves with haste! Extra action.`)); }
    return steps;
  }
  deathSave(u) {
    const c = u.ch;
    if (c.dead || c.stable) return 'skip';
    c.dying = c.dying || { ok: 0, fail: 0 };
    const D = derive(c); let r = d20(); if (D.sp.traits.includes('lucky') && r === 1) r = d20();
    const total = r + D.condSave;
    let msg;
    if (r === 20) { c.hp = 1; delete c.dying; msg = `${c.name} death save: NAT 20!\nBack up with 1 HP!`; SFX.nat20(); }
    else if (r === 1) { c.dying.fail += 2; msg = `${c.name} death save: NAT 1. Two failures.`; SFX.nat1(); }
    else if (total >= 10) { c.dying.ok++; msg = `${c.name} death save: ${r}+${D.condSave}. Success (${c.dying.ok}/3)`; SFX.ds_ok(); }
    else { c.dying.fail++; msg = `${c.name} death save: ${r}. Failure (${c.dying.fail}/3)`; SFX.ds_fail(); }
    const steps = [this.say(msg)];
    if (c.dying && c.dying.ok >= 3) { c.stable = true; delete c.dying; steps.push(this.say(`${c.name} is stable.`, () => { SFX.stabilize(); if (!c.ai) G.stats.stabilized++; })); }
    if (c.dying && c.dying.fail >= 3) { c.dead = true; delete c.dying; steps.push(this.say(`${c.name} has died.`, () => SFX.death())); }
    this.run(steps, () => this.after());
    return null;
  }
  decay(u) { for (const e of u.effects) if (e.rounds != null && e.rounds < 90) e.rounds--; u.effects = u.effects.filter(e => e.rounds == null || e.rounds > 0); }
  beginAction(u) {
    if (this.state === 'over') return;
    if (this.checkEnd()) return;
    if (u.side === 'party' && isChar(u) && u.ctrl === 'local' && !(S.autoBattle && u.ch === G)) { this.state = 'menu'; this.menu = 0; return; }
    if (u.side === 'party' && isChar(u) && u.ctrl && u.ctrl.startsWith('remote')) { this.state = 'remote'; this.remoteWait = 600; NET.requestTurn && NET.requestTurn(this, u); return; }
    const steps = u.side === 'foe' || !isChar(u) ? this.monsterTurn(u) : this.aiTurn(u);
    this.run(steps, () => this.after());
  }
  after() {
    const u = this.actor;
    if (u && this.extraAction && alive(u) && this.state !== 'over') { this.extraAction = false; return this.beginAction(u); }
    if (u) this.decay(u);
    // legendary actions after a party member's turn
    const steps = [];
    if (u && u.side === 'party') for (const b of this.foes) if (b.legendary && b.legLeft > 0 && alive(b) && R() < 0.55) { b.legLeft--; steps.push(...this.legendaryAction(b)); }
    if (steps.length) this.run(steps, () => this.nextTurn()); else this.nextTurn();
  }
  checkEnd() {
    if (this.state === 'over') return true;
    if (this.foes.every(f => !alive(f) || f.hp <= 0)) { this.win(); return true; }
    const standing = this.party.filter(u => isChar(u) && u.ch.hp > 0);
    if (!standing.length) { this.lose(); return true; }
    return false;
  }
  // ------------------------------------------------------------------ helpers
  enemiesOf(u) { return (u.side === 'party' ? this.foes : this.party).filter(alive); }
  alliesOf(u) { return (u.side === 'party' ? this.party : this.foes).filter(x => x !== u || true); }
  spellDC(u) { return isChar(u) ? (derive(u.ch).spell || { dc: 10 }).dc : u.dc; }
  spellAtk(u) { return isChar(u) ? (derive(u.ch).spell || { atk: 0 }).atk : u.hit; }
  advState(att, tgt, opt = {}) {
    let adv = 0, dis = 0;
    if (condFlag(att, 'attackDis')) dis++;
    if (hasEff(att, 'invisible') || hasEff(att, 'hidden') || condFlag(att, 'attackAdv')) adv++;
    if (hasEff(att, 'reckless') && opt.reckless) adv++;
    if (opt.reckless) adv++;
    if (tgt && tgt.effects.some(e => e.id === 'vowed' && e.src === att.id)) adv++;
    if (tgt && condFlag(tgt, 'attackedAdv')) adv++;
    if (tgt && (hasEff(tgt, 'dodging') || hasEff(tgt, 'invisible') || condFlag(tgt, 'attackedDis'))) dis++;
    if (!isChar(att) && att.traits && att.traits.includes('pack') && this.alliesOf(att).filter(alive).length > 1) adv++;
    return adv && !dis ? 1 : dis && !adv ? -1 : 0;
  }
  d20adv(adv, unit) {
    let a = d20(), b = d20();
    const lucky = unit && isChar(unit) && derive(unit.ch).sp.traits.includes('lucky');
    if (lucky && a === 1) a = d20(); if (lucky && b === 1) b = d20();
    return adv > 0 ? Math.max(a, b) : adv < 0 ? Math.min(a, b) : a;
  }
  save(u, abil, dc, opt = {}) {
    let bonus;
    if (isChar(u)) { const D = derive(u.ch); bonus = D.saves[abil] + (opt.cond ? D.condSave : 0); if (D.sp.traits.includes('feyblood') && opt.charm) opt.adv = 1; if (D.sp.traits.includes('stoneblood') && opt.poison) opt.adv = 1; if (D.sp.traits.includes('cunning') && opt.spell && ['INT', 'WIS', 'CHA'].includes(abil)) opt.adv = 1; }
    else bonus = (u.saves[abil] || 0);
    for (const v of this.party) if (u.side === 'party' && isChar(v) && hasFeature(v.ch, 'aura') && alive(v)) { bonus += Math.max(1, derive(v.ch).M.CHA); break; }
    if (hasEff(u, 'bless')) bonus += roll('1d4').total;
    if (hasEff(u, 'bane') || hasEff(u, 'doomed')) bonus -= 2;
    let adv = opt.adv || 0;
    if (!isChar(u) && opt.spell && u.traits.includes('magicres')) adv = 1;
    if (hasEff(u, 'foresight')) adv = 1;
    if ((abil === 'STR' || abil === 'DEX') && condFlag(u, 'failStrDex')) return { ok: false, roll: 0, total: 0, auto: true };
    if (abil === 'DEX' && condFlag(u, 'dexSaveDis')) adv = adv > 0 ? 0 : -1;
    const r = this.d20adv(adv, u), total = r + bonus;
    let ok = total >= dc;
    if (!ok && !isChar(u) && u.legRes > 0) { u.legRes--; ok = true; this.pushNote(`${u.name} uses LEGENDARY RESISTANCE!`); }
    if (!ok && isChar(u) && u.ch.res.indomitable > 0) { const r2 = d20() + bonus; if (r2 >= dc) { u.ch.res.indomitable--; ok = true; } }
    if (!ok && isChar(u) && u.ch.res.lucky > 0) { const r2 = d20() + bonus; u.ch.res.lucky--; if (r2 >= dc) ok = true; }
    return { ok, roll: r, total };
  }
  pushNote(t) { this.q.unshift(this.say(t)); }
  heal(u, amt) {
    if (hasEff(u, 'cursed')) return 0;
    const mx = maxHpOf(u), before = hpOf(u);
    if (isChar(u) && u.ch.hp <= 0) { u.ch.hp = 0; delete u.ch.dying; delete u.ch.stable; if (u.ch.dead) return 0; }
    setHp(u, Math.min(mx, Math.max(0, hpOf(u)) + amt));
    FX.number(this.posOf(u)[0], this.posOf(u)[1] - 10, '+' + Math.round(hpOf(u) - Math.max(0, before)), 'green');
    return hpOf(u) - before;
  }
  // core damage pipeline
  applyDamage(src, tgt, amt, type, opt = {}) {
    if (amt <= 0 || !tgt) return 0;
    let a = amt;
    const resists = isChar(tgt) ? derive(tgt.ch).res : new Set(tgt.res);
    const imm = isChar(tgt) ? [] : tgt.imm, vuln = isChar(tgt) ? [] : tgt.vuln;
    const phys = ['slashing', 'piercing', 'bludgeoning'].includes(type);
    if (imm.includes(type)) return this.note(tgt, 'IMMUNE'), 0;
    if (resists.has(type) || (phys && !opt.magic && resists.has('bph')) || (phys && !opt.magic && !isChar(tgt) && tgt.res.includes('bph'))) a = Math.floor(a / 2);
    if (vuln.includes(type)) a *= 2;
    if (hasEff(tgt, 'rage') && (phys || (isChar(tgt) && subKey(tgt.ch, 'totem') && type !== 'psychic'))) a = Math.floor(a / 2);
    if (isChar(tgt)) { const D = derive(tgt.ch); a = Math.round(a * (1 - D.resistAll / 100)); if (opt.attack && D.block && R() * 100 < D.block) { a = Math.floor(a / 2); SFX.block(); } }
    for (const e of tgt.effects) { const d = BUFFS[e.id]; if (d && d.takenPct) a = Math.round(a * (1 + d.takenPct / 100)); }
    if (opt.attack && isChar(tgt) && hasFeature(tgt.ch, 'uncanny') && !this.uncannyFor) { this.uncannyFor = tgt.id; a = Math.floor(a / 2); }
    // temp HP / wild shape pool
    const ws = effOf(tgt, 'wildshape'); if (ws) { const take = Math.min(ws.pool, a); ws.pool -= take; a -= take; if (ws.pool <= 0) removeEffect(tgt, 'wildshape'); }
    if (tgt.temp) { const take = Math.min(tgt.temp, a); tgt.temp -= take; a -= take; }
    const barrier = effOf(tgt, 'barrier'); if (barrier) { const take = Math.min(barrier.pool, a); barrier.pool -= take; a -= take; if (barrier.pool <= 0) removeEffect(tgt, 'barrier'); }
    a = Math.max(0, Math.round(a));
    if (!isChar(tgt) && (type === 'fire' || type === 'acid')) tgt.burned = true;
    const before = hpOf(tgt);
    setHp(tgt, before - a);
    const [px, py] = this.posOf(tgt);
    if (a) { FX.number(px, py - 12, a, opt.crit ? 'orange' : 3); FX.burst(px, py - 4, opt.crit ? 14 : 6, opt.crit ? 'orange' : 2); this.anim.flash[tgt.id] = 16; }
    if (hasEff(tgt, 'asleep') && a > 0) removeEffect(tgt, 'asleep');
    // concentration
    if (a > 0 && isChar(tgt) && tgt.conc) { const sv = this.save(tgt, 'CON', Math.max(10, Math.floor(a / 2)), { adv: tgt.ch.feats.includes('warcaster') ? 1 : 0 }); if (!sv.ok) this.dropConc(tgt); }
    // threat, leech, thorns
    if (src && tgt.side === 'foe') tgt.threat[src.id] = (tgt.threat[src.id] || 0) + a * (isChar(src) && CLASSES[src.ch.cls].role === 'tank' ? 2.5 : 1) + 1;
    if (src && isChar(src) && a > 0) { const L = derive(src.ch).leech; if (L) this.heal(src, Math.ceil(a * L / 100)); }
    if (src && a > 0 && opt.attack && !opt.ranged) {
      let th = isChar(tgt) ? derive(tgt.ch).thorns : (tgt.mechs && tgt.mechs.includes('reflect') ? Math.ceil(a * 0.15) : 0);
      if (hasEff(tgt, 'thornskin')) th += 6;
      if (th) { setHp(src, hpOf(src) - th); FX.number(this.posOf(src)[0], this.posOf(src)[1] - 12, th, 2); }
    }
    if (src && !isChar(src) && src.mechs && src.mechs.includes('drain') && opt.attack) src.hp = Math.min(src.maxhp, src.hp + Math.ceil(a / 2));
    // falling to 0
    if (hpOf(tgt) <= 0) {
      if (isChar(tgt) && tgt.ch.species === 'tuskborn' && !tgt.relentUsed && -hpOf(tgt) < maxHpOf(tgt)) { tgt.relentUsed = true; tgt.ch.hp = 1; this.pushNote(`${tgt.name} refuses to fall! (RELENTLESS)`); return a; }
      if (isChar(tgt)) {
        if (-hpOf(tgt) >= maxHpOf(tgt)) { tgt.ch.dead = true; }
        tgt.ch.hp = 0; tgt.ch.dying = tgt.ch.dead ? null : (tgt.ch.dying || { ok: 0, fail: 0 }); if (opt.crit && tgt.ch.dying) tgt.ch.dying.fail++;
        this.dropConc(tgt); this.note(tgt, tgt.ch.dead ? 'DIES' : 'DOWN'); SFX.hurt_big();
      } else {
        if (tgt.traits.includes('fortitude') && type !== 'radiant' && !opt.crit) { const sv = this.save(tgt, 'CON', 5 + a); if (sv.ok) { tgt.hp = 1; this.pushNote(`${tgt.name} refuses to fall!`); return a; } }
        tgt.hp = 0; this.onKill(src, tgt);
      }
    } else if (a) (isChar(tgt) ? SFX.hurt : (type === 'bludgeoning' ? SFX.hit_blunt : type === 'piercing' ? SFX.hit_pierce : SFX.hit_slash))();
    return a;
  }
  note(u, txt) { const [x, y] = this.posOf(u); FX.number(x, y - 20, txt, 2); }
  onKill(src, f) {
    SFX[f.boss ? 'boss_die' : 'monster_die'](); this.anim.flash[f.id] = 30;
    if (src && isChar(src) && subKey(src.ch, 'fiend')) src.temp = Math.max(src.temp, derive(src.ch).M.CHA + src.ch.lvl);
    for (const u of this.foes) if (u.effects) u.effects = u.effects.filter(e => e.src !== f.id);
  }
  dropConc(u) {
    if (!u.conc) return;
    for (const x of this.all) x.effects = x.effects.filter(e => !(e.src === u.id && e.conc));
    u.conc = null;
  }
  // ------------------------------------------------------------------ attacks
  weaponAttack(att, tgt, opt = {}) {
    const steps = [];
    const D = isChar(att) ? derive(att.ch) : null;
    let n = opt.single ? 1 : (D ? D.attacks : 1);
    if (D && hasEff(att, 'haste') && !opt.single) n++;
    if (D && hasEff(att, 'rage') && subKey(att.ch, 'frenzy') && !opt.single) n++;
    for (let i = 0; i < n; i++) {
      steps.push({ text: '', act: null, dyn: () => {
        let t = tgt; if (!alive(t)) { const e = this.enemiesOf(att); if (!e.length) return null; t = e[0]; }
        return this.resolveWeapon(att, t, Object.assign({}, opt, { first: i === 0 }));
      } });
    }
    return steps;
  }
  resolveWeapon(att, tgt, opt) {
    const D = derive(att.ch), w = D.weapon, ws = effOf(att, 'wildshape');
    const adv = this.advState(att, tgt, opt);
    let r = this.d20adv(adv, att);
    let bonus = (ws ? D.pb + Math.max(D.M.STR, D.M.WIS) : w.hit) + (hasEff(att, 'bless') ? roll('1d4').total : 0) + (effOf(att, 'inspired') ? 3 : 0) + (effOf(att, 'sacred') ? Math.max(1, D.M.CHA) : 0);
    if (effOf(att, 'inspired')) removeEffect(att, 'inspired');
    if (hasEff(att, 'bane') || hasEff(att, 'doomed')) bonus -= 2;
    const ac = acOf(tgt);
    if (r === 1 && att.ch.res.lucky > 0) { att.ch.res.lucky--; r = d20(); }
    const nat = r, total = r + bonus;
    const assassin = subKey(att.ch, 'assassinate') && !tgt.acted;
    const crit = nat >= D.critRange || condFlag(tgt, 'autoCrit') || assassin || (D.crit && R() * 100 < D.crit && nat !== 1 && total >= ac);
    let hit = nat === 20 || crit || (nat !== 1 && total >= ac);
    if (hasEff(att, 'hidden')) removeEffect(att, 'hidden');
    if (hasEff(att, 'invisible') && !hasEff(att, 'trueveil')) removeEffect(att, 'invisible');
    if (nat === 20 && !att.ch.ai) G.stats.nat20++; if (nat === 1 && !att.ch.ai) G.stats.nat1++;
    const line1 = `${att.name}: ${ws ? 'CLAWS' : w.name}${adv > 0 ? ' (ADV)' : adv < 0 ? ' (DIS)' : ''}`;
    const rollTxt = `d20 ${nat}${bonus >= 0 ? '+' : ''}${bonus}=${total} vs AC${ac}`;
    if (!hit) return { text: `${line1}\n${rollTxt}\n${nat === 1 ? 'NATURAL 1! Miss.' : 'Miss!'}`, act: () => { this.anim.lunge = att.id; SFX[nat === 1 ? 'nat1' : 'miss'](); } };
    // mirror images / dodge on monsters vs players handled in monster attack
    let dice = ws ? '2d6' : w.dice, dmg = roll(dice, crit).total + (ws ? Math.max(D.M.STR, D.M.WIS) : w.dmg);
    const parts = [];
    if (crit && hasFeature(att.ch, 'brutal')) dmg += roll(dice).total;
    if (opt.skillBonus) { const sb = roll(opt.skillBonus, crit).total; dmg += sb; parts.push(`SKILL +${sb}`); }
    if (hasEff(att, 'rage')) { const rb = D.CL >= 16 ? 4 : D.CL >= 9 ? 3 : 2; dmg += rb; }
    if (w.extra && !ws) { const ex = roll(w.extra.dice, crit).total; dmg += ex; parts.push(`+${ex} ${w.extra.type}`); }
    if (hasFeature(att.ch, 'sneak') && !this.sneakUsed && (adv > 0 || this.party.filter(alive).length > 1 || tgt.effects.length)) {
      this.sneakUsed = true; const sd = roll(`${Math.ceil(D.CL / 2) + Math.floor(Math.max(0, att.ch.lvl - 20) / 40)}d6`, crit).total; dmg += sd; parts.push(`SNEAK +${sd}`);
    }
    if (tgt.effects.some(e => (e.id === 'marked' || e.id === 'hexed') && e.src === att.id)) dmg += roll('1d6', crit).total;
    if (hasFeature(att.ch, 'favored') && tgt.effects.some(e => e.id === 'marked' && e.src === att.id)) dmg += roll('1d4').total;
    if (subKey(att.ch, 'colossus') && hpOf(tgt) < maxHpOf(tgt) && opt.first) { const cd = roll('1d8', crit).total; dmg += cd; }
    if (subKey(att.ch, 'maneuver') && !this.maneuverUsed && att.ch.res.maneuver > 0) { this.maneuverUsed = true; att.ch.res.maneuver--; const md = roll('1d8').total; dmg += md; parts.push(`MANEUVER +${md}`); }
    if (hasFeature(att.ch, 'brightsmite')) dmg += roll('1d8', crit).total;
    let smiteTxt = '';
    if (opt.smite) { const sl = this.spendSlot(att, 1, true); if (sl) { const nd = Math.min(5, 1 + sl) + (['undead', 'fiend'].includes(tgt.fam) ? 1 : 0); const sd = roll(`${nd}d8`, crit).total; smiteTxt = ` SMITE +${sd}`; dmg += sd; } }
    dmg = Math.round(dmg * (1 + (D.dmgPct + (effOf(att, 'might') ? 15 : 0) + (effOf(att, 'weakened') ? -25 : 0)) / 100) * (crit ? D.critdmg / 100 : 1));
    const type = ws ? 'slashing' : w.type, magic = w.magic || !!ws;
    return { text: `${line1}\n${rollTxt}\n${crit ? 'CRITICAL! ' : 'Hit! '}${dmg} ${type}${smiteTxt}`,
      act: () => {
        this.anim.lunge = att.id; if (crit) { SFX.crit(); shake = 8; } if (nat === 20) SFX.nat20();
        this.applyDamage(att, tgt, dmg, type, { attack: true, crit, magic, ranged: w.ranged });
        if (opt.stun && alive(tgt)) { const sv = this.save(tgt, 'CON', 8 + D.pb + D.M.WIS); if (!sv.ok && !tgt.condImm.includes('stunned')) { addEffect(tgt, { id: 'stunned', rounds: 1 }); this.pushNote(`${tgt.name} is STUNNED!`); SFX.stun(); } else this.pushNote(`${tgt.name} resists the stun.`); }
        if (opt.prone && alive(tgt)) { const sv = this.save(tgt, 'DEX', 8 + D.pb + D.M.WIS); if (!sv.ok) { addEffect(tgt, { id: 'prone', rounds: 1 }); this.pushNote(`${tgt.name} is knocked PRONE!`); } }
      } };
  }
  // expand dyn steps lazily
  run2(steps, then) { this.run(steps, then); }
  // ------------------------------------------------------------------ spells
  spendSlot(u, lvl, highest = false) {
    const c = u.ch, res = c.res;
    if (res.pact != null && res.pact > 0) { const D = derive(c); if (D.spell.pact.lvl >= lvl) { res.pact--; return D.spell.pact.lvl; } }
    if (!res.slots) return 0;
    const range = []; for (let l = lvl; l <= res.slots.length; l++) range.push(l);
    if (highest) range.reverse();
    for (const l of range) if (res.slots[l - 1] > 0) { res.slots[l - 1]--; return l; }
    return 0;
  }
  canCast(u, sp) {
    if (condFlag(u, 'noSpells')) return false;
    if (sp.lvl === 0) return true;
    const c = u.ch, D = derive(c);
    if (D.spell.arcanum.includes(sp.lvl) && sp.lvl > (D.spell.pact ? D.spell.pact.lvl : 99)) return (c.res.arcanum || []).includes(sp.lvl);
    if (c.res.pact > 0 && D.spell.pact.lvl >= sp.lvl) return true;
    return (c.res.slots || []).some((n, i) => n > 0 && i + 1 >= sp.lvl);
  }
  castSpell(u, sp, targets) {
    const steps = [];
    let slot = 0;
    if (isChar(u) && sp.lvl > 0) {
      const D = derive(u.ch);
      if (D.spell.arcanum.includes(sp.lvl) && sp.lvl > (D.spell.pact ? D.spell.pact.lvl : 99)) { u.ch.res.arcanum = u.ch.res.arcanum.filter(l => l !== sp.lvl); slot = sp.lvl; }
      else slot = this.spendSlot(u, sp.lvl);
      if (!slot) return [this.say(`No spell slots left for ${sp.name}!`, () => SFX.error())];
      if (sp.lvl === 9 && !u.ch.ai) G.stats.spell9++;
    }
    if (sp.conc) { this.dropConc(u); u.conc = sp.id; }
    const up = Math.max(0, slot - sp.lvl);
    const lvlOf = isChar(u) ? u.ch.lvl : u.lvl;
    const tier = sp.lvl === 0 ? (lvlOf >= 17 ? 4 : lvlOf >= 11 ? 3 : lvlOf >= 5 ? 2 : 1) + Math.floor(Math.max(0, lvlOf - 20) / 50) : 1;
    const D = isChar(u) ? derive(u.ch) : null;
    const dc = this.spellDC(u), atk = this.spellAtk(u);
    const powerScale = isChar(u) ? 1 + (D.dmgPct + (D.elem[sp.dt] || 0)) / 100 + Math.max(0, lvlOf - 20) / 40 : 1 + Math.max(0, lvlOf - 20) / 30;
    const schoolSfx = sp.school + '_cast';
    steps.push(this.say(`${u.name} casts ${sp.name}!${slot ? ` (L${slot})` : ''}`, () => { SFX[schoolSfx](); this.anim.lunge = u.id; this.anim.fx = { name: spellArt(sp) || (sp.dt === 'fire' ? 'fx_burst' : 'fx_sparkle'), t: 20, on: targets.map(t => t.id) }; }, 6));
    const dmgRoll = (crit = false) => {
      let ex = sp.dice; const cnt = ex.match(/^(\d+)d(\d+)(.*)$/);
      if (cnt && sp.lvl === 0) ex = `${+cnt[1] * tier}d${cnt[2]}${cnt[3] || ''}`;
      let total = roll(ex, crit, this.maxNext && (sp.dt === 'lightning' || sp.dt === 'thunder')).total;
      if (up && sp.scale) for (let i = 0; i < up; i++) total += roll(sp.scale).total;
      if (D) {
        if (subKey(u.ch, 'evoker') && sp.school === 'storm') total += D.M.INT;
        if (subKey(u.ch, 'draconic') && sp.dt === 'fire') total += D.M.CHA;
        if (sp.id === 'hexbolt' && hasFeature(u.ch, 'agonizing')) total += D.M.CHA;
      }
      return Math.max(1, Math.round(total * powerScale));
    };
    for (const t of targets) {
      if (sp.eff === 'dmg') {
        const hits = sp.beams ? tier : sp.rays ? sp.rays + up : 1;
        for (let h = 0; h < hits; h++) {
          steps.push({ text: '', dyn: () => {
            if (!alive(t)) return null;
            if (sp.atk) {
              const adv = this.advState(u, t), r = this.d20adv(adv, u), tot = r + atk, ac = acOf(t), crit = r === 20 || condFlag(t, 'autoCrit');
              if (!(crit || (r !== 1 && tot >= ac))) return { text: `${sp.name} vs ${t.name}\nd20 ${r}+${atk}=${tot} vs AC${ac}\nMiss!`, act: () => SFX.miss() };
              const d = dmgRoll(crit);
              return { text: `${sp.name} vs ${t.name}\nd20 ${r}+${atk}=${tot} vs AC${ac}\n${crit ? 'CRIT! ' : ''}${d} ${sp.dt}`, act: () => { SFX[sp.school + '_hit'](); this.applyDamage(u, t, d, sp.dt, { magic: true, crit }); this.spellCond(u, sp, t, dc, true); } };
            }
            if (sp.save) {
              const sv = this.save(t, sp.save, dc, { spell: true });
              let d = dmgRoll();
              const evade = isChar(t) && sp.save === 'DEX' && hasFeature(t.ch, 'evasion');
              if (sv.ok) d = evade ? 0 : (sp.half ? Math.floor(d / 2) : 0); else if (evade) d = Math.floor(d / 2);
              return { text: `${t.name} ${sp.save} save: ${sv.auto ? 'auto-fail' : `${sv.roll}=${sv.total}`} vs DC${dc}\n${sv.ok ? 'Saved!' : 'Failed!'} ${d} ${sp.dt}`, act: () => { SFX[sp.school + '_hit'](); if (d) this.applyDamage(u, t, d, sp.dt, { magic: true }); if (!sv.ok) this.spellCond(u, sp, t, dc, true); } };
            }
            const d = dmgRoll();
            return { text: `${sp.name} strikes ${t.name}\n${d} ${sp.dt} damage!`, act: () => { SFX[sp.school + '_hit'](); this.applyDamage(u, t, d, sp.dt, { magic: true }); } };
          } });
        }
      } else if (sp.eff === 'heal') {
        steps.push({ text: '', dyn: () => {
          if (isChar(t) && t.ch.dead) return { text: `${t.name} is beyond healing.` };
          let h = sp.dice.includes('d') ? roll(sp.dice).total : +sp.dice;
          if (up && sp.scale) for (let i = 0; i < up; i++) h += roll(sp.scale).total;
          if (sp.mod) h += isChar(u) ? D.spell.mod : 3;
          if (isChar(u) && subKey(u.ch, 'lifedomain')) h += 2 + slot;
          if (D) h = Math.round(h * (1 + D.healPct / 100) * (1 + Math.max(0, lvlOf - 20) / 40));
          return { text: `${t.name} recovers ${h} HP.`, act: () => { SFX.heal(); this.heal(t, h); if (sp.cleanse) t.effects = t.effects.filter(e => (BUFFS[e.id] && BUFFS[e.id].good) || e.id === 'rage'); if (sp.regen) addEffect(t, { id: 'regen', rounds: 5 }); } };
        } });
      } else if (sp.eff === 'cond') {
        steps.push({ text: '', dyn: () => {
          if (!alive(t)) return null;
          if (sp.maxHp && hpOf(t) > sp.maxHp * (1 + Math.max(0, lvlOf - 20) / 20)) return { text: `${t.name} is too mighty for ${sp.name}.` };
          if (sp.save) { const sv = this.save(t, sp.save, dc, { spell: true, cond: true, charm: sp.cond === 'charmed' || sp.cond === 'dominated' }); if (sv.ok) return { text: `${t.name} ${sp.save} save ${sv.roll}=${sv.total} vs DC${dc}\nResisted!`, act: () => SFX.thrall_hit() }; }
          return { text: `${t.name} is ${CONDITIONS[sp.cond].name.toLowerCase()}!`, act: () => { this.spellCond(u, sp, t, dc, false); } };
        } });
      } else if (sp.eff === 'buff') {
        steps.push(this.say(`${t.name} is ${(BUFFS[sp.buff] || { name: sp.buff }).name.toLowerCase()}.`, () => { SFX.bless(); addEffect(t, { id: sp.buff, rounds: sp.dur || 10, val: sp.val, src: u.id, conc: sp.conc, stacks: sp.buff === 'mirror' ? sp.val : 1 }); }));
      } else if (sp.eff === 'sleep') {
        steps.push({ text: '', dyn: () => {
          let pool = roll(sp.dice).total * (1 + Math.max(0, lvlOf - 10) / 10); for (let i = 0; i < up; i++) pool += roll(sp.scale).total;
          const victims = this.enemiesOf(u).filter(f => !f.condImm.includes('asleep')).sort((a, b) => hpOf(a) - hpOf(b)), slept = [];
          for (const f of victims) { if (hpOf(f) > pool) break; pool -= hpOf(f); addEffect(f, { id: 'asleep', rounds: 10 }); slept.push(f.name); }
          return { text: slept.length ? `${slept.join(', ')} fall asleep!` : 'Nobody falls asleep.', act: () => SFX.sleep() };
        } });
        break;
      } else if (sp.eff === 'revive') {
        steps.push(this.say(`${t.name} returns to the fight!`, () => { delete t.ch.dead; delete t.ch.dying; delete t.ch.stable; t.ch.hp = sp.full ? Math.ceil(maxHpOf(t) / 2) : 1; SFX.revive(); }));
      } else if (sp.eff === 'cleanse') {
        steps.push(this.say(`${t.name} is cleansed.`, () => { const bad = t.effects.find(e => !(BUFFS[e.id] && BUFFS[e.id].good)); if (bad) removeEffect(t, bad.id); SFX.heal(); }));
      } else if (sp.eff === 'summon') {
        steps.push(this.say('A spectral mace appears!', () => addEffect(u, { id: 'mace', rounds: 10, src: u.id })));
      } else if (sp.eff === 'kill') {
        steps.push({ text: '', dyn: () => (hpOf(t) <= sp.maxHp * (1 + Math.max(0, lvlOf - 20) / 20) ? { text: `${t.name} is undone by a single word.`, act: () => this.applyDamage(u, t, hpOf(t), 'psychic', { magic: true }) } : { text: `${t.name} withstands the word.` }) });
      }
    }
    if (isChar(u) && subKey(u.ch, 'wildsurge') && R() < 0.15) steps.push(this.say('WILD SURGE! Magic crackles around you.', () => { const k = Math.floor(R() * 3); if (k === 0) this.heal(u, roll('2d10').total); else if (k === 1) addEffect(u, { id: 'haste', rounds: 2 }); else u.temp += roll('3d8').total; SFX.flux_hit(); }));
    this.maxNext = false;
    return steps;
  }
  spellCond(u, sp, t, dc, fromDmg) {
    if (!sp.cond) return;
    if (t.condImm && t.condImm.includes(sp.cond)) return;
    addEffect(t, { id: sp.cond, rounds: sp.dur || 1, src: u.id, conc: sp.conc, saveEnd: sp.saveEnd ? { abil: sp.save, dc } : null });
    SFX[{ paralyzed: 'stun', stunned: 'stun', asleep: 'sleep', charmed: 'charm', dominated: 'charm', frightened: 'fear', restrained: 'stun', banished: 'veil_hit', blinded: 'veil_hit' }[sp.cond] || 'thrall_hit']();
  }
  // ------------------------------------------------------------------ class abilities
  abilities(u) {
    const c = u.ch, D = derive(c), r = c.res, list = [];
    const add = (id, name, cost, ok, bonus, fn, target) => list.push({ id, name, cost, ok, bonus, fn, target });
    if (!c.ai) for (const skill of (c.activeSkills || []).filter(id => ACTIVE_SKILLS.some(def => def.id === id && def.classes.includes(c.cls)))) {
      const used = this.skillUses.has(skill);
      if (skill === 'power_strike') add('skill_power_strike', 'POWER STRIKE', used ? 'USED' : 'ONCE', !used, false, t => { this.skillUses.add(skill); return this.weaponAttack(u, t, { single: true, skillBonus: `${2 + Math.floor(D.CL / 10)}d8` }); }, 'enemy');
      if (skill === 'rally') add('skill_rally', 'BATTLE RALLY', used ? 'USED' : 'ONCE', !used && !this.bonusUsed, true, () => { this.skillUses.add(skill); const targets = this.party.filter(member => isChar(member) && !member.ch.dead); return [this.say(`${c.name} rallies the party!`, () => { targets.forEach(member => addEffect(member, { id: 'inspired', rounds: 10 })); SFX.charm(); })]; });
      if (skill === 'field_mend') add('skill_field_mend', 'FIELD MEND', used ? 'USED' : 'ONCE', !used, false, t => { this.skillUses.add(skill); const heal = roll(`${2 + Math.floor(D.CL / 8)}d8`).total + Math.max(1, D.M.WIS); return [this.say(`${c.name} mends ${t.name}: +${heal} HP`, () => { this.heal(t, heal); SFX.heal(); })]; }, 'ally');
      if (skill === 'shadowstep') add('skill_shadowstep', 'SHADOW STEP', used ? 'USED' : 'ONCE', !used && !this.bonusUsed, true, () => { this.skillUses.add(skill); return [this.say(`${c.name} vanishes into a shadow.`, () => { addEffect(u, { id: 'invisible', rounds: 2 }); SFX.veil_cast(); })]; });
      if (skill === 'arcane_burst') add('skill_arcane_burst', 'ARCANE BURST', used ? 'USED' : 'ONCE', !used, false, t => { this.skillUses.add(skill); return this.castSpell(u, { id: 'skill_arcane_burst', name: 'ARCANE BURST', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', atk: true, dice: '2d8', dt: 'force' }, [t]); }, 'enemy');
      if (skill === 'spirit_call') add('skill_spirit_call', 'SPIRIT CALL', used ? 'USED' : 'ONCE', !used && this.party.length < 12, false, () => { this.skillUses.add(skill); return [this.say(`${c.name} calls a spirit wolf!`, () => { this.addSummon(u, 'wolf'); SFX.growl(); })]; });
      if (skill === 'sunflare') add('skill_sunflare', 'SUNFLARE', used ? 'USED' : 'ONCE', !used, false, t => { this.skillUses.add(skill); return this.castSpell(u, { id: 'skill_sunflare', name: 'SUNFLARE', school: 'storm', lvl: 0, t: 'enemy', eff: 'dmg', save: 'DEX', half: true, dice: '2d8', dt: 'radiant' }, [t]); }, 'enemy');
      if (skill === 'warding_aura') add('skill_warding_aura', 'WARDING AURA', used ? 'USED' : 'ONCE', !used, false, () => { this.skillUses.add(skill); const allies = this.party.filter(member => isChar(member) && !member.ch.dead); return [this.say(`${c.name} fortifies the party with an arcane ward.`, () => { allies.forEach(member => addEffect(member, { id: 'fortify', rounds: 3 })); SFX.buff(); })]; });
    }
    if (hasFeature(c, 'secondwind')) add('wind', 'SECOND WIND', `${r.wind || 0}/1`, r.wind > 0 && !this.bonusUsed, true, () => { r.wind--; const h = roll('1d10').total + D.CL; return [this.say(`${c.name} catches a second wind: +${h} HP`, () => { this.heal(u, h); SFX.heal(); })]; });
    if (hasFeature(c, 'surge')) add('surge', 'ACTION SURGE', `${r.surge || 0}`, r.surge > 0, true, () => { r.surge--; this.extraAction = true; return [this.say(`${c.name} surges! One more action.`, () => SFX.buff())]; });
    if (hasFeature(c, 'rage')) add('rage', 'RAGE', `${r.rage || 0}`, r.rage > 0 && !hasEff(u, 'rage') && !this.bonusUsed, true, () => { r.rage--; return [this.say(`${c.name} flies into a RAGE!`, () => { addEffect(u, { id: 'rage', rounds: 99 }); SFX.roar(); })]; });
    if (hasFeature(c, 'reckless')) add('reckless', 'RECKLESS ATTACK', 'ADV', true, false, t => { addEffect(u, { id: 'reckless', rounds: 1 }); return this.weaponAttack(u, t, { reckless: true }); }, 'enemy');
    if (hasFeature(c, 'layhands')) add('layhands', 'LAY ON HANDS', `${r.layhands || 0}`, r.layhands > 0, false, t => { const need = maxHpOf(t) - Math.max(0, hpOf(t)); const h = Math.min(need || 1, r.layhands); r.layhands -= h; return [this.say(`${c.name} lays on hands: +${h} HP to ${t.name}`, () => { this.heal(t, h); SFX.calling_hit(); })]; }, 'ally');
    if (hasFeature(c, 'smite')) add('smite', 'SMITING STRIKE', 'SLOT', this.canCast(u, { lvl: 1 }), false, t => this.weaponAttack(u, t, { smite: true }), 'enemy');
    if (subKey(c, 'sacred')) add('sacred', 'SACRED WEAPON', `${r.subpower || 0}`, r.subpower > 0 && !this.bonusUsed, true, () => { r.subpower--; return [this.say('Your weapon blazes with holy light.', () => { addEffect(u, { id: 'sacred', rounds: 10 }); SFX.bless(); })]; });
    if (subKey(c, 'vow')) add('vow', 'VOW OF ENMITY', 'BONUS', !this.bonusUsed, true, t => [this.say(`${c.name} swears a vow against ${t.name}!`, () => addEffect(t, { id: 'vowed', rounds: 99, src: u.id }))], 'enemy');
    if (hasFeature(c, 'cunning')) add('hide', 'HIDE', 'BONUS', !this.bonusUsed, true, () => [this.say(`${c.name} slips into the shadows.`, () => { addEffect(u, { id: 'hidden', rounds: 2 }); SFX.veil_cast(); })]);
    if (hasFeature(c, 'ki')) {
      add('flurry', 'FLURRY OF BLOWS', `${r.ki || 0} KI`, r.ki >= 1 && !this.bonusUsed, true, t => { r.ki--; return this.weaponAttack(u, t, { single: true, prone: subKey(c, 'openhand') }).concat(this.weaponAttack(u, t, { single: true, prone: subKey(c, 'openhand') })); }, 'enemy');
      add('patient', 'PATIENT DEFENSE', '1 KI', r.ki >= 1 && !this.bonusUsed, true, () => { r.ki--; return [this.say(`${c.name} takes a defensive stance.`, () => addEffect(u, { id: 'dodging', rounds: 1 }))]; });
    }
    if (hasFeature(c, 'stunning')) add('stun', 'STUNNING STRIKE', '1 KI', r.ki >= 1, false, t => { r.ki--; return this.weaponAttack(u, t, { stun: true, single: true }); }, 'enemy');
    if (hasFeature(c, 'quicken')) add('quicken', 'QUICKEN SPELL', `${r.sp || 0} SP`, r.sp >= 2 && !this.quicken, true, () => { r.sp -= 2; this.quicken = true; return [this.say('Your next spell is quickened.', () => SFX.flux_cast())]; });
    if (hasFeature(c, 'sorcery')) add('font', 'FONT OF MAGIC', '2 SP>SLOT', r.sp >= 2 && r.slots && !this.bonusUsed, true, () => { r.sp -= 2; r.slots[0] = (r.slots[0] || 0) + 1; return [this.say('Sorcery points become a spell slot.', () => SFX.buff())]; });
    if (hasFeature(c, 'inspire')) add('inspire', 'INSPIRATION', `${r.inspire || 0}`, r.inspire > 0 && !this.bonusUsed, true, t => { r.inspire--; return [this.say(`${c.name} inspires ${t.name}!`, () => { addEffect(t, { id: 'inspired', rounds: 10 }); SFX.charm(); })]; }, 'ally');
    if (hasFeature(c, 'channel')) {
      add('turn', 'TURN UNDEAD', `${r.channel || 0}`, r.channel > 0, false, () => { r.channel--; const dc = this.spellDC(u); return this.enemiesOf(u).filter(f => f.fam === 'undead').map(f => ({ text: '', dyn: () => { const sv = this.save(f, 'WIS', dc); if (sv.ok) return { text: `${f.name} resists the turning.` }; if (hasFeature(c, 'destroyundead') && f.lvl <= Math.floor(D.CL / 2) && !f.boss) return { text: `${f.name} is DESTROYED!`, act: () => this.applyDamage(u, f, f.hp, 'radiant', { magic: true }) }; return { text: `${f.name} is turned and flees in fear!`, act: () => addEffect(f, { id: 'frightened', rounds: 3 }) }; } })).concat([this.say('Holy light floods the field!', () => SFX.bless())]); });
      if (subKey(c, 'lifedomain')) add('preserve', 'PRESERVE LIFE', `${r.channel || 0}`, r.channel > 0, false, () => { r.channel--; let pool = 5 * D.CL; return this.party.filter(x => isChar(x) && hpOf(x) < maxHpOf(x) / 2 && !x.ch.dead).map(x => { const h = Math.min(pool, Math.ceil(maxHpOf(x) / 2) - Math.max(0, hpOf(x))); pool -= h; return this.say(`${x.name} is restored: +${h}`, () => this.heal(x, h)); }); });
    }
    if (subKey(c, 'tempest')) add('wrath', 'DESTRUCTIVE WRATH', `${r.subpower || 0}`, r.subpower > 0 && !this.bonusUsed, true, () => { r.subpower--; this.maxNext = true; return [this.say('Storm gathers. Your next lightning will be maximal.', () => SFX.shock())]; });
    if (subKey(c, 'feypresence')) add('fey', 'FEY PRESENCE', `${r.subpower || 0}`, r.subpower > 0, false, () => { r.subpower--; const dc = this.spellDC(u); return this.enemiesOf(u).map(f => ({ text: '', dyn: () => { const sv = this.save(f, 'WIS', dc, { charm: true }); return sv.ok ? { text: `${f.name} resists.` } : { text: `${f.name} is charmed!`, act: () => addEffect(f, { id: 'charmed', rounds: 1 }) }; } })); });
    if (hasFeature(c, 'wildshape')) add('wild', 'BEASTSHAPE', `${r.wild || 0}`, r.wild > 0 && !hasEff(u, 'wildshape') && (!subKey(c, 'moon') || !this.bonusUsed), !!subKey(c, 'moon'), () => { r.wild--; const pool = Math.round((10 + D.CL * 8) * (subKey(c, 'moon') ? 1.6 : 1) * (1 + Math.max(0, c.lvl - 20) / 20)); return [this.say(`${c.name} becomes a great bear! (+${pool} HP)`, () => { addEffect(u, { id: 'wildshape', rounds: 99, pool }); SFX.growl(); })]; });
    if (c.species === 'drakkin') add('breath', 'DRAGON BREATH', `${r.breath || 0}`, r.breath > 0, false, () => { r.breath--; const n = (D.CL >= 16 ? 5 : D.CL >= 11 ? 4 : D.CL >= 6 ? 3 : 2) + Math.floor(Math.max(0, c.lvl - 20) / 30); const dc = 8 + D.M.CON + D.pb; return [this.say(`${c.name} breathes fire!`, () => SFX.storm_cast())].concat(this.enemiesOf(u).map(f => ({ text: '', dyn: () => { const sv = this.save(f, 'DEX', dc); const d = Math.floor(roll(`${n}d6`).total * (sv.ok ? 0.5 : 1) * (1 + D.dmgPct / 100)); return { text: `${f.name} DEX ${sv.total} vs DC${dc}\n${d} fire`, act: () => this.applyDamage(u, f, d, 'fire', { magic: true }) }; } }))); });
    add('dodge', 'DODGE', 'ACTION', true, false, () => [this.say(`${c.name} takes the Dodge action.`, () => { addEffect(u, { id: 'dodging', rounds: 1 }); SFX.dodge(); })]);
    return list;
  }
  // ------------------------------------------------------------------ AI
  aiTurn(u) {
    const c = u.ch, D = derive(c), foes = this.enemiesOf(u), allies = this.party.filter(x => isChar(x) && !x.ch.dead);
    if (!foes.length) return [];
    const role = CLASSES[c.cls].role;
    const known = D.spell ? D.spell.known.filter(s => this.canCast(u, s)) : [];
    const weakest = foes.slice().sort((a, b) => hpOf(a) - hpOf(b))[0];
    const boss = foes.find(f => f.boss) || weakest;
    const hurt = allies.filter(a => hpOf(a) < maxHpOf(a) * 0.45).sort((a, b) => hpOf(a) / maxHpOf(a) - hpOf(b) / maxHpOf(b));
    const abil = this.abilities(u);
    const useAbil = (id, t) => { const a = abil.find(x => x.id === id && x.ok); if (!a) return null; if (a.bonus) this.bonusUsed = true; return a.fn(t); };
    let pre = [];
    // bonus actions first
    if (!this.bonusUsed) {
      pre = useAbil('rage') || (hpOf(u) < maxHpOf(u) * 0.4 && useAbil('wind')) || (boss.boss && useAbil('vow', boss)) || [];
      if (!pre.length && hurt.length && known.find(s => s.id === 'quickmend')) { this.bonusUsed = true; pre = this.castSpell(u, known.find(s => s.id === 'quickmend'), [hurt[0]]); }
    }
    if (boss.boss && c.res.surge > 0 && !this.extraAction) { const s = useAbil('surge'); if (s) pre = pre.concat(s); }
    // revive the fallen
    const fallen = allies.find(a => a.ch.hp <= 0 && !a.ch.dead);
    const healSpells = known.filter(s => s.eff === 'heal').sort((a, b) => b.lvl - a.lvl);
    if (fallen && healSpells.length) return pre.concat(this.castSpell(u, healSpells[healSpells.length - 1], [fallen]));
    const reviveSp = known.find(s => s.eff === 'revive'); const dead = allies.find(a => a.ch.dead);
    if (dead && reviveSp) return pre.concat(this.castSpell(u, reviveSp, [dead]));
    // heal
    if (hurt.length && healSpells.length && (role === 'healer' || hurt[0] === u)) {
      const mass = healSpells.find(s => s.t === 'allies');
      if (hurt.length >= 2 && mass) return pre.concat(this.castSpell(u, mass, allies.filter(a => a.ch.hp > -1)));
      return pre.concat(this.castSpell(u, healSpells.find(s => s.t === 'ally') || healSpells[0], [hurt[0]]));
    }
    if (hurt.length && abil.find(a => a.id === 'layhands' && a.ok)) return pre.concat(useAbil('layhands', hurt[0]));
    // buffs & control on bosses
    const buff = known.find(s => s.id === 'bless' || s.id === 'host' || s.id === 'quicken');
    if (buff && !u.conc && boss.boss) return pre.concat(this.castSpell(u, buff, buff.t === 'allies' ? allies.filter(alive) : buff.t === 'ally' ? [allies.find(a => CLASSES[a.ch.cls].role !== 'healer') || u] : [u]));
    // damage spells
    const dmg = known.filter(s => s.eff === 'dmg').sort((a, b) => b.lvl - a.lvl);
    const aoe = dmg.find(s => s.t === 'enemies' && s.lvl > 0);
    if (foes.length >= 2 && aoe) return pre.concat(this.castSpell(u, aoe, foes));
    const big = dmg.find(s => s.t === 'enemy' && s.lvl > 0 && (boss.boss || s.lvl <= 2));
    const isCaster = ['arcanist', 'wildblood', 'pactbound'].includes(c.cls) || (['chaplain', 'cantor', 'verdant'].includes(c.cls) && !c.eq.weapon);
    if (big && (boss.boss || R() < 0.5) && (isCaster || role === 'healer')) return pre.concat(this.castSpell(u, big, [boss]));
    const cantrip = dmg.find(s => s.lvl === 0);
    if (isCaster && cantrip) return pre.concat(this.castSpell(u, cantrip, [weakest]));
    if (abil.find(a => a.id === 'breath' && a.ok) && foes.length >= 2) return pre.concat(useAbil('breath'));
    if (abil.find(a => a.id === 'wild' && a.ok) && !hasEff(u, 'wildshape') && boss.boss) return pre.concat(useAbil('wild'));
    if (abil.find(a => a.id === 'smite' && a.ok) && boss.boss) return pre.concat(useAbil('smite', boss));
    if (!this.bonusUsed && abil.find(a => a.id === 'flurry' && a.ok) && R() < 0.5) { this.bonusUsed = true; pre = pre.concat(useAbil('flurry', weakest)); }
    return pre.concat(this.weaponAttack(u, role === 'tank' ? boss : weakest));
  }
  pickTarget(m) {
    const pool = this.enemiesOf(m);
    if (!pool.length) return null;
    if (R() < 0.2) return pick(pool);
    return pool.slice().sort((a, b) => (m.threat[b.id] || 0) - (m.threat[a.id] || 0))[0];
  }
  monsterTurn(m) {
    m.turn++;
    const steps = [];
    if (hasEff(m, 'charmed')) return [this.say(`${m.name} is charmed and does nothing.`)];
    if (hasEff(m, 'beast')) return [this.say(`${m.name} hops about as a newt.`)];
    const dominated = hasEff(m, 'dominated');
    // boss mechanics
    if (m.boss && m.mechs) {
      const pct = m.hp / m.maxhp;
      if (m.mechs.includes('enrage') && pct < 0.3 && !m.enraged) { m.enraged = true; steps.push(this.say(`${m.name} becomes ENRAGED!`, () => { SFX.roar(); shake = 10; m.attacks.forEach(a => a.dice = dmgDice(diceAvg(a.dice) * 1.5)); })); }
      if (m.mechs.includes('phase') && pct < 0.5 && !m.phased) { m.phased = true; steps.push(this.say(`${m.name} enters a new phase!`, () => { m.legendary = (m.legendary || 0) + 1; m.ac += 1; SFX.boss_appear(); })); }
      if (m.mechs.includes('shield') && (pct < 0.75 && !m.sh1 || pct < 0.4 && !m.sh2)) { if (pct < 0.4) m.sh2 = true; else m.sh1 = true; steps.push(this.say(`${m.name} raises a barrier!`, () => { addEffect(m, { id: 'barrier', rounds: 3, pool: Math.round(m.maxhp * 0.12) }); SFX.aegis_cast(); })); }
      if (m.mechs.includes('frenzy')) addEffect(m, { id: 'frenzy', rounds: 99 });
      if (m.mechs.includes('curse') && m.turn % 4 === 2) { const t = this.pickTarget(m); if (t) steps.push({ text: '', dyn: () => { const sv = this.save(t, 'WIS', m.dc, { cond: true }); return sv.ok ? { text: `${t.name} resists the curse.` } : { text: `${m.name} curses ${t.name}: DOOMED!`, act: () => { addEffect(t, { id: 'doomed', rounds: 3 }); SFX.grave_cast(); } }; } }); }
    }
    if (m.summon && !m.summoned && m.hp < m.maxhp * 0.5 && this.foes.length < 6) {
      m.summoned = true;
      steps.push(this.say(`${m.name} calls for aid!`, () => {
        const src = MONSTERS[m.summon] ? m.summon : (BEAST_BY_ID[m.summon] || BESTIARY[0]);
        for (let i = 0; i < 2; i++) { const a = foeMember(makeMonster(src, Math.max(1, m.lvl - 3), 2)); this.foes.push(a); this.all.push(a); a.initRoll = d20() + a.init; this.order.push(a); }
        SFX.howl();
      }));
    }
    // AoE mechanic
    if (m.boss && m.mechs && m.mechs.includes('aoe') && m.turn % 3 === 0) {
      steps.push(this.say(`${m.name} unleashes a sweeping assault!`, () => { SFX.storm_hit(); shake = 10; }));
      for (const t of this.enemiesOf(m)) steps.push({ text: '', dyn: () => { const sv = this.save(t, 'DEX', m.dc); const evade = isChar(t) && hasFeature(t.ch, 'evasion'); let d = roll(m.attacks[0].dice).total; d = sv.ok ? (evade ? 0 : Math.floor(d / 2)) : (evade ? Math.floor(d / 2) : d); return { text: `${t.name} DEX ${sv.total} vs DC${m.dc}\n${sv.ok ? 'Half' : 'Full'}: ${d} damage`, act: () => this.applyDamage(m, t, d, m.attacks[0].type) }; } });
      return steps;
    }
    // recharge abilities
    const rech = m.attacks.find(a => a.eff && a.eff.recharge && m.recharge[a.name]);
    if (rech) {
      m.recharge[rech.name] = false;
      steps.push(this.say(`${m.name} uses ${rech.name}!`, () => { SFX.roar(); shake = 8; }));
      const targets = rech.eff.aoe ? this.enemiesOf(m) : [this.pickTarget(m)];
      for (const t of targets) steps.push({ text: '', dyn: () => {
        const sv = this.save(t, rech.eff.save, rech.eff.dc || m.dc); let d = roll(rech.dice).total; if (sv.ok) d = Math.floor(d / 2);
        return { text: `${t.name} ${rech.eff.save} ${sv.total} vs DC${rech.eff.dc || m.dc}\n${sv.ok ? 'Half damage' : 'Hit'}: ${d} ${rech.type}`, act: () => { this.applyDamage(m, t, d, rech.type); if (!sv.ok && rech.eff.cond && alive(t)) addEffect(t, { id: rech.eff.cond, rounds: 1 }); } };
      } });
      return steps;
    }
    // spells
    if (m.spells.length && !condFlag(m, 'noSpells') && m.turn % 3 === 1) {
      const sp = SPELLS.find(s => s.id === pick(m.spells));
      if (sp) { const tg = sp.t === 'enemies' ? this.enemiesOf(m) : [this.pickTarget(m)].filter(Boolean); if (tg.length) return steps.concat(this.castSpell(m, sp, tg)); }
    }
    // multiattack
    const atks = m.attacks.filter(a => !(a.eff && a.eff.recharge));
    const n = m.multi + (effOf(m, 'haste') ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = atks[i % atks.length];
      steps.push({ text: '', dyn: () => {
        const t = dominated ? pick(this.foes.filter(f => f !== m && alive(f)) || [m]) : this.pickTarget(m);
        if (!t) return null;
        return this.monsterAttack(m, t, a);
      } });
    }
    if (hasEff(m, 'mace')) { /* summoned by a player only */ }
    return steps;
  }
  monsterAttack(m, t, a) {
    const adv = this.advState(m, t);
    const r = this.d20adv(adv), total = r + a.hit + (effOf(m, 'bless') ? 2 : 0) - (hasEff(m, 'doomed') ? 2 : 0), ac = acOf(t);
    const crit = r === 20 || condFlag(t, 'autoCrit');
    // mirror images
    const mir = effOf(t, 'mirror');
    if (mir && mir.stacks > 0 && R() < mir.stacks / (mir.stacks + 1)) return { text: `${m.name}: ${a.name}\nIt strikes an illusion!`, act: () => { mir.stacks--; if (mir.stacks <= 0) removeEffect(t, 'mirror'); SFX.veil_hit(); } };
    if (!(crit || (r !== 1 && total >= ac))) return { text: `${m.name}: ${a.name}\nd20 ${r}+${a.hit}=${total} vs AC${ac}\nMiss!`, act: () => { this.anim.lunge = m.id; SFX.miss(); } };
    if (isChar(t) && R() * 100 < derive(t.ch).dodge) return { text: `${m.name}: ${a.name}\n${t.name} DODGES!`, act: () => SFX.dodge() };
    let d = roll(a.dice, crit).total; if (hasEff(m, 'rage')) d += 2;
    if (hasEff(t, 'ac') && effOf(t, 'ac').val >= 5) { /* ward of force already in AC */ }
    if (effOf(m, 'weakened')) d = Math.round(d * 0.75);
    return { text: `${m.name}: ${a.name}\nd20 ${r}+${a.hit}=${total} vs AC${ac}\n${crit ? 'CRITICAL! ' : ''}${d} ${a.type}`, act: () => {
      this.anim.lunge = m.id; if (crit) shake = 8;
      const dealt = this.applyDamage(m, t, d, a.type, { attack: true, crit, ranged: m.ranged });
      if (a.eff && alive(t)) {
        if (a.eff.buff) { const sv = this.save(t, a.eff.save || 'CON', m.dc, { cond: true, poison: true }); if (!sv.ok) { addEffect(t, { id: a.eff.buff, rounds: 3, lvl: m.lvl }); SFX.poison(); } }
        if (a.eff.cond && !a.eff.aoe) { const sv = this.save(t, a.eff.save, a.eff.dc || m.dc, { cond: true, poison: a.eff.cond === 'poisoned' }); if (!sv.ok) { addEffect(t, { id: a.eff.cond, rounds: a.eff.dur || 2, saveEnd: { abil: a.eff.save, dc: a.eff.dc || m.dc } }); SFX[a.eff.cond === 'poisoned' ? 'poison' : 'stun'](); } }
        if (a.eff.drain && dealt) m.hp = Math.min(m.maxhp, m.hp + dealt);
        if (a.eff.extra) this.applyDamage(m, t, roll(a.eff.extra).total, a.eff.etype);
      }
    } };
  }
  legendaryAction(b) {
    const t = this.pickTarget(b); if (!t) return [];
    if (R() < 0.35) return [this.say(`LEGENDARY: ${b.name} sweeps its wings!`, () => SFX.roar())].concat(this.enemiesOf(b).map(x => ({ text: '', dyn: () => { const sv = this.save(x, 'DEX', b.dc); const d = Math.floor(roll(dmgDice(diceAvg(b.attacks[0].dice) * 0.5)).total / (sv.ok ? 2 : 1)); return { text: `${x.name}: ${d} damage`, act: () => this.applyDamage(b, x, d, 'bludgeoning') }; } })));
    return [this.say(`LEGENDARY ACTION: ${b.name}!`), { text: '', dyn: () => this.monsterAttack(b, t, b.attacks[0]) }];
  }
  // ------------------------------------------------------------------ player menu
  tryFlee() {
    const u = this.actor, D = derive(u.ch);
    if (this.noFlee) return [this.say("You can't escape this fight!", () => SFX.error())];
    const sv = hasFeature(u.ch, 'cunning') ? 99 : d20() + D.M.DEX + D.M.SPD;
    const dc = 10 + Math.max(...this.foes.filter(alive).map(f => Math.floor(f.lvl / 3)));
    if (sv >= dc) return [this.say(`You escape! (${sv === 99 ? 'CUNNING' : sv} vs DC${dc})`, () => { SFX.flee(); this.fled = true; })];
    return [this.say(`Couldn't escape! (${sv} vs DC${dc})`)];
  }
  useItem(u, k, t) {
    const it = ITEMS[k]; takeItem(k); const steps = [];
    if (it.type === 'scroll') return this.castSpell(u, SPELLS.find(s => s.id === it.spell), it.spell === 'flamefan' ? this.enemiesOf(u) : [t || u]).slice(0);
    steps.push(this.say(`${u.name} uses ${it.name}.`, () => SFX.drink()));
    if (it.heal) { const h = roll(it.heal).total * (1 + Math.max(0, u.ch.lvl - 10) / 10); steps.push(this.say(`${(t || u).name} heals ${Math.round(h)} HP.`, () => this.heal(t || u, Math.round(h)))); }
    if (it.cure) steps.push(this.say('Poisons are purged.', () => (t || u).effects = (t || u).effects.filter(e => !['poisoned', 'venom'].includes(e.id))));
    if (it.slot && u.ch.res.slots) steps.push(this.say('A spell slot returns.', () => { const mx = resMax(u.ch).slots; for (let i = 0; i < mx.length; i++) if (u.ch.res.slots[i] < mx[i]) { u.ch.res.slots[i]++; break; } }));
    if (it.buff) steps.push(this.say(`${BUFFS[it.buff].name}!`, () => addEffect(u, { id: it.buff, rounds: 99 })));
    return steps;
  }
  doPlayerSteps(steps, isBonus) {
    if (isBonus) this.bonusUsed = true;
    this.run(steps, () => {
      if (this.checkEnd()) return;
      if (this.fled) return this.finish('flee');
      if (this.combatMode === 'realtime') { this.actor = this.rt.player; this.bonusUsed = false; this.state = 'realtime'; return; }
      if (isBonus && alive(this.actor)) { this.state = 'menu'; return; }
      if (this.quickenedCast) { this.quickenedCast = false; this.state = 'menu'; return; }
      this.after();
    });
  }
  update() {
    // expand dynamic steps
    if (this.state === 'msg' && this.cur && this.cur.dyn) {
      const res = this.cur.dyn(); this.cur.dyn = null;
      if (!res) { this.nextStep(); return; }
      this.cur.text = res.text; this.cur.act = res.act; res.act && res.act();
    }
    for (const k in this.anim.flash) if (--this.anim.flash[k] <= 0) delete this.anim.flash[k];
    if (this.anim.fx && --this.anim.fx.t <= 0) this.anim.fx = null;
    if (P('select') && this.actor && this.actor.ch === G) { S.autoBattle = !S.autoBattle; saveSettings(); SFX.toggle(); if (this.state === 'menu' && S.autoBattle) this.beginAction(this.actor); }
    if (this.state === 'msg') {
      const L = this.cur.text || '';
      if (!L) { this.nextStep(); return; }
      if (this.c < L.length) { this.c += [1, 2, 4, 99][S.textSpeed]; if (P('a')) this.c = L.length; return; }
      if (this.hold > 0) { this.hold--; return; }
      this.auto++;
      const fast = this.combatMode === 'realtime' || S.autoBattle || (this.actor && this.actor.side === 'party' && this.actor.ch !== G) || this.party.length > 4;
      if (P('a') || P('b') || this.auto > (fast ? 22 : 70)) this.nextStep();
      return;
    }
    if (this.state === 'remote') { if (--this.remoteWait <= 0) { this.actor.ctrl = 'ai'; this.beginAction(this.actor); } return; }
    if (this.state === 'realtime') return this.updateRealtime();
    if (this.state === 'menu') return this.updateMenu();
    if (this.state === 'list') return this.updateList();
    if (this.state === 'target') return this.updateTarget();
    if (this.state === 'over' && (P('a') || P('b'))) { /* handled by finish flow */ }
  }
  updateMenu() {
    const opts = this.menuOpts();
    if (nav('up')) { this.menu = (this.menu + 4) % 6; SFX.cursor(); }
    if (nav('down')) { this.menu = (this.menu + 2) % 6; SFX.cursor(); }
    if (nav('left') || nav('right')) { this.menu ^= 1; SFX.cursor(); }
    if (P('a')) {
      const o = opts[this.menu]; SFX.select();
      if (o === 'ATTACK') this.askTarget('enemy', t => this.doPlayerSteps(this.weaponAttack(this.actor, t), false));
      else if (o === 'SPELL') this.openList('spell');
      else if (o === 'ABILITY') this.openList('ability');
      else if (o === 'ITEM') this.openList('item');
      else if (o === 'DODGE') this.doPlayerSteps([this.say(`${this.actor.name} dodges.`, () => addEffect(this.actor, { id: 'dodging', rounds: 1 }))], false);
      else if (o === 'FLEE') this.doPlayerSteps(this.tryFlee(), false);
      else if (o === 'END') this.after();
    }
  }
  menuOpts() { return ['ATTACK', 'SPELL', 'ABILITY', 'ITEM', this.bonusUsed && this.state === 'menu' && this.endable ? 'END' : 'DODGE', this.bonusUsed ? 'END' : 'FLEE']; }
  openList(kind) {
    const u = this.actor, D = derive(u.ch);
    if (kind === 'spell') this.list = (D.spell ? D.spell.known : []).map(s => ({ name: s.name, sub: s.lvl ? `L${s.lvl}` : 'C', ok: this.canCast(u, s) && (!s.bonus || !this.bonusUsed), sp: s }));
    else if (kind === 'ability') this.list = this.abilities(u).map(a => ({ name: a.name, sub: a.cost, ok: a.ok, ab: a }));
    else this.list = Object.keys(G.inv).filter(k => ITEMS[k] && ITEMS[k].combat && G.inv[k] > 0).map(k => ({ name: ITEMS[k].name, sub: 'x' + G.inv[k], ok: true, item: k }));
    if (!this.list.length) { SFX.error(); return; }
    this.listKind = kind; this.sub = 0; this.subTop = 0; this.state = 'list';
  }
  hotbarEntries(u) {
    if (!u || !isChar(u) || u.ch !== G) return [];
    const D = derive(u.ch);
    const spells = (D.spell ? D.spell.known : []).map(sp => ({ id: sp.id, name: sp.name, sub: sp.lvl ? `L${sp.lvl}` : 'C', ok: this.canCast(u, sp) && (!sp.bonus || !this.bonusUsed), sp }));
    const abilities = this.abilities(u).map(ab => ({ id: ab.id, name: ab.name, sub: ab.cost, ok: ab.ok, ab }));
    return [{ id: 'basic_attack', name: 'ATTACK', sub: 'GCD', ok: true, basic: true }].concat(abilities, spells).slice(0, 10);
  }
  useHotbar(index) {
    if (!['menu', 'list', 'realtime'].includes(this.state) || this.actor?.ch !== G) return;
    if (this.combatMode === 'realtime' && (this.rt?.paused || this.rt?.gcd > 0 || this.rt?.cooldowns[this.hotbarEntries(this.actor)[index]?.id] > 0)) { SFX.error(); return; }
    const entry = this.hotbarEntries(this.actor)[index];
    if (!entry) { SFX.error(); return; }
    if (!entry.ok) { SFX.error(); return; }
    SFX.select();
    if (this.combatMode === 'realtime') {
      this.rt.gcd = 90;
      if (entry.ab && entry.id !== 'dodge') this.rt.cooldowns[entry.id] = entry.id.startsWith('skill_') ? 240 : entry.ab.bonus ? 120 : 180;
    }
    if (entry.basic) { this.askTarget('enemy', t => this.doPlayerSteps(this.weaponAttack(this.actor, t), false)); return; }
    this.useListEntry(entry);
  }
  useListEntry(e) {
    const u = this.actor;
    if (e.sp) {
      const sp = e.sp, go = targets => { if (this.quicken && !sp.bonus) { this.quicken = false; this.quickenedCast = true; } this.doPlayerSteps(this.castSpell(u, sp, targets), !!sp.bonus); };
      if (sp.t === 'enemies') go(this.enemiesOf(u));
      else if (sp.t === 'allies') go(this.party.filter(x => isChar(x) && !x.ch.dead));
      else if (sp.t === 'self') go([u]);
      else if (sp.eff === 'revive') this.askTarget('dead', t => go([t]));
      else this.askTarget(sp.t === 'ally' ? 'ally' : 'enemy', t => go([t]));
    } else if (e.ab) {
      const a = e.ab;
      if (a.target) this.askTarget(a.target, t => this.doPlayerSteps(a.fn(t), a.bonus)); else this.doPlayerSteps(a.fn(), a.bonus);
    }
  }
  updateList() {
    const n = this.list.length;
    if (nav('up')) { this.sub = (this.sub + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.sub = (this.sub + 1) % n; SFX.cursor(); }
    if (this.sub < this.subTop) this.subTop = this.sub; if (this.sub > this.subTop + 2) this.subTop = this.sub - 2;
    if (P('b')) { this.state = 'menu'; SFX.back(); return; }
    if (!P('a')) return;
    const e = this.list[this.sub], u = this.actor;
    if (!e.ok) { SFX.error(); return; }
    SFX.select();
    if (e.sp || e.ab) this.useListEntry(e);
    else if (e.item) {
      const it = ITEMS[e.item], b = !!subKey(u.ch, 'fasthands');
      if (it.heal || it.cure) this.askTarget('ally', t => this.doPlayerSteps(this.useItem(u, e.item, t), b));
      else this.doPlayerSteps(this.useItem(u, e.item, null), b);
    }
  }
  askTarget(kind, cb) {
    const u = this.actor;
    this.targets = kind === 'enemy' ? this.enemiesOf(u) : kind === 'dead' ? this.party.filter(x => isChar(x) && x.ch.dead) : this.party.filter(x => isChar(x) && !x.ch.dead);
    if (!this.targets.length) { SFX.error(); return; }
    if (this.targets.length === 1) return cb(this.targets[0]);
    this.ti = 0; this.targetCb = cb; this.prevState = this.state; this.state = 'target';
  }
  updateTarget() {
    const n = this.targets.length;
    if (nav('up') || nav('left')) { this.ti = (this.ti + n - 1) % n; SFX.cursor(); }
    if (nav('down') || nav('right')) { this.ti = (this.ti + 1) % n; SFX.cursor(); }
    if (P('b')) { this.state = this.prevState === 'list' ? 'list' : this.prevState === 'realtime' ? 'realtime' : 'menu'; SFX.back(); return; }
    if (P('a')) { SFX.select(); const cb = this.targetCb; this.state = 'idle'; cb(this.targets[this.ti]); }
  }
  // remote player action (multiplayer): {kind, id, target}
  remoteAction(peerAct) {
    if (this.state !== 'remote') return;
    const u = this.actor, find = id => this.all.find(x => x.id === id);
    let steps = [];
    if (peerAct.kind === 'attack') steps = this.weaponAttack(u, find(peerAct.target) || this.enemiesOf(u)[0]);
    else if (peerAct.kind === 'spell') { const sp = SPELLS.find(s => s.id === peerAct.id); if (sp && this.canCast(u, sp)) steps = this.castSpell(u, sp, sp.t === 'enemies' ? this.enemiesOf(u) : sp.t === 'allies' ? this.party.filter(alive) : [find(peerAct.target) || u]); }
    if (!steps.length) steps = this.aiTurn(u);
    this.run(steps, () => this.after());
  }
  // ------------------------------------------------------------------ end of battle
  win() {
    if (this.state === 'over') return;
    this.state = 'over';
    const player = this.party.find(u => u.ch === G);
    const D = derive(G);
    const xp = this.noRewards ? 0 : this.foes.reduce((a, f) => a + (f.xp || 0), 0);
    const lootMul = (DIFFICULTY[this.diff - 1] || DIFFICULTY[1]).loot;
    const drops = [], mats = {}, cons = []; let gold = 0;
    if (!this.noRewards) {
      for (const f of this.foes) {
        const d = rollDrops(f, { loot: lootMul }); drops.push(...d.items); gold += d.gold; cons.push(...d.cons);
        for (const k in d.mats) mats[k] = (mats[k] || 0) + d.mats[k];
      }
    }
    const steps = [this.say(this.foes.length > 1 ? 'Victory!' : `${this.foes[0].name} is defeated!`, () => { Music.play('victory'); SFX.quest_done(); }, 20)];
    if (!this.noRewards) steps.push(this.say(`Got ${fmt(xp)} XP and ${fmt(gold)} G.`, () => { G.gold += gold; G.stats.goldEarned += gold; SFX.coin(); }));
    for (const it of drops) steps.push(this.say(`${it.named ? 'NAMED' : 'Loot'}: [${RARITY[it.rarity].name}]\n${it.name}`, () => { addGear(it); SFX[it.rarity >= 5 ? 'achievement' : 'pickup'](); if (it.rarity >= 5) G.stats.legendaries++; if (it.named) { G.named = G.named || {}; G.named[it.named] = (G.named[it.named] || 0) + 1; } }));
    const got = Object.entries(mats).map(([k, n]) => `${n} ${ITEMS[k].name}`).concat(cons.map(k => ITEMS[k].name));
    if (got.length) steps.push(this.say(('Found: ' + got.join(', ')).slice(0, 70), () => { for (const k in mats) addItem(k, mats[k]); cons.forEach(k => addItem(k)); SFX.coin(); }));
    this.run(steps, () => {
      // revive the fallen at 1 HP
      for (const u of this.party) if (isChar(u) && u.ch.hp <= 0) { u.ch.hp = 1; delete u.ch.dying; delete u.ch.stable; delete u.ch.dead; }
      for (const u of this.party) if (isChar(u)) { u.ch.buffs = (u.ch.buffs || []).map(b => Object.assign(b, { fights: (b.fights || 5) - 1 })).filter(b => b.fights > 0); }
      const res = this.noRewards ? { ups: [] } : gainXP(G, xp);
      if (!this.noRewards) for (const u of this.party) if (isChar(u) && u.ch !== G && u.ch.ai) { if (u.ch.lvl < G.lvl) { u.ch.lvl = G.lvl; u.ch.xp = xpForLevel(G.lvl); const DD = derive(u.ch); u.ch.hp = DD.hpMax; u.ch.res = resMax(u.ch, DD); } }
      if (!this.noRewards) recordVictory(this);
      this.finish('win', res.ups);
    });
  }
  lose() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.run([this.say('Your party has fallen...', () => { Music.play('defeat'); SFX.death(); }, 40)], () => this.finish('lose'));
  }
  finish(result, ups = []) {
    this.state = 'over';
    if (combatHotkeyHandler) combatHotkeyHandler = null;
    const chain = () => { const g = ups.shift(); if (g) push(new LevelUpScene(g, chain)); else done(); };
    const done = () => fadeTo(() => { removeScene(this); Physics.clear(); this.onEnd && this.onEnd(result, this); const t = topScene(); t && t.resume && t.resume(); });
    chain();
  }
  // ------------------------------------------------------------------ drawing
  posOf(u) {
    const pi = this.party.indexOf(u), fi = this.foes.indexOf(u);
    if (pi >= 0) { const shown = Math.min(3, this.party.length), k = pi % 3; return [14 + k * 16, 90 - (shown - 1 - k) * 0 - k * 8 - 14]; }
    if (fi >= 0) { const n = Math.min(4, this.foes.length), k = fi % 4; return n === 1 ? [118, 66] : [100 + (k % 2) * 34, 46 + Math.floor(k / 2) * 20 + (k % 2) * 2]; }
    return [80, 60];
  }
  draw() {
    fill(0, 0, W, H, 0);
    const bgn = battleBackdrop(this.kind);
    if (bgn && IMG[bgn]) { const im = IMG[bgn], sh = Math.round(im.width * 56 / 160); const bs = spr(bgn, im.width, im.height); ctx.drawImage(bs, 0, Math.max(0, Math.round(im.height * 0.45 - sh / 2)), im.width, sh, 0, 38, W, 56); }
    // backdrop floor
    fill(0, 93, W, 1, 2); for (let x = 0; x < W; x += 8) fill(x + ((frameN >> 4) % 8), 92, 3, 1, 1);
    // party panel
    const big = this.party.length > 4;
    this.party.forEach((u, i) => {
      if (big) { const cx = (i % 2) * 40, cy = 1 + Math.floor(i / 2) * 6; text(u.name.slice(0, 2), cx + 1, cy - 2, this.actor === u ? 2 : 3); bar(cx + 14, cy, 24, 4, Math.max(0, hpOf(u)), maxHpOf(u), hpOf(u) < maxHpOf(u) * 0.3 ? 'red' : 'hp'); return; }
      const y = 1 + i * 9; const act = this.actor === u;
      if (act) fill(0, y - 1, 79, 9, 1);
      text(u.name.slice(0, 6), 2, y, isChar(u) && u.ch.hp <= 0 ? 1 : 3);
      bar(40, y + 1, 36, 4, Math.max(0, hpOf(u)), maxHpOf(u), hpOf(u) < maxHpOf(u) * 0.3 ? 'red' : 'hp');
      if (u.temp) fill(40, y + 5, Math.min(36, u.temp), 1, 'blue');
      const flags = u.effects.filter(e => !BUFFS[e.id] || !BUFFS[e.id].good).length; if (flags) fill(77, y + 1, 2, 4, 'purple');
    });
    // foe panel
    this.foes.slice(0, 4).forEach((f, i) => {
      const y = 1 + i * 9; const tgt = this.state === 'target' && this.targets[this.ti] === f;
      if (tgt && (frameN >> 3) % 2) fill(81, y - 1, 79, 9, 1);
      textR(f.name.slice(0, 7), 120, y, f.hp <= 0 ? 1 : f.boss ? 'red' : 3);
      bar(122, y + 1, 36, 4, Math.max(0, f.hp), f.maxhp, f.boss ? 'red' : 2);
    });
    if (this.foes.length > 4) textR(`+${this.foes.length - 4}`, 158, 37, 2);
    // sprites
    const shownP = this.party.filter(u => isChar(u)).slice(0, 3);
    shownP.forEach((u, k) => {
      const c = u.ch, look = `c_${c.cls}_4`, por = heroPortrait(c);
      let s = por ? sprH(por, 34) : IMG[look] ? sprH(look, 30) : sprH('hero_4', 30);
      if (hasEff(u, 'wildshape')) s = sprH('enemy_goblinking', 30);
      const [px, py] = this.posOf(u);
      if (this.anim.flash[u.id] && (this.anim.flash[u.id] >> 1) % 2) return;
      const lx = this.anim.lunge === u.id ? 4 : 0;
      if (c.hp <= 0) { blit(spr(look in IMG ? look : 'hero_4', 30, 14, { ghost: true }), px - 15, 78); return; }
      blit(s, px - s.width / 2 + lx, py - s.height + 14);
      if (hasEff(u, 'invisible') || hasEff(u, 'hidden')) { ctx.globalAlpha = 0.4; fill(px - 8, py - 16, 16, 30, 0); ctx.globalAlpha = 1; }
    });
    this.foes.slice(0, 4).forEach(f => {
      if (f.hp <= 0 && !(this.anim.flash[f.id] && (this.anim.flash[f.id] >> 1) % 2)) return;
      const n = Math.min(4, this.foes.length), base = IMG[f.spr] ? f.spr : 'enemy_goblin';
      const hh = Math.min(n === 1 ? 52 : 30, Math.round(IMG[base].height * (f.scale || 1) * (n === 1 ? 1 : 0.75)));
      const s = sprH(base, hh, { flip: true }); const [px, py] = this.posOf(f);
      if (this.anim.flash[f.id] && f.hp > 0 && (this.anim.flash[f.id] >> 1) % 2) return;
      const lx = this.anim.lunge === f.id ? -4 : 0;
      blit(s, px - s.width / 2 + lx, py + 24 - s.height);
      if (this.state === 'target' && this.targets[this.ti] === f && (frameN >> 3) % 2) text('v', px - 3, py + 22 - s.height - 10, 2);
    });
    if (this.state === 'target' && this.targets[this.ti] && this.targets[this.ti].side === 'party' && (frameN >> 3) % 2) { const [px, py] = this.posOf(this.targets[this.ti]); text('v', px - 3, py - 26, 2); }
    if (this.anim.fx) { const f = sprFit(this.anim.fx.name, 28); for (const id of this.anim.fx.on) { const u = this.all.find(x => x.id === id); if (u && (this.anim.fx.t >> 1) % 3) { const [px, py] = this.posOf(u); blit(f, px - 14, py - 20); } } }
    FX.draw();
    if (['menu', 'list', 'target', 'realtime'].includes(this.state) && this.actor?.ch === G) {
      const slots = this.hotbarEntries(this.actor);
      for (let i = 0; i < 10; i++) {
        const x = 2 + i * 15.6, e = slots[i];
        frame(x, 81, 14, 12, this.combatMode === 'realtime' && this.state === 'realtime' && i === (this.rt?.slot || 0) ? 1 : 0);
        const ready = e?.ok && !(this.combatMode === 'realtime' && (this.rt?.gcd > 0 || this.rt?.cooldowns[e.id] > 0));
        text(i === 9 ? '0' : String(i + 1), x + 1, 82, ready ? 2 : 1);
        if (e) text(e.name.replace(/[^A-Z0-9 ]/gi, '').slice(0, 2).toUpperCase(), x + 1, 88, ready ? 3 : 1);
      }
    }
    // message box
    frame(2, 95, 156, 47);
    if (this.state === 'msg' && this.cur) text((this.cur.text || '').slice(0, Math.floor(this.c)), 7, 99);
    else if (this.state === 'menu' || this.state === 'list' || this.state === 'target' || this.state === 'realtime') {
      const u = this.actor, c = u.ch, D = derive(c);
      text(`${u.name.slice(0, 8)} ${Math.max(0, c.hp)}/${D.hpMax}`, 7, 98, 2);
      text(resLine(c, D), 80, 98, 2);
      if (this.state === 'menu') {
        this.menuOpts().forEach((s, i) => { const x = 16 + (i % 2) * 72, y = 109 + (i >> 1) * 10; if (i === this.menu) { fill(x - 9, y - 1, 66, 10, 3); text(s, x, y, 0); text('>', x - 7, y, 0); } else text(s, x, y); });
        if (S.autoBattle) textR('AUTO', 154, 98, 'red');
      } else if (this.state === 'list') {
        this.list.slice(this.subTop, this.subTop + 3).forEach((e, j) => { const i = this.subTop + j, y = 108 + j * 10; if (i === this.sub) text('>', 6, y); text(e.name.slice(0, 16), 13, y, e.ok ? 3 : 1); textR(e.sub, 154, y, e.ok ? 2 : 1); });
        const e = this.list[this.sub]; const desc = e.sp ? `${SCHOOLS[e.sp.school].name}: ${e.sp.desc}` : e.item ? ITEMS[e.item].desc : '';
        text(desc.slice(0, 24), 7, 132, 2);
      } else if (this.state === 'target') text('Choose a target.', 7, 112);
      else text(this.rt?.paused ? 'PAUSED  ENTER TO RESUME' : `REAL-TIME ACTIONS  GCD ${this.rt?.gcd ? (this.rt.gcd / 60).toFixed(1) : 'READY'}`, 7, 116, this.rt?.paused ? 'gold' : 2);
    } else if (this.state === 'remote') text(`Waiting for ${this.actor.name}...`, 7, 104);
  }
}
function resLine(c, D) {
  const r = c.res;
  if (r.pact != null) return `PACT ${r.pact}xL${D.spell.pact.lvl}`;
  if (r.slots && r.slots.length) return 'SL ' + r.slots.slice(0, 5).join('/');
  if (r.rage != null) return `RAGE ${r.rage}`;
  if (r.ki != null) return `KI ${r.ki}`;
  if (r.wind != null) return `WIND ${r.wind} SURGE ${r.surge || 0}`;
  return '';
}
