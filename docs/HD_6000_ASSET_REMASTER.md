# GB-Quest 6,000 Asset HD Remaster

## Scope

This is a non-destructive companion pipeline for the existing 6,000 procedural source sprites. It keeps `assets_hd64/gbq_6000/` unchanged and writes the remastered set to `assets_hd64/gbq_6000_hd/`.

## Generate locally

```bash
python -m pip install Pillow numpy tifffile
python tools/generate_6000_asset_pack.py --output assets_hd64/gbq_6000
python tools/remaster_6000_asset_pack.py --source assets_hd64/gbq_6000 --output assets_hd64/gbq_6000_hd --size 256
```

Choose `--size 128`, `256`, `512`, or `1024`. Use `--no-tiff` to skip the 16-bit masters.

## Export specifications

| Output | Pixel format | Bits per pixel |
|---|---|---:|
| PNG delivery | RGBA, 8 bits per channel | 32 |
| TIFF master | RGBA, unsigned 16 bits per channel | 64 |

The TIFF files are genuine uint16/channel RGBA masters, validated by the GitHub Actions workflow. PNG is the broadly compatible delivery format and is not 64-bit per pixel.

## What the remaster does

- Resizes each 64×64 source sprite to the selected output dimensions using Lanczos resampling.
- Applies a restrained colour, contrast, and edge-sharpness pass.
- Preserves transparency using nearest-neighbour alpha scaling.
- Writes per-asset metadata, a CSV/JSON manifest, category preview sheets, and a report.

Upscaling and image grading do not recover detail that was never present in the source. These remain remastered procedural starter assets, not 6,000 individually hand-painted illustrations. Distinctive final character art, animation frames, boss designs, tile transitions, and UI states require additional authored art passes.

## Run on GitHub

Open **Actions → Build 6,000 Asset HD Remaster → Run workflow**. Select the output size and whether to include 16-bit TIFF masters. The workflow generates the source pack, remasters it, validates all 6,000 PNGs and TIFF masters, and uploads the HD pack as a downloadable workflow artifact. It does not commit generated binaries to Git.