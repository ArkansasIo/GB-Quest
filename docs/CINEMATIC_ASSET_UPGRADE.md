# GB-Quest cinematic asset upgrade

## Goal
Move the default presentation toward original, cinematic dark-fantasy realism for Unreal Engine 5.7: dense meshes, physically based materials, detailed surface response, atmospheric environments, and authored animation. Use genre-level references, not copied Elden Ring characters, weapons, armor, locations, logos, or other protected designs.

## Repository audit
The current README describes a 160×144 Game Boy-style browser MMORPG. Its existing art pipeline generates 64×64 procedural pixel sprites; the “HD remaster” enlarges and sharpens those sprites. It does not create new geometry, authored detail, PBR maps, skeletal rigs, or cinematic animation. The animation manifest explicitly reports artwork_generated=false. The existing 6,000-item generator is a deterministic legacy content inventory, not a finished 6,000-piece AAA 3D asset library.

## 6,000-asset budget
See [cinematic_asset_budget.json](../data/visuals/cinematic_asset_budget.json). It defines exactly 6,000 production slots across characters, classes, weapons, armor, creatures, bosses, environments, architecture, foliage, settlements, dungeons, props, VFX, UI, and key art.

## Quality requirements
- Environment/landscape textures: 2K minimum, 4K preferred.
- Hero, boss, weapon, and armor textures: 2K minimum, 4K preferred.
- PBR: Base Color, tangent-space Normal, ORM (AO/Roughness/Metallic), plus Emissive/Opacity only where needed.
- Models: clean topology, consistent scale, pivots, collision, LODs, UVs, and Nanite suitability assessment.
- Skeletal assets: retargetable rigs, skin weights, sockets, physics assets, root-motion and in-place variants.
- Unreal 5.7: Lumen-ready materials, Nanite for suitable static meshes, virtual texturing where useful, platform-aware compression.
- Animation: authored clips, named actions, root-motion metadata, frame-rate metadata, preview renders. A manifest is not animation artwork.
- Open world: biome kits, terrain layers, foliage clusters, modular rocks/cliffs/trees, landmarks, weather and time-of-day variants.

## Safe replacement strategy
1. Preserve existing pixel art and stable IDs in a Legacy/PixelArt path.
2. Create new art under Content/GBQuest/ArtSource/<category>/; never overwrite by filename alone.
3. Maintain a registry mapping every old ID to its replacement.
4. Import into Unreal staging folders; validate materials, meshes, collisions, skeletons, retargeting, and memory budgets.
5. Switch the default presentation only after acceptance tests pass.
6. Keep retro mode as an optional presentation; do not delete original art.

## Validation
Install Pillow and run:
`python tools/validate_cinematic_asset_pack.py --min-resolution 2048`
The gate checks category coverage, minimum image dimensions, readable files, and duplicate image bytes. It intentionally fails until real production art is placed in the category folders; upscaled 64×64 sprites do not qualify.

## Scope
This change establishes the production budget, Unreal import contract, and validation gate. It does not claim that 6,000 finished 3D models, PBR texture sets, or animation clips have been generated. Those require authored or AI-generated source art and model/animation production followed by Unreal import and review.
