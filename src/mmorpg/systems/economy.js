const isSafeCopper = value => Number.isSafeInteger(value) && value >= 0;

export function createWallet(copper = 0) {
  if (!isSafeCopper(copper)) {
    throw new RangeError("Wallet uses non-negative safe copper integers");
  }
  return { copper };
}

export function transferCurrency(from, to, amount) {
  if (!from || !to || from === to || !isSafeCopper(from.copper) || !isSafeCopper(to.copper)) {
    return { ok: false, reason: "invalid_wallet" };
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (from.copper < amount) {
    return { ok: false, reason: "insufficient_funds" };
  }
  if (!Number.isSafeInteger(to.copper + amount)) {
    return { ok: false, reason: "balance_overflow" };
  }

  from.copper -= amount;
  to.copper += amount;
  return { ok: true, balance: from.copper };
}

export function quoteVendorPrice(item, quantity = 1, reputationDiscount = 0) {
  if (!item || !Number.isSafeInteger(item.priceCopper) || item.priceCopper < 0) {
    throw new RangeError("Item price must be a non-negative safe copper integer");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError("Quantity must be a positive safe integer");
  }
  if (!Number.isFinite(reputationDiscount) || reputationDiscount < 0 || reputationDiscount > 1) {
    throw new RangeError("Reputation discount must be between 0 and 1");
  }

  const total = item.priceCopper * quantity * (1 - reputationDiscount);
  if (!Number.isSafeInteger(Math.ceil(total))) {
    throw new RangeError("Quoted price exceeds the safe copper range");
  }
  return Math.ceil(total);
}
