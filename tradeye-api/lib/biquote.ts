/**
 * Shared market-data helpers for the price endpoints. Upstream feed is
 * biquote.io (no key required; base URL overridable via BIQUOTE_BASE_URL).
 */

export interface SymbolMeta {
  symbol: string;
  description: string;
  exchange: string;
}

/** Tickers served by our API — the UI dropdown is driven by /api/symbols. */
export const SUPPORTED_SYMBOLS: readonly SymbolMeta[] = [
  { symbol: "BTCUSD", description: "Bitcoin vs US Dollar", exchange: "CRYPTO" },
  { symbol: "EURUSD", description: "Euro vs US Dollar", exchange: "FOREX" },
  { symbol: "GBPUSD", description: "Great Britain Pound vs US Dollar", exchange: "FOREX" },
  { symbol: "XAUUSD", description: "Gold vs US Dollar", exchange: "COMEX" },
];

const SYMBOL_SET = new Set(SUPPORTED_SYMBOLS.map((s) => s.symbol));

/** Intervals accepted by /api/candles (passed straight to upstream). */
export const SUPPORTED_INTERVALS = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
] as const;

export type Interval = (typeof SUPPORTED_INTERVALS)[number];

const INTERVAL_SET = new Set<string>(SUPPORTED_INTERVALS);

export function isSupportedInterval(v: string): v is Interval {
  return INTERVAL_SET.has(v);
}

export const GET_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

export function json(data: unknown, status = 200, cache?: string): Response {
  const headers: Record<string, string> = {
    ...GET_CORS_HEADERS,
    "Content-Type": "application/json",
  };
  if (cache) headers["Cache-Control"] = cache;
  return Response.json(data, { status, headers });
}

export function jsonError(error: string, status: number): Response {
  return json({ error }, status);
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: GET_CORS_HEADERS });
  }
  return null;
}

/** Uppercase + allowlist check. Returns null when unknown. */
export function normalizeSymbol(raw: string | null): string | null {
  if (!raw) return null;
  const sym = raw.trim().toUpperCase();
  return SYMBOL_SET.has(sym) ? sym : null;
}

export function biquoteBase(): string {
  const raw = (process.env.BIQUOTE_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return raw || "https://biquote.io";
}

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function fetchUpstream<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${biquoteBase()}${path}`);
  } catch {
    throw new UpstreamError("Price feed unreachable");
  }
  if (!res.ok) {
    throw new UpstreamError(`Price feed error (${res.status})`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError("Price feed returned invalid data");
  }
}

export interface UpstreamBar {
  openTime?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
  tickVolume?: unknown;
  isOpen?: unknown;
}

export interface Candle {
  /** Unix seconds, ascending. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True for the still-forming bar. */
  isOpen: boolean;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Map upstream bars (newest-first) to ascending, de-duplicated candles. */
export function toCandles(bars: UpstreamBar[]): Candle[] {
  const seen = new Set<number>();
  const out: Candle[] = [];
  for (const b of bars) {
    const time =
      typeof b.openTime === "string" ? Math.floor(Date.parse(b.openTime) / 1000) : NaN;
    const volume =
      isFiniteNumber(b.tickVolume) && (b.tickVolume as number) > 0
        ? (b.tickVolume as number)
        : isFiniteNumber(b.volume)
          ? (b.volume as number)
          : 0;
    if (
      !Number.isFinite(time) ||
      !isFiniteNumber(b.open) ||
      !isFiniteNumber(b.high) ||
      !isFiniteNumber(b.low) ||
      !isFiniteNumber(b.close) ||
      seen.has(time)
    ) {
      continue;
    }
    seen.add(time);
    out.push({
      time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume,
      isOpen: b.isOpen === true,
    });
  }
  out.sort((a, b2) => a.time - b2.time);
  return out;
}
