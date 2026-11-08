const ROLES = ["tank","healer","damage"];
export function createDungeonFinder() { return { queues: new Map(), groups: [], nextGroupId: 1 }; }
export function queueForDungeon(finder, { playerId, dungeonId, role, itemLevel = 0, now = Date.now() }) {
  if (!playerId || !dungeonId || !ROLES.includes(role)) return { ok: false, reason: "invalid_queue_request" };
  const queue = finder.queues.get(dungeonId) ?? [];
  if (queue.some(entry => entry.playerId === playerId)) return { ok: false, reason: "already_queued" };
  queue.push({ playerId, dungeonId, role, itemLevel, queuedAt: now });
  finder.queues.set(dungeonId, queue);
  return { ok: true, position: queue.length };
}
export function leaveDungeonQueue(finder, playerId, dungeonId) {
  const queue = finder.queues.get(dungeonId) ?? [];
  const next = queue.filter(entry => entry.playerId !== playerId);
  finder.queues.set(dungeonId, next); return next.length !== queue.length;
}
export function formDungeonGroups(finder, dungeonId, { tank = 1, healer = 1, damage = 3 } = {}) {
  const queue = finder.queues.get(dungeonId) ?? [];
  const required = { tank, healer, damage };
  const chosen = [];
  for (const role of ROLES) {
    const matches = queue.filter(entry => entry.role === role).slice(0, required[role]);
    if (matches.length < required[role]) return null;
    chosen.push(...matches);
  }
  const ids = new Set(chosen.map(x => x.playerId));
  finder.queues.set(dungeonId, queue.filter(x => !ids.has(x.playerId)));
  const group = { id: `dungeon-group-${finder.nextGroupId++}`, dungeonId, players: chosen, state: "formed" };
  finder.groups.push(group); return group;
}
