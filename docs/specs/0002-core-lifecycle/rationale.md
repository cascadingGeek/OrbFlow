# 0002. Production ready core lifecycle: rationale

## Context

OrbFlow v1 is about adoption and credibility: a developer should install it, wire it into an app, and trust it in production. The vanilla core works on screen but fails that test in four ways found in the code.

- `destroy()` cancels the animation frame and removes the canvas, but the `ResizeObserver` created in the constructor is never disconnected, and the click and mouse listeners are bound with `.bind(this)` and never removed. Mounting the chart repeatedly, which React strict mode and route changes do, leaks observers.
- `setData` rebuilds every orb at a random position. A live feed that updates a value every few seconds makes the whole chart jump.
- Input is trusted. A `NaN` or non numeric value turns `Math.min` and `Math.max` into `NaN` and every radius with it. A duplicate `id` breaks the collision step, which filters neighbours by `id`.
- Touch gets only the `click` browsers synthesize after a tap. There is no hover, so a touch user cannot read a value, even though the README promises touch support.

A fifth gap sits outside the scope text: nothing stops `setData` or `start` from running after `destroy()`, which a React unmount racing an async fetch will do. Another is that `updateConfig` merges `undefined` values over defaults, which a React wrapper passing optional props will trigger.

Not deciding means shipping 1.0 with a chart that leaks, jumps, and can blank on one bad row.

## Options considered

### Option 1: Fix in place with small collaborators

Keep `OrbChart` as the public facade and add a validator, an id based reconciler, a time based tweener, and a canvas input class behind it. Public changes are limited to two options and one type.

**Pros**:
- Smallest blast radius, public class and constructor signature unchanged.
- Each piece is pure or injectable, so tests use fakes.
- Fits the under 200 line class rule and brings `CanvasRenderer` back under it.

**Cons**:
- More files to hold in your head than the current two.
- The extraction of `CanvasInput` touches working renderer code.

### Option 2: Rewrite the core around a retained scene model

Replace the orb array with a keyed scene graph that owns layout, tweens, and hit testing, with the renderer reading it.

**Pros**:
- Clean model for later features such as accessibility and offscreen idle.

**Cons**:
- A big bang change to code that already works, before 1.0, with no measured need.
- Larger test surface and higher risk of regressions in physics feel.

### Option 3: Minimal patches only

Disconnect the observer, remove listeners, and add a plain key lookup in `setData` with instant size changes and a few `isFinite` checks.

**Pros**:
- Fastest to ship, almost no new code.

**Cons**:
- Misses the scope line that sizes should animate.
- Leaves hover and tooltip on touch unsolved and validation scattered through `setData`.

## Rationale

Option 1 is chosen because the code already has the right seams: physics, rendering, and the facade are separate, and the gaps are missing behavior, not wrong structure. Option 2 pays for flexibility the 1.0 scope does not use, and it risks the physics feel that is the product. Option 3 is cheap but fails the stated done criteria, so it would be redone.

The specific choices, each with the force behind it:

- **Skip bad entries, do not throw.** A thrown error inside a React effect can unmount a whole tree, and live data is the case this slice targets. Runner up: reject the whole update, which is predictable but one bad row freezes the chart.
- **Warn once per call plus `onDataIssue`.** Developers see problems with zero setup and production apps can route them. Runner up: `console.warn` only, which gives apps no hook.
- **Keep `click` for activation, Pointer Events for hover.** `onOrbClick` keeps its `MouseEvent` signature, so nothing breaks, and one path covers mouse, pen, and finger. Touch needs two special cases: ignore touch `pointermove` (it means scrolling) and ignore the `pointerleave` fired after a finger lifts (it would hide the tooltip at once). The 2500 ms tooltip time is fixed, not config, to keep the API small.
- **Time based ease out cubic tween, 400 ms.** Using a clock instead of frame counts looks the same at 60 and 120 Hz and is testable with an injected clock. Runner up: a spring, which has no fixed end time and is harder to assert on.
- **Exiting orbs stay out of `getData()` and hit testing but still draw and collide.** A user never clicks something that is leaving, while overlap still resolves, so the shrink does not pop neighbours.
- **Existing orbs keep their color when `color` is omitted.** Colors would otherwise change when the list reorders, which looks like a bug during a live update. The cost is that dropping an explicit `color` does not revert to the scheme.
- **Rescale all orbs on any change, animated.** Size reflects relative value inside the current data, as today. Runner up: a caller pinned domain, rejected for now to avoid more 1.0 surface.
- **`transitionDuration` as config, 0 disables.** It costs one option and gives the reduced motion feature (row 6) its switch for free.
- **Paused `setData` resumes play.** The engineer chose this over the recommended option, which was to apply the change, draw one still frame, and stay paused. I would have kept a deliberate pause, because a developer who paused usually wants stillness, and the chosen rule means such a caller must call `pause()` again after every `setData`. It is simple to build and explain, and it never shows stale data. Row 7 is the place to revisit it, noted in Follow-up.

Smaller calls made while writing: the validator is its own pure class so its rules can change without touching the facade; the data issue `reason` is a closed union so handlers can switch on it exhaustively; a throwing `onDataIssue` handler is caught so a faulty callback cannot break an update; `updateConfig` skips `undefined` so the React wrapper in row 5 can pass optional props safely.
