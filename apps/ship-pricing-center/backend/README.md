# Ship Pricing Center Backend

Node.js + Express API for `ship-pricing-center`.

## Endpoints

- `GET /api/health` public health check.
- `GET /api/orders`, `/api/segments`, `/api/skus`, `/api/shipping-analysis`, `/api/stores/analytics` protected with API key.
- `PUT/POST/DELETE /api/shipping-rules` and cause assignment endpoints protected with API key.
- `GET/PUT /api/solutions` and order solution assignment endpoints protected with API key.

## Configuration

Create `.env` from `.env.example`. The backend can read database credentials from either environment variables or an existing Pronto AI `keys.json` using `SHIP_PRICING_KEYS_JSON`.

API requests use `x-api-key: <key>` or `Authorization: Bearer <key>`.

Supported key variables:

- `API_KEY`
- `API_KEYS`
- `PARTS_AVAILABILITY_API_KEY`

Endpoint details live in `docs/api-endpoints-reference.md`.

## Run

```bash
npm install
npm run dev
```
