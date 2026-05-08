# Picking App Backend

API backend in Node.js + Express for the warehouse `picking-app`.

## Endpoints

- `GET /api/health` → Public health check.
- `GET /api/ping` → Protected with API key.
- `GET /api/databases/status` → Protected, validates connectivity to MySQL, SQL Server, MongoDB, Firebird, and PostgreSQL.

## API Key security

Use one of these headers:

- `x-api-key: <your_key>`
- `Authorization: Bearer <your_key>`

Keys can be configured with:

- `API_KEY`
- `API_KEYS` (comma-separated)
- `PARTS_AVAILABILITY_API_KEY`

## Run

1. Install dependencies
2. Configure `.env`
3. Start server

```bash
npm install
npm run dev
```
