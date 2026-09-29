"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { createChart } from "lightweight-charts";
import type { Symbol } from "./constants";
import { TIMEFRAME_SECONDS, type Timeframe } from "./constants";
import type {
  DrawingLine,
  DrawingTool,
  MagnetMode,
} from "./drawings/constants";
import { DRAWING_STYLES_EVENT, getStyleDefaults } from "./drawings/drawingStyles";
import { DrawingToolsManager } from "./lib/chart-plugins/drawing-tools/manager";
import { SessionMarkersPrimitive } from "./indicators/session-markers-primitive";
import { getSessionWindows } from "./indicators/sessions";
import { useSessionSettings } from "./indicators/session-settings-store";
import type { Candle } from "./services/types";

export interface DrawingCallbacks {
  onAdd: (d: DrawingLine) => void;
  onUpdate: (d: DrawingLine) => void;
  onRemove: (id: string) => void;
  onToolFinished: () => void;
  onSelectionChange: (ids: string[]) => void;
  onRequestSettings: (id: string) => void;
  onContextMenu: (id: string, clientX: number, clientY: number) => void;
  onSelectTool: (tool: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface ChartPanelProps {
  symbol: Symbol;
  timeframe: Timeframe;
  candles: Candle[];
  livePrice: number | null;
  loading: boolean;
  /** When true, only auto-follow while stepping/playing forward. */
  replayActive: boolean;
  /** Active drawing tool armed from the rail / shortcuts. */
  tool: DrawingTool;
  /** Drawings visible on this timeframe (hidden + tf-scoped filtered out). */
  drawings: DrawingLine[];
  magnet: MagnetMode;
  accountEquity: number;
  drawingCallbacks: DrawingCallbacks;
  /** Terminal keeps the manager to drive external selection (object tree). */
  managerRef: RefObject<DrawingToolsManager | null>;
}

function precisionFor(candles: Candle[]): number {
  const last = candles.at(-1)?.close ?? 0;
  if (last === 0) return 2;
  if (last < 1) return 4;
  if (last < 100) return 3;
  return 2;
}

function readVars(): Record<string, string> {
  const s = getComputedStyle(document.documentElement);
  const get = (k: string) => s.getPropertyValue(k).trim();
  return {
    background: get("--background") || "#ffffff",
    foreground: get("--foreground") || "#171717",
    border: get("--border") || "#e5e7eb",
    muted: get("--muted") || "#6b7280",
    up: get("--up") || "#089981",
    down: get("--down") || "#f6465d",
    accent: get("--accent") || "#2962ff",
  };
}

function formatOhlc(symbol: string, bar: { open: number; high: number; low: number; close: number }): string {
  const f = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `${symbol}  O ${f(bar.open)}  H ${f(bar.high)}  L ${f(bar.low)}  C ${f(bar.close)}`;
}

export default function ChartPanel({
  symbol,
  timeframe,
  candles,
  livePrice,
  loading,
  replayActive,
  tool,
  drawings,
  magnet,
  accountEquity,
  drawingCallbacks,
  managerRef,
}: ChartPanelProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const managerLocalRef = useRef<DrawingToolsManager | null>(null);
  const priceLineRef = useRef<ReturnType<
    ISeriesApi<"Candlestick">["createPriceLine"]
  > | null>(null);
  const barsRef = useRef<Candle[]>([]);
  /** Bar count at the last replay follow — scrubbing back must not yank. */
  const replayCountRef = useRef(0);
  /** Session Markers overlay primitive (attached to the candle series). */
  const sessionPrimitiveRef = useRef<SessionMarkersPrimitive | null>(null);
  const sessionSettings = useSessionSettings();
  /**
   * Replay follow-mode: true while the viewport tracks the leading edge
   * (including a user-dragged offset into the future). Scrolling back into
   * history flips it false so playback never yanks the viewport.
   * Ref mirror for chart-event/effect reads; state drives the UI pill.
   */
  const FOLLOW_THRESHOLD_BARS = 5;
  const [isFollowing, setIsFollowing] = useState(true);
  const isFollowingRef = useRef(true);
  const prevSymbolRef = useRef(symbol);
  const prevFirstTimeRef = useRef<number | null>(null);
  const wasReplayActiveRef = useRef(replayActive);

  // Latest callbacks for the manager's stable proxies (avoids stale closures
  // without recreating the manager every render).
  const cbRef = useRef(drawingCallbacks);
  useEffect(() => {
    cbRef.current = drawingCallbacks;
  });

  // Create chart + series + drawings manager. Recreated per symbol; timeframe
  // switches reuse the instance via updateTimeframe (no drawing blink).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const vars = readVars();
    const chart = createChart(mount, {
      width: mount.clientWidth,
      height: mount.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: vars.background },
        textColor: vars.muted,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: vars.border },
        horzLines: { color: vars.border },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: vars.border },
      timeScale: { borderColor: vars.border, timeVisible: true },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({ priceScaleId: "right" });
    candleSeriesRef.current = candleSeries;
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.06, bottom: 0.25 } });

    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });
    volumeSeriesRef.current = volumeSeries;
    chart.priceScale("").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const manager = new DrawingToolsManager({
      chart,
      series: candleSeries,
      container: mount,
      intervalSec: TIMEFRAME_SECONDS[timeframe],
      timeframe,
      accountEquity,
      callbacks: {
        onAdd: (d) => cbRef.current.onAdd(d),
        onUpdate: (d) => cbRef.current.onUpdate(d),
        onRemove: (id) => cbRef.current.onRemove(id),
        onToolFinished: () => cbRef.current.onToolFinished(),
        onSelectionChange: (ids) => cbRef.current.onSelectionChange(ids),
        onRequestSettings: (id) => cbRef.current.onRequestSettings(id),
        onContextMenu: (id, x, y) => cbRef.current.onContextMenu(id, x, y),
        onSelectTool: (t) => cbRef.current.onSelectTool(t),
        onUndo: () => cbRef.current.onUndo(),
        onRedo: () => cbRef.current.onRedo(),
      },
    });
    manager.setStyleDefaults(getStyleDefaults());
    managerLocalRef.current = manager;
    managerRef.current = manager;

    // Session Markers overlay (indicator): background boxes behind candles.
    const sessions = new SessionMarkersPrimitive();
    candleSeries.attachPrimitive(sessions);
    sessionPrimitiveRef.current = sessions;

    const onStyles = () => manager.setStyleDefaults(getStyleDefaults());
    window.addEventListener(DRAWING_STYLES_EVENT, onStyles);

    const resize = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    resize.observe(mount);

    const onCrosshairMove = (param: { seriesData: Map<unknown, unknown> }) => {
      const el = legendRef.current;
      if (!el) return;
      const data = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      const bar = data ?? barsRef.current.at(-1);
      el.textContent = bar ? formatOhlc(symbol, bar) : symbol;
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    // Follow-mode tracking: user-driven scrolls/drags update the ref + pill.
    // scrollPosition() is the distance (in bars) from the right edge to the
    // latest bar — negative when the user parked the last bar mid-screen
    // with empty future space, large positive when viewing history.
    const onVisibleRangeChange = () => {
      if (barsRef.current.length === 0) return;
      let pos: number | null = null;
      try {
        pos = chart.timeScale().scrollPosition();
      } catch {
        return;
      }
      const following = pos !== null && pos < FOLLOW_THRESHOLD_BARS;
      if (following !== isFollowingRef.current) {
        isFollowingRef.current = following;
        setIsFollowing(following);
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

    // Retheme when the `dark` class toggles.
    const themeObs = new MutationObserver(() => {
      const v = readVars();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: v.background },
          textColor: v.muted,
        },
        grid: { vertLines: { color: v.border }, horzLines: { color: v.border } },
        rightPriceScale: { borderColor: v.border },
        timeScale: { borderColor: v.border },
      });
      candleSeries.applyOptions({ upColor: v.up, downColor: v.down });
      volumeSeries.setData(
        barsRef.current.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? v.up : v.down,
        })),
      );
    });
    themeObs.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener(DRAWING_STYLES_EVENT, onStyles);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      themeObs.disconnect();
      resize.disconnect();
      try {
        candleSeries.detachPrimitive(sessions);
      } catch {
        /* chart already removed */
      }
      sessionPrimitiveRef.current = null;
      manager.destroy();
      managerLocalRef.current = null;
      managerRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Armed tool → manager.
  useEffect(() => {
    managerLocalRef.current?.setTool(tool);
  }, [tool]);

  // Visible drawings → primitive (skipped mid-drag; the manager owns the
  // local copy until onUpdate syncs back).
  useEffect(() => {
    managerLocalRef.current?.setDrawings(drawings);
  }, [drawings]);

  // Session Markers → overlay primitive. Recomputed from the visible candles
  // so replay slicing applies automatically; hidden on daily+ timeframes
  // where intraday sessions don't map to bars.
  useEffect(() => {
    const prim = sessionPrimitiveRef.current;
    if (!prim) return;
    const intraday = timeframe !== "1d" && timeframe !== "1w";
    if (!sessionSettings.enabled || !intraday || candles.length === 0) {
      prim.setWindows([]);
      return;
    }
    prim.setShowLabels(sessionSettings.showLabels);
    prim.setWindows(getSessionWindows(candles, sessionSettings));
  }, [candles, timeframe, sessionSettings]);

  // Timeframe switch without recreation.
  useEffect(() => {
    managerLocalRef.current?.updateTimeframe(timeframe, TIMEFRAME_SECONDS[timeframe]);
  }, [timeframe]);

  useEffect(() => {
    managerLocalRef.current?.setMagnetMode(magnet);
  }, [magnet]);

  useEffect(() => {
    managerLocalRef.current?.setAccountEquity(accountEquity);
  }, [accountEquity]);

  // Push full series on symbol/timeframe/data change.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    // Snapshot viewport + data shape BEFORE replacing the series so replay
    // can shift (not reset) the visible range and hold a user-dragged offset.
    const prevRange = chart.timeScale().getVisibleLogicalRange();
    const prevLen = barsRef.current.length;
    const prevFirstTime = prevFirstTimeRef.current;
    const firstTime = candles[0]?.time ?? null;
    const symbolChanged = prevSymbolRef.current !== symbol;
    const dataReset = prevFirstTime !== null && firstTime !== null && prevFirstTime !== firstTime;
    const justEnteredReplay = replayActive && !wasReplayActiveRef.current;

    barsRef.current = [...candles];
    const vars = readVars();
    const precision = precisionFor(candles);
    candleSeries.applyOptions({
      upColor: vars.up,
      downColor: vars.down,
      wickUpColor: vars.up,
      wickDownColor: vars.down,
      borderVisible: false,
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
    });
    candleSeries.setData(
      candles.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    volumeSeries.setData(
      candles.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? vars.up : vars.down,
      })),
    );
    if (priceLineRef.current) {
      candleSeries.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }
    const legend = legendRef.current;
    const lastBar = candles.at(-1);
    if (legend) legend.textContent = lastBar ? formatOhlc(symbol, lastBar) : symbol;
    if (replayActive) {
      // Follow with preserved offset: shift the visible logical range right
      // by exactly the new-bar count so a last candle parked mid-screen
      // stays mid-screen. Never scrollToRealTime here — that pins the last
      // bar to the right edge and wipes the user's placement.
      if (justEnteredReplay || symbolChanged || dataReset || replayCountRef.current === 0) {
        // Fresh baseline only (enter replay / symbol / timeframe switch).
        chart.timeScale().scrollToRealTime();
        isFollowingRef.current = true;
        setIsFollowing(true);
      } else {
        const delta = candles.length - prevLen;
        if (delta > 0) {
          if (isFollowingRef.current && prevRange) {
            chart.timeScale().setVisibleLogicalRange({
              from: prevRange.from + delta,
              to: prevRange.to + delta,
            });
          }
          // Not following (viewing history): leave the viewport alone.
        } else if (delta < 0) {
          // Scrubbed/stepped back: keep small steps in place, but snap when
          // the new tail no longer intersects the viewport (avoids blanks).
          const lastIdx = candles.length - 1;
          if (prevRange && (prevRange.from > lastIdx || prevRange.to < lastIdx - 2)) {
            chart.timeScale().scrollToRealTime();
            isFollowingRef.current = true;
            setIsFollowing(true);
          }
        }
      }
      replayCountRef.current = candles.length;
    } else {
      replayCountRef.current = 0;
      chart.timeScale().scrollToRealTime();
      if (!isFollowingRef.current) {
        isFollowingRef.current = true;
        setIsFollowing(true);
      }
    }
    prevSymbolRef.current = symbol;
    prevFirstTimeRef.current = firstTime;
    wasReplayActiveRef.current = replayActive;
  }, [candles, symbol, replayActive]);

  // Live tick: mutate the forming bar + move the price line.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || livePrice === null) return;
    const bars = barsRef.current;
    const last = bars.at(-1);
    if (!last) return;
    const updated: Candle = {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
    };
    bars[bars.length - 1] = updated;
    candleSeries.update({
      time: updated.time as UTCTimestamp,
      open: updated.open,
      high: updated.high,
      low: updated.low,
      close: updated.close,
    });
    const vars = readVars();
    if (priceLineRef.current) {
      candleSeries.removePriceLine(priceLineRef.current);
    }
    priceLineRef.current = candleSeries.createPriceLine({
      price: livePrice,
      color: vars.accent,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "",
    });
  }, [livePrice]);

  const goToLatest = () => {
    chartRef.current?.timeScale().scrollToRealTime();
    isFollowingRef.current = true;
    setIsFollowing(true);
  };

  return (
    <div className="relative h-full min-h-[420px] w-full flex-1">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={legendRef}
        className="pointer-events-none absolute left-2 top-2 z-10 font-mono text-xs tabular-nums text-foreground"
      >
        {loading ? "Loading bars…" : symbol}
      </div>
      {replayActive && !isFollowing && (
        <button
          type="button"
          onClick={goToLatest}
          aria-label="Follow replay to latest bar"
          title="Follow replay to latest bar"
          className="absolute bottom-8 right-16 z-10 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground shadow-lg hover:bg-border/50"
        >
          Go to latest
        </button>
      )}
    </div>
  );
}
