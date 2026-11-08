# Seven-Continent World Atlas

Lost Kingdom of Shadowbane Chronicles uses the seven-continent geography convention: Asia, Africa, North America, South America, Antarctica, Europe and Australia. National Geographic recognizes these seven continents; other traditions count continents differently. Sources: https://education.nationalgeographic.org/resource/Continent/ and https://www.nationalgeographic.org/national-geographic-map-policy/

## Hierarchy
World > Continent > Zone/Region > Sub-zone > 32x32 tile chunk > tile.

## World directory totals
- 7 continents, 5 oceans.
- 56 zones (8 per continent), 224 sub-zones (4 per zone).
- 7 continent capitals, 56 regional cities, 112 towns and 168 villages: 343 settlements.
- 48 biome definitions.
- 280 points of interest: dungeons, ruins, landmarks, resource sites and world-boss lairs.
- 21 faction records and 14 continent-linked raid records.

These are catalogued procedural world records and production targets, not 343 individually handcrafted scenes. The world is streamed by 32x32 chunks and each zone has a level band, climate, biome, settlement list, POIs and travel nodes.

## Continents
### Asia — The Eastern Crown
- Jadewind Basin — temperate_forest
- Dragonspine Range — alpine
- Saffron Coast — tropical_monsoon_forest
- Whispering Steppe — grassland_steppe
- Lotus Delta — river_wetland
- Obsidian Highlands — highland
- Moonlit Archipelago — tropical_island
- Celestial Desert — cold_desert

### Africa — The Sunscar Expanse
- Golden Dune Sea — hot_desert
- Emerald Rift — tropical_rainforest
- Thunder Savannah — savanna
- Redstone Escarpment — rocky_badlands
- Crescent Oasis — oasis
- Baobab Wilds — woodland_savanna
- Ashen Caldera — volcanic
- Ivory Coast — coastal_mangrove

### North America — The Westreach
- Frostpine Frontier — boreal_forest
- Thunderbird Prairie — temperate_grassland
- Red Canyonlands — canyon_badlands
- Silverlake Country — freshwater_lakes
- Misty Redwood Coast — temperate_rainforest
- Sunstone Mesa — semi_arid_desert
- Great Bear Mountains — alpine
- Azure Gulf — subtropical_coast

### South America — The Verdant Reach
- Emerald Canopy — tropical_rainforest
- Skyfang Andes — alpine
- Serpent River Basin — tropical_river
- Glasssalt Desert — cold_desert
- Jaguar Marshes — tropical_wetland
- Cloudveil Highlands — cloud_forest
- Parrot Isles — tropical_island
- Southern Fjordlands — temperate_fjord

### Antarctica — The Frostveil
- Whiteout Plateau — polar_ice
- Blue Glacier Reach — glacier
- Aurora Shelf — ice_shelf
- Black Ice Mountains — polar_mountains
- The Buried Sea — subglacial_lake
- Crystal Crevasse — ice_caves
- Southern Lights Basin — polar_tundra
- Hollow Earth Gate — geothermal_icefield

### Europe — The Highcrown
- Kingsroad Heartlands — temperate_mixed_forest
- Silverpine Marches — boreal_forest
- Crown of Peaks — alpine
- Violet Coast — mediterranean
- Old Empire Vale — temperate_valley
- Misty Moorlands — moorland
- Amber Riverlands — river_floodplain
- Stormwall Isles — temperate_island

### Australia — The Australis Wilds
- Redglass Outback — red_desert
- Coral Crown Reef — coral_reef
- Eucalyptus Kingdom — eucalyptus_woodland
- Whispering Monsoon — tropical_savanna
- Spiral Stone Desert — rocky_desert
- Great Southern Forest — temperate_forest
- Sunken Blue Trench — deep_ocean
- Stormbird Archipelago — tropical_island

## Data locations
- `world/catalog/world.json`: global directory, oceans, counts and streaming defaults.
- `world/catalog/biomes.json`: biome ecology, flora/fauna templates, weather and resources.
- `world/catalog/settlements.json`: all capital, city, town and village records.
- `world/catalog/points-of-interest.json`: dungeon, ruin, landmark, resource and boss locations.
- `world/catalog/factions.json`: faction directory.
- `world/continents/*.json`: individual continent manifests.

## Generation rules
Generate terrain deterministically from world seed + continent + zone + chunk coordinates. Blend biome boundaries using elevation, latitude, moisture and neighboring chunks. Connect roads, rivers, bridges, ports and settlements coherently. Settlement populations should reflect water, food, trade, climate and defensibility. Antarctica is a fictional expedition realm with magical sheltered settlements and subglacial enclaves, not a statement about real-world permanent settlement. Keep mutable discovery, quest and resource state separate from static terrain.

## 90-map atlas
The playable map registry is in `world/maps/index.json` and contains exactly 90 map manifests:
- 56 overworld zone maps (8 for each of the seven continents).
- 20 dungeon instance maps linked to existing dungeon points of interest.
- 14 original raid maps with instance metadata, encounter-wing layers, difficulty modes and weekly lockout metadata.

Each map defines tile dimensions, chunk size, layer names, zone/continent links, level bands and streaming policy. These are deterministic procedural map manifests, not 90 finished hand-painted tilemaps. Terrain and encounter cells are generated from the world seed and map/chunk coordinates by the chunk generator. The registry API is `src/mmorpg/world/map-registry.js`.

## Expansion worlds 6-13

Expansions 6-13 are worlds of their own. Each has a painted map (`tools/gen_worldmaps.py` writes `assets/gm_x<N>.png` and `gm_x<N>_s.png`, with a contact sheet in `assets_preview/expansion_maps.png`) and 3 regions split into 8 zones. Each world also has 2 dungeons, a raid, world bosses, a hub town with trainers, and villages.

| # | World | Levels | Biomes | Raid |
|---|---|---|---|---|
| 6 | CRYSTALIZED REALMS | 100-220 | crystal, coast, dusk | THE MIRROR CROWN |
| 7 | FROSTSONG DYNASTY | 160-300 | snow, crystal, badlands | THE RIME DYNASTY |
| 8 | ARCANE ASCENSION | 220-380 | crystal, meadow, volcanic | THE SPELL-LIGHT SPIRE |
| 9 | BLOODMOON CONSPIRACY | 300-460 | dusk, marsh, badlands | THE ECLIPSE COURT |
| 10 | DRAGONSPIRE ODYSSEY | 380-540 | volcanic, snow, badlands | THE DRAGONSPIRE |
| 11 | WHISPERS OF VALHALLA | 460-620 | snow, coast, meadow | HALL OF ECHOING SHIELDS |
| 12 | NIGHTSHADE CHRONICLES | 540-700 | dusk, jungle, marsh | THE FIRST SHADE |
| 13 | MYTHICAL MEADOWLANDS | 600-720 | meadow, jungle, coast | THE GREEN HORIZON |

- **Reaching them:** use the harbormaster (portal), MENU > EXPANSION MAPS, or the overland road from expansion 5.
- **World map:** shows the world of the selected zone (`worldOf(z)`), with only that world's pins and roads.
- **Atlas:** `dist/atlas.html` still draws VALENDRIA only. The new worlds are listed in `atlas.json` under `expansions[].zones`.
