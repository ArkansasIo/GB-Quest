'use strict';
// ================================================================ SPECS AND LOADOUTS
// MAIN MENU > LOADOUTS.
//   * DUAL SPEC (from level 10, 500 G once): a second set of talents, active and passive skills and combat arts.
//     Switching saves the current spec and loads the other. The second spec starts with every point refunded.
//   * EQUIPMENT SETS: save up to 5 named sets of equipped gear and put a whole set on in one step; pieces come
//     from your bag or bank. Missing pieces are reported and skipped.
//   * ACTION BAR: pin the combat actions you want first on the 1-9 hotbar; each spec keeps its own bar.
// Pure rules are exported as GBQLoadouts for tests; the game wiring runs only inside the game.

const DUAL_SPEC_LEVEL = 10, DUAL_SPEC_COST = 500, MAX_SETS = 5;
const copyList = v => Array.isArray(v) ? v.slice() : [];
// what a spec holds
const specOf = c => ({ talents: copyList(c.talents), talentPts: Math.max(0, c.talentPts || 0), activeSkills: copyList(c.activeSkills), passiveSkills: copyList(c.passiveSkills), skillPts: Math.max(0, c.skillPts || 0), arts: copyList(c.arts), hotbar: copyList(c.hotbar) });
// a fresh spec: every talent and skill point refunded, same combat arts
const blankSpecFrom = s => ({ talents: [], talentPts: s.talents.length + s.talentPts, activeSkills: [], passiveSkills: [], skillPts: s.activeSkills.length + s.passiveSkills.length + s.skillPts, arts: copyList(s.arts), hotbar: [] });
const applySpec = (c, s) => { c.talents = copyList(s.talents); c.talentPts = s.talentPts; c.activeSkills = copyList(s.activeSkills); c.passiveSkills = copyList(s.passiveSkills); c.skillPts = s.skillPts; c.arts = copyList(s.arts); c.hotbar = copyList(s.hotbar); return c; };
// both specs must hold the same number of points (catches points earned on the other spec since it was saved)
function topUp(s, earnedTalents, earnedSkills) {
  const t = s.talents.length + s.talentPts, k = s.activeSkills.length + s.passiveSkills.length + s.skillPts;
  return { ...s, talentPts: s.talentPts + Math.max(0, earnedTalents - t), skillPts: s.skillPts + Math.max(0, earnedSkills - k) };
}
const totals = s => ({ talents: s.talents.length + s.talentPts, skills: s.activeSkills.length + s.passiveSkills.length + s.skillPts });
// equipment sets: slot -> item uid
const setFromEq = eq => Object.fromEntries(Object.entries(eq || {}).filter(([, it]) => it && it.uid != null).map(([s, it]) => [s, it.uid]));
// where each piece of a set is now: { slot: { uid, where: 'eq'|'bag'|'bank'|null } }
function planSet(set, eq, bag, bank) {
  const out = {};
  for (const [slot, uid] of Object.entries(set || {})) {
    const where = eq && eq[slot] && eq[slot].uid === uid ? 'worn' : Object.values(eq || {}).some(it => it && it.uid === uid) ? 'eq' : (bag || []).some(it => it && it.uid === uid) ? 'bag' : (bank || []).some(it => it && it.uid === uid) ? 'bank' : null;
    out[slot] = { uid, where };
  }
  return out;
}
// hotbar: pinned ids first in their order, then the rest as the game built them
function orderHotbar(entries, pinned) {
  const first = (pinned || []).map(id => entries.find(e => e.id === id)).filter(Boolean);
  return first.concat(entries.filter(e => !first.includes(e)));
}

if (typeof globalThis !== 'undefined') globalThis.GBQLoadouts = { DUAL_SPEC_LEVEL, DUAL_SPEC_COST, MAX_SETS, specOf, blankSpecFrom, applySpec, topUp, totals, setFromEq, planSet, orderHotbar };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof Battle !== 'undefined' && typeof equipItem === 'function') {
  const inBattle = () => scenes.some(s => s instanceof Battle);
  const L = () => { G.loadouts = G.loadouts && typeof G.loadouts === 'object' ? G.loadouts : { dual: false, active: 0, specs: [null, null], names: ['SPEC 1', 'SPEC 2'], sets: [] }; return G.loadouts; };

  // combat hotbar follows the pinned order of the hero's current spec
  { const h0 = Battle.prototype.hotbarEntries; Battle.prototype.hotbarEntries = function (u) { const e = h0.call(this, u); return u && u.ch === G && G.hotbar && G.hotbar.length ? orderHotbar(e, G.hotbar).slice(0, 10) : e; }; }

  function switchSpec() {
    const l = L(); if (!l.dual) return 'Learn dual specialization first.'; if (inBattle()) return 'Not during a battle.';
    const cur = specOf(G); l.specs[l.active] = cur;
    const other = 1 - l.active, t = totals(cur);
    let next = l.specs[other] ? topUp(l.specs[other], t.talents, t.skills) : blankSpecFrom(cur);
    applySpec(G, next); l.active = other; G.hp = Math.min(G.hp, derive(G).hpMax);
    return null;
  }
  function setsMenu() {
    const l = L(), opts = [...l.sets.map(s => `EQUIP: ${s.name}`), ...(l.sets.length < MAX_SETS ? ['SAVE CURRENT GEAR'] : []), ...(l.sets.length ? ['OVERWRITE A SET', 'RENAME A SET', 'DELETE A SET'] : []), 'BACK'];
    choose(opts, k => {
      const o = opts[k] || 'BACK'; if (o === 'BACK') return loadoutsMenu();
      if (o === 'SAVE CURRENT GEAR') { const n = l.sets.length + 1; l.sets.push({ name: `SET ${n}`, items: setFromEq(G.eq) }); SFX.confirm(); saveGame(); return say(`Saved SET ${n} (${Object.keys(l.sets[n - 1].items).length} pieces).`, setsMenu); }
      if (o === 'OVERWRITE A SET') return choose(l.sets.map(s => s.name), j => { if (j >= 0) { l.sets[j].items = setFromEq(G.eq); saveGame(); SFX.confirm(); } setsMenu(); }, 'Overwrite with current gear?');
      if (o === 'RENAME A SET') return choose(l.sets.map(s => s.name), j => {
        if (j < 0) return setsMenu();
        const names = ['DAMAGE', 'TANK', 'HEALER', 'DUNGEON', 'RAID', 'PVP', 'FARM', 'CUSTOM 1', 'CUSTOM 2'];
        choose(names, n => { if (n >= 0) { l.sets[j].name = names[n]; saveGame(); SFX.confirm(); } setsMenu(); }, `Rename ${l.sets[j].name}`);
      }, 'Rename which set?');
      if (o === 'DELETE A SET') return choose(l.sets.map(s => s.name), j => { if (j >= 0) { l.sets.splice(j, 1); saveGame(); } setsMenu(); }, 'Delete which set?');
      if (inBattle()) return say('Not during a battle.');
      const set = l.sets[k], plan = planSet(set.items, G.eq, G.bag, G.bank); let moved = 0; const missing = [];
      for (const [slot, p] of Object.entries(plan)) {
        if (p.where === 'worn') continue;
        if (!p.where) { missing.push(SLOT_NAME[slot] || slot); continue; }
        if (p.where === 'eq') { const from = Object.keys(G.eq).find(s => G.eq[s] && G.eq[s].uid === p.uid), it = G.eq[from]; delete G.eq[from]; G.bag.push(it); }
        const list = p.where === 'bank' ? G.bank : G.bag, it = list.find(x => x && x.uid === p.uid); if (!it) { missing.push(SLOT_NAME[slot] || slot); continue; }
        const why = equipItem(G, it, list, slot); if (why) missing.push(`${SLOT_NAME[slot] || slot} (${why})`); else moved++;
      }
      SFX.equip(); saveGame(); say([`${set.name}: ${moved} piece${moved === 1 ? '' : 's'} equipped.`, ...(missing.length ? [`Missing: ${missing.join(', ')}`.slice(0, 60)] : [])], setsMenu);
    }, `EQUIPMENT SETS ${l.sets.length}/${MAX_SETS}`);
  }
  function barMenu() {
    const fake = Object.create(Battle.prototype); fake.bonusUsed = false; fake.canCast = () => true; fake.combatMode = 'turn-based';
    let entries = []; try { entries = Battle.prototype.hotbarEntries.call(Object.assign(fake, { abilities: u => { try { return Battle.prototype.abilities.call(fake, u); } catch (e) { return []; } } }), { ch: G }); } catch (e) { entries = []; }
    const pinned = G.hotbar || [];
    if (!entries.length) return say('Your action bar is built in battle: attack, abilities and spells.', loadoutsMenu);
    choose(entries.map((e, i) => `${i + 1}: ${pinned.includes(e.id) ? '* ' : ''}${e.name}`.slice(0, 24)).concat(['CLEAR PINS', 'BACK']), k => {
      if (k < 0 || k === entries.length + 1) return loadoutsMenu();
      if (k === entries.length) { G.hotbar = []; saveGame(); return barMenu(); }
      const id = entries[k].id; G.hotbar = pinned.includes(id) ? pinned.filter(x => x !== id) : [...pinned, id]; saveGame(); barMenu();
    }, 'A: PIN/UNPIN. PINNED ACTIONS COME FIRST');
  }
  function loadoutsMenu() {
    const l = L(), names = l.names;
    const specRow = l.dual ? `SWITCH TO ${names[1 - l.active]}` : `LEARN DUAL SPEC ${fmt(DUAL_SPEC_COST)} G`;
    choose([specRow, ...(l.dual ? ['RENAME SPEC'] : []), 'EQUIPMENT SETS', 'ACTION BAR', 'BACK'], k => {
      const o = [specRow, ...(l.dual ? ['RENAME SPEC'] : []), 'EQUIPMENT SETS', 'ACTION BAR', 'BACK'][k];
      if (o === specRow && !l.dual) {
        if (G.lvl < DUAL_SPEC_LEVEL) { SFX.error(); return say(`Dual specialization opens at level ${DUAL_SPEC_LEVEL}.`, loadoutsMenu); }
        if (G.gold < DUAL_SPEC_COST) { SFX.error(); return say(`It costs ${fmt(DUAL_SPEC_COST)} G.`, loadoutsMenu); }
        G.gold -= DUAL_SPEC_COST; l.dual = true; l.specs[0] = specOf(G); SFX.levelup(); saveGame(); return say(['Dual specialization learned!', `Switch to ${names[1]} to set up a second build. Its points start refunded.`], loadoutsMenu);
      }
      if (o === specRow) { const why = switchSpec(); SFX[why ? 'error' : 'levelup'](); if (!why) saveGame(); return say(why || [`Now using ${names[l.active]}.`, `${G.talents.length} talents, ${G.activeSkills.length + G.passiveSkills.length} skills. Unspent: ${G.talentPts} talent, ${G.skillPts} skill points.`], loadoutsMenu); }
      if (o === 'RENAME SPEC') return choose(['DAMAGE', 'TANK', 'HEALER', 'SOLO', 'PVP', 'SUPPORT'], j => { if (j >= 0) { names[l.active] = ['DAMAGE', 'TANK', 'HEALER', 'SOLO', 'PVP', 'SUPPORT'][j]; saveGame(); } loadoutsMenu(); }, `Name ${names[l.active]}`);
      if (o === 'EQUIPMENT SETS') return setsMenu();
      if (o === 'ACTION BAR') return barMenu();
    }, l.dual ? `ACTIVE: ${names[l.active]}` : 'LOADOUTS');
  }
  window.loadoutsMenu = loadoutsMenu; window.switchSpec = switchSpec;
}
