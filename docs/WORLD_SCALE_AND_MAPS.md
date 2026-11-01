# World Scale and Map Streaming

## Hierarchy
World > Continent > Region > Zone > Chunk > Tile.

The world is not stored as one giant bitmap or tile matrix. Zone metadata and chunk payloads are loaded independently.

## Initial technical defaults
- Tile grid: 16x16 tiles per chunk.
- Render profile: 160x144 logical pixels, retained for retro mode.
- Chunk dimensions: 32x32 tiles (configurable).
- Active simulation radius: 2 chunks around a player initially.
- Prefetch radius: 3 chunks, adjusted by device performance.
- Zone coordinates use integer tile coordinates; chunk coordinates use floor division.
- World metadata is separate from visual tile data.

## Content scale targets
- 4 original continents.
- 6-10 zones per continent initially.
- Each zone has 4-8 subregions/points-of-interest clusters.
- 24-40 total zones as the first large-world milestone.
- Each zone defines level band, biome, climate, music key, faction state, travel nodes, quest hubs, encounter tables and dungeon entrances.

These are production targets, not real-world distances. Meters-per-tile and travel speeds must be calibrated through playtests. A huge numeric map without traversal pacing, streaming and content density is not a useful world-size specification.

## Zone manifest example
```json
{
  "id": "greenreach",
  "name": "Greenreach",
  "continentId": "westreach",
  "levelRange": [1, 8],
  "biome": "temperate_forest",
  "chunkSize": 32,
  "spawnTable": "greenreach_common",
  "travelNodes": ["oldroad_gate", "silverbrook_ferry"],
  "poi": ["brookhaven", "watchtower_ruins", "mossfall_cave"]
}
```

## Streaming rules
1. Compute player chunk from world tile coordinates.
2. Request missing chunks in a bounded radius.
3. Load collision and navigation before making a chunk traversable.
4. Keep neighboring chunk borders deterministic.
5. Persist only mutable state (opened chests, harvested nodes, destroyed objects, event state), not static terrain.
6. Unload distant chunks after pending state is saved.
7. Validate all chunk requests and player positions on the server in multiplayer.

## Map layers
- Terrain and elevation.
- Collision and navigation.
- Water, roads and bridges.
- Buildings and points of interest.
- Resource nodes.
- NPC and enemy spawn regions.
- Quest and event overlays.
- Fog of war and discovered-map data.
