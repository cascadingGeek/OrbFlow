# 0007. Rationale: value formatting, image bubble values, and minimum text size

## Context

A tester running the library on real data found three gaps. The value on a bubble always ends in `%`, even when the data is money or milliseconds. The tooltip and the screen reader text show the plain number, so the same bubble reads two ways. Image bubbles show no value at all, and text under 10 px is hidden with no way to change that, so crowded charts lose labels.

The `%` was a deliberate default in spec 0005, and spec 0004 and the integration guide already list `formatValue` as planned. The package has not been published, so a visible default can still change without a breaking release. The size budgets have about 0.5 kB of room in the cdn file, so every addition has to be small.

> ⚠️ Premise note: the three requests came from an automated tester, not from a user report. They are reasonable and match gaps the project already listed, so the spec proceeds, but the `%` removal is a judgment call for the engineer to own. It is cheap now and a breaking change after 1.0.0 is on npm.

## Options considered

### Option 1: One `formatValue` function behind a shared `ValueFormatter`

A single function option, `(value, orb) => string`, run by one small class that the canvas, the tooltip, and the hidden list all call. The drawn bubble carries the text.

**Pros**:
- One source, so the three surfaces cannot disagree.
- Handles locale, currency, and units stored in metadata.
- The safe wrapper (catch, convert, log once) lives in one place.

**Cons**:
- A function is called every frame per bubble.
- In React the newest function needs the latest callback wrapper, and a changed function reaches the hidden text only when it is next built.

### Option 2: Format on the canvas only

Add the option but apply it only where `%` is drawn today.

**Pros**:
- Smallest change and fewest bytes.

**Cons**:
- The tooltip and screen reader would still disagree with the canvas, which is the problem the tester reported.

### Option 3: A string template option such as `valueFormat: "{v}%"`

A declarative template instead of a function.

**Pros**:
- No function in the render loop, trivially safe, works in config files.

**Cons**:
- Cannot do locale or currency rules, or vary by orb.
- Developers end up wanting a function anyway, and then there are two options.

## Rationale

Option 1 fits the force that matters most: the same bubble must read the same everywhere, including for people who use a screen reader. Option 2 leaves that gap open, and Option 3 solves only the `%` and breaks on the first real currency or unit request. The cost of a function is a call per bubble per frame, which is small for the typical 20 to 100 bubbles, and the docs tell developers to keep the function cheap. Wrapping it in one class keeps a bad function from breaking the draw loop, the tooltip, or the hidden list.

The default became the plain number because it is the only value that is true for every kind of data, and because the tooltip and the screen reader already show it. The cost is that charts lose the `%` look, which is acceptable while nothing is published. For image bubbles, always drawing the value (no extra option) keeps the public surface small and makes image and plain bubbles carry the same facts; the fallback to today's layout when the value does not fit protects small image bubbles. `minTextSize` is one number that replaces a fixed constant, which is the smallest change that answers the tester. Clamping text up or adding two options would add behavior and bytes without a reported need.

The engineer chose each of these on the recommended pick, except the default text: the recommendation was to keep the `%` everywhere, and the engineer chose the plain number. The reasoning above explains why that also works; the tradeoff to accept consciously is the visible change from spec 0005.

## Cross check (2026-10-21, another model)

A read only pass on a different model found 16 decision gaps and some soundness points. The engineer chose to apply the recommended fixes. The main changes: the hidden button text and the tooltip now follow the drawn text on every frame, so a screen reader always hears what the canvas shows (this replaces the earlier choice to refresh them only when built); the React wrapper keeps the plain number default; the value uses the same width fit as the label; the fit cache key and the measure cache bound are named; empty and whitespace results, the exact warning strings, `minTextSize` semantics, and the unsupported cases are written down; and a 16 / 17 / 16 kB budget raise is agreed ahead of time in case the size estimate is missed. Two reviewer points needed no change: floats were never rounded by the old `%` text, and an orb popped before its first draw has no snapshot to copy.

