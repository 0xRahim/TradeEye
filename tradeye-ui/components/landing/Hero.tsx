"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroVisual } from "./HeroVisual";

const STATS: Array<{ value: string; label: string }> = [
  { value: "6", label: "Symbols" },
  { value: "8", label: "Timeframes" },
  { value: "$100k", label: "Paper balance" },
  { value: "100", label: "Undo steps" },
];

export function Hero({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-72 max-w-3xl rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Free paper-trading terminal
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Chart it. Replay it.
            <br />
            Trade it risk-free.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Tradeye is a trading terminal with live charts, a full drawing
            suite, session markers, and bar-by-bar replay — funded with
            $100,000 of paper money while you learn.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/trade"
              className="inline-flex items-center gap-1.5 rounded bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Launch terminal
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onLoginClick}
              className="rounded border border-border px-4 py-2.5 text-sm font-medium hover:bg-border/50"
            >
              Log in
            </button>
          </div>
          <dl className="mt-8 grid max-w-md grid-cols-4 gap-4 border-t border-border pt-5">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="order-2 mt-1 text-xs text-muted">{s.label}</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}
