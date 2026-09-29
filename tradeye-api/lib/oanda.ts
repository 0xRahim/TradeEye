/**
 * OANDA v20 price feed (default feed). Key + account stay server-side;
 * never expose them to the browser. Requires OANDA_API_KEY; OANDA_ENV
 * ("practice" default, or "live") must match where the token was made.
 * OANDA_ACCOUNT_ID is required for quotes (pricing endpoint only).
 */
import type { Interval } from "./biquote";
import { FEED_TIMEOUT_MS, type Candle, type Quote } from "./types";

/** Display + day-bucket timezone, shared with the UI chart. */
export const OANDA_TZ = "Europe/London";

const INSTRUMENTS: Record<string, string> = {
  BTCUSD: "BTC_USD",
  EURUSD: "EUR_USD",
  GBPUSD: "GBP_USD",
  XAUUSD: "XAU_USD",
};

const GRANULARITY: Record<Interval, string> = {
  "1m": "M1",
  "5m": "M5",
  "15m": "M15",
  "30m": "M30",
  "1h": "H1",
  "4h": "H4",
  "1d": "D",
  "1w": "W",
};

export class OandaError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

interface OandaConfig {
  key: string;
  rest: string;
  accountId: string | null;
}

function oandaConfig(): OandaConfig | null {
  const key = (process.env.OANDA_API_KEY ?? "").trim();
  if (!key) return null;
  const env = (process.env.OANDA_ENV ?? "practice").trim().toLowerCase();
  const rest =
    env === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com";
  const accountId = (process.env.OANDA_ACCOUNT_ID ?? "").trim() || null;
  return { key, rest, accountId };
}

/** True when OANDA can be tried (key present). Used for fallback routing. */
export function oandaConfigured(): boolean {
  return oandaConfig() != null;
}

function hasErrorMessage(body: unknown): body is { errorMessage: unknown } {
  return typeof body === "object" && body !== null && "errorMessage" in body;
}

async function oandaGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const cfg = oandaConfig();
  if (!cfg) throw new OandaError("Price feed not configured");
  const url = new URL(cfg.rest + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Accept-Datetime-Format": "RFC3339",
      },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
  } catch {
    throw new OandaError("Price feed unreachable");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    throw new OandaError("Price feed returned invalid data");
  }
  // OANDA reports problems (bad instrument, bad key, …) in-body, sometimes
  // with HTTP 200 — check both.
  if (!res.ok || hasErrorMessage(body)) {
    throw new OandaError("Price feed error");
  }
  return body as T;
}

/** OANDA timestamps carry nanoseconds; JS dates parse milliseconds at most. */
function oandaEpoch(t: unknown): number {
  if (typeof t !== "string") return NaN;
  const ms = t.replace(/\.(\d{3})\d*Z$/, ".$1Z");
  return Math.floor(Date.parse(ms) / 1000);
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

interface OandaCandle {
  complete?: unknown;
  volume?: unknown;
  time?: unknown;
  mid?: { o?: unknown; h?: unknown; l?: unknown; c?: unknown } | null;
}

function toCandle(c: OandaCandle): Candle | null {
  const time = oandaEpoch(c.time);
  const open = num(c.mid?.o);
  const high = num(c.mid?.h);
  const low = num(c.mid?.l);
  const close = num(c.mid?.c);
  const volume = typeof c.volume === "number" && Number.isFinite(c.volume) ? c.volume : 0;
  if (!Number.isFinite(time) || open == null || high == null || low == null || close == null) {
    return null;
  }
  return { time, open, high, low, close, volume, isOpen: c.complete !== true };
}

export type CandleRange = { limit: number } | { from: string; to: string };

/** Mid-based OHLC history + forming bar, ascending and de-duplicated. */
export async function oandaCandles(
  symbol: string,
  interval: Interval,
  range: CandleRange,
): Promise<Candle[]> {
  const instrument = INSTRUMENTS[symbol];
  if (!instrument) throw new OandaError("Price feed error");
  const params: Record<string, string> = {
    granularity: GRANULARITY[interval],
    price: "M",
    alignmentTimezone: OANDA_TZ,
  };
  if ("limit" in range) {
    params["count"] = String(range.limit);
  } else {
    params["from"] = range.from;
    params["to"] = range.to;
  }
  const data = await oandaGet<{ candles?: unknown }>(
    `/v3/instruments/${instrument}/candles`,
    params,
  );
  const raw = Array.isArray(data.candles) ? (data.candles as OandaCandle[]) : [];
  const seen = new Set<number>();
  const out: Candle[] = [];
  for (const c of raw) {
    const mapped = toCandle(c);
    if (!mapped || seen.has(mapped.time)) continue;
    seen.add(mapped.time);
    out.push(mapped);
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

interface OandaPrice {
  instrument?: unknown;
  time?: unknown;
  bids?: Array<{ price?: unknown }>;
  asks?: Array<{ price?: unknown }>;
  tradeable?: unknown;
}

/** Latest bid/ask snapshot (mid-derived price). Needs OANDA_ACCOUNT_ID. */
export async function oandaQuote(symbol: string): Promise<Quote> {
  const cfg = oandaConfig();
  const instrument = INSTRUMENTS[symbol];
  if (!cfg || !cfg.accountId || !instrument) {
    throw new OandaError("Price feed not configured");
  }
  const data = await oandaGet<{ prices?: unknown }>(
    `/v3/accounts/${cfg.accountId}/pricing`,
    { instruments: instrument },
  );
  const prices = Array.isArray(data.prices) ? (data.prices as OandaPrice[]) : [];
  const p = prices.find((entry) => entry.instrument === instrument) ?? prices[0];
  const bid = num(p?.bids?.[0]?.price);
  const ask = num(p?.asks?.[0]?.price);
  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
  const time = oandaEpoch(p?.time);
  if (mid == null || !Number.isFinite(time)) {
    throw new OandaError("Price feed returned invalid data");
  }
  return {
    symbol,
    bid,
    ask,
    mid,
    price: mid,
    time,
    marketState: p?.tradeable === false ? "closed" : "open",
  };
}
