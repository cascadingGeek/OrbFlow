# 0006. Bubble up and restore: rationale

## Context

Bubbles in OrbFlow appear by growing from radius 0 at a random place. That is fine for a chart that is on screen at mount, but a chart further down a page has finished its entrance before anyone scrolls to it, and a data update looks like a quiet resize. The reference the engineer pointed to, cryptobubbles.net, has bubbles that come up from the bottom edge in a loose stagger, which makes the chart feel alive the moment it is seen.

Spec 0005 made a pop a one way trip. A popped bubble is gone from `getData()`, the hidden list, and physics, and only a later `setData` brings its id back. The engineer's use case is a details drawer: the user clicks a bubble, it pops, the drawer opens, and when the drawer closes (or another bubble is picked) the chart should be whole again. The library has no drawer. The drawer belongs to the app, so the chart needs two things: something the app can call, and a sensible default for the "pick another bubble" case.

Forces: a zero dependency core with about 0.7 kB of budget room (basis: spec 0001 revision and spec 0005 measured sizes), classes under about 200 lines with `OrbChart.ts` already at 259, "pause means pause" and still mode (basis: specs 0003 and 0004), the hidden list as the one accessible surface (basis: spec 0004), time only from the animation loop clock (basis: `AGENTS.md` rules), and a 1.0 release close enough that default changes are cheap now and expensive later (basis: semantic versioning, spec 0001).

## Options considered

### Option 1: Visual rise offset, first visibility gate, popped list and `restore`

Each new bubble keeps its real resting place and is only drawn lower, sliding up with an ease out over twice the transition duration. A gate waits for the container to be seen once. A ledger remembers every popped bubble so `restore(id?)` can rebuild it at its old place, and `restoreOnNextPop` calls it for user pops.

**Pros**:
- One set of positions for physics, hit tests, the list, and bursts; the offset is added in one function (`centerOf`).
- Exact tests with a fake clock and a fixed `random`; no change to the physics engine.
- Small: two new core classes and one small renderer class.

**Cons**:
- Bubbles can overlap in flight, and neighbors can be nudged by a bubble that is still below the canvas.
- The chart holds popped records until the next `setData`.

### Option 2: Real physics from below the canvas

New and restored bubbles spawn under the bottom edge with an upward velocity, walls are open for them until they are inside, and they collide on the way in.

**Pros**:
- Closest to a real bubble field; neighbors react as the bubbles arrive.

**Cons**:
- Timing depends on the simulation, so tests and the "rise back to its old place" promise are hard to make exact.
- Needs boundary and collision changes in `PhysicsEngine`, and a still or paused chart has no equivalent, so a second code path is needed anyway.
- Likely to cost more bundle size than the room left.

### Option 3: Fade and grow only

Keep today's grow in and add a fade, with no travel.

**Pros**:
- Almost no code and no gate.

**Cons**:
- It does not give the rising motion the engineer asked for, and a fade is no more visible below the fold than a grow.

### Restore API alternatives (second decision, same spec)

**`restore(id?)` method**: one method and one callback, the app calls it when the drawer closes. Chosen. It fits the existing `pop(id)` and works the same in vanilla and React.

**Controlled prop of popped ids**: the app owns the list. It is natural in React but turns `pop` and `onOrbPop` into two ways to say the same thing, and it does not exist in vanilla JS.

**Auto restore after a delay**: no link to the drawer, and a bubble would come back while the user is still reading its details.

## Rationale

Option 1 fits the forces. The rise only changes where a bubble is drawn, so everything the spec 0004 accessibility work and the spec 0005 burst depend on (one position per bubble, one hidden list, one clock) stays true. Option 2 would give a livelier result, but it puts the unpredictability in physics, where the project has chosen exact, fake clock tests, and it needs a separate path for still and paused charts. Option 3 does not do what was asked.

The gate is a once only, first visibility check, not a replay on each scroll. A bubble field that resets every time it re enters the view would move bubbles under a user who is trying to read or click them. The gate is also skipped when nothing can animate (paused, still, no `IntersectionObserver`, `transitionDuration` 0), so those cases never wait for an event that does not matter. The duration comes from `transitionDuration` (twice its value, with a stagger of up to 1.5 times it) so developers who turn animation off with `0` get that, without a new timing option to keep after 1.0.

For restore, the library cannot know about a drawer, so a method the app calls is the smallest honest answer. `restoreOnNextPop` covers the other case the engineer described, and it defaults to on because that is the behavior asked for and the package is not yet 1.0. It restores only bubbles the user popped, never bubbles the app popped from code, so a deliberate `pop(id)` is never undone by a later click. Making the rule a boolean option, not a fixed behavior, keeps "pop many" charts possible. The ledger is cleared by `setData` because the data is the truth, the same rule spec 0005 uses for ghosts, so `restore` can never bring back an id the app has already dropped.

The engineer chose each of these (spec home, once on first visibility, the visual rise with stagger, the `restore(id?)` method, `restoreOnNextPop` default on and user activation only, an `enterStyle` option, forgetting on `setData`, restore to the old place, timing from `transitionDuration`, interactive while rising, and a conditional budget raise). Nothing here overrides a stated preference.
