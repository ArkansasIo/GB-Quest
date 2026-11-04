# GB-Quest pixel sprite atlas

- Output: `GBQuest_SpriteAtlas_v1.png`
- Intended engine use: Unreal Engine `Texture2D`; slice as a 4x4 Paper2D sprite sheet when Paper2D is enabled.
- Layout: four rows of four centered sprites: player classes; enemies; equipment; inventory props.
- Style anchor: crisp handheld fantasy RPG pixel art; dark colored outline; three-tone shading; pine green, charcoal, moss, teal, parchment, muted gold, rust red, and cobalt.
- Import: keep the alpha channel and set texture filtering to Nearest. The importer script attempts to set `Texture2D.filter` to `NEAREST`.

This is a new versioned art asset. It does not replace the browser game's existing sprites.
