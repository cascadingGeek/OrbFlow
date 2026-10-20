# 0004. Accessibility and reduced motion

**Date**: 2026-10-20
**Status**: In Progress

## Summary

This spec makes the chart usable without a mouse and without constant motion. A canvas is invisible to screen readers (software that reads a page aloud), so the chart gets a hidden list of real buttons, one per orb, that screen readers and the keyboard can reach. The chart also respects the system "reduce motion" setting: orbs settle into place once and then stay still. It adds three optional config options (`ariaLabel`, `ariaDescription`, `reducedMotion`) and no new exports.

## Requirements

**User stories**:
- As a screen reader user, I want the chart to announce its name and each orb's label and value, so I get the same facts a sighted user sees.
- As a keyboard user, I want to Tab into the chart, move between orbs with arrow keys, and press Enter or Space on one, so I can use `onOrbClick` without a mouse.
- As a keyboard user, I want to see which orb has focus, so I never lose my place.
- As a user who turned on reduce motion in my system, I want the orbs to settle and stay still, so the chart does not make me feel unwell or distracted.
- As a developer, I want to name the chart, describe it, and override the motion setting from my own settings page, so I control what my users get.

**Acceptance criteria** (the contract, each one independently checkable):
- **AC-1** (name and description): After mount, the container holds the canvas with `aria-hidden="true"` and a visually hidden `<ul role="list" tabindex="-1">` whose `aria-label` is `ariaLabel` (default `"Bubble chart"`; an empty or whitespace only string counts as unset). The tooltip element is `aria-hidden="true"`. When `ariaDescription` is a non empty string, a hidden element holds it and the list has `aria-describedby` pointing at it; otherwise neither exists. Changing either option with `updateConfig` updates the attribute or element in place and creates no new list. `ariaDescription` resolves to `""` internally, and `""` is the way to clear it (`undefined` is ignored by `updateConfig`, and in React a removed prop keeps its last value; the TSDoc says both).
- **AC-2** (one button per orb): The list holds one `<li>` with one `<button type="button">` per live orb, in the order `getData()` returns (the validated `setData` input order), and none for exiting orbs. The button text is `"<label>, value <value>"`, plus `", category <category>"` when `metadata.category` is truthy. It is set as text, never as HTML. An empty label falls back to the orb `id`. A `setData` that keeps an `id` updates that button's text in place and keeps the same button element, so focus survives. A removed orb loses its button the moment `setData` runs, even while it is still shrinking on the canvas. When `setData` reorders ids, `sync` moves the other nodes around the focused `<li>` and never moves the focused node, so the browser keeps focus.
- **AC-3** (roving keyboard): Exactly one button has `tabindex="0"` (the last focused one, else the first), and the rest have `-1`, so Tab enters the list once and the next Tab leaves it. ArrowRight and ArrowDown focus the next orb, ArrowLeft and ArrowUp the previous, Home the first, End the last. There is no wrap at the ends. Handled keys call `preventDefault`; other keys are left alone. Keys pressed with Ctrl, Alt, or Meta held are ignored. An empty chart has no buttons.
- **AC-4** (activation): Enter or Space on a focused button calls `onOrbClick(orb, event)` once, with the live `Orb` and the button's native click `MouseEvent`. It does not push orbs away (no repulsion) and does not call `onOrbHover`. A screen reader's activate gesture takes the same path.
- **AC-5** (focus cue): The focused orb is drawn with a two tone ring on the canvas (a dark inner stroke and a light outer stroke, so it shows on any background). The ring follows the orb while it floats and goes away on blur. When `enableTooltip` is true, focus also shows the tooltip beside the orb. The tooltip has one owner at a time (`pointer` or `focus`): the last event to show it wins, and only its owner can hide it, so a pointer leave never hides a focus tooltip. It is placed once on focus (orb center plus the float offset at that moment) and refilled when `setData` changes that orb's text, as the pointer tooltip is. Escape hides a visible focus tooltip and calls `preventDefault` only then, so a host dialog can still close on Escape otherwise; the tooltip stays hidden until focus moves to a different orb. Blur hides it. Keyboard focus never calls `onOrbHover`. The ring is drawn after all orbs so it sits on top, with float offset 0 in still mode. A chart whose loop is not playing (user paused, still mode, or never started) redraws once when focus changes.
- **AC-6** (lost focus): When `setData` removes the orb that holds focus, focus moves to the next surviving id in the previous order, else the previous surviving id, else the list element itself. The layer reads `document.activeElement` (`list.contains`) before it changes the DOM, because browsers fire `focusout` on node removal inconsistently. This happens only when focus was inside the list, so the chart never steals focus from elsewhere on the page.
- **AC-7** (reduced motion setting): `reducedMotion` is `"auto"` (default), `"always"`, or `"never"`. `"always"` is reduced and `"never"` is not. `"auto"` follows `matchMedia("(prefers-reduced-motion: reduce)")`, reads it again when the system setting changes, and counts as not reduced when `matchMedia` does not exist. Any other value warns once with `console.warn`, and the stored value becomes `"auto"` so later `updateConfig` calls do not warn again. The change listener (`addEventListener("change")`, with an `addListener` fallback for Safari before 14) is added at mount whenever `matchMedia` exists, even for `"always"` and `"never"`, so a later switch to `"auto"` works, and it is removed in `destroy()`.
- **AC-8** (still mode): While reduced, (a) the float wobble offset is exactly 0, (b) every size change snaps (duration 0), (c) the repulsion call is skipped, so no hidden velocity builds up, (d) the tooltip fade is off, switchable live, and (e) no animation frame stays queued once the work is drawn. An image that finishes loading while the chart is idle triggers one draw. Hover, tap, and tooltip still work.
- **AC-9** (settle once): In still mode, `setData` (after reconcile), a resize, a radius change from `updateConfig`, and entering still mode each run this pass, in this order: snap every running tween and drop exited orbs, sync the input and the list, settle the live orbs that have a position (every velocity set to 0, then 120 physics ticks with the random drift off, then every velocity set to 0 again), then draw once through `draw()`, not through the loop. The pass is skipped while the container width or height is 0 and runs on the first non zero resize. Existing orbs keep their place except where overlaps are pushed apart; an orb touching a wall ends about 10 px inside it. Crowded charts (orb area larger than the box) may keep overlaps. Orbs do not move again until data, size, or config changes. Every colour or look change from `updateConfig` also draws once. `start()` in still mode draws one frame through `draw()` and queues none. Leaving still mode may make the float jump by up to `floatAmplitude` px; that is accepted.
- **AC-10** (live switch and pause): When the effective setting flips while the chart runs (system change or `updateConfig({ reducedMotion })`): into reduced stops the loop, settles, and draws once; out of reduced restarts the loop. A user `pause()` always wins and survives every flip: a paused chart never settles or moves orbs, it records that a settle is pending, and `start()` runs it before its one draw. Both `start()` and `autoStart()` (called by `setData`) record that the chart wants to run; leaving still mode restarts the loop only when that is recorded and the user has not paused. A chart that never received data or `start()` stays unstarted.
- **AC-11** (teardown): `destroy()` removes the list, the description element, every listener the layer added, and the media listener. After it the fake DOM reports zero live listeners, observers, frames, and timers, and the container holds nothing the chart added, including its `position` style: the layer sets `relative` only when the computed position is `static` and restores the old value in `destroy()`. The list sits at top 0, left 0. Calling `destroy()` twice is safe. Nothing reads `window` or `document` at import time.
- **AC-12** (React and server): The React component needs no new code to pass the three options (they are plain config props, compared by value). Server rendering still outputs one `div` and no canvas, list, or button, with no warning. Hydration shows no mismatch, and after mount the container holds one canvas and one list, also under `StrictMode`.
- **AC-13** (public surface and docs): Runtime exports are unchanged in both entries. `OrbChartConfig` gains `ariaLabel`, `ariaDescription`, and `reducedMotion`, each with TSDoc and its default, and no new type name is exported, so spec 0001 AC-3 does not change. The TypeScript fixture compiles the three options from both entries. The TSDoc states that the reduced motion value is a union of three strings and that hidden buttons are not positioned over the orbs.
- **AC-14** (budgets): `npm run size` passes (core 8 kB, react 9 kB, cdn 8 kB gzip; today 5.7 kB, 6.24 kB, and 5.76 kB), or a budget is raised on purpose in spec 0001. Each new class stays under about 200 lines, and `OrbChart.ts` ends no longer than its 218 lines today, by moving the idle draw, settle, and resume glue into a new `Redrawer` class.

## Decision

**Chosen option**: Option 1: a hidden DOM mirror of real buttons, plus a settle then idle still mode

The canvas stays the picture. A visually hidden list of real buttons is the accessible and keyboard layer, driven by the same orb list the canvas draws. Reduced motion is a mode of the existing playback logic: settle the physics once, then draw only when something changes, exactly like a paused chart does today.

**Implementation skills**: none relevant installed. Conventions come from `AGENTS.md`.

## Rationale

Reasoning and options: see [rationale.md](./rationale.md).

## Feature design

**Data model sketch**: none. No schema, no persistence. The only new state is in memory: the focused orb `id`, the last focused `id` (for the roving tab stop), and the resolved reduced flag.

**State transitions**:
- Motion: `normal` and `still`, chosen by `reducedMotion` and the system setting. `normal → still`: stop the loop, settle, draw once. `still → normal`: restart the loop unless the user paused. User pause is a separate flag that wins in both modes (`Playback.idle` is true when either is set).
- Focus: `none → orb(id)` on focus, `orb(id) → orb(other)` on arrow keys, `orb(id) → none` on blur. Removal of the focused orb moves focus per AC-6.

**Structure** (all created after mount, never during render or import):

```
container
  canvas                aria-hidden="true"
  div (tooltip)         aria-hidden="true"
  ul[role=list]         visually hidden, aria-label, tabindex=-1, [aria-describedby]
    li > button         text per AC-2, tabindex 0 or -1
  span (description)    visually hidden, only when ariaDescription is set
```

Hidden means the standard clip pattern (absolute, 1px, clipped), not `display: none`, so screen readers still see it. The buttons are not positioned over the orbs: the orbs move constantly, and moving DOM every frame would cost more than it gives. The canvas ring is the visible cue instead.

**New and changed classes** (SOLID: each does one job, dependencies come through constructors, tests inject fakes):

| Class | Folder | Job |
|---|---|---|
| `AccessibleLayer` | `renderer/` | Builds, syncs, and removes the list and buttons. Owns the delegated `keydown`, `focusin`, `focusout`, and `click` listeners, the roving tab stop, and the lost focus rule. Reports the focused orb through a callback. Takes a `makeId` function for the description id (default random based, no module counter). |
| `TooltipView` | `renderer/` | Extracted from `CanvasInput`: creates, fills, places, and hides the tooltip. Used by pointer and by keyboard focus, tracks its owner, and has `setFade(on)` so a live flip changes the transition in place. No behavior change at extraction. |
| `MotionPreference` | `core/` | Resolves the effective reduced flag from the config value and `matchMedia`, listens for changes, and unsubscribes in `dispose()`. Takes `matchMedia` as an argument (default `typeof window !== "undefined" ? window.matchMedia?.bind(window) : undefined`, read in the constructor) so tests fake it. |
| `Settler` | `core/` | Runs the settle step: zero velocities, 120 ticks with no drift, zero velocities again. |
| `Playback` | `core/` | Gains a reduced flag. `idle` is true when user paused or reduced. `start()` while reduced draws once and queues nothing. Remembers that the chart wanted to run, so leaving still mode resumes it. |
| `PhysicsEngine` | `core/` | `update` gets an optional second argument that turns the random drift off. |
| `CanvasRenderer` | `renderer/` | Draws the focus ring for the focused `id` after all orbs, zeroes the float offset in still mode, and calls an `onImageLoaded` callback so an idle chart can draw once. |
| `Redrawer` | `core/` | Owns the idle path: draw once, snap tweens, run the settle pass in the AC-9 order, remember a pending settle while paused, and resume on leaving still mode. Every `playback.paused` test in `OrbChart` (`setData`, `handleResize`, `updateConfig`) becomes `playback.idle` and goes through it. |
| `OrbChart` | `core/` | Wires the pieces. Calls `layer.sync(liveOrbs)` after `setData`, and applies `ariaLabel`, `ariaDescription`, and `reducedMotion` in `updateConfig`. Must not grow past 218 lines. |

**Public API (additions, config only)**:

| Name | Kind | Shape | Default |
|---|---|---|---|
| `ariaLabel` | `OrbChartConfig` option | `string` | `"Bubble chart"` |
| `ariaDescription` | `OrbChartConfig` option | `string` | none |
| `reducedMotion` | `OrbChartConfig` option | `"auto" \| "always" \| "never"` | `"auto"` |

The default label does not repeat the item count, because a native list already announces "list, N items". React gets the same three as props with no wrapper change.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Name the list | accessible name | `ariaLabel`, else the constant `"Bubble chart"` |
| Describe the list | description text | `ariaDescription`; absent means no element |
| Write a button | label, value, category | `orb.label` (else `orb.id`), `orb.value`, `orb.metadata.category`: the same fields the tooltip reads |
| Order the buttons | position in list and arrow order | `getData()` order, which is validated `setData` input order |
| Activate | the `event` passed to `onOrbClick` | the button's native click `MouseEvent` |
| Roving stop | which button has `tabindex="0"` | last focused `id` kept by the layer, else first live orb |
| Draw the ring | center, radius, ring size | focused orb `x`, `y` plus float offset, `radius`; strokes `r + 3` (2px, `#0a0e1a`) and `r + 5` (2px, `#ffffff`) |
| Place the focus tooltip | left and top | orb center plus `0.7 * radius + 8` px on both axes, clamped like the pointer tooltip |
| Reduced or not | boolean | `reducedMotion` config plus the `matchMedia` result; no `matchMedia` means false |
| Settle length | tick count | constant 120, decided here |
| Description id | `aria-describedby` target | `makeId()` per chart, random based |

**Key invariants**:
- The canvas and the tooltip are never exposed to assistive technology; the list is the single source of truth for them.
- Exactly one button is tabbable at any time, and none when there are no orbs.
- User `pause()` beats reduced motion beats `start()`. Pause means pause.
- Still mode never queues an animation frame; every visible change is one explicit draw.
- A button element lives as long as its orb `id`, so focus is never lost to a text update.

**Security model**: no new trust boundary. Orb text is user supplied and is set with `textContent` only, as the tooltip already does.

**Configuration required**: none. No env vars.

**Critical test scenarios** (jsdom, using the fakes in `app/test-support/fakeDom.ts`, which gains a controllable `matchMedia` with a `fire(matches)` helper and listener counts, a focus helper over `document.activeElement`, and an image `onload` trigger):
- Mount with three orbs: list, three buttons, attributes, canvas `aria-hidden`, verifies **AC-1**, **AC-2**.
- `setData` with a changed value and a removed id: text updates in place, removed button gone, verifies **AC-2**.
- Tab, arrows, Home, End, no wrap, one tab stop, verifies **AC-3**.
- Enter and Space call `onOrbClick` once with a `MouseEvent`, no `onOrbHover`, no repulsion, verifies **AC-4**.
- Focus draws the ring, shows the tooltip, Escape hides it, a paused chart redraws once, verifies **AC-5**.
- Remove the focused orb: focus lands on next, previous, then list; focus elsewhere is not stolen, verifies **AC-6**.
- `auto`, `always`, `never`, an invalid value, no `matchMedia`, and a live change event, verifies **AC-7**.
- Still mode: float 0, snap sizes, no frame queued, no repulsion, verifies **AC-8**, **AC-9**.
- Flip the setting while running, with and without a user pause, including an exiting orb mid shrink and a late image, verifies **AC-9**, **AC-10**.
- `destroy()` twice with zero live listeners including the media one, verifies **AC-11**.
- React server render, hydrate, strict mode, and prop pass through, verifies **AC-12**.
- Type fixture compiles the three options, `npm run size`, verifies **AC-13**, **AC-14**.

## Build plan

Order follows Tracer Bullet: each slice goes through core, React, types, tests, and docs, so the package stays shippable after every slice.

1. Prepare room: extract `TooltipView` from `CanvasInput` with no behavior change, and move `OrbChart` glue so it can take the new wiring without growing. Existing tests stay green. Satisfies **AC-14**.
2. Slice A, name and list: add `ariaLabel` and `ariaDescription` to `OrbChartConfig` and `ConfigResolver`; build `AccessibleLayer` (list, buttons, text, `aria-hidden` on canvas and tooltip, click to `onOrbClick`), register it on the teardown list, live updates through `updateConfig`; React pass through test, server and hydrate checks, TypeScript fixture, TSDoc. Satisfies **AC-1**, **AC-2**, **AC-4**, **AC-11**, **AC-12**, **AC-13**.
3. Slice B, keyboard and focus cue: roving tab stop, arrow keys, Home and End, focus callback into `OrbChart`, ring in `CanvasRenderer`, tooltip on focus through `TooltipView`, Escape, redraw once when the loop is stopped, lost focus rule. Satisfies **AC-3**, **AC-5**, **AC-6**.
4. Slice C, reduced motion: add `reducedMotion` to config; `MotionPreference` with the faked `matchMedia`; `Playback` reduced flag, `idle`, and the wants to run record; `Redrawer` with the settle order; `Settler` and the no drift argument on `PhysicsEngine.update`; image load redraw; float 0, snap sizes, no repulsion, tooltip fade off; live switch with pause precedence. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**.
5. Guards: size budgets, `check:package`, `smoke` on React 18 and 19, line count check on the new classes and `OrbChart.ts`, `verify.md` run. Satisfies **AC-12**, **AC-13**, **AC-14**.

## Consequences

**Positive**:
- Screen reader users get a named chart and every orb's label and value. Keyboard users can reach and activate every orb.
- Real buttons mean native focus, native Enter and Space, and a genuine `MouseEvent`, so `onOrbClick` keeps its signature.
- Still mode reuses the paused redraw path, so there is one rule for "draw once, queue nothing".
- No new exports, no new dependency, and the size budgets have room (about 2 kB in core, 2.7 kB in react).

**Negative / tradeoffs**:
- There is no accessible content before JavaScript runs, because the list is created after mount. The server output stays one empty `div`.
- The buttons are not positioned over the orbs, so voice control tools that click by screen position, and screen magnifiers that follow focus, will not track the orb. The canvas ring and tooltip are the cue.
- One extra DOM node per orb. A very large chart pays for it, which feature 7 (performance) must measure and state.
- The settle pass costs about 120 ticks of physics on each data, size, or radius change in still mode, and it can move existing orbs a little to push overlaps apart.
- The default label is English. Developers who ship other languages must pass `ariaLabel`, and the per orb text pattern ("value", "category") is English too.

**Neutral**:
- Spec 0003's pause and redraw rules are unchanged; `Playback` only gains a second reason to be idle.
- `PhysicsEngine`, `Settler`, and `AccessibleLayer` stay internal. Nothing new is exported.

## Follow-up

- [ ] The canvas draws a hard coded `%` after each value, but the tooltip and the new screen reader text do not. A `formatValue` option would make all three agree. Separate decision, enrolled on the scope Deferred list.
- [ ] Label text contrast on custom `colorScheme` colors (pick light or dark text per orb). Changes how the chart looks, so it is its own decision, enrolled on the scope Deferred list.
- [ ] Live announcements after `setData` were left out on purpose (noisy on live dashboards). Revisit if users ask.
- [ ] The tooltip still ignores the pointer (`pointer-events: none`), so WCAG 1.4.13 "hoverable" is only partly met. Dismissal on Escape and persistence are covered here.
- [ ] Run a real screen reader pass (VoiceOver, NVDA) and a forced colors check in a browser. The jsdom tests cannot hear or see; `verify.md` lists the steps.
- [ ] Feature 7 (performance) must state how many orbs the extra DOM layer allows.
