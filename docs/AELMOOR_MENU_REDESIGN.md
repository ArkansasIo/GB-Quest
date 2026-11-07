# Aelmoor Menu Suite — UI Redesign Specification

**Game:** GB Quest: Lost Kingdom of ShadowBane Chronicles — Lanterns of Aelmoor  
**Reference:** supplied nine-screen Aelmoor Menu Suite (1536×1024 source sheet)  
**Target:** HTML5 browser build, with the existing 160×144 game framebuffer preserved.

## Visual direction

- Full-colour moonlit fantasy pixel art: deep indigo/violet sky, luminous purple moon, dark castle silhouette, saturated forest greens and warm lantern gold.
- UI panels use near-black plum/navy fills, double gold borders, corner studs and restrained ornamental flourishes.
- Primary text is warm ivory; selected actions use a bright gold outline and high-contrast fill.
- Preserve crisp nearest-neighbour rendering for pixel art. Do not blur or stretch pixel assets.
- Keep the game framebuffer and its controls inside the game viewport. Menus must never render outside the game surface or overlap browser/itch.io page chrome.

## Screen mapping

| Reference screen | Runtime destination | Required behaviour |
|---|---|---|
| 01 Title | `Title` in `src/scenes_world.js` | New Game, Continue (only when a save exists), Load Game, Options, Credits, Quit |
| 02 Options | `SettingsScene` | Category navigation, current values, confirm/back/reset |
| 03 Graphics | Graphics subsection of `SettingsScene` | Resolution, display mode, V-Sync, pixel filter, UI scale, brightness |
| 04 New Game | `SlotPicker('new')` / character creator | Character, appearance, name and confirmation steps |
| 05 Class Selection | Character creator class step | Class carousel/grid, stats preview and class description |
| 06 Character Summary | Character creator final step | Preview, origin, derived stats and Begin Adventure |
| 07 Load Game | `SlotPicker('load')` | Save-slot preview, load/back/delete |
| 08 Credits | `Credits` | Scrollable credits, controller/keyboard back |
| 09 Quit | `Title` quit confirmation | Yes/No; browser build explains that the tab can be closed |

## Layout and scaling contract

1. Keep the internal framebuffer at 160×144 unless the rendering engine is deliberately upgraded as a separate task.
2. Fit the framebuffer proportionally inside the available game viewport; never use independent X/Y scaling.
3. Use integer scaling when the viewport permits it. If it does not, retain aspect ratio and centre the image with letterboxing.
4. Treat the reference sheet as a visual target, not as a single background texture to shrink into the 160×144 framebuffer. Rebuild its panels, borders and text using the existing drawing primitives and game data.
5. At desktop sizes, keep the menu panel within the framebuffer safe area. At narrow/mobile sizes, scale the whole game surface rather than moving menu controls outside it.
6. Maintain safe margins around text, selected rows, scrollbars and footer hints. Long labels must be clipped or wrapped, not collide with neighbouring values.
7. Keyboard, gamepad and touch must use the same selection state. A confirms, B backs out, arrows/D-pad navigate; browser quit never attempts to close a tab without permission.

## Existing implementation touchpoints

- `src/scenes_world.js`: `Title`, character-creation flow, `SlotPicker`, `Credits`.
- `src/scenes_menu.js`: `SettingsScene` and reusable menu list patterns.
- `src/engine.js`: 160×144 framebuffer, image scaling and display-mode handling.
- `src/ui_dark.js`: existing Sanctum theme; use as a foundation for the gold/plum palette rather than introducing a competing drawing system.
- `tools/build-itch.cjs`: standalone HTML5 packaging.

## Asset integration status

The nine uploaded screen crops and source sheet are currently a **conversation-side reference pack**. This specification does not claim that those PNGs have been committed to Git, loaded by the game, or included in the itch.io ZIP. Before runtime integration, add the PNGs under `assets/aelmoor_menu/`, add them to the standalone builder's asset manifest, and verify each path in both the development and embedded HTML5 builds.

## Acceptance checklist

- [ ] All nine menu destinations are reachable and return correctly.
- [ ] New Game, Continue, Load Game, Options, Credits and Quit preserve existing game/save behaviour.
- [ ] Graphics settings persist and match the actual rendering behaviour; unsupported options are not shown as functional.
- [ ] No panel, label, selection highlight or footer hint clips or overlaps at supported viewport sizes.
- [ ] Pixel art remains crisp; aspect ratio is preserved.
- [ ] Keyboard, gamepad and touch navigation are consistent.
- [ ] `npm test` passes.
- [ ] `npm run build:itch` completes and the resulting ZIP is opened and smoke-tested.

## Reference ownership

The supplied menu sheet is the user-provided visual reference for this redesign. Preserve the GB Quest title and Aelmoor setting. Do not replace gameplay or save-system logic merely to reproduce a static mockup.
