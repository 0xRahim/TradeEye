/**
 * Feed router: OANDA first, biquote fallback on errors only (never on
 * legitimately empty results, so end-of-history stays honest).
 */
import {
  biquoteCandles,
  biquoteQuote,
  type Interval,
} from "./biquote";
import { oandaCandles, oandaConfigured, oandaQuote } from "./oanda";
import type { Candle, Quote } from "./types";

export type FeedName = "oanda" | "biquote";

export type CandleQuery = { limit: number } | { from: string; to: string };

export function feedError(err: unknown): { message: string; status: number } {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    const message = err instanceof Error && err.message ? err.message : "Price feed error";
    return {
      message,
      status: status >= 400 && status < 600 ? status : 502,
    };
  }
  return { message: "Price feed error", status: 502 };
}

export async function getCandles(
  symbol: string,
  interval: Interval,
  range: CandleQuery,
): Promise<{ candles: Candle[]; feed: FeedName }> {
  if (oandaConfigured()) {
    try {
      const candles = await oandaCandles(symbol, interval, range);
      return { candles, feed: "oanda" };
    } catch {
      // Fall through to biquote.
    }
  }
  const candles = await biquoteCandles(symbol, interval, range);
  return { candles, feed: "biquote" };
}

export async function getQuote(symbol: string): Promise<Quote & { feed: FeedName }> {
  if (oandaConfigured()) {
    try {
      const quote = await oandaQuote(symbol);
      return { ...quote, feed: "oanda" };
    } catch {
      // Fall through to biquote.
    }
  }
  const quote = await biquoteQuote(symbol);
  return { ...quote, feed: "biquote" };
}
