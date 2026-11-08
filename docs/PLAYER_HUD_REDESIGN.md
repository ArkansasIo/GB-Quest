# Player HUD redesign

The browser game now includes a responsive dark-fantasy DOM HUD layer. The original 160×144 canvas renderer remains intact; the HUD is a separate overlay so the legacy game loop and save format are not rewritten.

## Source files

- `src/player_hud.js` — mounts the HUD, reads the live `GBQ.G` character state, updates vitals/resources/party/quest/location data, and routes navigation buttons into existing game scenes.
- `client/player-hud.css` — responsive black-steel, bronze, and gold visual system with desktop and mobile layouts.
- `index.html` — loads the stylesheet and HUD module after the game entry point.

## HUD regions

- Top bar: game identity, compass, currency.
- Left rail: player portrait placeholder, level, health, mana, XP, and party frames.
- Right rail: zone map panel, coordinates, and active quest summaries.
- Bottom rail: character, inventory, skills, talents, crafting, map, journal, guild, market, collection, and eight action slots.

## Integration notes

The HUD is read-only with respect to player progression. It polls the live state at a low frequency and does not alter stats, inventory, equipment, quests, or saves. Navigation buttons reuse existing scene constructors and the existing world atlas. The legacy canvas HUD and its renderer remain available as a fallback.

## Live gameplay integration

- During combat, the HUD reads the active battle's authoritative hotbar entries through `window.GBQCombatHotbar`; action buttons invoke the battle's existing `useHotbar` method, preserving target selection, resource costs, cooldowns, and combat rules. Unavailable actions are disabled.
- In the overworld, `window.GBQWorldMapMini` exposes a read-only snapshot of the current `Field` map rows, player tile coordinates, region name, and nearby entity markers. The HUD draws that snapshot to its minimap canvas and updates the location/coordinate labels from the same source.
- The bridge functions are read-only except for the explicit hotbar `use(index)` action. They do not add a parallel combat or map state model.

- In real-time combat, hotbar entries expose remaining cooldown and global-cooldown ticks from the active battle. The HUD shows a seconds overlay and disables unavailable or paused actions; the battle engine remains authoritative for activation.

## Interactive minimap

- Zoom controls scale the visible tile window around the player; the center control resets to the default player-centered view.
- Clicking a tile inspects its coordinates; clicking a marker reports its name/type and coordinates. Markers are sourced from the current field's live entity list and remain informational; gameplay interactions continue through the existing world controls.
- Marker snapshots include display names where the world entity provides them. The HUD does not teleport the player or mutate world state from map clicks.


## HUD hardening — November 2026

- Quest rail now excludes completed, inactive, and done entries before selecting the visible objectives.
- XP progress normalizes the level-threshold values returned by the progression helper before calculating the bar.
- Scene navigation catches constructor/push failures and gives the player a visible, non-blocking unavailable-menu message rather than interrupting the game loop.
- Hotbar activation validates the live combat entries before dispatch and preserves the authoritative combat bridge as the only activation path.
- Responsive keyboard focus is retained when a hotbar refresh rebuilds its button markup; focus is not moved when the user was interacting elsewhere.
- Added visible keyboard focus treatment and minimum touch targets for minimap controls.

## Live combat profile panel — November 2026

- Added a compact HUD combat profile with armor class, weapon damage, weapon hit bonus, average equipped item level, and equipped-slot count.
- Values are read from the existing `derive(G)` result and current `G.eq` loadout. The HUD does not calculate combat outcomes or modify equipment.
- Empty slots and missing optional stat values render as zero; item level averages only equipped items with a positive item-level value.


## Live character attributes panel — November 2026

The player HUD now renders STR, DEX, CON, INT, WIS, CHA, LCK, WIL, and SPD with each score and its signed modifier. Values are read from the existing `derive(G).A` and `derive(G).M` rules outputs; the HUD does not calculate or persist a parallel character sheet. The panel uses a compact three-column desktop grid and is hidden on narrow mobile layouts to preserve the gameplay viewport. A source-level regression test checks all nine bindings and the rules bridge.


## Weapon damage display correction — November 2026

The combat profile now displays the equipped weapon's damage dice and its signed additive damage modifier together (for example, `1d8 + 4`). The value is sourced directly from `derive(G).weapon`; the HUD does not roll damage or change combat resolution.


## Full combat character sheet — November 2026

The character sheet now has a dedicated sixth **COMBAT** page. It reads directly from the existing `derive(G)` combat profile and presents weapon name, weapon damage dice, flat damage bonus, attack hit modifier, attacks per turn, armor class, initiative, critical range/chance/damage, dodge, block, lifesteal, and haste. The page uses the existing up/down scrolling behavior to expose all 14 values on the compact game viewport. The previous FEATURES page remains intact as page five.


## Bag gear inspection and comparison — November 2026

Selecting a gear item in the inventory now previews its item level, equipment slot, rarity/affix description, and a comparison against the item currently equipped in that slot. The comparison reuses the existing `itemScore` heuristic and labels the candidate as an upgrade, downgrade, sidegrade, or empty-slot fit. This is an informational preview only; equipment changes still occur through the existing equip action.


## Equipment condition and set progress — November 2026

The equipment paper-doll view now reports set-piece progress for the selected equipped item when its item data carries a `setId`/`set` (including template metadata). It also displays durability as a percentage when both current and maximum durability are available, otherwise it explicitly shows that durability is not tracked for that item. Attunement remains visible. These are read-only summaries; existing equip and item rules are unchanged.


## Equipment set management — November 2026

The existing loadout manager now supports overwriting a saved equipment set with the currently equipped items and renaming saved sets using role/activity presets (Damage, Tank, Healer, Dungeon, Raid, PvP, Farm, and custom labels). Existing five-set capacity, stable item-UID snapshots, bank/bag lookup, missing-piece reporting, and battle equip restrictions are retained. Regression tests cover UID snapshots, locating pieces across equipped/bag/bank inventories, and the management actions.


## Loadout stat preview — November 2026

Selecting a saved equipment set now opens a comparison before applying it. The preview calculates current versus planned AC, weapon attack modifier, weapon damage expression/modifier, and maximum HP using a separate equipment-map copy. It reports how many saved pieces are found and lists missing pieces. Players must explicitly choose APPLY LOADOUT; CANCEL leaves the live equipment unchanged. This is a preview, not a guarantee that every item will equip: the existing equip validation remains authoritative during application and rejected pieces are reported.


## Expanded loadout comparison — November 2026

The equipment-set preview now presents its full comparison as a readable message before the separate APPLY LOADOUT / CANCEL prompt, rather than truncating the comparison inside a short menu description. In addition to AC, attack, weapon damage, and maximum HP, it compares critical chance, dodge, block, lifesteal, haste, total resistance, fire/cold/lightning elemental values, and the HIT/DMG gear substats. Preview values are derived from the target equipment map without changing the live character; existing equip restrictions remain authoritative when applying.


## Per-item loadout bonus sources — November 2026

The saved-loadout review now includes an equipped-item source breakdown. Each occupied target slot reports the item's ordinary affixes and, when available in the current game build, its gem bonuses, rune bonuses, and tier implicit modifiers. Each entry is labelled by source so players can identify which item supplies a stat. This is an item-level modifier breakdown; character-wide ascension, companion bond, talent, buff, and armor-set contributions are not attributed to individual gear pieces.


## Inventory item comparison — November 2026

Bag gear now offers a COMPARE action alongside equip, sell, auction and drop. The comparison derives the character's current stats and a target stat sheet using a copied equipment map with the selected item placed in its slot. It reports changes to AC, attack, weapon damage, maximum HP, critical chance, dodge, block, lifesteal, haste and total resistance, then lists the selected item's ordinary affixes, socketed gem bonuses, rune bonuses and tier implicit modifiers. The comparison is read-only: it does not equip, remove, sell or otherwise mutate the selected item or character equipment. Existing actions retain their own menu positions after COMPARE is inserted.


## Vendor and auction gear purchase previews — November 2026

Vendor-generated gear and blacksmith/armorsmith purchases now display a character-stat comparison and gold-after-purchase estimate before the final BUY confirmation. Auction-house gear listings show the same comparison, seller, and asking price before the purchase action is invoked. These previews calculate the candidate item against a copied equipment map and do not equip it. Consumable/material auction listings retain their existing direct purchase confirmation because they do not occupy an equipment slot. Existing purchase validation (including available gold, bag capacity, listing availability, and server-side market checks) remains authoritative.


## Unified gear inspection metadata — November 2026

Inventory gear descriptions now include the equipment slot, rarity/item level, upgrade score context, set identity and equipped-piece count, durability when durability data exists, gem/rune socket occupancy versus capacity, attunement, and armor-class metadata when present. Vendor-generated gear and auction gear previews expose the same item identity, set, condition, socket, and attunement details before purchase confirmation. Socket capacity is obtained from the existing gem/rune systems; absent durability is shown as unavailable rather than inferred. Existing stat previews and purchase validation remain unchanged.


## Legendary set progression and activation previews — November 2026

Added `legendarySetPreview` to the armory rules. It compares equipped set counts with the projected equipment after replacing the candidate item's slot, and reports the 2-piece and 3-piece thresholds, bonus stats, current activation, and newly unlocked thresholds. Inventory inspection and gear comparison display the progression; vendor/blacksmith and auction purchase previews show the same thresholds before purchase confirmation. The preview is read-only and does not equip items or change character stats. Existing set effects continue to be applied by `armorSetBonus` through the gear-affix derivation path.


## Shadows of the Abyss visual pass — November 2026

- Applied a dark stone, moss, and aged-brass visual treatment to the DOM HUD in `client/player-hud.css`, based on the supplied GB Quest dark-fantasy boards.
- Reworked panel surfaces with layered stone-like gradients, inset bevels, fine borders, and restrained brass highlights.
- Updated the crest, player portrait frame, vitals meters, minimap frame, stat cells, navigation controls, hotbar, and toast treatment as one consistent visual system.
- Preserved the existing HUD DOM structure, data bindings, game-scene navigation, minimap bridge, combat hotbar bridge, and 160×144 gameplay renderer.
- Added visible keyboard focus styling and hover feedback while respecting reduced-motion preferences.
- This pass uses CSS-rendered finishes; it does not claim that individual sprites have been extracted from the supplied catalog boards or installed as runtime assets.
