# Store system

Store catalog and purchase policy are separated from game menus and account code.

- `catalog.cjs` is the server-side catalog consumed by `GET /api/store/catalog`.
- Every current product has `enabled: false`; the realm UI is a preview.
- `POST /api/store/checkout` returns `503` until a payment provider, signed webhook verification, idempotent fulfillment, and refund handling are implemented.

Paid entitlements must be granted by the backend after provider verification. Keep payment secrets out of `client/` and `src/`; do not trust a purchase claim from the browser.
