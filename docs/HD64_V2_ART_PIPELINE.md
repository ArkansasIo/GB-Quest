# HD64 v2 Art Pipeline

## Purpose

The HD64 v2 pipeline is a separate companion art library for GB-Quest. It does not overwrite `assets/`, the original source sheets, or the existing `assets_hd64/` atlas set. The classic Game Boy presentation remains unchanged.

## Families

Characters and portraits, creatures and bosses, weapons, armour, consumables and relics, terrain, settlements, dungeons, spell effects, and interface elements.

## Generate

```bash
python -m pip install Pillow numpy
python tools/gen_hd64_v2.py --size 256
```

Choose `--size 128`, `256`, `512`, or `1024`. The output is written to `assets_hd64_v2/` with a JSON manifest and contact sheet.

## Colour depth and formats

PNG delivery images are RGBA with 8 bits per channel (32 bits per pixel). The generator also attempts to write TIFF masters with 16 bits per channel (64 bits per pixel) when the installed Pillow/TIFF codec supports that pixel mode. The TIFF output is optional and must be checked with an image inspector before it is treated as a guaranteed 64-bit master. The image workflow must not describe ordinary RGBA PNG files as 64-bit-per-pixel images.

## Art scope

Generated assets establish a consistent original fantasy visual direction and are suitable as concept/starter artwork. They are not hand-painted final illustrations, complete animation sets, or seamlessly tileable production terrain. Character direction/animation frame sets, boss-specific silhouettes, polished UI component states, and large key art remain separate art-production tasks.

## Automated generation

Run the `Generate HD64 v2 Original Art Library` workflow from GitHub Actions. It uploads the generated library as a workflow artifact; it does not commit generated binaries to the repository.

## Validation

The workflow checks that every manifest entry resolves to an RGBA PNG with the requested dimensions. TIFF masters are best-effort and require a separate codec validation step.