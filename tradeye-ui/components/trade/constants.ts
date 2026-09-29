// Instrument + timeframe constants. Values mirror the OpenCharts demo set
// so the future Binance-JSON loader and API seam stay compatible.

export const SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "BNBUSD",
  "XRPUSD",
  "ADAUSD",
  "EURUSD",
  "GBPUSD",
  "XAUUSD",
] as const;

export type Symbol = (typeof SYMBOLS)[number];

/** Tickers served by the Tradeye price API (/api/symbols). */
export const LIVE_SYMBOLS = ["BTCUSD", "EURUSD", "GBPUSD", "XAUUSD"] as const;

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

/** Seconds per timeframe bar. Used to slice/aggregate the master 1m series. */
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

export type DataSource = "synthetic" | "bundled" | "live";
