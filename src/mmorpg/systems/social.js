const CHAT_CHANNELS = new Set(["say", "party", "guild", "whisper"]);

export function createSocialState() {
  return { friends: {}, requests: [], ignored: {}, chatWindows: {} };
}

function ensurePlayer(social, playerId) {
  if (!social || typeof playerId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(playerId)) {
    throw new TypeError("Social state and valid player id are required");
  }
  if (!Object.hasOwn(social.friends, playerId)) social.friends[playerId] = [];
  if (!Object.hasOwn(social.ignored, playerId)) social.ignored[playerId] = [];
  if (!Array.isArray(social.friends[playerId]) || !Array.isArray(social.ignored[playerId])) {
    throw new TypeError("Player social lists must be arrays");
  }
  return social;
}

export function requestFriend(social, fromId, toId) {
  ensurePlayer(social, fromId);
  ensurePlayer(social, toId);
  if (fromId === toId) return { ok: false, reason: "cannot_friend_self" };
  if (social.ignored[toId].includes(fromId) || social.ignored[fromId].includes(toId)) {
    return { ok: false, reason: "relationship_blocked" };
  }
  if (social.friends[fromId].includes(toId)) return { ok: false, reason: "already_friends" };
  if (social.requests.some(request => request.fromId === fromId && request.toId === toId)) {
    return { ok: false, reason: "request_pending" };
  }
  const reciprocal = social.requests.find(request => request.fromId === toId && request.toId === fromId);
  if (reciprocal) {
    return acceptFriendRequest(social, toId, fromId);
  }
  social.requests.push({ fromId, toId, createdAt: Date.now() });
  return { ok: true };
}

export function acceptFriendRequest(social, playerId, fromId) {
  ensurePlayer(social, playerId);
  ensurePlayer(social, fromId);
  const index = social.requests.findIndex(request => request.toId === playerId && request.fromId === fromId);
  if (index < 0) return { ok: false, reason: "request_not_found" };
  if (social.ignored[playerId].includes(fromId) || social.ignored[fromId].includes(playerId)) {
    return { ok: false, reason: "relationship_blocked" };
  }
  social.requests.splice(index, 1);
  if (!social.friends[playerId].includes(fromId)) social.friends[playerId].push(fromId);
  if (!social.friends[fromId].includes(playerId)) social.friends[fromId].push(playerId);
  return { ok: true, friends: true };
}

export function removeFriend(social, playerId, friendId) {
  ensurePlayer(social, playerId);
  ensurePlayer(social, friendId);
  social.friends[playerId] = social.friends[playerId].filter(id => id !== friendId);
  social.friends[friendId] = social.friends[friendId].filter(id => id !== playerId);
  social.requests = social.requests.filter(request =>
    !(request.fromId === playerId && request.toId === friendId) &&
    !(request.fromId === friendId && request.toId === playerId)
  );
  return { ok: true };
}

export function ignorePlayer(social, playerId, ignoredId) {
  ensurePlayer(social, playerId);
  ensurePlayer(social, ignoredId);
  if (playerId === ignoredId) return { ok: false, reason: "cannot_ignore_self" };
  if (!social.ignored[playerId].includes(ignoredId)) social.ignored[playerId].push(ignoredId);
  removeFriend(social, playerId, ignoredId);
  return { ok: true };
}

export function unignorePlayer(social, playerId, ignoredId) {
  ensurePlayer(social, playerId);
  social.ignored[playerId] = social.ignored[playerId].filter(id => id !== ignoredId);
  return { ok: true };
}

export function sendChatMessage(social, {
  senderId, channel = "say", recipientId = null, text
}, {
  now = Date.now(), windowMs = 10000, maxMessages = 5, maxLength = 120
} = {}) {
  ensurePlayer(social, senderId);
  if (!Number.isSafeInteger(windowMs) || windowMs < 1 || !Number.isSafeInteger(maxMessages) ||
      maxMessages < 1 || !Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new RangeError("Chat limits must be positive safe integers");
  }
  if (!CHAT_CHANNELS.has(channel)) return { ok: false, reason: "invalid_channel" };
  if (typeof text !== "string") return { ok: false, reason: "invalid_message" };
  const message = text.trim();
  if (!message || message.length > maxLength || /[\u0000-\u001F\u007F]/.test(message)) {
    return { ok: false, reason: "invalid_message" };
  }
  if (channel === "whisper") {
    if (!recipientId || recipientId === senderId) return { ok: false, reason: "invalid_recipient" };
    ensurePlayer(social, recipientId);
    if (social.ignored[senderId].includes(recipientId) || social.ignored[recipientId].includes(senderId)) {
      return { ok: false, reason: "recipient_unavailable" };
    }
    if (!social.friends[senderId].includes(recipientId)) return { ok: false, reason: "recipient_not_friend" };
  }
  const events = (social.chatWindows[senderId] ?? []).filter(timestamp => timestamp > now - windowMs);
  if (events.length >= maxMessages) return { ok: false, reason: "rate_limited" };
  events.push(now);
  social.chatWindows[senderId] = events;
  return { ok: true, message: { senderId, channel, recipientId, text: message, sentAt: now } };
}
