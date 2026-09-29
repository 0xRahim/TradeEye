import {
  handleOptions,
  json,
  jsonError,
  normalizeSymbol,
} from "../lib/biquote";
import { feedError, getQuote } from "../lib/feed";

export const config = { runtime: "edge" };

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
    const quote = await getQuote(symbol);
    return json(quote, 200, "public, s-maxage=5, stale-while-revalidate=60");
  } catch (err) {
    const { message, status } = feedError(err);
    return jsonError(message, status);
  }
}
