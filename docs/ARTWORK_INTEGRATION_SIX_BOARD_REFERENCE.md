# GB Quest artwork integration — supplied six-board reference

## Source received

The latest supplied artwork is a 1424×1200 composite reference image containing six separate dark-fantasy RPG boards. The boards cover:

1. Master developer atlas / expanded asset catalog.
2. Dark-fantasy catalog with icons, weapons, consumables, blocks, and monsters.
3. Skill and ability sprites, monsters and bosses, equipment, biomes, UI frames.
4. Character equipment screen, toggle/avatar components, cards, navigation and mock game view.
5. 8-bit dark-fantasy asset sheet v1.2, including icons, equipment, tiles, dungeon textures, characters and UI.
6. Four-color dark-fantasy UI kit, including skill icons, toggles, buttons, avatars, badges, wings, cards and navigation.

## Integration policy

These six boards are **reference/catalog sheets**, not six drop-in game textures. They contain headings, labels, panel borders, mockups, and multiple unrelated sprite groups. Rendering a complete board as an in-game sprite atlas would also render its labels and panel chrome and would produce incorrect sprite bounds.

Use the supplied boards as the art-direction source for the existing GB Quest assets and shell:

- Preserve the game's existing 160×144 gameplay renderer and existing HD64 asset manifests.
- Keep the browser HUD as a DOM overlay; do not bake the catalog board into the gameplay canvas.
- Use the four-color board as the primary reference for compact pixel-art UI controls and the v1.2 board as a secondary reference for the 8-bit palette.
- Use the expanded atlas and catalog for asset discovery only. Extract individual icons, tiles, and character frames into dedicated transparent PNGs before wiring them into runtime manifests.
- Keep sprite cells on consistent dimensions and document frame order, transparency, and intended use in the relevant manifest.
- Do not replace working production assets with a low-resolution crop from a labeled catalog.

## Target mapping

| Reference board content | GB Quest destination |
| --- | --- |
| Skill / ability icons | Existing skill and combat ability icon manifests |
| Weapons / armor | Existing item and equipment icon manifests |
| Monsters / bosses | Existing creature and boss sprite manifests |
| Biomes / dungeon tiles | Existing world and dungeon tileset manifests |
| Toggles / buttons / navigation | Browser shell and player HUD theme assets |
| Character portraits / equipment mockups | Character creation and equipment UI references |

## Validation checklist

- [ ] Extract each selected sprite without neighboring labels or panel borders.
- [ ] Preserve alpha transparency; remove the catalog background only where appropriate.
- [ ] Confirm each sprite's dimensions and intended atlas cell size.
- [ ] Update the matching asset manifest rather than adding hard-coded runtime paths.
- [ ] Run the sprite/asset manifest regression tests.
- [ ] Run `npm test` and `npm run build:itch`.
- [ ] Verify the itch.io ZIP contains exactly one root `index.html`.

## Current scope

This document records the supplied artwork and safe integration boundaries. It does not claim that the individual sprites have already been extracted or committed. The source boards should remain available as references until the production-ready sprite exports are reviewed.
