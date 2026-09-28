"use client";

import { useState } from "react";
import { unrealized, usePaper, type Position } from "./services/paper-engine";
import { cx } from "./lib/cx";

type Tab = "positions" | "orders" | "history";

function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function PositionRow({ p }: { p: Position }) {
  const { marks, modifyPosition, closePosition } = usePaper();
  const mark = marks[p.symbol] ?? p.mark;
  const pnl = unrealized(p, mark);
  const [stop, setStop] = useState(p.stop != null ? String(p.stop) : "");
  const [target, setTarget] = useState(p.target != null ? String(p.target) : "");

  const commit = () => {
    const s = stop.trim() === "" ? undefined : Number.parseFloat(stop);
    const t = target.trim() === "" ? undefined : Number.parseFloat(target);
    if ((s !== undefined && !Number.isFinite(s)) || (t !== undefined && !Number.isFinite(t))) return;
    modifyPosition(p.id, { stop: s, target: t });
  };

  return (
    <div className="rounded border border-border px-2 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span className={cx("font-semibold capitalize", p.side === "long" ? "text-up" : "text-down")}>
          {p.side}
        </span>
        <span className="font-mono tabular-nums">{p.symbol}</span>
        <span className="font-mono tabular-nums text-muted">{p.qty}</span>
        <span className={cx("ml-auto font-mono tabular-nums", pnl >= 0 ? "text-up" : "text-down")}>
          {money(pnl)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 font-mono tabular-nums text-muted">
        <span>
          {p.entry.toLocaleString()} → {mark.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          step="any"
          aria-label="Stop price"
          placeholder="SL"
          value={stop}
          onChange={(e) => setStop(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-full rounded border border-border bg-background px-1 py-0.5 text-right font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent"
        />
        <input
          type="number"
          step="any"
          aria-label="Target price"
          placeholder="TP"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-full rounded border border-border bg-background px-1 py-0.5 text-right font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          onClick={() => closePosition(p.id, mark, "manual")}
          className="shrink-0 rounded border border-border px-1.5 py-0.5 hover:bg-border/50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function PositionsPanel() {
  const { positions, fills, closed, marks, closeAll } = usePaper();
  const [tab, setTab] = useState<Tab>("positions");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border">
        {(["positions", "orders", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cx(
              "px-2 py-1.5 text-xs capitalize",
              tab === t ? "text-accent" : "text-muted hover:text-foreground",
            )}
          >
            {t}
            {t === "positions" && positions.length > 0 && ` (${positions.length})`}
          </button>
        ))}
        {tab === "positions" && positions.length > 0 && (
          <button
            type="button"
            onClick={() => closeAll(marks)}
            className="ml-auto px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            Close all
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto py-1.5">
        {tab === "positions" &&
          (positions.length === 0 ? (
            <p className="px-1 text-xs text-muted">No open positions.</p>
          ) : (
            positions.map((p) => <PositionRow key={p.id} p={p} />)
          ))}
        {tab === "orders" &&
          (fills.length === 0 ? (
            <p className="px-1 text-xs text-muted">No fills yet.</p>
          ) : (
            [...fills].reverse().map((f) => (
              <div key={f.id} className="px-1 font-mono text-xs tabular-nums">
                <span className={cx("capitalize", f.side === "long" ? "text-up" : "text-down")}>
                  {f.kind === "open" ? "Opened" : "Closed"} {f.side}
                </span>{" "}
                {f.qty} {f.symbol} @ {f.price.toLocaleString()}
                {f.reason && f.reason !== "manual" && (
                  <span className="text-muted"> ({f.reason})</span>
                )}
              </div>
            ))
          ))}
        {tab === "history" &&
          (closed.length === 0 ? (
            <p className="px-1 text-xs text-muted">No closed trades.</p>
          ) : (
            [...closed].reverse().map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-1 font-mono text-xs tabular-nums">
                <span className="capitalize">{t.side}</span>
                <span className="text-muted">
                  {t.qty} {t.symbol}
                </span>
                <span className={cx("ml-auto", t.pnl >= 0 ? "text-up" : "text-down")}>
                  {money(t.pnl)}
                </span>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
