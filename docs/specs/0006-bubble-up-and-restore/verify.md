# Verify: bubble up and restore · spec 0006 · updated 2026-10-21
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones. The manual steps need a real browser._

## UI / manual
- [x] Put a chart below the fold, scroll down to it → bubbles rise from the bottom edge in a loose stagger, once; scroll away and back → nothing replays → AC-3, AC-17
- [x] Call `setData` with one new id → only that bubble rises, the others stay put → AC-4, AC-17
- [x] Set `popOnClick`, click bubble A, then bubble B → A rises back to its old place, B bursts → AC-10, AC-17
- [x] Open a drawer from `onOrbClick`, call `restore()` when it closes → the popped bubble rises back; try `popStyle: "remove"` and `"ghost"` (the ghost goes as the bubble returns) → AC-7, AC-17
- [x] Call `chart.pop("a")` from code, then click another bubble → "a" stays popped; `chart.restore("a")` brings it back → AC-9, AC-10
- [x] Set `enterStyle: "grow"` → new bubbles grow in place with no rise and no wait for scroll → AC-1
- [x] Pause the chart, call `setData` with new bubbles → they appear in place with no motion; resume → nothing replays → AC-6
- [x] Turn on reduce motion, call `restore()` → the bubble is back in place with no rise → AC-6
- [x] Hover and click a bubble while it is still rising → the hand cursor and the click follow where it is drawn, not its resting place → AC-5
- [x] Tab to a bubble that is still below the canvas → the focus tooltip stays inside the container → AC-5
- [ ] VoiceOver or NVDA: pop, then restore → hears "<label> popped", then "<label> restored"; click one bubble after another → hears "A restored, B popped" as one message → AC-11
- [ ] React app: pass `onOrbRestore` inline, call `ref.current.restore()`, keep `data` in `useMemo` → works, no remount; pass a new `data` array on each render → popped bubbles come back as new ones (documented) → AC-13
- [ ] Chrome performance panel, 50 bubbles with images, while rising → about 60 fps on a mid range laptop; write the number down, and if it is not smooth, send it to feature 7 → AC-17

## Commands
- [x] `npm test` → all suites pass → AC-1 to AC-15
- [x] `npm run lint` and `npm run format:check` → clean → AC-14
- [x] `npm run typecheck` → clean (after removing a stray iCloud copy `node_modules/@types/prop-types 2` and fixing three type errors) → AC-14
- [x] `npm run build && npm run check:package && npm run size` → green, export keys unchanged, budgets hold at 15 / 16 / 15 kB (re-run 2026-10-21 after the review fixes and the spec 0001 revision: core 14.44, react 15.03, cdn 14.50) → AC-14, AC-16
- [x] `npm run smoke` and `ORBFLOW_REACT_MAJOR=19 npm run smoke` → fixtures compile `enterStyle`, `restoreOnNextPop`, `onOrbRestore`, and `restore` from both entries → AC-14
- [x] Count lines of the new classes, `CanvasRenderer.ts`, and `OrbChart.ts` → each new class under 200, `CanvasRenderer.ts` 195, `OrbChart.ts` 285 → AC-16

## Acceptance-criteria coverage
- AC-1 · `ConfigResolver` and `OrbChart.rise` tests · AC-2 · `RiseTracker` tests with a fake clock and fixed `random` · AC-3, AC-15 · `EntranceGate` tests and the gate cases in `OrbChart.rise` with the fake `IntersectionObserver` · AC-4 · `Spawner` tests and `OrbChart.rise` · AC-5 · `OrbChart.rise` hit tests, `CanvasInput` hook · AC-6 · `OrbChart.rise` and `OrbChart.restore` idle cases · AC-7, AC-8, AC-9, AC-11, AC-12 · `PopLedger` tests and `OrbChart.restore` · AC-10 · `OrbChart.restore` activate cases · AC-13 · React behavior tests · AC-14, AC-16 · fixtures, `verify-dist`, size budgets, line counts · AC-17 · manual only
