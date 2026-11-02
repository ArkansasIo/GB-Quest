// ================================================================ RAW MATERIALS (90) and RECIPES / BLUEPRINTS 1-720
// Taxonomy: FAMILY > CLASS > SUBCLASS > TYPE > SUBTYPE. Nine families, one per gathering profession,
// ten materials each = 90 raw materials. Each material covers a band of the 23 gear tiers, which sets
// its level (1-720) and its rarity grade (1-9). Gathering yields the best material your zone level
// and profession skill allow. Every crafting profession has a recipe (blueprint) for each of the 23
// tiers, skill 1 to 670, using the matching tier of materials.

const MAT_FAMILIES = {
  herb: { name: 'HERB', prof: 'herb', icon: ['item_herb', 'ne_reagent_0', 'ne_reagent_1', 'ne_reagent_2', 'ne_reagent_3', 'ne_reagent_4', 'ne_reagent_5', 'ne_reagent_6', 'ne_reagent_7', 'ne_reagent_8'],
    mats: [['PEACEBLOOM', 'FLORA', 'BLOOM', 'MEDICINAL', 'MEADOW', 'peacebloom'], ['SILVERLEAF', 'FLORA', 'LEAF', 'MEDICINAL', 'FOREST'], ['BLOODTHISTLE', 'FLORA', 'BLOOM', 'TONIC', 'BADLAND'], ['GHOSTCAP', 'FUNGUS', 'CAP', 'ARCANE', 'CAVERN'],
      ['SUNPETAL', 'FLORA', 'BLOOM', 'RADIANT', 'HIGHLAND'], ['DREAMROOT', 'FLORA', 'ROOT', 'ARCANE', 'MARSH'], ['FIREWEED', 'FLORA', 'STALK', 'VOLATILE', 'VOLCANIC'], ['FROSTLOTUS', 'FLORA', 'BLOOM', 'COLD', 'GLACIER'],
      ['STARMOSS', 'MOSS', 'LICHEN', 'ASTRAL', 'SPIRE'], ['DAWNROSE', 'FLORA', 'BLOOM', 'DIVINE', 'LANTERN']] },
  ore: { name: 'ORE', prof: 'mining', icon: ['ne_ore_0', 'ne_ore_1', 'ne_ore_2', 'ne_ore_3', 'ne_ore_4', 'ne_ore_5', 'ne_ore_6', 'ne_ore_7', 'ne_ore_8', 'ne_gem_8'],
    mats: [['IRON ORE', 'METAL', 'BASE METAL', 'FERROUS', 'VEIN', 'iron_ore'], ['COPPER ORE', 'METAL', 'BASE METAL', 'CONDUCTIVE', 'VEIN'], ['SILVER ORE', 'METAL', 'NOBLE METAL', 'HALLOWED', 'VEIN'], ['DUSKIRON', 'METAL', 'DARK METAL', 'SHADOWED', 'DEEP VEIN'],
      ['RUNESTONE', 'MINERAL', 'RUNIC STONE', 'ARCANE', 'OUTCROP'], ['MOONSILVER', 'METAL', 'NOBLE METAL', 'LUNAR', 'MOONPOOL'], ['EMBERITE', 'MINERAL', 'FIRE STONE', 'VOLATILE', 'MAGMA'], ['STARMETAL', 'METAL', 'SKY METAL', 'ASTRAL', 'METEOR'],
      ['ADAMANT ORE', 'METAL', 'TRUE METAL', 'UNBREAKING', 'CORE'], ['DAWNSTEEL ORE', 'METAL', 'TRUE METAL', 'DIVINE', 'LANTERN CORE']] },
  wood: { name: 'WOOD', prof: 'forestry', icon: ['ne_wood_0', 'ne_wood_1', 'ne_wood_2', 'ne_wood_3', 'ne_wood_4', 'ne_wood_5', 'ne_wood_6', 'ne_wood_7', 'ne_wood_8', 'ne_wood_8'],
    mats: [['LIVING SAP', 'TIMBER', 'RESIN', 'SOFT', 'GROVE', 'sap'], ['ASH LUMBER', 'TIMBER', 'HARDWOOD', 'SOFT', 'GROVE'], ['OAKHEART', 'TIMBER', 'HARDWOOD', 'DENSE', 'OLD FOREST'], ['YEW STAVE', 'TIMBER', 'BOWWOOD', 'SUPPLE', 'HIGHLAND'],
      ['IRONBARK', 'TIMBER', 'HARDWOOD', 'ARMORED', 'DEEPWOOD'], ['GLOWWOOD', 'TIMBER', 'SPIRITWOOD', 'LUMINOUS', 'FEYWILD'], ['EMBERWOOD', 'TIMBER', 'SPIRITWOOD', 'VOLATILE', 'ASHLAND'], ['FROSTPINE', 'TIMBER', 'CONIFER', 'COLD', 'GLACIER'],
      ['STARBOUGH', 'TIMBER', 'SPIRITWOOD', 'ASTRAL', 'SPIRE'], ['WORLDROOT', 'TIMBER', 'ELDER WOOD', 'DIVINE', 'WORLD TREE']] },
  hide: { name: 'HIDE', prof: 'hidecraft', icon: ['ne_leather_0', 'ne_leather_1', 'ne_leather_2', 'ne_leather_3', 'ne_leather_4', 'ne_leather_5', 'ne_leather_6', 'ne_leather_7', 'ne_leather_8', 'ne_leather_8'],
    mats: [['THICK HIDE', 'SKIN', 'PELT', 'TOUGH', 'BEAST', 'hide'], ['BOAR HIDE', 'SKIN', 'PELT', 'TOUGH', 'BEAST'], ['WOLF PELT', 'SKIN', 'FUR', 'WARM', 'BEAST'], ['BASILISK SCALE', 'SCALE', 'PLATED', 'STONE', 'MONSTROSITY'],
      ['WYVERN SKIN', 'SKIN', 'LEATHER', 'VENOMPROOF', 'DRAGON'], ['SHADOWHIDE', 'SKIN', 'LEATHER', 'SHADOWED', 'FIEND'], ['SALAMANDER SKIN', 'SCALE', 'PLATED', 'FIREPROOF', 'ELEMENTAL'], ['FROSTBEAR PELT', 'SKIN', 'FUR', 'COLD', 'BEAST'],
      ['DRAGONSCALE', 'SCALE', 'PLATED', 'ANCIENT', 'DRAGON'], ['SERAPH LEATHER', 'SKIN', 'LEATHER', 'DIVINE', 'CELESTIAL']] },
  fish: { name: 'FISH', prof: 'fish', icon: ['px_fish', 'ne_food_0', 'ne_food_1', 'ne_food_2', 'ne_food_3', 'ne_food_4', 'ne_food_5', 'ne_food_6', 'ne_food_7', 'ne_food_8'],
    mats: [['SMALL FISH', 'FRESHWATER', 'PANFISH', 'COMMON', 'POND', 'small_fish'], ['RIVER TROUT', 'FRESHWATER', 'GAMEFISH', 'COMMON', 'RIVER'], ['GOLDEN CARP', 'FRESHWATER', 'GAMEFISH', 'LUCKY', 'LAKE'], ['MARSH EEL', 'FRESHWATER', 'EEL', 'SLIPPERY', 'MARSH'],
      ['REEF SNAPPER', 'SALTWATER', 'REEF FISH', 'BRIGHT', 'REEF'], ['GLOOM ANGLER', 'SALTWATER', 'DEEP FISH', 'SHADOWED', 'ABYSS'], ['MAGMA KOI', 'ODDWATER', 'SPIRIT FISH', 'VOLATILE', 'LAVA POOL'], ['ICE PIKE', 'FRESHWATER', 'GAMEFISH', 'COLD', 'GLACIER LAKE'],
      ['STARFIN', 'ODDWATER', 'SPIRIT FISH', 'ASTRAL', 'SKY POOL'], ['LANTERN WHALE OIL', 'SALTWATER', 'LEVIATHAN', 'DIVINE', 'OPEN SEA']] },
  salvage: { name: 'SALVAGE', prof: 'salvaging', icon: ['ne_ore_0', 'ne_misc_0', 'ne_misc_1', 'ne_misc_2', 'ne_tool_0', 'ne_tool_2', 'ne_tool_3', 'ne_misc_5', 'ne_tool_5', 'ne_misc_8'],
    mats: [['SCRAP IRON', 'SCRAP', 'METAL SCRAP', 'BROKEN', 'CAMP', 'scrap'], ['BENT NAILS', 'SCRAP', 'METAL SCRAP', 'BROKEN', 'RUIN'], ['CHAIN LINKS', 'SCRAP', 'METAL SCRAP', 'LINKED', 'BATTLEFIELD'], ['GEARWORK', 'PARTS', 'MECHANISM', 'CLOCKWORK', 'WORKSHOP'],
      ['RUSTED PLATE', 'SCRAP', 'ARMOR SCRAP', 'HEAVY', 'WARFIELD'], ['DUSKSTEEL SHARDS', 'SCRAP', 'BLADE SCRAP', 'SHADOWED', 'FORT'], ['RUNE PLATES', 'PARTS', 'ENGRAVED', 'ARCANE', 'TOWER'], ['GOLEM CORE', 'PARTS', 'CONSTRUCT', 'ANIMATE', 'FOUNDRY'],
      ['SKYFORGE PARTS', 'PARTS', 'CONSTRUCT', 'ASTRAL', 'SKY CITY'], ['TITAN PLATE', 'PARTS', 'COLOSSUS', 'DIVINE', 'TITAN GRAVE']] },
  relic: { name: 'RELIC', prof: 'relic', icon: ['ne_relic_0', 'ne_relic_2', 'ne_relic_3', 'ne_relic_4', 'ne_relic_5', 'ne_relic_6', 'ne_relic_7', 'ne_relic_8', 'ne_relic_9', 'ne_relic_10'],
    mats: [['RELIC FRAGMENT', 'ARTIFACT', 'FRAGMENT', 'OLD', 'RUIN', 'relic_fragment'], ['CRACKED IDOL', 'ARTIFACT', 'IDOL', 'OLD', 'SHRINE'], ['RUNE TABLET', 'SCRIPT', 'TABLET', 'ARCANE', 'LIBRARY'], ['SPIRIT URN', 'ARTIFACT', 'VESSEL', 'HAUNTED', 'TOMB'],
      ['CROWN SHARD', 'ARTIFACT', 'REGALIA', 'ROYAL', 'THRONE'], ['STAR CHART', 'SCRIPT', 'SCROLL', 'ASTRAL', 'OBSERVATORY'], ['EMBER CODEX LEAF', 'SCRIPT', 'TOME', 'VOLATILE', 'FORGE TEMPLE'], ['FROZEN RELIQUARY', 'ARTIFACT', 'VESSEL', 'COLD', 'ICE VAULT'],
      ['VOID PRISM', 'ARTIFACT', 'FOCUS', 'ABYSSAL', 'RIFT'], ['FIRST LANTERN GLASS', 'ARTIFACT', 'FOCUS', 'DIVINE', 'DAWN TEMPLE']] },
  fiber: { name: 'FIBER', prof: 'cultivation', icon: ['ne_reagent_0', 'ne_reagent_1', 'ne_reagent_2', 'ne_reagent_3', 'ne_reagent_4', 'ne_reagent_5', 'ne_reagent_6', 'ne_reagent_7', 'ne_reagent_8', 'ne_reagent_8'],
    mats: [['FIELD FIBER', 'PLANT FIBER', 'STALK', 'COARSE', 'FARM', 'field_fiber'], ['FLAX', 'PLANT FIBER', 'STALK', 'FINE', 'FARM'], ['COTTON BOLL', 'PLANT FIBER', 'BOLL', 'SOFT', 'LOWLAND'], ['SPIDER SILK', 'ANIMAL FIBER', 'SILK', 'STRONG', 'CAVE'],
      ['WOOL TUFT', 'ANIMAL FIBER', 'WOOL', 'WARM', 'HIGHLAND'], ['MOONWEAVE', 'SPIRIT FIBER', 'THREAD', 'LUNAR', 'FEYWILD'], ['FLAMESILK', 'SPIRIT FIBER', 'SILK', 'FIREPROOF', 'ASHLAND'], ['RIMEWOOL', 'ANIMAL FIBER', 'WOOL', 'COLD', 'TUNDRA'],
      ['STARTHREAD', 'SPIRIT FIBER', 'THREAD', 'ASTRAL', 'SPIRE'], ['HALO SILK', 'SPIRIT FIBER', 'SILK', 'DIVINE', 'CELESTIAL']] },
  beast: { name: 'BEAST PARTS', prof: 'beast_lore', icon: ['px_bone', 'px_fang', 'px_bone', 'px_fang', 'px_skull', 'px_fang', 'px_bone', 'px_skull', 'px_fang', 'px_skull'],
    mats: [['BONE DUST', 'REMAINS', 'BONE', 'POWDER', 'UNDEAD', 'bone_dust'], ['WOLF FANG', 'TROPHY', 'TOOTH', 'SHARP', 'BEAST'], ['BAT WING', 'TROPHY', 'WING', 'LIGHT', 'BEAST'], ['VENOM SAC', 'ORGAN', 'GLAND', 'TOXIC', 'MONSTROSITY'],
      ['TROLL BLOOD', 'ORGAN', 'BLOOD', 'REGENERATIVE', 'GIANT'], ['IMP HORN', 'TROPHY', 'HORN', 'INFERNAL', 'FIEND'], ['PHOENIX ASH', 'REMAINS', 'ASH', 'VOLATILE', 'CELESTIAL'], ['FROST WYRM TOOTH', 'TROPHY', 'TOOTH', 'COLD', 'DRAGON'],
      ['ELDER EYE', 'ORGAN', 'EYE', 'ABERRANT', 'ABERRATION'], ['DRAGON HEART', 'ORGAN', 'HEART', 'DIVINE', 'DRAGON']] },
};
const MAT_TIER_START = [1, 3, 6, 8, 11, 13, 16, 18, 21, 23]; // first gear tier each material slot covers
const MATERIALS = [];
for (const [fk, f] of Object.entries(MAT_FAMILIES)) {
  f.mats.forEach(([name, cls, sub, type, subtype, existing], i) => {
    const tier = MAT_TIER_START[i], tierMax = (MAT_TIER_START[i + 1] || 24) - 1;
    const lvl = GEAR_TIER_MIN[tier - 1], grade = 1 + Math.floor(i * 8 / 9); // rarity grade 1-9
    const id = existing || `m_${fk}_${i}`;
    const m = { id, name, family: fk, familyName: f.name, cls, sub, type, subtype, tier, tierMax, lvl, grade, prof: f.prof, slot: i };
    MATERIALS.push(m);
    if (!ITEMS[id]) ITEMS[id] = { name, icon: f.icon[i] || f.icon[0], type: 'mat', price: Math.round(4 * Math.pow(tier, 1.6)), rarity: grade - 1, desc: '' };
    ITEMS[id].mat = m; ITEMS[id].rarity = grade - 1;
    ITEMS[id].desc = `${f.name} > ${cls} > ${sub} > ${type} > ${subtype}. Tier ${tier}-${tierMax}, level ${lvl}+.`;
  });
}
const MAT_BY_ID = Object.fromEntries(MATERIALS.map(m => [m.id, m]));
const matOf = (family, tier) => MATERIALS.filter(m => m.family === family && m.tier <= tier).pop();
const PROF_FAMILY = { herb: 'herb', mining: 'ore', forestry: 'wood', hidecraft: 'hide', fish: 'fish', salvaging: 'salvage', relic: 'relic', cultivation: 'fiber', beast_lore: 'beast' };
// the best material this profession can gather here: zone level and profession skill both gate it
function gatherMaterial(prof, zoneLvl, skill) {
  const fam = PROF_FAMILY[prof]; if (!fam) return null;
  const ok = MATERIALS.filter(m => m.family === fam && m.lvl <= zoneLvl + 5 && m.lvl <= Math.max(1, skill));
  return ok.length ? ok[ok.length - 1] : MATERIALS.find(m => m.family === fam);
}

// ---------------------------------------------------------------- tiered recipes (blueprints) 1-720
const POTENCY = ['MINOR', 'LESSER', 'PLAIN', 'STRONG', 'GREATER', 'SUPERIOR', 'POTENT', 'MAJOR', 'GRAND', 'EXALTED', 'HEROIC', 'EPIC',
  'MYTHIC', 'FABLED', 'ANCIENT', 'PRIMAL', 'ASTRAL', 'CELESTIAL', 'ETERNAL', 'DIVINE', 'GODLY', 'AETHERIC', 'DAWN'];
const CRAFT_PLAN = {
  alch:        { needs: [['herb', 3], ['beast', 1]], make: t => ({ name: `${POTENCY[t - 1]} ELIXIR`, icon: 'item_tonic', type: 'use', heal: `${t + 1}d8+${t * 3}`, combat: true, desc: `Heal ${t + 1}d8+${t * 3}.` }) },
  cook:        { needs: [['fish', 2], ['herb', 1]], make: t => ({ name: `${POTENCY[t - 1]} FEAST`, icon: 'px_fishcooked', type: 'use', heal: `${t + 1}d6+${t * 2}`, buff: 'fed', desc: `Heal ${t + 1}d6+${t * 2}, WELL FED.` }) },
  tailoring:   { needs: [['fiber', 3], ['herb', 1]], make: t => ({ name: `${POTENCY[t - 1]} BANDAGE`, icon: 'ne_misc_2', type: 'use', heal: `${t + 1}d10`, combat: true, desc: `Heal ${t + 1}d10.` }) },
  leatherwork: { needs: [['hide', 3], ['wood', 1]], make: t => ({ name: `${POTENCY[t - 1]} ARMOR KIT`, icon: 'ne_tool_1', type: 'use', buff: ['fortify', 'focus', 'ac'][t % 3], combat: true, desc: 'Field armour kit: a defensive buff.' }) },
  enchanting:  { needs: [['relic', 2], ['beast', 1]], make: t => ({ name: `${POTENCY[t - 1]} RUNE OIL`, icon: 'ne_potion_5', type: 'use', buff: ['might', 'haste', 'foresight', 'bless'][t % 4], combat: true, desc: 'Weapon rune oil: an offensive buff.' }) },
  jewelcraft:  { needs: [['ore', 2], ['relic', 1]], gear: 'wondrous', label: 'TRINKET' },
  blacksmith:  { needs: [['ore', 3], ['wood', 1], ['salvage', 1]], gear: 'any', label: 'FORGEWORK' },
  armorsmith:  { needs: [['ore', 3], ['hide', 2]], gear: 'armor', label: 'ARMOR' },
  weaponsmith: { needs: [['ore', 3], ['wood', 2]], gear: 'weapon', label: 'WEAPON' },
};
for (const [prof, plan] of Object.entries(CRAFT_PLAN)) {
  for (let t = 1; t <= 23; t++) {
    const lvl = GEAR_TIER_MIN[t - 1], id = `t_${prof}_${t}`, more = Math.floor(t / 8);
    const needs = {}; for (const [fam, n] of plan.needs) { const m = matOf(fam, t); needs[m.id] = (needs[m.id] || 0) + n + more; }
    let makes = id;
    if (plan.gear) ITEMS[id] = { name: `${ITEM_RANKS[t - 1].name} ${plan.label}`.slice(0, 22), icon: { wondrous: 'ne_ring_' + Math.min(8, Math.floor(t / 3)), armor: 'ne_heavyarmor_' + Math.min(13, Math.floor(t / 2)), weapon: 'ne_sword_' + Math.min(8, Math.floor(t / 3)), any: 'ne_shield_' + Math.min(10, Math.floor(t / 2)) }[plan.gear], type: 'gearbp', price: 0, desc: `Forges a tier ${t} ${plan.label.toLowerCase()} (item level ${lvl}).` };
    else ITEMS[id] = Object.assign({ price: Math.round(12 * Math.pow(t, 1.5)) }, plan.make(t));
    RECIPES.push({ id, prof, name: ITEMS[id].name, skill: Math.max(1, lvl), needs, makes, tier: t, gear: plan.gear ? { kind: plan.gear, lvl } : null });
  }
}
// craft(): gear blueprints forge a real item of the blueprint's tier
{
  const craft0 = craft;
  craft = function (rec) {
    if (!rec || !rec.gear) return craft0(rec);
    if (!G.blueprints.includes(rec.id)) return 'You have not learned that recipe blueprint.';
    if (G.prof[rec.prof] < rec.skill) return `Need ${PROFS[rec.prof]} ${rec.skill}.`;
    const reduction = Math.floor(profTalentRank(rec.prof, 'efficiency') / 24);
    const needs = Object.fromEntries(Object.entries(rec.needs).map(([k, q]) => [k, Math.max(1, q - reduction)]));
    for (const k in needs) if ((G.inv[k] || 0) < needs[k]) return 'Missing materials.';
    if ((G.bag || []).length >= (typeof BAG_MAX !== 'undefined' ? BAG_MAX : 40)) return 'Your bag is full.';
    const kept = R() < perkVal(rec.prof, 'save');
    if (!kept) for (const k in needs) for (let i = 0; i < needs[k]; i++) takeItem(k);
    const kinds = rec.gear.kind === 'any' ? ['weapon', 'armor'] : [rec.gear.kind];
    let rar = Math.max(1, rollRarity(rec.gear.lvl));
    if (R() < perkVal(rec.prof, 'extra') + profTalentRank(rec.prof, 'mastery') / 2400) rar = Math.min(RARITY.length - 1, rar + 1);
    const it = makeItem({ kind: pick(kinds), lvl: rec.gear.lvl + Math.floor(R() * 5), rarity: rar });
    it.crafted = G.name;
    addGear(it); G.stats.crafted++;
    const up = gainProf(rec.prof, rec.skill); progressProfessionQuest(rec.prof, 'craft', 1);
    const note = perkAfterWork(rec.prof);
    return `Forged ${it.name}!${kept ? ' Materials kept!' : ''}${note ? ' ' + note : ''}${up ? ` ${PROFS[rec.prof]} ${G.prof[rec.prof]}` : ''}`;
  };
}
const CRAFT_PROFS = ['ALL', 'alch', 'cook', 'tailoring', 'leatherwork', 'enchanting', 'jewelcraft', 'blacksmith', 'armorsmith', 'weaponsmith'];
function craftList(pf) { const k = CRAFT_PROFS[pf || 0]; return k === 'ALL' ? RECIPES : RECIPES.filter(r => r.prof === k); }
