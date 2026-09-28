"use client";

import { useState } from "react";
import { usePaper, type Side } from "./services/paper-engine";
import { cx } from "./lib/cx";
import type { Symbol } from "./constants";

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function OrderTicket({ symbol, price }: { symbol: Symbol; price: number | null }) {
  const { balance, equity, usedMargin, marketOrder, reset } = usePaper();
  const [side, setSide] = useState<Side>("long");
  const [qty, setQty] = useState("0.01");
  const [useStop, setUseStop] = useState(false);
  const [useTarget, setUseTarget] = useState(false);
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const free = equity - usedMargin;
  const qtyNum = Number.parseFloat(qty);
  const notional = price != null && Number.isFinite(qtyNum) ? price * qtyNum : NaN;

  const quickBracket = () => {
    if (price == null) return;
    const pct = 0.01;
    if (side === "long") {
      setStop(String(price * (1 - pct)));
      setTarget(String(price * (1 + pct)));
    } else {
      setStop(String(price * (1 + pct)));
      setTarget(String(price * (1 - pct)));
    }
    setUseStop(true);
    setUseTarget(true);
  };

  const submit = () => {
    setError(null);
    if (price == null) {
      setError("No price available.");
      return;
    }
    const res = marketOrder(symbol, side, qtyNum, { price, high: price, low: price }, {
      stop: useStop ? Number.parseFloat(stop) : undefined,
      target: useTarget ? Number.parseFloat(target) : undefined,
    });
    if (!res.ok) setError(res.error ?? "Order rejected.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Order ticket</span>
        <button
          type="button"
          title="Reset paper account to $100,000"
          onClick={reset}
          className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-border/50 hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
        <dt className="text-muted">Equity</dt>
        <dd className="text-right">{money(equity)}</dd>
        <dt className="text-muted">Balance</dt>
        <dd className="text-right">{money(balance)}</dd>
        <dt className="text-muted">Used margin</dt>
        <dd className="text-right">{money(usedMargin)}</dd>
        <dt className="text-muted">Free margin</dt>
        <dd className="text-right">{money(free)}</dd>
      </dl>

      <div className="grid grid-cols-2 gap-1 rounded border border-border p-0.5">
        {(["long", "short"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cx(
              "rounded px-2 py-1 text-xs font-semibold capitalize",
              side === s
                ? s === "long"
                  ? "bg-up/20 text-up"
                  : "bg-down/20 text-down"
                : "text-muted hover:bg-border/50",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="block text-xs">
        <span className="text-muted">Qty (units)</span>
        <input
          type="number"
          min="0"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-1.5 py-1 text-right font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      <p className="font-mono text-xs tabular-nums text-muted">
        {Number.isFinite(notional)
          ? `Notional $${money(notional)} · margin $${money(notional / 100)}`
          : "Enter a quantity"}
      </p>

      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={useStop} onChange={(e) => setUseStop(e.target.checked)} />
          Stop-loss
        </label>
        {useStop && (
          <input
            type="number"
            step="any"
            placeholder="Stop price"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-right font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent"
          />
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={useTarget}
            onChange={(e) => setUseTarget(e.target.checked)}
          />
          Take-profit
        </label>
        {useTarget && (
          <input
            type="number"
            step="any"
            placeholder="Target price"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-right font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent"
          />
        )}
        <button
          type="button"
          onClick={quickBracket}
          disabled={price == null}
          className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-border/50 hover:text-foreground disabled:opacity-50"
        >
          Set ±1% bracket
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={price == null}
        className={cx(
          "w-full rounded px-2 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50",
          side === "long" ? "bg-up" : "bg-down",
        )}
      >
        Market {side === "long" ? "Buy" : "Sell"} {symbol}
      </button>
      {error && (
        <p role="alert" className="text-xs text-down">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">Fills immediately at the shown price — no resting book in v1.</p>
    </div>
  );
}
