import { addItem, removeItem } from "./inventory.js";

export function createAuctionHouse({ listingFeeRate = 0.02, saleFeeRate = 0.05, maxListingsPerPlayer = 20 } = {}) {
  if (![listingFeeRate, saleFeeRate].every(x => Number.isFinite(x) && x >= 0 && x < 1)) {
    throw new RangeError("Auction fees must be between 0 and 1");
  }
  return { listingFeeRate, saleFeeRate, maxListingsPerPlayer, listings: [], nextId: 1 };
}

export function listAuction(house, { sellerId, item, quantity = 1, unitPriceCopper, expiresAt, sellerInventory, sellerWallet }) {
  if (!sellerId || !item?.templateId || !Number.isInteger(quantity) || quantity < 1 ||
      !Number.isSafeInteger(unitPriceCopper) || unitPriceCopper < 1 || !Number.isFinite(expiresAt) ||
      !sellerInventory || !Array.isArray(sellerInventory.items) ||
      !sellerWallet || !Number.isSafeInteger(sellerWallet.copper) || sellerWallet.copper < 0) {
    return { ok: false, reason: "invalid_listing_or_escrow" };
  }
  if (house.listings.filter(x => x.sellerId === sellerId && x.state === "active").length >= house.maxListingsPerPlayer) {
    return { ok: false, reason: "listing_limit" };
  }
  const fee = Math.ceil(unitPriceCopper * quantity * house.listingFeeRate);
  if (sellerWallet.copper < fee) return { ok: false, reason: "insufficient_listing_fee" };
  const reserved = removeItem(sellerInventory, item.templateId, quantity);
  if (!reserved.ok) return { ok: false, reason: "insufficient_item_quantity" };

  sellerWallet.copper -= fee;
  const listing = {
    id: `auction-${house.nextId++}`, sellerId, item: structuredClone(item), quantity,
    unitPriceCopper, expiresAt, listingFeeCopper: fee, state: "active", createdAt: Date.now()
  };
  house.listings.push(listing);
  return { ok: true, listing };
}

export function searchAuctions(house, { query = "", minPrice = 0, maxPrice = Infinity, now = Date.now() } = {}) {
  const q = query.toLowerCase();
  return house.listings.filter(x => x.state === "active" && x.expiresAt > now &&
    x.unitPriceCopper >= minPrice && x.unitPriceCopper <= maxPrice &&
    (!q || String(x.item.name ?? "").toLowerCase().includes(q)))
    .sort((a, b) => a.unitPriceCopper - b.unitPriceCopper);
}

export function buyAuction(house, listingId, buyerId, wallet, inventory, now = Date.now(), sellerWallet = null) {
  const listing = house.listings.find(x => x.id === listingId && x.state === "active");
  if (!listing || listing.expiresAt <= now) return { ok: false, reason: "listing_unavailable" };
  if (!buyerId || buyerId === listing.sellerId) return { ok: false, reason: "invalid_buyer" };
  const total = listing.unitPriceCopper * listing.quantity;
  if (!Number.isSafeInteger(total) || !wallet || !Number.isSafeInteger(wallet.copper) || wallet.copper < total) {
    return { ok: false, reason: "insufficient_funds" };
  }
  if (!inventory || !Array.isArray(inventory.items)) return { ok: false, reason: "invalid_inventory" };
  if (sellerWallet && (!Number.isSafeInteger(sellerWallet.copper) || sellerWallet.copper < 0 ||
      !Number.isSafeInteger(sellerWallet.copper + total - Math.floor(total * house.saleFeeRate)))) {
    return { ok: false, reason: "invalid_seller_wallet" };
  }

  const incoming = { ...listing.item, id: listing.item.templateId };
  const transfer = addItem(inventory, incoming, listing.quantity);
  if (!transfer.ok) return { ok: false, reason: transfer.reason };

  const sellerProceedsCopper = total - Math.floor(total * house.saleFeeRate);
  wallet.copper -= total;
  if (sellerWallet) sellerWallet.copper += sellerProceedsCopper;
  listing.state = "sold";
  listing.buyerId = buyerId;
  listing.sellerProceedsCopper = sellerProceedsCopper;
  listing.saleFeeCopper = total - sellerProceedsCopper;
  return { ok: true, item: { ...listing.item, quantity: listing.quantity }, sellerId: listing.sellerId, sellerProceedsCopper };
}

export function cancelAuction(house, listingId, sellerId, sellerInventory) {
  const listing = house.listings.find(x => x.id === listingId && x.state === "active");
  if (!listing || listing.sellerId !== sellerId) return { ok: false, reason: "not_owner_or_inactive" };
  if (!sellerInventory || !Array.isArray(sellerInventory.items)) return { ok: false, reason: "invalid_return_inventory" };
  const returned = addItem(sellerInventory, { ...listing.item, id: listing.item.templateId }, listing.quantity);
  if (!returned.ok) return { ok: false, reason: returned.reason };
  listing.state = "cancelled";
  return { ok: true, returnedItem: { ...listing.item, quantity: listing.quantity } };
}

export function expireAuctions(house, now = Date.now()) {
  const expired = house.listings.filter(x => x.state === "active" && x.expiresAt <= now);
  for (const listing of expired) listing.state = "expired";
  return expired.map(x => ({ listingId: x.id, sellerId: x.sellerId, item: { ...x.item, quantity: x.quantity } }));
}
