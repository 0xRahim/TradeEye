"use client";

import { useEffect, useState } from "react";
import { LIVE_SYMBOLS, SYMBOLS, type DataSource, type Symbol } from "../constants";
import { fetchSymbols } from "../services/market-api";

function isSymbol(v: string): v is Symbol {
  return (SYMBOLS as readonly string[]).includes(v);
}

/**
 * Symbol options for the current source. "live" is driven by
 * `GET /api/symbols` (static fallback when the API is unreachable) so the
 * dropdown only shows available tickers; other sources keep the full list.
 */
export function useSymbols(source: DataSource): Symbol[] {
  const [live, setLive] = useState<Symbol[] | null>(null);

  useEffect(() => {
    if (source !== "live") return;
    let on = true;
    fetchSymbols().then((symbols) => {
      if (on) setLive(symbols.filter(isSymbol));
    });
    return () => {
      on = false;
    };
  }, [source]);

  if (source !== "live") return [...SYMBOLS];
  const list = (live ?? [...LIVE_SYMBOLS]).filter(isSymbol);
  return list.length > 0 ? list : [...LIVE_SYMBOLS];
}
