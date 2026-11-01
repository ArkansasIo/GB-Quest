# Original 8-bit pixel-art pipeline

## Visual target
- Game Boy-inspired 4-shade mode remains the default.
- Optional expanded 8-bit palette mode for richer environments and item rarity.
- Integer scaling, nearest-neighbor filtering, transparent backgrounds and pixel-grid alignment.
- Original GB Quest silhouettes, symbols, characters, monsters and environments.

## Required asset families
1. Terrain: grass, dirt, sand, snow, water, lava, cliffs, roads, bridges and dungeon floors.
2. Characters: all species, body types, class outfits, hair, faces, weapons and armor layers.
3. Creatures: wildlife, humanoids, undead, elementals, dragons and original raid bosses.
4. Equipment: weapon families, armor slots, shields, accessories and rarity variants.
5. Items: potions, food, crafting resources, quest objects, treasure and currencies.
6. Effects: elemental projectiles, melee hits, healing, buffs, debuffs, status icons and portals.
7. UI: inventory, character sheet, action bars, minimap, quest tracker, raid frames, tooltips and menus.
8. World props: towns, buildings, farms, mines, ships, shrines, dungeon objects and transport nodes.

## Animation standards
- Four directions for characters.
- 4-8 frames for basic idle/walk loops.
- 4-8 frames for attacks, casts and damage reactions.
- 6-12 frames for signature abilities and boss effects.
- Store frame duration and pivot/origin metadata in animation manifests.

## Asset provenance
Do not extract or reuse World of Warcraft or D&D book/game artwork, sprites, UI textures, maps, logos or audio. Create original assets using broad genre conventions only. SRD rules data and visual art are separate licensing questions.

## Generation
Use deterministic procedural tools for placeholder atlases and replace them with reviewed original pixel art. Keep source files and generated PNG atlases versioned separately.
