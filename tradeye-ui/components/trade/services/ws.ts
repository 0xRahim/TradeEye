/**
 * Streaming facade. Same rule as api.ts: UI subscribes here, never to the
 * demo feed directly. A real backend replaces the body of `subscribe`
 * with a WebSocket subscription publishing identical `MarketTick`s.
 */
import type { Symbol } from "../constants";
import type { TickHandler } from "./types";
import { subscribeTicks } from "./demo/feed";

export const ws = {
  subscribe(symbol: Symbol, handler: TickHandler): () => void {
    return subscribeTicks(symbol, handler);
  },
};
