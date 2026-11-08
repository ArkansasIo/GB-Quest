/** Integer tile/chunk coordinate helpers for streamed worlds. */
export const DEFAULT_CHUNK_SIZE = 32;

export function tileToChunk(tile, chunkSize = DEFAULT_CHUNK_SIZE) {
  if (!Number.isInteger(tile) || !Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new TypeError("tile and positive chunkSize must be integers");
  }
  return Math.floor(tile / chunkSize);
}

export function chunkKey(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError("Chunk coordinates must be integers");
  return x + "," + y;
}

export function worldPositionToChunk(x, y, chunkSize = DEFAULT_CHUNK_SIZE) {
  return { x: tileToChunk(x, chunkSize), y: tileToChunk(y, chunkSize) };
}

export function chunksInRadius(centerX, centerY, radius) {
  if (![centerX, centerY, radius].every(Number.isInteger) || radius < 0) {
    throw new TypeError("Coordinates and non-negative radius must be integers");
  }
  const chunks = [];
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) chunks.push({ x, y, key: chunkKey(x, y) });
  }
  return chunks;
}
