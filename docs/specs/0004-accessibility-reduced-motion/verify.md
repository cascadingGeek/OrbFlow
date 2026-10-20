# Verify: accessibility and reduced motion · spec 0004 · updated 2026-10-20
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Mount a chart with 5 orbs, open the accessibility tree in DevTools → one named list with 5 buttons, canvas and tooltip hidden → AC-1, AC-2
- [x] Set `ariaLabel` and `ariaDescription`, then change them with `updateConfig` → name and description change, no new list → AC-1
- [x] Press Tab once, then Tab again → focus enters the chart on one orb and the second Tab leaves it → AC-3
- [x] Press ArrowRight, ArrowDown, ArrowLeft, ArrowUp, Home, End → focus moves in data order, stops at both ends → AC-3
- [ ] Focus an orb → ring shows on the canvas and follows the orb while it floats; with `enableTooltip: false` the ring still shows → AC-5
- [ ] With the tooltip on, focus an orb, press Escape → tooltip hides; arrow to another orb → it shows again → AC-5
- [x] Press Enter, then Space on a focused orb → `onOrbClick` fires once each time, `onOrbHover` does not fire, orbs do not jump → AC-4
- [x] Focus an orb, then call `setData` without it → focus lands on the next orb; click elsewhere on the page first and repeat → focus is not stolen → AC-6
- [ ] Pause the chart, then move focus between orbs → ring and tooltip update, no animation resumes → AC-5, AC-10
- [x] Turn on "Reduce motion" in the operating system, reload → orbs settle before the first visible frame and stay still, no float, no fading tooltip → AC-7, AC-8, AC-9
- [ ] With reduce motion on, hover and click orbs → tooltip works, orbs are not pushed → AC-8
- [ ] With reduce motion on, call `setData` with a changed value and a new id → sizes jump, orbs stay put except small overlap fixes, then everything is still → AC-9
- [x] Flip the system setting while the page is open → chart stills or resumes without a reload; with `pause()` called first it stays paused both ways → AC-10
- [x] Set `reducedMotion: "always"` and `"never"` against the opposite system setting → the option wins → AC-7
- [ ] Turn on Windows High Contrast or forced colors → the focus ring is still visible → AC-5
- [ ] VoiceOver (macOS, Safari) and NVDA (Windows, Firefox or Chrome): navigate into the chart → name and "list, N items" announced, each orb reads "label, value N" → AC-1, AC-2
- [ ] VoiceOver on iOS or TalkBack on Android: swipe through orbs and double tap one → `onOrbClick` fires → AC-2, AC-4
- [ ] Run axe DevTools or Lighthouse accessibility on a page with the chart → no new violations from the chart → AC-1, AC-2
- [x] `destroy()` the chart, inspect the container and DevTools listeners → nothing the chart added remains → AC-11

## Commands
- [x] `npm test` → all suites pass → AC-1 to AC-12
- [x] `npm run typecheck && npm run lint` → clean → AC-13
- [x] `npm run build && npm run check:package && npm run size` → green, runtime export keys unchanged, budgets hold → AC-13, AC-14
- [x] `npm run smoke` and `ORBFLOW_REACT_MAJOR=19 npm run smoke` → fixtures compile the three options from both entries → AC-12, AC-13
- [x] Count lines of `AccessibleLayer`, `TooltipView`, `MotionPreference`, `Settler`, `Playback`, and `OrbChart.ts` → each new class under about 200, `OrbChart.ts` at most 218 → AC-14

## Acceptance-criteria coverage
- AC-1, AC-2, AC-4, AC-11 · `AccessibleLayer.test.ts` and lifecycle tests · AC-3, AC-5, AC-6 · keyboard and focus tests · AC-7, AC-10 · `MotionPreference.test.ts`, `Playback.test.ts`, and a chart level test with the faked `matchMedia` · AC-8, AC-9 · `Settler.test.ts`, `physics.test.ts`, and renderer tests · AC-12 · React server, hydrate, and strict mode tests · AC-13, AC-14 · smoke fixtures, `verify-dist`, and size budgets
