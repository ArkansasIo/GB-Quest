# GB-Quest 2D sprite atlas v2

- File: `GBQuest_SpriteAtlas_v2.png`
- Use: Unreal `Texture2D` source for Paper2D sprites or UMG image widgets.
- Sheet: 4 columns × 4 rows; each row contains four playable heroes, four enemies, four equipment pieces, or four inventory props.
- Rendering: keep the alpha channel; use nearest-neighbour texture filtering for crisp pixels.
- Style: handheld fantasy RPG pixel art with dark colored outlines, three-tone shading, and a unified pine green, charcoal, moss, teal, parchment, muted gold, rust red, and cobalt palette.
- Edit prompt: “Remove only the semi-transparent dark background and make it fully transparent (alpha 0). Preserve every sprite, the exact 4-by-4 layout, positions, colors, pixel clusters, outlines, and dimensions. Do not redraw or alter the sprites. Ensure all empty space between and around sprites is fully transparent. Keep each sprite's dark outlines fully opaque. Output a PNG with true transparency.”

This is a new version and leaves the original game images untouched.
