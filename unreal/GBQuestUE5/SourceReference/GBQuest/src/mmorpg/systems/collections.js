export function createCollections() {
  return { appearances: [], mounts: [], pets: [], titles: [], achievements: [] };
}
export function collectAppearance(collection, item) {
  const appearanceId = item?.appearanceId ?? item?.templateId;
  if (!appearanceId) throw new TypeError("Item appearance id required");
  if (collection.appearances.includes(appearanceId)) return false;
  collection.appearances.push(appearanceId); return true;
}
export function applyTransmog(collection, equipmentItem, appearanceId) {
  if (!collection.appearances.includes(appearanceId)) return { ok: false, reason: "appearance_not_collected" };
  if (!equipmentItem?.templateId) return { ok: false, reason: "invalid_equipment" };
  equipmentItem.appearanceId = appearanceId; return { ok: true, appearanceId };
}
export function collectMount(collection, mountId) {
  if (!mountId) throw new TypeError("Mount id required");
  if (collection.mounts.includes(mountId)) return false;
  collection.mounts.push(mountId); return true;
}
export function collectTitle(collection, titleId) {
  if (!titleId) throw new TypeError("Title id required");
  if (collection.titles.includes(titleId)) return false;
  collection.titles.push(titleId); return true;
}
