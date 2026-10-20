# Verify: bubble redesign and burst · spec 0005 · updated 2026-10-20
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Move the mouse over empty space, then a bubble, then off the canvas → arrow, hand, arrow → AC-1
- [ ] Click a bubble → `onOrbClick` fires, nothing scatters; click empty space → nearby bubbles push away → AC-2
- [ ] Load values 95.5, 48.6, 7.2, 3.2 with defaults → radii about 80, 57, 22, 15; 3.2 is clearly small → AC-3
- [ ] Load a long label on a tiny value → label hidden, nothing spills past the circle; a 30 px bubble shows no value → AC-4
- [ ] Load Nunito on the page and pass `fontFamily: "Nunito, sans-serif"` → labels use it → AC-4
- [ ] Set `backgroundColor` light, then dark, then `"transparent"` over a light page with `theme: "light"` → recipe and label color follow, page shows through → AC-5
- [ ] Compare against the design canvas boards "Before and after" and "Bubble anatomy" on light and dark → clear center, bright rim, film, crescent, spot, glint, lift → AC-6
- [ ] Watch for 15 s while moving → the film shimmer turns; pause → it holds → AC-6
- [ ] Give bubbles images → image fills the bubble, curves away at the edge, glass sits on top → AC-7
- [ ] Call `chart.pop("btc")` twice → first returns true and bursts, second returns false; `onOrbPop` fired once; neighbors drift into the gap → AC-8
- [ ] Set `popOnClick: true`, click a bubble → details callback, then burst; Tab to a bubble and press Enter → same → AC-9
- [ ] Compare a burst against the board "Burst, frame by frame" → stretch, snap, ring, droplets, specks, about 0.8 s → AC-10
- [ ] Pause, then pop → bubble gone (or ghost) at once, nothing animates; resume → it stays gone → AC-11
- [ ] Turn on reduce motion, pop → instant, no droplets → AC-11
- [ ] Set `popStyle: "ghost"`, pop two bubbles → dashed ghosts under live bubbles; call `setData` with one of them → ghosts cleared, that one grows back → AC-12
- [ ] VoiceOver or NVDA: focus a bubble, press Enter with `popOnClick` on → hears "<label> popped", focus lands on the next bubble → AC-13
- [ ] React app: pass `onOrbPop` inline, pop via `ref.current.pop(id)` → works, no remount → AC-14
- [ ] Chrome performance panel, 50 bubbles with images, moving → about 60 fps on a mid range laptop; write the number down → AC-18

## Commands
- [ ] `npm test` → all suites pass → AC-1 to AC-16
- [ ] `npm run typecheck && npm run lint` → clean → AC-15
- [ ] `npm run build && npm run check:package && npm run size` → green, export keys unchanged, 12/13/12 kB budgets hold → AC-15, AC-17
- [ ] `npm run smoke` and `ORBFLOW_REACT_MAJOR=19 npm run smoke` → fixtures compile the new options and `pop` → AC-14, AC-15
- [ ] Count lines of the new classes, `CanvasRenderer.ts`, `AccessibleLayer.ts`, `OrbChart.ts` → under about 200, under 200, at most 211, at most 260 → AC-17

## Acceptance-criteria coverage
- AC-1, AC-2, AC-9 · `CanvasInput` and activate tests · AC-3 · `OrbReconciler` tests · AC-4 · `LabelFitter` tests · AC-5 · `resolveTheme` tests · AC-6, AC-7 · `BubblePainter` tests with the recording context · AC-8, AC-11, AC-12 · `PopController` and chart level tests · AC-10 · `BurstEffects` tests with the fake clock · AC-13 · `LiveAnnouncer` and focus tests · AC-14 · React tests · AC-15, AC-17 · fixtures, `verify-dist`, size budgets · AC-16 · lifecycle tests · AC-18 · manual only
