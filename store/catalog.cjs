'use strict';

const CATALOG = Object.freeze({
  checkoutEnabled: false,
  currency: 'USD',
  products: Object.freeze([
    Object.freeze({ id: 'outfit-starlight', name: 'Starlight Outfit', category: 'cosmetic', priceCents: 499, enabled: false }),
    Object.freeze({ id: 'mount-glasswing', name: 'Glasswing Stag', category: 'cosmetic-mount', priceCents: 799, enabled: false }),
    Object.freeze({ id: 'pet-moonfox', name: 'Moonlit Fox', category: 'cosmetic-pet', priceCents: 299, enabled: false }),
    Object.freeze({ id: 'character-slot', name: 'Character Slot', category: 'account-service', priceCents: 499, enabled: false }),
  ]),
});

function getCatalog() {
  return JSON.parse(JSON.stringify(CATALOG));
}

module.exports = { getCatalog };
