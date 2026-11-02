import { getWorldMap } from "./map-registry.js";

const TERRAIN = Object.freeze({
  deepWater: 0, shallowWater: 1, sand: 2, grass: 3,
  forest: 4, rock: 5, snow: 6, swamp: 7
});

function hash32(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
function random01(seed, x, y, octave = 0) {
  return hash32(`${seed}:${x}:${y}:${octave}`) / 0xffffffff;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(seed, x, y, scale, octave) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const tx = smooth((x / scale) - gx), ty = smooth((y / scale) - gy);
  const a = random01(seed, gx, gy, octave), b = random01(seed, gx + 1, gy, octave);
  const c = random01(seed, gx, gy + 1, octave), d = random01(seed, gx + 1, gy + 1, octave);
  const top = a + (b - a) * tx, bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}
function terrainAt(map, seed, x, y) {
  const broad = valueNoise(seed, x, y, 128, 0);
  const detail = valueNoise(seed, x, y, 40, 1);
  const fine = valueNoise(seed, x, y, 13, 2);
  const elevation = broad * 0.58 + detail * 0.29 + fine * 0.13;
  const biome = map.biomeId ?? "";
  const cold = /alpine|snow|ice|tundra|polar|glacier|boreal/i.test(biome);
  const wet = /wetland|swamp|marsh|rainforest|monsoon|delta/i.test(biome);
  const dry = /desert|steppe|badland|savanna|arid/i.test(biome);
  if (elevation < 0.29) return TERRAIN.deepWater;
  if (elevation < 0.36) return TERRAIN.shallowWater;
  if (elevation < 0.43 && dry) return TERRAIN.sand;
  if (elevation > 0.79) return cold ? TERRAIN.snow : TERRAIN.rock;
  if (cold && elevation > 0.65) return TERRAIN.snow;
  if (wet && elevation < 0.55) return TERRAIN.swamp;
  if (!dry && elevation > 0.58 && random01(seed, x, y, 4) > 0.38) return TERRAIN.forest;
  if (dry && elevation < 0.52) return TERRAIN.sand;
  return TERRAIN.grass;
}
function featureAt(seed, x, y, layer, threshold) {
  return random01(seed, x, y, hash32(layer)) > threshold ? 1 : 0;
}

/**
 * Generate a deterministic, server-reproducible map chunk.
 * Coordinates are chunk coordinates from the map's north-west origin.
 * Output is JSON-serializable; tile values are stable across chunk boundaries.
 */
export function generateMapChunk(mapId, chunkX, chunkY, {
  worldSeed = "GBQ-SEVEN-CONTINENTS-001",
  layers = null
} = {}) {
  const map = getWorldMap(mapId);
  if (!map) return { ok: false, reason: "unknown_map" };
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || chunkX < 0 || chunkY < 0) {
    return { ok: false, reason: "invalid_chunk_coordinates" };
  }
  const [width, height] = map.dimensionsTiles;
  const size = map.chunkSize;
  const originX = chunkX * size, originY = chunkY * size;
  if (originX >= width || originY >= height) return { ok: false, reason: "chunk_out_of_bounds" };
  const chunkWidth = Math.min(size, width - originX);
  const chunkHeight = Math.min(size, height - originY);
  const seed = hash32(`${worldSeed}:${map.id}`);
  const requested = layers ? map.layers.filter(layer => layers.includes(layer)) : map.layers;
  const terrain = new Array(chunkWidth * chunkHeight);
  const layerData = {};
  for (const layer of requested) {
    if (layer !== "terrain") layerData[layer] = new Array(chunkWidth * chunkHeight).fill(0);
  }

  for (let row = 0; row < chunkHeight; row++) {
    for (let col = 0; col < chunkWidth; col++) {
      const x = originX + col, y = originY + row, index = row * chunkWidth + col;
      const tile = terrainAt(map, seed, x, y);
      terrain[index] = tile;
      for (const layer of Object.keys(layerData)) {
        const threshold = layer === "encounters" ? 0.992 :
          layer === "gathering" ? 0.965 :
          layer === "poi" ? 0.997 :
          layer === "settlements" ? 0.999 :
          layer === "roads" ? 0.985 : 0.992;
        if (layer === "rivers") {
          const curve = Math.sin((x + (seed % 97)) / 37) * 23 + (seed % 211);
          layerData[layer][index] = Math.abs(y - curve) < 1.15 && tile !== TERRAIN.deepWater ? 1 : 0;
        } else if (layer === "roads") {
          const roadY = Math.round(height * 0.5 + Math.sin((x + seed % 113) / 61) * height * 0.12);
          const roadX = Math.round(width * 0.5 + Math.cos((y + seed % 89) / 67) * width * 0.1);
          layerData[layer][index] = (Math.abs(y - roadY) <= 1 || Math.abs(x - roadX) <= 1) && tile > TERRAIN.shallowWater ? 1 : 0;
        } else {
          layerData[layer][index] = featureAt(seed, x, y, layer, threshold);
        }
      }
    }
  }
  return {
    ok: true,
    mapId, mapKind: map.kind, biomeId: map.biomeId ?? null,
    chunk: { x: chunkX, y: chunkY, originX, originY, width: chunkWidth, height: chunkHeight },
    seed: seed.toString(16).padStart(8, "0"),
    terrainLegend: TERRAIN,
    layers: { terrain, ...layerData }
  };
}

export function getMapChunkBounds(mapId) {
  const map = getWorldMap(mapId);
  if (!map) return null;
  const [width, height] = map.dimensionsTiles;
  return { columns: Math.ceil(width / map.chunkSize), rows: Math.ceil(height / map.chunkSize), chunkSize: map.chunkSize };
}
