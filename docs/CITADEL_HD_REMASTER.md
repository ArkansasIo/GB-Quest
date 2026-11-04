# CITADEL HD Remaster — visual direction and integration

## Direction
A cinematic high-fantasy MMORPG presentation: midnight navy, gunmetal, aged gold, parchment highlights, restrained arcane blue, and ember-red combat feedback. Typography uses Cinzel for game identity and Inter for operational UI. Panels are layered, high-contrast and readable; controls retain touch targets and keyboard focus states.

## Integration status
- `client/theme-citadel.css` skins the browser and desktop client shell.
- `index.html`, `client/shell.html`, and `client/fullscreen.html` load the theme.
- The existing rules, scenes, controls, saves, networking and 160×144 simulation are preserved.
- For the actual high-resolution game renderer, select **VIDEO → 64-BIT** in Settings. This CSS does not convert low-resolution sprite source files into painted 3D assets.
- The generated GB-Quest concept board is a visual direction reference, not a production sprite atlas; it should not be treated as 6,000 imported game assets.

## Production asset direction
Create original assets (no third-party game art): 4K environment key art, 2K character/creature portraits, 1K item icons, PBR material sets, rigged character meshes, animation clips, VFX flipbooks and responsive UI components. Keep source masters separate from runtime-compressed textures. Each asset should have a stable ID, license/provenance, dimensions, colour space, LOD/compression profile and runtime target in the manifest.

## Validation
Check browser shell at desktop and mobile widths, keyboard focus, touch controls, chat overlays, fullscreen mode, and both video modes. Run `npm test` and rebuild with the repository's normal build command after any renderer or scene changes.
