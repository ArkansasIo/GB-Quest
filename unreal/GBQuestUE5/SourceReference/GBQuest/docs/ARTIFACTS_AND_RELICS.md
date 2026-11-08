# Artifacts and Relics

## Scope

The equipment system has two additional dedicated slots: **Artifact** and **Relic**. A character may equip one item in each slot at a time. They are implemented as `wondrous` gear so they use the established item pipeline rather than a parallel item format.

- **Artifact slot:** 42 named masterwork objects, engines, books, crowns, tools and arcane devices.
- **Relic slot:** 42 named ancient remnants, seals, idols, tokens and fragments.
- **Total:** 84 original item bases.
- **Progression:** item level 1–720, existing gear rank, rarity, affixes, enhancement and attunement rules.
- **Stat effects:** base bonus families use the current supported wondrous-item effects: HP, AC, saving throws, primary ability, hit and initiative. Rolled affixes add the normal substats.
- **Compatibility:** items remain `kind: 'wondrous'` with a dedicated `slot` value of `artifact` or `relic`. Existing saves and trade serialization therefore continue to use the same item schema.

## Relics (42)

| # | Relic | Base effect |
|---:|---|---|
| 01 | ASHEN HEART | HP |
| 02 | VEILSTONE | AC |
| 03 | MOONFALL SEAL | SAVE |
| 04 | THORNBOUND IDOL | ABILITY |
| 05 | EMBER VESSEL | HIT |
| 06 | FROSTWORN SIGIL | INITIATIVE |
| 07 | HOLLOW CROWN | HP |
| 08 | TIDEBORN EYE | AC |
| 09 | GRAVESONG TOKEN | SAVE |
| 10 | STORMGLASS CORE | ABILITY |
| 11 | WOLF-KING TOTEM | HIT |
| 12 | DAWN SHARD | INITIATIVE |
| 13 | NIGHTWARDEN'S MARK | HP |
| 14 | ROOTS OF YSRA | AC |
| 15 | SHATTERED HOUR | SAVE |
| 16 | SABLE COMPASS | ABILITY |
| 17 | WRAITHBONE CHARM | HIT |
| 18 | SUNKEN STAR | INITIATIVE |
| 19 | IRON OATH RELIC | HP |
| 20 | GLOAMING LENS | AC |
| 21 | SERPENT'S MEMORY | SAVE |
| 22 | SKYFIRE EMBER | ABILITY |
| 23 | WINTER'S LAST BREATH | HIT |
| 24 | DUSKWARDEN SEAL | INITIATIVE |
| 25 | BLOODMOON IDOL | HP |
| 26 | WHISPERING FANG | AC |
| 27 | ANCIENT WAYSTONE | SAVE |
| 28 | RAVEN QUEEN'S EYE | ABILITY |
| 29 | FALLEN SAINT'S VOW | HIT |
| 30 | DEEPWATER PEARL | INITIATIVE |
| 31 | CINDERHEART | HP |
| 32 | PALE ORACLE | AC |
| 33 | THUNDERBIRD FEATHER | SAVE |
| 34 | OBSIDIAN TEAR | ABILITY |
| 35 | ETERNAL ASH | HIT |
| 36 | WILDHUNT HORN | INITIATIVE |
| 37 | SILENT BELL | HP |
| 38 | STARLESS MIRROR | AC |
| 39 | DRAGON'S REMNANT | SAVE |
| 40 | AETHER SEED | ABILITY |
| 41 | KINGDOM'S LAST LIGHT | HIT |
| 42 | WORLDROOT KNOT | INITIATIVE |

## Artifacts (42)

| # | Artifact | Base effect |
|---:|---|---|
| 01 | AEGIS OF THE FIRST DAWN | HP |
| 02 | CROWN OF ASHES | AC |
| 03 | LANTERN OF LOST KINGS | SAVE |
| 04 | CHRONICLE OF ECHOES | ABILITY |
| 05 | ASTRAL NAVIGATOR | HIT |
| 06 | HEART OF THE DEEP | INITIATIVE |
| 07 | SUNSPIRE DIADEM | HP |
| 08 | NIGHTGLASS PRISM | AC |
| 09 | TOME OF THE VEILED PATH | SAVE |
| 10 | CITADEL ENGINE | ABILITY |
| 11 | PHOENIX VESSEL | HIT |
| 12 | ORRERY OF AGES | INITIATIVE |
| 13 | MANTLE OF THE FIRST WARDEN | HP |
| 14 | SOULFORGE RELIQUARY | AC |
| 15 | STARFALL SCEPTER | SAVE |
| 16 | GATEKEEPER'S KEY | ABILITY |
| 17 | TEMPEST CATALYST | HIT |
| 18 | EVERFROST MIRROR | INITIATIVE |
| 19 | GARDEN OF WORLDS | HP |
| 20 | OBELISK OF OATHS | AC |
| 21 | DRAGONFIRE LENS | SAVE |
| 22 | VOIDWALKER'S COMPASS | ABILITY |
| 23 | HALLOWED HOURGLASS | HIT |
| 24 | EMBERTHRONE SEAL | INITIATIVE |
| 25 | MOONWEAVER LOOM | HP |
| 26 | THRONE OF TIDES | AC |
| 27 | GRIMOIRE OF THE NINE | SAVE |
| 28 | SKYBOUND STANDARD | ABILITY |
| 29 | DREAD EMPEROR'S MASK | HIT |
| 30 | LIFEBLOOM CHALICE | INITIATIVE |
| 31 | WORLD'S EDGE SHARD | HP |
| 32 | PRISM OF MANY SUNS | AC |
| 33 | SOUL ANCHOR | SAVE |
| 34 | WINDCALLER'S HARP | ABILITY |
| 35 | INFINITE COFFER | HIT |
| 36 | ARCHON'S SIGIL | INITIATIVE |
| 37 | VEILBREAKER TORCH | HP |
| 38 | FATE-SPINNER'S WHEEL | AC |
| 39 | DAWNBRINGER RELIQUARY | SAVE |
| 40 | ECLIPSE ENGINE | ABILITY |
| 41 | CROWN OF THE LAST STAR | HIT |
| 42 | AETHERION CORE | INITIATIVE |

## Equipment rules

1. Artifact and Relic are independent slots; equipping one does not replace the other.
2. Each slot accepts only its own category. Existing ring, neck, head, back and other wondrous gear remain in their original slots.
3. Items retain the existing maximum of three simultaneously attuned items. An item that requires attunement cannot be equipped when that limit is reached.
4. Item level and rarity are rolled by the common loot generator. The new base catalog does not bypass the game's level, rarity or affix systems.
5. The character equipment screen and equipment selection list expose both new slots. The character overview lists them alongside the original twelve slots.

## Implementation notes

Definitions live in `src/data_rules.js` in the `WONDROUS` catalog. Slot definitions are in `SLOTS`, `SLOT_NAME`, `SLOT_ICON` and `SLOT_COLS`. Item creation and slot resolution remain in `src/gen.js`; equip validation and stat derivation remain in `src/rules.js`. The visible paper-doll and equipment list are in `src/scenes_menu.js`.
