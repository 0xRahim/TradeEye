import { SUPPORTED_SYMBOLS, handleOptions, json, jsonError } from "../lib/biquote";

export const config = { runtime: "edge" };

/** Tickers served by the price API. The UI symbol list is driven by this. */
export default function handler(req: Request): Response {
  const early = handleOptions(req);
  if (early) return early;

  if (req.method !== "GET") {
    return jsonError("Method Not Allowed", 405);
  }

  return json(
    { symbols: SUPPORTED_SYMBOLS },
    200,
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
}
