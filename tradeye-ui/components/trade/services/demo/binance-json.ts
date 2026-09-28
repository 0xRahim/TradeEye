/**
 * Loader for bundled real OHLC JSON (Binance klines, fetched at build time).
 * Files live under `public/data/ohlc/<SYMBOL>_<TF>.json` once
 * `scripts/fetch-demo-data.mjs` (P2 follow-up) has run. Until then every
 * load misses and callers fall back to synthetic data.
 */
import type { Symbol, Timeframe } from "../../constants";
import type { Candle } from "../types";

interface RawBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function isCandle(b: RawBar): b is Candle {
  return (
    Number.isFinite(b.time) &&
    Number.isFinite(b.open) &&
    Number.isFinite(b.high) &&
    Number.isFinite(b.low) &&
    Number.isFinite(b.close)
  );
}

export async function loadBundledCandles(
  sym: Symbol,
  tf: Timeframe,
): Promise<Candle[] | null> {
  try {
    const res = await fetch(`/data/ohlc/${sym}_${tf}.json`, { cache: "force-cache" });
    if (!res.ok) return null;
    const raw = (await res.json()) as RawBar[];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const seen = new Set<number>();
    const out: Candle[] = [];
    for (const b of raw) {
      if (!isCandle(b) || seen.has(b.time)) continue;
      seen.add(b.time);
      out.push({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: Number.isFinite(b.volume) ? b.volume : 0,
      });
    }
    out.sort((a, b) => a.time - b.time);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
