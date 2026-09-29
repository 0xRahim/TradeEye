"use client";

import Link from "next/link";
import {
  Clock,
  History,
  KeyRound,
  Layers,
  Moon,
  Shapes,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: History,
    title: "Bar-by-bar replay",
    body: "Rewind to any moment and step forward bar by bar. Every timeframe stays synced by construction.",
  },
  {
    icon: Shapes,
    title: "Full drawing suite",
    body: "Trend lines, Fibonacci, rectangles, position tools and text — with magnet snapping and 100-step undo.",
  },
  {
    icon: Clock,
    title: "Session markers",
    body: "Asia, London and New York windows drawn over UK time, fitted to each session's range. Fully styleable.",
  },
  {
    icon: Wallet,
    title: "$100k paper account",
    body: "Market orders, stop-loss and take-profit evaluated live. No commissions, no risk, real arithmetic.",
  },
  {
    icon: Layers,
    title: "8 timeframes",
    body: "From 1 minute to 1 week across six crypto symbols, all aggregated from one consistent series.",
  },
  {
    icon: Moon,
    title: "Dark & light",
    body: "A monochrome chart theme that follows your system, with an explicit toggle in the terminal.",
  },
];

export function Features() {
  return (
    <section id="features" aria-label="Features" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Features</p>
        <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
          Everything you need to practice like a professional
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50"
            >
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: KeyRound,
    title: "1. Log in",
    body: "Create your free demo login in seconds — no email verification, no card.",
  },
  {
    icon: Layers,
    title: "2. Open the terminal",
    body: "Pick a symbol and timeframe. Your charts, drawings and theme are waiting.",
  },
  {
    icon: History,
    title: "3. Replay & trade",
    body: "Scrub back, press play, place paper trades mid-replay and review the outcome.",
  },
];

export function HowItWorks({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <section id="how" aria-label="How it works" className="border-t border-border bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">How it works</p>
        <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
          From landing to first backtest in under a minute
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-background p-5">
              <s.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Create free login
          </button>
          <Link
            href="/trade"
            className="rounded border border-border px-4 py-2.5 text-sm font-medium hover:bg-border/50"
          >
            Skip ahead to the terminal
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <section aria-label="Get started" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Stop watching markets. Start replaying them.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Log in once — your demo session, paper account and drawings persist
          right in the browser.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Log in free
          </button>
          <Link
            href="/trade"
            className="rounded border border-border px-5 py-2.5 text-sm font-medium hover:bg-border/50"
          >
            Launch terminal
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:flex-row">
        <span className="font-semibold text-foreground">Tradeye</span>
        <span>Paper-trading terminal · demo data · no real funds</span>
        <Link href="/trade" className="hover:text-foreground">
          Terminal
        </Link>
      </div>
    </footer>
  );
}
