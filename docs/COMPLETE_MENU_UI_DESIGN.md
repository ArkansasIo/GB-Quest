# Complete menus and submenus UI design

## Full interface coverage

| Area | Screens and nested surfaces |
|---|---|
| Front end | Boot, title, continue/new/load, save-slot actions, story library, online realm, account, extras, credits |
| Character | Overview, attributes, saving throws, skills, features, paper doll, equipment slots, compare, appearance and wardrobe |
| Items | Inventory bags, consumables, materials, quest items, item actions, bank, stash, heirlooms, loadouts, mounts |
| Combat | Spellbook, schools, active/passive skills, combat arts, talent trees, growth choices, class/subclass choices, rest |
| World | World map, expansion maps, minimap, quest journal, activity finder, dungeon/raid selection, bestiary, boss journal |
| Crafting | Profession selection, recipe lists, recipe details, blueprints, materials, crafting confirmations |
| Economy | Vendors, repair, auction house, listing, buying, selling, currency and reward prompts |
| Community | Party, friends, guild, reputation, titles, achievements, leaderboard, realm browser |
| System | Settings categories, UI themes, palette, video, audio, key bindings, chat settings, accessibility, debug and admin panels |
| Narrative | NPC dialogue, speaker plaques, quest accept/turn-in, confirmations, reward and loot pop-ups |
| Secrets | Secret archive, hidden-world journal, discovery detail pages and unlock prompts |

## Visual system

- Panel chrome: double-edge frame, corner rivets, short class/race accent rails and consistent inner spacing.
- Hierarchy: page header, section heading, tab strip, content panel, detail panel and footer hint.
- Selection: high-contrast row fill, narrow class-colour rail and race-colour selector mark.
- Tabs: active/inactive states use class and heritage colours; page navigation remains on existing inputs.
- Items: rarity remains the semantic colour; class/race accents are secondary framing, not a replacement for rarity.
- Modals: action and confirmation lists share a compact selector, divider rules, selected-row treatment and scroll indicators.
- Dialogue: existing dialogue and NPC logic is retained; speaker plaques and message windows inherit the common panel frame.
- Scrollbars: shared list scenes use class/race accent rails.
- Accessibility: monochrome palettes bypass RGB decoration; selected states retain shape/position cues. No new input actions are introduced.

## Implementation

The new ui_menu_chrome module wraps the shared frame, header, choice-list and reusable list-scrollbar primitives after the class/race identity module. Existing 8-BIT MMO choice rendering remains intact. Other themes receive the shared modal treatment. Game-specific menu draw/update methods remain the source of truth for their content and behavior.

## Validation

The Node test checks the declared surface inventory and component kit. Existing game tests and the browser bundle build run in CI.
