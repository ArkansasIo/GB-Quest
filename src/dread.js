'use strict';
(() => { // own scope: the game loads every module as a classic script sharing one global scope
// ================================================================ DREAD DUNGEONS (MAIN MENU > DREAD DUNGEONS)
// Endgame dungeon modes in the spirit of modern action-RPGs (all names original):
//   * DREAD SIGILS (level 10+): consumable sigils that turn a dungeon into a DREAD run of tier 1-100. Foes get
//     +7% HP and damage per tier, one BOON affix (more gold, XP, loot...) and 1-3 BANE affixes (foes start
//     MIGHTY, THORNSKIN, FORTIFIED, HASTED or the party starts WEAKENED). No timer; leaving or wiping burns the
//     sigil. A clear pays sigil powder, gear (item level grows with tier) and a new sigil of tier +1 to +3.
//     Sigils also drop from ordinary dungeon clears (50%). Craft a sigil from 10 powder; salvage one for 3.
//   * THE PIT (level 20+): a tiered timed climb, tier 1-150. Foes +10% HP and damage per tier. Clear the final
//     boss in time to unlock the next tiers (+1, +2 under 80% of the timer, +3 under 60%) and earn PIT SHARDS
//     and gear. Out of time pays a few shards; leaving or wiping pays nothing.
//   * SHARD EXCHANGE: trade pit shards for SCRAP, the material the OCCULTIST spends on MASTERWORK (d4_gear.js).
//   * ENDLESS HORDE (level 15+): back-to-back battles in your current zone, ten waves. Foes +12% per wave.
//     After each wave pick a BOON (a buff that opens every later battle) and bank AETHER, or cash out:
//     aether buys a chest of gear and gold. A wipe loses half the aether.
// Pure rules are exported as GBQDread for tests; the game wiring runs only inside the game.

const SIGIL_MIN_LVL = 10, PIT_MIN_LVL = 20, HORDE_MIN_LVL = 15;
const SIGIL_MAX = 100, PIT_MAX = 150, SIGIL_BAG = 12, HORDE_WAVES = 10, SCRAP_PER_SHARD = 4;
const SIGIL_BOONS = {
  gilded: { name: 'GILDED', desc: '+50% gold from the clear chest.', gold: 1.5 },
  learned: { name: 'LEARNED', desc: '+50% clear XP.', xp: 1.5 },
  bountiful: { name: 'BOUNTIFUL', desc: '+1 gear item in the clear chest.', items: 1 },
  attuned: { name: 'ATTUNED', desc: '+5 sigil powder.', powder: 5 },
};
const SIGIL_BANES = {
  brutal: { name: 'BRUTAL', desc: 'Foes start MIGHTY (+15% damage) for 3 rounds.', foe: 'might', rounds: 3 },
  thorned: { name: 'THORNED', desc: 'Foes have THORNSKIN all battle.', foe: 'thornskin', rounds: 99 },
  bulwark: { name: 'BULWARK', desc: 'Foes start FORTIFIED for 2 rounds.', foe: 'fortify', rounds: 2 },
  frenzied: { name: 'FRENZIED', desc: 'Foes start HASTED for 1 round.', foe: 'haste', rounds: 1 },
  sapping: { name: 'SAPPING', desc: 'Your party starts WEAKENED for 2 rounds.', party: 'weakened', rounds: 2 },
  hardened: { name: 'HARDENED', desc: 'Foes +15% HP.', hp: 1.15 },
};
const BOON_IDS = Object.keys(SIGIL_BOONS), BANE_IDS = Object.keys(SIGIL_BANES);
const clampT = (t, max) => Math.max(1, Math.min(max, Math.floor(Number(t) || 1)));
const r3 = v => Math.round(v * 1000) / 1000;
const sigilScale = tier => r3(Math.pow(1.07, clampT(tier, SIGIL_MAX) - 1));
const baneCount = tier => 1 + (tier >= 15 ? 1 : 0) + (tier >= 40 ? 1 : 0);
// a sigil of a tier for one of the given dungeon ids
function rollSigil(tier, dungeonIds, rnd) {
  tier = clampT(tier, SIGIL_MAX);
  const banes = BANE_IDS.slice(), neg = [];
  while (neg.length < baneCount(tier) && banes.length) neg.push(banes.splice(Math.floor(rnd() * banes.length) % banes.length, 1)[0]);
  return { tier, dungeon: dungeonIds[Math.floor(rnd() * dungeonIds.length) % dungeonIds.length], pos: BOON_IDS[Math.floor(rnd() * BOON_IDS.length) % BOON_IDS.length], neg };
}
// HP / damage multipliers for a foe in a sigil run
function sigilFoeMult(sig) { let hp = sigilScale(sig.tier), dmg = sigilScale(sig.tier); for (const id of sig.neg || []) { const b = SIGIL_BANES[id]; if (b && b.hp) hp *= b.hp; } return { hp: r3(hp), dmg: r3(dmg) }; }
function sigilRewards(sig, dungeonLvl, rnd) {
  const t = clampT(sig.tier, SIGIL_MAX), boon = SIGIL_BOONS[sig.pos] || {};
  return { powder: 3 + Math.floor(t / 5) + (boon.powder || 0), items: 1 + (t >= 20 ? 1 : 0) + (boon.items || 0), ilvl: Math.min(720, Math.max(1, Math.floor(dungeonLvl) + 3 * t)),
    rarity: t >= 50 ? 5 : t >= 15 ? 4 : 3, gold: Math.round((100 + 25 * t) * (boon.gold || 1)), xp: Math.round((250 + 60 * t) * (boon.xp || 1)), next: Math.min(SIGIL_MAX, t + 1 + Math.floor((rnd ? rnd() : 0.5) * 3)) };
}
const SIGIL_CRAFT = 10, SIGIL_SALVAGE = 3;

// ---------------------------------------------------------------- the pit
const pitScale = tier => r3(Math.pow(1.1, clampT(tier, PIT_MAX) - 1));
const pitLimit = rooms => 90 + 60 * Math.max(1, Math.floor(Number(rooms) || 1));
function pitResult(tier, elapsed, limit) {
  const timed = elapsed <= limit, up = !timed ? 0 : elapsed <= limit * 0.6 ? 3 : elapsed <= limit * 0.8 ? 2 : 1;
  return { timed, unlock: Math.min(PIT_MAX, clampT(tier, PIT_MAX) + up) };
}
const pitShards = (tier, timed) => (timed ? 2 + Math.floor(clampT(tier, PIT_MAX) / 4) : 1);


// ---------------------------------------------------------------- horde
const HORDE_BOONS = {
  might: { name: 'BLOODLUST', buff: 'might' }, fortify: { name: 'IRONHIDE', buff: 'fortify' }, regen: { name: 'RENEWAL', buff: 'regen' },
  focus: { name: 'KEEN SIGHT', buff: 'focus' }, haste: { name: 'TAILWIND', buff: 'haste' }, bless: { name: 'GRACE', buff: 'bless' }, thornskin: { name: 'BRAMBLES', buff: 'thornskin' },
};
const HORDE_BOON_IDS = Object.keys(HORDE_BOONS);
const hordeScale = wave => r3(1 + 0.12 * (Math.max(1, Math.floor(wave)) - 1));
const hordeAether = wave => 10 + 5 * Math.max(1, Math.floor(wave));
function hordeOffer(owned, rnd) { const pool = HORDE_BOON_IDS.filter(id => !(owned || []).includes(id)), out = []; while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length) % pool.length, 1)[0]); return out; }
const hordeChest = (aether, lvl) => ({ items: Math.min(5, Math.floor(aether / 60)), gold: Math.round(aether * (2 + Math.max(1, lvl) / 10)), rarity: aether >= 400 ? 5 : aether >= 200 ? 4 : 3 });

if (typeof globalThis !== 'undefined') globalThis.GBQDread = {
  SIGIL_MIN_LVL, PIT_MIN_LVL, HORDE_MIN_LVL, SIGIL_MAX, PIT_MAX, SIGIL_BAG, HORDE_WAVES, SCRAP_PER_SHARD, SIGIL_BOONS, SIGIL_BANES, BOON_IDS, BANE_IDS,
  sigilScale, baneCount, rollSigil, sigilFoeMult, sigilRewards, SIGIL_CRAFT, SIGIL_SALVAGE, pitScale, pitLimit, pitResult, pitShards,
  HORDE_BOONS, HORDE_BOON_IDS, hordeScale, hordeAether, hordeOffer, hordeChest,
};

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof enterInstance === 'function' && typeof DUNGEONS !== 'undefined' && typeof Battle !== 'undefined') {
  if (typeof ITEMS !== 'undefined' && !ITEMS.pit_shard) ITEMS.pit_shard = { name: 'PIT SHARD', icon: 'ne_gem_4', type: 'mat', price: 60, rarity: 4, desc: 'From THE PIT. Trade for masterwork scrap.' };
  const D = () => {
    const s = G.dread = G.dread && typeof G.dread === 'object' ? G.dread : {};
    s.sigils = Array.isArray(s.sigils) ? s.sigils : []; s.powder = s.powder || 0; s.sigilBest = s.sigilBest || 0; s.pitBest = Math.max(1, s.pitBest || 1);
    if (s.run === undefined) s.run = null; if (s.horde === undefined) s.horde = null;
    if (s.lastDungeons === undefined) s.lastDungeons = (G.stats && G.stats.dungeons) || 0;
    return s;
  };
  const dgIds = () => DUNGEONS.filter(d => d.lvl <= G.lvl + 5).map(d => d.id).concat(DUNGEONS.length ? [] : []);
  const dungeonDef = id => DUNGEONS.find(d => d.id === id);
  const scaleDice = (dice, m) => (typeof diceAvg === 'function' && typeof dmgDice === 'function' ? dmgDice(diceAvg(dice) * m) : dice);
  const scaleFoe = (f, hp, dmg, tag) => { f.maxhp = Math.round(f.maxhp * hp); f.hp = f.maxhp; (f.attacks || []).forEach(a => { if (a.dice) a.dice = scaleDice(a.dice, dmg); }); if (tag) f.name = (tag + ' ' + f.name).slice(0, 16); };
  const activeRun = () => { const s = G && G.dread, r = s && s.run; return r && r.entered && G.inst && G.inst.kind === 'dungeon' && G.inst.def.id === r.dungeon ? r : null; };
  const keyBusy = () => !!(G.keystone && G.keystone.run && !G.keystone.run.done);
  let hordeBattle = false;
  const sigilName = sg => `T${sg.tier} ${(dungeonDef(sg.dungeon) || { name: '?' }).name}`;

  // ------------------------------------------------ foes and battle starts
  { const fm0 = applyFloorMod; applyFloorMod = function (foes) {
      const out = fm0.apply(this, arguments), r = activeRun(); if (!r) return out;
      for (const f of foes) {
        if (r.mode === 'sigil') { const m = sigilFoeMult(r); scaleFoe(f, m.hp, m.dmg, `T${r.tier}`); }
        else { const m = pitScale(r.tier); scaleFoe(f, m, m, `P${r.tier}`); }
      }
      return out;
    }; }
  { const se0 = Battle.prototype.setupEffects; Battle.prototype.setupEffects = function () {
      se0.apply(this, arguments);
      const r = activeRun();
      if (r && r.mode === 'sigil') for (const id of r.neg || []) { const b = SIGIL_BANES[id]; if (!b) continue;
        if (b.foe && BUFFS[b.foe]) for (const u of this.foes) addEffect(u, { id: b.foe, rounds: b.rounds });
        if (b.party && BUFFS[b.party]) for (const u of this.party) addEffect(u, { id: b.party, rounds: b.rounds }); }
      const h = G && G.dread && G.dread.horde;
      if (hordeBattle && h) for (const id of h.boons) { const b = HORDE_BOONS[id]; if (b && BUFFS[b.buff]) for (const u of this.party) if (isChar(u)) addEffect(u, { id: b.buff, rounds: 3 }); }
    }; }

  // ------------------------------------------------ run results
  function finishRun(r, ok, timedOut) {
    const s = D(), def = dungeonDef(r.dungeon) || { name: 'DUNGEON', lvl: G.lvl }, lines = []; s.run = null;
    if (r.mode === 'sigil') {
      if (!ok) { lines.push(`DREAD T${r.tier} ${def.name} FAILED.`, 'The sigil burns away.'); }
      else {
        const rw = sigilRewards(r, def.lvl, R); s.sigilBest = Math.max(s.sigilBest, r.tier); s.powder += rw.powder; G.gold += rw.gold; if (typeof gainXP === 'function') gainXP(G, rw.xp);
        for (let i = 0; i < rw.items; i++) addGear(makeItem({ lvl: rw.ilvl, rarity: rw.rarity, boss: true }));
        let got = ''; if (s.sigils.length < SIGIL_BAG) { const sg = rollSigil(rw.next, dgIds().length ? dgIds() : [DUNGEONS[0].id], R); s.sigils.push(sg); got = `New sigil: ${sigilName(sg)}.`; } else { s.powder += SIGIL_SALVAGE; got = 'Sigil bag full: salvaged for powder.'; }
        lines.push(`DREAD T${r.tier} ${def.name} CLEARED!`, `${rw.items} item(s) iLvl ${rw.ilvl}, +${rw.gold}G, +${rw.xp} XP, +${rw.powder} powder.`, got);
      }
    } else {
      const elapsed = (Date.now() - r.start) / 1000;
      if (!ok && !timedOut) lines.push(`PIT T${r.tier} FAILED.`, 'You left or fell. No reward.');
      else {
        const res = pitResult(r.tier, elapsed, r.limit), n = pitShards(r.tier, res.timed); addItem('pit_shard', n);
        if (res.timed) { s.pitBest = Math.max(s.pitBest, res.unlock); addGear(makeItem({ lvl: Math.min(720, def.lvl + 4 * r.tier), rarity: r.tier >= 40 ? 5 : 4, boss: true })); }
        lines.push(res.timed ? `PIT T${r.tier} CONQUERED in ${Math.floor(elapsed)}s!` : `PIT T${r.tier}: OUT OF TIME.`, `+${n} pit shard${n > 1 ? 's' : ''}.${res.timed ? ` Tiers up to ${s.pitBest} unlocked.` : ''}`);
      }
    }
    saveGame(); toast(ok ? 'DREAD CLEARED' : 'DREAD FAILED', lines[0].slice(0, 22), ok ? 'item_chest' : 'px_skull', ok ? 'act_complete' : 'error'); say(lines);
  }
  function poll() {
    if (!G || !G.stats) return; const s = D(), r = s.run, d = G.stats.dungeons || 0;
    if (r && !r.entered) {
      if (G.inst && G.inst.kind === 'dungeon' && G.inst.def.id === r.dungeon) { r.entered = true; r.start = Date.now(); r.base = d; if (r.mode === 'pit') r.limit = pitLimit(G.inst.map.roomCount || (G.inst.map.rooms || []).length); }
      else if (Date.now() - r.asked > 20000) s.run = null; // never arrived: nothing is spent
    } else if (r) {
      if (d > r.base) { s.lastDungeons = d; return finishRun(r, true); }
      if (!G.inst || G.inst.def.id !== r.dungeon) { s.lastDungeons = d; return finishRun(r, false); }
    }
    if (d > s.lastDungeons) { // ordinary dungeon clears drop sigils
      if (G.lvl >= SIGIL_MIN_LVL) for (let i = s.lastDungeons; i < d; i++) if (R() < 0.5 && s.sigils.length < SIGIL_BAG) { const sg = rollSigil(1 + Math.floor(R() * Math.max(1, s.sigilBest)), dgIds().length ? dgIds() : [DUNGEONS[0].id], R); s.sigils.push(sg); toast('DREAD SIGIL', sigilName(sg).slice(0, 22), 'item_key', 'achievement'); }
      s.lastDungeons = d;
    }
  }
  { let n = 0; const t0 = tick; window.tick = tick = function () { const res = t0.apply(this, arguments); if (G && ++n % 30 === 0) { try { poll(); } catch (e) { /* keep the loop alive */ } } return res; }; }
  if (typeof Field !== 'undefined') { const d0 = Field.prototype.draw; Field.prototype.draw = function () {
      d0.apply(this, arguments); const r = activeRun(); if (!r) return;
      if (r.mode === 'pit') { const left = r.limit - (Date.now() - r.start) / 1000; fill(1, 12, 56, 9, 0); text(`P${r.tier} ${left >= 0 ? Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') : 'LATE'}`, 3, 13, left >= 0 ? (left < 60 ? 'gold' : 3) : 'red'); }
      else { fill(1, 12, 40, 9, 0); text(`DREAD T${r.tier}`, 3, 13, 'purple'); }
    }; }
  function startRun(run) {
    const def = dungeonDef(run.dungeon);
    if (G.inst) { SFX.error(); return say('Leave your current instance first.'); }
    if (G.ghost) { SFX.error(); return say('Recover your body first.'); }
    if (keyBusy()) { SFX.error(); return say('A keystone run is already active.'); }
    D().run = Object.assign(run, { asked: Date.now(), entered: false });
    while (scenes.length > 1 && scenes[scenes.length - 1] !== currentField()) scenes.pop();
    enterInstance('dungeon', def, 1, Math.max(1, Math.min(4, typeof fieldPartySize === 'function' ? fieldPartySize() : 1)));
  }

  // ------------------------------------------------ horde
  function hordeWave() {
    const s = D(), h = s.horde, z = ZONE_BY_ID[G.map]; if (!h || !z) return;
    const foes = rollEncounter(z, { group: true }), m = hordeScale(h.wave); foes.forEach(f => scaleFoe(f, m, m, `W${h.wave}`));
    hordeBattle = true;
    startBattle(foes, { onEnd: res => {
      hordeBattle = false;
      if (res === 'lose') { const lost = Math.floor(h.aether / 2); h.aether -= lost; const ae = h.aether; s.horde = null; onPartyWipe(); return say(`The horde overwhelms you at wave ${h.wave}. Half the aether is lost (${ae} kept).`, () => hordePayout(ae)); }
      if (res !== 'win') { s.horde = null; return; }
      h.aether += hordeAether(h.wave); checkAchievements();
      if (h.wave >= HORDE_WAVES) { const ae = h.aether; s.horde = null; return say(`The horde is broken! All ${HORDE_WAVES} waves cleared.`, () => hordePayout(ae)); }
      const offer = hordeOffer(h.boons, R);
      const next = () => choose(['NEXT WAVE', `CASH OUT (${h.aether} AETHER)`], k => { if (k === 1) { const ae = h.aether; s.horde = null; return hordePayout(ae); } h.wave++; saveGame(); hordeWave(); }, `WAVE ${h.wave}/${HORDE_WAVES} CLEARED  AETHER ${h.aether}`);
      if (!offer.length) return next();
      choose(offer.map(id => `${HORDE_BOONS[id].name}: ${BUFFS[HORDE_BOONS[id].buff].name}`), k => { const id = offer[Math.max(0, k)]; h.boons.push(id); saveGame(); next(); }, 'Choose a boon: it opens every later battle.');
    } });
  }
  function hordePayout(ae) {
    const c = hordeChest(ae, G.lvl); G.gold += c.gold; for (let i = 0; i < c.items; i++) addGear(makeItem({ lvl: G.lvl, rarity: c.rarity, boss: true }));
    saveGame(); toast('HORDE CHEST', `${ae} AETHER`, 'item_chest', 'act_complete'); say(`Aether chest: +${c.gold}G and ${c.items} item(s).`);
  }

  // ------------------------------------------------ menus
  function sigilMenu() {
    const s = D();
    if (G.lvl < SIGIL_MIN_LVL) return say(`DREAD SIGILS open at level ${SIGIL_MIN_LVL}.`, dreadMenu);
    const opts = [...s.sigils.map(sigilName), `CRAFT SIGIL (${SIGIL_CRAFT} PWD)`, 'BACK'];
    choose(opts, i => {
      const sg = s.sigils[i];
      if (sg) {
        const def = dungeonDef(sg.dungeon), m = sigilFoeMult(sg);
        const info = [`${sigilName(sg)} (LV ${def ? def.lvl : '?'}). Foes +${Math.round((m.hp - 1) * 100)}% HP.`, `BOON ${SIGIL_BOONS[sg.pos].name}: ${SIGIL_BOONS[sg.pos].desc}`, ...sg.neg.map(id => `BANE ${SIGIL_BANES[id].name}: ${SIGIL_BANES[id].desc}`)];
        return choose(['ACTIVATE', 'DETAILS', `SALVAGE (+${SIGIL_SALVAGE})`, 'BACK'], k => {
          if (k === 0) { s.sigils.splice(s.sigils.indexOf(sg), 1); saveGame(); return startRun({ mode: 'sigil', tier: sg.tier, dungeon: sg.dungeon, pos: sg.pos, neg: sg.neg.slice() }); }
          if (k === 1) return say(info, sigilMenu);
          if (k === 2) { s.sigils.splice(s.sigils.indexOf(sg), 1); s.powder += SIGIL_SALVAGE; saveGame(); return sigilMenu(); }
          sigilMenu();
        }, info[0]);
      }
      if (i === s.sigils.length) {
        if (s.powder < SIGIL_CRAFT) { SFX.error(); return say(`Needs ${SIGIL_CRAFT} sigil powder.`, sigilMenu); }
        if (s.sigils.length >= SIGIL_BAG) { SFX.error(); return say('Your sigil bag is full.', sigilMenu); }
        s.powder -= SIGIL_CRAFT; const sg = rollSigil(Math.max(1, s.sigilBest), dgIds().length ? dgIds() : [DUNGEONS[0].id], R); s.sigils.push(sg); saveGame(); SFX.chest(); return say(`Crafted ${sigilName(sg)}.`, sigilMenu);
      }
      dreadMenu();
    }, `SIGILS ${s.sigils.length}/${SIGIL_BAG}  POWDER ${s.powder}  BEST T${s.sigilBest}`);
  }
  function pitMenu() {
    const s = D();
    if (G.lvl < PIT_MIN_LVL) return say(`THE PIT opens at level ${PIT_MIN_LVL}.`, dreadMenu);
    const tiers = []; for (let t = s.pitBest; t >= 1 && tiers.length < 6; t -= t > 10 ? 5 : 1) tiers.push(t);
    choose([...tiers.map(t => `ENTER TIER ${t} (+${Math.round((pitScale(t) - 1) * 100)}%)`), 'BACK'], i => {
      const t = tiers[i]; if (!t) return dreadMenu();
      const pool = dgIds().length ? dgIds() : [DUNGEONS[0].id];
      startRun({ mode: 'pit', tier: t, dungeon: pool[Math.floor(R() * pool.length)] });
    }, `THE PIT  BEST TIER ${s.pitBest}/${PIT_MAX}  SHARDS ${G.inv.pit_shard || 0}`);
  }
  function shardMenu() {
    const have = G.inv.pit_shard || 0;
    choose([`TRADE 1 (+${SCRAP_PER_SHARD} SCRAP)`, `TRADE ALL (${have})`, 'BACK'], i => {
      const n = i === 0 ? 1 : i === 1 ? have : 0; if (!n) return i === 2 || i < 0 ? dreadMenu() : say('You have no pit shards.', shardMenu);
      if (have < n) { SFX.error(); return say('You have no pit shards.', shardMenu); }
      G.inv.pit_shard -= n; if (!G.inv.pit_shard) delete G.inv.pit_shard; addItem('scrap', n * SCRAP_PER_SHARD); saveGame(); SFX.confirm();
      say(`+${n * SCRAP_PER_SHARD} SCRAP. Masterwork at the OCCULTIST.`, shardMenu);
    }, `SHARD EXCHANGE  SHARDS ${have}  SCRAP ${G.inv.scrap || 0}`);
  }
  function hordeMenu() {
    const s = D(), z = ZONE_BY_ID[G.map];
    if (G.lvl < HORDE_MIN_LVL) return say(`THE ENDLESS HORDE opens at level ${HORDE_MIN_LVL}.`, dreadMenu);
    if (G.inst || !z || z.town) return say('Start a horde out in the open world, not in a town or instance.', dreadMenu);
    choose(['START HORDE', 'HOW IT WORKS', 'BACK'], i => {
      if (i === 1) return say([`${HORDE_WAVES} waves of battles in ${z.name}. Foes +12% per wave.`, 'After each wave pick a boon and bank aether, or cash out for a chest.', 'A wipe loses half the aether.'], hordeMenu);
      if (i !== 0) return dreadMenu();
      s.horde = { wave: 1, boons: [], aether: 0 }; saveGame();
      while (scenes.length > 1 && scenes[scenes.length - 1] !== currentField()) scenes.pop();
      hordeWave();
    }, `ENDLESS HORDE  ${z.name.slice(0, 18)}`);
  }
  function dreadMenu() {
    const s = D();
    choose([`DREAD SIGILS (${s.sigils.length})`, `THE PIT T${s.pitBest}`, 'SHARD EXCHANGE', 'ENDLESS HORDE', 'BACK'], i => { const go = [sigilMenu, pitMenu, shardMenu, hordeMenu][i]; if (go) go(); },
      `DREAD DUNGEONS  POWDER ${s.powder}  SHARDS ${G.inv.pit_shard || 0}`);
  }
  window.dreadMenu = dreadMenu;
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { 'DREAD DUNGEONS': 'Sigil dungeons, the Pit, shard exchange and the endless horde.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = L.indexOf('CHALLENGES') + 1; L.splice(at > 0 ? at : L.length, 0, 'DREAD DUNGEONS'); return L; };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && (this.items()[this.i] || '') === 'DREAD DUNGEONS') { SFX.select(); return dreadMenu(); } return u0.apply(this, arguments); };
  }
}
})();
