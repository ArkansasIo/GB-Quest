export function createMailbox({ maxMessages = 100, attachmentLimit = 12, expiryMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  return { maxMessages, attachmentLimit, expiryMs, messages: [], nextId: 1 };
}
export function sendMail(mailbox, { senderId, recipientId, subject = "", body = "", attachments = [], currencyCopper = 0 }, now = Date.now()) {
  if (!senderId || !recipientId || senderId === recipientId || !Array.isArray(attachments) ||
      attachments.length > mailbox.attachmentLimit || !Number.isSafeInteger(currencyCopper) || currencyCopper < 0) {
    return { ok: false, reason: "invalid_mail" };
  }
  if (mailbox.messages.filter(m => m.recipientId === recipientId && !m.deleted).length >= mailbox.maxMessages) {
    return { ok: false, reason: "mailbox_full" };
  }
  const message = { id: `mail-${mailbox.nextId++}`, senderId, recipientId, subject: String(subject).slice(0,100),
    body: String(body).slice(0,2000), attachments: structuredClone(attachments), currencyCopper,
    sentAt: now, expiresAt: now + mailbox.expiryMs, read: false, claimed: false, deleted: false };
  mailbox.messages.push(message); return { ok: true, message };
}
export function readMail(mailbox, messageId, recipientId) {
  const message = mailbox.messages.find(m => m.id === messageId && m.recipientId === recipientId && !m.deleted);
  if (!message) return null; message.read = true; return message;
}
export function claimMail(mailbox, messageId, recipientId) {
  const message = mailbox.messages.find(m => m.id === messageId && m.recipientId === recipientId && !m.deleted);
  if (!message || message.claimed) return { ok: false, reason: "unavailable" };
  message.claimed = true;
  return { ok: true, attachments: structuredClone(message.attachments), currencyCopper: message.currencyCopper };
}
export function expireMail(mailbox, now = Date.now()) {
  const expired = mailbox.messages.filter(m => !m.deleted && m.expiresAt <= now);
  for (const message of expired) message.deleted = true;
  return expired.length;
}
