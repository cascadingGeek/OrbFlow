# Verify: value format, image values, minimum text · spec 0007 · updated 2026-10-21
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Open a chart with no `formatValue` → the canvas shows `42` (no `%`), the tooltip says `Value: 42`, the hidden button reads `A, value 42`    → AC-1, AC-2
- [x] Set `formatValue: (v) => "$" + v` → canvas, tooltip, and hidden button all read `$42`    → AC-2
- [x] Set `formatValue: (v) => v * 0.1 + 0.2` style float, then `formatValue: String` → the float shows in full, and `String` returns to the plain number    → AC-1, AC-2
- [x] Use a formatter that throws → the chart keeps drawing the plain number, the console shows one `OrbFlow: formatValue handler threw.` line    → AC-3
- [x] Use a formatter that returns `"  "` → no value on the canvas, no `Value:` line, hidden text has no `, value`    → AC-3
- [x] Pop a bubble with `popStyle: "ghost"`, change `formatValue`, then `restore()` → the ghost keeps the old text, the restored bubble shows the new text    → AC-4
- [x] Pause the chart, call `updateConfig({ formatValue })` with a focused hidden button and an open tooltip → one redraw, no queued frame, the button node and focus stay, text and tooltip change    → AC-5
- [x] In React, pass an inline `formatValue` on every render → no `updateConfig` call, no new canvas; the newest function runs on the next draw    → AC-6
- [x] Give an image bubble with radius 50 or more a value → it draws under the label, inside the circle; below radius 30 it is absent    → AC-7
- [x] Set `minTextSize: 6`, then `0`, `NaN`, and `"a"` → 6 shows text that 10 hides; the bad values warn once and use 10    → AC-8, AC-9
- [x] Use `$1,234,567.89` on a small bubble → hidden or small, never wider than the bubble, plain and image    → AC-10a
- [x] Use a formatter that returns a new string every frame for several seconds → memory stays flat, the chart stays smooth    → AC-12

## Commands
- [x] `npm run lint && npm run typecheck && npm test` → all pass    → AC-1 to AC-12
- [x] `npx playwright test e2e/look.e2e.ts` → text stays inside the circle for plain and image bubbles at radius 40 to 100    → AC-7, AC-10a
- [x] `npm run build && npm run size` → core under 16 kB, react under 17 kB, cdn under 16 kB    → AC-11
- [x] `npm run check:package && npm run smoke` → pass, and the TypeScript fixture compiles both options from both entries    → AC-10
- [x] `wc -l app/core/OrbChart.ts app/renderer/CanvasRenderer.ts app/renderer/ValueFormatter.ts` → 285 or fewer, under 200, about 80 or fewer    → AC-11
- [x] `grep -n "formatValue\|minTextSize" README.md docs/integration-guide.md` → both options are in the tables, the `%` note is gone    → AC-10, AC-10b

## Acceptance-criteria coverage
- AC-1 … steps 1, 3 · AC-2 … steps 1 to 3 · AC-3 … steps 4, 5 · AC-4 … step 6 · AC-5 … step 7 · AC-6 … step 8 · AC-7 … step 9, e2e · AC-8, AC-9 … step 10 · AC-10 … fixture and docs commands · AC-10a … step 11, e2e · AC-10b … docs grep · AC-11 … size and line count commands · AC-12 … step 12
