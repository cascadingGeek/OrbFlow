# Orb Flow 🫧

A lightweight, physics based bubble (orb) chart for the browser, drawn on canvas. Bubbles look like real soap bubbles, rise in from below, float, push each other apart, react to clicks and taps, and can burst into droplets and come back. It works for any "how much of each thing" data: tickets by tag, revenue by product, votes per feature, or market moves. The core has zero runtime dependencies, and a React component is included.

> **Status: in development, not released yet.** Version 1.0 is not on npm yet, so `npm install orbflow` and the CDN link below will work once it is published. Until then you can [build it from source](#before-the-npm-release-build-from-source). Follow the progress on [Threads](https://www.threads.com/@cascadinggeek).

**Contents:** [Features](#features) · [Installation](#installation) · [Quick start](#quick-start) · [Next.js](#nextjs) · [Showing details](#showing-details-when-a-bubble-is-clicked) · [Popping](#popping-bubbles) · [Formatting values](#formatting-values) · [Recipes](#recipes) · [API reference](#api-reference) · [Performance](#performance) · [Known limitations](#known-limitations) · [Development](#development) · [Roadmap](#roadmap)

## Features

**Bubble look**

- Soap bubbles: a clear center, a bright rim, a shimmering soap film, a crescent highlight, and a small glint.
- Drawn for light or dark pages. `theme: "auto"` picks from your `backgroundColor`.
- Images sit inside the bubble like a lens, with the glass drawn on top.
- Labels always fit inside their bubble, and hide when the bubble is too small to read them.

**Bubble physics**

- Bubbles never overlap: when two touch, they push apart.
- Click or tap empty space and the bubbles nearby scatter away from it. Clicking a bubble never scatters its neighbors.
- A gentle idle float and a slight random drift keep the chart alive.
- Soft bounce off the chart edges.

**Data**

- Bubble area follows each item's `value`: a value twice as big gets a bubble with twice the area. `minRadius` keeps tiny values visible.
- Updates are smooth: `setData` matches bubbles by `id`, so existing bubbles keep their place and animate to their new size, new ones rise in from below, and removed ones shrink out.
- Bad entries (a missing, empty, or duplicate `id`, a label that is not a string, or a value that is not a number of 0 or more) are skipped and reported to you, never thrown.
- Optional image inside each bubble, plus a color per bubble or a palette for the rest.

**Interaction**

- Built in tooltip on hover, on tap (touch), and on keyboard focus.
- `onOrbClick` and `onOrbHover` callbacks, so you can show your own details card or drawer.
- Pop a bubble with `chart.pop(id)`, or let users pop them with `popOnClick`. It bursts into droplets, and can leave a dashed ghost behind.
- Bring popped bubbles back with `chart.restore()`, for example when your details drawer closes. They rise to their old place.
- Bubbles rise from the bottom edge when the chart first scrolls into view, and when new ones are added.
- The hand cursor shows only over a bubble.
- Works with mouse, pen, and touch (Pointer Events).

**Accessibility**

- The chart has an accessible name and an optional description.
- Screen readers get a hidden list with one real button per bubble (label, value, category).
- Keyboard: Tab into the chart, move between bubbles with the arrow keys, Home, and End, press Enter or Space to activate a bubble, and Escape to hide the tooltip. A focus ring shows which bubble has focus.
- Respects the system "reduce motion" setting: bubbles settle once and stay still, and a pop happens at once, with no burst.
- Each pop is announced to screen readers ("BTC popped"), and keyboard focus moves to the next bubble.

**Built for real apps**

- Works with vanilla JavaScript and React 18 or 19, including server rendered React and strict mode.
- Fills its container and redraws on resize, with sharp drawing on high density screens.
- `destroy()` removes every listener, observer, and element, and is safe to call twice.
- ESM, CommonJS, and a CDN script build, with TypeScript types. The core is about 15 kB gzip, the React entry about 16 kB.
- If the chart cannot start (for example, no canvas support), the React component throws to your nearest error boundary, so you can show a fallback.

## Installation

```bash
npm install orbflow
# or
yarn add orbflow
# or
pnpm add orbflow
```

React (18 or 19) is an optional peer dependency: you only need it for `orbflow/react`. The core has no dependencies at all.

### Before the npm release: build from source

```bash
git clone https://github.com/cascadingGeek/OrbFlow.git
cd OrbFlow
npm install
npm run build
npm pack            # creates orbflow-1.0.0.tgz
```

Then, in your app:

```bash
npm install /path/to/OrbFlow/orbflow-1.0.0.tgz
```

The imports are the same as after the release (`orbflow` and `orbflow/react`).

## Quick start

### Vanilla JavaScript

Give the container a size; the chart fills it.

```html
<div id="chart" style="width: 800px; height: 600px"></div>
```

```javascript
import { OrbChart } from "orbflow";

const chart = new OrbChart("#chart", {
  onOrbClick: (orb) => console.log("Clicked:", orb.label),
});

chart.setData([
  { id: "btc", label: "BTC", value: 45, color: "#f7931a" },
  { id: "eth", label: "ETH", value: 30, color: "#627eea" },
  { id: "sol", label: "SOL", value: 15, color: "#00d4aa" },
]);
// The animation starts on the first setData call.

// Later, when the chart goes away:
chart.destroy();
```

The first argument is a CSS selector or an `HTMLElement`.

### React

```tsx
import { useMemo } from "react";
import { OrbChart } from "orbflow/react";

function App() {
  const data = useMemo(
    () => [
      { id: "btc", label: "BTC", value: 45, color: "#f7931a" },
      { id: "eth", label: "ETH", value: 30, color: "#627eea" },
    ],
    [],
  );

  return (
    <div style={{ width: 800, height: 600 }}>
      <OrbChart data={data} onOrbClick={(orb) => console.log(orb.label)} />
    </div>
  );
}
```

- The component renders a `div` that fills its parent (`width: 100%; height: 100%`). Pass `className` or `style` to change it.
- `data` is sent to the chart whenever its reference changes, so keep it stable with `useMemo` or state.
- Callbacks can be new functions on every render; the newest one always runs, and a new function never causes an update.
- Config props are compared by value, so inline objects and arrays cost nothing.
- A config prop that becomes `undefined` keeps its last value. Pass an explicit value to change it.

**Server rendering.** The component renders an empty `div` on the server and creates the canvas after mount, so it is safe with server rendering, hydration, and strict mode. See [Next.js](#nextjs) for the App Router.

**Errors.** If the chart cannot start, the component throws to the nearest error boundary. Wrap it in one to show a fallback, such as a table of the same data.

**Controlling the chart from React.** A ref gives you `start()`, `pause()`, `getData()`, `pop(id)`, and `restore(id?)`:

```tsx
import { useRef } from "react";
import { OrbChart, type OrbChartHandle } from "orbflow/react";

const ref = useRef<OrbChartHandle>(null);

<OrbChart ref={ref} data={data} />;
<button onClick={() => ref.current?.pause()}>Pause</button>;
```

### CDN (no build step)

Available once 1.0 is on npm. Before that, use `dist/orbflow.iife.js` from a source build.

```html
<div id="chart" style="width: 800px; height: 600px"></div>
<script src="https://unpkg.com/orbflow/dist/orbflow.iife.js"></script>
<script>
  const chart = new OrbFlow.OrbChart("#chart");
  chart.setData([{ id: "a", label: "A", value: 10 }]);
</script>
```

## Next.js

OrbFlow works with the App Router and the Pages Router, with no special config. `orbflow/react` already starts with `"use client"`, and on the server it renders a single empty `div`, so you do **not** need `next/dynamic` with `ssr: false`.

Fetch data in a Server Component, and put the chart with its callbacks in a Client Component (functions cannot be passed from a Server Component to a Client Component):

```tsx
// app/markets/MarketBubbles.tsx
"use client";

import { useMemo, useState } from "react";
import { OrbChart, type OrbDataInput } from "orbflow/react";
import { geistSans } from "@/lib/fonts"; // a next/font font

export function MarketBubbles({ markets }: { markets: Market[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stable data: a new array reference applies new data.
  const data = useMemo<OrbDataInput[]>(
    () =>
      markets.map((m) => ({
        id: m.symbol,
        label: m.symbol,
        value: Math.abs(m.change),
        color: m.change >= 0 ? "#22c55e" : "#ef4444",
        imageUrl: `/logos/${m.symbol.toLowerCase()}.png`, // from /public
        metadata: { change: m.change },
      })),
    [markets],
  );

  return (
    <div className="h-[520px]">
      <OrbChart
        data={data}
        backgroundColor="transparent"
        theme="dark"
        fontFamily={geistSans.style.fontFamily}
        formatValue={(_, orb) => `${Number(orb.metadata?.change).toFixed(1)}%`}
        popOnClick
        ariaLabel="Market moves"
        onOrbClick={(orb) => setSelectedId(orb.id)}
      />
    </div>
  );
}
```

```tsx
// app/markets/page.tsx (a Server Component)
import { MarketBubbles } from "./MarketBubbles";

export default async function Page() {
  const markets = await getMarkets();
  return <MarketBubbles markets={markets} />;
}
```

A chart with plain props only (no callbacks, no ref) can be rendered directly from a Server Component.

Things to get right in Next.js:

- **Give the parent a height** (`h-[520px]`, a sized grid cell, or `size-full` inside a sized box). The chart fills its parent.
- **Fonts:** pass the real family name from `next/font` (`geistSans.style.fontFamily`), not a CSS variable; the canvas cannot read CSS variables. Mount the chart after fonts load (see [Wait for your font](#wait-for-your-font)).
- **Transparent background:** with `backgroundColor="transparent"`, set `theme` yourself, since `"auto"` cannot see the page behind the chart.
- **Images:** serve them from `/public` or a host that sends CORS headers. `next/image` is not used; the canvas needs a plain URL.

## Showing details when a bubble is clicked

OrbFlow does not open a modal. A modal would cover the chart and break the playful feel. Instead, it gives you the clicked bubble, and you show details your way. Put any extra fields in `metadata`; they come back on the clicked orb.

**Floating card near the bubble** (vanilla):

```javascript
const card = document.querySelector("#card");

const chart = new OrbChart("#chart", {
  enableTooltip: false, // the card replaces the built in tooltip
  onOrbClick: (orb, event) => {
    card.textContent = `${orb.label}: ${orb.metadata?.price}`;
    card.style.left = `${event.offsetX}px`;
    card.style.top = `${event.offsetY}px`;
    card.hidden = false;
  },
});
```

**Side drawer** (React):

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);
const selected = records.find((r) => r.id === selectedId);

<OrbChart data={data} onOrbClick={(orb) => setSelectedId(orb.id)} />;
{
  selected && <Drawer record={selected} onClose={() => setSelectedId(null)} />;
}
```

`onOrbClick` also runs when a keyboard user presses Enter or Space on a focused bubble, so your details view works for everyone. When the event comes from the keyboard, `offsetX` and `offsetY` do not point at the bubble, so a drawer is the safer pattern if position matters.

## Popping bubbles

Any live bubble can burst: it stretches, snaps, sends out a ring and a few droplets, and is gone in about 0.8 seconds. The rest of the chart drifts gently into the gap.

```javascript
const chart = new OrbChart("#chart", {
  popOnClick: true, // click, tap, Enter, or Space pops a bubble (after onOrbClick)
  popStyle: "ghost", // leave a dashed outline where it was ("remove" leaves nothing)
  onOrbPop: (orb) => console.log(`${orb.label} popped`),
});

chart.pop("btc"); // true if "btc" was a live bubble, false otherwise
```

- A popped bubble is gone from `getData()`, from hit testing, and from the screen reader list at once. `onOrbPop` runs exactly once per pop.
- A paused or still (reduced motion) chart pops instantly, with no burst, and stays paused.
- Ghosts are not clickable. The next `setData` clears them, and an id that comes back in the data grows in again as a new bubble. Your data is the source of truth.
- Screen readers hear "&lt;label&gt; popped" through a polite live region.

### Bringing bubbles back

```javascript
const chart = new OrbChart("#chart", {
  popOnClick: true,
  onOrbClick: (orb) => openDrawer(orb), // your own details view
  onOrbRestore: (orb) => console.log(`${orb.label} is back`),
});

closeDrawerButton.onclick = () => chart.restore(); // every popped bubble rises back
chart.restore("btc"); // true if "btc" was popped and is not live, false otherwise
```

- A restored bubble rises from below the chart to the place it had, for both `popStyle` values. It is a normal bubble again, so it can be popped again.
- With `popOnClick`, clicking another bubble brings back the one the user popped before (`restoreOnNextPop`, on by default). Bubbles popped with `chart.pop(id)` from code are never brought back this way.
- The next `setData` forgets every popped bubble, because your data is the source of truth. In React, pass a stable `data` (from `useMemo` or state): a new array on every render calls `setData`.
- Screen readers hear "&lt;label&gt; restored", or "3 bubbles restored" for a batch.

### Entering bubbles

New bubbles rise from below the bottom edge, in a loose stagger, once the chart first scrolls into view. Set `enterStyle: "grow"` for the older grow in. A paused or still chart, and `transitionDuration: 0`, show bubbles in place with no motion.

## Recipes

### Wait for your font

The chart measures label text with whatever font is loaded when it first draws, and keeps those measurements. If your web font loads later, labels can be sized for the fallback font. Mount the chart once fonts are ready:

```tsx
const [fontsReady, setFontsReady] = useState(false);

useEffect(() => {
  let live = true;
  document.fonts.ready.then(() => live && setFontsReady(true));
  return () => {
    live = false;
  };
}, []);

return fontsReady ? <OrbChart data={data} fontFamily={font} /> : <Loading />;
```

### Pause when off screen or hidden

The chart keeps animating while it is off screen. Pause it yourself with an `IntersectionObserver`, and when your UI hides it (for example, a table view):

```tsx
const chart = useRef<OrbChartHandle>(null);
const box = useRef<HTMLDivElement>(null);
const [onScreen, setOnScreen] = useState(true);

useEffect(() => {
  const node = box.current;
  if (!node) return;
  const observer = new IntersectionObserver(([entry]) =>
    setOnScreen(entry.isIntersecting),
  );
  observer.observe(node);
  return () => observer.disconnect();
}, []);

const running = visible && onScreen; // `visible`: your own view state
useEffect(() => {
  if (running) chart.current?.start();
  else chart.current?.pause();
}, [running]);

return (
  <div ref={box} className="size-full">
    <OrbChart ref={chart} data={data} />
  </div>
);
```

A paused chart draws nothing until something changes, and data or option changes still show as one still frame.

### Keep the selected bubble popped while a drawer is open

Pop the bubble the drawer shows, and bring everything back when the drawer closes. This also works when the drawer was opened from somewhere else, such as a table row:

```tsx
<OrbChart
  ref={chart}
  data={data}
  popOnClick
  restoreOnNextPop={false} // the drawer decides when bubbles come back
  onOrbClick={(orb) => openDrawer(orb.id)}
/>;

// Re-pop after new data, since setData brings popped bubbles back.
useEffect(() => {
  if (open && selectedId) chart.current?.pop(selectedId);
}, [data, open, selectedId]);

useEffect(() => {
  if (!open) chart.current?.restore();
}, [open]);
```

`pop` and `restore` return `false` when there is nothing to do (already popped, not on the chart, or not mounted), so these effects are safe to run often.

### Size by one number, show another

`value` sets the bubble size and must be 0 or more. To size by the size of a change but show its sign, put the real number in `metadata` and format it:

```tsx
const data = rows.map((r) => ({
  id: r.id,
  label: r.name,
  value: Math.abs(r.change),
  color: r.change >= 0 ? "#22c55e" : "#ef4444",
  metadata: { change: r.change },
}));

<OrbChart
  data={data}
  formatValue={(_, orb) => {
    const change = Number(orb.metadata?.change);
    return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  }}
/>;
```

### Show a fallback when the chart cannot start

```tsx
class ChartBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

<ChartBoundary fallback={<DataTable rows={rows} />}>
  <OrbChart data={data} />
</ChartBoundary>;
```

### Log skipped data

```tsx
<OrbChart
  data={data}
  onDataIssue={(issues) => console.warn("OrbFlow skipped entries", issues)}
/>
```

## API reference

### `new OrbChart(container, config?)`

| Method                  | What it does                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `setData(data)`         | Loads or updates data. Bubbles are matched by `id`. Starts the animation the first time. Clears ghosts.                                 |
| `pop(id)`               | Bursts the live bubble `id`. Returns `false` for an unknown id, a bubble already popped or shrinking out, or after `destroy()`.         |
| `restore(id?)`          | Brings back the popped bubble `id`, or every popped bubble without an `id`. Returns `false` if nothing came back, or after `destroy()`. |
| `updateConfig(partial)` | Changes options. Keys set to `undefined` are ignored.                                                                                   |
| `start()`               | Starts or resumes the animation.                                                                                                        |
| `pause()`               | Pauses the animation. A paused chart stays paused when data or options change, and shows the change as one still frame.                 |
| `getData()`             | The current bubbles (`Orb[]`), without the ones shrinking out. Treat them as read only.                                                 |
| `destroy()`             | Removes the chart and everything it added. Safe to call more than once.                                                                 |

### Options (`OrbChartConfig`)

The React component takes the same options as props.

| Option               | Type                            | Default                          | Description                                                                                                                              |
| -------------------- | ------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `width`              | number                          | container width                  | Starting width in pixels. The chart then follows its container's size.                                                                   |
| `height`             | number                          | container height                 | Starting height in pixels. The chart then follows its container's size.                                                                  |
| `backgroundColor`    | string                          | `"#0a0e1a"`                      | Canvas background color. `"transparent"` shows the page behind the chart.                                                                |
| `theme`              | `"auto" \| "light" \| "dark"`   | `"auto"`                         | Bubble look. `"auto"` is light when `backgroundColor` is a light hex or `rgb()` color, dark otherwise.                                   |
| `fontFamily`         | string                          | `"Inter, system-ui, sans-serif"` | Font for bubble labels. Load the font on your page first; the chart does not load fonts.                                                 |
| `formatValue`        | `(value, orb) => string`        | `String`                         | The text shown for a bubble's value, on the canvas, in the tooltip, and for screen readers. See [Formatting values](#formatting-values). |
| `minTextSize`        | number                          | `10`                             | The smallest text size in pixels drawn. Lower it to show more text on small bubbles; text that would be smaller is hidden.               |
| `minRadius`          | number                          | `8`                              | The smallest radius in pixels, a floor so tiny values stay visible. Area follows value above it.                                         |
| `maxRadius`          | number                          | `80`                             | Radius of the bubble with the largest value, in pixels.                                                                                  |
| `colorScheme`        | string[]                        | 8 blues, cyans, and purples      | Colors used, in order, for bubbles without their own `color`. Use hex or `rgb()` colors; others draw blue.                               |
| `enableTooltip`      | boolean                         | `true`                           | Show the built in tooltip.                                                                                                               |
| `onOrbClick`         | `(orb, event) => void`          | none                             | Runs on click, tap, or Enter or Space on a focused bubble.                                                                               |
| `onOrbHover`         | `(orb \| null) => void`         | none                             | Runs when the hovered bubble changes; `null` when none is hovered.                                                                       |
| `onDataIssue`        | `(issues) => void`              | none                             | Runs once per `setData` call that skipped any entry. See `OrbDataIssue`.                                                                 |
| `popOnClick`         | boolean                         | `false`                          | Click, tap, Enter, or Space pops a bubble, after `onOrbClick` runs.                                                                      |
| `popStyle`           | `"remove" \| "ghost"`           | `"remove"`                       | What a popped bubble leaves behind: nothing, or a dashed ghost until the next `setData`.                                                 |
| `onOrbPop`           | `(orb) => void`                 | none                             | Runs once for every bubble that pops, with the orb as it was.                                                                            |
| `enterStyle`         | `"rise" \| "grow"`              | `"rise"`                         | How new bubbles enter: rise from below once the chart is seen, or grow from nothing.                                                     |
| `restoreOnNextPop`   | boolean                         | `true`                           | With `popOnClick`, a click first brings back the bubbles the user popped before.                                                         |
| `onOrbRestore`       | `(orb) => void`                 | none                             | Runs once for every bubble that comes back, with the new live orb.                                                                       |
| `transitionDuration` | number                          | `400`                            | Length in milliseconds of grow, shrink, and resize animations (a rise lasts twice as long). `0` snaps.                                   |
| `ariaLabel`          | string                          | `"Bubble chart"`                 | The chart's accessible name.                                                                                                             |
| `ariaDescription`    | string                          | none                             | A longer description for screen readers. Pass `""` to clear it.                                                                          |
| `reducedMotion`      | `"auto" \| "always" \| "never"` | `"auto"`                         | `"auto"` follows the system setting, `"always"` keeps bubbles still, `"never"` keeps them moving.                                        |
| `floatAmplitude`     | number                          | `2`                              | How far bubbles float up and down while idle, in pixels.                                                                                 |
| `floatSpeed`         | number                          | `0.002`                          | How fast bubbles float (per millisecond).                                                                                                |
| `damping`            | number                          | `0.95`                           | How quickly bubbles slow down (closer to 1 glides longer). Read once when the chart is created.                                          |
| `minVelocity`        | number                          | `0.01`                           | Below this speed, damping stops applying. Read once when the chart is created.                                                           |
| `bounceCoefficient`  | number                          | `0.6`                            | How much speed a bubble keeps when it bounces off an edge (0 to 1). Read once when the chart is created.                                 |

### Data format (`OrbDataInput`)

```typescript
interface OrbDataInput {
  id: string; // unique, used to match bubbles between updates
  label: string; // shown on the bubble, in the tooltip, and to screen readers (empty falls back to id for screen readers)
  value: number; // a finite number of 0 or more; sets the bubble size
  color?: string; // hex or rgb() color; otherwise taken from colorScheme
  imageUrl?: string; // image drawn inside the bubble
  metadata?: Record<string, unknown>; // your own data; metadata.category shows in the tooltip
}
```

### Skipped data (`OrbDataIssue`)

```typescript
interface OrbDataIssue {
  index: number; // position of the skipped entry in the array you passed
  id?: string; // the entry's id, when it had a string id
  reason: "invalid-id" | "invalid-label" | "invalid-value" | "duplicate-id";
}
```

New reasons may be added in a minor release, so keep a default branch in your handler.

### Exports

- `orbflow`: `OrbChart`, and the types `Orb`, `OrbChartConfig`, `OrbDataInput`, `OrbDataIssue`, `PhysicsConfig`.
- `orbflow/react`: `OrbChart` (component), the same types, plus `OrbChartProps` and `OrbChartHandle`.
- CDN script: `window.OrbFlow.OrbChart`.

All exports are named; there is no default export.

## Formatting values

`formatValue` turns a value into the text for it. One function feeds the canvas, the tooltip's `Value:` line, and the text screen readers hear, so the three always agree.

```js
new OrbChart("#chart", {
  formatValue: (value, orb) => `$${(value / 1e6).toFixed(1)}M`,
});
```

- An empty or whitespace only result hides the value everywhere.
- A function that throws is logged once and the plain number is used for that call.
- To go back to the plain number after setting one, pass `formatValue: String`. `undefined` is ignored, like every other option.
- In React, `formatValue` can change on every render. The newest function runs on the next draw and causes no update.
- Long text shrinks to fit the bubble, and is hidden when it would be under `minTextSize`. Image bubbles draw their value too, when the radius is at least 30 px.

## Performance

- Each bubble draws about ten gradients per frame. A few dozen bubbles stay smooth on a modern laptop. On older hardware (a 2015 dual core laptop in our tests), about 10 to 15 bubbles with images stay smooth.
- Fewer, larger bubbles are cheaper than many small ones. Lower `maxRadius` on small screens.
- Pause the chart when it is off screen ([recipe](#pause-when-off-screen-or-hidden)).
- In React, keep `data` stable (`useMemo` or state), so a render does not send new data.

## Known limitations

- With no `formatValue`, the value is the plain number, with no rounding, so a float such as `0.1 + 0.2` shows as `0.30000000000000004`. Format floats yourself.
- `formatValue` runs once per bubble per drawn frame, so keep it cheap. It must not call `updateConfig` or `setData`, and must not change the orb it receives.
- `theme: "auto"` treats `"transparent"`, named colors (like `"white"`), and `hsl()` as dark. On a light page behind a transparent chart, set `theme: "light"`.
- Labels look best in a rounded font, but the chart cannot load fonts. Load one on your page and pass it as `fontFamily`.
- Text is measured with the font loaded at the first draw, and the measurements are kept. Mount the chart after your font loads ([recipe](#wait-for-your-font)).
- The soap film and crescent are canvas approximations of the design and do not match it pixel for pixel. Browsers without `createConicGradient` skip the film.
- Popped bubbles are remembered until the next `setData` or `destroy()`, with no time limit.
- Bubbles still collide at their resting place while they rise, so a neighbor can be nudged by a bubble you cannot see yet. New bubbles pick the least crowded of a few random places to keep this small.
- The chart keeps running while it is off screen. Pausing it there automatically is planned; until then, use the [recipe](#pause-when-off-screen-or-hidden).
- Each bubble draws about ten gradients per frame. Very large charts may drop frames; a faster drawing cache is planned.

## Browser support

Current versions of Chrome, Edge, Firefox, and Safari (ES2020, Pointer Events, and `ResizeObserver`). Node 18 or newer for server rendering.

## Development

```bash
npm install            # install, and set up the pre commit hook
npm run dev            # watch build
npm run build          # build dist/
npm test               # unit tests (Jest)
npm run test:e2e       # builds, then runs the browser tests (Playwright, Chromium)
npm run lint           # ESLint
npm run typecheck      # tsc
npm run check:package  # publint, attw, and the dist check (after a build)
npm run size           # size budgets (after a build)
npm run smoke          # packs the tarball and installs it into test projects
```

## Roadmap

Before 1.0: docs and API reference, runnable examples, a live demo page, a speed pass for large charts (including pausing off screen), and the npm release.

Version 1.0 supports vanilla JavaScript and React. More frameworks arrive one per minor release, with no breaking changes:

- **1.1**: Vue
- **1.2**: Svelte
- **1.3**: Angular

## License

MIT © cascadingGeek
