# 0002. Production ready core lifecycle

**Date**: 2026-10-19
**Status**: In Progress

## Summary

This spec makes the vanilla `OrbChart` safe to create, update, and destroy many times in a real app. `destroy()` will remove everything the chart attached. Calling `setData` again will match orbs by `id`, keep them where they are, and animate their size instead of reshuffling the whole chart. Bad input is skipped and reported instead of crashing, and a tap on a touch screen works like a hover plus a click. It adds two config options and one exported type, and nothing else to the public API.

## Requirements

**User stories**:
- As a developer, I want `destroy()` to leave nothing behind, so mounting and unmounting the chart in my app never leaks.
- As a developer with live data, I want `setData` to update the chart smoothly, so bubbles grow and shrink in place instead of jumping.
- As a developer with messy data, I want bad rows skipped and reported, so one bad value never blanks or crashes the chart.
- As a phone user, I want to tap an orb and see its details, so touch works as well as a mouse.

**Acceptance criteria**:
- **AC-1**: After `destroy()`, the chart has no canvas and no tooltip element in its container, the `ResizeObserver` is disconnected, every listener it added is removed, the animation frame is cancelled, and the touch tooltip timer is cleared. Verified with the fake DOM, whose helper gains add/remove listener and timer counting in slice 1, by asserting zero live listeners, observers, frames, and timers.
- **AC-2**: `destroy()` can be called more than once. After it, `setData`, `start`, `pause`, and `updateConfig` do nothing and do not throw, and `getData()` returns `[]`. Pending images have their `onload` and `onerror` cleared in `destroy()`, so an image that finishes later changes nothing and logs nothing.
- **AC-3**: Calling `setData` with an `id` that already exists keeps that same `Orb` object with its `x`, `y`, `vx`, `vy` untouched. Its `radius` moves from the current radius to the new target over `transitionDuration` with an ease out cubic curve, and ends exactly on the target. A repeated `setData` whose target radius for an orb is unchanged leaves its running transition alone (the React wrapper calls `setData` twice on mount). The float wobble phase comes from a stable per orb seed, not the array index, so adding or removing other orbs never shifts it.
- **AC-4**: A new `id` enters at radius 0 at a random spot inside the bounds and grows to its target. If the container is 0 sized at that moment, the new orbs get their random positions on the first resize with a non zero size. An entering orb cannot be hit until it has grown. An `id` that is no longer in the list shrinks to radius 0 and is then removed. If a removed `id` comes back while it is shrinking, the same orb is revived and tweens from its current radius. Resize never touches transitions.
- **AC-5**: For an existing `id`, a changed `label`, `value`, `color`, `imageUrl`, or `metadata` updates in place. A new `imageUrl` is preloaded. A missing `color` keeps the orb's current color.
- **AC-6**: `setData` never throws on bad input. An entry is skipped when its `id` is not a non empty string, its `label` is not a string, or its `value` is not a finite number or is negative. A value of exactly 0 is valid. When two entries share an `id`, the first is kept and later ones are skipped. An empty list is valid and removes all orbs. A non array argument is treated as an empty list and warned about.
- **AC-7**: When any entry was skipped, `console.warn` is called once for that `setData` call, and `onDataIssue` (if set) is called once with every `OrbDataIssue`, after the update has been applied. If the handler throws, the error is caught and logged, and the update still stands.
- **AC-8**: `transitionDuration` defaults to 400 (milliseconds). `0` makes enter, exit, resize, and retarget snap instantly. A negative or non finite value falls back to 400 with a `console.warn`.
- **AC-9**: Calling `setData` on a paused chart resumes the animation. Calling it on a destroyed chart does nothing.
- **AC-10**: On a touch pointer, tapping an orb shows its tooltip, calls `onOrbHover(orb)`, then `onOrbClick`. The tooltip hides after 2500 ms or when the user taps empty canvas, and `onOrbHover(null)` is called when it hides. Tapping another orb before the timer ends switches the tooltip, calls `onOrbHover(newOrb)` with no `null` between, and restarts the timer. Tapping the same orb only restarts the timer, and `onOrbClick` fires every time. Every `pointermove` and `pointerleave` whose `pointerType` is `touch` is ignored, and `pointerType` is read from the `click` event, falling back to the value recorded on `pointerdown`. The touch tooltip is placed above the tap point. Mouse and pen hover behave as they do today. The chart does not set `touch-action` or call `preventDefault`, so page scrolling still works.
- **AC-11**: `updateConfig` ignores keys whose value is `undefined`, so a defaulted option is never overwritten with `undefined`. Changing `minRadius` or `maxRadius` (the merged value differs from the current one by `!==`, not merely present) recomputes every orb's target radius and tweens to it. Passing the same values again does nothing. While the chart is paused, a retarget applies with duration 0 and draws one frame.
- **AC-12**: Orbs that are shrinking out are left out of `getData()` and of hover and click hit testing. They are still drawn and still collide until removed. List order is accepted entries in input order, then exiting orbs, and hit testing runs in reverse draw order. With `transitionDuration` 0, exiting orbs are removed inside `setData`.
- **AC-13**: The `orbflow` and `orbflow/react` entries both export the new type `OrbDataIssue`. `OrbChartConfig` gains `transitionDuration` and `onDataIssue`. The runtime export keys stay exactly `['OrbChart']`, and the size budgets from spec 0001 still pass.
- **AC-14**: If the constructor throws (container not found, no canvas context, no `ResizeObserver`), nothing is left attached to the container. Each resource is registered for teardown as soon as it is created, and the list runs before the error is rethrown.
- **AC-15**: After every `setData`, `updateConfig`, or tween step that removes an orb, a hovered or touch tooltipped orb that is no longer live has its tooltip hidden, its timer cleared, and `onOrbHover(null)` called. If the hovered orb's label or value changed, the tooltip text refreshes.
- **AC-16**: Config merges and `setData` never restart an orb's float phase: the phase is a per orb seed (a creation counter kept in a private map by `id`), and `Orb` is unchanged.

## Decision

**Chosen approach**: fix in place, by splitting the lifecycle work into small collaborators behind the unchanged `OrbChart` class.

Add an id based reconciler, a time based radius tweener, a pure data validator, and a canvas input class that owns every listener, and track every teardown step in one place so `destroy()` runs them all.

## Feature design

**Structure** (each under about 200 lines, dependencies passed through constructors):

| Class | Folder | Job |
|---|---|---|
| `OrbChart` | `core/` | Thin public facade. Owns the `destroyed` flag, the teardown list, and the orb list (each frame it assigns the array the tweener returns). It builds its collaborators with default values inside, so the public constructor signature does not change. |
| `ConfigResolver` | `core/` | Defaults, merge that skips `undefined`, and `transitionDuration` validation. |
| `AnimationLoop` | `core/` | Owns the animation frame id and the single clock `now: () => number` (default `performance.now()`), read once per frame and used for both the float offset and the tween. |
| `DataValidator` | `core/` | Pure. Turns the raw input into accepted entries plus `OrbDataIssue[]`. |
| `OrbReconciler` | `core/` | Matches accepted entries to live orbs by `id`. Creates, updates, revives, or marks orbs as exiting. Reads the live orbs and returns the new orb list in the order above. |
| `RadiusTweener` | `core/` | Holds one `OrbTransition` per orb and advances `radius` each frame using an injected clock. `step(orbs, now)` returns the surviving array and drops exited orbs. Unit tests inject a fake clock into it. |
| `CanvasInput` | `renderer/` | Extracted from `CanvasRenderer`. Registers canvas listeners, hit tests, runs the touch tooltip timer, and removes everything in `dispose()`. |
| `CanvasRenderer` | `renderer/` | Drawing and image cache only after the extraction. |

**Data model**:

| Entity | Public | Fields | Rules |
|---|---|---|---|
| `Orb` | yes, unchanged | `id`, `label`, `value`, `radius`, `x`, `y`, `vx`, `vy`, `color?`, `imageUrl?`, `metadata?` | `radius` is the current drawn radius. |
| `OrbTransition` | no, 1:1 with an orb by `id` | `fromRadius`, `toRadius`, `startedAt`, `duration`, `phase` (`enter`, `update`, `exit`) | `duration` is captured at start, so changing `transitionDuration` later never alters a running tween. Removed when `now >= startedAt + duration`. An `exit` transition also removes the orb. |
| `OrbDataIssue` | yes, type only | `index: number`, `id?: string`, `reason: "invalid-id" \| "invalid-label" \| "invalid-value" \| "duplicate-id"` | `id` is set only when the entry had a string `id`. |
| `OrbChartConfig` additions | yes | `transitionDuration?: number`, `onDataIssue?: (issues: OrbDataIssue[]) => void` | Defaults: 400, and a no op. |

**State transitions** (per orb): `enter` → (steady) → `update` → (steady) → `exit` → removed. An `exit` orb whose `id` returns becomes `update`.

**Interface surface**:

| Method or option | Inputs | Result | Key errors |
|---|---|---|---|
| `setData(data)` | `OrbDataInput[]` | Void. Applies the diff, resumes play. | Never throws. Issues go to `console.warn` and `onDataIssue`. |
| `updateConfig(partial)` | `Partial<OrbChartConfig>` | Void. Merges defined keys, retargets radii if `minRadius` or `maxRadius` changed. | Never throws. Bad `transitionDuration` falls back to 400 with a warning. |
| `destroy()` | none | Void. Idempotent. | None. |
| `getData()` | none | Copy of the live (non exiting) orbs, `[]` after destroy. | None. |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Reconcile | Target radius of each orb | `minRadius + (value - minValue) / (maxValue - minValue \|\| 1) * (maxRadius - minRadius)`, where `minValue` and `maxValue` come from the accepted entries and the radii from config |
| Reconcile | Transition start time | The `AnimationLoop` clock (`performance.now()` by default), read once at the `setData` or `updateConfig` call |
| Reconcile | Float wobble phase | Per orb seed from a creation counter in a private map keyed by `id` |
| Reconcile | Spawn position when the container is 0 sized | `Math.random()` bounds applied on the first resize with a non zero size |
| Reconcile | Transition length | `config.transitionDuration` |
| Reconcile | Spawn `x`, `y` for a new orb | `Math.random()` inside `[r, width - r]` and `[r, height - r]` using the target radius `r`, with the span floored at 0; `width` and `height` from config |
| Reconcile | Starting `vx`, `vy` for a new orb | `(Math.random() - 0.5)`, as today |
| Reconcile | Color of a new orb | `item.color`, else `colorScheme[acceptedIndex % colorScheme.length]` |
| Reconcile | Color of an existing orb | `item.color` if given, else the orb's current color |
| Tween | Current `radius` | Ease out cubic between `fromRadius` and `toRadius` using the clock at frame time |
| Touch tap | Which orb was hit | Canvas `offsetX`, `offsetY` against non exiting orbs |
| Touch tap | Whether the pointer was touch | `PointerEvent.pointerType` recorded on `pointerdown`, read on the `click` that follows |

**Key invariants**:
- `id` is unique across live and exiting orbs combined.
- Only accepted entries ever create or change an orb.
- A radius is never negative and never `NaN`.
- After `destroy()` no code path reads or writes chart state.
- `getData()` and hit testing never expose an exiting orb.
- Resize never touches transitions. Orbs are clamped by the next physics step, and spawn bounds use the size at `setData` time.

**Security model**: Not applicable. No new network, storage, or HTML paths. Tooltip text keeps using `textContent`.

**Configuration required**: none beyond the two new options.

**Critical test scenarios**:
- Happy path: create, `setData`, `setData` with one changed value and one new id, one removed id. The first orb keeps position, the new one grows from 0, the removed one shrinks and disappears, verifies **AC-3**, **AC-4**.
- Failure case: `setData([{ id: "a", label: "A", value: NaN }, { id: "a", ... }, null])` skips all three, warns once, calls `onDataIssue` once, verifies **AC-6**, **AC-7**.
- Teardown: create, `setData`, `destroy()`, then call every method again. Counts of live listeners, observers, frames, and timers are 0, verifies **AC-1**, **AC-2**.
- Constructor failure: canvas context returns `null`, container is left clean, verifies **AC-14**.
- Touch: touch `pointerdown`, `click` on an orb shows the tooltip, a fake 2500 ms later it hides, verifies **AC-10**.
- Config: `updateConfig({ transitionDuration: undefined })` keeps 400, and `updateConfig({ maxRadius: 120 })` tweens, verifies **AC-8**, **AC-11**.
- Surface: `verify-dist` still finds exactly `OrbChart` at runtime and the TypeScript fixture compiles `OrbDataIssue`, verifies **AC-13**.

## Build plan

Tracer Bullet: every slice goes through core, types, the React re-export, tests, and TSDoc, and leaves the package shippable. No schema, so there is no migration.

1. **Teardown thread.** Add counting helpers to `fakeDom` (listeners and timers). Add a teardown list to `OrbChart` and a `destroyed` flag with guards on every method. Extract `CanvasInput` from `CanvasRenderer` so it owns the canvas listeners and returns a `dispose()`. Disconnect the `ResizeObserver`. Clear pending image callbacks in `destroy()`. Create and check the canvas context before appending it, register every resource as it is created, and run the teardown list on any constructor failure. Extract `ConfigResolver` and `AnimationLoop` so `OrbChart` stays under about 200 lines. Tests with the fake DOM count live listeners. Satisfies **AC-1**, **AC-2**, **AC-14**, **AC-16** (the clock and seeded float phase land here).
2. **Validation and reporting thread.** Add `DataValidator`, the `OrbDataIssue` type, the `onDataIssue` option, and the single `console.warn`. Wire it into `setData` (orbs are still rebuilt in this slice). Export the type from `app/index.ts` and `app/react/index.ts`. Update spec 0001 AC-3's export list, `verify-dist`, and the TypeScript fixture on purpose. Satisfies **AC-6**, **AC-7**, **AC-13**.
3. **In place updates with animation thread.** Add `OrbReconciler`, `RadiusTweener`, and `transitionDuration`. Enter, update, exit, and revive work. `getData()` and hit testing skip exiting orbs. Paused `setData` resumes. `updateConfig` skips `undefined` and retargets on radius changes. Keep an unchanged transition on repeat calls, retarget only on a real change, apply retargets with duration 0 while paused, defer spawn positions for a 0 sized container, and order lists and hit tests as AC-12 says. Satisfies **AC-3**, **AC-4**, **AC-5**, **AC-8**, **AC-9**, **AC-11**, **AC-12**, **AC-16**.
4. **Touch thread.** Move hover and tooltip to Pointer Events in `CanvasInput`, keep `click` for activation, add the touch tooltip and its 2500 ms timer, ignore touch `pointermove` and `pointerleave`, handle a second tap, place the tooltip above the finger, and add `CanvasInput.sync(liveOrbs)` to clear stale hover. Satisfies **AC-10**, **AC-15**.

## Consequences

**Positive**:
- Mount and unmount cycles (React strict mode, route changes) leave nothing behind.
- Live data updates read as motion instead of a reset.
- A bad row degrades one orb instead of the whole chart.
- Touch users can read values, and `CanvasRenderer` drops under the 200 line guideline.

**Negative / tradeoffs**:
- The public API grows by two options and one type, a 1.0 promise.
- Behavior change: `setData` no longer reshuffles. Anyone relying on that will see orbs stay put.
- One large new value rescales every orb, so the whole chart animates on a single change.
- Skipping bad rows hides data bugs unless the developer watches the console or sets `onDataIssue`.
- `setData` on a paused chart restarts motion, which surprises someone who paused on purpose.
- Exiting orbs still collide while they shrink, a small per frame cost.
- Two more internal classes (`ConfigResolver`, `AnimationLoop`) and a larger `OrbChart` test surface.

**Neutral**:
- The tween runs inside the existing animation loop, so a hidden tab behaves as it does today until row 7 changes idle behavior.
- README updates for the new options belong to row 8. TSDoc on every new export is part of each slice.

## Follow-up

- [ ] Row 5 (React component) should pass `onDataIssue` and `transitionDuration` straight through and rely on `updateConfig` ignoring `undefined`.
- [ ] Row 6 (reduced motion) can set `transitionDuration` to 0 instead of adding a new option.
- [ ] Row 7 (idle behavior) should revisit paused `setData` resuming play and stop the loop when no tween or motion remains.
- [ ] README rows for `transitionDuration`, `onDataIssue`, and `OrbDataIssue` land with row 8.
- [ ] `minRadius` greater than `maxRadius` is not validated here. Decide whether to handle it before 1.0.
- [ ] `DataValidator` checks only `id`, `label`, and `value`. A non string `color` or `imageUrl` passes through. `OrbDataIssue.reason` may gain members in a minor release, so handlers should keep a default branch. Document that in the README (row 8).

## Rationale

Reasoning and options: see [rationale.md](./rationale.md).
