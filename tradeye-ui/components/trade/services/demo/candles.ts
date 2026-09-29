/**
 * Candle access with source switch. "live" hits the Tradeye price API;
 * "bundled" tries real JSON first and falls back to synthetic when files are
 * absent; the `real` flag tells the UI which one it got so the footer
 * caption stays honest.
 */
import type { DataSource, Symbol, Timeframe } from "../../constants";
import type { Candle } from "../types";
import { fetchCandles as fetchLiveCandles } from "../market-api";
import { loadBundledCandles } from "./binance-json";
import { getSyntheticCandles } from "./synthetic";

export interface CandleResult {
  candles: Candle[];
  /** True when the bars came from real history (bundled files or live API). */
  real: boolean;
}

export async function getCandles(
  sym: Symbol,
  tf: Timeframe,
  source: DataSource,
): Promise<CandleResult> {
  if (source === "live") {
    const candles = await fetchLiveCandles(sym, tf);
    return { candles, real: true };
  }
  if (source === "bundled") {
    const real = await loadBundledCandles(sym, tf);
    if (real) return { candles: real, real: true };
  }
  return { candles: getSyntheticCandles(sym, tf), real: false };
}
