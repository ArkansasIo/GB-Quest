import { addItem } from "./inventory.js";

export function createMailbox({ maxMessages = 100, attachmentLimit = 12, expiryMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  return { maxMessages, attachmentLimit, expiryMs, messages: [], nextId: 1 };
}

export function sendMail(mailbox, { senderId, recipientId, subject = "", body = "", attachments = [], currencyCopper = 0 }, now = Date.now()) {
  if (!senderId || !recipientId || senderId === recipientId || !Array.isArray(attachments) ||
      attachments.length > mailbox.attachmentLimit || !Number.isSafeInteger(currencyCopper) || currencyCopper < 0 ||
      attachments.some(x => !x?.templateId || !Number.isInteger(x.quantity ?? 1) || (x.quantity ?? 1) < 1)) {
    return { ok: false, reason: "invalid_mail" };
  }
  if (mailbox.messages.filter(m => m.recipientId === recipientId && !m.deleted).length >= mailbox.maxMessages) {
    return { ok: false, reason: "mailbox_full" };
  }
  const message = {
    id: `mail-${mailbox.nextId++}`, senderId, recipientId,
    subject: String(subject).slice(0, 100), body: String(body).slice(0, 2000),
    attachments: structuredClone(attachments), currencyCopper,
    sentAt: now, expiresAt: now + mailbox.expiryMs, read: false, claimed: false, deleted: false
  };
  mailbox.messages.push(message);
  return { ok: true, message };
}

export function readMail(mailbox, messageId, recipientId) {
  const message = mailbox.messages.find(m => m.id === messageId && m.recipientId === recipientId && !m.deleted);
  if (!message) return null;
  message.read = true;
  return message;
}

// Legacy claim API returns a one-time payload for a caller-managed transaction.
export function claimMail(mailbox, messageId, recipientId) {
  const message = mailbox.messages.find(m => m.id === messageId && m.recipientId === recipientId && !m.deleted);
  if (!message || message.claimed) return { ok: false, reason: "unavailable" };
  message.claimed = true;
  return { ok: true, attachments: structuredClone(message.attachments), currencyCopper: message.currencyCopper };
}

// Preferred API: stage every item on a cloned inventory, validate the wallet, then commit once.
// Failed capacity/weight/funds validation leaves both the message and character unchanged.
export function claimMailToCharacter(mailbox, messageId, recipientId, inventory, wallet) {
  const message = mailbox.messages.find(m => m.id === messageId && m.recipientId === recipientId && !m.deleted);
  if (!message || message.claimed) return { ok: false, reason: "unavailable" };
  if (!inventory || !Array.isArray(inventory.items) || !wallet ||
      !Number.isSafeInteger(wallet.copper) || wallet.copper < 0 ||
      !Number.isSafeInteger(wallet.copper + message.currencyCopper)) {
    return { ok: false, reason: "invalid_character_state" };
  }

  const stagedInventory = structuredClone(inventory);
  for (const attachment of message.attachments) {
    const result = addItem(stagedInventory, { ...attachment, id: attachment.templateId }, attachment.quantity ?? 1);
    if (!result.ok) return { ok: false, reason: result.reason };
  }

  inventory.items = stagedInventory.items;
  wallet.copper += message.currencyCopper;
  message.claimed = true;
  return { ok: true, attachments: structuredClone(message.attachments), currencyCopper: message.currencyCopper };
}

export function expireMail(mailbox, now = Date.now()) {
  const expired = mailbox.messages.filter(m => !m.deleted && m.expiresAt <= now);
  for (const message of expired) message.deleted = true;
  return expired.length;
}
