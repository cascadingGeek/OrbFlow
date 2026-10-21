# 0007. Value formatting, image bubble values, and minimum text size

**Date**: 2026-10-21
**Status**: Accepted

## Summary

This spec adds a `formatValue` option so a developer decides how a bubble's number reads, and the canvas, the tooltip, and the screen reader text all use it, so they agree. It also draws the value on image bubbles, which show only a label today, and adds a `minTextSize` option so a developer can show smaller text instead of having it hidden. The default value text becomes the plain number (no `%`), which changes spec 0005's default while 1.0.0 is still unreleased. Everything ships in 1.0.0.

## Requirements

**User stories**:
- As a developer charting money, units, or counts, I want to format each bubble's value (for example `$1.2M` or `42 ms`), so the chart shows my data the way my users read it.
- As a screen reader user, I want the value I hear to match the value the chart shows, so I get the same facts as a sighted user.
- As a developer using image bubbles (logos, avatars), I want the value drawn on them too, so an image bubble is not less informative than a plain one.
- As a developer with small bubbles, I want to lower the smallest text size shown, so more labels appear on a crowded chart.

**Acceptance criteria** (the contract, each one independently checkable):

*formatValue*
- **AC-1** (option): `OrbChartConfig` gains `formatValue?: (value: number, orb: Orb) => string`. When it is not set, the value text is `String(value)`, the plain number. A `formatValue` that is not a function warns once per chart (`OrbFlow: formatValue must be a function, using the plain number.`, not once per `updateConfig` call) and resolves to the default. To go back to the default after setting one, pass `formatValue: String` (`undefined` is ignored, like every other option); this is documented and tested. The `orb` argument is the developer's own `Orb` object, the same one `onOrbClick` gets.
- **AC-2** (one source of text): The same text, `formatValue(orb.value, orb)`, is used for the value drawn on the canvas, the tooltip's `Value:` line, and the value in the hidden button text (`<label>, value <text>`). With no `formatValue`, all three show exactly `String(value)`, with no rounding (the canvas never rounded before either), so the canvas no longer shows `%`, the tooltip and screen reader text are unchanged, and a float such as `0.1 + 0.2` shows in full. The docs say floats need a `formatValue`.
- **AC-3** (safe by design): A `formatValue` that throws is caught, logged once with `console.error("OrbFlow: formatValue handler threw.", error)` (not once per call), and the plain number is used from then on for that call and any later one that throws. A result that is not a string is converted with `String()`. An empty or whitespace only result hides the value on the canvas, drops `, value …` from the hidden button text, and drops the tooltip's `Value:` line. The throw log is kept per chart and does not reset when the function changes. A throw never breaks a frame, the tooltip, or the hidden list.
- **AC-4** (pop and restore): The bubble drawn while it bursts or leaves a ghost shows the text it had when it was popped. A restored bubble shows the text for the current `formatValue`.
- **AC-5** (the hidden text follows the drawn text): On every drawn frame, each hidden button's text is compared with the text built from the bubble's drawn value text, and `textContent` is written only when it differs (no DOM write when nothing changed, nodes are never replaced, so focus is kept). An open tooltip is refreshed the same way. So a new `formatValue` (by `updateConfig`, or a new function in React), a formatter whose output depends on outside data, and a restore all reach the hidden text and the tooltip on the next draw. `updateConfig({ formatValue })` redraws a paused or still chart once through `Redrawer` (never queues a frame), and that draw does the comparison.
- **AC-6** (React): `formatValue` goes through the same latest callback wrapper as `onOrbClick`. A new function identity on each render causes no `updateConfig` and no redraw, and the newest function runs on the next draw. The wrapper calls the newest prop, and when that is not a function it returns `String(value)`, so the default still applies; a prop that is set but is not a function warns once. A formatter change in a paused chart shows only after the next draw, like any other change that does not redraw.

*Image bubbles*
- **AC-7** (value on image bubbles): An image bubble with enough room draws its value under its label with the same text, weight, and size rule as a plain bubble: the plain layout moved down by `0.45 r`. The value follows the same rules as a plain bubble: hidden when `r < 30`, hidden when it cannot reach `minTextSize`, hidden when `formatValue` returns an empty string. When the value is hidden, the image bubble looks exactly as it does today (label low, no value). Drawn text stays inside the bubble's circle (spec 0005 AC-4 still holds).

*Minimum text size*
- **AC-8** (option): `OrbChartConfig` gains `minTextSize?: number`, in pixels, default `10`. It replaces the fixed 10 px under which a label, or a value, is not drawn. It is in CSS pixels, the same unit as the radius, and a fraction is allowed. There is no upper bound: a large value simply hides text, and the docs say so. A value that is not a finite number of at least 1 warns once per chart (`OrbFlow: minTextSize must be a finite number of at least 1, using 10.`) and resolves to `10`. The label and the value are hidden independently, except that a value is never shown without its label. The `r < 30` rule for values is unchanged.
- **AC-9** (change at runtime): `updateConfig({ minTextSize })` takes effect from the next draw and redraws a paused or still chart once. In React it is a plain config prop compared by value.

*Surface, docs, budgets*
- **AC-10a** (long text): The value text goes through the same width fit as the label: it shrinks until it fits the chord at its place, and is hidden when it would fall under `minTextSize`. So `$1,234,567.89` on a small bubble is hidden or small, never wider than the bubble. This holds for plain and image bubbles. The label fit cache is keyed by `label`, value text, radius bucket, image flag, and `minTextSize`, so a change in any of them is never served a stale fit.
- **AC-10b** (unsupported, documented): A `formatValue` that calls `updateConfig` or `setData` while a frame is drawing, or that mutates the `Orb` it receives, is unsupported. There is no guard.
- **AC-10** (public surface): `formatValue` and `minTextSize` each have TSDoc with their defaults. No new exported name, so spec 0001 AC-3 is unchanged. The TypeScript fixtures compile both options from both entries. The README options table and Known limitations (the `%` note goes away), `docs/integration-guide.md` (including its `%` note and a formatting recipe), and the spec 0005 default note are updated.
- **AC-11** (structure and budgets): The new `ValueFormatter` class stays under about 80 lines. No file over its line cap grows: `OrbChart.ts` stays at 285 lines or fewer and `CanvasRenderer.ts` under 200. Size is measured before the build is called done. The cdn file has about 0.5 kB of room against an estimated cost of 0.3 to 0.5 kB, so a likely overrun is settled now: if any budget is exceeded, core and cdn move to 16 kB and react to 17 kB (React stays core plus 1 kB), recorded in spec 0001 *Revision* and `.size-limit.json` in the same change, never quietly; `npm run size` passes either way.
- **AC-12** (cost and teardown): The renderer calls `formatValue` at most once per bubble per drawn frame (the tooltip and the hidden list read the drawn text, they do not call it again). Text measures stay cached by text, so a settled chart with unchanged text measures nothing per frame. The measure cache is cleared when it grows past about 4 times the bubble count, so a formatter whose output changes every frame cannot grow it without limit. `destroy()` leaves nothing behind that the formatter added.

## Decision

**Chosen option**: Option 1: one `formatValue` function, run by a small `ValueFormatter` class that the renderer calls.

A bubble's value text has one source (`ValueFormatter.text(orb)`), the drawn bubble carries it, the tooltip and hidden list follow the drawn text, and image bubbles and `minTextSize` reuse the existing label fitter.

**Implementation skills**: none.

## Feature design

**Where each value comes from** (Value sourcing):

| Action | Value produced / displayed | Source |
|---|---|---|
| Draw a bubble | value text | `ValueFormatter.text(orb)`, computed in `CanvasRenderer.bubbleOf` where the `Orb` is known, stored on the drawn `Bubble` as `valueText` |
| Draw a bubble | smallest text size | `config.minTextSize`, read through the `Look` the painter already gets, passed to `LabelFitter.fit` |
| Draw a pop snapshot or ghost | value text | the `valueText` of the `Bubble` copied into the `PopSnapshot` at pop time |
| Show the tooltip | `Value:` text | the drawn bubble's `valueText`; the tooltip's cache key includes it, and an open tooltip is refreshed when it differs |
| Build or refresh the hidden button text | `value <text>` | the drawn bubble's `valueText`, passed to `buttonText`; compared on every draw and written in place only when it differs |
| Resolve config | default formatter, default `minTextSize` | `ConfigResolver`: `String(value)` and `10`, decided in this spec |
| Warn once / log once | the one time message | `ValueFormatter` instance flag (throw, kept per chart) and `ConfigResolver.warnOnce` (bad option values), with the exact strings in AC-1 and AC-8 |
| Pop a bubble | value text in the burst or ghost | the `valueText` of the bubble drawn at pop time; an unplaced orb has no snapshot, so there is nothing to copy |
| React `formatValue` | the function that runs | the newest prop through the `useLatest` wrapper, else `String(value)` |

**`ValueFormatter`** (new, `app/renderer/`): built once by `ChartView` with `getConfig` and passed by constructor to `CanvasRenderer`. `TooltipView` and `AccessibleLayer` receive the drawn text from `ChartView`. `text(orb): string` calls `config().formatValue(orb.value, orb)` inside `try/catch`, converts a non string with `String()`, falls back to `String(orb.value)` and logs once on a throw. It holds no timers and no listeners, so teardown has nothing to do.

**Image layout** (`LabelFitter`): for `hasImage`, when a value is shown, `labelDy = 0.45 r - 0.5 * valueSize` and `valueDy = 0.45 r + 0.55 * labelSize`, which is the plain layout moved down by `0.45 r`. If the label fits but the value does not or is hidden, the result is today's image layout (`labelDy = 0.45 r`, `valueSize = 0`). The existing real browser test that keeps every drawn text inside its bubble's circle is the gate for these numbers, and failing numbers are tuned there, not left to the builder.

**Key invariants**:
- One text for one orb value: the three surfaces never format on their own.
- A faulty `formatValue` never throws into a frame, the tooltip, or the hidden list.
- Text is always set with `textContent` (spec 0004), also the formatted text, and hidden button nodes are updated in place, never replaced.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: set `formatValue` to `(v) => "$" + v`; the canvas, tooltip, and hidden button text all read `$42`, verifies **AC-1**, **AC-2**
- Default: no `formatValue`; the canvas shows `42` with no `%`, the tooltip and hidden text are unchanged, verifies **AC-2**
- Failure: `formatValue` throws once, returns a number, returns `""`; the frame still draws, one log line, verifies **AC-3**
- Pop and restore: the burst and ghost show the text at pop time, verifies **AC-4**
- Update: `updateConfig({ formatValue })` on a paused chart draws once through `Redrawer`, queues no frame, and the hidden text and open tooltip change in place without losing focus, verifies **AC-5**
- Reset: `formatValue: String` returns to the plain number; a float shows in full, verifies **AC-1**, **AC-2**
- Formatter changes between pop and restore: the restored bubble and its button show the new text, verifies **AC-4**, **AC-5**
- React: an inline `formatValue` on every render causes no `updateConfig`; an inline formatter plus a `setData` updates the button text; no prop uses the default, verifies **AC-6**
- Long text: `$1,234,567.89` on a small bubble is hidden or small and never wider than the bubble; a changed `formatValue` or `minTextSize` is never served a stale fit, verifies **AC-10a**
- Whitespace result drops the `Value:` line and `, value …`, verifies **AC-3**
- Image bubble: a value shows on an image bubble of `r >= 30`, stays inside the circle, and is absent below 30 or when empty, verifies **AC-7**
- `minTextSize` 6 shows text that 10 hides; `0`, `NaN`, and `"a"` warn once and use 10, verifies **AC-8**, **AC-9**
- Size and cost: `npm run size`; a settled chart makes no text measures per frame; a formatter that returns a new string every frame does not grow the measure cache, verifies **AC-11**, **AC-12**

## Build plan

Order follows the project's build approach, Tracer Bullet: each slice goes end to end (core, React, types, tests, docs) so the package stays shippable after it.

1. Slice A, `formatValue` end to end: add the option to `types.ts` and `ConfigResolver` (default and validation), add `ValueFormatter` with a fake based unit test, move the canvas value text to `Bubble.valueText`, and use the formatter in the tooltip and `buttonText`. Include the draw time comparison that updates the hidden buttons and open tooltip in place, and pop snapshots. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**
2. Slice A, React: put `formatValue` on the `useLatest` wrapper with the `String` fallback and the not a function warning, keep it out of `diffConfig`, and add React tests. Satisfies **AC-6**
3. Slice B, `minTextSize` and the fit: option, validation, `Look`, `LabelFitter.fit` parameter, the value width fit, the cache key and its bound, `updateConfig` redraw, React prop, tests. Satisfies **AC-8**, **AC-9**, **AC-10a**, **AC-12**
4. Slice C, image bubble value: image layout in `LabelFitter`, tests with a fake canvas and a real browser check that text stays inside the circle. Satisfies **AC-7**
5. Slice D, docs and budgets: README options table and Known limitations, integration guide recipe and `%` note, the unsupported cases and the float note, TypeScript fixtures for both entries, spec 0005 default note; measure `npm run size` and apply the agreed 16 / 17 / 16 kB raise in spec 0001 *Revision* if a budget is exceeded. Satisfies **AC-10**, **AC-10b**, **AC-11**, **AC-12**

## Consequences

**Positive**:
- The canvas, tooltip, and screen reader text always agree, and the developer controls the wording and units.
- Image bubbles carry the same facts as plain bubbles.
- More text can be shown on small bubbles without a code change.

**Negative / tradeoffs**:
- The default value text loses its `%`. Charts that relied on it show a bare number until the developer sets `formatValue`. This is cheapest to do now, while 1.0.0 is unreleased.
- `formatValue` runs once per bubble per frame. A slow formatter slows the chart, so the docs say to keep it cheap (the library does not cache its result).
- The renderer compares the hidden button text with the drawn text every frame (one string compare per bubble), which is a small steady cost for a screen reader that always matches the canvas.
- Two public options and some code join a package that has only about 0.5 kB of size room in its tightest file.

**Neutral**:
- Spec 0005's `%` default and AC-7's "no value on images" are superseded here. Their text is not edited; this spec states the change, and `/sync` notes it.
- The scope Deferred item "Value formatting (`formatValue`)" becomes this feature.

## Follow-up

- [ ] Enroll this spec as a scope feature (14) and remove the Deferred `formatValue` line, in this run's scope step.
- [ ] Measure the size first when building; the 16 / 17 / 16 kB raise is pre-agreed if needed (AC-11).
- [ ] Label text contrast (also Deferred, from spec 0004) is a separate decision and is not part of this spec.

## Rationale

The reasoning, the options considered, and the premise check are in [rationale.md](rationale.md).
