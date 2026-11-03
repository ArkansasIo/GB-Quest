# GB-Quest Character Animation Pack Contract

## Purpose

This defines a consistent, importable animation library for the six core character archetypes across all nine adventurer ranks. It creates manifests and a folder scaffold; it does **not** claim to generate finished animation artwork.

## Coverage

- Archetypes: warrior, mage, ranger, rogue, cleric, summoner
- Ranks: F, E, D, C, B, A, S, SS, SSS
- Directions: S, SW, W, NW, N, NE, E, SE
- States: idle, walk, run, attack, cast, block, hit, death

This produces **3,456 animation sequences** and a target of **22,032 frames** at the default frame counts.

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

Supported archetypes: `warrior`, `mage`, `ranger`, `rogue`, `cleric`, `summoner`. Supported ranks: `F`, `E`, `D`, `C`, `B`, `A`, `S`, `SS`, `SSS`. Multiple selections are accepted, for example `--archetypes warrior mage --ranks F E`; each combination adds 408 frames. The generator writes `character_variant_generation_report.json`.

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

## Compose an equipped character preview

The equipment layer compositor assembles a base animation frame with a selected loadout in manifest draw order:

```json
{
  "head": "iron_helm",
  "chest": "iron_plate",
  "main_hand": "iron_sword",
  "off_hand": "iron_shield",
  "back": "short_cloak"
}
```

Save that object as `loadout.json`, then run:

```bash
python tools/compose_equipment_preview.py \
  --base assets_hd64/animations/frames/warrior/F/S/idle/frame_000.png \
  --manifest assets_hd64/equipment/equipment_manifest.json \
  --loadout loadout.json --rank F --direction S \
  --output assets_hd64/equipment/previews/warrior_F_S_idle_equipped.png
```

The compositor checks the base canvas, slot names, selected item/rank/direction variants, overlay file existence and overlay dimensions. It writes the composed transparent PNG plus a JSON report listing each applied layer. The workflow builds one sample equipped preview as a smoke-check of the data path. This checks file and compositing compatibility; it does not validate visual alignment across every animation frame or facing.


## Existing item catalog appearance mapping

The appearance-only bridge at `data/visuals/equipment-catalog-visual-map.json` maps the existing SRD equipment catalog IDs to the starter overlay families. It currently covers all **38 weapon** and **13 armor/shield** entries in `src/mmorpg/data/equipment.json`.

The bridge deliberately changes no item stats, catalog IDs, rarity, item rank, stars, item level, gear level, or power level. Weapon families are aliased to the closest current prototype overlay (dagger, bow, staff/focus, blunt weapon, or generic sword); armor categories are aliased to leather, medium-cloth, plate, or shield overlays. These are temporary visual aliases—not unique finished art for every catalog entry.

Validate the mapping after generating equipment layers for the requested rank:

```bash
python tools/validate_equipment_visual_map.py \
  --catalog src/mmorpg/data/equipment.json \
  --mapping data/visuals/equipment-catalog-visual-map.json \
  --manifest assets_hd64/equipment/equipment_manifest.json \
  --rank F
```

The manual animation workflow now runs this validation before composing its sample preview. All nine adventurer ranks are supported by the configurable character and equipment prototype generators, including the previously missing **SS** tier.

## In-game paper-doll appearance preview

The browser game's existing Wardrobe/transmog implementation remains the source of cosmetic ownership and saved appearance overrides. The paper-doll screen now adds small visual markers for equipped head, neck, cloak, chest, hands, main-hand, off-hand, waist, legs, feet, artifact and relic items over the central character portrait. Marker icons resolve through the existing `itemIcon` path, so unlocked transmog appearances are reflected while item stats and equipment-slot rows remain unchanged.

The preview marker layout is defined by `PAPERDOLL_VISUAL_SLOTS` in `src/polish.js`; `paperDollVisuals(eq)` is a pure helper covered by `tests/rpg-systems.test.js`. These are UI icon markers, not yet full-body pixel-art compositing from the HD PNG layer atlases. The latter still requires a runtime sprite loader and a compatible animated character base.

## World avatar equipment indicators

The world-map character portrait now composites small equipped-item icons for head, main hand, chest and off-hand over the portrait. It uses the same `itemIcon` resolver as inventory and the paper doll, so a valid transmog changes the visible icon without changing the equipped item's gameplay data. Icons are drawn into a 24×24 canvas with smoothing disabled to preserve the pixel-art presentation. This is a compact equipment indicator, not a full-body layered sprite or animated armor system.

## Animated world-walker equipment indicators

The player and follower world sprites now prefer a composited animated walker when one of the supported visible equipment slots is occupied. The base uses the existing two-frame directional `walker()` sprite, retaining left/right mirroring and the current ghost palette behavior. Small equipment icons for head, main hand, chest and off-hand are layered onto the frame and scaled to the existing 24×24 world portrait footprint. The animation frame follows the existing world movement cadence. If no supported visible equipment is present, the existing portrait path remains in use.

These are icon-based visual overlays on animated walk frames, not the HD64 full-body armor PNG pipeline. The generated HD64 animation and equipment assets remain a separate prototype pipeline and are not yet loaded by the browser game.

## Optional browser HD character compositor

`src/hd_character_art.js` is included in the generated browser bundles after the existing game modules. It exposes `window.GBQHDCharacterArt.createRuntime(options)` and does not start network requests or block game boot. The generated animation/equipment workflow artifact must be extracted into the site's static `assets_hd64/` directory before the HD runtime can load it.

Example browser integration:

```js
const hdArt = GBQHDCharacterArt.createRuntime({
  frameRoot: 'assets_hd64/animations/frames',
  equipmentRoot: 'assets_hd64/equipment'
});
const canvas = await hdArt.render({
  archetype: 'warrior', rank: 'F', direction: 'S',
  animation: 'walk', frame: 0,
  equipment: {
    head: 'iron_helm', chest: 'iron_plate',
    main_hand: 'iron_sword', off_hand: 'iron_shield',
    back: 'short_cloak'
  }
});
```

Equipment keys and IDs must match the generated equipment manifest exactly (`head`, `chest`, `legs`, `hands`, `main_hand`, `off_hand`, `back`, `accessory`). The compositor loads only the requested frame and matching rank/direction layers, caches loaded images, respects manifest draw order/blend/offset, and returns a canvas. Invalid path dimensions are rejected. The current generated artwork is explicitly placeholder/prototype art. This API is opt-in and is not yet wired to replace the existing 160×144 in-game character rendering automatically.

### Resolving live game equipment

The runtime also exposes `resolveEquipment(character, visualMap, rank)` and `renderCharacter(character, spec)`. It translates the existing `character.eq` slots (`weapon`, `armor`, `offhand`) through `data/visuals/equipment-catalog-visual-map.json` into the generated overlay slots. A saved `item.tmog` appearance is used for visuals while the original equipped item object, item level and stats remain untouched. Unsupported wondrous-item slots are skipped until dedicated visual mappings exist.

`renderCharacter` accepts `state` or `action` values such as `moving`, `sprinting`, `casting`, `blocking`, `hurt`, and `dying`, and maps them to the generated animation sequences. Cardinal and diagonal world directions are normalized to the eight-way sprite directions. The caller can override the animation with `spec.animation`.

Example:

```js
const canvas = await hdArt.renderCharacter(G, {
  state: 'moving', direction: G.dir, frame: 2, rank: 'F'
});
```

This is a callable integration API, not yet an automatic replacement for the synchronous world renderer. A future integration must schedule async asset loads outside the draw loop and display cached canvases during rendering.

Unmapped legacy weapon IDs receive a conservative family fallback (dagger, ranged, focus, blunt, or generic melee); unmapped chest armor uses a name-based robe/leather/plate fallback, and off-hand armor uses the shield prototype. These are visual placeholders, not authoritative item taxonomy. The explicit catalog visual map always takes precedence.

Repeated requests for the same base frame, rank/direction and equipment loadout share an in-flight/completed composition promise. Failed compositions are evicted so a later request can retry. Keep the resolved canvas in the caller's draw-state cache and draw it synchronously; do not call `renderCharacter` from inside the frame draw loop.

### World-scene HD presenter integration

The world scene now lazily creates an HD runtime and a frame presenter when the HD module is available. Player and follower draw paths request the current idle/walk frame; the request is asynchronous, and the draw path immediately uses the existing equipment walker/portrait until the prepared canvas is ready. Once ready, the HD canvas is drawn as a 24×24 pixel-art frame with smoothing disabled. Ghost rendering remains on the classic path so its palette treatment is preserved.

The presenter deduplicates repeated requests, discards stale asynchronous results when a newer frame is requested, and suppresses repeated retries for a failed asset key until cleared. Generated frame and equipment assets still must be deployed under `assets_hd64/`. HD output is scaled to the existing world-character footprint; this is an integration step, not a larger-resolution viewport change. Attack/cast/death animation selection still requires wiring to confirmed game action-state fields.
 Each character receives its own presenter and scaled-canvas cache, so player and followers can load independently without invalidating one another's in-flight frame requests.

### Per-character frame cache

The frame presenter now keeps a bounded least-recently-used cache (24 entries by default, configurable from 2 to 128). Previously prepared idle/walk frames can be reused immediately when animation cycles back to them, rather than recomposed on every direction/frame change. In-flight requests are deduplicated by character/loadout/animation key; failed keys are suppressed until the presenter is cleared. The runtime's own image and composite caches remain shared underneath these per-character presenter caches.

### Battle scene animation integration

The battle party renderer now requests the HD character compositor for party members that have equipment data. The battle renderer maps live presentation state to animation clips: attack actions request `attack`, spell actions request `cast`, damage flashes request `hit`, and defeated characters request `death`. Attack and cast poses expire using the battle frame counter, returning to idle instead of remaining stuck on an action frame. Prepared canvases are drawn into the existing battle-sprite footprint; if generated HD assets are absent or a frame fails, the existing portrait/sprite renderer remains active. Battle enemies continue using their existing creature sprites.
