# 0004 rationale. Accessibility and reduced motion

## Context

OrbFlow draws everything on one `<canvas>`. To a screen reader (software that reads a page aloud) a canvas is a blank rectangle: it has no name, no text, and no parts. The chart also cannot be reached with Tab, because only the canvas exists in the page and it has no focusable pieces. A keyboard user cannot trigger `onOrbClick`, and a screen reader user cannot learn a single label or value. Scope row 6 sets the bar: a screen reader announces the chart and reaches each orb's label and value, orbs can be focused and activated from the keyboard, and with reduced motion on, orbs settle and stay still.

Motion is the second problem. Every orb floats on a sine wave, drifts with random jitter, and bounces off walls, all inside a loop that never stops. People with vestibular disorders (conditions where moving screens cause dizziness or nausea) and people with attention difficulties turn on the system "reduce motion" setting for this reason, and the chart ignores it. The physics also never reaches true rest: each tick adds a small random push, and wall hits add a fixed push, so "wait until it slows down" cannot be the way to still the chart.

The code already has the pieces this builds on. `CanvasInput` owns pointer listeners and the tooltip. `Playback` already knows how to keep a chart idle and still redraw it once when data, size, or config change. Everything the chart creates goes on a teardown list. Constraints: zero dependencies, size budgets of 8 kB (core) and 9 kB (react) with room today, classes under about 200 lines (`OrbChart.ts` and `CanvasInput.ts` are already over), no DOM access at import time, and the React component must render the same markup on the server.

## Options considered

### Option 1: Hidden real buttons plus settle then idle (chosen)

Create a visually hidden list of real `<button>`s next to the canvas, one per orb, and hide the canvas from assistive technology. Use a roving tab stop (one tabbable button, arrows move inside). Draw a focus ring on the canvas. For reduced motion, run the physics to rest once, then stop the loop and redraw only on change.

**Pros**:
- Native semantics: names, roles, focus, Enter and Space, and screen reader activation all come from the browser.
- The button's click is a genuine `MouseEvent`, so `onOrbClick` keeps its public signature.
- Still mode reuses the paused redraw path already tested in specs 0002 and 0003.

**Cons**:
- One DOM node per orb, and no accessible content before JavaScript runs.
- The buttons are not on top of the orbs, so position based assistive tools do not track them.

### Option 2: Focusable canvas with virtual children

Make the canvas itself focusable (`tabindex="0"`), track a "current orb", and point `aria-activedescendant` at ids of virtual items.

**Pros**:
- No per orb DOM beyond the ids.

**Cons**:
- Virtual children need real elements to point at anyway, so it ends up building most of Option 1 with worse support.
- Screen reader behavior differs between browsers, and activation needs hand built events.

### Option 3: Label only, and turn off float and tweens

Give the canvas `role="img"` and one long `aria-label`, and for reduced motion only remove the float and size animations.

**Pros**:
- Smallest change.

**Cons**:
- Orbs cannot be reached by keyboard, which misses the stated "done when".
- Physics keeps moving orbs on load, which is the thing reduced motion users want to avoid.

## Rationale

The 'done when' line asks for keyboard focus and per orb reach, and only real elements give that reliably across screen readers (Option 3 fails it, Option 2 fakes it). Option 1 also fits the existing code: the data order the chart already keeps (`getData()`) becomes the reading order, the teardown list absorbs the new listeners, and the click event the buttons raise is already the type `onOrbClick` promises. The cost, one node per orb, is small at the chart sizes this library targets, and feature 7 will state the limit.

Data order was chosen for walking the orbs because orbs float, so position based order would change under the user's hands. One tab stop with arrow keys was chosen because a 100 orb chart with a tab stop per orb is a trap to cross. Buttons stay unpositioned because moving DOM every frame to track floating orbs costs more than it returns; the canvas ring and tooltip carry the visual cue, and a position based voice tool can still say the button's name.

For motion, the engineer chose "settle first, then go idle". A pure "turn off the float" would still let the physics shuffle orbs on load. Settling runs a fixed 120 ticks with the random drift off and then zeroes velocities, because the engine never reaches rest by itself (drift and wall pushes keep adding speed), so waiting for low speed would never end. A fixed budget is cheap, testable, and predictable. The pause flag keeps its priority, since "pause means pause" is already a rule of this project.

The engineer left the focus ring out of the extras they ticked. It was kept anyway after a follow up, because without it a chart with `enableTooltip: false` shows no visible focus, which fails WCAG 2.4.7 (visible focus), and the ring is drawn on the canvas so forced colors mode does not change it.

Other calls made while writing: the default label is `"Bubble chart"` without a count, because a native list already announces its item count (the interview showed "Bubble chart, N items"; the count would be read twice). The ring is two tone so it holds on both dark and light backgrounds. The description id is random based and passed in as a function, so there is no module counter and tests stay deterministic. An empty `reducedMotion` value that is not one of the three strings warns and uses `"auto"`, the same pattern `transitionDuration` uses.
