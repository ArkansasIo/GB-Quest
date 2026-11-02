import { DEFAULT_CHUNK_SIZE } from "./coordinates.js";

const BIOME_TILES = Object.freeze({
  temperate_forest: ["grass", "grass", "grass", "forest_floor", "dirt"],
  ancient_forest: ["deep_grass", "moss", "roots", "forest_floor"],
  highland: ["meadow", "rock", "gravel", "heather"],
  alpine: ["snow", "ice", "stone", "pine_floor"],
  tundra: ["snow", "frost_grass", "stone"],
  glacier: ["ice", "snow", "deep_ice"],
  desert: ["sand", "dune", "rock", "dry_scrub"],
  badlands: ["red_sand", "clay", "rock", "gravel"],
  volcanic: ["ash", "basalt", "lava_crust", "obsidian"],
  swamp: ["mud", "shallow_water", "reeds", "peat"],
  haunted_forest: ["dark_grass", "dead_leaves", "roots", "moss"],
  coastal: ["sand", "grass", "shallow_water", "pebbles"],
  archipelago: ["sand", "shallow_water", "coral_rock"],
  savanna: ["dry_grass", "red_dirt", "acacia_floor"],
  jungle: ["jungle_grass", "mud", "roots", "leaf_litter"],
  underdark: ["cave_floor", "fungus", "slate", "crystal"],
  crystal_caverns: ["crystal_floor", "slate", "glow_moss"],
  ashen_wastes: ["ash", "charred_earth", "basalt"],
  enchanted_grove: ["bright_grass", "flower_moss", "root_floor"],
  shadow_marsh: ["dark_mud", "black_water", "reeds", "peat"]
});

function hash32(value) {
  let h = value >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

function randomAt(seed, x, y, salt = 0) {
  return hash32((seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ salt) >>> 0) / 4294967296;
}

/** Deterministic 32x32 tile chunk generator. Coordinates are absolute within a zone,
 * so regenerating adjacent chunks produces matching, stable world edges. */
export function generateChunk(zone, chunkX, chunkY, seed = 1, chunkSize = DEFAULT_CHUNK_SIZE) {
  if (!zone || !Array.isArray(zone.dimensionsTiles) || !Number.isInteger(chunkX) ||
      !Number.isInteger(chunkY) || chunkX < 0 || chunkY < 0 ||
      !Number.isInteger(seed) || !Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new TypeError("Valid zone, non-negative chunk coordinates, integer seed and chunk size are required");
  }
  const [width, height] = zone.dimensionsTiles;
  const startX = chunkX * chunkSize, startY = chunkY * chunkSize;
  if (startX >= width || startY >= height) throw new RangeError("Chunk is outside zone bounds");
  const tiles = BIOME_TILES[zone.biome] ?? ["grass", "dirt", "stone"];
  const actualWidth = Math.min(chunkSize, width - startX);
  const actualHeight = Math.min(chunkSize, height - startY);
  const cells = [];
  for (let y = 0; y < actualHeight; y++) {
    for (let x = 0; x < actualWidth; x++) {
      const worldX = startX + x, worldY = startY + y;
      const elevation = randomAt(seed, worldX, worldY, 0x1234);
      const variation = randomAt(seed, worldX, worldY, 0x5678);
      const tileIndex = Math.floor(variation * tiles.length);
      cells.push({
        x: worldX, y: worldY,
        tile: elevation < 0.035 ? "water" : tiles[tileIndex],
        elevation: Math.round(elevation * 255),
        encounterRoll: Math.floor(randomAt(seed, worldX, worldY, 0x9abc) * 10000)
      });
    }
  }
  return { zoneId: zone.id, chunkX, chunkY, width: actualWidth, height: actualHeight, seed, cells };
}
