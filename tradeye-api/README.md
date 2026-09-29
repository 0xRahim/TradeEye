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

Price API (upstream: biquote.io, no key required):

```bash
# Tickers served (drives the UI symbol list)
# GET /api/symbols -> { symbols: [{ symbol, description, exchange }] }

# Latest quote (realtime trading)
# GET /api/quote?symbol=EURUSD -> { symbol, bid, ask, mid, price, time, marketState }

# OHLC history + forming bar (chart + backtesting)
# GET /api/candles?symbol=BTCUSD&interval=1h&limit=500
# GET /api/candles?symbol=EURUSD&interval=1d&from=2026-01-01T00:00:00Z&to=2026-09-01T00:00:00Z
# -> { symbol, interval, candles: [{ time, open, high, low, close, volume, isOpen }] }
# Symbols: BTCUSD, EURUSD, GBPUSD, XAUUSD. Intervals: 1m,5m,15m,30m,1h,4h,1d,1w.
```

Typecheck:

```bash
bun run typecheck
```

Deploy as standalone Vercel project with root `tradeye-api/`:

```bash
bunx vercel --prod
```
