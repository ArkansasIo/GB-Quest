# GB-Quest UI Icon Source Library

This directory contains original, editable SVG source icons for the UE5.7 interface.
The icon set uses a consistent 24×24 viewBox, transparent background, rounded strokes,
and a muted dark-fantasy palette designed for the command-center UI.

## Import workflow

1. Keep SVG files as source art; do not overwrite legacy pixel-art icons.
2. Rasterize to PNG at 256×256 or 512×512 for Unreal UMG texture use. Use a transparent background.
3. Import PNGs into `/Game/GBQuest/UI/Icons`.
4. Set texture group to UI, disable mipmaps for crisp interface glyphs where appropriate,
   and use UI compression settings.
5. For high-DPI layouts, retain the SVG master and generate larger raster variants.

Example conversion with Inkscape:

```bash
inkscape icon.svg --export-type=png --export-filename=icon.png --export-width=512 --export-height=512
```

## Naming and usage

Use the filename stem as the stable icon key (for example, `inventory-bag`,
`quest-marker`, `pvp-crossed-blades`). UI widgets should reference keys through a
central icon data table or primary data asset rather than hard-coded file paths.

## Status

These are actual source vector graphics committed to the repository. They are not yet
rasterized, imported into a running Unreal project, or assigned to final UMG widgets.
