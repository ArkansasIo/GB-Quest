/** Pure campaign quest state helpers. The server should own and validate saved progress. */
export function createCampaignState() {
  return { accepted: {}, completed: {}, failed: {}, objectiveCounts: {}, unlockedActs: ["act-01"] };
}
export function getAvailableQuests(state, quests) {
  return quests.filter(q => state.unlockedActs.includes(q.actId) && !state.accepted[q.id] && (q.repeatable || !state.completed[q.id]) && (q.prerequisites || []).every(id => state.completed[id]));
}
export function acceptQuest(state, quest, prerequisites = quest.prerequisites || []) {
  if (!state || !quest || !quest.id) throw new TypeError("State and quest with id are required");
  if (state.completed[quest.id] && !quest.repeatable) return { ok: false, reason: "already_completed" };
  if (state.accepted[quest.id]) return { ok: false, reason: "already_active" };
  if (prerequisites.some(id => !state.completed[id])) return { ok: false, reason: "prerequisites_missing" };
  state.accepted[quest.id] = true;
  state.objectiveCounts[quest.id] = state.objectiveCounts[quest.id] || 0;
  return { ok: true };
}
export function applyObjectiveEvent(state, quest, event) {
  if (!state.accepted[quest.id] || state.completed[quest.id]) return 0;
  if (event.type !== quest.objective.type || event.target !== quest.objective.target) return 0;
  const required = Math.max(1, quest.objective.required || 1);
  const before = state.objectiveCounts[quest.id] || 0;
  const amount = Math.max(0, Math.floor(event.amount ?? 1));
  state.objectiveCounts[quest.id] = Math.min(required, before + amount);
  return state.objectiveCounts[quest.id] - before;
}
export function completeQuest(state, quest) {
  if (state.completed[quest.id] && !quest.repeatable) return { ok: false, reason: "reward_already_claimed" };
  if (!state.accepted[quest.id]) return { ok: false, reason: "not_accepted" };
  if ((state.objectiveCounts[quest.id] || 0) < quest.objective.required) return { ok: false, reason: "objectives_incomplete" };
  state.accepted[quest.id] = false;
  state.completed[quest.id] = (state.completed[quest.id] || 0) + 1;
  return { ok: true, rewards: structuredClone(quest.rewards || {}) };
}
export function unlockAct(state, actId, requiredQuestIds = []) {
  if (!requiredQuestIds.every(id => state.completed[id])) return false;
  if (!state.unlockedActs.includes(actId)) state.unlockedActs.push(actId);
  return true;
}
