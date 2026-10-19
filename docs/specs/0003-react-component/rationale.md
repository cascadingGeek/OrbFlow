# 0003. Production ready React component: rationale

Build spec: [index.md](./index.md)

## Context

**Workspace**: single repo, `app/react/` over the shared core. Platform: web, React 18 and 19 as an optional peer. Mode: enhancement of the existing wrapper (scope row 5). Rigor: Beta.

The current `<OrbChart>` in `app/react/OrbChart.tsx` has four problems:
- It copies `onOrbClick` and `onOrbHover` into the core once, at mount, so later props are ignored (stale closures).
- Its config effect depends on the `config` object, which is a new object on every render because it is built by rest spread, so `updateConfig` runs every render.
- It offers no way to pause, resume, or read data.
- Nothing proves it is safe for server rendering or strict mode, and a failed mount has no stated behavior.

Spec 0002 already made the core safe: `destroy()` is complete and idempotent, `setData` matches orbs by `id`, and `updateConfig` ignores `undefined`. That is what lets the wrapper stay thin. One core rule gets in the way. 0002 AC-9 says `setData` on a paused chart resumes it. With a ref that can pause, a live data feed would silently wake a chart the developer paused. 0002 itself flagged this rule for revisiting.

Not deciding leaves the first impression of the React package (the main adoption path for v1) as a component that ignores new callbacks and wastes work on every render.

## Options considered

### Option 1: Keep the wrapper thin, fix the hooks, add a small ref handle

Keep `<OrbChart>` as a thin shell over the core. Use stable callback wrappers, a shallow config diff, a data reference check, a `forwardRef` handle with three methods, and one small core fix for paused `setData`.

**Pros**:
- Small API growth (one type), easy to keep stable for 1.0.
- Reuses the core fixes from 0002 and keeps the React entry small.
- Each piece is testable with the existing fake DOM.

**Cons**:
- Needs a core change, which touches a decided rule in 0002.
- Removed props do not reset, which developers must learn.

### Option 2: Rich component with `paused` prop, `updateConfig` and `destroy` on the ref, attribute passthrough

Give the component a declarative `paused` prop, a bigger handle, and spread standard div attributes.

**Pros**:
- Feels very natural to React developers.
- Fewer follow up releases for common asks.

**Cons**:
- A prop and a ref method that both control pause need rules for who wins.
- `destroy()` on the ref fights React's own cleanup, and `updateConfig` on the ref fights the props.
- Spreading div attributes now pre empts the accessibility design in row 6 and widens the 1.0 promise.

### Option 3: Expose the raw core instance through the ref

Return the core `OrbChart` object from the ref and leave the rest as is.

**Pros**:
- Almost no new code or types.

**Cons**:
- Exposes every public method of the class and ties the React API to it forever.
- Does nothing for stale callbacks or per render config work.

## Rationale

Option 1 fits the forces. The v1 goal is adoption and a stable API, so the smaller promise wins. The core is already safe and id based, so the wrapper only has to forward the right things at the right time. Option 2 solves problems nobody has reported yet and creates two ways to control the same thing before 1.0; each can be added later in a minor release without a break, but not removed. Option 3 saves code now and costs the API later.

The pause fix belongs in the core rather than the wrapper because the bug is in the core: any vanilla user who pauses and then feeds live data hits it. Fixing it in the wrapper would leave the vanilla bug and flash a frame. It reads a separate user paused flag (set only by `pause()`) instead of `loop.playing`, because a chart that was never started must still start on `setData`, which is how the vanilla README flow works today.

Runner ups for the smaller calls: updating the latest callback ref in an effect declared first (simple and server safe) over `useInsertionEffect` (removes a tiny stale window but is an unusual hook for this); comparing config per key with item by item arrays (only `colorScheme` is an array) over a deep compare (costly and wrong for future object options); letting a mount error reach an error boundary over catching it (failures stay visible).

## Edge cases recorded

- Strict mode: mount, cleanup, mount builds two charts one after the other. The first is fully destroyed, which 0002's teardown guarantees.
- Callback removed: the stable wrapper finds `undefined` and does nothing, so no throw.
- Prop removed: `updateConfig` ignores `undefined`, so the chart keeps its last value. Kept and documented rather than adding a reset path now.
- Unmounted handle: methods read the chart ref when called, so they are safe after unmount.
- Pause lost on remount: a recreated chart starts running. Accepted and listed in Consequences.
- Hidden tab: unchanged here. Row 7 owns idle behavior.
