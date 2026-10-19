# Verify: production ready React component · spec 0003 · updated 2026-10-19
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Render `<OrbChart>` in a Next.js (or other server rendered) page and load it → no console warning, one canvas after load → AC-1, AC-2
- [ ] Run the page under `StrictMode` in dev → one canvas, chart animates, no duplicate listeners → AC-3
- [ ] Swap `onOrbClick` for a new function on a button press, then click an orb → the new function runs, the chart does not flicker or restart → AC-4
- [ ] Pass inline `config` and `colorScheme` props that re-render often → the chart stays smooth, no resets → AC-5
- [ ] Re-render with the same `data` reference, then a new one → only the new reference updates the chart → AC-6
- [ ] Wire buttons to `ref.current.pause()`, `start()`, and `getData()` → motion stops and resumes, `getData()` lists current orbs → AC-7, AC-8
- [ ] Pause, then feed new data → orbs show the new data as a still picture and stay paused → AC-9
- [ ] Pause, then resize the window and change `colorScheme` → the chart is never blank or stale → AC-15
- [ ] Remove a config prop (for example `minRadius`) → the chart keeps its last value → AC-12
- [ ] Make mounting fail (for example no `ResizeObserver`) inside an error boundary → the fallback shows and the container is empty → AC-10

## Commands
- [ ] `npm test` → all suites pass, including `app/react/*.test.tsx` → AC-1 to AC-10, AC-12, AC-15
- [ ] `npm run build && npm run check:package` → `verify-dist` passes, only `OrbChart` exported at runtime → AC-11
- [ ] `npm run size` → react entry stays under 9 kB (6.24 kB measured) → AC-13
- [ ] `npm run smoke` → esm, cjs, ts, bare all OK; ts fixture compiles `OrbChartHandle` → AC-11
- [ ] `ORBFLOW_REACT_MAJOR=19 npm run smoke` and `npm test -- app/react` after installing React 19 → pass → AC-14

## Value sourcing
- [ ] Mount with `className`, `style`, and `colorScheme` → the core gets the first render's props without `data`, `className`, `style` → Mount config
- [ ] Change one config prop → `updateConfig` receives only that key → Config effect
- [ ] Change a callback → the next event calls the newest one → Callback wrapper
- [ ] Call `getData()` before mount and after unmount → `[]` → `handle.getData()`
- [ ] Call `pause()` before the chart exists → chart starts paused → Mount initial paused state

## Acceptance-criteria coverage
- AC-1, AC-2 · `OrbChart.server.test.tsx`, `OrbChart.hydrate.test.tsx` · AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-12 · `OrbChart.behavior.test.tsx`, `diffConfig.test.ts` · AC-9, AC-15 · `OrbChart.lifecycle.test.ts`, `Playback.test.ts`, behavior tests · AC-10 · behavior tests · AC-11 · `verify-dist`, ts fixture · AC-13 · `npm run size` · AC-14 · CI `react-19` job
