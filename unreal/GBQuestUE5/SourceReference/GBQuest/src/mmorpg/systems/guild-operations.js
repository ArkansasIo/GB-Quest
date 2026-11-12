const RANKS = Object.freeze(["member", "veteran", "officer", "guild_master"]);
const PERMISSIONS = Object.freeze({
  member: ["view", "chat", "deposit"],
  veteran: ["view", "chat", "deposit", "invite"],
  officer: ["view", "chat", "deposit", "invite", "kick", "motd", "start_event"],
  guild_master: ["view", "chat", "deposit", "invite", "kick", "motd", "start_event", "withdraw", "manage_ranks", "upgrade", "declare_war", "disband"]
});
const clone = value => structuredClone(value);
const id = prefix => prefix + "-" + cryptoRandom();
function cryptoRandom() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function memberOf(guild, playerId) { return guild.members.find(member => member.playerId === playerId) ?? null; }
function can(guild, playerId, permission) {
  const member = memberOf(guild, playerId);
  return !!member && (PERMISSIONS[member.rank] ?? []).includes(permission);
}
function assertGuild(guild) {
  if (!guild || typeof guild.id !== "string" || !Array.isArray(guild.members) || !Array.isArray(guild.bankLedger)) {
    throw new TypeError("A valid guild state is required");
  }
}
function amount(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError("Amount must be a positive safe integer");
  return value;
}
export const GUILD_PERMISSIONS = PERMISSIONS;
export function createGuildOperationsState(guild) {
  if (!guild || !guild.id || !Array.isArray(guild.members)) throw new TypeError("Guild is required");
  return { ...clone(guild), bankBalance: Number(guild.bankBalance ?? 0), bankLedger: clone(guild.bankLedger ?? []),
    upgrades: clone(guild.upgrades ?? {}), events: clone(guild.events ?? []), applications: clone(guild.applications ?? []),
    wars: clone(guild.wars ?? []), auditLog: clone(guild.auditLog ?? []) };
}
function audit(guild, actorId, action, details = {}) {
  guild.auditLog.push({ id: id("audit"), actorId, action, details: clone(details), createdAt: Date.now() });
  if (guild.auditLog.length > 500) guild.auditLog.splice(0, guild.auditLog.length - 500);
}
export function guildCan(guild, playerId, permission) { assertGuild(guild); return can(guild, playerId, permission); }
export function changeGuildRank(guild, actorId, targetId, rank) {
  assertGuild(guild);
  if (!can(guild, actorId, "manage_ranks")) return { ok: false, reason: "permission_denied" };
  if (!RANKS.includes(rank) || rank === "guild_master") return { ok: false, reason: "invalid_rank" };
  const target = memberOf(guild, targetId);
  if (!target || targetId === guild.leaderId) return { ok: false, reason: "member_not_found_or_protected" };
  const previousRank = target.rank; target.rank = rank;
  audit(guild, actorId, "rank_changed", { targetId, previousRank, rank });
  return { ok: true, member: clone(target) };
}
export function depositGuildBank(guild, actorId, value, note = "") {
  assertGuild(guild); const quantity = amount(value);
  if (!can(guild, actorId, "deposit")) return { ok: false, reason: "permission_denied" };
  guild.bankBalance += quantity;
  const entry = { id: id("bank"), actorId, direction: "deposit", amount: quantity, note: String(note).slice(0, 120), createdAt: Date.now() };
  guild.bankLedger.push(entry); audit(guild, actorId, "bank_deposit", { amount: quantity });
  return { ok: true, balance: guild.bankBalance, entry: clone(entry) };
}
export function withdrawGuildBank(guild, actorId, value, note = "") {
  assertGuild(guild); const quantity = amount(value);
  if (!can(guild, actorId, "withdraw")) return { ok: false, reason: "permission_denied" };
  if (guild.bankBalance < quantity) return { ok: false, reason: "insufficient_guild_funds" };
  guild.bankBalance -= quantity;
  const entry = { id: id("bank"), actorId, direction: "withdrawal", amount: quantity, note: String(note).slice(0, 120), createdAt: Date.now() };
  guild.bankLedger.push(entry); audit(guild, actorId, "bank_withdrawal", { amount: quantity });
  return { ok: true, balance: guild.bankBalance, entry: clone(entry) };
}
export function updateGuildMotd(guild, actorId, motd) {
  assertGuild(guild);
  if (!can(guild, actorId, "motd")) return { ok: false, reason: "permission_denied" };
  const value = String(motd ?? "").trim();
  if (value.length > 240) return { ok: false, reason: "motd_too_long" };
  guild.motd = value; audit(guild, actorId, "motd_updated");
  return { ok: true, motd: value };
}
export function startGuildEvent(guild, actorId, { title, kind = "community", startsAt, capacity = 20 } = {}) {
  assertGuild(guild);
  if (!can(guild, actorId, "start_event")) return { ok: false, reason: "permission_denied" };
  const name = String(title ?? "").trim();
  const time = new Date(startsAt).getTime();
  if (name.length < 3 || name.length > 64 || !Number.isFinite(time) || time <= Date.now()) return { ok: false, reason: "invalid_event" };
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) return { ok: false, reason: "invalid_capacity" };
  const event = { id: id("event"), title: name, kind, startsAt: new Date(time).toISOString(), capacity, roster: [actorId], status: "scheduled", createdBy: actorId };
  guild.events.push(event); audit(guild, actorId, "event_created", { eventId: event.id });
  return { ok: true, event: clone(event) };
}
export function joinGuildEvent(guild, playerId, eventId) {
  assertGuild(guild);
  if (!memberOf(guild, playerId)) return { ok: false, reason: "not_a_guild_member" };
  const event = guild.events.find(item => item.id === eventId && item.status === "scheduled");
  if (!event) return { ok: false, reason: "event_not_found" };
  if (new Date(event.startsAt).getTime() <= Date.now()) return { ok: false, reason: "event_started" };
  if (event.roster.includes(playerId)) return { ok: false, reason: "already_joined" };
  if (event.roster.length >= event.capacity) return { ok: false, reason: "event_full" };
  event.roster.push(playerId); return { ok: true, event: clone(event) };
}
export function declareGuildWar(guild, actorId, targetGuildId, { durationHours = 72 } = {}) {
  assertGuild(guild);
  if (!can(guild, actorId, "declare_war")) return { ok: false, reason: "permission_denied" };
  if (!targetGuildId || targetGuildId === guild.id) return { ok: false, reason: "invalid_target" };
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 168) return { ok: false, reason: "invalid_duration" };
  const war = { id: id("war"), targetGuildId, status: "declared", declaredBy: actorId, startsAt: new Date(Date.now() + 3600000).toISOString(), endsAt: new Date(Date.now() + (durationHours + 1) * 3600000).toISOString(), score: { own: 0, rival: 0 } };
  guild.wars.push(war); audit(guild, actorId, "war_declared", { targetGuildId, warId: war.id });
  return { ok: true, war: clone(war) };
}
export function purchaseGuildUpgrade(guild, actorId, upgradeId, catalog) {
  assertGuild(guild);
  if (!can(guild, actorId, "upgrade")) return { ok: false, reason: "permission_denied" };
  const upgrade = catalog.find(item => item.id === upgradeId);
  if (!upgrade) return { ok: false, reason: "upgrade_not_found" };
  const current = Number(guild.upgrades[upgradeId] ?? 0);
  const next = current + 1;
  if (next > upgrade.maxLevel) return { ok: false, reason: "upgrade_maxed" };
  const cost = Number(upgrade.costs?.[current]);
  if (!Number.isSafeInteger(cost) || cost < 0) return { ok: false, reason: "invalid_upgrade_catalog" };
  if (guild.bankBalance < cost) return { ok: false, reason: "insufficient_guild_funds" };
  guild.bankBalance -= cost; guild.upgrades[upgradeId] = next;
  audit(guild, actorId, "upgrade_purchased", { upgradeId, level: next, cost });
  return { ok: true, level: next, cost, balance: guild.bankBalance };
}
