'use strict';
// ================================================================ TRINKETS: two trinket slots and battle-start effects
// Trinkets are wondrous items for the TRINKET 1 / TRINKET 2 slots. Each type grants one buff from BUFFS
// to its wearer when a battle starts. Higher rarity lasts longer: base rounds, +1 at RARE and +1 at
// LEGENDARY. Two different trinkets stack; two copies of the same buff refresh rather than double.
// Trinkets drop like any wondrous item, and heirloom trinkets come with LANTERNBORN HEIRLOOMS.
// The pure rules are exported as GBQTrinkets for tests; the game wiring runs only inside the game.

const TRINKET_TYPES = {
  war_horn: { name: 'WAR HORN', buff: 'might', rounds: 3, bonus: 'init', art: 'relic', desc: 'MIGHTY: +15% damage' },
  lucky_coin: { name: 'LUCKY COIN', buff: 'focus', rounds: 3, bonus: 'save', art: 'magicitem', desc: 'FOCUSED: +15% crit chance' },
  wardstone: { name: 'WARDSTONE', buff: 'fortify', rounds: 3, bonus: 'save', art: 'relic', desc: 'FORTIFIED: +25% resist all' },
  ember_heart: { name: 'EMBER HEART', buff: 'regen', rounds: 4, bonus: 'init', art: 'magicitem', desc: 'REGENERATING: heal 6% a round' },
  quicksilver: { name: 'QUICKSILVER VIAL', buff: 'haste', rounds: 1, bonus: 'init', art: 'magicitem', desc: 'HASTED: extra attack, +2 AC' },
  thorn_idol: { name: 'THORN IDOL', buff: 'thornskin', rounds: 5, bonus: 'save', art: 'relic', desc: 'THORNSKIN: +6 thorns' },
  saints_token: { name: "SAINT'S TOKEN", buff: 'bless', rounds: 3, bonus: 'save', art: 'amulet', desc: 'BLESSED: +2 hit and saves' },
  owl_feather: { name: 'OWL FEATHER', buff: 'foresight', rounds: 1, bonus: 'init', art: 'magicitem', desc: 'FORESIGHT: advantage, foes at disadvantage' },
};
// rarity index (0 poor ... 8 divine) -> extra rounds
const trinketRounds = (type, rarity) => { const t = TRINKET_TYPES[type]; if (!t) return 0; const r = Math.max(0, Math.floor(Number(rarity) || 0)); return t.rounds + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0); };
// the battle-start effects of everything in a character's trinket slots
function trinketEffects(eq) {
  const out = [];
  for (const slot of ['trinket1', 'trinket2']) {
    const it = eq && eq[slot]; if (!it) continue;
    const type = it.trinket || it.base, t = TRINKET_TYPES[type];
    if (t) out.push({ slot, type, buff: t.buff, rounds: trinketRounds(type, it.rarity), name: it.name || t.name });
  }
  return out;
}
const trinketDesc = (type, rarity) => { const t = TRINKET_TYPES[type]; return t ? `BATTLE START: ${t.desc} FOR ${trinketRounds(type, rarity)} RND${trinketRounds(type, rarity) === 1 ? '' : 'S'}.` : ''; };

if (typeof globalThis !== 'undefined') globalThis.GBQTrinkets = { TRINKET_TYPES, trinketRounds, trinketEffects, trinketDesc };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof WONDROUS !== 'undefined' && typeof Battle !== 'undefined') {
  // trinket bases join the wondrous pool, so they drop as loot
  for (const [id, t] of Object.entries(TRINKET_TYPES)) {
    if (!WONDROUS.some(w => w.id === id)) WONDROUS.push({ id, name: t.name, slot: 'trinket', bonus: t.bonus, icon: 'px_orb' });
    if (typeof WONDROUS_ART !== 'undefined') WONDROUS_ART[id] = t.art;
  }
  // effects fire as the battle sets up
  {
    const se0 = Battle.prototype.setupEffects;
    Battle.prototype.setupEffects = function () {
      se0.call(this);
      for (const u of this.party) {
        if (!isChar(u)) continue;
        for (const e of trinketEffects(u.ch.eq)) {
          if (!BUFFS[e.buff]) continue;
          addEffect(u, { id: e.buff, rounds: e.rounds });
          if (typeof chatLog === 'function') chatLog('combat', 'TRINKET', `${u.ch.name}'s ${e.name}: ${BUFFS[e.buff].name} for ${e.rounds} round${e.rounds === 1 ? '' : 's'}.`);
        }
      }
    };
  }
  // item text names the effect
  { const d0 = itemDesc; itemDesc = function (it) { const s = d0(it); const type = it && (it.trinket || it.base); return it && it.kind === 'wondrous' && TRINKET_TYPES[type] ? `${trinketDesc(type, it.rarity)} ${s}` : s; }; }
}
