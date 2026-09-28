# CONTEXT.md — Tradeye `/trade` terminal

Read this before changing anything under `components/trade/`, `app/trade/`,
or the theme/lint setup. It exists so a new session can modify the project
without breaking it.

## 1. What this is

`/trade` is a **frontend-only** trading + backtesting terminal (Next.js 16 App
Router, React 19, Tailwind v4). Live chart by default, synced bar replay,
paper trading, full drawing suite. There is **no backend**: synthetic stubs
stand in for market data and the trading engine, and are swapped with real
API code later. The landing page (`app/page.tsx`) is stock create-next-app.

## 2. Authoritative sources

- Chart/drawing architecture: `skills/OpenCharts/SKILL.md` — read it before
  touching any canvas, chart, or indicator code.
- Upstream engine source: `https://github.com/dylanpersonguy/OpenCharts`
  (the drawing engine was vendored from this repo, not reimplemented).
- Non-negotiable rules from the skill:
  - Extend the `DrawingsPrimitive`, never add a DOM/canvas overlay for drawings.
  - Anchors are stored data-space `{time (unix seconds), price}`; pixels only
    inside a render pass via `timeToX` / `xToTime` (never raw logical coords).
  - Indicators are pure functions; no chart calls in the math.
  - UI talks **only** to `components/trade/services/api.ts` and `services/ws.ts`.
    Never import `services/demo/*` from a component.

## 3. Architecture map (`components/trade/`, ~39 files)

- Shell: `Terminal.tsx` (layout + all wiring) ← `TerminalLoader.tsx`
  (client boundary for `dynamic(..., {ssr:false})`) ← `app/trade/page.tsx`
  (server, metadata only). `store.ts` holds symbol/timeframe/source + replay.
- `ChartPanel.tsx`: creates the lightweight-charts instance + series, owns the
  `DrawingToolsManager` lifecycle, live-tick forming-bar updates, theme sync.
- `lib/chart-plugins/` — **vendored OpenCharts engine, do not refactor
  casually**: `plugin-base.ts`, `helpers/assertions.ts`,
  `drawing-tools/{manager, drawings-primitive, resolve, renderers, hit-test,
  geometry, line-alerts, types}.ts`. Only the `drawings/constants` import path
  was adapted.
- `drawings/constants.ts` (`DrawingLine` JSON shape — keep stable, it is the
  persistence/API contract), `drawings/drawingStyles.ts` (defaults/templates).
- `services/`: `api.ts` + `ws.ts` are the **stable seams**;
  `demo/{synthetic, feed, candles, binance-json}` (market stub),
  `drawings-store.ts` (localStorage, `oc_drawings_<SYMBOL>` keys),
  `paper-engine.ts` (in-memory account; UI uses the `usePaper` hook).
- UI: `DrawingToolRail`, `DrawingsOverlay` (floating toolbar + settings +
  context menu), `ObjectTreePanel`, `ReplayBar`, `OrderTicket`,
  `PositionsPanel`; hooks `useMarketData`, `useChartDrawings` (100-step
  undo/redo), `useLineAlerts`; `ThemeToggle` + `theme-script.ts`.

## 4. Constraints that break things if ignored

- **lightweight-charts 4.2.3, v4 API only**: `addCandlestickSeries`,
  `series.attachPrimitive()`; never v5 `addSeries`. `subscribeCrosshairMove`
  returns void (unsubscribe via `unsubscribeCrosshairMove`).
- **Client-only chart code**: `"use client"` + `ssr:false` boundary. Never
  import a client module into a server component — the `theme-script.ts`
  split (plain module for the init script) is the pattern.
- **Manager lifecycle**: created per symbol in `ChartPanel`; TF switches go
  through `manager.updateTimeframe()` (no recreation, no drawing blink).
  Callbacks reach the manager via stable proxies + a ref updated in an effect.
  `setDrawings` is skipped mid-drag (manager owns the local copy until
  `onUpdate` syncs back).
- **Replay position is a moment, not a count**: every TF renders bars with
  `time <= replayTime`, which is what keeps all timeframes synced. Do not
  reintroduce count-based slicing.
- **Lint gates** (`bun run lint`, must stay zero-warning): no setState inside
  effects, no ref reads/writes during render. Approved workaround is
  render-time derived state (`if (prev !== next) { setPrev(next); ... }`).
- **Synthetic data is seeded and deterministic** (anchor: first BTC 1h close
  `78144.48`). Intraday TFs aggregate exactly from one 30-day 1m master;
  1h caps at 720 and 4h at 180 bars — that is expected, not a bug.
- `@shadcn/lint` is registered with **zero rules by decision**; add
  `no-arbitrary-values` first when ready, then `no-restyle` contracts.

## 5. Seams for real-backend / follow-up work

Replace (UI untouched): `services/api.ts`, `services/ws.ts`,
`services/paper-engine.ts` (behind a future `api.trading`), `drawings-store.ts`,
`services/demo/binance-json.ts` (loader exists; no fetch script or JSON yet —
`bundled` mode falls back to synthetic until then).
Documented stub limits: fills immediate (no resting book); live SL/TP uses
tick points while replay uses full bar ranges; account is in-memory (resets on
reload); line-cross alerts watch the live feed only; position SL/TP lines are
not drawn on the chart.

## 6. Verification workflow

```
bun run lint && npx tsc --noEmit && bun run build
```

Runtime suites (bun, no browser needed): synthetic invariants + determinism,
drawings hit-test/alerts, cross-TF replay sync, paper engine fills/stops, a
replay-stepped session test. `/trade` must serve HTTP 200.
Manual browser checklist (never automated — do before calling work done):
place → drag anchor/body → TF + symbol switch → reload persistence →
undo/redo → object tree ops → settings per type → context menu → line alert
cross → replay pick/play/step/scrub → trade mid-replay → Go live →
ticket validation → close-all → theme toggle + narrow viewport.

## 7. Key decisions on record

Data: synthetic default + bundled-JSON loader switch. Symbols: all six
(BTC/ETH/SOL/BNB/XRP/ADA). Drawings: full suite port. Replay includes paper
trades. Styling: installed Geist + Tailwind tokens, no parallel brand layer;
explicit `dark`-class toggle (overrides the no-switcher guideline).
