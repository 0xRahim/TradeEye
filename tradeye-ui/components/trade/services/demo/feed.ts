/**
 * Demo tick feed. Replays each subscribed symbol's 1m closes forward on a
 * 600 ms loop (values stay real/synthetic-deterministic; only the timeline
 * is "now"). Loops when the series is exhausted. Paused during bar replay
 * (P5) via `setPaused`.
 */
import type { Symbol } from "../../constants";
import type { MarketTick, TickHandler } from "../types";
import { getSyntheticCandles } from "./synthetic";

const INTERVAL_MS = 600;

interface Sub {
  index: number;
  closes: number[];
  handlers: Set<TickHandler>;
}

const subs = new Map<Symbol, Sub>();
let timer: ReturnType<typeof setInterval> | null = null;
let paused = false;

function ensureTimer(): void {
  if (timer || subs.size === 0) return;
  timer = setInterval(() => {
    if (paused) return;
    const now = Math.floor(Date.now() / 1000);
    for (const [sym, sub] of subs) {
      if (sub.handlers.size === 0 || sub.closes.length === 0) continue;
      sub.index = (sub.index + 1) % sub.closes.length;
      const price = sub.closes[sub.index]!;
      const tick: MarketTick = { symbol: sym, price, time: now };
      for (const h of sub.handlers) h(tick);
    }
  }, INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}

function maybeStopTimer(): void {
  let active = false;
  for (const sub of subs.values()) {
    if (sub.handlers.size > 0) {
      active = true;
      break;
    }
  }
  if (!active && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function subscribeTicks(sym: Symbol, handler: TickHandler): () => void {
  let sub = subs.get(sym);
  if (!sub) {
    const bars = getSyntheticCandles(sym, "1m");
    sub = {
      index: Math.max(bars.length - 2, 0),
      closes: bars.map((b) => b.close),
      handlers: new Set(),
    };
    subs.set(sym, sub);
  }
  sub.handlers.add(handler);
  ensureTimer();
  return () => {
    const s = subs.get(sym);
    if (!s) return;
    s.handlers.delete(handler);
    maybeStopTimer();
  };
}

export function setFeedPaused(p: boolean): void {
  paused = p;
}

export function isFeedPaused(): boolean {
  return paused;
}
