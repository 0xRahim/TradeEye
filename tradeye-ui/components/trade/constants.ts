// Instrument + timeframe constants. Symbols are the tickers served by the
// Tradeye price API (/api/symbols); the dropdown refreshes from there with
// this list as fallback.

export const SYMBOLS = ["BTCUSD", "EURUSD", "GBPUSD", "XAUUSD"] as const;

export type Symbol = (typeof SYMBOLS)[number];

export const TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

/** Seconds per timeframe bar. */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};
