# tradeye-api

Vercel serverless API (Edge runtime) for Tradeye. Bun-managed.

To install dependencies:

```bash
bun install
```

Local dev (Vercel emulator on :3001):

```bash
bun run vercel-dev
# GET http://localhost:3001/api/hello?name=ray
```

Price API (OANDA v20 default feed, biquote.io fallback on errors):

```bash
# Tickers served (drives the UI symbol list)
# GET /api/symbols -> { symbols: [{ symbol, description, exchange }] }

# Latest quote (realtime trading)
# GET /api/quote?symbol=EURUSD -> { symbol, bid, ask, mid, price, time, marketState, feed }

# OHLC history + forming bar (chart + backtesting)
# GET /api/candles?symbol=BTCUSD&interval=1h&limit=500
# GET /api/candles?symbol=EURUSD&interval=1d&from=2026-01-01T00:00:00Z&to=2026-09-01T00:00:00Z
# -> { symbol, interval, candles: [{ time, open, high, low, close, volume, isOpen }], feed }
# Symbols: BTCUSD, EURUSD, GBPUSD, XAUUSD. Intervals: 1m,5m,15m,30m,1h,4h,1d,1w.
# `feed` is "oanda" or "biquote". Day/week buckets align to UK time
# (Europe/London) on both feeds; the UI chart uses the same zone.
```

Feed config (`OANDA_API_KEY`, `OANDA_ENV=practice|live`, `OANDA_ACCOUNT_ID`)
lives in server env only — see `.env.example`. Without a key the API serves
biquote throughout.

Typecheck:

```bash
bun run typecheck
```

Deploy as standalone Vercel project with root `tradeye-api/`:

```bash
bunx vercel --prod
```
