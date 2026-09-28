---
name: opencharts
description: Use when building, extending, or embedding charts on top of the OpenCharts repo (github.com/dylanpersonguy/OpenCharts) — a React + TypeScript + Vite trading terminal built on lightweight-charts v4. Triggers include adding drawing tools (trendlines, fib, shapes, position tools), adding technical indicators, writing custom chart primitives/overlays, programmatically creating drawings, theming the chart, or swapping the data feed. Use this BEFORE writing any canvas, chart, or indicator code from scratch. Do NOT use for TradingView's own library, plain lightweight-charts projects that don't vendor OpenCharts, or backend/exchange work.
---

# OpenCharts — extend, don't reimplement

## 0. Ground truth (read first)

OpenCharts is **an application you fork/vendor and extend, not an npm package you import**. `package.json` is `"private": true`; there is no published entry point. "Using the library" means editing files under `src/` and reusing its modules.

Verified against the `main` branch source:

| Fact | Detail |
|---|---|
| Stack | React 19, TypeScript, Vite 6, Zustand, TanStack Query, Tailwind, Radix, Zod |
| Chart engine | **`lightweight-charts` ^4.2.0** (v4 API: `chart.addCandlestickSeries()`, `addLineSeries()`, `addHistogramSeries()`, `series.attachPrimitive()`). **Not v5.** Do not use `addSeries(...)` or native multi-pane APIs. |
| Rendering of drawings | One custom series primitive (`DrawingsPrimitive`) painting on the chart's own canvas via `fancy-canvas` bitmap coordinate space. No DOM overlay, no second canvas. |
| Data | Runs with **no backend**. `src/services/demo/*` replays bundled real Binance OHLC. Crypto-only out of the box. |
| Persistence | Drawings/templates in `localStorage` via `src/services/demo/api.ts`. Paper account resets on reload. |

**Do not trust the GitHub "About" blurb.** It mentions a custom Canvas 2D engine, a PineScript transpiler, CCXT/Alpaca, Next.js + Express + PostgreSQL + Redis, alerts backend, "20+ indicators". None of that exists in the source tree (8 indicators, lightweight-charts engine, no server, no Pine). Never claim or call those features. If the user needs them, say they must be built, and check the repo again first in case it changed.

## 1. Golden rules

1. **Search the registries before writing code.** Grep for the concept (`grep -rn "fibonacci" src`) and read the existing implementation. Most requests are a variation of something that exists.
2. **Extend the primitive, never add a parallel layer.** New visuals = a new `case` in the drawing renderer or a new `PluginBase` primitive. Never add an absolutely-positioned `<canvas>`/SVG/DOM overlay on top of the chart.
3. **Store data-space, render pixel-space.** Anchors are `{time (unix seconds), price}`. Convert to pixels only inside a render pass using `timeToX` / `series.priceToCoordinate`.
4. **Indicators are pure functions** in `src/lib/indicators.ts` (`CandleData[] -> IndicatorPoint[]`). No React, no chart calls in the math.
5. **Reuse helpers**: `helpers/` in chart-plugins, `drawLabelBox`, `drawHandle`, `hexToRgba`, `toBitmap`, `dashFor`, `applyDash`, `strokeLine`, `pointInBox`, `distToSegment`.
6. **Keep the data layer swappable.** UI talks only to `services/api.ts` and `services/ws.ts`. Never import `services/demo/*` from a component.
7. **Verify** with the checklist in section 9 before saying "done".

## 2. Where things live

```
src/
├─ lib/
│  ├─ indicators.ts                 # pure indicator math + INDICATOR_REGISTRY + IndicatorType
│  └─ chart-plugins/
│     ├─ plugin-base.ts             # PluginBase: abstract ISeriesPrimitive (chart/series/requestUpdate)
│     ├─ helpers/                   # time, closest-index, min-max-in-range, delegate, dimensions
│     ├─ drawing-tools/
│     │  ├─ manager.ts              # DrawingToolsManager: input, placement, drag, select, undo hooks
│     │  ├─ drawings-primitive.ts   # DrawingsPrimitive: single canvas pass + axis price labels
│     │  ├─ resolve.ts              # data-space -> pixel-space (timeToX, xToTime, fib levels, segments)
│     │  ├─ renderers.ts            # renderEntry(): one function per drawing type
│     │  ├─ hit-test.ts             # hitTest(): which anchor/body was hit
│     │  ├─ geometry.ts             # dist, distToSegment, snapAngle, pointInBox
│     │  ├─ line-alerts.ts          # linePriceAt, detectCrossings (price-cross alerts on lines)
│     │  └─ types.ts                # ResolvedEntry, Hit, DrawingCallbacks, DrawCtxInfo
│     ├─ bands-indicator/           # TEMPLATE for a primitive-based indicator (fills, autoscaleInfo)
│     ├─ session-highlighting/ session-breaks/ tooltip/ delta-tooltip/ highlight-bar-crosshair/
├─ pages/trading/
│  ├─ constants.ts                  # DrawingTool, DrawingType, DrawingLine, CHART_COLORS, TIMEFRAMES
│  ├─ ChartPanel.tsx                # creates chart + series, wires manager, PLUGIN_FACTORIES
│  ├─ useIndicators.ts              # turns INDICATOR_REGISTRY entries into chart series
│  ├─ DrawingToolRail.tsx           # vertical tool palette (grouped)
│  ├─ ChartToolbar.tsx              # top toolbar: DRAWING_TOOLS list, indicators menu, CHART_PLUGIN_ITEMS
│  ├─ DrawingToolsOverlay.tsx       # floating toolbar, context menu, settings dialog (FILLABLE set)
│  ├─ drawingStyles.ts              # per-type style defaults + named style templates
│  └─ ObjectTreePanel.tsx           # list/toggle/delete drawings
├─ hooks/useChartDrawings.ts        # drawing state, undo/redo (HISTORY_LIMIT 100), persistence calls
├─ services/  api.ts ws.ts schemas.ts store.tsx demo/{engine,feed,candles,instruments,api}.ts
```

## 3. Task router

| The user wants… | Do this |
|---|---|
| Show a chart in my app | §4 — reuse `ChartPanel`; do not rebuild `createChart` wiring |
| AI/agent/script draws a level, zone, fib, position on the chart | §5 — create `DrawingLine` objects, no new code needed |
| A new drawing tool (pitchfork, price range, date range, …) | §6 checklist |
| A new indicator (line/oscillator) | §7 |
| Filled bands, heatmap, custom overlay, background shading | §8 — `PluginBase` primitive |
| Different data source / symbols / exchange | §10 |
| Colors, theme, candle colors | §11 |
| "Pine script", "CCXT", "server alerts", "20+ indicators" | Not in the repo. State that, propose building it, don't fake it |

## 4. Core concepts

**Coordinate model.** `DataPoint = { time: number /* unix SECONDS */, price: number }`. Drawings are stored once per symbol and shared across timeframes; `createdTf` + `visibility: "tf"` can restrict to one TF.

**Always use `timeToX` / `xToTime` from `resolve.ts`**, never `timeScale().logicalToCoordinate(fraction)`. lightweight-charts returns wrong values (0) for fractional logical indexes, which snaps cross-timeframe and future anchors to the left edge. `timeToX` interpolates between integer bars and extrapolates past the data edges using `intervalSec`.

**Render pipeline.** `DrawingToolsManager` (input) → callbacks `onAdd/onUpdate/onRemove` → `useChartDrawings` (state + persistence) → `manager.setDrawings()` → `DrawingsPrimitive.resolveEntries()` (`resolveEntry` per drawing → `ResolvedEntry` with pixel `x1,y1,x2,y2,...`) → `renderEntry()` per type.

**Renderer rules** (`renderers.ts`): draw inside `scope` (`BitmapCoordinatesRenderingScope`). Convert media px to bitmap px with `toBitmap(scope, x, y)`; multiply widths by `scope.verticalPixelRatio`, dash arrays via `applyDash`. Wrap state changes in `ctx.save()/restore()`. Bail with `if (e.x1 === null || ...) return` — anchors can be off-screen/null. Show handles only when `showHandles(e)` (hovered/selected).

### `DrawingLine` (in `pages/trading/constants.ts`)

```ts
interface DrawingLine {
  id: string;                       // crypto.randomUUID()
  type: DrawingType;                // stored kinds, see below
  price: number; time?: number;     // anchor 1
  price2?: number; time2?: number;  // anchor 2
  price3?: number; time3?: number;  // anchor 3 (channel offset)
  color: string;
  width?: number; lineStyle?: "solid" | "dashed" | "dotted";
  locked?: boolean; hidden?: boolean; zIndex?: number;
  createdTf?: string; visibility?: "all" | "tf";
  fillColor?: string; fillOpacity?: number;
  arrowStart?: boolean; arrowEnd?: boolean;
  extendLeft?: boolean; extendRight?: boolean;         // trendline
  text?: string; fontSize?: number; bold?: boolean; italic?: boolean;
  textBg?: boolean; textBgColor?: string; textBorder?: boolean; textBorderColor?: string;
  fibLevels?: number[];                                // custom fib fractions
  side?: "long" | "short"; stopPrice?: number; targetPrice?: number; riskPct?: number; // position
  alertEnabled?: boolean; alertMessage?: string;       // price-cross alert on the line
}
```

**Armable tools vs stored types.** `DrawingTool` includes placement aliases that store a different `type`: `ray`/`extended` → `trendline` + `extendRight`/`extendLeft`; `long-position`/`short-position` → `position` + `side`; `measure` never persists. Stored `DrawingType`s: `trendline, horizontal, vertical, fibonacci, fibextension, rectangle, ellipse, triangle, arrow, channel, text, position` (plus anything you add).

## 5. Draw programmatically (no new code)

Build `DrawingLine` objects and feed them through the same path the UI uses. Inside the app that is the `onAdd` callback of `useChartDrawings` (which updates state and calls `api.chartDrawings.save(symbol, tf, d)`). Outside React, `api.chartDrawings.save(symbol, timeframe, drawing)` persists it and the hook's `list(symbol)` will pick it up on next load.

```ts
const now = Math.floor(Date.now() / 1000);

// Support/resistance level with alert
const level: DrawingLine = { id: crypto.randomUUID(), type: "horizontal", price: 64250,
  color: "#f0b90b", width: 1.5, lineStyle: "dashed", alertEnabled: true, alertMessage: "Retest" };

// Supply zone
const zone: DrawingLine = { id: crypto.randomUUID(), type: "rectangle", color: "#f6465d",
  time: now - 86400, price: 65000, time2: now + 3600 * 12, price2: 64400, fillOpacity: 0.15 };

// Fib retracement (level 0 sits at anchor 2, level 1 at anchor 1)
const fib: DrawingLine = { id: crypto.randomUUID(), type: "fibonacci", color: "#2196F3",
  time: now - 7 * 86400, price: 60000, time2: now - 86400, price2: 66000 };

// Long position (risk math uses absolute prices; riskPct drives $ readout)
const long: DrawingLine = { id: crypto.randomUUID(), type: "position", side: "long",
  color: "#089981", time: now, time2: now + 3600 * 6, price: 64000,
  targetPrice: 66000, stopPrice: 63000, riskPct: 1 };
```

Rules: times are **seconds**; `price2/time2` required for two-anchor types; keep `id` unique; to edit, save again with the same `id` (upsert). Call `manager.setDrawings(list)` (via state) to refresh. Wrap batch creation so undo/redo history isn't polluted (use the hook's add path for user-undoable items).

## 6. Add a new drawing tool — checklist

Work through **every** item; skipping one produces a tool that renders but can't be selected, dragged, or armed.

1. **`pages/trading/constants.ts`** — add the id to the `DrawingTool` union. `DrawingType` derives from it automatically.
2. **`manager.ts` → `buildNew()`** — two-anchor tools already fall through to `{ ...two, type: tool as DrawingType }`; no change needed. Add a branch only for custom defaults/aliases.
   - **Single-click tools** (one anchor) must also be added to the hard-coded list in `placementStart()` (`horizontal | vertical | text`), otherwise the tool waits for a second click.
   - **Extra anchors or derived fields** (like channel/position) need a case in `shiftDrawing()` (body drag), `anchorPoints()` (snapping), and new keys in `TimeKey`/`PriceKey` (`types.ts`).
3. **`resolve.ts` → `resolveEntry()`** — only if you need derived pixel geometry (levels, extra anchors, stats). Plain 2-anchor shapes need nothing; `x1,y1,x2,y2` are already resolved.
4. **`renderers.ts`** — add `case "<type>": render<Name>(scope, e, info)` in `renderEntry()` and write the function.
5. **`hit-test.ts` → `hitEntry()`** — add the case. Reuse `hitBoxShape` (box), `hitTrendline` (segment), `hitHorizontal`, `hitFibonacci`. Return `{kind:"point", timeKey, priceKey}` for draggable anchors, `bodyHit(e)` for whole-shape drags.
6. **UI entries** — add the tool to **both** `DrawingToolRail.tsx` (grouped palette) and `ChartToolbar.tsx` `DRAWING_TOOLS`. Optional keyboard shortcut in `manager.ts` `TOOL_SHORTCUTS` (Alt+key).
7. **Settings dialog** — if the shape has a fill, add its type to `FILLABLE` in `DrawingToolsOverlay.tsx`.
8. Axis labels are automatic: non-horizontal drawings show `price`/`price2` on the price axis while selected.

### Worked example: "Price Range" box (typechecked against the repo; build passes)

`constants.ts`:
```ts
  | "triangle"
  | "pricerange"
  | "position"
```

`renderers.ts` (add the case, then the function):
```ts
    case "pricerange":
      renderPriceRange(scope, e, info);
      break;
```
```ts
function renderPriceRange(
  scope: BitmapCoordinatesRenderingScope, e: ResolvedEntry, info: DrawCtxInfo,
): void {
  if (e.x1 === null || e.y1 === null || e.x2 === null || e.y2 === null) return;
  const a = toBitmap(scope, e.x1, e.y1);
  const b = toBitmap(scope, e.x2, e.y2);
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  const ctx = scope.context;
  ctx.save();
  ctx.fillStyle = hexToRgba(e.d.fillColor ?? e.d.color, e.d.fillOpacity ?? 0.12);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = e.d.color;
  ctx.lineWidth = (e.d.width ?? 1) * scope.verticalPixelRatio;
  applyDash(scope, dashFor(e.d.lineStyle));
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  if (e.d.price2 != null) {
    const dp = e.d.price2 - e.d.price;
    const pct = e.d.price !== 0 ? (dp / e.d.price) * 100 : 0;
    drawLabelBox(scope, x + 6 * scope.horizontalPixelRatio, y + 6 * scope.verticalPixelRatio,
      [`${dp >= 0 ? "+" : "−"}${info.priceFormat(Math.abs(dp))} (${pct.toFixed(2)}%)`], e.d.color);
  }
  if (showHandles(e)) drawRectHandles(scope, a, b, e.d.color);
}
```

`hit-test.ts`:
```ts
    case "triangle":
    case "pricerange":
      return hitBoxShape(e, p, tol);
```

`DrawingToolRail.tsx` (Shapes group) and `ChartToolbar.tsx`:
```ts
{ tool: "pricerange", icon: Ruler, label: "Price Range" },                 // Rail
{ tool: "pricerange" as const, icon: Ruler, label: "Price Range", shortcut: "" }, // Toolbar
```
`DrawingToolsOverlay.tsx`: add `"pricerange"` to `FILLABLE`.

No `manager.ts` change was needed because it is a plain two-anchor drag tool.

## 7. Add an indicator (line or oscillator)

Three edits, in this order:

**(a) `src/lib/indicators.ts`** — pure function, add the type to `IndicatorType`, add a registry entry.
```ts
export function donchian(candles: CandleData[], period = 20): DonchianResult {
  const upper: IndicatorPoint[] = [], middle: IndicatorPoint[] = [], lower: IndicatorPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j]!.high); lo = Math.min(lo, candles[j]!.low);
    }
    const t = candles[i]!.time;
    upper.push({ time: t, value: hi }); lower.push({ time: t, value: lo });
    middle.push({ time: t, value: (hi + lo) / 2 });
  }
  return { upper, middle, lower };
}
// IndicatorType: ... | "VWAP" | "DONCH"
// INDICATOR_REGISTRY: { type: "DONCH", label: "Donchian Channels", pane: "overlay",
//                       defaultParams: { period: 20 }, color: "#00bcd4" }
```
Contract: output is time-ascending, starts at the first bar where the value is defined, `time` is unix seconds and must match candle times.

**(b) `src/pages/trading/useIndicators.ts`** — add `import { donchian }` and a `case "DONCH":` that calls `chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "right" })`, `setData(points.map(p => ({ time: p.time as Time, value: p.value })))`, and registers each series in `indicatorSeriesRef.current.set("DONCH-upper", s)` so cleanup removes it.

**(c) Nothing else.** `ChartToolbar` renders the indicators menu from `INDICATOR_REGISTRY`, and chart templates already serialize `activeIndicators`.

Existing indicators: `SMA, EMA, RSI, MACD, BOLL, ATR, STOCH, VWAP`.

## 8. Custom overlay / band / heatmap = a primitive

Extend `PluginBase` (`plugin-base.ts`); implement `paneViews()`, `updateAllViews()`, and optionally `priceAxisViews()`, `autoscaleInfo()`, `dataUpdated(scope)`. Use `bands-indicator.ts` as the template: it reads `series.data()`, computes in `dataUpdated`, converts to pixels in `PaneView.update()`, draws in `drawBackground` (behind candles) or `draw` (on top), and returns `autoscaleInfo` so the price scale includes the band.

Register it:
1. `ChartPanel.tsx` → add a factory to `PLUGIN_FACTORIES` (`myplugin: (ctx) => new MyPlugin(...)`; return `null` to skip, as `session-breaks` does on daily+ TFs).
2. `ChartToolbar.tsx` → add `{ id: "myplugin", icon, label }` to `CHART_PLUGIN_ITEMS`.

Call `this.requestUpdate()` after any state change; never poll. Use `extends PluginBase`, not a bare `ISeriesPrimitive`, so attach/detach and data-changed subscriptions are handled.

## 9. Verification checklist

1. `npm run typecheck` — **baseline has 151 pre-existing errors** (mostly `services/store.tsx`). Do not aim for zero; confirm the count didn't rise: `npx tsc --noEmit 2>&1 | grep -c "error TS"` before and after, and grep the output for the files you touched.
2. `npm run build` (Vite only; passes).
3. `npm run test` (Vitest; suite is tiny — `src/__tests__`). Add pure-function tests for new indicators (`src/__tests__/*.test.ts`).
4. `npm run dev` and manually: arm the tool → place → hover → select → drag anchor → drag body → switch timeframe → reload (persistence) → undo/redo → delete.
5. Never say a UI feature works without having exercised it in the browser; say "typechecked and built, not manually tested" if that's the case.

## 10. Swap the data source

The UI depends on two seams only:
- `src/services/api.ts` — REST-shaped facade (`getSymbols`, `getCandles`, `chartDrawings.list/save/remove/clear`, order/position methods). Shapes are in `src/services/schemas.ts` (Zod).
- `src/services/ws.ts` — `connect`, `subscribe(channel, handler)`, `subscribeAccounts`, `onStateChange`; publish `MarketTick`, `CandleUpdate`, `Position*`, `Order*`, `EquityUpdated` on channels `market-data`, `positions`, `orders`, `account`. `src/components/MarketDataBridge.tsx` shows exactly what is consumed.

Add instruments in `services/demo/instruments.ts` + the `SYMBOLS` map in `scripts/fetch-demo-data.mjs`, then `node scripts/fetch-demo-data.mjs`. Candle `time` must be unix seconds, ascending, de-duplicated (lightweight-charts throws otherwise).

## 11. Theme and colors

`CHART_COLORS.dark/light` in `constants.ts`; user overrides merge via `mergeChartColors(theme, overrides)` (`ChartColorOverrides`). Drawing swatches: `DRAWING_COLORS`, widths `DRAWING_WIDTHS`. Per-type defaults and named style templates: `drawingStyles.ts` (`setTypeDefault`, `saveTemplate`). Add new chart colors to both theme objects **and** `COLOR_OVERRIDE_MAP` if users should override them.

## 12. Known gotchas (found while reading the source)

- **No real sub-panes.** v4 has none. `useIndicators.ts` puts RSI/MACD/ATR/STOCH on their own `priceScaleId`s without setting `scaleMargins` for those scales, so they likely draw over the main pane. For a stacked look, set margins per scale, e.g. `chart.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })` and shrink the main scale (`rightPriceScale.scaleMargins`, currently `top 0.06 / bottom 0.18`; volume uses `top 0.85`). Check visually.
- **VWAP is effectively unweighted.** `toIndicatorCandles()` sets `volume: 0` and `vwap()` uses `c.volume || 1`. Feed real volume before trusting it.
- **Indicator params are fixed** to `defaultParams`; there's no per-indicator settings UI or persisted params.
- **Indicators rebuild fully** (remove all series, recompute) whenever `chartData` changes, including live ticks. Fine for demo; for heavy indicators memoize or update incrementally with `series.update()`.
- **Position tool geometry** is special-cased in the manager (`shiftPosition`, `makePosition`), as is `channel`. Copy those patterns for any multi-anchor tool.
- **Two tool lists** (`DrawingToolRail`, `ChartToolbar.DRAWING_TOOLS`) plus `FILLABLE` and `TOOL_SHORTCUTS` must be kept in sync by hand.
- `REPLAY_ENABLED` is `false`; replay components exist but are disabled.
- The repo is small (few commits). Re-read the relevant file before editing; APIs may have shifted since this skill was written.

## 13. Never do

- Add another chart library, a second canvas, or DOM-positioned shapes over the chart.
- Recompute time/price ↔ pixel math yourself; use `resolve.ts`.
- Store pixel coordinates, or milliseconds, in a `DrawingLine`.
- Put indicator math inside React components.
- Import `services/demo/*` from UI code.
- Claim PineScript, CCXT, server alerts, or "20+ indicators" exist.
