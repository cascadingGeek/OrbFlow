# 0005. Bubble redesign and burst

**Date**: 2026-10-20
**Status**: In Progress

## Summary

This spec makes OrbFlow's orbs look and act like real soap bubbles. Each bubble gets a clear center, a bright rim with a soap film shimmer, and a crescent highlight, drawn for light or dark pages. A bubble can also burst into droplets, either from code (`chart.pop(id)`) or on click when you turn on `popOnClick`. Four fixes ship with it: the hand cursor shows only over a bubble, clicking a bubble no longer scatters its neighbors, bubble area now follows the value, and labels always fit inside their bubble. Everything ships before 1.0, with the size budgets raised to 13, 14, and 13 kB.

## Requirements

**User stories**:
- As a developer, I want bubbles that read as real bubbles on my light or dark page, so my chart looks as good as the design reference.
- As a developer, I want bubble size to be honest, so a value twice as big shows a bubble with twice the area.
- As a developer, I want to let users pop bubbles (or pop them from code), and to hear about each pop, so the chart feels playful and I can react to it.
- As a user, I want the hand cursor only where a click does something, and clicking a bubble to never throw it away from my pointer.
- As a keyboard or screen reader user, I want popping to work from the keyboard and to be told when a bubble popped.

**Acceptance criteria** (the contract, each one independently checkable):

*Fixes*
- **AC-1** (cursor): The canvas starts with `cursor: default`. While the pointer is over a live bubble (the same hit test `CanvasInput` uses for hover) it is `pointer`; over empty space, after `pointerleave`, when the hovered bubble is removed or popped, and after `destroy()`, it is `default`. Touch input changes nothing.
- **AC-2** (click without scatter): A pointer click or tap first runs the hit test. On a hit it calls the activate path (AC-9) and never calls `applyMouseRepulsion`. On a miss it calls `applyMouseRepulsion` (unless the chart is still, spec 0004 AC-8) and nothing else. Keyboard activation keeps spec 0004 AC-4 (no repulsion).
- **AC-3** (area scaling): After `setData` and after a `minRadius` or `maxRadius` change, each live bubble's target radius is `max(floor, maxRadius * sqrt(value / largest))`, where `largest` is the largest `value` among the accepted entries of that `setData` (for a retarget, among the live orbs), and `floor` is `min(minRadius, maxRadius)`. When `largest` is 0, every bubble gets `floor`. `minRadius` now defaults to 8 (was 25); `maxRadius` stays 80. A value of 0 gets `floor`. A retarget uses the `value` of the live orbs (entering ones included, exiting ones not), never their current radius. (Amended by spec 0006 AC-8: when `minRadius` or `maxRadius` changes, the popped bubbles' values also count toward `largest`, so a restore keeps every size consistent.) A pop never rescales the remaining bubbles; only a later `setData` or radius change does. A `minRadius` that is negative or not finite falls back to 8 with one `console.warn` per bad value (`maxRadius` is not validated today and stays that way). This replaces the spec 0002 reconcile formula; the tween and retarget rules of spec 0002 AC-3 and AC-11 are unchanged.
- **AC-4** (labels fit): The label font is `bold <size>px <fontFamily>`. Its size is the smaller of `0.4 * radius` and the size at which the label's measured width equals `1.5 * radius` (75% of the diameter). If that size is below 10 px the label and value are not drawn. The value line (`<value>%`, unchanged) is drawn only when the radius is at least 30 px and the bubble has no drawn image, at `600` weight; its size is the smaller of 0.62 times the label size and the size at which its own width equals `1.5 * radius`, and it is hidden when that is below 10 px. With a value line, the pair is centered together: the label center sits at `y - 0.5 * valueSize` and the value center at `y + 0.55 * labelSize`. With a drawn image the label is centered at `y + 0.45 * radius` and its width cap is `1.2 * radius` instead of `1.5 * radius`. No drawn text extends past the bubble's circle. `fontFamily` is a new option, default `"Inter, system-ui, sans-serif"`; a value that is not a non empty string falls back to the default with one `console.warn` per bad value (not per `updateConfig` call).

*Look*
- **AC-5** (theme): `theme` is a new option, `"auto"` (default), `"light"`, or `"dark"`. `"auto"` is light when `backgroundColor` parses to a WCAG relative luminance (linearized sRGB) above 0.5, and dark otherwise. The shared `toRgb` parser accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, and comma separated `rgb()` and `rgba()`; an alpha of 0 counts as transparent (dark), any other alpha is ignored. `"transparent"`, named colors, `hsl()`, and anything unparsable resolve to dark. The default `#0a0e1a` is dark. Any other `theme` value warns once and resolves to `"auto"`. Each frame clears the canvas with `clearRect` before filling `backgroundColor`, so `"transparent"` shows the page behind the chart. Changing `theme`, `backgroundColor`, or `fontFamily` with `updateConfig` redraws an idle chart once (spec 0004 AC-9 rule for look changes).
- **AC-6** (bubble recipe): Every live bubble is drawn with the layers, order, and numbers in *Bubble recipe* below, using its own `color` for the tint, parsed by `toRgb`; a color it cannot parse uses `#3b82f6` (today such colors turn black). In the dark theme labels are white with a soft dark shadow; in the light theme they are `#2b1f47` with a light edge. Where `ctx.createConicGradient` does not exist the film layer is skipped and nothing else changes. The film turns once every 14 s while the chart moves and holds still (start angle 200°) when the chart is paused or still.
- **AC-7** (image lens): A bubble with a loaded image draws it clipped to a circle of `0.88 * radius`, cropped to cover (never squashed), scaled to 106% of that circle, with the vignette, film, glow, and highlights drawn on top. A broken or still loading image draws the bubble without it, as today.

*Burst*
- **AC-8** (pop API): `chart.pop(id: string): boolean` starts a pop and returns `true` only when `id` is a live bubble (present in `getData()`). It returns `false` and does nothing for an unknown id, a bubble already popped, a bubble shrinking out, or after `destroy()`. A bubble mid grow or mid resize can pop: its tween is cancelled and the burst uses its current drawn radius. A started pop, in the same call and in this order: computes the snapshot (center from `centerOf` with the orb's float phase, current radius, color, label, value, and the loaded image element or none); removes the orb (`OrbReconciler.drop`, which forgets its seed, cancels its tween, and drops it from the not yet placed list); syncs input, then the hidden list; adds the burst; announces (AC-13); calls `onOrbPop(orb)` once with the orb as it was; and, while the chart moves, pushes neighbors with `applyMouseRepulsion` at the burst center, reach `radius + 150` px, strength 1 (a click keeps reach 150 and strength 2). A bubble with radius 0 or not yet placed (container of size 0) pops silently: it is removed and `onOrbPop` fires, but no burst, ghost, or push happens.
- **AC-9** (activate and `popOnClick`): `popOnClick` is a new option, default `false`. Pointer click, tap, and Enter or Space on a focused hidden button all go through one activate path: call `onOrbClick(orb, event)`, then, when `popOnClick` is `true`, call `pop(orb.id)`. With `popOnClick` `false` nothing pops and behavior matches spec 0004 AC-4 apart from AC-2's no scatter rule. On a touch tap the activate path runs first, and the touch tooltip is shown only if the orb is still live afterward. After a pop under the pointer the cursor stays `default` until the next `pointermove` (accepted).
- **AC-10** (burst while moving): While the chart moves (not paused, not still), a pop plays the timeline in *Burst timeline* below, centered on where the bubble was drawn at that moment (position plus float offset), and the burst does not move with physics. It ends when its last particle finishes (about 780 ms). Several bursts can run at once.
- **AC-11** (burst while idle): When the chart is paused or still, a pop draws its end state (nothing, or the ghost) in one draw through `Redrawer.run(false)` (no settle, so neighbors never move) and queues no frame. A ghost made while idle is stored as already faded in (start time `now - 600`). `pause()` finishes every burst in flight and, only if any burst or ghost changed, draws once. Entering still mode finishes bursts inside the `setStill` host callback, before the settle draw. Neither runs after `destroy()`. A popped bubble never comes back on `start()`. While moving, the animation loop keeps drawing bursts even when no orbs are left.
- **AC-12** (`popStyle` and ghosts): `popStyle` is a new option, `"remove"` (default) or `"ghost"`; any other value warns once and resolves to `"remove"`. With `"ghost"`, a popped bubble leaves a dashed circle at its pop position and size, fading in from 180 ms to 600 ms after the pop (drawn at once when idle), drawn under live bubbles, with its label at 45% opacity when the label fits (AC-4). Ghosts are not clickable, not in the hidden list, not in physics. Every `setData` clears all ghosts. An id that was popped and appears in a later `setData` comes back as a new bubble (enters like any new orb: spec 0006 makes that a rise from below by default, per `enterStyle`). Changing `popStyle` to `"remove"` clears existing ghosts; changing it to `"ghost"` creates none for past pops. On resize, ghosts and running bursts keep their pixel position and are not clamped; anything outside the new canvas is simply clipped.
- **AC-13** (pop accessibility): A popped bubble's hidden button is removed in the same call; if it held focus, focus moves by spec 0004 AC-6 (next, else previous, else the list). A visually hidden `aria-live="polite"` region, created at mount and appended to the container beside the hidden list (never inside it), receives the text `"<label> popped"` (the id when the label is empty), set with `textContent`. When the new text equals the current text, a trailing no break space (` `) is added so the second pop is still announced. The region is never cleared between pops.

*Integration and guards*
- **AC-14** (React): `popOnClick`, `popStyle`, `theme`, and `fontFamily` are plain config props compared by value. `onOrbPop` goes through the same latest callback wrapper as `onOrbClick`, so a new function identity causes no update. `OrbChartHandle` gains `pop(id): boolean`, returning `false` when the chart is not mounted. Server render, hydrate, and strict mode results of spec 0003 and 0004 AC-12 are unchanged.
- **AC-15** (public surface): `OrbChartConfig` gains `popOnClick`, `popStyle`, `onOrbPop`, `theme`, and `fontFamily`, each with TSDoc and its default; the `minRadius` TSDoc states the floor meaning and the new default 8. `OrbChart` gains `pop(id)`. No new exported name, so spec 0001 AC-3 is unchanged. The TypeScript fixtures compile all five options and `pop` from both entries. README options table, Known limitations, and `UPDATE.md` are updated to match.
- **AC-16** (teardown): `destroy()` drops every burst, every ghost, and the live region. After it the fake DOM reports zero live listeners, observers, frames, and timers, and the container holds nothing the chart added. The burst uses the animation loop clock, never `Date.now()` or timers.
- **AC-17** (budgets and structure): `.size-limit.json` and spec 0001 carry core 13 kB, react 14 kB, cdn 13 kB gzip, and `npm run size` passes (measured after the build: core 12.26, react 12.81, cdn 12.32 kB; the first estimate of 12, 13, and 12 kB was too low, see spec 0001 *Revision*). Each new class stays under about 200 lines. `CanvasRenderer.ts` ends under 200 lines (264 today; image loading moves to `ImageCache`) and `AccessibleLayer.ts` no longer than its 211 lines today (the live region lives in `LiveAnnouncer`). `OrbChart.ts` ends no longer than 260 lines (216 today).
- **AC-18** (feel, checked by hand): In a browser, 50 bubbles with images keep a smooth frame rate (about 60 fps in the Chrome performance panel) on a mid range laptop while moving, and the light and dark bubbles match the design canvas boards "Before and after" and "Bubble anatomy". If 50 is not smooth, the measured number goes to feature 7 and a sprite cache follow up is enrolled; this does not block the feature.

## Decision

**Chosen option**: Option 1: a layered bubble painter on the existing canvas, with the burst as a separate effect layer outside the orb list

`CanvasRenderer` hands each bubble to a new `BubblePainter` that draws the recipe with plain canvas gradients every frame. A pop takes the orb out of the live list at once and gives a snapshot to a new `BurstEffects` layer that draws the burst and any ghost on the loop clock, so physics, hit testing, the hidden list, and `getData()` never see a half popped bubble.

**Implementation skills**: none relevant installed. Conventions come from `AGENTS.md`.

**Design source**: the design canvas https://claude.ai/artifact/RrHvdRwih779DzVQ41s1Fg (boards "Live demo", "Before and after", "Bubble anatomy", "Burst, frame by frame"). The numbers below are the contract; the canvas is the visual reference.

## Rationale

Reasoning and options: see [rationale.md](./rationale.md).

## Feature design

**Data model sketch**: none. No persistence. New in memory state only: active bursts and ghosts (snapshots: id, label, value, color, image, center, radius, start time) in `BurstEffects`, a width cache in `LabelFitter`, and the resolved theme.

**State transitions** (per bubble id):

| State | Shown as | In `getData()`, hidden list, hit test, physics | Next |
|---|---|---|---|
| `live` | bubble | yes | `popping` on pop while moving; `popped` on pop while idle |
| `popping` (about 780 ms) | burst timeline | no | `popped` |
| `popped`, `popStyle: "remove"` | nothing | no | gone |
| `popped`, `popStyle: "ghost"` | dashed ghost | no | cleared by the next `setData`; if that data has the id, it enters as a new orb |

Pause or still while `popping` jumps to `popped` (AC-11). `onOrbPop` fires on entering `popping` or `popped` from `live`, once.

**Bubble recipe** (sizes are fractions of the radius `r`; `c` is the orb color; `k = 0.7`; draw in this order):

| # | Layer | Dark theme | Light theme |
|---|---|---|---|
| 1 | Lift | Halo: radial gradient from `0.97r` to `1.16r`, stops `0` c@0, `0.23` c@`0.32k`, `1` c@0, filled to `1.16r` | Shadow: radial gradient centered `(x, y + 0.3r)` from `0.6r` to `1.25r`, `rgba(72,44,140,0.18)` to 0 |
| 2 | Body | Radial `0` to `r`: `0` c@`0.05k`, `0.52` c@`0.08k`, `0.74` c@`0.2k`, `0.92` c@`0.5k`, `0.986` white@0.7, `1` white@0 | `0` white@0.1, `0.55` white@0.14, `0.76` c@`0.16k`, `0.92` c@`0.34k`, `0.986` white@0.95, `1` white@0 |
| 3 | Image (AC-7) | clip `0.88r`, cover crop, 106% | same |
| 4 | Vignette (image only) | radial from `0.48r` to `0.88r`, `rgba(20,14,40,0)` to `rgba(20,14,40,0.55)` | same |
| 5 | Film | conic gradient at start angle (AC-6): pink `255,128,204@0.6`, lilac `168,140,255@0.55`, cyan `110,220,255@0.55`, c@0.6, peach `255,214,150@0.5`, pink again, stops evenly spaced at `0, 0.2, 0.4, 0.6, 0.8, 1`; angle in radians; stroked as an arc at `0.895r` with line width `0.19r` (a ring from `0.80r` to `0.99r`); `globalAlpha 0.75`, composite `screen`; wrapped in `save` and `restore` so neither leaks into later layers | `globalAlpha 0.5`, composite `source-over` |
| 6 | Glow | clip to `r`; ellipse centered `(x, y + 0.94r)`, radii `1.24r` by `0.6r`: `0` white@0.55, `0.45` c@`0.25k`, `0.8` c@0 | same |
| 7 | Crescent | even odd fill between circle `(x, y, 0.97r)` and circle `(x + 0.06r, y + 0.076r, 0.938r)`, fill a linear gradient from `(x - r, y - r)` to `(x + r, y + r)`: white@0.9 at `0.22`, white@0.45 at `0.42`, white@0 at `0.6` | same |
| 8 | Spot | ellipse at `(x + 0.46r, y + 0.57r)`, radii `0.26r` by `0.11r`, rotated -45°, radial white@0.6 to 0 | same |
| 9 | Glint | ellipse at `(x - 0.51r, y - 0.61r)`, radii `0.09r` by `0.05r`, rotated -45°, radial white@0.95 to 0 | same |
| 10 | Label (AC-4) | white, `shadowColor rgba(0,0,0,0.45)`, `shadowBlur 8`; centered, or at `y + 0.45r` when an image is drawn | `#2b1f47`, drawn after a `rgba(255,255,255,0.7)` copy 1 px lower |

The focus ring (spec 0004 AC-5) still draws last, over everything.

**Burst timeline** (`t` = ms since the pop, from the animation loop clock; `r` is the popped radius):

| Part | Timing | Motion |
|---|---|---|
| Stretch | `0` to `81` | body layers 1 to 9 (image included) scaled about the center from `1` to `1.09` wide and `1.05` tall, no label |
| Snap | `81` to `180` | width scale `1.09` to `1.2`, height scale `1.05` to `1.2`, alpha `1` to `0` |
| Shock ring | `90` to `470` | white@0.75 circle stroke, radius `0.98r` to `1.55r`, alpha rises to 0.9 by `t = 166` then falls to 0, line width `0.048r` to `0.004r` |
| Droplets | 6, for `n = 0..5` | angle `n * 60 + ((n * 37) % 25) - 12` degrees; size `r * (0.16 + ((n * 7) % 4) * 0.03)`; start at `0.8r`; travel to `r * (1.35 + ((n * 5) % 3) * 0.15) + 18`; delay `40 + (n % 3) * 20`; duration 560 |
| Specks | 4, for `n = 6..9` | angle `(n - 6) * 90 + 35 + ((n * 37) % 25) - 12`; size 3 px; start `0.8r`; travel to `1.9r + 24`; delay `40 + (n % 3) * 20`; duration 700 |
| Particle easing | each particle's own `p` from 0 to 1 | distance eased with `1 - (1 - p)^4`; first 15%: alpha 0 to 1, scale 0.6 to 1; rest: alpha 1 to 0, scale 1 to 0.35 |
| Droplet look | | radial gradient centered `(-0.15s, -0.2s)` from the droplet center, radius `0.6s`: white@0.95 to `0.12`, white@0.25 at `0.32`, c@0.35 at `0.7`, white@0.8 at `0.95`, 0 at `1` |
| Ghost | from `180`, alpha 0 to 1 by `600` | dashed circle radius `r`, line width 1.5, dash `[6, 5]`, dark `rgba(255,255,255,0.38)`, light `rgba(43,31,71,0.35)`; label at alpha 0.45 |

The angles and sizes come from the particle index, never `Math.random`, so tests are exact. Frame draw order: background, ghosts, live bubbles, bursts (stretch, ring, droplets, specks), focus ring. A negative `t` (clock going backward) draws as `t = 0`.

**New and changed classes** (each does one job; dependencies through constructors; tests inject fakes):

| Class | Folder | Job |
|---|---|---|
| `BubblePainter` | `renderer/` | New. Draws one bubble (recipe layers 1 to 10) on a given context for a center, radius, color, theme, film angle, optional image, and optional scale and alpha (used by the stretch). Extracted from `CanvasRenderer.drawBubble`, which it replaces. |
| `LabelFitter` | `renderer/` | New. Returns the fitted label and value sizes (AC-4). Measures each text once at 100 px, keyed by text, weight (bold label, 600 value), and font family, then scales linearly, so there is no `measureText` per frame. The cache is emptied when `fontFamily` changes. |
| `toRgb`, `resolveTheme` | `renderer/` | New functions in one file. `toRgb` parses a color (AC-5 forms) or returns null; `resolveTheme` uses it on `backgroundColor`. Replaces `hexToRgba`. |
| `ImageCache` | `renderer/` | New. The image loading, cache, and pending set moved out of `CanvasRenderer` unchanged; `get(url)` returns a loaded `HTMLImageElement` or undefined; cleared in `dispose()`. |
| `RadiusTweener` | `core/` | Gains `cancel(id)`. |
| `BurstEffects` | `renderer/` | New. Holds bursts and ghosts; `add(snapshot, now)`, `finishAll()`, `clearGhosts()`, `drawGhosts(ctx, now)`, `drawBursts(ctx, now)`, `clear()`. Draws the stretch through `BubblePainter`. |
| `LiveAnnouncer` | `renderer/` | New. Owns the hidden polite live region and `announce(text)`; removes it in `dispose()`. |
| `PopController` | `core/` | New. `pop(id)` runs the AC-8 steps in their order, using a host from `OrbChart` (`removeOrb(id): Orb \| null`, `snapshotOf(orb)`, the view, the physics engine, `Redrawer.run(false)` when idle). Also `activate(orb, event)` for AC-9. |
| `CanvasRenderer` | `renderer/` | Clears then fills the background, draws ghosts, bubbles (through `BubblePainter`), bursts, then the focus ring. Default cursor. Under 200 lines. |
| `CanvasInput` | `renderer/` | Sets the cursor in `setHover`, so hover changes, leave, and stale hover all reset it (AC-1); hit test first, then `onActivate(orb, event)` on a hit or `onCanvasMiss(x, y)` (renamed from `onCanvasClick`) on a miss. |
| `AccessibleLayer` | `renderer/` | Button click calls the same `onActivate` hook. No growth. |
| `ChartView` | `renderer/` | Builds and disposes `BurstEffects`, `LiveAnnouncer`, and `ImageCache` with the other parts; passes theme and font through; `setStill(true)` finishes bursts before the settle draw. |
| `OrbReconciler` | `core/` | New radius formula (AC-3) and `drop(id)` (forgets the seed and cancels the tween). |
| `PhysicsEngine` | `core/` | `applyMouseRepulsion` gains an optional `strength` (default 2, today's value). |
| `ConfigResolver` | `core/` | Defaults and checks for the five new options; `minRadius` default 8. |
| `OrbChart` | `core/` | Adds `pop(id)` delegating to `PopController`, the `removeOrb` host, finish and one draw on `pause()` (AC-11), and ghost clearing in `setData`. At most 260 lines. |
| React `OrbChart` | `react/` | `onOrbPop` through `useLatest`; `pop` on the handle. |

**Public API (additions)**:

| Name | Kind | Shape | Default |
|---|---|---|---|
| `popOnClick` | option | `boolean` | `false` |
| `popStyle` | option | `"remove" \| "ghost"` | `"remove"` |
| `onOrbPop` | option | `(orb: Orb) => void` | none |
| `theme` | option | `"auto" \| "light" \| "dark"` | `"auto"` |
| `fontFamily` | option | `string` | `"Inter, system-ui, sans-serif"` |
| `minRadius` | option, changed | `number`, now a floor | `8` (was 25) |
| `pop` | `OrbChart` method and `OrbChartHandle` method | `(id: string) => boolean` | |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Size a bubble | target radius | `value`, `maxRadius`, `minRadius` from config; `largest` from the accepted `setData` entries (retarget: live orbs); AC-3 formula |
| Pick the recipe | theme | `theme` option; for `"auto"`, `backgroundColor` through `resolveTheme` |
| Tint layers | `c` | `orb.color` (from data, else `colorScheme` by index, unchanged) through `toRgb`; unparsable means `#3b82f6` |
| Burst image | image element | the `ImageCache` entry at pop time, stored in the snapshot (never looked up again by URL) |
| Turn the film | start angle | `200° + elapsed * 360 / 14000` from the renderer's elapsed time; fixed 200° when still or paused |
| Fit the label | font size, value shown | `radius`, `label`, `fontFamily`, `LabelFitter` cache; AC-4 thresholds decided here |
| Value text | `<value>%` | `orb.value`, suffix unchanged (formatting stays a deferred decision) |
| Start a pop | whether it pops | `popOnClick` config for clicks; the `id` argument for `pop` |
| Burst center | x, y | orb `x`, `y` plus the float offset at pop time (`CanvasRenderer.centerOf`) |
| Burst progress | `t` | `AnimationLoop.now()` minus the snapshot's start time |
| Particle angle, size, travel, delay | per particle | the index formulas in *Burst timeline* |
| Neighbor push | center, reach, strength | burst center, `radius + 150`, strength 1 |
| Ghost or not | after pop | `popStyle` config |
| Announce | live region text | `orb.label`, else `orb.id`, plus `" popped"` |
| Keep or drop on next data | popped id | the next `setData` input (data is the truth) |

**Key invariants**:
- A popped bubble is never in `getData()`, the hidden list, the hit test, or physics.
- `onOrbPop` fires exactly once per successful `pop`.
- Pause means pause: no pop, ghost, or burst ever queues a frame while idle; each is one explicit draw.
- The canvas is still `aria-hidden`; the hidden list and the live region are the only assistive output.
- Time comes from the animation loop clock; no timers.

**Security model**: no new trust boundary. Labels are drawn with `fillText` and announced with `textContent`. `fontFamily` only reaches `ctx.font`, where a bad value is ignored by the browser.

**Configuration required**: none. No env vars.

**Critical test scenarios** (jsdom with the fakes in `app/test-support/fakeDom.ts`; the fake 2D context gains call recording for gradients, `createConicGradient` presence switching, and a fixed `measureText`):
- Cursor over a bubble, over empty space, on leave, after the hovered bubble pops, verifies **AC-1**.
- Click on a bubble: no repulsion; click on space: repulsion, verifies **AC-2**.
- Radius table: 95.5 and 3.2 with `maxRadius` 80; all equal; all zero; zero value; `minRadius` above `maxRadius`; retarget on `updateConfig`, verifies **AC-3**.
- Long label in a small bubble is hidden; value hidden under 30 px; measured width never above `1.5r`; bad `fontFamily` warns once, verifies **AC-4**.
- `resolveTheme` for hex, short hex, `rgb()`, `rgba()` with alpha 0, `"transparent"`, garbage; invalid `theme` warns once; `clearRect` before fill, verifies **AC-5**.
- Painter draws layers in recipe order with the theme's stops; no conic layer when `createConicGradient` is missing; film angle fixed when still, verifies **AC-6**, **AC-7**.
- `pop` on live, unknown, already popped, exiting, after destroy; `onOrbPop` once; orb gone from `getData`, list, hit test; neighbors pushed only when moving, verifies **AC-8**.
- Click, tap, Enter, Space with `popOnClick` true and false: `onOrbClick` then pop, in order, verifies **AC-9**.
- Advance the fake clock through 0, 81, 180, 300, 780 ms: stretch, snap, particles, end; two bursts at once, verifies **AC-10**.
- Pop while paused and while still: one draw, no frame; pause mid burst finishes it; `start()` does not bring it back, verifies **AC-11**.
- Ghost drawn and faded; cleared by `setData`; popped id returns as a new orb; switch to `"remove"` clears ghosts, verifies **AC-12**.
- Focused bubble popped: focus moves; live region text; same text twice still changes, verifies **AC-13**.
- React: `onOrbPop` latest callback, `ref.pop`, new props by value, server and strict mode, verifies **AC-14**.
- Type fixtures, export keys, verifies **AC-15**; `destroy()` twice with bursts and ghosts active and zero live resources, verifies **AC-16**; `npm run size` and line counts, verifies **AC-17**.

## Build plan

Order follows Tracer Bullet: each slice goes through core, React, types, tests, and docs, so the package stays shippable after every slice.

1. Prepare room: extract `BubblePainter` from `CanvasRenderer.drawBubble` and `ImageCache` from the image loading, both with no visual change, and move the click handling in `CanvasInput` and `AccessibleLayer` onto one `onActivate` hook that still only calls `onOrbClick`. Existing tests stay green; `CanvasRenderer.ts` under 200 lines. Satisfies **AC-17**.
2. Slice A, fixes: default cursor and hover cursor; hit test before repulsion; area scaling with the floor and `minRadius` default 8 in `OrbReconciler` and `ConfigResolver`; `LabelFitter` and `fontFamily`; TSDoc, README options and Known limitations, React prop pass through test, type fixture. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-14**, **AC-15**.
3. Slice B, the look: `theme`, `toRgb`, and `resolveTheme`; clear then fill; the full recipe in `BubblePainter` for both themes, conic fallback, film turning; image lens; label colors; idle redraw on look changes; raise `.size-limit.json` and record the 0001 revision; React and fixtures; README. Satisfies **AC-5**, **AC-6**, **AC-7**, **AC-14**, **AC-15**, **AC-17**.
4. Slice C, the burst: `RadiusTweener.cancel` and `OrbReconciler.drop`; `PopController` with `pop`, `activate`, `popOnClick`, `onOrbPop`, neighbor push with the new `strength`; `BurstEffects` timeline and ghosts with `popStyle`; finish all on pause and still; `LiveAnnouncer` and focus move; React `onOrbPop` and `ref.pop`; fixtures; README section on popping. Satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-14**, **AC-15**, **AC-16**.
5. Guards: set `.size-limit.json` to 13 kB, 14 kB, and 13 kB (spec 0001 *Revision*, measured 2026-10-20), then `npm run size`, `check:package`, smoke on React 18 and 19, line counts, `verify.md` including the 50 bubble performance check and the visual match against the design canvas; update `UPDATE.md` to mark A1 to A4, B1 to B7, C3, and C4 done. Satisfies **AC-15**, **AC-16**, **AC-17**, **AC-18**.

## Consequences

**Positive**:
- The chart reads as bubbles on light and dark pages, which is the product's main visual promise.
- Sizes are honest, which fixes a real misreading of data.
- Pop is opt in, so existing users see no behavior change from clicks; the burst never touches physics or data, so it cannot corrupt state.

**Negative / tradeoffs**:
- Visible behavior changes before 1.0: default `minRadius` 25 to 8, size math, the cursor, no scatter on bubble click, and a new look. Users of earlier prerelease builds will see different charts.
- Bundle grows by about 3.6 kB gzip (estimated 2 to 3 kB); budgets rise a second and then a third time, to 13, 14, and 13 kB.
- About ten gradients per bubble per frame; large charts may drop frames until a sprite cache exists (feature 7).
- Labels look best in a rounded font, but the library cannot load fonts; developers must load one and pass `fontFamily`.
- The film ring and the crescent are canvas approximations of the CSS mockup and will not match it pixel for pixel.
- `"auto"` theme guesses dark for `"transparent"`; developers on light pages with a transparent chart must set `theme: "light"`.

**Neutral**:
- Spec 0002's reconcile formula is replaced (noted there); its tween, enter, exit, and retarget rules stand.
- Spec 0004 AC-4 gains the activate path; its focus and lost focus rules are reused for pops.
- No new exported names; `PhysicsEngine`, `BubblePainter`, `BurstEffects`, and `PopController` stay internal.

## Follow-up

- [ ] Sprite cache for bubbles if AC-18's 50 bubble check is not smooth; belongs to feature 7 (performance).
- [ ] `formatValue` (UPDATE.md C6) is still deferred; the canvas keeps the `%` suffix.
- [ ] Hover squish, sideways wobble, drag, and small on top drawing (UPDATE.md C1, C2, C5, C7) stay after 1.0.
- [ ] A clickable ghost that brings a bubble back (needs `restore(id)` and a keyboard path) was left out on purpose.
- [x] The scope release plan says no new chart features before 1.0; the engineer chose to ship this one before 1.0. Recorded in the scope release plan line and enrolled as feature 12.
