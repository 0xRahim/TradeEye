/**
 * REST-shaped facade. UI code talks only to this module (and ws.ts) —
 * never to `./demo/*` directly — so the future backend swap touches
 * just these two files.
 */
import { SYMBOLS, type DataSource, type Symbol, type Timeframe } from "../constants";
import type { DrawingLine } from "../drawings/constants";
import { getCandles as demoGetCandles, type CandleResult } from "./demo/candles";
import { fetchCandles as fetchLiveCandles } from "./market-api";
import { drawingsStore } from "./drawings-store";
import type { Candle } from "./types";

export interface SymbolInfo {
  symbol: Symbol;
}

export const api = {
  getSymbols(): SymbolInfo[] {
    return SYMBOLS.map((symbol) => ({ symbol }));
  },

  getCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    source: DataSource,
  ): Promise<CandleResult> {
    return demoGetCandles(symbol, timeframe, source);
  },

  /** Older live chunk for scroll-left backfill (live source only). */
  getOlderCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    range: { from: string; to: string },
  ): Promise<Candle[]> {
    return fetchLiveCandles(symbol, timeframe, range);
  },

  chartDrawings: {
    list(symbol: Symbol): Promise<DrawingLine[]> {
      return drawingsStore.list(symbol);
    },
    save(symbol: Symbol, drawing: DrawingLine): Promise<void> {
      return drawingsStore.save(symbol, drawing);
    },
    remove(symbol: Symbol, id: string): Promise<void> {
      return drawingsStore.remove(symbol, id);
    },
    clear(symbol: Symbol): Promise<void> {
      return drawingsStore.clear(symbol);
    },
  },
};
