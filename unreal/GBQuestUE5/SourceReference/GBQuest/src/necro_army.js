'use strict';
// ================================================================ NECROMANCER: ARMY OF THE DEAD (up to 9)
// Inspired by the action-RPG "book of the dead": a necromancer fights with a standing army that rises at the start of
// every battle.
//   * ARMY SIZE: 2 at level 1, +1 every 4 levels, 9 at level 28: six SKELETAL WARRIORS, two SKELETAL MAGES and a GOLEM
//     (raised in that order: W W M W W M W W G). A necromancer support job raises up to 3.
//   * BOOK OF THE DEAD (MAIN MENU, necromancers only): pick a variant for each minion type, or SACRIFICE the type
//     for a permanent bonus instead:
//       warriors  SKIRMISHER (+30% damage, -20% HP) / DEFENDER (+40% HP, +2 AC) / REAPER (+60% damage)   sacrifice: +8% crit, +20% crit damage
//       mages     SHADOW (necrotic, fear) / COLD (cold bolts) / BONE (+40% damage, -20% HP)              sacrifice: +15% damage, +20% shadow damage
//       golem     BONE (x2.5 HP, draws attacks) / BLOOD (x2 HP, regenerates) / IRON (x3 HP, +3 AC)        sacrifice: +HP, +10% resist all
//   * RAISE DEAD (once per battle): every fallen minion rises again.
// The army shares the 12-member party limit, so companions keep their places. Pure rules are exported as GBQArmy.

const ARMY_ORDER = ['warrior', 'warrior', 'mage', 'warrior', 'warrior', 'mage', 'warrior', 'warrior', 'golem'];
const ARMY_MAX = 9;
const armySize = lvl => Math.min(ARMY_MAX, 2 + Math.floor(Math.max(1, lvl || 1) / 4));
const ARMY_VARIANTS = {
  warrior: { skirmisher: { name: 'SKIRMISHER', hp: 0.8, dmg: 1.3, ac: 0 }, defender: { name: 'DEFENDER', hp: 1.4, dmg: 1, ac: 2 }, reaper: { name: 'REAPER', hp: 1, dmg: 1.6, ac: 0 } },
  mage: { shadow: { name: 'SHADOW', hp: 1, dmg: 1, ac: 0, spells: ['gravechill', 'dread'] }, cold: { name: 'COLD', hp: 1, dmg: 1, ac: 0, spells: ['frostcone'] }, bone: { name: 'BONE', hp: 0.8, dmg: 1.4, ac: 0, spells: ['gravechill'] } },
  golem: { bone: { name: 'BONE', hp: 2.5, dmg: 1, ac: 1, taunt: true }, blood: { name: 'BLOOD', hp: 2, dmg: 1, ac: 0, regen: true }, iron: { name: 'IRON', hp: 3, dmg: 0.9, ac: 3 } },
};
const DEFAULT_BOOK = { warrior: 'skirmisher', mage: 'shadow', golem: 'bone' };
const SACRIFICE = { warrior: lvl => [['crit', 8], ['critdmg', 20]], mage: lvl => [['dmg', 15], ['necrotic', 20]], golem: lvl => [['hp', Math.min(200, 10 + lvl)], ['resist', 10]] };
const bookOf = c => Object.assign({}, DEFAULT_BOOK, (c && c.book) || {});
// the minions a hero raises: [{ kind, variant }], sacrificed types left out, capped by size
function armyFor(lvl, book, cap) {
  const b = Object.assign({}, DEFAULT_BOOK, book || {}), n = Math.min(armySize(lvl), cap == null ? ARMY_MAX : cap);
  return ARMY_ORDER.slice(0, n).filter(k => b[k] !== 'sacrifice').map(kind => ({ kind, variant: ARMY_VARIANTS[kind][b[kind]] ? b[kind] : DEFAULT_BOOK[kind] }));
}
const sacrificeBonus = (book, lvl) => Object.entries(Object.assign({}, DEFAULT_BOOK, book || {})).filter(([, v]) => v === 'sacrifice').flatMap(([k]) => SACRIFICE[k](lvl || 1));

if (typeof globalThis !== 'undefined') globalThis.GBQArmy = { ARMY_ORDER, ARMY_MAX, armySize, ARMY_VARIANTS, DEFAULT_BOOK, armyFor, sacrificeBonus };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined') {
  const BASE = { warrior: 'undead_skeleton_base', mage: 'undead_wraith_base', golem: 'undead_bonehulk_base' };
  const ART = { warrior: ['pk_mon_skeleton', 'pk_mon_skeleton_soldier'], mage: ['pk_mon_skelguard', 'pk_mon_necromancer'], golem: ['pk_mon_skelknight', 'pk_mon_mummy'] };
  const LABEL = { warrior: 'SKEL', mage: 'SMAG', golem: 'GOLM' };
  // who raises an army, and how big
  function armyOf(c) {
    if (!c) return [];
    if (c.cls === 'necromancer') return armyFor(c.lvl, c.book);
    const s = typeof supportJobOf === 'function' ? supportJobOf(c) : null;
    if (s && s.cls === 'necromancer') return armyFor(s.lvl, c.book, 3);
    return [];
  }
  window.armyOf = armyOf;
  // sacrificed types become the necromancer's own stats
  { const sb0 = armorSetBonus; armorSetBonus = function (c) { const out = sb0.apply(this, arguments); if (c && (c.cls === 'necromancer' || c.supJob === 'necromancer')) out.push(...sacrificeBonus(c.book, c.lvl)); return out; }; }

  function raise(b, owner, m0) {
    const c = owner.ch, V = ARMY_VARIANTS[m0.kind][m0.variant], base = BEAST_BY_ID[BASE[m0.kind]] || BESTIARY.find(x => x.fam === 'undead') || BESTIARY[0];
    const m = makeMonster(base, Math.max(1, c.lvl - 1), 2, { side: 'party', ally: owner.id });
    m.side = 'party'; m.id = 'p' + (CB_ID++); m.ctrl = 'ai'; m.effects = []; m.threat = {}; m.minion = m0.kind; m.owner = owner.id;
    m.maxhp = Math.max(1, Math.round(m.maxhp * V.hp * (m0.kind === 'warrior' ? 0.6 : 0.5))); m.hp = m.maxhp; m.ac += V.ac;
    m.attacks.forEach(a => { a.dice = dmgDice(diceAvg(a.dice) * V.dmg * 0.7); });
    if (V.spells) m.spells = V.spells.slice(); else if (m0.kind !== 'mage') m.spells = [];
    m.name = `${LABEL[m0.kind]} ${V.name}`.slice(0, 12); m.xp = 0; m.gold = 0;
    const art = ART[m0.kind].find(n => IMG[n]); if (art) m.spr = art;
    if (V.taunt) m.taunt = true;
    if (V.regen) addEffect(m, { id: 'regen', rounds: 99 });
    b.party.push(m); b.all.push(m);
    return m;
  }
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.apply(this, arguments);
      for (const u of this.party.slice()) if (isChar(u)) for (const m0 of armyOf(u.ch)) { if (this.party.length >= 12) break; raise(this, u, m0); }
      const n = this.party.filter(m => m.minion).length;
      if (n && typeof chatLog === 'function') chatLog('combat', 'ARMY', `The dead rise: ${n} minion${n === 1 ? '' : 's'} answer the call.`);
    }; }
  // golems draw the foes' attention
  { const pt0 = Battle.prototype.pickTarget; Battle.prototype.pickTarget = function (m) {
      if (m && m.side === 'foe') { const g = this.party.find(x => x.taunt && x.hp > 0); if (g && R() < 0.5) return g; }
      return pt0.apply(this, arguments);
    }; }
  // RAISE DEAD: once per battle, the fallen minions stand again
  { const a0 = Battle.prototype.abilities; Battle.prototype.abilities = function (u) {
      const list = a0.apply(this, arguments);
      try {
        if (!u || !u.ch || !armyOf(u.ch).length || !this.party) return list;
        const fallen = this.party.filter(m => m.minion && m.owner === u.id && m.hp <= 0), used = (this.raiseUsed || (this.raiseUsed = new Set())).has(u.id);
        list.splice(Math.max(0, list.length - 1), 0, { id: 'raise_dead', name: 'RAISE DEAD', cost: used ? 'USED' : `${fallen.length} DOWN`, ok: !used && fallen.length > 0, bonus: false, fn: () => {
          this.raiseUsed.add(u.id);
          return [this.say(`${u.ch.name} raises the fallen! ${fallen.length} minion${fallen.length === 1 ? '' : 's'} rise.`, () => { fallen.forEach(m => { m.hp = m.maxhp; m.effects = []; }); SFX.grave_cast ? SFX.grave_cast() : SFX.buff(); })];
        } });
      } catch (e) { console.warn('raise dead', e); }
      return list;
    }; }
  // the army stands in ranks between the heroes and the foes
  const rankPos = (b, m) => { const mine = b.party.filter(x => x.minion), k = mine.indexOf(m); return [53 + (k % 3) * 12 + Math.floor(k / 3) * 3, 58 + Math.floor(k / 3) * 12]; };
  { const p0 = Battle.prototype.posOf; Battle.prototype.posOf = function (u) { return u && u.minion ? rankPos(this, u) : p0.apply(this, arguments); }; }
  { const d0 = Battle.prototype.draw; Battle.prototype.draw = function () {
      d0.apply(this, arguments);
      try {
        for (const m of this.party.filter(x => x.minion)) {
          const [x, y] = rankPos(this, m), base = IMG[m.spr] ? m.spr : 'enemy_skeleton'; if (!IMG[base]) continue;
          if (m.hp <= 0) { ctx.globalAlpha = 0.3; }
          if (!(this.anim.flash[m.id] && (this.anim.flash[m.id] >> 1) % 2)) { const s = sprH(base, m.minion === 'golem' ? 18 : 14, { clean: S.battleBg !== 'painted' }); blit(s, x - (s.width >> 1) + (this.anim.lunge === m.id ? 3 : 0), y - s.height + 6); }
          ctx.globalAlpha = 1;
        }
      } catch (e) { /* drawing only */ }
    }; }

  // ---------------------------------------------------------------- BOOK OF THE DEAD
  const bookName = (k, v) => v === 'sacrifice' ? 'SACRIFICE' : ARMY_VARIANTS[k][v].name;
  function bookMenu() {
    const bk = bookOf(G), army = armyOf(G), kinds = ['warrior', 'mage', 'golem'];
    const rows = kinds.map(k => `${{ warrior: 'WARRIORS', mage: 'MAGES', golem: 'GOLEM' }[k]}: ${bookName(k, bk[k])}`);
    choose([...rows, 'BACK'], i => {
      if (i < 0 || i >= kinds.length) return;
      const k = kinds[i], opts = [...Object.keys(ARMY_VARIANTS[k]), 'sacrifice'];
      choose(opts.map(v => bookName(k, v)), j => {
        if (j >= 0) { G.book = Object.assign({}, bookOf(G), { [k]: opts[j] }); SFX.toggle(); saveGame(); }
        bookMenu();
      }, k === 'warrior' ? 'Warriors: SKIRMISHER hits harder, DEFENDER is tougher, REAPER hits hardest. SACRIFICE: +crit.' : k === 'mage' ? 'Mages: SHADOW curses and frightens, COLD casts frost, BONE hits harder. SACRIFICE: +damage.' : 'Golem: BONE draws attacks, BLOOD regenerates, IRON is armoured. SACRIFICE: +HP and resist.');
    }, `BOOK OF THE DEAD. ARMY ${army.length}/${ARMY_MAX} (LV${G.lvl}).`);
  }
  window.bookOfTheDeadMenu = bookMenu;
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments); if (G && (G.cls === 'necromancer' || G.supJob === 'necromancer')) L.splice(Math.max(0, L.indexOf('COMBAT ARTS') + 1), 0, 'BOOK OF DEAD'); return L; };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && this.items()[this.i] === 'BOOK OF DEAD') { SFX.select(); return bookMenu(); } return u0.apply(this, arguments); };
  }
}
