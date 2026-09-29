# Tradeye

Paper-trading terminal + serverless price/auth API.

- `tradeye-ui/` — Next.js 16 + React 19 trading terminal (`/` landing, `/trade` terminal: live chart, replay, paper trading, drawings)
- `tradeye-api/` — Vercel Edge API (Bun): `POST /api/login`, `GET /api/symbols|quote|candles`. OANDA primary, biquote fallback, Supabase auth.

## Layout

```text
Tradeye/
  tradeye-ui/   # frontend (port 3000)
  tradeye-api/  # serverless API (port 3001 locally)
```

## Prerequisites

- Bun 1.4.2
- Vercel CLI (`bunx vercel`)
- Supabase project (optional OANDA key for live feed)

## Quickstart

Terminal 1 — API:

```bash
cd tradeye-api
cp .env.example .env.local
bun install
bun run vercel-dev
```

Terminal 2 — UI:

```bash
cd tradeye-ui
cp .env.example .env.local
bun install
bun run dev
```

Open http://localhost:3000.

## Env

UI (`tradeye-ui/.env.local`):

- `NEXT_PUBLIC_API_URL` — base API URL, no trailing slash. Restart `next dev` after changing.

API (`tradeye-api/.env.local`, see `.env.example`):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `OANDA_API_KEY`, `OANDA_ENV`, `OANDA_ACCOUNT_ID`
- `BIQUOTE_BASE_URL`

Without an OANDA key the API serves the fallback feed throughout.

## Verify

```bash
# UI
cd tradeye-ui && bun run lint && npx tsc --noEmit && bun run build

# API
cd tradeye-api && bun run typecheck
```

## Deploy

Two standalone Vercel projects, one rooted at `tradeye-ui/`, one at `tradeye-api/`. Set the UI's `NEXT_PUBLIC_API_URL` to your API URL; keep server secrets on the API project only.

See `tradeye-api/README.md` and `tradeye-ui/CONTEXT.md` for details.

## License

MIT
