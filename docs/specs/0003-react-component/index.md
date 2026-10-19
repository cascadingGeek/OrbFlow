# 0003. Production ready React component

**Date**: 2026-10-19
**Status**: Proposed

## Summary

This spec makes `<OrbChart>` behave like a well made React component. It renders safely on the server, survives strict mode double mounting, always calls the newest callbacks, and does no work when props are re-created with the same values. A ref gives the developer `start`, `pause`, and `getData`. One small core fix goes with it: a chart paused through the ref stays paused when new data arrives. The public API grows by one type (`OrbChartHandle`) and nothing else.

## Requirements

**User stories**:
- As a developer using Next.js or another server rendering setup, I want `<OrbChart>` to render on the server without errors or warnings, so my pages do not break.
- As a developer, I want to change `onOrbClick`, `onOrbHover`, or `onDataIssue` between renders and have the newest one run, so I never get a stale closure.
- As a developer who writes inline props like `config={{...}}` or `colorScheme={[...]}`, I want no extra chart work on every render, so the chart stays smooth.
- As a developer, I want a ref to pause, resume, and read the current data, so I can build controls around the chart.
- As a developer with live data, I want a paused chart to stay paused when new data arrives, so "pause" means pause.

**Acceptance criteria**:
- **AC-1** (server render): `renderToString(<OrbChart data={...} className="c" style={{...}} />)` in a Node test environment with no `window` or `document` does not throw and logs no warning. The output is one `div` carrying the class and style, with no `canvas`.
- **AC-2** (hydration): Hydrating that server markup with `hydrateRoot` in jsdom logs no mismatch warning, and after mount the container holds exactly one `canvas`.
- **AC-3** (strict mode and unmount): Under `StrictMode`, mount, cleanup, and mount again leaves exactly one canvas and one live `ResizeObserver`. The first chart's resources are all released. After unmount the fake DOM reports zero live listeners, observers, frames, and timers.
- **AC-4** (latest callbacks): Re-rendering with a different `onOrbClick`, `onOrbHover`, or `onDataIssue` makes the next event call the new function. It does not create a new chart (same canvas element) and does not call `updateConfig`. Removing a callback (value becomes `undefined`) makes the event do nothing and does not throw.
- **AC-5** (config comparison): Re-rendering with new props that hold equal values, including a new `colorScheme` array with the same items in the same order, causes zero `updateConfig` calls. Changing one value causes one `updateConfig` call carrying only that key. Callback props never cause an `updateConfig` call.
- **AC-6** (data comparison): Without strict mode, mounting calls `setData` exactly once (under strict mode, once per created chart). Re-rendering with the same `data` reference calls it zero times. A new `data` reference calls it exactly once.
- **AC-7** (ref handle): `ref.current` is `null` before mount and after unmount, and otherwise an `OrbChartHandle` with `start`, `pause`, and `getData`. The handle object is the same across re-renders. `getData()` returns the chart's current live orbs without exiting ones (the objects are read only, as the TSDoc says). If `pause()` is called before the chart exists (for example from a parent's layout effect), the pause is remembered and applied as soon as the chart is created, including after a strict mode or remount recreation. After unmount, `start` and `pause` do nothing and `getData()` returns `[]`, without throwing.
- **AC-8** (pause and resume): After `ref.current.pause()` no animation frame is queued. After `ref.current.start()` frames run again.
- **AC-9** (paused data, core): When `pause()` was called, `setData` applies the new data, draws one frame, and leaves no frame queued. Sizes jump to their targets (duration 0), new orbs appear at full size, and removed orbs vanish. A chart that was never paused still starts on `setData`, as today. New orbs sit at their spawn spots (as `create()` places them) and may overlap until `start()` runs physics again. This replaces the "paused `setData` resumes" rule in spec 0002 AC-9.
- **AC-10** (mount failure): If the core constructor throws while mounting, the error reaches a React error boundary around the component, and the container is left clean.
- **AC-11** (public surface and docs): The React entry exports exactly `OrbChart` at runtime, plus the types `OrbChartProps`, `OrbChartHandle`, and the five data types it already re-exports. `OrbChartProps`, `OrbChartHandle`, each handle method, and the component carry TSDoc with defaults. The TSDoc states the data rule, the removed prop rule (AC-12), that `getData()` orbs are read only, and that `damping`, `minVelocity`, and `bounceCoefficient` only take effect at mount. Spec 0001 AC-3 (which wrongly lists four data types today), `verify-dist`, and the TypeScript fixture are updated to match.
- **AC-13** (size budget): `npm run size` passes with the React entry within its 9 kB budget, or the budget is revised on purpose in spec 0001. The headroom is measured before slice 1 and recorded in the spec's Follow-up.
- **AC-14** (React 19): The React tests also pass against React 19 in a CI matrix job, and the TypeScript fixture compiles `OrbChartHandle` against `@types/react` 19.
- **AC-15** (paused redraw): While paused, a container resize or an `updateConfig` that changes how the chart looks (`colorScheme`, `backgroundColor`, radii) draws one frame and queues none, so a paused chart is never blank or stale.
- **AC-12** (removed props): When a config prop changes from a value to `undefined` (or is removed), the chart keeps its last value. The component does not reset it to the default. This is covered by a test and by the TSDoc.

## Decision

**Chosen option**: Option 1: Keep the wrapper thin, fix the hooks, add a small ref handle

`<OrbChart>` becomes a `forwardRef` component that creates the core chart once on mount, forwards the newest callbacks through stable wrappers, sends only changed config keys, and exposes `OrbChartHandle` (`start`, `pause`, `getData`). The core gains one fix so a paused chart stays paused on `setData`.

**Implementation skills**: none relevant installed. The React and tsdown conventions come from `AGENTS.md`.

## Rationale

Reasoning and options: see [rationale.md](./rationale.md).

## Feature design

**Data model sketch**: none. No schema, no persistence. React state held in refs: the chart instance, the latest callbacks, the last applied config, the last applied data reference.

**State transitions**:
- Mount effect: create chart (initial config with callback wrappers) → `setData(data)` → `start()`.
- Cleanup: `destroy()`, clear the chart ref.
- After a `pause()`, the core stays paused until `start()` (this includes `setData` calls).

**Public API (additions)**:

| Name | Kind | Shape | Notes |
|---|---|---|---|
| `OrbChartHandle` | type, React entry only | `{ start(): void; pause(): void; getData(): Orb[] }` | New 1.0 promise. No `updateConfig`, no `destroy`: props own config, React owns the lifecycle. |
| `OrbChart` | component | `forwardRef<OrbChartHandle, OrbChartProps>` | Works the same on React 18 and 19. |
| `OrbChartProps` | type | unchanged: `OrbChartConfig` plus `data`, `className`, `style` | No `paused` prop, no extra div attributes. |

**Component behavior**:
- Render: only `<div ref className style>` with default `width: 100%; height: 100%` that `style` can override. It reads no `window` or `document`.
- Callback wrappers: three stable functions (`onOrbClick`, `onOrbHover`, `onDataIssue`) are passed to the core at mount. They call the newest function held in a ref (a no op if it is `undefined`). The ref is refreshed by an effect declared before the mount effect.
- Config updates: after each render an effect compares the props, other than `data`, `className`, `style` and the callbacks named in one constant (`onOrbClick`, `onOrbHover`, `onDataIssue`), against the last applied ones, over the union of the old and new keys. Each value is compared with `Object.is`, except arrays (only `colorScheme`) which are compared item by item. The changed keys, if any, go to `updateConfig` in one call. A key that became `undefined` is skipped and the recorded value stays the old one, so the chart keeps its last value and going back to it later costs no call.
- Data updates: an effect calls `setData` only when the `data` reference differs from the last applied one. The mount effect records the first config and data (and records them again on every recreation), so mount calls `setData` once and the first config effect run sends nothing.
- Effects other than mount return early when there is no chart, which is the case after a failed mount.
- Handle: `useImperativeHandle` with an empty dependency list. Methods read the chart ref when called. A `pause()` that arrives before the chart exists sets a pending flag, which the mount effect applies right after `start()` (it calls `pause()` instead of leaving the loop running).
- Errors: the core constructor error is not caught, so it reaches the nearest error boundary.
- Helpers (the config diff and the latest callback ref) live beside the component in `app/react/`, are not exported from the entry, and keep each file under about 200 lines.

**Core change (spec 0002 amendment)**: a small `Playback` class wraps `AnimationLoop` and owns a user paused flag. `pause()` sets it, `start()` clears it, and `shouldAutoStart()` is true when it is clear. `setData` asks it: while paused, it reconciles with a duration of 0 (a new optional `duration` argument on `OrbReconciler.reconcile`, like `retargetAll` has), settles, draws once, and does not start the loop. When not paused it behaves exactly as today, including starting a chart that was never started. `updateConfig` keeps testing `loop.playing` for its jump versus animate choice. While paused, `handleResize` and any `updateConfig` that changes the picture draw once (AC-15). `OrbChart.ts` is 225 lines now; the logic lives in `Playback` so the class does not grow.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Mount | Initial config for the core | The first render's props, minus `data`, `className`, `style`, with the three callbacks replaced by stable wrappers |
| Mount | Initial orbs | The first render's `data` prop |
| Config effect | Keys to send to `updateConfig` | Props that differ (by the rule above) from the last applied props, held in a ref |
| Callback wrapper | Function to call | The newest callback prop, held in a ref |
| Event callbacks | `Orb` and event arguments | Passed through unchanged from the core |
| `handle.getData()` | Current orbs | The core `getData()` (live objects, read only by contract, excludes exiting orbs); `[]` when the chart is not mounted |
| Mount | Initial paused state | The pending pause flag set by an early `pause()`, else running |
| `handle.start()` and `handle.pause()` | Effect on animation | The core `start()` and `pause()`; no effect when not mounted |

**Key invariants**:
- At most one core chart exists per mounted component, and none after cleanup.
- The core is never created, and `window` and `document` are never read, during render.
- A callback identity change never reaches the core and never causes an update.
- A paused chart never has a queued frame, whatever `setData` or `updateConfig` calls arrive.
- Removing a config prop never resets the chart (documented, AC-12).

**Security model**: no new data in or out, no network. Nothing beyond what the core already does. No compliance scope.

**Configuration required**: none. No new environment variables.

**Critical test scenarios** (React tests use the fake DOM in `app/test-support/fakeDom.ts`; SSR tests use a `@jest-environment node` docblock):
- Happy path: mount, click an orb, re-render with a new `onOrbClick`, click again, new handler runs and the canvas element is unchanged, verifies **AC-4**
- Happy path: ref `pause()` then `start()` toggles frame queueing, verifies **AC-7**, **AC-8**
- Failure case: a `ResizeObserver` stub that throws makes the constructor fail inside an error boundary; the boundary shows its fallback, the container is empty, and React's expected `console.error` is spied, verifies **AC-10**
- Edge case: parent layout effect calls `pause()` before the chart exists, chart is created paused, verifies **AC-7**
- Edge case: paused chart, container resize and `colorScheme` change, one frame drawn and none queued, verifies **AC-15**
- Failure case: unmount then call every handle method, nothing throws, verifies **AC-7**
- Edge case: inline config with equal values over many renders, zero `updateConfig` calls, verifies **AC-5**
- Edge case: pause, then new data, then count frames queued, zero, and `getData()` shows new orbs, verifies **AC-9**
- Server: `renderToString` in Node, then `hydrateRoot` in jsdom, verifies **AC-1**, **AC-2**
- Strict mode: double mount leaves one canvas and no leaks (timers counted with jest fake timers), verifies **AC-3**
- React 19: the React test files run in the CI matrix against React 19, verifies **AC-14**
- Surface: `verify-dist` and the TypeScript fixture see `OrbChartHandle` and still only `OrbChart` at runtime, verifies **AC-11**
- Size: `npm run size`, verifies **AC-13**
- Test setup: the hydration test uses a `@jest-environment jsdom` docblock with `installFakeResizeObserver()` and the frame queue; the server test uses a `@jest-environment node` docblock

## Build plan

Tracer Bullet: each slice goes through the component, the public types, the checks and fixtures, tests, and TSDoc, and leaves the package shippable. No schema, so there is no migration.

0. **Baseline.** Run `npm run build && npm run size` and record the React entry headroom against 9 kB in Follow-up before any change. Satisfies **AC-13**.
1. **Handle thread.** Convert the component to `forwardRef` with `useImperativeHandle`. Add `OrbChartHandle` with TSDoc, export it from `app/react/index.ts`, update spec 0001 AC-3's list, `verify-dist`, and the TypeScript fixture, and check the React size budget. Include the pending pause for a call made before the chart exists, and correct spec 0001 AC-3 to list five data types. Tests cover the ref being `null` before mount and after unmount, a stable handle, `getData`, and `start` and `pause` toggling frames. Satisfies **AC-7**, **AC-8**, **AC-11**, **AC-13**.
2. **Effect hygiene thread.** Add the latest callback ref and stable wrappers, the config diff (with item by item array comparison and `undefined` skipped), and the data reference check that also skips the redundant mount call. Keep helpers in their own small files under 200 lines. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-12**.
3. **Paused data thread (core).** Add the `Playback` class, the optional `duration` argument on `OrbReconciler.reconcile`, the paused `setData` path, and the paused redraw after resize and config changes, so `OrbChart.ts` does not grow. Update spec 0002's AC-9 text, its build plan line ("Paused `setData` resumes"), and its `verify.md` line, and flip the core lifecycle test "resumes a paused chart on setData". Add core tests for AC-9 and AC-15. Satisfies **AC-9**, **AC-15**.
4. **Server, strict, and failure hardening thread.** Add the Node environment `renderToString` test, the jsdom `hydrateRoot` test, the strict mode leak counts, and the error boundary test. Add the React 19 job to the CI workflow and run the React tests and TypeScript fixture against it. Fix whatever they find in the component. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-10**, **AC-14**.

## Consequences

**Positive**:
- Safe in server rendered React, strict mode, and error boundaries.
- Callbacks are never stale, and inline props no longer cause work each render.
- Developers get a small, stable handle without a path to fight the props or React's lifecycle.
- "Pause" now means pause for every user of the core, not only React users.

**Negative / tradeoffs**:
- The public API grows by one type, a 1.0 promise.
- Behavior change in the core: `setData` on a paused chart no longer resumes it. Anyone who relied on that must call `start()`.
- Removing a config prop does not reset it, because `updateConfig` ignores `undefined`. Developers must pass an explicit value to change it back.
- Passing a new `data` array every render still calls `setData` every render. This is cheap, since orbs match by `id`, but it is not free. The README should say to keep `data` stable (row 8).
- No `paused` prop and no div attributes yet, so declarative pause and `aria-*` wait for later releases (row 6 decides the aria part).
- If React remounts the component without unmounting its parent (for example hidden and shown again by Offscreen style features), the chart is recreated and a pause is lost.
- The React entry grows a little and must stay inside its 9 kB budget.

**Neutral**:
- The new helper files are internal and not part of the public surface.
- README text for the ref, data stability, and removed props belongs to row 8. TSDoc lands with each slice.

## Follow-up

- [ ] Spec 0002 AC-9 and its `verify.md` line change with slice 3. Mark the old rule as replaced by this spec.
- [ ] Spec 0001 AC-3's export list gains `OrbChartHandle` (slice 1).
- [ ] Row 6 (accessibility) decides which `aria-*` and div attributes `OrbChartProps` accepts, and whether `getData` helps build the text alternative.
- [ ] Row 7 (idle behavior) can reuse the user paused flag so it does not fight a user pause when the tab is hidden and shown.
- [ ] Row 8 (README) documents: keep `data` stable, removed props do not reset, pause behavior, the ref handle, and server rendering with `"use client"`.
- [ ] Row 9 (examples) includes a server rendered React example that exercises AC-1 for real.
- [ ] Consider a `paused` prop or a `reset` path for removed props in a minor release if developers ask.
- [ ] `damping`, `minVelocity`, and `bounceCoefficient` are read once at mount, and `width` and `height` are overwritten by the measured container size. Today `updateConfig` accepts them but they change nothing. TSDoc says so now; decide before 1.0 whether to make them live or remove them from `updateConfig`.
- [ ] Slice 0 records the measured React size headroom here: not yet measured.
- [ ] `OrbChart.ts` is already above the 200 line guideline (225). Slice 3 must not grow it.
