/**
 * Streaming facade. Same rule as api.ts: UI subscribes here, never to the
 * demo feed directly. `{ live: true }` polls the Tradeye price API instead
 * of replaying synthetic ticks (skipped while bar replay is paused).
 */
import type { Symbol } from "../constants";
import type { TickHandler } from "./types";
import { isFeedPaused, subscribeTicks } from "./demo/feed";
import { fetchQuote } from "./market-api";

const LIVE_POLL_MS = 3000;

export const ws = {
  subscribe(
    symbol: Symbol,
    handler: TickHandler,
    opts?: { live?: boolean },
  ): () => void {
    if (!opts?.live) return subscribeTicks(symbol, handler);

    let stopped = false;
    const poll = async (): Promise<void> => {
      if (stopped || isFeedPaused()) return;
      try {
        const quote = await fetchQuote(symbol);
        if (!stopped) handler({ symbol, price: quote.price, time: quote.time });
      } catch {
        // Keep the last price; retry on the next tick.
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, LIVE_POLL_MS);
    if (typeof (timer as unknown as { unref?: unknown }).unref === "function") {
      (timer as unknown as { unref: () => void }).unref();
    }
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  },
};
