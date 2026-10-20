# 0005. Bubble redesign and burst: rationale

## Context

> ⚠️ Premise note: this topic spans three decisions (four fixes, a restyle, and a pop feature). They are kept in one spec at the engineer's request because they share one renderer rewrite, one budget raise, and one release, and splitting them would mean touching `CanvasRenderer` three times. The build plan slices them so each lands on its own.

The orbs read as glass tokens, not bubbles. The fill is most solid in the middle, the highlight floats inside the circle, and images sit on top like stickers. A user test (a friend of the engineer) and the Dribbble reference both point the same way: real bubbles are clear in the middle, bright at the rim, and colored only in a thin film. The design canvas turns that into a concrete recipe (basis: the design canvas boards "Bubble anatomy" and "Before and after").

Four problems sit next to the look. The cursor is a hand over the whole canvas. A click on a bubble also scatters its neighbors. Bubble size is stretched between the smallest and largest value on the radius, so small values look too big and area misstates the data (basis: area perception in bubble charts). Labels can spill past small bubbles. The first three change visible behavior, which is cheap before the 1.0 promise and expensive after it (basis: semantic versioning, spec 0001).

Forces: zero runtime dependencies, a canvas renderer, a core budget with about 0.3 kB of room (basis: spec 0001 revision), classes under about 200 lines with `CanvasRenderer` already at 264, "pause means pause" and still mode (basis: spec 0003, spec 0004), the hidden list as the one accessible surface (basis: spec 0004), and no `Date.now()` (basis: `AGENTS.md` rules).

## Options considered

### Option 1: Layered painter on canvas, burst as a separate effect layer

Draw each bubble with about ten canvas gradients every frame in a new `BubblePainter`. A pop removes the orb from the live list at once and hands a snapshot to `BurstEffects`, which draws the burst and ghost on the loop clock.

**Pros**:
- Smallest code, film can turn, stays within the raised budget.
- Physics, hit test, list, and `getData()` never see a half popped orb.

**Cons**:
- Per frame gradient cost grows with bubble count.
- Canvas approximates the CSS mockup (no real masks or blur).

### Option 2: Painter plus a sprite cache

Same recipe, painted once per size, color, and theme to an offscreen canvas, then copied each frame.

**Pros**:
- Much cheaper per frame for large charts.

**Cons**:
- More code and memory, cache invalidation on every tween step, and the film cannot turn without repainting. Optimizes before a measured problem.

### Option 3: DOM and CSS bubbles

Render bubbles as positioned elements with CSS gradients, masks, and keyframes, as the design canvas does.

**Pros**:
- Matches the mockup exactly, including masks and blur.

**Cons**:
- Moving dozens of DOM nodes per frame, a second rendering path beside the canvas, and a rewrite of hit testing and focus. Far beyond the budget.

### Option 4: Pop as an orb state inside the reconciler

Keep popped orbs in the live list with a `popping` state, and teach physics, hit test, list, and tweener to skip it.

**Pros**:
- One list of everything on screen.

**Cons**:
- Every collaborator gains a state check, and a missed one leaks a half popped orb into `getData()` or the list.

## Rationale

Option 1 fits the forces. It is the only option that keeps the budget near the raised limit and needs no new rendering path, and it keeps the burst out of the orb list, so the invariants of specs 0002 and 0004 (what `getData()` and the hidden list contain) hold without new checks (basis: single responsibility, spec 0004 invariants). Option 2 is the right answer only once a frame rate problem is measured, so it is a follow up for feature 7, not a starting point (basis: measure before you optimise). Option 4 spreads one feature across five classes.

The engineer's choices shape the rest. `popOnClick` defaults to false and `onOrbClick` still fires first, so a click keeps meaning "show details" for existing users. A pop is a visual dismissal and the data stays the truth, so the next `setData` decides. Ghosts are inert markers, which avoids a restore API and a new keyboard path. `theme` exists because `"transparent"` cannot be measured. `fontFamily` exists because the library cannot load fonts. Paused and still pops jump to the end state, honoring "pause means pause".

Recommendations made while writing (runner up in brackets): label fit at 75% of the diameter with a 10 px floor and the value from a 30 px radius [fixed sizes]; measuring once at 100 px and scaling [`measureText` per frame]; particles from index formulas [seeded random]; a popped id that returns grows in at a random spawn like any new orb [reusing the ghost position]; `minRadius` above `maxRadius` clamps the floor to `maxRadius` [a warning], which also closes the open question in spec 0002; particle easing `1 - (1 - p)^4` as the canvas stand in for the mockup's cubic bezier [a bezier solver].

## References

**Project sources** (verifiable, in this repo):
- `AGENTS.md`: rules on small classes, constructor injection, the loop clock, pause means pause, accessibility, and size budgets.
- Spec 0001: public surface (AC-3) and the size budget revisions.
- Spec 0002: reconcile formula and retarget rule (AC-3, AC-11), replaced in part here.
- Spec 0003: React latest callback wrapper and pause rules.
- Spec 0004: activation (AC-4), lost focus (AC-6), still mode (AC-8, AC-9).
- `UPDATE.md`: items A1 to A4, B1 to B7, C3, C4.
- The design canvas (boards "Live demo", "Before and after", "Bubble anatomy", "Burst, frame by frame").

**Practices & standards**:
- Area encoding for bubble charts (size by area, not radius).
- Semantic versioning: visible behavior changes before 1.0.
- Measure before you optimise.
- Single responsibility and composition over inheritance.
- WAI ARIA live regions (`aria-live="polite"`) for status messages.
