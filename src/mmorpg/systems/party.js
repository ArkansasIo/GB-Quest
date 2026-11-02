const MAX_PARTY_SIZE = 5;
const MAX_RAID_SIZE = 20;

function assertParty(party) {
  if (!party || !Array.isArray(party.members) || !Number.isInteger(party.maxSize) ||
      party.maxSize < 1 || party.maxSize > MAX_RAID_SIZE) {
    throw new TypeError("Valid party state is required");
  }
  party.roles ??= {};
  party.invites ??= [];
}

export function createParty(leaderId, { maxSize = MAX_PARTY_SIZE } = {}) {
  if (typeof leaderId !== "string" || !leaderId.trim()) throw new TypeError("Party leader id is required");
  if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > MAX_RAID_SIZE) {
    throw new RangeError(`Party size must be from 1 to ${MAX_RAID_SIZE}`);
  }
  return {
    leaderId,
    maxSize,
    members: [leaderId],
    roles: { [leaderId]: "support" },
    invites: [],
    lootMode: "group",
    readyCheck: null,
    createdAt: Date.now()
  };
}

export function inviteToParty(party, playerId, { role = "support" } = {}) {
  assertParty(party);
  if (typeof playerId !== "string" || !playerId.trim()) throw new TypeError("Player id is required");
  if (!["tank", "healer", "damage", "support"].includes(role)) throw new RangeError("Invalid party role");
  if (party.members.includes(playerId)) return { ok: false, reason: "already_member" };
  if (party.members.length >= party.maxSize) return { ok: false, reason: "party_full" };
  party.members.push(playerId);
  party.roles[playerId] = role;
  return { ok: true, partyId: party.id ?? null, playerId, role };
}

export function leaveParty(party, playerId) {
  assertParty(party);
  if (!party.members.includes(playerId)) return { ok: false, reason: "not_a_member" };
  party.members = party.members.filter(id => id !== playerId);
  delete party.roles[playerId];
  party.invites = party.invites.filter(invite => invite.playerId !== playerId);
  if (party.readyCheck) delete party.readyCheck.responses[playerId];
  if (playerId === party.leaderId) party.leaderId = party.members[0] ?? null;
  if (party.members.length === 0) party.readyCheck = null;
  return { ok: true, party };
}

export function createRaid(leaderId) {
  return createParty(leaderId, { maxSize: MAX_RAID_SIZE });
}

export function sendPartyInvite(party, actorId, playerId, { now = Date.now(), ttlMs = 60000 } = {}) {
  assertParty(party);
  if (actorId !== party.leaderId) return { ok: false, reason: "leader_required" };
  if (typeof playerId !== "string" || !playerId.trim() || playerId === actorId) {
    return { ok: false, reason: "invalid_player" };
  }
  if (party.members.includes(playerId)) return { ok: false, reason: "already_member" };
  if (party.members.length >= party.maxSize) return { ok: false, reason: "party_full" };
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300000) throw new RangeError("Invite lifetime must be 1-300 seconds");
  party.invites = party.invites.filter(invite => invite.expiresAt > now && invite.playerId !== playerId);
  const invite = { playerId, invitedBy: actorId, createdAt: now, expiresAt: now + ttlMs };
  party.invites.push(invite);
  return { ok: true, invite: { ...invite } };
}

export function acceptPartyInvite(party, playerId, { role = "support", now = Date.now() } = {}) {
  assertParty(party);
  party.invites = party.invites.filter(invite => invite.expiresAt > now);
  const invite = party.invites.find(entry => entry.playerId === playerId);
  if (!invite) return { ok: false, reason: "invite_not_found" };
  const result = inviteToParty(party, playerId, { role });
  if (result.ok) party.invites = party.invites.filter(entry => entry.playerId !== playerId);
  return result;
}

export function startReadyCheck(party, actorId, { now = Date.now(), timeoutMs = 30000 } = {}) {
  assertParty(party);
  if (actorId !== party.leaderId) return { ok: false, reason: "leader_required" };
  if (party.readyCheck?.status === "pending") return { ok: false, reason: "ready_check_active" };
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new RangeError("Ready-check timeout must be 1-120 seconds");
  }
  party.readyCheck = {
    status: "pending",
    startedBy: actorId,
    startedAt: now,
    expiresAt: now + timeoutMs,
    responses: { [actorId]: true }
  };
  if (party.members.length === 1) party.readyCheck.status = "ready";
  return { ok: true, status: getReadyCheckStatus(party, now) };
}

export function respondReadyCheck(party, playerId, ready, { now = Date.now() } = {}) {
  assertParty(party);
  const check = party.readyCheck;
  if (!check || check.status !== "pending") return { ok: false, reason: "no_active_ready_check" };
  if (check.expiresAt <= now) {
    check.status = "expired";
    return { ok: false, reason: "ready_check_expired" };
  }
  if (!party.members.includes(playerId)) return { ok: false, reason: "not_a_member" };
  if (playerId === party.leaderId) return { ok: false, reason: "already_responded" };
  if (typeof ready !== "boolean") throw new TypeError("Ready response must be boolean");
  if (Object.hasOwn(check.responses, playerId)) return { ok: false, reason: "already_responded" };
  check.responses[playerId] = ready;
  if (ready === false) check.status = "not_ready";
  else if (party.members.every(id => check.responses[id] === true)) check.status = "ready";
  return { ok: true, status: getReadyCheckStatus(party, now) };
}

export function getReadyCheckStatus(party, now = Date.now()) {
  assertParty(party);
  const check = party.readyCheck;
  if (!check) return null;
  if (check.status === "pending" && check.expiresAt <= now) check.status = "expired";
  return {
    status: check.status,
    startedAt: check.startedAt,
    expiresAt: check.expiresAt,
    responses: party.members.map(playerId => ({
      playerId,
      ready: check.responses[playerId] ?? null
    }))
  };
}
