"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TIMEFRAME_SECONDS, type DataSource, type Symbol, type Timeframe } from "../constants";
import { api } from "../services/api";
import { ws } from "../services/ws";
import { mergeCandles } from "../lib/candle-builder";
import type { Candle } from "../services/types";

/** Bars per scroll-left backfill fetch (matches the initial load size). */
export const BACKFILL_CHUNK = 1000;

export interface MarketData {
  candles: Candle[];
  /** True when bars came from real history (bundled files or live API). */
  real: boolean;
  loading: boolean;
  /** Prepend the next older live chunk (no-op unless source is "live"). */
  loadOlder: () => void;
  loadingOlder: boolean;
  /** True when the feed returned no older bars (end of upstream history). */
  olderExhausted: boolean;
  /**
   * Replace history with a window ending at `to` (1000 bars) for replay
   * jumps. Live-only; resolves with the final candles so callers can clamp.
   * Never rejects — failure resolves with the current candles.
   */
  loadWindow: (to: number) => Promise<Candle[]>;
}

interface Request {
  symbol: Symbol;
  timeframe: Timeframe;
  source: DataSource;
}

const EMPTY: MarketData = {
  candles: [],
  real: false,
  loading: true,
  loadOlder: () => {},
  loadingOlder: false,
  olderExhausted: false,
  loadWindow: () => Promise.resolve([]),
};

interface BackfillState {
  exhausted: boolean;
  loading: boolean;
}

export function useMarketData(
  symbol: Symbol,
  timeframe: Timeframe,
  source: DataSource,
): MarketData {
  const [request, setRequest] = useState<Request>({ symbol, timeframe, source });
  const [state, setState] = useState<MarketData>(EMPTY);
  const [backfill, setBackfill] = useState<BackfillState>({
    exhausted: false,
    loading: false,
  });

  // Reset to loading during render when inputs change (React-endorsed
  // derived-state pattern — keeps the reset out of effects).
  if (
    request.symbol !== symbol ||
    request.timeframe !== timeframe ||
    request.source !== source
  ) {
    setRequest({ symbol, timeframe, source });
    setState(EMPTY);
    setBackfill({ exhausted: false, loading: false });
  }

  // Latest snapshots for the async backfill path (refs updated in effects —
  // never mutated during render).
  const candlesRef = useRef<Candle[]>([]);
  useEffect(() => {
    candlesRef.current = state.candles;
  }, [state.candles]);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);
  const inflightRef = useRef(false);
  useEffect(() => {
    inflightRef.current = false;
  }, [request]);
  const windowSeqRef = useRef(0);

  useEffect(() => {
    let live = true;
    api
      .getCandles(request.symbol, request.timeframe, request.source)
      .then(({ candles, real }) => {
        if (live) setState((s) => ({ ...s, candles, real, loading: false }));
      })
      .catch(() => {
        if (live) setState((s) => ({ ...s, candles: [], real: false, loading: false }));
      });
    return () => {
      live = false;
    };
  }, [request]);

  const loadOlder = useCallback(() => {
    const req = requestRef.current;
    if (req.source !== "live") return;
    if (inflightRef.current || backfill.exhausted || backfill.loading) return;
    const current = candlesRef.current;
    if (current.length === 0) return;
    const earliest = current[0]!.time;
    const intervalSec = TIMEFRAME_SECONDS[req.timeframe];
    const to = new Date((earliest - 1) * 1000).toISOString();
    const from = new Date(
      (earliest - 1 - BACKFILL_CHUNK * intervalSec) * 1000,
    ).toISOString();
    inflightRef.current = true;
    setBackfill((b) => ({ ...b, loading: true }));
    api
      .getOlderCandles(req.symbol, req.timeframe, { from, to })
      .then((older) => {
        inflightRef.current = false;
        if (requestRef.current !== req) return; // stale (inputs changed)
        const merged = mergeCandles(candlesRef.current, older);
        const added = merged.length - candlesRef.current.length;
        setState((s) => ({ ...s, candles: mergeCandles(s.candles, older) }));
        setBackfill({ loading: false, exhausted: added === 0 });
      })
      .catch(() => {
        inflightRef.current = false;
        if (requestRef.current !== req) return;
        setBackfill((b) => ({ ...b, loading: false }));
      });
  }, [backfill.exhausted, backfill.loading]);

  const loadWindow = useCallback(
    async (to: number): Promise<Candle[]> => {
      const req = requestRef.current;
      if (req.source !== "live") return candlesRef.current;
      if (!Number.isFinite(to)) return candlesRef.current;
      const seq = (windowSeqRef.current += 1);
      inflightRef.current = true;
      setBackfill((b) => ({ ...b, loading: true }));
      const intervalSec = TIMEFRAME_SECONDS[req.timeframe];
      const end = new Date(to * 1000).toISOString();
      const start = new Date((to - BACKFILL_CHUNK * intervalSec) * 1000).toISOString();
      try {
        const window = await api.getOlderCandles(req.symbol, req.timeframe, {
          from: start,
          to: end,
        });
        if (requestRef.current !== req || windowSeqRef.current !== seq) {
          return candlesRef.current; // stale (inputs changed / superseded)
        }
        setState((s) => ({ ...s, candles: window, real: true, loading: false }));
        setBackfill({ loading: false, exhausted: false });
        return window;
      } catch {
        return candlesRef.current;
      } finally {
        inflightRef.current = false;
        if (requestRef.current === req && windowSeqRef.current === seq) {
          setBackfill((b) => ({ ...b, loading: false }));
        }
      }
    },
    [],
  );

  return {
    ...state,
    loadOlder,
    loadingOlder: backfill.loading,
    olderExhausted: backfill.exhausted,
    loadWindow,
  };
}

export function useLivePrice(symbol: Symbol, live = false): number | null {
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [price, setPrice] = useState<number | null>(null);

  if (activeSymbol !== symbol) {
    setActiveSymbol(symbol);
    setPrice(null);
  }

  useEffect(() => {
    return ws.subscribe(symbol, (tick) => setPrice(tick.price), { live });
  }, [symbol, live]);

  return price;
}
