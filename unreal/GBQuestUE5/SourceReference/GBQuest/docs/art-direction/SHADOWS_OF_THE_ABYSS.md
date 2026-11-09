# Redesigned Art Direction — Shadows of the Abyss

This directory records the approved visual direction supplied for the GB-Quest redesign.

## Reference pack

The four supplied reference sheets are:
1. `01-character-classes.jpg` — Blade Knight, Dark Sorceress, Shadow Ranger, Abyssal Templar, Void Assassin, Blood Necromancer.
2. `02-master-style-reference.jpg` — master palette, materials, UI framing, item icon treatment, and monster mood.
3. `03-weapons-and-armor-catalog.jpg` — weapon families, rarity tiers, armor sets, accessories, and material close-ups.
4. `04-game-ui-reference.jpg` — character panel, inventory, quest journal, skill tree, HUD, party frames, chat, tooltips, and menus.

## Visual specification

- **Foundation:** deep-void black, charcoal, and shadow gray.
- **Trim:** antique gold filigree, restrained ornamental borders, engraved metal.
- **Accent families:** frost blue, arcane violet, emerald, blood crimson, and white-gold.
- **Materials:** polished and worn metal, leather, dark fabric, glowing crystal, and embroidered cloth.
- **Character silhouettes:** readable class-specific shapes with strong equipment identity.
- **Effects:** controlled rim lighting, volumetric magic glow, and selective particle trails.
- **Interface:** ornate but legible; preserve contrast, focus states, responsive layout, and existing interaction behavior.

## Production asset migration rules

The reference sheets are art-direction boards, **not drop-in sprite atlases**. Production assets must be extracted or recreated as individual images with transparent backgrounds where appropriate. During migration:

- Preserve existing runtime asset IDs, filenames, import paths, atlas coordinates, and references until replacements are verified.
- Preserve required image dimensions, aspect ratios, alpha channels, pivots, hitboxes, and animation frame ordering.
- Keep UI frame art separate from interactive controls and text; do not bake labels or changing values into panels.
- Build rarity variants consistently: Normal, Uncommon, Rare, Epic, Legendary, and Mythic.
- Validate each replacement in browser and Unreal builds before retiring its legacy counterpart.
- Keep public admin and developer systems disabled.

## Reference image placement

Place the four supplied JPEGs in this directory using the exact filenames listed above. The source reference sheets are packaged separately as `GB-Quest-Redesigned-Art-Reference-Pack.zip`; they are not yet committed as binary files in this repository. This avoids falsely treating a composite style board as a production-ready atlas.

## Migration sequence

1. Character/class portraits and full-body class art.
2. Weapons, armor pieces, accessories, and item icons by rarity.
3. Creatures and environment art.
4. UI frames, buttons, HUD elements, inventory slots, and skill nodes.
5. Verify all references, responsive layouts, transparency, and loading fallbacks.
