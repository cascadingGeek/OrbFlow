# Verify: production ready core lifecycle · spec 0002 · updated 2026-10-19
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Mount a chart in a page, call `destroy()`, inspect the container and DevTools listeners → container empty, no canvas or tooltip, no listeners left → AC-1
- [x] Call `destroy()` twice, then `setData`, `start`, `pause`, `updateConfig` → no errors, `getData()` is `[]` → AC-2
- [x] Call `setData` with one changed value and one new id → existing orb keeps its spot and its size animates; new orb grows from 0 → AC-3, AC-4
- [x] Call `setData` without one id → that orb shrinks out and disappears; set it back mid shrink → same orb grows back → AC-4
- [x] Change an orb's label, value, color, imageUrl → updates in place; omit color → keeps its color → AC-5
- [x] Pass `[{id:"a",label:"A",value:NaN}, {id:"a",...}, null]` → chart does not crash, one console warning, `onDataIssue` called once → AC-6, AC-7
- [x] Set `transitionDuration: 0` and `-5` → snaps instantly; negative warns and uses 400 → AC-8
- [x] Pause the chart, then call `setData` → new data is drawn once and the animation stays paused (changed by spec 0003 AC-9) → AC-9
- [x] On a phone or touch emulation, tap an orb → tooltip above the tap, hides after 2.5 s or on empty tap; tap a second orb → tooltip switches; page still scrolls → AC-10
- [x] `updateConfig({ maxRadius: 120 })` → all orbs animate to new size; `updateConfig({ transitionDuration: undefined })` keeps 400 → AC-11
- [x] Hover an orb while it is removed → tooltip hides; change its value while hovered → tooltip text updates → AC-12, AC-15
- [x] Create a chart in a 0 sized container, set data, then give the container a size → orbs appear at random spots inside it → AC-4
- [ ] Vary the value range (one huge value) → every orb's target radius follows `minRadius + (value - min) / (max - min) * (maxRadius - minRadius)` → Value sourcing (radius)
- [ ] Add and remove other orbs → an existing orb's float wobble does not jump → AC-16

## Commands
- [x] `npm test` → all suites pass → AC-1 to AC-16
- [x] `npm run typecheck && npm run lint` → clean → AC-13
- [x] `npm run build && npm run check:package && npm run size` → green, runtime export keys are exactly `['OrbChart']`, budgets hold → AC-13
- [x] `npm run smoke` → ts fixture compiles `OrbDataIssue` from both entries → AC-13
- [x] Constructor with missing container, no canvas context, or no `ResizeObserver` → throws and leaves the container clean → AC-14

## Acceptance-criteria coverage
- AC-1, AC-2, AC-14 · teardown tests in `OrbChart.lifecycle.test.ts` · AC-3, AC-4, AC-5, AC-12 · in place updates tests and `RadiusTweener.test.ts` · AC-6, AC-7 · `DataValidator.test.ts` and lifecycle tests · AC-8, AC-11 · `ConfigResolver.test.ts` and lifecycle tests · AC-9 · lifecycle playback test · AC-10, AC-15 · lifecycle touch tests · AC-13 · smoke ts fixture and verify-dist · AC-16 · `OrbReconciler.test.ts`
