/**
 * Candle access with source switch. "bundled" tries real JSON first and
 * falls back to synthetic when files are absent; the `real` flag tells the
 * UI which one it got so the footer caption stays honest.
 */
import type { Symbol, Timeframe } from "../../constants";
import type { Candle } from "../types";
import { loadBundledCandles } from "./binance-json";
import { getSyntheticCandles } from "./synthetic";

export interface CandleResult {
  candles: Candle[];
  /** True when the bars came from bundled real history. */
  real: boolean;
}

export async function getCandles(
  sym: Symbol,
  tf: Timeframe,
  source: "synthetic" | "bundled",
): Promise<CandleResult> {
  if (source === "bundled") {
    const real = await loadBundledCandles(sym, tf);
    if (real) return { candles: real, real: true };
  }
  return { candles: getSyntheticCandles(sym, tf), real: false };
}
