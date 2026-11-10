const clone = value => structuredClone(value);
const keyOf = entry => String(typeof entry === "string" ? entry : entry?.id ?? "");
export function createCollectionState(seed = {}) {
  return { mounts: [...(seed.mounts ?? [])], pets: [...(seed.pets ?? [])], titles: [...(seed.titles ?? [])],
    appearances: [...(seed.appearances ?? [])], achievements: [...(seed.achievements ?? [])],
    activeMount: seed.activeMount ?? null, activePet: seed.activePet ?? null, activeTitle: seed.activeTitle ?? null,
    points: Number.isSafeInteger(seed.points) && seed.points >= 0 ? seed.points : 0 };
}
export function unlockCollectionEntry(state, category, entry) {
  if (!state || !["mounts", "pets", "titles", "appearances", "achievements"].includes(category)) return { ok: false, reason: "invalid_category" };
  const id = keyOf(entry); if (!id) return { ok: false, reason: "invalid_entry" };
  const list = state[category]; if (list.some(item => keyOf(item) === id)) return { ok: false, reason: "already_unlocked" };
  list.push(typeof entry === "string" ? entry : clone(entry)); return { ok: true, id };
}
export function activateCollectionEntry(state, category, entryId) {
  const fields = { mounts: "activeMount", pets: "activePet", titles: "activeTitle" };
  const field = fields[category]; if (!field) return { ok: false, reason: "not_equipable" };
  if (!state[category].some(entry => keyOf(entry) === entryId)) return { ok: false, reason: "not_unlocked" };
  state[field] = entryId; return { ok: true, active: entryId };
}
export function awardAchievement(state, achievement, catalog) {
  const definition = catalog.find(item => item.id === achievement);
  if (!definition) return { ok: false, reason: "achievement_not_found" };
  const result = unlockCollectionEntry(state, "achievements", achievement);
  if (!result.ok) return result;
  const points = Number(definition.points ?? 0);
  if (!Number.isSafeInteger(points) || points < 0) return { ok: false, reason: "invalid_achievement_points" };
  state.points += points;
  const rewards = [];
  for (const reward of definition.rewards ?? []) {
    const unlocked = unlockCollectionEntry(state, reward.category, reward.id);
    if (unlocked.ok) rewards.push({ category: reward.category, id: reward.id });
  }
  return { ok: true, pointsAwarded: points, totalPoints: state.points, rewards };
}
export function collectionSummary(state) {
  return Object.fromEntries(["mounts", "pets", "titles", "appearances", "achievements"].map(category => [category, state[category].length]));
}
