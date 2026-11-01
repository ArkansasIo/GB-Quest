import atlas from "../../../world/maps/index.json" with { type: "json" };
const mapIndex = new Map(atlas.maps.map(map => [map.id, map]));
export const WORLD_MAP_COUNT = atlas.mapCount;
export function getWorldMap(mapId) { return mapIndex.get(mapId) ?? null; }
export function listWorldMaps({ kind = null, continentId = null, query = "", minLevel = null, maxLevel = null } = {}) {
  const q = query.toLowerCase();
  return atlas.maps.filter(map =>
    (!kind || map.kind === kind) &&
    (!continentId || map.continentId === continentId) &&
    (!q || map.name.toLowerCase().includes(q) || map.id.includes(q)) &&
    (minLevel === null || map.levelRange[1] >= minLevel) &&
    (maxLevel === null || map.levelRange[0] <= maxLevel)
  );
}
export function getWorldMapSummary() {
  return { ...atlas.counts, total: atlas.mapCount, worldId: atlas.worldId, coordinateSystem: atlas.coordinateSystem };
}
export function validateWorldMapAtlas() {
  const ids = atlas.maps.map(map => map.id);
  return { valid: ids.length === atlas.mapCount && new Set(ids).size === ids.length &&
    atlas.maps.every(map => map.dimensionsTiles?.length === 2 && map.chunkSize > 0),
    count: ids.length, expected: atlas.mapCount };
}
