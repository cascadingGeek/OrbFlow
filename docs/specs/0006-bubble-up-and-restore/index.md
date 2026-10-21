# 0006. Bubble up and restore

**Date**: 2026-10-21
**Status**: In Progress

## Summary

This spec makes bubbles rise from below the chart, like the bubbling on cryptobubbles.net. They rise when the chart first scrolls into view and whenever new bubbles are added. It also lets a popped bubble come back by rising up again. A new `restore(id?)` method does this, for example when your side drawer closes, and a new `restoreOnNextPop` option (on by default) brings the earlier popped bubble back when the user clicks another one. It works the same for both `popStyle` values. Reduced motion, pause, and `transitionDuration: 0` skip the rise, so nothing moves when it should not.

## Requirements

**User stories**:
- As a user scrolling down a page, I want the bubbles to rise up into view when I reach the chart, so the chart feels alive and I see the motion.
- As a user, I want newly added bubbles to rise in the same way, so a data update reads as "more bubbles arrived".
- As a user who popped a bubble to open its details, I want that bubble to rise back when I close the details or pick another bubble, so the chart is whole again.
- As a developer, I want one method to bring popped bubbles back from my drawer's close handler, and a way to switch each new behavior off.
- As a user who needs less motion, or whose chart is paused, I want no rising at all.

**Acceptance criteria** (the contract, each one independently checkable):

*Rise*
- **AC-1** (`enterStyle`): `enterStyle` is a new option, `"rise"` (default) or `"grow"`. Any other value warns once (not once per `updateConfig` call) and resolves to `"rise"`. With `"grow"`, new bubbles behave exactly as spec 0002 says today (radius tween from 0, no offset, no scroll gate). With `"rise"`, a new bubble's radius is its target radius from the first frame (no growing) and it is drawn lower than its resting place by the rise offset (AC-2). Changing `enterStyle` with `updateConfig` affects only bubbles that enter later.
- **AC-2** (rise motion): A rising bubble keeps its real place (physics, `getData()` positions) and is only drawn lower. Its drawn center is `y + float wobble + drop * (1 - e)`, where `e = 1 - (1 - t)^3`, `t = (now - startedAt - delay) / duration` clamped to 0..1, `duration = 2 * transitionDuration` (800 ms by default), and `drop = canvasHeight - y + radius + floatAmplitude` (so at `t = 0` the bubble is fully below the bottom edge, even at the top of its float wobble). `x` and the radius do not change. Until `t > 0` the bubble is parked below the edge and draws nothing visible. When `t = 1` the offset is exactly 0. `riseOf(orb, now)` gets `now` from the same loop clock as the rest of the frame (the renderer's `FrameTime.now`; input and tooltip code pass `loop.now()`). `RiseTracker.step(now)` runs inside `OrbChart.sync` and forgets every rise that has reached `t = 1`; the renderer only reads offsets and never changes core state. A batch of two or more new bubbles gets a delay each, random in `0 .. 1.5 * transitionDuration` (600 ms by default); one new bubble gets no delay. Time comes from the animation loop clock, never `Date.now()` or timers.
- **AC-3** (scroll gate): The chart observes its container with an `IntersectionObserver` (`rootMargin: "0px 0px -10% 0px"`, threshold 0). Until the container first intersects, every new bubble is parked below the bottom edge and its rise has not started. At the first intersection the gate opens for good: every parked bubble starts its rise from that moment as one batch (AC-2 stagger rules), and later `setData` calls rise at once. The gate never closes, so scrolling away and back never replays the rise. Where `IntersectionObserver` does not exist (server render, old browsers, jsdom without a fake) the gate is open from the start; in that case the gate only sets its open flag and never calls `onOpen` from inside the `ChartView` constructor, because the chart's other parts do not exist yet. `enterStyle: "grow"` and `transitionDuration: 0` ignore the gate. When the chart becomes paused or still while bubbles are parked, the gate opens for good and every parked bubble is placed at its resting place at once (AC-6), so a later `setData` after `start()` never parks again. The observer is created in the chart's mount and registered on the teardown list the moment it exists.
- **AC-4** (added bubbles): After the gate is open, each `setData` call starts a rise for every id that is new (batch rules of AC-2). A new bubble's resting place is the least overlapping of 8 random candidate places (overlap is the summed intersection depth with live bubbles, using the target radius), so physics has little to push apart while the newcomer is still unseen; with an unsized container it takes the pending path of spec 0002. Bubbles that already exist keep their spec 0002 retarget tween and do not rise. A bubble that leaves keeps its spec 0002 shrink out; if it is still rising or parked, the rise keeps running while it shrinks, so an unseen bubble never appears out of nowhere. When a rise or a leaving bubble's shrink ends, the rise record is forgotten.
- **AC-5** (one drawn position): Drawing, hit testing, hover, the tooltip, the focus ring, and a pop snapshot all use the same drawn center from `centerOf` (position, float wobble, and rise offset). `CanvasInput` gets a `centerOf(orb)` hook through `ChartView` (as `FocusCue` has), so its hit test moves from `orb.x/orb.y` to the drawn center; this also adds the float wobble (2 px by default) to hit tests, an accepted small change. A parked bubble is below the canvas, so pointer input cannot reach it, while it is still in `getData()` and the hidden list. A tooltip or focus cue for a parked bubble (keyboard focus) is clamped inside the container, as the tooltip already clamps at 0. `pop(id)` on a parked bubble works and its burst and any ghost are simply off the canvas and not visible (accepted).
- **AC-6** (idle, still, reduced): While the chart is paused or still (spec 0004 `Playback.idle`), or `transitionDuration` is 0, nothing rises: new and restored bubbles appear at their resting place in the one explicit draw those paths already make, and no frame is queued. `pause()` and entering still mode finish every rise in flight (offset 0), `pause()` drawing once only if a rise changed, and still mode finishing inside the `setStill` host callback before the settle draw (the spec 0005 AC-11 rule for bursts, extended). Neither runs after `destroy()`. `start()` after a pause never replays a rise. Parked bubbles are placed at their resting place by the same finish, and the gate opens for good (AC-3). A restore on an idle chart draws once through `Redrawer.run`: a still chart settles after the restore (`run(true)`, so the bubble does not sit on neighbors that settled meanwhile), and a paused chart does not settle (`run(false)`), matching spec 0005's pause rule.

*Restore*
- **AC-7** (`restore` API): `chart.restore(id?: string): boolean`. With an `id` it returns `true` only when `id` is in the popped list (AC-9) and is not live; otherwise it returns `false` and does nothing, as it does after `destroy()`. A successful restore, in this order and in the same call: removes any ghost for that id (so both `popStyle` values behave alike); builds the orb from its record, at the old resting place clamped into the current canvas (`x` into `[r, width - r]`, `y` into `[r, height - r]`, with `r` the AC-8 target radius; with an unsized container the orb takes the pending path of spec 0002 and is placed when the container gets a size), at list index `min(record index, number of live bubbles)` where the index counts in the `getData()` list (not in the internal list, which also holds shrinking bubbles at its tail), with a fresh float seed and the small random start velocity new bubbles get; syncs input, then the hidden list; starts its rise (AC-2, no delay for one bubble; with the chart idle, AC-6); announces (AC-11); calls `onOrbRestore(orb)` once. With no `id` it restores every popped bubble as one batch (stagger rules of AC-2), inserting them in reverse pop order (last popped first), so that records that shared an index end up in their original list order, and returns `true` when at least one was restored. A restored bubble is a normal live bubble: it can be popped again and gets a new record.
- **AC-8** (restored radius): A restored bubble's target radius is the spec 0005 AC-3 formula over the live bubbles plus all popped records (including itself), using each one's `value`. So restoring everything gives the radii a `setData` of the same data would give, and no other bubble changes size. To keep this true when `minRadius` or `maxRadius` changes while bubbles are popped, `retargetAll` also counts the popped records' values in `largest` (the live bubbles are still the only ones that get a new target). This amends spec 0005 AC-3, which said a retarget uses the live bubbles only.
- **AC-9** (popped list lifecycle): Every successful pop, from `pop(id)` or from a user activation, adds one record: `id`, `label`, `value`, `color`, `imageUrl`, `metadata`, resting `x` and `y` (the orb's place, not its drawn center), its list index at pop time, a `byUser` flag (true when it came from a user activation), and pop order. A record is removed when its bubble is restored. `setData` clears every record (the data is the truth, as it does with ghosts in spec 0005 AC-12), and so does `destroy()`. `popStyle` has no effect on records. A record is kept for as long as the chart lives and no `setData` runs, there is no time limit.
- **AC-10** (`restoreOnNextPop`): `restoreOnNextPop` is a new option, default `true`; a value that is not a boolean warns once and resolves to `true`. When a user activation (click, tap, Enter, or Space) reaches the activate path of spec 0005 AC-9 with `popOnClick` `true` and `restoreOnNextPop` `true`, it runs in this order: `onOrbClick(orb, event)`, then restore every record with `byUser` true (one batch), then pop the clicked bubble. Records with `byUser` false (popped by `pop(id)` from code) are never restored by this rule, and `pop(id)` from code never triggers it. With `restoreOnNextPop` `false`, or `popOnClick` `false`, nothing is restored automatically. The drawer case needs no option: the app calls `restore()` itself (AC-7).
- **AC-11** (callback and accessibility): `onOrbRestore` is a new option, default a no op; it is called once per restored bubble with the new live orb, and an error it throws is caught and logged, as `onOrbPop` is. The live region of spec 0005 AC-13 receives one message per call, composed by `PopController`, because the announcer replaces its text and a second message in the same task would erase the first: a single restore reads `"<label> restored"` (the id when the label is empty), a batch of two or more reads `"<N> bubbles restored"`, and a user activation that restores and then pops reads `"<restored part>, <label> popped"` (for example `"A restored, B popped"`). The text is set with `textContent`, with the same trailing no break space rule for repeated text. The pop and restore steps of that activation do not announce on their own. The restored bubble's hidden button is inserted at its list index; focus does not move. New bubbles that rise (AC-4) are not announced, because the hidden list already lists them.
- **AC-12** (pop and restore together): A pop while a bubble is rising uses the drawn center (AC-5) for the burst and stores the resting place in the record. A restore while that pop's burst (up to about 780 ms) is still playing is allowed: the burst finishes on its own, and the ghost, if any, is removed. A restore for an id that is already live returns `false`, so an id is never in the chart twice.

*Integration and guards*
- **AC-13** (React): `enterStyle` and `restoreOnNextPop` are plain config props compared by value. `onOrbRestore` goes through the same latest callback wrapper as `onOrbClick`, so a new function identity causes no update. `OrbChartHandle` gains `restore(id?: string): boolean`, returning `false` when the chart is not mounted. Server render, hydrate, and strict mode results of specs 0003 and 0004 are unchanged, and a strict mode mount, unmount, mount leaves one live observer.
- **AC-14** (public surface and docs): `OrbChartConfig` gains `enterStyle`, `restoreOnNextPop`, and `onOrbRestore`, each with TSDoc and its default. `OrbChart` gains `restore(id?)`. No new exported name, so spec 0001 AC-3 is unchanged. The TypeScript fixtures compile all three options and `restore` from both entries. The README options table, Known limitations, and `docs/integration-guide.md` are updated; the integration guide gets a drawer recipe (open in `onOrbClick`, call `restore()` when the drawer closes), and its note that a data change clears ghosts also says it clears popped records. The React recipe passes stable `data` (from `useMemo` or state), because a new array identity on a parent re render calls `setData`, which clears the popped records and brings popped ids back as new bubbles.
- **AC-15** (teardown): `destroy()` disconnects the observer, drops every rise and every popped record, and is safe to call twice. After it the fake DOM reports zero live observers, listeners, frames, and timers, and the container holds nothing the chart added. A gate callback that fires after `destroy()` does nothing.
- **AC-16** (structure and budgets): Each new class stays under about 200 lines. `OrbChart.ts` ends at 285 lines or fewer: slice A first moves the pop host wiring into a small `ChartPopHost` class in `core/`, then adds the rise, gate, and restore wiring. `CanvasRenderer.ts` stays under 200 lines. Core, React, and CDN budgets stay at 13, 14, and 13 kB gzip, and if a measured size exceeds its budget, `.size-limit.json` and spec 0001 move to 14, 15, and 14 kB on purpose, with the measured numbers recorded in spec 0001 *Revision*; `npm run size` passes either way. As built, all three budgets moved to 15 kB (core 14.32, react 14.91, cdn 14.38), see spec 0001 *Revision (2026-10-21, spec 0006 measured)*. The review fixes then raised the React budget alone to 16 kB (core 14.44, react 15.03, cdn 14.50), see *Revision (2026-10-21, spec 0006 review fixes)*.
- **AC-17** (feel, checked by hand): In a real browser, with a chart below the fold, scrolling it into view shows bubbles rising from the bottom edge in a loose stagger, once. Adding bubbles with `setData` makes only the new ones rise. With `popOnClick`, clicking one bubble, then another, brings the first back by rising to its old place. Closing a drawer that calls `restore()` does the same, for both `popStyle` values. With 50 bubbles with images, the rise stays smooth (about 60 fps in the Chrome performance panel). If it is not smooth, the measured number goes to feature 7.

## Decision

**Chosen option**: Option 1: a visual rise offset on a bubble that keeps its real place, with a gate on first visibility, and a popped list that `restore` reads

A new `RiseTracker` holds, per bubble id, a start time, a delay, and a duration, and gives the renderer an offset that draws a bubble lower. Physics, collisions, and `getData()` keep using the resting place, and `centerOf` adds the offset, so drawing, hit tests, tooltip, focus ring, and bursts agree. An `EntranceGate` waits for the first time the container is visible. A `PopLedger` remembers what each popped bubble was, so `PopController.restore` can build it again at its old place and start its rise.

**Implementation skills**: none relevant installed. Conventions come from `AGENTS.md`.

## Rationale

Reasoning and options: see [rationale.md](./rationale.md).

## Feature design

**Data model sketch**: none. No persistence. New in memory state only: rise records (id, start time, delay, duration) in `RiseTracker`, the popped records in `PopLedger`, and the gate's open flag.

**State transitions** (per bubble id, extending spec 0005):

| State | Drawn as | In `getData()`, hidden list, physics | Hit test | Next |
|---|---|---|---|---|
| `parked` (waiting for the gate, or in its delay) | below the canvas | yes | no (off canvas) | `rising` when the gate opens and the delay ends |
| `rising` | lower than its place, sliding up | yes | at the drawn center | `live` at `t = 1` |
| `live` | at its place | yes | yes | `popping` or `popped` (spec 0005) |
| `popped` | burst, then nothing or a ghost | no | no | `parked` or `rising` on `restore`; gone on `setData` |

Pause or still jumps every `parked` or `rising` bubble to `live` (AC-6). A restore moves `popped` to `rising` (no delay for one bubble) with the old place as its resting place.

**Class changes** (each does one job; dependencies through constructors; tests inject fakes):

| Class | Folder | Job |
|---|---|---|
| `RiseTracker` | `core/` | New. `start(orbs, now, spread)` (spread 0 for a single bubble; delays from an injected `random`), `park(ids)` and `release(now, spread)` for the gate, `offsetOf(orb, now, height)` (read only), `step(now)` (forgets finished rises, called from `OrbChart.sync`), `finishAll()` (returns true if any changed), `forget(id)`, `clear()`. Time is passed in. |
| `PopLedger` | `core/` | New. `remember(record)`, `take(id)`, `all()` in pop order, `byUser()`, `clear()`. |
| `EntranceGate` | `renderer/` | New. Wraps the `IntersectionObserver`; calls `onOpen` once; `open` getter; `dispose()` disconnects. Built by `ChartView` with the other parts and removed with them if one fails to build. Opens at once when the observer does not exist. |
| `PopController` | `core/` | Remembers a record on every pop; gains `restore(id?)` and the activate order of AC-10. Host gains `rebuild(record)`, `clearGhost(id)`, and the ledger. |
| `OrbReconciler` | `core/` | `create` can start an orb at its target radius when `enterStyle` is `"rise"`; gains the `restoreOrb` building step and the AC-8 radius over live plus popped. |
| `CanvasRenderer` | `renderer/` | `centerOf` adds the offset from a `riseOf(orb, now)` collaborator passed like `phaseOf`. |
| `CanvasInput`, `TooltipView`, `FocusCue` | `renderer/` | Use the same `centerOf`. `CanvasInput` gains a `centerOf(orb)` hook (its hit test reads `orb.x/orb.y` today); `TooltipView` clamps a tooltip for a parked bubble inside the container. |
| `ChartPopHost` | `core/` | New. The `PopHost` wiring now inline in `OrbChart.mount` (live, snapshot, remove, burst, announce, push, rebuild, clearGhost, ledger, config), moved out so `OrbChart.ts` stays within 285 lines. `PopController` gets an internal `pop(id, byUser)`; the public `OrbChart.pop(id)` stays code only (`byUser` false). The host config `Pick` adds `restoreOnNextPop` and `onOrbRestore`. |
| `BurstEffects` | `renderer/` | Gains `removeGhost(id)`. |
| `ConfigResolver` | `core/` | Defaults and checks for `enterStyle` and `restoreOnNextPop`. |
| `OrbChart` | `core/` | Builds the tracker, ledger, and gate; parks or starts rises in `setData`; `restore(id?)`; finishes rises on `pause()` and in the still callback; clears the ledger in `setData`. At most 285 lines. |
| React `OrbChart` | `react/` | `onOrbRestore` through `useLatest`; `restore` on the handle. |

**Public API (additions)**:

| Name | Kind | Shape | Default |
|---|---|---|---|
| `enterStyle` | option | `"rise" \| "grow"` | `"rise"` |
| `restoreOnNextPop` | option | `boolean` | `true` |
| `onOrbRestore` | option | `(orb: Orb) => void` | none |
| `restore` | `OrbChart` method and `OrbChartHandle` method | `(id?: string) => boolean` | |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Draw a rising bubble | vertical offset | `RiseTracker.offsetOf`: `now` from the animation loop clock, `startedAt` and `delay` from the record, `duration = 2 * transitionDuration` from config, `drop` from the orb's `y` and `radius` and the canvas height in config |
| Delay of each bubble | start delay | an injected `random` (default `Math.random`) in `0 .. 1.5 * transitionDuration`, only for batches of two or more |
| Start of a parked bubble | `startedAt` | the loop clock when the gate opens (`EntranceGate` callback), or `now` in `setData` when the gate is already open |
| Open the gate | open flag | the first `IntersectionObserver` entry with `isIntersecting` true; open from the start when the observer is missing, `transitionDuration` is 0, or `enterStyle` is `"grow"`; opened for good when the chart becomes paused or still |
| New bubble place | `x`, `y` | the least overlapping of 8 random candidates (injected `random`), AC-4 |
| Restore place | `x`, `y` | the popped record's resting `x` and `y`, clamped into the current canvas with the AC-8 radius; pending path when the container has no size |
| Restore list position | index | the record's list index at pop time, capped at the live count |
| Restore radius | target radius | AC-8: `value` of live orbs plus popped records, `maxRadius`, `minRadius` from config |
| Restore appearance | label, color, image, metadata | the popped record (copied at pop time) |
| Restore which ones | the ids | `restore(id)` argument; no argument means the whole ledger; the `restoreOnNextPop` rule means records with `byUser` true |
| Where a pop came from | `byUser` | the activate path sets true; `pop(id)` from code sets false |
| Announce | live region text | `orb.label`, else `orb.id`, plus `" restored"`; `"<N> bubbles restored"` for a batch; `"<restored part>, <label> popped"` for a restore then pop; one message per call (AC-11) |
| Drawn position for input | `centerOf` | position, float wobble from the loop clock, and `riseOf(orb, now)`; the same function for draw, hit test, tooltip, focus cue, and snapshots (AC-5) |
| Whether the rise runs | on or off | `Playback.idle`, `transitionDuration`, `enterStyle` from config |
| Rise vertical clearance | `drop` | orb `y`, `radius`, canvas height, and `floatAmplitude` from config |
| Ghost removal | which ghost | the restored id |

**Key invariants**:
- A rising or parked bubble is always in `getData()` and the hidden list, and always has its resting place for physics.
- A bubble is drawn, hit tested, and announced at one place: `centerOf` including the offset.
- An id is in the live list or in the popped list, never both, and never twice in either.
- Pause means pause: no rise or restore ever queues a frame while idle; each is one explicit draw.
- Time comes from the animation loop clock; no timers.
- The canvas is still `aria-hidden`; the hidden list and the live region are the only assistive output.

**Security model**: no new trust boundary. Labels are announced with `textContent`. `restore` only rebuilds what the chart popped itself.

**Configuration required**: none. No env vars.

**Critical test scenarios** (jsdom with the fakes in `app/test-support/fakeDom.ts`; the fake DOM gains a controllable `IntersectionObserver` with live counts, and tests pass a fixed `random`):
- `enterStyle` default, invalid value warns once, `"grow"` keeps the 0002 radius tween, `"rise"` starts at target radius, verifies **AC-1**.
- Offsets at `t` of 0, 0.5, and 1 with the clock faked; ends at exactly 0; one bubble no delay, three bubbles delayed within 600 ms, verifies **AC-2**.
- Data set before the gate opens: parked and off canvas, then released as one batch on open; scrolling away and back does not replay; no observer means open; destroy before open disconnects, verifies **AC-3**, **AC-15**.
- Second `setData` with one new id: only that id rises; a removed bubble still rising keeps its rise while it shrinks, verifies **AC-4**.
- Hit test, hover, tooltip, and a pop use the drawn center during a rise; a parked bubble cannot be reached by pointer but pops by id, verifies **AC-5**.
- Paused, still, and `transitionDuration` 0: new bubbles appear in place with one draw and no frame; `pause()` and entering still mid rise finish them; `start()` does not replay, verifies **AC-6**.
- `restore(id)` for a popped, unknown, live, and destroyed case; the order of ghost removal, rebuild, list, rise, announce, callback; clamped place after a resize; list index, verifies **AC-7**, **AC-11**.
- Radii after `restore()` equal the radii of one `setData` of the same data, with `minRadius` and `maxRadius` changed while popped, verifies **AC-8**.
- Records from code pops and user pops; `setData` and `destroy` clear them; both `popStyle` values, verifies **AC-9**.
- With `popOnClick`, clicking A then B: A is restored then B pops, in that order; `restoreOnNextPop` false leaves A popped; a code popped C is not restored; Enter and Space and tap behave alike, verifies **AC-10**.
- Pop mid rise, restore mid burst, restore twice, verifies **AC-12**.
- React: `onOrbRestore` latest callback, `ref.restore`, new props by value, server and strict mode with one live observer, verifies **AC-13**.
- Type fixtures and export keys, verifies **AC-14**; `destroy()` twice with rises and records active, verifies **AC-15**; `npm run size` and line counts, verifies **AC-16**.

## Build plan

Order follows Tracer Bullet: each slice goes through core, React, types, tests, and docs, so the package stays shippable after every slice.

1. Slice A, the rise: first move the pop host wiring out of `OrbChart.mount` into `ChartPopHost` (no behavior change, tests stay green), then `RiseTracker`, the least overlap spawn choice, the `CanvasInput` `centerOf` hook, the `enterStyle` option and its check, `OrbReconciler` creating orbs at target radius for `"rise"`, `centerOf` taking the offset through `riseOf` (and `CanvasInput`, `TooltipView`, `FocusCue` using it), stagger from an injected `random`, the idle, still, and `transitionDuration` 0 rules with finish on `pause()` and in the still callback, exiting bubbles keeping their rise. The gate is not there yet, so the rise plays at once. React prop and fixture for `enterStyle`. Satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**, **AC-13**, **AC-14**.
2. Slice B, the scroll gate: `EntranceGate` and the fake `IntersectionObserver` in `fakeDom.ts`; `ChartView` builds and disposes it; `OrbChart` parks new bubbles until it opens, then releases them as one batch; open when the observer is missing, the chart is idle, or `enterStyle` is `"grow"`. Satisfies **AC-3**, **AC-15**.
3. Slice C, restore: `PopLedger`; `PopController` remembers records and gains `restore(id?)`; `OrbReconciler` rebuilds an orb with the AC-8 radius; `BurstEffects.removeGhost`; the live region text and the list insert; `onOrbRestore`; `OrbChart.restore`; ledger cleared in `setData` and `destroy`. React handle `restore` and `onOrbRestore` through `useLatest`; fixtures. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-11**, **AC-12**, **AC-13**, **AC-14**, **AC-15**.
4. Slice D, restore on next pop: the `restoreOnNextPop` option and its check, the activate order of AC-10, the `byUser` flag. React prop and fixture. Satisfies **AC-10**, **AC-13**, **AC-14**.
5. Guards and docs: README options table and Known limitations; the integration guide drawer recipe and the ledger note; `npm run size` and, if over, the raise to 14, 15, and 14 kB with the 0001 *Revision*; `check:package`; smoke on React 18 and 19; line counts; `verify.md` with the by hand scroll and drawer checks and the 50 bubble check. Satisfies **AC-14**, **AC-16**, **AC-17**.

## Consequences

**Positive**:
- Charts below the fold get a visible entrance, and updates read as "new bubbles arrived".
- A pop is no longer a one way trip: a details drawer can open and close without leaving a hole in the chart.
- The rise is cosmetic, so physics, hit testing, and the hidden list keep working on one set of positions, and tests stay exact with a fake clock and a fixed `random`.
- Existing apps keep a way back: `enterStyle: "grow"` and `restoreOnNextPop: false`.

**Negative / tradeoffs**:
- The default for new bubbles changes from grow to rise, and the default for `popOnClick` now brings the last popped bubble back on the next click. Both are visible behavior changes, accepted because the package is not 1.0 yet.
- Bubbles collide at their resting place while they are still drawn lower, so neighbors can be nudged by a bubble the user cannot see yet. New bubbles avoid this by picking the least overlapping of 8 places. A restored bubble returns to its old place, so if neighbors drifted into the hole they are nudged apart (accepted).
- Another 0.7 to 1.1 kB gzip is expected, on a core that has about 0.7 kB of room, so the budget may be raised once more.
- The chart keeps its popped records until the next `setData`, so a long popping session holds a little memory (one small record per popped bubble).
- Rising is not real physics, so bubbles can overlap a little in flight. That matches the reference but is a visual shortcut.

**Neutral**:
- Spec 0005 AC-12 says a popped id in later data "grows in like any new orb". With this spec it follows `enterStyle`, so it rises by default.
- The chart is not paused while it is off screen. That belongs to feature 7 (performance and idle behavior).

## Follow-up

- [x] Spec 0005 AC-3 (retarget counts popped values) and AC-12 ("grows in" now follows `enterStyle`) were amended with a pointer to this spec when this spec was written.
- [ ] Feature 7: pause the frame loop while the chart is off screen. The gate's observer could be reused for it.
- [ ] `AGENTS.md` still lists the size budgets as 9, 10, and 9 kB while `.size-limit.json` says 13, 14, and 13; `/sync` should reconcile it.
- [ ] Consider a stagger order by position (bottom bubbles first) if the random order looks messy in the hand check.
- [ ] Consider `enterStyle` values for other entrances (for example `"fade"`) only if developers ask; none is planned for 1.0.
- [ ] Feature 7 may extract more wiring out of `OrbChart.ts` (it ends near 285 lines even after `ChartPopHost`).
