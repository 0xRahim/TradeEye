import {
  UpstreamError,
  fetchUpstream,
  handleOptions,
  json,
  jsonError,
  normalizeSymbol,
} from "../lib/biquote";

export const config = { runtime: "edge" };

interface UpstreamQuote {
  bid?: unknown;
  ask?: unknown;
  mid?: unknown;
  timestamp?: unknown;
  marketState?: unknown;
}

/** Latest quote for one ticker: GET /api/quote?symbol=EURUSD */
export default async function handler(req: Request): Promise<Response> {
  const early = handleOptions(req);
  if (early) return early;

  if (req.method !== "GET") {
    return jsonError("Method Not Allowed", 405);
  }

  const symbol = normalizeSymbol(new URL(req.url).searchParams.get("symbol"));
  if (!symbol) {
    return jsonError("Unknown or missing symbol. See /api/symbols.", 400);
  }

  try {
    const q = await fetchUpstream<UpstreamQuote>(`/api/${symbol}`);
    const bid = typeof q.bid === "number" && Number.isFinite(q.bid) ? q.bid : null;
    const ask = typeof q.ask === "number" && Number.isFinite(q.ask) ? q.ask : null;
    const mid =
      typeof q.mid === "number" && Number.isFinite(q.mid)
        ? q.mid
        : bid != null && ask != null
          ? (bid + ask) / 2
          : null;
    const time =
      typeof q.timestamp === "string" ? Math.floor(Date.parse(q.timestamp) / 1000) : NaN;
    if (mid == null || !Number.isFinite(time)) {
      throw new UpstreamError("Price feed returned invalid data");
    }
    return json(
      {
        symbol,
        bid,
        ask,
        mid,
        price: mid,
        time,
        marketState: typeof q.marketState === "string" ? q.marketState : null,
      },
      200,
      "public, s-maxage=5, stale-while-revalidate=60",
    );
  } catch (err) {
    if (err instanceof UpstreamError) return jsonError(err.message, err.status);
    return jsonError("Price feed error", 502);
  }
}
