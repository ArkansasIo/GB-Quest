#!/usr/bin/env python3
"""Combat effect check for Lost Kingdom of Shadowbane Chronicles.

Loads the real built game (dist/gbquest.html) in Chromium and proves that every buff, debuff and the conditions with
combat flags change the numbers combat uses, for heroes and monsters, through the same functions a battle calls
(acOf, effRollBonus, save, advState, applyDamage, weaponAttack, monsterAttack, startTurn, haste/dodge/resist helpers).
Chance-based effects (crit, dodge, dice) are measured over many rolls with wide margins.

  python3 tests/effects_check.py [path/to/gbquest.html]   -> one line per check, exit 1 on any failure
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'gbquest.html')

CHECK = r"""
() => {
  const out = [];
  const ok = (name, cond, detail = '') => out.push({ name, ok: !!cond, detail: String(detail) });
  reset(new Title()); G = newGameState({ name: 'FX', cls: 'warden', species: 'hearthkin', bg: 'soldier' }); G.buffs = []; enterWorld();
  const hero = () => { const h = partyMember(G, 'local'); h.effects = []; G.hp = derive(G).hpMax; G.buffs = []; return h; };
  const mon = () => { const m = foeMember(makeMonster(BESTIARY[0], 5, 2)); Object.assign(m, { effects: [], res: [], imm: [], vuln: [], mechs: [], traits: [], condImm: [], hp: 1e6, maxhp: 1e6, threat: {}, legRes: 0 }); return m; };
  const battle = (party, foes) => { const b = Object.create(Battle.prototype); Object.assign(b, { anim: { flash: {} }, q: [], party, foes, all: party.concat(foes), log: [], round: 1, state: 'idle', skillUses: new Set() }); b.posOf = () => [80, 72]; return b; };
  const fx = (u, id, extra = {}) => { u.effects.push(Object.assign({ id, rounds: 5, stacks: 1 }, extra)); return u; };
  const dealt = (src, tgt, amt = 100, type = 'force', opt = {}) => { const b = battle([], []); const before = hpOf(tgt); b.applyDamage(src, tgt, amt, type, opt); return before - hpOf(tgt); };
  const mean = (n, f) => { let s = 0; for (let i = 0; i < n; i++) s += f(); return s / n; };

  // ---- every effect has a name and a description
  for (const id in BUFFS) ok(`describe ${id}`, BUFFS[id].name && BUFFS[id].desc && BUFFS[id].desc.length > 8, BUFFS[id].desc);

  // ---- AC: HASTED +2, FROSTBITTEN -1/stack, SUNDERED -2/stack, SLOWED -2, WARDED +val
  { const m = mon(), base = acOf(m);
    ok('HASTED +2 AC', acOf(fx(mon(), 'haste')) === base + 2);
    ok('FROSTBITTEN -1 AC per stack', acOf(fx(mon(), 'frostbite', { stacks: 2 })) === base - 2);
    ok('SUNDERED -2 AC per stack', acOf(fx(mon(), 'sundered', { stacks: 3 })) === base - 6);
    ok('SLOWED -2 AC', acOf(fx(mon(), 'slowed')) === base - 2);
    ok('WARDED adds its strength', acOf(fx(mon(), 'ac', { val: 3 })) === base + 3); }
  // saved hero buff counts once (it used to add +4 AC)
  { const h = hero(), base = acOf(h);
    ok('hero HASTED in battle +2 AC', acOf(fx(hero(), 'haste')) === base + 2);
    G.buffs = [{ id: 'haste' }]; const h2 = partyMember(G, 'local'); h2.effects = [{ id: 'haste', rounds: 99, persist: true, stacks: 1 }];
    ok('saved HASTED counts once (+2, not +4)', acOf(h2) === base + 2, acOf(h2) - base); G.buffs = []; }

  // ---- damage dealt: MIGHTY +15%, WEAKENED -25%, FRENZIED +10%/stack, all damage kinds
  ok('MIGHTY +15% damage', dealt(fx(mon(), 'might'), mon()) === 115);
  ok('WEAKENED -25% damage', dealt(fx(mon(), 'weakened'), mon()) === 75);
  ok('FRENZIED x3 +30% damage', dealt(fx(mon(), 'frenzy', { stacks: 3 }), mon()) === 130);
  ok('MIGHTY applies to spell damage', dealt(fx(mon(), 'might'), mon(), 100, 'fire', { magic: true }) === 115);
  ok('hero MIGHTY in battle +15%', dealt(fx(hero(), 'might'), mon(), 100, 'force', { proc: true }) === 115); // proc: no random gear procs
  { G.buffs = [{ id: 'might' }]; const h = partyMember(G, 'local'); h.effects = [{ id: 'might', rounds: 99, persist: true, stacks: 1 }];
    ok('saved MIGHTY not counted again in applyDamage (already in derive dmg %)', dealt(h, mon(), 100, 'force', { proc: true }) === 100 && derive(G).dmgPct >= 15); G.buffs = []; }
  ok('damage over time is not scaled by an attacker', dealt(null, mon(), 100, 'fire', { tick: true }) === 100);

  // ---- damage taken: FORTIFIED -25%, VULNERABLE +25%, SHOCKED +10%
  ok('FORTIFIED 25% less damage (monster)', dealt(mon(), fx(mon(), 'fortify')) === 75);
  ok('FORTIFIED counts for heroes', resistOf(fx(hero(), 'fortify')) === GBQEffects.cap('resist', derive(G).resistAll + 25));
  ok('VULNERABLE +25% damage taken', dealt(mon(), fx(mon(), 'vulnerable')) === 125);
  ok('SHOCKED +10% damage taken', dealt(mon(), fx(mon(), 'shocked')) === 110);

  // ---- THORNSKIN: melee attackers take 6
  { const att = mon(), t = fx(mon(), 'thornskin'), b = battle([], []), before = att.hp; b.applyDamage(att, t, 10, 'slashing', { attack: true }); ok('THORNSKIN 6 to melee attacker', before - att.hp === 6, before - att.hp); }
  { const att = mon(), t = fx(mon(), 'thornskin'), b = battle([], []), before = att.hp; b.applyDamage(att, t, 10, 'piercing', { attack: true, ranged: true }); ok('THORNSKIN ignores ranged', before - att.hp === 0); }

  // ---- haste chance: HASTED +25, FRENZIED +10/stack, FROSTBITTEN -25/stack, SLOWED -50 (never below 0)
  ok('HASTED 25% extra action', hasteOf(fx(mon(), 'haste')) === 25);
  ok('FRENZIED x2 20% extra action', hasteOf(fx(mon(), 'frenzy', { stacks: 2 })) === 20);
  ok('hero HASTED adds to gear haste', hasteOf(fx(hero(), 'haste')) === GBQEffects.cap('haste', derive(G).haste + 25));
  ok('FROSTBITTEN lowers haste', hasteOf(fx(fx(mon(), 'haste'), 'frostbite')) === 0);
  ok('SLOWED floors at 0', hasteOf(fx(mon(), 'slowed')) === 0);
  { const m = fx(mon(), 'haste'), b = battle([], [m]); let extra = 0; for (let i = 0; i < 800; i++) { b.extraAction = false; b.startTurn(m); if (b.extraAction) extra++; } ok('HASTED gives extra actions in startTurn (~25%)', extra > 120 && extra < 290, extra); }

  // ---- dodge: SHOCKED -10
  { G.ascSub = Object.assign({}, G.ascSub, { dodge: 30 }); const base = dodgeOf(hero()); ok('SHOCKED -10% dodge', dodgeOf(fx(hero(), 'shocked')) === base - 10, `${base}`); G.ascSub.dodge = 0; }

  // ---- crit: FOCUSED +15% for monster attacks (measured)
  { const t = mon(); t.ac = -50; const rate = (m) => { let c = 0; for (let i = 0; i < 3000; i++) if (/CRITICAL/.test(battle([], [m]).monsterAttack(m, t, m.attacks[0]).text)) c++; return c / 3000; };
    const r0 = rate(mon()), r1 = rate(fx(mon(), 'focus'));
    ok('FOCUSED raises monster crit rate by ~15 points', r1 - r0 > 0.10 && r1 - r0 < 0.20, `${r0.toFixed(3)} -> ${r1.toFixed(3)}`); }
  { const h = fx(hero(), 'focus'), t = mon(); t.ac = -50; const b = battle([h], [t]); let c = 0; for (let i = 0; i < 3000; i++) if (/CRITICAL/.test(b.resolveWeapon(h, t, {}).text)) c++;
    const h0 = hero(), b0 = battle([h0], [t]); let c0 = 0; for (let i = 0; i < 3000; i++) if (/CRITICAL/.test(b0.resolveWeapon(h0, t, {}).text)) c0++;
    ok('FOCUSED raises hero crit rate by ~15 points', (c - c0) / 3000 > 0.10 && (c - c0) / 3000 < 0.20, `${(c0 / 3000).toFixed(3)} -> ${(c / 3000).toFixed(3)}`); }

  // ---- attack rolls: BLESSED +1d4, INSPIRED +3 once, BANED / DOOMED -2 (both stack), monsters and heroes
  { const m = fx(mon(), 'bless'), avg = mean(4000, () => effRollBonus(m, 'hit')); ok('BLESSED +1d4 to attacks (mean 2.5)', avg > 2.3 && avg < 2.7, avg.toFixed(2)); }
  { const m = fx(mon(), 'inspired'); const a = effRollBonus(m, 'hit'), gone = !hasEff(m, 'inspired'); ok('INSPIRED +3 once, then spent', a === 3 && gone && effRollBonus(m, 'hit') === 0); }
  { const m = fx(mon(), 'inspired'); const s = effRollBonus(m, 'saves'); ok('INSPIRED can be spent on a save', s === 3 && !hasEff(m, 'inspired')); }
  ok('DOOMED -2 to attacks', effRollBonus(fx(mon(), 'doomed'), 'hit') === -2);
  ok('BANED -2 to attacks', effRollBonus(fx(mon(), 'bane'), 'hit') === -2);
  ok('BANED and DOOMED stack', effRollBonus(fx(fx(mon(), 'bane'), 'doomed'), 'hit') === -4);
  { const m = fx(mon(), 'bane'), t = mon(); const txt = battle([], [m]).monsterAttack(m, t, m.attacks[0]).text; ok('monster attack roll shows BANED', txt.includes(`+${m.attacks[0].hit - 2}=`) || txt.includes(`DODGES`) || txt.includes('illusion'), txt.split('\n')[1]); }
  { const h = fx(hero(), 'bless'), t = mon(), b = battle([h], [t]); const w = derive(G).weapon.hit; let sum = 0, n = 0; for (let i = 0; i < 2000; i++) { const line = b.resolveWeapon(h, t, {}).text.split('\n')[1] || ''; const m = line.match(/d20 \d+([+-]\d+)=/); if (m) { sum += +m[1] - w; n++; } } ok('hero weapon attack gets BLESSED', n > 0 && sum / n > 2.2 && sum / n < 2.8, (sum / n).toFixed(2)); }

  // ---- saves: BLESSED +1d4, WELL FED +1 (monster), DOOMED -2; FORESIGHT advantage
  ok('BLESSED +1d4 to saves', (() => { const m = fx(mon(), 'bless'); const a = mean(4000, () => effRollBonus(m, 'saves')); return a > 2.3 && a < 2.7; })());
  ok('WELL FED +1 to saves (in battle)', effRollBonus(fx(mon(), 'fed'), 'saves') === 1);
  { const b = battle([], []), m0 = mon(), m1 = fx(mon(), 'foresight'); const p = (m) => { let s = 0; for (let i = 0; i < 3000; i++) if (b.save(m, 'WIS', 15).ok) s++; return s / 3000; }; const a = p(m0), c = p(m1); ok('FORESIGHT gives advantage on saves', c - a > 0.12, `${a.toFixed(2)} -> ${c.toFixed(2)}`); }
  { const b = battle([], []), m0 = mon(), m1 = fx(mon(), 'doomed'); const p = (m) => { let s = 0; for (let i = 0; i < 3000; i++) if (b.save(m, 'WIS', 12).ok) s++; return s / 3000; }; const a = p(m0), c = p(m1); ok('DOOMED lowers saves (~10 points)', a - c > 0.05 && a - c < 0.16, `${a.toFixed(2)} -> ${c.toFixed(2)}`); }

  // ---- advantage flags: VEILED / FORESIGHT attackAdv and attackedDis; OUTLINED cancels invisibility
  { const b = battle([], []); ok('VEILED attacker has advantage', b.advState(fx(mon(), 'trueveil'), mon()) === 1);
    ok('VEILED target imposes disadvantage', b.advState(mon(), fx(mon(), 'trueveil')) === -1);
    ok('invisible target imposes disadvantage', b.advState(mon(), fx(mon(), 'invisible')) === -1);
    ok('OUTLINED invisible target: advantage, no disadvantage', b.advState(mon(), fx(fx(mon(), 'invisible'), 'outlined')) === 1);
    ok('OUTLINED invisible attacker gets no advantage', b.advState(fx(fx(mon(), 'invisible'), 'outlined'), mon()) === 0); }

  // ---- extra attacks: HASTED +1 weapon attack for heroes
  { const h = hero(), t = mon(), b = battle([h], [t]); const n0 = b.weaponAttack(h, t).length; fx(h, 'haste'); ok('HASTED +1 weapon attack', b.weaponAttack(h, t).length === n0 + 1); }

  // ---- charmed heroes lose the turn
  { const h = fx(hero(), 'charmed', { rounds: 2 }), b = battle([h], [mon()]); b.after = () => {}; const r = b.startTurn(h); ok('charmed hero loses the turn', r === null && /charmed/.test((b.cur && b.cur.text) || ''), (b.cur && b.cur.text) || ''); }

  // ---- damage over time still ticks
  { const m = fx(mon(), 'burning', { stacks: 2 }), b = battle([], [m]); const steps = b.startTurn(m); ok('BURNING ticks each turn', Array.isArray(steps) && steps.some(s => /BURNING/.test(s.text))); }
  { const m = mon(); m.hp = 100; m.maxhp = 1000; fx(m, 'regen'); battle([], [m]).startTurn(m); ok('REGENERATING heals 6% max HP', m.hp === 160, m.hp); }
  return out;
}
"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto('file://' + os.path.abspath(PAGE))
        await pg.wait_for_function('typeof Battle === "function" && typeof GBQEffects === "object"', timeout=60000)
        results = await pg.evaluate(CHECK)
        await b.close()
    fails = [r for r in results if not r['ok']]
    for r in results:
        print(('ok   ' if r['ok'] else 'FAIL ') + r['name'] + (f"  [{r['detail']}]" if r['detail'] and not r['name'].startswith('describe') else ''))
    for e in errors: print('PAGE ERROR', e)
    print(f"{len(results) - len(fails)}/{len(results)} effect checks passed")
    sys.exit(1 if fails or errors else 0)

asyncio.run(main())
