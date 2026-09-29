"use client";

import { Pause, Play, Radio, StepBack, StepForward } from "lucide-react";
import { useEffect, useState } from "react";
import { useTerminal } from "./store";
import type { Candle } from "./services/types";
import { cx } from "./lib/cx";

const PLAY_INTERVAL_MS = 600;

function toLocalInput(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fromLocalInput(v: string): number | null {
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function formatBarTime(ts: number | undefined): string {
  if (ts == null) return "—";
  const d = new Date(ts * 1000);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** Count of bars with time <= t (bars are ascending). */
function countAtOrBefore(bars: Candle[], t: number): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.time <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function ReplayBar({
  bars,
  loadWindow,
  canJump,
}: {
  bars: Candle[];
  /** Replace history with a window ending at `to` (live jump-to-date). */
  loadWindow: (to: number) => Promise<Candle[]>;
  /** False for fixed local sources (synthetic/bundled) — clamps as before. */
  canJump: boolean;
}) {
  const {
    replayActive,
    replayCutoff,
    replayTime,
    replayPlaying,
    replaySpeed,
    enterReplay,
    exitReplay,
    setReplayTime,
    setReplayPlaying,
    setReplaySpeed,
  } = useTerminal();

  const [draft, setDraft] = useState<string | null>(null);
  const [jumping, setJumping] = useState(false);

  // Default the picker to ~100 bars back; falls back live during render
  // (no effect) so data arriving later still seeds a sensible moment.
  const anchor = bars.length > 0 ? bars[Math.max(bars.length - 101, 0)]! : undefined;
  const draftValue = draft ?? (anchor ? toLocalInput(anchor.time) : "");

  const shown = replayTime != null ? countAtOrBefore(bars, replayTime) : 0;
  const total = bars.length;

  // Playback: advance the revealed moment by `speed` bars per interval.
  useEffect(() => {
    if (!replayActive || !replayPlaying || total === 0) return;
    const t = window.setInterval(() => {
      const state = useTerminal.getState();
      const now = state.replayTime;
      if (now == null) return;
      const idx = countAtOrBefore(bars, now);
      const nextIdx = Math.min(idx + state.replaySpeed, total);
      if (nextIdx >= total) {
        state.setReplayTime(bars[total - 1]!.time);
        state.setReplayPlaying(false);
      } else {
        state.setReplayTime(bars[nextIdx]!.time);
      }
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [replayActive, replayPlaying, total, bars]);

  const step = (dir: 1 | -1) => {
    setReplayPlaying(false);
    if (replayTime == null || total === 0) return;
    const idx = countAtOrBefore(bars, replayTime);
    const nextIdx = Math.min(Math.max(idx + dir, 1), total);
    setReplayTime(bars[nextIdx - 1]!.time);
  };

  if (!replayActive) {
    const start = async () => {
      const ts = fromLocalInput(draftValue);
      if (ts === null || bars.length === 0 || jumping) return;
      const first = bars[0]!.time;
      const last = bars[bars.length - 1]!.time;
      if (!canJump || (ts >= first && ts <= last)) {
        enterReplay(Math.min(Math.max(ts, first), last));
        return;
      }
      // Outside loaded history: fetch a window ending at the chosen moment,
      // then enter there. Never blocks — failure falls back to the clamp.
      setJumping(true);
      try {
        const window = await loadWindow(ts);
        if (window.length > 0) {
          const wFirst = window[0]!.time;
          const wLast = window[window.length - 1]!.time;
          enterReplay(Math.min(Math.max(ts, wFirst), wLast));
        } else {
          enterReplay(Math.min(Math.max(ts, first), last));
        }
      } finally {
        setJumping(false);
      }
    };
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">Replay</span>
        <input
          type="datetime-local"
          aria-label="Replay start date and time"
          value={draftValue}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          onClick={() => void start()}
          disabled={bars.length === 0 || jumping}
          className="rounded bg-accent px-2.5 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
        >
          {jumping ? "Loading…" : "Start replay"}
        </button>
        <span className="text-xs text-muted">
          Bars reveal from the chosen moment on every timeframe.
        </span>
      </div>
    );
  }

  const shownTime = shown > 0 ? bars[shown - 1]?.time : undefined;
  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded bg-warn/15 px-1.5 py-0.5 text-xs font-semibold text-warn">
        Replay
      </span>
      <button
        type="button"
        title={replayPlaying ? "Pause" : "Play"}
        aria-label={replayPlaying ? "Pause replay" : "Play replay"}
        onClick={() => setReplayPlaying(!replayPlaying)}
        className="rounded p-1.5 text-foreground hover:bg-border/50"
      >
        {replayPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        type="button"
        title="Step back one bar"
        aria-label="Step back one bar"
        onClick={() => step(-1)}
        className="rounded p-1.5 text-muted hover:bg-border/50 hover:text-foreground"
      >
        <StepBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Step forward one bar"
        aria-label="Step forward one bar"
        onClick={() => step(1)}
        className="rounded p-1.5 text-muted hover:bg-border/50 hover:text-foreground"
      >
        <StepForward className="h-4 w-4" />
      </button>
      <input
        type="range"
        aria-label="Replay position"
        min={1}
        max={Math.max(total, 1)}
        value={Math.min(Math.max(shown, 1), Math.max(total, 1))}
        onChange={(e) => {
          setReplayPlaying(false);
          const v = Number(e.target.value);
          if (total > 0) setReplayTime(bars[v - 1]!.time);
        }}
        className="w-40"
      />
      <select
        aria-label="Replay speed"
        value={replaySpeed}
        onChange={(e) => setReplaySpeed(Number(e.target.value))}
        className="rounded border border-border bg-background px-1 py-1 text-xs focus-visible:outline-2 focus-visible:outline-accent"
      >
        {[1, 2, 4].map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
      <span aria-live="polite" className="text-xs tabular-nums text-muted">
        {formatBarTime(replayCutoff ?? undefined)} start · bar {Math.min(shown, total)}/
        {total} · {formatBarTime(shownTime)}
      </span>
      <button
        type="button"
        onClick={exitReplay}
        className={cx(
          "ml-auto flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs",
          "hover:bg-border/50",
        )}
      >
        <Radio className="h-3.5 w-3.5" />
        Go live
      </button>
    </div>
  );
}
