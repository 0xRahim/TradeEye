/**
 * Deterministic synthetic OHLC stub. Seeded per symbol so reloads are stable.
 * Intraday TFs aggregate exactly from one master 1m series (keeps replay
 * synced); daily is generated directly and weekly aggregates from daily.
 * Ends are aligned so every TF closes at the same "now" price.
 */
import { TIMEFRAME_SECONDS, type Symbol, type Timeframe } from "../../constants";
import type { Candle } from "../types";

const BASE_PRICE: Record<Symbol, number> = {
  BTCUSD: 67400,
  ETHUSD: 3520,
  SOLUSD: 172,
  BNBUSD: 598,
  XRPUSD: 0.62,
  ADAUSD: 0.58,
};

/** Bars per TF returned by the stub. */
const BAR_COUNT: Record<Timeframe, number> = {
  "1m": 43200, // 30d master
  "5m": 8640,
  "15m": 2880,
  "30m": 1440,
  "1h": 1000,
  "4h": 1000,
  "1d": 1000,
  "1w": 140, // capped by available daily history (1000d / 7)
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller gaussian from a uniform RNG. */
function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round(sym: Symbol, v: number): number {
  const p = BASE_PRICE[sym] < 10 ? 4 : 2;
  const f = 10 ** p;
  return Math.round(v * f) / f;
}

/**
 * Walk prices backward from `endPrice` so the series always closes exactly
 * at the anchor. Returns oldest-first closes.
 */
function walkBack(
  rand: () => number,
  endPrice: number,
  count: number,
  sigma: number,
): number[] {
  const closes = new Array<number>(count);
  let px = endPrice;
  closes[count - 1] = px;
  for (let i = count - 2; i >= 0; i--) {
    px = px / (1 + sigma * gaussian(rand));
    closes[i] = px;
  }
  return closes;
}

function closesToCandles(
  sym: Symbol,
  closes: number[],
  intervalSec: number,
  endTime: number,
  rand: () => number,
): Candle[] {
  const out: Candle[] = new Array(closes.length);
  const start = endTime - (closes.length - 1) * intervalSec;
  for (let i = 0; i < closes.length; i++) {
    const prev = i === 0 ? closes[0]! : closes[i - 1]!;
    const close = closes[i]!;
    const open = prev;
    const wick = Math.abs(close - open) * (0.3 + rand() * 0.9) + close * 0.0002;
    out[i] = {
      time: start + i * intervalSec,
      open: round(sym, open),
      high: round(sym, Math.max(open, close) + wick),
      low: round(sym, Math.max(Math.min(open, close) - wick, 0.0001)),
      close: round(sym, close),
      volume: Math.round(10 + rand() * 90),
    };
  }
  return out;
}

function aggregate(
  sym: Symbol,
  srcBars: Candle[],
  srcSec: number,
  intervalSec: number,
  count: number,
): Candle[] {
  const per = intervalSec / srcSec;
  const groups = Math.min(count, Math.floor(srcBars.length / per));
  const out: Candle[] = [];
  const tail = srcBars.slice(srcBars.length - groups * per);
  for (let g = 0; g < groups; g++) {
    const slice = tail.slice(g * per, g * per + per);
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const b of slice) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
    }
    out.push({
      time: last.time - (intervalSec - srcSec),
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    });
  }
  return out;
}

const cache = new Map<string, Candle[]>();

export function getSyntheticCandles(sym: Symbol, tf: Timeframe): Candle[] {
  const key = `${sym}:${tf}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rand = mulberry32(hashSeed(`tradeye:${sym}`));
  const nowMin = Math.floor(Date.now() / 60000) * 60;
  let out: Candle[];

  if (tf === "1d" || tf === "1w") {
    const dailyCloses = walkBack(rand, BASE_PRICE[sym], 1000, 0.022);
    const dayEnd = Math.floor(nowMin / 86400) * 86400;
    const daily = closesToCandles(sym, dailyCloses, 86400, dayEnd, rand);
    out =
      tf === "1d"
        ? daily.slice(-BAR_COUNT["1d"])
        : aggregate(sym, daily, 86400, TIMEFRAME_SECONDS["1w"], BAR_COUNT["1w"]);
  } else if (tf === "1m") {
    const closes = walkBack(rand, BASE_PRICE[sym], BAR_COUNT["1m"], 0.0011);
    out = closesToCandles(sym, closes, 60, nowMin, rand);
  } else {
    const minuteCloses = walkBack(rand, BASE_PRICE[sym], BAR_COUNT["1m"], 0.0011);
    const minutes = closesToCandles(sym, minuteCloses, 60, nowMin, rand);
    out = aggregate(sym, minutes, 60, TIMEFRAME_SECONDS[tf], BAR_COUNT[tf]);
  }

  cache.set(key, out);
  return out;
}

/** Last synthetic close — feeds the tick replay and header price. */
export function getSyntheticLast(sym: Symbol): number {
  return getSyntheticCandles(sym, "1m").at(-1)!.close;
}
