import {
  UpstreamError,
  fetchUpstream,
  handleOptions,
  isSupportedInterval,
  json,
  jsonError,
  normalizeSymbol,
  toCandles,
  type UpstreamBar,
} from "../lib/biquote";

export const config = { runtime: "edge" };

const DEFAULT_INTERVAL = "1h";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;

function parseLimit(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

function parseBound(raw: string | null): string | null {
  if (raw == null || raw.trim() === "") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * OHLC history + forming bar for backtesting and live charts:
 * GET /api/candles?symbol=BTCUSD&interval=1h&limit=500
 * GET /api/candles?symbol=EURUSD&interval=1d&from=2026-01-01T00:00:00Z&to=2026-09-01T00:00:00Z
 */
export default async function handler(req: Request): Promise<Response> {
  const early = handleOptions(req);
  if (early) return early;

  if (req.method !== "GET") {
    return jsonError("Method Not Allowed", 405);
  }

  const params = new URL(req.url).searchParams;
  const symbol = normalizeSymbol(params.get("symbol"));
  if (!symbol) {
    return jsonError("Unknown or missing symbol. See /api/symbols.", 400);
  }

  const intervalRaw = (params.get("interval") ?? DEFAULT_INTERVAL).trim();
  if (!isSupportedInterval(intervalRaw)) {
    return jsonError(
      "Unknown interval. Use one of: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w.",
      400,
    );
  }

  const from = parseBound(params.get("from"));
  const to = parseBound(params.get("to"));
  if ((params.get("from") || params.get("to")) && (!from || !to)) {
    return jsonError("Invalid from/to. Use ISO timestamps.", 400);
  }

  const limit = parseLimit(params.get("limit"));
  if (limit == null) {
    return jsonError("Invalid limit.", 400);
  }

  const query =
    from && to
      ? `interval=${intervalRaw}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : `interval=${intervalRaw}&limit=${limit}`;

  try {
    const data = await fetchUpstream<{ bars?: unknown }>(
      `/api/${symbol}/ohlc?${query}`,
    );
    const bars = Array.isArray(data.bars) ? (data.bars as UpstreamBar[]) : [];
    const candles = toCandles(bars);
    return json(
      { symbol, interval: intervalRaw, candles },
      200,
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  } catch (err) {
    if (err instanceof UpstreamError) return jsonError(err.message, err.status);
    return jsonError("Price feed error", 502);
  }
}
