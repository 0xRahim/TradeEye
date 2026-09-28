"use client";

import { useEffect, useState } from "react";
import type { DataSource, Symbol, Timeframe } from "../constants";
import { api } from "../services/api";
import { ws } from "../services/ws";
import type { Candle } from "../services/types";

export interface MarketData {
  candles: Candle[];
  /** True when bars came from bundled real history. */
  real: boolean;
  loading: boolean;
}

interface Request {
  symbol: Symbol;
  timeframe: Timeframe;
  source: DataSource;
}

const EMPTY: MarketData = { candles: [], real: false, loading: true };

export function useMarketData(
  symbol: Symbol,
  timeframe: Timeframe,
  source: DataSource,
): MarketData {
  const [request, setRequest] = useState<Request>({ symbol, timeframe, source });
  const [state, setState] = useState<MarketData>(EMPTY);

  // Reset to loading during render when inputs change (React-endorsed
  // derived-state pattern — keeps the reset out of effects).
  if (
    request.symbol !== symbol ||
    request.timeframe !== timeframe ||
    request.source !== source
  ) {
    setRequest({ symbol, timeframe, source });
    setState(EMPTY);
  }

  useEffect(() => {
    let live = true;
    api
      .getCandles(request.symbol, request.timeframe, request.source)
      .then(({ candles, real }) => {
        if (live) setState({ candles, real, loading: false });
      })
      .catch(() => {
        if (live) setState({ candles: [], real: false, loading: false });
      });
    return () => {
      live = false;
    };
  }, [request]);

  return state;
}

export function useLivePrice(symbol: Symbol): number | null {
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [price, setPrice] = useState<number | null>(null);

  if (activeSymbol !== symbol) {
    setActiveSymbol(symbol);
    setPrice(null);
  }

  useEffect(() => {
    return ws.subscribe(symbol, (tick) => setPrice(tick.price));
  }, [symbol]);

  return price;
}
