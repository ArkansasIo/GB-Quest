import { addItem, removeItem } from "./inventory.js";

function normalizeOffer(offer) {
  const currencyCopper = offer?.currencyCopper ?? 0;
  const items = offer?.items ?? [];
  if (!Number.isSafeInteger(currencyCopper) || currencyCopper < 0 || !Array.isArray(items)) {
    return { ok: false, reason: "invalid_offer" };
  }
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.itemId !== "string" || !item.itemId.trim() ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || seen.has(item.itemId)) {
      return { ok: false, reason: "invalid_offer_item" };
    }
    seen.add(item.itemId);
  }
  return {
    ok: true,
    offer: {
      currencyCopper,
      items: items.map(({ itemId, quantity }) => ({ itemId, quantity }))
    }
  };
}

export function createTrade(playerA, playerB) {
  if (!playerA || !playerB || playerA === playerB) throw new TypeError("Trade requires two different players");
  return {
    participants: [playerA, playerB],
    offers: { [playerA]: { currencyCopper: 0, items: [] }, [playerB]: { currencyCopper: 0, items: [] } },
    accepted: [],
    status: "open",
    createdAt: Date.now()
  };
}

export function updateTradeOffer(trade, playerId, offer) {
  if (!trade || trade.status !== "open" || !trade.participants.includes(playerId)) {
    return { ok: false, reason: "trade_unavailable" };
  }
  const normalized = normalizeOffer(offer);
  if (!normalized.ok) return normalized;
  trade.offers[playerId] = normalized.offer;
  trade.accepted = [];
  return { ok: true, offer: structuredClone(normalized.offer) };
}

function stageInventory(inventory, offer) {
  if (!inventory || !Array.isArray(inventory.items)) return { ok: false, reason: "invalid_inventory" };
  const staged = structuredClone(inventory);
  const outgoing = [];
  for (const offered of offer.items) {
    const item = staged.items.find(entry => entry.id === offered.itemId);
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < offered.quantity) {
      return { ok: false, reason: "item_unavailable", itemId: offered.itemId };
    }
    const payload = { ...item, quantity: offered.quantity };
    const removed = removeItem(staged, offered.itemId, offered.quantity);
    if (!removed.ok) return { ok: false, reason: "item_unavailable", itemId: offered.itemId };
    outgoing.push(payload);
  }
  return { ok: true, inventory: staged, outgoing };
}

function settleTrade(trade, playerStates) {
  const [playerA, playerB] = trade.participants;
  const stateA = playerStates?.[playerA];
  const stateB = playerStates?.[playerB];
  if (!stateA?.inventory || !stateB?.inventory || !stateA?.wallet || !stateB?.wallet ||
      !Number.isSafeInteger(stateA.wallet.copper) || stateA.wallet.copper < 0 ||
      !Number.isSafeInteger(stateB.wallet.copper) || stateB.wallet.copper < 0) {
    return { ok: false, reason: "invalid_character_state" };
  }
  const offerA = trade.offers[playerA];
  const offerB = trade.offers[playerB];
  if (stateA.wallet.copper < offerA.currencyCopper || stateB.wallet.copper < offerB.currencyCopper) {
    return { ok: false, reason: "insufficient_funds" };
  }
  const nextA = stageInventory(stateA.inventory, offerA);
  if (!nextA.ok) return nextA;
  const nextB = stageInventory(stateB.inventory, offerB);
  if (!nextB.ok) return nextB;

  for (const item of nextB.outgoing) {
    const added = addItem(nextA.inventory, item, item.quantity);
    if (!added.ok) return { ok: false, reason: added.reason, itemId: item.id };
  }
  for (const item of nextA.outgoing) {
    const added = addItem(nextB.inventory, item, item.quantity);
    if (!added.ok) return { ok: false, reason: added.reason, itemId: item.id };
  }

  const nextWalletA = stateA.wallet.copper - offerA.currencyCopper + offerB.currencyCopper;
  const nextWalletB = stateB.wallet.copper - offerB.currencyCopper + offerA.currencyCopper;
  if (!Number.isSafeInteger(nextWalletA) || !Number.isSafeInteger(nextWalletB) || nextWalletA < 0 || nextWalletB < 0) {
    return { ok: false, reason: "currency_overflow" };
  }
  stateA.inventory.items = nextA.inventory.items;
  stateB.inventory.items = nextB.inventory.items;
  stateA.wallet.copper = nextWalletA;
  stateB.wallet.copper = nextWalletB;
  trade.status = "completed";
  trade.completedAt = Date.now();
  return { ok: true, status: trade.status };
}

export function acceptTrade(trade, playerId, playerStates) {
  if (!trade || trade.status !== "open" || !trade.participants.includes(playerId)) {
    return { ok: false, reason: "trade_unavailable" };
  }
  if (!trade.participants.every(id => id === playerId || trade.accepted.includes(id))) {
    if (!trade.accepted.includes(playerId)) trade.accepted.push(playerId);
    return { ok: true, status: "waiting_for_partner" };
  }
  if (!trade.accepted.includes(playerId)) trade.accepted.push(playerId);
  const result = settleTrade(trade, playerStates);
  if (!result.ok) trade.accepted = [];
  return result;
}

export function cancelTrade(trade, playerId) {
  if (!trade || trade.status !== "open" || !trade.participants.includes(playerId)) {
    return { ok: false, reason: "trade_unavailable" };
  }
  trade.status = "cancelled";
  trade.cancelledBy = playerId;
  trade.accepted = [];
  return { ok: true, status: trade.status };
}
