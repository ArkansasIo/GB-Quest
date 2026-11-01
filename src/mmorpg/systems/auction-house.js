export function createAuctionHouse({ listingFeeRate = 0.02, saleFeeRate = 0.05, maxListingsPerPlayer = 20 } = {}) {
  return { listingFeeRate, saleFeeRate, maxListingsPerPlayer, listings: [], nextId: 1 };
}
export function listAuction(house, { sellerId, item, quantity = 1, unitPriceCopper, expiresAt }) {
  if (!sellerId || !item?.templateId || !Number.isInteger(quantity) || quantity < 1 ||
      !Number.isSafeInteger(unitPriceCopper) || unitPriceCopper < 1 || !Number.isFinite(expiresAt)) {
    return { ok: false, reason: "invalid_listing" };
  }
  if (house.listings.filter(x => x.sellerId === sellerId && x.state === "active").length >= house.maxListingsPerPlayer) {
    return { ok: false, reason: "listing_limit" };
  }
  const listing = { id: `auction-${house.nextId++}`, sellerId, item: structuredClone(item), quantity,
    unitPriceCopper, expiresAt, state: "active", createdAt: Date.now() };
  house.listings.push(listing);
  return { ok: true, listing };
}
export function searchAuctions(house, { query = "", minPrice = 0, maxPrice = Infinity, now = Date.now() } = {}) {
  const q = query.toLowerCase();
  return house.listings.filter(x => x.state === "active" && x.expiresAt > now &&
    x.unitPriceCopper >= minPrice && x.unitPriceCopper <= maxPrice &&
    (!q || x.item.name.toLowerCase().includes(q))).sort((a,b) => a.unitPriceCopper-b.unitPriceCopper);
}
export function buyAuction(house, listingId, buyerId, wallet, inventory, now = Date.now()) {
  const listing = house.listings.find(x => x.id === listingId && x.state === "active");
  if (!listing || listing.expiresAt <= now) return { ok: false, reason: "listing_unavailable" };
  if (!buyerId || buyerId === listing.sellerId) return { ok: false, reason: "invalid_buyer" };
  const total = listing.unitPriceCopper * listing.quantity;
  if (!Number.isSafeInteger(total) || wallet.copper < total) return { ok: false, reason: "insufficient_funds" };
  const sellerProceeds = total - Math.floor(total * house.saleFeeRate);
  wallet.copper -= total;
  listing.state = "sold"; listing.buyerId = buyerId;
  listing.sellerProceedsCopper = sellerProceeds;
  return { ok: true, item: { ...listing.item, quantity: listing.quantity }, sellerId: listing.sellerId, sellerProceedsCopper: sellerProceeds };
}
export function cancelAuction(house, listingId, sellerId) {
  const listing = house.listings.find(x => x.id === listingId && x.state === "active");
  if (!listing || listing.sellerId !== sellerId) return { ok: false, reason: "not_owner_or_inactive" };
  listing.state = "cancelled"; return { ok: true, returnedItem: { ...listing.item, quantity: listing.quantity } };
}
export function expireAuctions(house, now = Date.now()) {
  const expired = house.listings.filter(x => x.state === "active" && x.expiresAt <= now);
  for (const listing of expired) listing.state = "expired";
  return expired.map(x => ({ sellerId: x.sellerId, item: { ...x.item, quantity: x.quantity } }));
}
