'use strict';
// ================================================================ GUILD CONQUEST: BOONSTONES AND CASTLE SIEGE
// MAIN MENU > CONQUEST. Throne-style guild territory, fought against the realm's AI guilds until the server runs it
// between real guilds:
//   * BOONSTONES: every wild region has a boonstone held by a guild (IRON TALONS, ASHEN VEIL, ...). CHALLENGE it:
//     two waves of guild defenders and the STONE WARDEN. Win and your guild holds it: +10% XP and gold from foes in that
//     region, and a daily TAX in gold. A lost challenge has a 10 minute cooldown.
//   * COUNTERATTACKS: every 30 minutes an AI guild may march on one of your stones. DEFEND it (one battle) within
//     20 minutes or lose it.
//   * CASTLE SIEGE: with 3 boonstones your guild can besiege ARDENHOLD KEEP: break the GATE, clear the COURTYARD,
//     then beat the CASTLE LORD. Holding the castle gives +5% damage, +5% resist all and +10% XP everywhere, a bigger
//     daily tax and the CASTLE LORD title. AI guilds besiege it every 2 hours (defend within 20 minutes).
// You need a guild (SOCIAL > GUILD). Pure rules are exported as GBQConquest for tests.

const AI_GUILDS = ['IRON TALONS', 'ASHEN VEIL', 'RED LANTERN', 'GREY WARDENS', 'STORMBORN', 'BLACK TIDE'];
const STONE_COOLDOWN = 10 * 6e4, COUNTER_EVERY = 30 * 6e4, CASTLE_EVERY = 120 * 6e4, DEFEND_WINDOW = 20 * 6e4, CASTLE_NEEDS = 3;
const DAY_MS = 864e5;
function cqHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const startingOwner = regionId => AI_GUILDS[cqHash('stone|' + regionId) % AI_GUILDS.length];
const stoneTax = (lvl, days) => Math.round((50 + lvl * 10) * Math.min(7, Math.max(0, days)));
const castleTax = (lvl, days) => Math.round((500 + lvl * 50) * Math.min(7, Math.max(0, days)));
const CASTLE_BUFF = [['dmg', 5], ['resist', 5], ['xp', 10]];
// the waves of a challenge: [{ name, count, lvlAdd, hp, boss }]
function challengeWaves(kind) {
  if (kind === 'castle') return [{ name: 'GATE', count: 1, lvlAdd: 2, hp: 6, gate: true }, { name: 'COURTYARD', count: 4, lvlAdd: 2, hp: 1.2 }, { name: 'CASTLE LORD', count: 1, lvlAdd: 4, hp: 5, boss: true }];
  if (kind === 'defend') return [{ name: 'RAIDERS', count: 3, lvlAdd: 1, hp: 1.1 }];
  if (kind === 'castle_defend') return [{ name: 'SIEGE PARTY', count: 4, lvlAdd: 3, hp: 1.3 }];
  return [{ name: 'DEFENDERS', count: 3, lvlAdd: 0, hp: 1 }, { name: 'DEFENDERS', count: 3, lvlAdd: 1, hp: 1.1 }, { name: 'STONE WARDEN', count: 1, lvlAdd: 3, hp: 3.5, boss: true }];
}
// an AI counterattack is due when the last one is older than the period (and the hero holds something)
const counterDue = (now, last, every) => now - (last || 0) >= every;

if (typeof globalThis !== 'undefined') globalThis.GBQConquest = { AI_GUILDS, startingOwner, stoneTax, castleTax, CASTLE_BUFF, challengeWaves, counterDue, CASTLE_NEEDS, STONE_COOLDOWN, DEFEND_WINDOW };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof startBattle === 'function' && typeof REGIONS !== 'undefined') {
  const wild = () => REGIONS.filter(r => !r.town);
  const regionLvl = r => { const zs = ZONES.filter(z => z.region === r.id && z.lvl); return zs.length ? Math.max(1, zs[0].lvl[0]) : 1; };
  const Q = () => {
    G.conquest ||= { stones: {}, castle: { owner: 'GREY WARDENS', since: 0, taxAt: 0 }, lastCounter: Date.now(), lastSiege: Date.now(), threat: null };
    for (const r of wild()) G.conquest.stones[r.id] ||= { owner: startingOwner(r.id), since: 0, taxAt: 0, cool: 0 };
    return G.conquest;
  };
  const mine = () => G && G.guild ? Object.entries(Q().stones).filter(([, s]) => s.owner === G.guild).map(([id]) => id) : [];
  const holdsCastle = () => !!(G && G.guild && Q().castle.owner === G.guild);
  // bonuses: castle buff everywhere, +10% xp/gold from foes in a held region
  { const sb0 = armorSetBonus; armorSetBonus = function (c) { const out = sb0.apply(this, arguments); if (c === G && holdsCastle()) out.push(...CASTLE_BUFF); return out; }; }
  { const mm0 = makeMonster; makeMonster = function (src, L, diff, extra) {
      const m = mm0.apply(this, arguments);
      try { const z = G && !G.inst && ZONE_BY_ID[G.map]; if (z && m.side !== 'party' && !(extra && extra.side === 'party') && G.guild && G.conquest && G.conquest.stones[z.region] && G.conquest.stones[z.region].owner === G.guild) { m.xp = Math.round((m.xp || 1) * 1.1); m.gold = Math.round((m.gold || 1) * 1.1); } } catch (e) { /* keep */ }
      return m;
    }; }
  // build one wave of foes
  function waveFoes(w, lvl) {
    const pool = BESTIARY.filter(b => b.fam === (w.gate ? 'construct' : 'humanoid'));
    const base = pool.length ? pool : BESTIARY;
    return Array.from({ length: w.count }, (_, i) => {
      const b = base[(cqHash(w.name + i + lvl)) % base.length], m = makeMonster(b, lvl + w.lvlAdd, G.difficulty);
      m.maxhp = Math.round(m.maxhp * w.hp); m.hp = m.maxhp; m.name = (w.gate ? 'CASTLE GATE' : w.boss ? w.name : `${w.name.slice(0, 8)} ${i + 1}`).slice(0, 16);
      if (w.gate) { m.attacks.forEach(a => { a.dice = '1d4'; }); m.ac += 2; }
      if (w.boss) { m.elite = true; m.xp *= 4; m.gold *= 4; }
      return m;
    });
  }
  // run the waves one after another; done(true) only if every wave is won
  function runWaves(waves, lvl, title, done) {
    let i = 0;
    const next = () => {
      if (i >= waves.length) return done(true);
      const w = waves[i++]; toast(title, `${w.name} (${i}/${waves.length})`, 'px_crown', 'boss_appear');
      startBattle(waveFoes(w, lvl), { noFlee: true, title: w.name, onEnd: (res, b) => { if (res === 'win') { defaultBattleEnd(res, b); setTimeout(next, 50); } else { defaultBattleEnd(res, b); done(false); } } });
    };
    next();
  }
  // AI counterattacks
  (window.LOOP_HOOKS ||= []).push(() => {
    if (!G || !G.guild || !G.conquest) return;
    const q = G.conquest, now = Date.now();
    if (q.threat && now > q.threat.until) {
      const t = q.threat; q.threat = null;
      if (t.kind === 'castle') { q.castle.owner = t.by; toast('CASTLE LOST', `${t.by} took the keep.`, 'px_skull', 'error'); }
      else if (q.stones[t.region] && q.stones[t.region].owner === G.guild) { q.stones[t.region].owner = t.by; toast('BOONSTONE LOST', `${t.by} took ${(REGIONS.find(r => r.id === t.region) || { name: '?' }).name}.`, 'px_skull', 'error'); }
      if (typeof chatLog === 'function') chatLog('system', 'CONQUEST', `${t.by} won the ${t.kind === 'castle' ? 'castle' : 'boonstone'} - nobody defended it.`);
    }
    if (q.threat) return;
    const by = AI_GUILDS[Math.floor(R() * AI_GUILDS.length)];
    if (holdsCastle() && counterDue(now, q.lastSiege, CASTLE_EVERY)) { q.lastSiege = now; q.threat = { kind: 'castle', by, until: now + DEFEND_WINDOW }; toast('CASTLE UNDER SIEGE!', `${by} - defend within 20 min`, 'px_crown', 'boss_appear'); return; }
    const held = mine();
    if (held.length && counterDue(now, q.lastCounter, COUNTER_EVERY)) { q.lastCounter = now; if (R() < 0.6) { const region = held[Math.floor(R() * held.length)]; q.threat = { kind: 'stone', region, by, until: now + DEFEND_WINDOW }; toast('BOONSTONE ATTACKED!', `${by} at ${(REGIONS.find(r => r.id === region) || { name: '?' }).name.slice(0, 12)}`, 'px_skull', 'boss_appear'); } }
  });
  // ---------------------------------------------------------------- menu
  function conquestMenu() {
    if (!G.guild) return say(['CONQUEST is fought between guilds.', 'Join or found one in SOCIAL > GUILD first.']);
    const q = Q(), held = mine(), now = Date.now();
    const opts = [];
    if (q.threat) opts.push(q.threat.kind === 'castle' ? `! DEFEND CASTLE ${Math.ceil((q.threat.until - now) / 6e4)}m` : `! DEFEND ${(REGIONS.find(r => r.id === q.threat.region) || { name: '?' }).name.slice(0, 9)} ${Math.ceil((q.threat.until - now) / 6e4)}m`);
    opts.push('BOONSTONES', `CASTLE: ${holdsCastle() ? 'YOURS' : q.castle.owner.slice(0, 11)}`, 'COLLECT TAXES', 'BACK');
    choose(opts, k => {
      const o = opts[k]; if (!o || o === 'BACK') return;
      if (o.startsWith('! DEFEND')) {
        const t = q.threat, lvl = t.kind === 'castle' ? Math.max(G.lvl, 20) : regionLvl(REGIONS.find(r => r.id === t.region));
        return runWaves(challengeWaves(t.kind === 'castle' ? 'castle_defend' : 'defend'), Math.max(lvl, G.lvl - 2), 'DEFENCE', ok => { if (ok) { q.threat = null; toast('DEFENDED!', `${t.by} was driven off.`, 'px_crown', 'act_complete'); saveGame(); } });
      }
      if (o === 'BOONSTONES') return stonesMenu();
      if (o.startsWith('CASTLE')) {
        if (holdsCastle()) return say([`<${G.guild}> holds ARDENHOLD KEEP.`, 'Castle buff: +5% damage, +5% resist all, +10% XP.', 'AI guilds besiege it every 2 hours.'], conquestMenu);
        if (held.length < CASTLE_NEEDS) return say([`ARDENHOLD KEEP is held by ${q.castle.owner}.`, `A guild needs ${CASTLE_NEEDS} boonstones to besiege it (you hold ${held.length}).`], conquestMenu);
        return choose(['BESIEGE THE KEEP', 'NOT YET'], j => {
          if (j !== 0) return conquestMenu();
          runWaves(challengeWaves('castle'), Math.max(20, G.lvl), 'CASTLE SIEGE', ok => {
            if (!ok) return;
            q.castle = { owner: G.guild, since: Date.now(), taxAt: Date.now() }; q.lastSiege = Date.now(); (G.titlesWon ||= {})['CASTLE LORD'] = true;
            toast('THE KEEP IS YOURS!', `<${G.guild}> rules ARDENHOLD`, 'px_crown', 'act_complete'); if (typeof chatLog === 'function') chatLog('system', 'CONQUEST', `<${G.guild}> has taken ARDENHOLD KEEP! ${G.name} is CASTLE LORD.`); saveGame();
          });
        }, `Siege ARDENHOLD KEEP: GATE, COURTYARD, then the CASTLE LORD. No retreat.`);
      }
      if (o === 'COLLECT TAXES') {
        let gold = 0;
        for (const id of held) { const s = q.stones[id]; gold += stoneTax(regionLvl(REGIONS.find(r => r.id === id)), (now - (s.taxAt || s.since || now)) / DAY_MS); s.taxAt = now; }
        if (holdsCastle()) { gold += castleTax(G.lvl, (now - (q.castle.taxAt || now)) / DAY_MS); q.castle.taxAt = now; }
        if (!gold) return say('No taxes yet. Taxes build up for a day at a time (up to 7 days).', conquestMenu);
        G.gold += gold; SFX.coin ? SFX.coin() : SFX.buff(); saveGame(); return say(`Collected ${fmt(gold)} G in taxes.`, conquestMenu);
      }
    }, `<${G.guild}> CONQUEST: ${held.length} boonstone${held.length === 1 ? '' : 's'}${holdsCastle() ? ', the castle' : ''}.`);
  }
  function stonesMenu() {
    const q = Q(), L = wild();
    choose([...L.map(r => `${q.stones[r.id].owner === G.guild ? '# ' : ''}${r.name.slice(0, 10)} ${q.stones[r.id].owner === G.guild ? 'YOURS' : q.stones[r.id].owner.split(' ').pop().slice(0, 7)}`), 'BACK'], k => {
      if (k < 0 || k >= L.length) return conquestMenu();
      const r = L[k], s = q.stones[r.id], lvl = regionLvl(r);
      if (s.owner === G.guild) return say([`${r.name} BOONSTONE is yours.`, '+10% XP and gold from foes there, plus daily tax.'], stonesMenu);
      if (Date.now() < s.cool) return say(`Your guild must regroup: ${Math.ceil((s.cool - Date.now()) / 6e4)} min.`, stonesMenu);
      choose(['CHALLENGE', 'BACK'], j => {
        if (j !== 0) return stonesMenu();
        runWaves(challengeWaves('stone'), Math.max(lvl, G.lvl - 3), `${r.name.slice(0, 10)} BOONSTONE`, ok => {
          if (!ok) { s.cool = Date.now() + STONE_COOLDOWN; return; }
          const from = s.owner; Object.assign(s, { owner: G.guild, since: Date.now(), taxAt: Date.now(), cool: 0 }); G.stats.boonstones = (G.stats.boonstones || 0) + 1;
          toast('BOONSTONE TAKEN', `${r.name.slice(0, 12)} from ${from.slice(0, 10)}`, 'px_crown', 'act_complete'); if (typeof chatLog === 'function') chatLog('system', 'CONQUEST', `<${G.guild}> took the ${r.name} boonstone from ${from}.`); saveGame();
        });
      }, `${r.name} BOONSTONE held by ${s.owner}. Two waves of defenders, then the STONE WARDEN (LV${lvl + 3}+).`);
    }, 'BOONSTONES');
  }
  window.conquestMenu = conquestMenu;
  window.MENU_HELP_EXTRA = Object.assign(window.MENU_HELP_EXTRA || {}, { CONQUEST: 'Boonstones and castle siege.' });
  if (typeof MainMenu !== 'undefined') {
    const i0 = MainMenu.prototype.items; MainMenu.prototype.items = function () { const L = i0.apply(this, arguments), at = Math.max(0, L.indexOf('CHALLENGES') + 1); L.splice(at, 0, G && G.conquest && G.conquest.threat ? 'CONQUEST (!)' : 'CONQUEST'); return L; };
    const u0 = MainMenu.prototype.update; MainMenu.prototype.update = function () { if (P('a') && (this.items()[this.i] || '').replace(' (!)', '') === 'CONQUEST') { SFX.select(); return conquestMenu(); } return u0.apply(this, arguments); };
  }
}
