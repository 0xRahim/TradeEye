/**
 * In-memory paper trading engine (stub for the future trading backend).
 * $100k starting balance, 100x leverage, no commission. Market orders fill
 * immediately at the quoted price; resting behavior is NOT simulated —
 * SL/TP are evaluated on every mark() and close at their level.
 * State resets on reload. UI consumes the `usePaper` hook; a real backend
 * will replace this module behind `api.trading` without touching UI code.
 */
import { create } from "zustand";

export type Side = "long" | "short";
export type CloseReason = "manual" | "stop" | "target";

export const START_BALANCE = 100000;
export const LEVERAGE = 100;

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entry: number;
  stop?: number;
  target?: number;
  openTime: number;
  mark: number;
}

export interface FillRecord {
  id: string;
  time: number;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  kind: "open" | "close";
  pnl?: number;
  reason?: CloseReason;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  reason: CloseReason;
  openTime: number;
  closeTime: number;
}

export interface Quote {
  /** Reference price (tick or bar close) for MtM. */
  price: number;
  /** Bar range for SL/TP evaluation (ticks: high=low=price). */
  high: number;
  low: number;
}

const dir = (side: Side): number => (side === "long" ? 1 : -1);

export function unrealized(p: Position, mark: number): number {
  return (mark - p.entry) * dir(p.side) * p.qty;
}

interface PaperState {
  balance: number;
  positions: Position[];
  fills: FillRecord[];
  closed: ClosedTrade[];
  marks: Record<string, number>;
  equity: number;
  usedMargin: number;
  marketOrder: (
    symbol: string,
    side: Side,
    qty: number,
    quote: Quote,
    opts?: { stop?: number; target?: number },
  ) => { ok: boolean; error?: string };
  modifyPosition: (id: string, patch: { stop?: number; target?: number }) => void;
  closePosition: (id: string, price: number, reason: CloseReason) => void;
  closeAll: (marks: Record<string, number>) => void;
  /** Mark-to-market + SL/TP evaluation. Call on every tick / replay step. */
  mark: (symbol: string, quote: Quote) => void;
  reset: () => void;
}

function notional(p: Position, mark: number): number {
  return Math.abs(mark * p.qty);
}

function recompute(
  balance: number,
  positions: Position[],
  marks: Record<string, number>,
): { equity: number; usedMargin: number } {
  let upnl = 0;
  let used = 0;
  for (const p of positions) {
    const m = marks[p.symbol] ?? p.mark;
    upnl += unrealized(p, m);
    used += notional(p, m) / LEVERAGE;
  }
  return { equity: balance + upnl, usedMargin: used };
}

function closeAt(
  p: Position,
  price: number,
  reason: CloseReason,
  time: number,
): { trade: ClosedTrade; fill: FillRecord } {
  const pnl = unrealized(p, price);
  return {
    trade: {
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      qty: p.qty,
      entry: p.entry,
      exit: price,
      pnl,
      reason,
      openTime: p.openTime,
      closeTime: time,
    },
    fill: {
      id: crypto.randomUUID(),
      time,
      symbol: p.symbol,
      side: p.side,
      qty: p.qty,
      price,
      kind: "close",
      pnl,
      reason,
    },
  };
}

export const usePaper = create<PaperState>((set, get) => ({
  balance: START_BALANCE,
  positions: [],
  fills: [],
  closed: [],
  marks: {},
  equity: START_BALANCE,
  usedMargin: 0,

  marketOrder: (symbol, side, qty, quote, opts) => {
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Qty must be > 0." };
    if (!Number.isFinite(quote.price) || quote.price <= 0)
      return { ok: false, error: "No price available." };
    const { stop, target } = opts ?? {};
    if (stop != null && !(stop > 0)) return { ok: false, error: "Invalid stop." };
    if (target != null && !(target > 0)) return { ok: false, error: "Invalid target." };
    if (stop != null && target != null) {
      const okSide =
        side === "long" ? stop < quote.price && target > quote.price : stop > quote.price && target < quote.price;
      if (!okSide) return { ok: false, error: "Stop/target must bracket the price." };
    }
    const now = Math.floor(Date.now() / 1000);
    const pos: Position = {
      id: crypto.randomUUID(),
      symbol,
      side,
      qty,
      entry: quote.price,
      stop,
      target,
      openTime: now,
      mark: quote.price,
    };
    const fills: FillRecord = {
      id: crypto.randomUUID(),
      time: now,
      symbol,
      side,
      qty,
      price: quote.price,
      kind: "open",
    };
    const positions = [...get().positions, pos];
    const marks = { ...get().marks, [symbol]: quote.price };
    const { equity, usedMargin } = recompute(get().balance, positions, marks);
    set({ positions, fills: [...get().fills, fills], marks, equity, usedMargin });
    return { ok: true };
  },

  modifyPosition: (id, patch) => {
    const positions = get().positions.map((p) =>
      p.id === id ? { ...p, stop: patch.stop, target: patch.target } : p,
    );
    const { equity, usedMargin } = recompute(get().balance, positions, get().marks);
    set({ positions, equity, usedMargin });
  },

  closePosition: (id, price, reason) => {
    const p = get().positions.find((x) => x.id === id);
    if (!p) return;
    const now = Math.floor(Date.now() / 1000);
    const { trade, fill } = closeAt(p, price, reason, now);
    const positions = get().positions.filter((x) => x.id !== id);
    const balance = get().balance + trade.pnl;
    const marks = { ...get().marks, [p.symbol]: price };
    const { equity, usedMargin } = recompute(balance, positions, marks);
    set({
      positions,
      balance,
      fills: [...get().fills, fill],
      closed: [...get().closed, trade],
      marks,
      equity,
      usedMargin,
    });
  },

  closeAll: (marks) => {
    const now = Math.floor(Date.now() / 1000);
    const trades: ClosedTrade[] = [];
    const fills: FillRecord[] = [];
    let balance = get().balance;
    for (const p of get().positions) {
      const price = marks[p.symbol] ?? p.mark;
      const { trade, fill } = closeAt(p, price, "manual", now);
      trades.push(trade);
      fills.push(fill);
      balance += trade.pnl;
    }
    const merged = { ...get().marks, ...marks };
    const { equity, usedMargin } = recompute(balance, [], merged);
    set({ positions: [], balance, fills: [...get().fills, ...fills], closed: [...get().closed, ...trades], marks: merged, equity, usedMargin });
  },

  mark: (symbol, quote) => {
    const now = Math.floor(Date.now() / 1000);
    let { positions, balance, fills, closed } = get();
    const marks = { ...get().marks, [symbol]: quote.price };
    const survivors: Position[] = [];
    for (const p of positions) {
      if (p.symbol !== symbol) {
        survivors.push(p);
        continue;
      }
      // Conservative: if both levels trade in one bar, the stop fills first.
      const stopHit =
        p.stop != null &&
        (p.side === "long" ? quote.low <= p.stop : quote.high >= p.stop);
      const targetHit =
        p.target != null &&
        (p.side === "long" ? quote.high >= p.target : quote.low <= p.target);
      if (stopHit && p.stop != null) {
        const { trade, fill } = closeAt(p, p.stop, "stop", now);
        closed = [...closed, trade];
        fills = [...fills, fill];
        balance += trade.pnl;
      } else if (targetHit && p.target != null) {
        const { trade, fill } = closeAt(p, p.target, "target", now);
        closed = [...closed, trade];
        fills = [...fills, fill];
        balance += trade.pnl;
      } else {
        survivors.push({ ...p, mark: quote.price });
      }
    }
    positions = survivors;
    const { equity, usedMargin } = recompute(balance, positions, marks);
    set({ positions, balance, fills, closed, marks, equity, usedMargin });
  },

  reset: () =>
    set({
      balance: START_BALANCE,
      positions: [],
      fills: [],
      closed: [],
      marks: {},
      equity: START_BALANCE,
      usedMargin: 0,
    }),
}));
