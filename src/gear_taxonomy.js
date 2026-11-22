'use strict';
// ================================================================ GEAR TAXONOMY: CLASS > SUBCLASS > TYPE > SUBTYPE ACROSS THE 23 GEAR TIERS
// Every weapon and armour piece gets a full four-level classification, like raw materials already have:
//   WEAPONS  CLASS    MELEE / RANGED / CASTER                         -> an ATTRIBUTE (STR / DEX / INT) and a damage stat
//            SUBCLASS the 14 weapon subclasses (SWORD ... GRIMOIRE)    -> their signature implicit (armory.js)
//            TYPE     grip: TWO-HANDED / VERSATILE / LIGHT / ONE-HANDED -> a handling stat
//            SUBTYPE  the material its tier is forged from (ore or wood) -> an elemental or physical damage stat
//   ARMOUR   CLASS    CLOTH / LEATHER / MAIL / PLATE / SHIELD          -> an ATTRIBUTE (INT / DEX / CON / STR)
//            SUBCLASS HELM CLOAK CHEST GLOVES BELT LEGGINGS BOOTS, or BUCKLER / HEATER / TOWER for shields -> a category stat
//            TYPE     the named piece for that class and category (e.g. PLATE HELM = GREATHELM, CLOTH BOOTS = SLIPPERS)
//            SUBTYPE  the material its tier is made of (cloth fibre, hide or ore) -> a resistance
// All of it scales with the item's gear tier (1-23) and stacks with the tier, subclass and weight-class implicits
// that already exist. Pure rules are exported as GBQTaxonomy for tests; the game wiring runs only in the browser.

const TAX_WEAPON_CLASS = {
  MELEE: { fams: ['sword', 'axe', 'mace', 'hammer', 'dagger', 'polearm', 'scythe', 'fist'], attr: 'strength', stat: 'dmgMelee', matFamily: 'ore' },
  RANGED: { fams: ['bow', 'crossbow', 'thrown'], attr: 'dexterity', stat: 'dmgRanged', matFamily: 'wood' },
  CASTER: { fams: ['staff', 'wand', 'grimoire'], attr: 'intelligence', stat: 'dmgSpell', matFamily: 'wood' },
};
// material family overrides by weapon subclass (thrown blades are steel, grimoires are leather-bound)
const TAX_WEAPON_MAT = { thrown: 'ore', grimoire: 'hide' };
const TAX_GRIPS = {
  'TWO-HANDED': { stat: 'overpower', val: t => 5 + t * 3, desc: 'Big swings: overpower damage.' },
  VERSATILE: { stat: 'dmg', val: t => 2 + t, desc: 'One or two hands: damage.' },
  LIGHT: { stat: 'haste', val: t => 1 + Math.floor(t / 3), desc: 'Quick: haste.' },
  'ONE-HANDED': { stat: 'crit', val: t => 1 + Math.floor(t / 6), desc: 'Precise: crit chance.' },
};
const TAX_ARMOUR_CLASS = {
  cloth: { name: 'CLOTH', attr: 'intelligence', matFamily: 'fiber' },
  leather: { name: 'LEATHER', attr: 'dexterity', matFamily: 'hide' },
  mail: { name: 'MAIL', attr: 'constitution', matFamily: 'ore' },
  plate: { name: 'PLATE', attr: 'strength', matFamily: 'ore' },
  shield: { name: 'SHIELD', attr: 'constitution', matFamily: 'wood' },
};
const TAX_CATEGORY = {
  head: { name: 'HELM', stat: 'hpPct', val: t => Math.min(15, 1 + Math.floor(t / 2)) },
  back: { name: 'CLOAK', stat: 'dodge', val: t => Math.min(10, 1 + Math.floor(t / 3)) },
  armor: { name: 'CHEST', stat: 'dr', val: t => Math.min(10, 1 + Math.floor(t / 3)) },
  hands: { name: 'GLOVES', stat: 'luckyHit', val: t => Math.min(20, 2 + t) },
  waist: { name: 'BELT', stat: 'lifeRegen', val: t => 2 + t * 3 },
  legs: { name: 'LEGGINGS', stat: 'drMelee', val: t => Math.min(12, 1 + Math.floor(t / 2)) },
  feet: { name: 'BOOTS', stat: 'moveSpeed', val: t => Math.min(25, 3 + t) },
  offhand: { name: 'SHIELD', stat: 'block', val: t => Math.min(12, 2 + Math.floor(t / 2)) },
};
// the named piece for each weight class and category (28), plus shield sizes
const TAX_PIECE_TYPES = {
  cloth: { head: 'HOOD', back: 'MANTLE', armor: 'ROBE', hands: 'WRAPS', waist: 'SASH', legs: 'TROUSERS', feet: 'SLIPPERS' },
  leather: { head: 'CAP', back: 'CAPE', armor: 'JERKIN', hands: 'GRIPS', waist: 'BELT', legs: 'BREECHES', feet: 'BOOTS' },
  mail: { head: 'COIF', back: 'SURCOAT', armor: 'HAUBERK', hands: 'MITTS', waist: 'GIRDLE', legs: 'CHAUSSES', feet: 'TREADS' },
  plate: { head: 'GREATHELM', back: 'WARCLOAK', armor: 'CUIRASS', hands: 'GAUNTLETS', waist: 'WAISTGUARD', legs: 'GREAVES', feet: 'SABATONS' },
};
const TAX_SHIELD_SIZES = ['BUCKLER', 'HEATER', 'TOWER'];
const shieldSize = name => (/TOWER|WALL|AEGIS/i.test(name || '') ? 'TOWER' : /BUCKLER|TARGE|ROUND/i.test(name || '') ? 'BUCKLER' : 'HEATER');
// material trait keyword (materials.js TYPE) -> [weapon stat, armour stat]
const TAX_TRAITS = {
  VOLATILE: ['fire', 'resFire'], FIREPROOF: ['fire', 'resFire'], WARM: ['fire', 'resFire'],
  COLD: ['cold', 'resCold'],
  CONDUCTIVE: ['lightning', 'resShock'],
  HALLOWED: ['radiant', 'resHoly'], DIVINE: ['radiant', 'resHoly'], LUMINOUS: ['radiant', 'resHoly'],
  SHADOWED: ['necrotic', 'resShadow'], LUNAR: ['necrotic', 'resShadow'],
  ARCANE: ['dmgSpell', 'resArcane'], ASTRAL: ['dmgSpell', 'resArcane'],
  VENOMPROOF: ['poisonDmg', 'resPoison'], MEDICINAL: ['poisonDmg', 'resPoison'], TONIC: ['poisonDmg', 'resPoison'],
};
const traitStats = trait => TAX_TRAITS[String(trait || '').toUpperCase()] || ['physDmg', 'resist'];
const weaponClassOf = fam => Object.keys(TAX_WEAPON_CLASS).find(k => TAX_WEAPON_CLASS[k].fams.includes(fam)) || 'MELEE';
const gripOf = props => { const p = String(props || ''); return p.includes('2') ? 'TWO-HANDED' : p.includes('v') ? 'VERSATILE' : p.includes('l') ? 'LIGHT' : 'ONE-HANDED'; };
const tierOf = t => Math.max(1, Math.min(23, Math.floor(Number(t) || 1)));

// the four levels and their stats for one weapon. info: { fam, subclassName, props, tier, material: { name, type } }
function weaponTaxonomy(info) {
  const t = tierOf(info.tier), cls = weaponClassOf(info.fam), C = TAX_WEAPON_CLASS[cls], grip = gripOf(info.props), G = TAX_GRIPS[grip];
  const mat = info.material || { name: 'IRON', type: '' }, [mStat] = traitStats(mat.type);
  return {
    cls, subclass: info.subclassName || String(info.fam || '').toUpperCase(), type: grip, subtype: mat.name,
    stats: [[C.attr, 1 + Math.floor(t / 4)], [C.stat, 2 + t * 2], [G.stat, G.val(t)], [mStat, 2 + t * 2]],
  };
}
// the four levels and their stats for one armour piece. info: { aclass ('cloth'..'plate' or 'shield'), slot, name, tier, material }
function armourTaxonomy(info) {
  const t = tierOf(info.tier), ac = TAX_ARMOUR_CLASS[info.aclass] ? info.aclass : 'cloth', A = TAX_ARMOUR_CLASS[ac];
  const slot = ac === 'shield' ? 'offhand' : info.slot, cat = TAX_CATEGORY[slot] || TAX_CATEGORY.armor;
  const type = ac === 'shield' ? shieldSize(info.name) : (TAX_PIECE_TYPES[ac] || {})[slot] || cat.name;
  const mat = info.material || { name: 'LINEN', type: '' }, [, rStat] = traitStats(mat.type);
  return {
    cls: A.name, subclass: ac === 'shield' ? type : cat.name, type: ac === 'shield' ? `${type} SHIELD` : type, subtype: mat.name,
    stats: [[A.attr, 1 + Math.floor(t / 4)], [cat.stat, cat.val(t)], [rStat, Math.min(20, 1 + Math.floor(t * 0.8))]],
  };
}
const taxonomyLine = x => `${x.cls} > ${x.subclass} > ${x.type} > ${x.subtype}`;

if (typeof globalThis !== 'undefined') globalThis.GBQTaxonomy = { TAX_WEAPON_CLASS, TAX_GRIPS, TAX_ARMOUR_CLASS, TAX_CATEGORY, TAX_PIECE_TYPES, TAX_SHIELD_SIZES, TAX_TRAITS, weaponClassOf, gripOf, shieldSize, traitStats, weaponTaxonomy, armourTaxonomy, taxonomyLine };

// ================================================================ game wiring (browser build only)
if (typeof window !== 'undefined' && typeof WEAPONS !== 'undefined' && typeof ARMORS !== 'undefined' && typeof tierImplicit === 'function') {
  const PIECES = ['head', 'back', 'armor', 'hands', 'waist', 'legs', 'feet'];
  const matFor = (family, tier) => { try { if (typeof matOf === 'function') { const m = matOf(family, tier); if (m) return { name: m.name, type: m.type }; } } catch (e) { /* fall through */ } return null; };
  const tierNameOf = t => (typeof ITEM_RANKS !== 'undefined' && ITEM_RANKS[t - 1] ? ITEM_RANKS[t - 1].name : `TIER ${t}`);
  // the taxonomy of one item, or null for anything that isn't a weapon or an armour piece
  function gearTaxonomy(it) {
    if (!it) return null;
    const t = tierOf(it.rank || (typeof rankFor === 'function' ? rankFor(it.ilvl || 1).n : 1));
    let x = null;
    if (it.kind === 'weapon' && WEAPONS[it.base]) {
      const w = WEAPONS[it.base], cls = weaponClassOf(w.fam);
      const fam = TAX_WEAPON_MAT[w.fam] || TAX_WEAPON_CLASS[cls].matFamily;
      x = weaponTaxonomy({ fam: w.fam, subclassName: (typeof WEAPON_CLASSES !== 'undefined' && WEAPON_CLASSES[w.fam] || {}).name, props: w.props, tier: t, material: matFor(fam, t) });
    } else if (it.kind === 'armor' && ARMORS[it.base]) {
      const a = ARMORS[it.base], ac = a.type === 'shield' ? 'shield' : (a.aclass || 'cloth');
      x = armourTaxonomy({ aclass: ac, slot: 'armor', name: a.name, tier: t, material: matFor(TAX_ARMOUR_CLASS[ac].matFamily, t) });
    } else if (it.kind === 'wondrous' && PIECES.includes(String(it.slot))) {
      const ac = it.aclass || 'cloth';
      x = armourTaxonomy({ aclass: ac, slot: it.slot, name: it.name, tier: t, material: matFor(TAX_ARMOUR_CLASS[ac].matFamily, t) });
    }
    if (x) { x.tier = t; x.tierName = tierNameOf(t); }
    return x;
  }
  window.gearTaxonomy = gearTaxonomy;
  // taxonomy stats join the item's implicits, so they count everywhere implicits do (stats, detail pages, compare)
  { const ti0 = tierImplicit; tierImplicit = function (it) {
      const out = ti0.apply(this, arguments);
      try { const x = gearTaxonomy(it); if (x) return out.concat(x.stats.filter(([k, v]) => v > 0 && typeof SUBSTATS !== 'undefined' && SUBSTATS[k])); } catch (e) { /* keep the base implicits */ }
      return out;
    }; }
  // every item description leads with its classification and tier
  if (typeof itemDesc === 'function') { const d0 = itemDesc; itemDesc = function (it) {
      const s = d0.apply(this, arguments);
      try { const x = gearTaxonomy(it); if (x) return `${taxonomyLine(x)} · T${x.tier} ${x.tierName}. ${s}`; } catch (e) { /* plain description */ }
      return s;
    }; }
}
