# Aelmoor Equipment Expansion

The browser game already has a shared equipment pipeline. This expansion adds 16 original weapon bases and 12 original body-armour bases to that pipeline rather than introducing a second inventory implementation.

## Added weapons

| Name | Weapon family | Damage type |
|---|---|---|
| Dawncleaver | Sword | Radiant |
| Kingsfall | Sword | Slashing |
| Gravewhisper | Dagger | Necrotic |
| Moonshard | Dagger | Cold |
| Embermaul | Hammer | Fire |
| Titanwake | Axe | Thunder |
| Skybreaker | Polearm | Lightning |
| Briarshot | Bow | Piercing |
| Starfall | Crossbow | Force |
| Stormglass | Wand | Lightning |
| Wintertide | Staff | Cold |
| Sunspire | Staff | Radiant |
| Duskfang | Sword | Necrotic |
| Worldroot | Mace | Bludgeoning |
| Voidreaver | Scythe | Force |
| Runebinder | Grimoire | Psychic |

## Added armour bases

Dawnforged Cuirass, Graveveil Raiment, Frostbound Mail, Ashen Tyrant Plate, Voidstalker Leathers, Stormcaller Vestments, Thornheart Hide, Ironclad Bulwark, Starfall Battle Robe, Eclipse Reaver Armour, Emberguard Scale, and Moonwoven Silks.

The entries are ordinary valid bases in the existing WEAPONS and ARMORS registries. They inherit the current rarity generation, item-level scaling, affixes, equipment comparisons, durability, socket, rune, enchantment, save and wardrobe behavior.

## Existing progression retained

The game already includes 14 weapon subclasses, four armour weight classes, class proficiency gates, armour-weight set bonuses, the Crypt Warden / Forgefire / Rime Throne / Long Night three-piece sets, gems, runes, weapon mastery, and the action-RPG aspect / temper / masterwork pipeline. This expansion deliberately reuses those systems.

## Interface direction

src/ui_mmo.js now defaults new installs to TNL HANDHELD, a Pokémon Classic handheld layout with a deep navy, steel-blue and brass palette. POKEMON CLASSIC remains selectable: a compact handheld-style 160×144 HUD, portrait and vitals frame, minimap, five-slot action strip, roomy choice panels, triangle selection cursor, and a right-side main menu. The separate TNL systems are loaded by src/tnl_systems.js; they provide weapon mastery, Amitoi expeditions, day/night and morph progression. The catalog load is placed after src/armory.js so it extends the same registries used by the live gear rules.

## Validation notes

This is a data expansion, not a claim that every named item has bespoke sprite art or is a guaranteed boss drop. Item bases use the existing family/tier art resolver and normal loot generation. New bespoke set drops and dedicated artwork should be integrated as a separate, testable loot-content pass.
