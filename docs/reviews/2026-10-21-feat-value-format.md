# Review, feat/value-format, 2026-10-21

**Reviewed by**: claude-opus-5-5 (author on a different model)
**Scope**: 36 files (28 modified, 8 untracked), uncommitted
**Verdict**: Changes requested

## Summary
The change implements spec 0007: `formatValue` through a small `ValueFormatter` whose text the canvas draws and the tooltip and hidden list reuse, the value drawn on image bubbles, and `minTextSize` passed down to `LabelFitter`. The design follows the spec's one-source-of-text model, the failure handling is right (one log per chart, throws fall back, whitespace hides the value), and tests cover almost every AC. The one real problem is structure: AC-11 says no file already over its line cap may grow, and `ChartView.ts` and `AccessibleLayer.ts` both grew past 200 lines. There are also a few small gaps in how the drawn text is reused.

## Major

### 🟠 Files already over the line cap grew, breaking AC-11 and the SOLID rule, `app/renderer/ChartView.ts:96-111`
**Problem**: `ChartView.ts` went from 220 to 237 lines and `AccessibleLayer.ts` from 211 to 225 (`app/renderer/AccessibleLayer.ts:145-157`). Spec 0007 AC-11 says "No file over its line cap grows", and AGENTS.md caps classes at about 200 lines. Part of the `ChartView` growth comes from rewrapping the `AccessibleLayer` constructor so it can pass `undefined` for `makeId` and add `valueTextOf` as a sixth positional argument.
**Why it matters**: AC-11 is an acceptance criterion that can be checked on its own, and it is not met. Both classes are already the largest view classes, and this is the growth the criterion was written to stop.
**Suggested fix**: Bring both files back to their HEAD line counts or lower. For example, put `valueTextOf` on the existing `LayerHooks` object instead of a new positional parameter, which removes the `undefined` placeholder and the rewrap in `ChartView`. Or move the post-draw refresh (`beginFrame`, `refreshText`, `refreshOpen`) into a small collaborator. If the growth is accepted on purpose, record that in spec 0007 instead of leaving it unstated.

## Minor

### 🟡 `drawnText` can call the formatter again, or serve stale text, `app/renderer/ValueFormatter.ts:29-32`
**Problem**: Freshness is judged only by `orb.value`. (1) For an orb not in the current frame's drawn map (an orb not drawn this frame, or one whose value changed in `setData` before the next frame), `AccessibleLayer.write` and `TooltipView.keyOf`/`fill` each call `format()` again. That can be two or three extra formatter calls per orb, and they are not recorded, which goes against AC-12 ("the tooltip and the hidden list read the drawn text, they do not call it again"). (2) A formatter that reads other orb fields, like the TS fixture's `` `${orb.label}: ${value}` ``, gets the old text served after a `setData` that changes only the label, until the next draw.
**Why it matters**: Both effects are short-lived, because the next draw corrects them. But a slow or side-effecting formatter runs more often than documented, and a focused button can briefly hold stale text.
**Suggested fix**: When `format()` runs from `drawnText`, cache its result as well, or accept the short gap and note it in the TSDoc. Optionally add a test that counts formatter calls across a `setData` with a changed value.

### 🟡 AC-5 "no DOM write when nothing changed" has no test, `app/renderer/AccessibleLayer.ts:149-157`
**Problem**: `refreshText()` and `TooltipView.refreshOpen()` now run on every drawn frame. The tests prove that text updates in place and that focus is kept. No test proves that a settled frame writes nothing: no `textContent` setter spy or `MutationObserver`, and no check that the tooltip does not `replaceChildren` each frame.
**Why it matters**: This code runs every frame. A regression that writes on every frame would make screen readers re-announce text and would cost layout work, and the suite would still pass.
**Suggested fix**: Add a jsdom test that steps several frames on a settled chart and asserts no mutations on the list buttons or the tooltip.

### 🟡 The e2e inside-circle loop can pass with nothing checked, `e2e/look.e2e.ts:214-239`
**Problem**: The loop over `text` asserts only that drawn text stays inside the circle. If `$1,234,567.89` is hidden at every radius, or the label is hidden too, the test passes without checking the value layout at all.
**Why it matters**: The test is meant to gate the image value numbers (spec "failing numbers are tuned there"). A test that can pass with nothing drawn is a weak gate.
**Suggested fix**: Assert that `text.length >= 1` and that the label is present at every radius. At the larger radii (for example 80 and 100), also assert that the value is drawn, or use a shorter value text there, so the value placement is actually tested.

## Nits
- ⚪ `app/renderer/ChartView.ts:109`, a positional `undefined` for `makeId` is hard to read. A hooks or options field reads better, and it also fixes the Major.
- ⚪ `app/renderer/CanvasRenderer.ts:142`, `minTextSize ?? 10` repeats the default that `TextOptions` already resolves (the same pattern as the existing `fontFamily ||` fallback).
- ⚪ `app/renderer/LabelFitter.ts:36-37`, the bound is 16 measures per bubble, while spec AC-12 says "about 4 times the bubble count" (texts). The comment explains the gap, but the spec wording and the code differ.
- ⚪ `app/renderer/LabelFitter.test.ts:784`, the test reads the private `widths` map through a cast. Asserting a bounded `measureText` call count after a reset would test behavior instead.
- ⚪ `app/react/OrbChart.tsx:147`, the warning string repeats `TextOptions`'s message. A shared constant would keep the two from drifting apart.

## Strengths
- `ValueFormatter` is small, has no timers or listeners, and is the only place values become text. The throw log is kept per chart instance, as AC-3 requires, and the whitespace-to-empty rule flows correctly into all three surfaces.
- The React `formatValue` wrapper passes the newest prop through `useLatest`, with a `String` fallback and one warning, and is kept out of `diffConfig`. It matches AC-6 exactly, and tests cover identity churn and prop removal.
- The `LabelFitter` image layout is a clean "plain layout moved down by 0.45 r". Real-browser checks that text stays inside the circle across five radii back it up.
- Moving `fontFamily` checks into `TextOptions` and the focus ring into `focusRing.ts` kept `ConfigResolver` and `CanvasRenderer` under their caps.
- The size raise is recorded in spec 0001 *Revision* with the measured numbers, as AC-11 requires.

## Test coverage
Good overall. `ValueFormatter`, `TextOptions`, `ConfigResolver` (defaults, `String` reset, warn once, bad `minTextSize` values), `LabelFitter` (minSize threshold, image offset, cache bound), `BubblePainter` (image value, lowered minTextSize), the `OrbChart.format` integration (three surfaces agree, one call per bubble per frame, throw, whitespace, paused update with focus kept, pop and restore text, outside data), React behavior, and the TS fixtures are all covered. Gaps: no test that a settled frame makes no DOM writes (AC-5), no test of formatter calls between frames after a value change (AC-12), and the e2e inside-circle loop can pass with nothing drawn.
