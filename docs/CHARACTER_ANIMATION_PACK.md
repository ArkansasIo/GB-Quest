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

## Sprite atlas export

Pack completed directional frames into eight transparent RGBA sprite sheets (one per animation), with matching JSON frame-coordinate metadata:

```bash
python -m pip install Pillow
python tools/pack_animation_atlases.py \
  --frames assets_hd64/animations/frames \
  --output assets_hd64/animations/atlases \
  --archetype warrior --rank F --frame-size 128
```

Each sheet uses directions as rows and frame indices as columns. The JSON sidecar records each frame's source filename and rectangle (`x`, `y`, `width`, `height`). The packer fails if any direction is missing or a frame has the wrong dimensions. The GitHub Actions workflow now runs this packer and validates all eight sheets before uploading the artifact.

## Configurable archetype and rank prototype variants

Generate one selected class/rank set (408 frames for the full eight-direction/eight-state set):

```bash
python -m pip install Pillow
python tools/generate_character_sprite_pack.py \
  --output assets_hd64/animations/frames \
  --size 128 --archetypes mage --ranks A
```

Supported archetypes: `warrior`, `mage`, `ranger`, `rogue`, `cleric`, `summoner`. Supported ranks: `F`, `E`, `D`, `C`, `B`, `A`, `S`, `SSS`. Multiple selections are accepted, for example `--archetypes warrior mage --ranks F E`; each combination adds 408 frames. The generator writes `character_variant_generation_report.json`.

The GitHub Actions workflow now exposes archetype and rank selectors and builds the matching atlas. Each class/rank currently uses a distinct palette and rank accent on a shared warrior-derived silhouette. This is a pipeline/integration prototype—not six finished class designs. Class-specific anatomy, weapons, armor silhouettes, spell effects, and rank-specific geometry still require dedicated art passes. The workflow remains manual and must be run from the repository's Actions tab to produce downloadable artifacts.

## Equipment overlay layers

Generate transparent, direction-specific equipment overlays on the same canvas as character frames:

```bash
python -m pip install Pillow
python tools/generate_equipment_layers.py \
  --output assets_hd64/equipment --size 128 --ranks F E D C B A S SSS
```

Slots included: head, chest, legs, hands, main hand, off hand, back, and accessory. The starter catalog includes helmets/hoods, armor/tunics/robes, greaves/trousers, gloves, swords/staves/bows/daggers/maces, shields/foci/quivers, cloaks/mantles, and pendants/medallions. Each item/rank/direction combination is exported as a transparent PNG under `layers/<slot>/<item>/<rank>/<direction>.png`.

The accompanying `equipment_manifest.json` defines canvas dimensions, feet pivot, slot anchors, draw order, rank tint, layer path, blend mode, and offsets. Render a character by compositing its base frame and selected equipment layers in slot draw order. Use the manifest offsets/anchors as the initial alignment contract; validate alignment against every animation and facing direction before production use.

The current layer art is intentionally schematic and uses shared slot anchors. It establishes the data and compositing contract, not final item-specific geometry. Weapon grip, hand position, occlusion, back-facing equipment, and class restrictions need dedicated art/anchor review. The workflow now generates the selected rank's equipment layers and includes them in its downloadable artifact.

