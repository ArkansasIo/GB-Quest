# GB-Quest Character Animation Pack Contract

## Purpose

This defines a consistent, importable animation library for the six core character archetypes. It creates manifests and a folder scaffold; it does **not** claim to generate finished animation artwork.

## Coverage

- Archetypes: warrior, mage, ranger, rogue, cleric, summoner
- Ranks: F, E, D, C, B, A, S, SSS
- Directions: S, SW, W, NW, N, NE, E, SE
- States: idle, walk, run, attack, cast, block, hit, death

This produces **3,072 animation sequences** and a target of **19,584 frames** at the default frame counts.

## Frame contract

| State | Frames | Loop |
|---|---:|---|
| idle | 6 | yes |
| walk | 8 | yes |
| run | 8 | yes |
| attack | 6 | no |
| cast | 8 | no |
| block | 4 | no |
| hit | 3 | no |
| death | 8 | no |

Default frame canvas is 128×128 RGBA PNG. Use transparent backgrounds, consistent character pivot/feet baseline, and identical canvas dimensions within a sequence. Use `frame_000.png` onward; indices are zero-based. Keep each direction's facing convention consistent.

## Generate the manifest

```bash
python tools/build_animation_manifest.py --output assets_hd64/animations --frame-size 128
```

Validate imported/authored frames:

```bash
python tools/build_animation_manifest.py --output assets_hd64/animations --frame-size 128 --validate
```

Validation reports missing frames per sequence. It does not judge animation quality, silhouette consistency, timing, or combat readability.

## Recommended production order

1. One complete warrior F-rank set as the style and pivot reference.
2. Idle/walk/run for all six archetypes.
3. Attack/cast/block/hit/death.
4. Rank-specific visual upgrades F through SSS, keeping silhouette readable.
5. Export sprite atlases and engine metadata only after frame validation.

Do not create eight-direction variants by simply mirroring directional art when equipment, handedness, weapon grip, or asymmetric silhouettes would become incorrect.

## F-rank warrior prototype sprite generation

Generate the first procedural sprite set (8 directions × 8 animation states = 408 PNG frames):

```bash
python -m pip install Pillow
python tools/generate_warrior_f_sprite.py --output assets_hd64/animations/frames --size 128
```

The generator writes frames under `warrior/F/<direction>/<animation>/frame_000.png` and a `warrior_f_generation_report.json`. Supported output canvases are 64, 128, 256, and 512 pixels; larger canvases use nearest-neighbour scaling to preserve the pixel-art look. These frames are deliberately labeled prototype placeholder art and should be reviewed/redrawn before release.

The GitHub Actions workflow generates the manifest and this F-rank warrior prototype, then checks that all 408 frames exist before uploading the artifact. It does not run the full 6,000-image remaster job.
