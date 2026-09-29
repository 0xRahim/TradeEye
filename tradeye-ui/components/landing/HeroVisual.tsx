"use client";

/**
 * Pure-CSS terminal mock in the terminal's own visual language: monochrome
 * candles (grey up / black down), one Asia-style session box, OHLC legend,
 * replay pill. Decorative only.
 */
interface MockBar {
  o: number;
  h: number;
  l: number;
  c: number;
}

// Deterministic walk so SSR and hydration render identically.
const BARS: MockBar[] = (() => {
  const out: MockBar[] = [];
  let px = 50;
  const steps = [3, -2, 4, 5, -3, -4, 2, 6, -2, 3, 4, -5, -3, 2, 5, 3, -4, 4, 2, -3, 5, -2, 3, -4, 2, 4, -3, 5, 2, -2, 4, 3, -5, 2, 4, -3, 3, 5, -4, 2];
  for (const s of steps) {
    const open = px;
    const close = Math.min(96, Math.max(4, px + s));
    out.push({
      o: open,
      h: Math.max(open, close) + 2,
      l: Math.min(open, close) - 2,
      c: close,
    });
    px = close;
  }
  return out;
})();

function Candle({ bar }: { bar: MockBar }) {
  const up = bar.c >= bar.o;
  const top = Math.min(bar.o, bar.c);
  const bodyH = Math.max(Math.abs(bar.c - bar.o), 1.5);
  const color = up ? "bg-[#787b86]" : "bg-black dark:bg-white";
  return (
    <div className="relative h-full w-full" aria-hidden>
      <div
        className={`absolute left-1/2 w-px -translate-x-1/2 ${color}`}
        style={{ top: `${100 - bar.h}%`, height: `${bar.h - bar.l}%` }}
      />
      <div
        className={`absolute left-[15%] right-[15%] rounded-[1px] ${color}`}
        style={{ top: `${100 - top}%`, height: `${bodyH}%` }}
      />
    </div>
  );
}

export function HeroVisual() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="ml-2 font-mono text-[11px] tabular-nums text-muted">
          BTCUSD&nbsp;&nbsp;O 67,400&nbsp;&nbsp;H 67,812&nbsp;&nbsp;L 67,102&nbsp;&nbsp;C 67,640
        </span>
        <span className="ml-auto rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
          Replay
        </span>
      </div>
      <div className="relative h-64 sm:h-72">
        <div className="absolute inset-0 flex items-stretch gap-[3px] px-4 py-4">
          {BARS.map((b, i) => (
            <Candle key={i} bar={b} />
          ))}
        </div>
        <div className="absolute rounded border border-[#2196F3] bg-[#2196F3]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2196F3]"
          style={{ left: "38%", top: "12%", width: "27%", height: "62%" }}
        >
          Asia
        </div>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[10px] text-muted shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          bar 214/300 · Play · 1x · Go live
        </div>
      </div>
    </div>
  );
}
