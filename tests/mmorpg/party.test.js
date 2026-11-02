import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptPartyInvite, createParty, createRaid, getReadyCheckStatus, inviteToParty,
  leaveParty, respondReadyCheck, sendPartyInvite, startReadyCheck
} from "../../src/mmorpg/systems/party.js";

test("party invite flow checks leader, expiry, roles and capacity", () => {
  const party = createParty("leader");
  assert.equal(sendPartyInvite(party, "stranger", "guest").reason, "leader_required");
  assert.equal(sendPartyInvite(party, "leader", "guest", { now: 10 }).ok, true);
  assert.equal(acceptPartyInvite(party, "guest", { now: 60011 }).reason, "invite_not_found");
  sendPartyInvite(party, "leader", "guest", { now: 100 });
  assert.equal(acceptPartyInvite(party, "guest", { role: "healer", now: 200 }).ok, true);
  assert.equal(party.roles.guest, "healer");
  assert.equal(acceptPartyInvite(party, "guest").reason, "invite_not_found");
  assert.equal(inviteToParty(createRaid("raid-leader"), "member").ok, true);
  assert.throws(() => inviteToParty(party, "other", { role: "invalid" }), /Invalid party role/);
  assert.throws(() => createParty("leader", { maxSize: 21 }), /Party size/);
});

test("ready checks collect one response per member and expire cleanly", () => {
  const party = createParty("leader");
  inviteToParty(party, "one");
  inviteToParty(party, "two");
  assert.equal(startReadyCheck(party, "one").reason, "leader_required");
  assert.equal(startReadyCheck(party, "leader", { now: 100, timeoutMs: 5000 }).ok, true);
  assert.equal(respondReadyCheck(party, "outside", true, { now: 101 }).reason, "not_a_member");
  assert.equal(respondReadyCheck(party, "one", true, { now: 101 }).ok, true);
  assert.equal(respondReadyCheck(party, "one", true, { now: 102 }).reason, "already_responded");
  assert.equal(respondReadyCheck(party, "two", true, { now: 103 }).status.status, "ready");
  assert.equal(startReadyCheck(party, "leader", { now: 200 }).ok, true);
  assert.equal(getReadyCheckStatus(party, 30200).status, "expired");
  assert.equal(respondReadyCheck(party, "two", true, { now: 30200 }).reason, "no_active_ready_check");
});

test("a negative response stops the check and leaving removes readiness state", () => {
  const party = createParty("leader");
  inviteToParty(party, "guest");
  startReadyCheck(party, "leader", { now: 0 });
  assert.equal(respondReadyCheck(party, "guest", false, { now: 1 }).status.status, "not_ready");
  assert.equal(startReadyCheck(party, "leader", { now: 2 }).ok, true);
  leaveParty(party, "guest");
  assert.deepEqual(getReadyCheckStatus(party, 3).responses, [{ playerId: "leader", ready: true }]);
  assert.equal(leaveParty(party, "guest").reason, "not_a_member");
});
