# OrbFlow integration guide

OrbFlow draws a physics based bubble chart on a canvas. Bubbles look like soap bubbles, float, push each other apart, react to clicks and taps, and can burst into droplets. The core has zero runtime dependencies. A React component is included, and it works in Next.js (App Router and Pages Router) with server rendering.

This guide covers what OrbFlow can do, how to set it up in plain JavaScript, React, and Next.js, and the practices that keep a chart fast, accessible, and correct in production.

- [What you get](#what-you-get)
- [Install](#install)
- [Core ideas in two minutes](#core-ideas-in-two-minutes)
- [Vanilla JavaScript](#vanilla-javascript)
- [React](#react)
- [Next.js](#nextjs)
- [Popping bubbles](#popping-bubbles)
- [Bringing bubbles back](#bringing-bubbles-back)
- [Entering bubbles](#entering-bubbles)
- [Showing details on click](#showing-details-on-click)
- [Look and theming](#look-and-theming)
- [Images inside bubbles](#images-inside-bubbles)
- [Accessibility](#accessibility)
- [Performance](#performance)
- [Option reference](#option-reference)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## What you get

**The look**
- Soap bubbles with a clear center, a bright rim, a slowly turning soap film, a crescent highlight, and a small glint.
- Light and dark looks. `theme: "auto"` picks one from your `backgroundColor`.
- Images drawn inside a bubble like a lens, with the glass on top.
- Labels that always fit inside their bubble, and hide when the bubble is too small to read them.

**The data**
- Bubble *area* follows the value: a value twice as big gets twice the area. The largest value gets `maxRadius`; `minRadius` is a floor so tiny values stay visible.
- Smooth updates: `setData` matches bubbles by `id`, so existing bubbles keep their place and animate to a new size, new ones rise in from below, and removed ones shrink out.
- Bad entries (missing or duplicate `id`, a non string `label`, a negative or non numeric `value`) are skipped and reported to you, never thrown.

**The behavior**
- Bubbles never overlap. They float gently and bounce off the edges.
- Clicking or tapping empty space pushes nearby bubbles away. Clicking a bubble never scatters its neighbors.
- Built in tooltip on hover, tap, and keyboard focus. `onOrbClick` and `onOrbHover` let you show your own details.
- Popping: `chart.pop(id)`, or `popOnClick` for users. A pop bursts into droplets and can leave a dashed ghost.
- Restoring: `chart.restore()` brings popped bubbles back, rising to their old place. Call it when your details drawer closes.

**Production basics**
- Vanilla JavaScript and React 18 or 19, including server rendering and strict mode.
- Fills its container, follows resizes, and draws sharply on high density screens.
- A hidden list of real buttons for screen readers and the keyboard, plus "reduce motion" support.
- `destroy()` removes everything it added. ESM, CommonJS, a CDN script, and TypeScript types.

---

## Install

```bash
npm install orbflow
```

Two entry points:

| Import | For | What it gives you |
| --- | --- | --- |
| `orbflow` | any page, any framework | the `OrbChart` class |
| `orbflow/react` | React and Next.js | the `<OrbChart>` component, plus `OrbChartProps` and `OrbChartHandle` types |

Both are named exports only; there is no default export. Types for every option come with the package.

No build step? Use the CDN script, which exposes `window.OrbFlow.OrbChart`:

```html
<script src="https://unpkg.com/orbflow/dist/orbflow.iife.js"></script>
```

---

## Core ideas in two minutes

1. **The chart fills its container.** Give the container a real width and height (fixed pixels, or a parent with a height). A container with zero height draws nothing, and the chart waits until it gets a size.
2. **Data is a list of `{ id, label, value }`.** `id` must be unique and stable, because it is how bubbles are matched between updates. `value` must be a number of 0 or more.
3. **Your data is the source of truth.** Whatever you pass to `setData` (or the `data` prop) is what the chart shows. A popped bubble whose `id` is still in your next update comes back.
4. **Options can change at any time** with `updateConfig` (or new props in React). `undefined` means "keep the current value", never "reset to the default".
5. **Clean up.** In plain JavaScript, call `destroy()` when the chart leaves the page. The React component does this for you.

The data shape:

```ts
interface OrbDataInput {
  id: string; // unique and stable
  label: string; // drawn on the bubble, shown in the tooltip, read to screen readers
  value: number; // 0 or more; sets the bubble's area
  color?: string; // hex or rgb(); otherwise taken from colorScheme
  imageUrl?: string; // image drawn inside the bubble
  metadata?: Record<string, unknown>; // your own data; metadata.category shows in the tooltip
}
```

---

## Vanilla JavaScript

```html
<div id="chart" style="width: 100%; height: 480px"></div>
```

```js
import { OrbChart } from "orbflow";

const chart = new OrbChart("#chart", {
  backgroundColor: "#0a0e1a",
  onOrbClick: (orb) => console.log("clicked", orb.label, orb.metadata),
});

chart.setData([
  { id: "btc", label: "BTC", value: 45, color: "#f7931a" },
  { id: "eth", label: "ETH", value: 30, color: "#627eea" },
  { id: "sol", label: "SOL", value: 12, color: "#14f195" },
]);
```

`setData` starts the animation the first time. The rest of the methods:

| Method | What it does |
| --- | --- |
| `setData(data)` | Loads or updates data, matched by `id`. Clears ghosts and popped bubbles. |
| `updateConfig(partial)` | Changes options. Keys set to `undefined` are ignored. |
| `start()` / `pause()` | Resumes or pauses. A paused chart stays paused when data or options change, and shows each change as one still frame. |
| `pop(id)` | Bursts a live bubble. Returns `false` if there is no such bubble. |
| `restore(id?)` | Brings back the popped bubble `id`, or all of them. Returns `false` if nothing came back. |
| `getData()` | The current bubbles (`Orb[]`). These are live objects; treat them as read only. |
| `destroy()` | Removes the canvas, listeners, observers, and everything else. Safe to call twice. |

Live updates, for example from polling or a websocket:

```js
async function refresh() {
  const rows = await fetch("/api/markets").then((r) => r.json());
  chart.setData(rows.map((r) => ({ id: r.symbol, label: r.symbol, value: r.volume })));
}
setInterval(refresh, 30_000);
```

Bubbles that stay keep their place and resize smoothly; new ones rise in; missing ones shrink out.

Single page apps: call `chart.destroy()` when the view goes away, or you leave listeners and an animation loop running.

---

## React

```tsx
import { useMemo } from "react";
import { OrbChart } from "orbflow/react";

export function Markets({ rows }: { rows: Market[] }) {
  // Keep the array stable: a new array reference means a new setData.
  const data = useMemo(
    () => rows.map((r) => ({ id: r.symbol, label: r.symbol, value: r.volume, color: r.color })),
    [rows],
  );

  return (
    <div style={{ height: 480 }}>
      <OrbChart
        data={data}
        onOrbClick={(orb) => console.log(orb.label)}
        ariaLabel="Trading volume by market"
      />
    </div>
  );
}
```

How the component behaves, and what that means for you:

- **It fills its parent** (`width: 100%; height: 100%`). The parent needs a height. Pass `className` or `style` to change the container.
- **`data` is applied when its reference changes.** Build it with `useMemo` or keep it in state. Creating a new array on every render works, but it sends a `setData` on every render.
- **Callbacks can be inline.** `onOrbClick`, `onOrbHover`, `onDataIssue`, `onOrbPop`, and `onOrbRestore` always call your newest function, and a new function never updates or recreates the chart.
- **Options are compared by value.** Inline objects and arrays (like `colorScheme={["#f00", "#0f0"]}`) cost nothing when their values are equal.
- **Removing a prop keeps its last value.** To go back to a default, pass the default explicitly.
- **`damping`, `minVelocity`, and `bounceCoefficient` are read once**, when the chart is created.

Controlling the chart with a ref:

```tsx
import { useRef } from "react";
import { OrbChart, type OrbChartHandle } from "orbflow/react";

function Controls({ data }) {
  const chart = useRef<OrbChartHandle>(null);
  return (
    <>
      <div style={{ height: 480 }}>
        <OrbChart ref={chart} data={data} />
      </div>
      <button onClick={() => chart.current?.pause()}>Pause</button>
      <button onClick={() => chart.current?.start()}>Play</button>
      <button onClick={() => chart.current?.pop("btc")}>Pop BTC</button>
    </>
  );
}
```

The handle has `start()`, `pause()`, `getData()`, `pop(id)`, and `restore(id?)`. Every method is safe to call before mount or after unmount: `getData()` returns `[]`, and `pop()` and `restore()` return `false`. `pause()` called before the chart exists makes it start paused.

A failure while creating the chart (for example, no canvas support) is thrown to the nearest error boundary.

---

## Next.js

OrbFlow works with the App Router and the Pages Router, with Turbopack or webpack, and needs no special config. The React entry is already marked `"use client"`, and on the server it renders a single empty `div`; the canvas is created after hydration. You do **not** need `next/dynamic` with `ssr: false`.

### App Router: the recommended setup

Fetch data in a Server Component, and put the chart (with its callbacks) in a small Client Component.

```tsx
// app/markets/MarketBubbles.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { OrbChart, type OrbChartHandle } from "orbflow/react";
import type { OrbDataInput } from "orbflow/react";

export function MarketBubbles({ markets }: { markets: Market[] }) {
  const chart = useRef<OrbChartHandle>(null);
  const [selected, setSelected] = useState<Market | null>(null);

  const data = useMemo<OrbDataInput[]>(
    () =>
      markets.map((m) => ({
        id: m.symbol,
        label: m.symbol,
        value: m.volume,
        color: m.color,
        imageUrl: `/logos/${m.symbol.toLowerCase()}.png`, // from /public, same origin
        metadata: { category: m.sector },
      })),
    [markets],
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="h-[520px] rounded-2xl overflow-hidden">
        <OrbChart
          ref={chart}
          data={data}
          backgroundColor="#0a0e1a"
          ariaLabel="Trading volume by market"
          ariaDescription="Bigger bubbles mean more volume in the last 24 hours."
          enableTooltip={false}
          onOrbClick={(orb) =>
            setSelected(markets.find((m) => m.symbol === orb.id) ?? null)
          }
        />
      </div>
      {selected && <MarketPanel market={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
```

```tsx
// app/markets/page.tsx (a Server Component)
import { MarketBubbles } from "./MarketBubbles";

export default async function MarketsPage() {
  const markets = await getMarkets(); // database, API, cache, ...
  return <MarketBubbles markets={markets} />;
}
```

Why this split:
- **Functions cannot cross from server to client.** A Server Component may render `<OrbChart>` directly, but only with plain props (`data`, strings, numbers, booleans, arrays). As soon as you need `onOrbClick`, `onOrbPop`, a ref, or state, the chart must live in a file that starts with `"use client"`.
- **The page stays a Server Component**, so data fetching, caching, and secrets stay on the server.

The simplest possible case, with no callbacks, can stay in a Server Component:

```tsx
// app/page.tsx
import { OrbChart } from "orbflow/react";

export default async function Page() {
  const data = await getData();
  return (
    <div style={{ height: 400 }}>
      <OrbChart data={data} />
    </div>
  );
}
```

### Live data in Next.js

Refresh on the client, and keep `data` stable between updates:

```tsx
"use client";

import { useEffect, useState } from "react";
import { OrbChart } from "orbflow/react";

export function LiveBubbles({ initial }: { initial: OrbDataInput[] }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch("/api/markets", { cache: "no-store" });
      setData(await res.json()); // a new array only when new data arrives
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ height: 480 }}>
      <OrbChart data={data} />
    </div>
  );
}
```

Or call `router.refresh()` on an interval and let the Server Component pass new `initial` data down; turn it into state with a `useEffect` that calls `setData(initial)`.

### Fonts with `next/font`

The canvas cannot read CSS variables, so pass the real font family name. `next/font` gives it to you:

```tsx
// app/fonts.ts
import { Nunito } from "next/font/google";
export const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700"] });
```

```tsx
"use client";
import { nunito } from "../fonts";

<OrbChart data={data} fontFamily={nunito.style.fontFamily} />;
```

Load the label weights you need (labels use bold, values use 600).

The chart measures text the moment it first draws. If the font has not finished loading yet, those first measurements use the fallback font. To be safe, mount the chart once fonts are ready:

```tsx
"use client";
import { useEffect, useState } from "react";

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    document.fonts.ready.then(() => setReady(true));
  }, []);
  return ready;
}

export function Bubbles({ data }) {
  const fontsReady = useFontsReady();
  return (
    <div style={{ height: 480 }}>
      {fontsReady && <OrbChart data={data} fontFamily={nunito.style.fontFamily} />}
    </div>
  );
}
```

### Pages Router

Import and use the component in any page or component. No `"use client"` is needed; the server render is a single empty `div`.

```tsx
// pages/markets.tsx
import { OrbChart } from "orbflow/react";

export default function Markets({ data }) {
  return (
    <div style={{ height: 480 }}>
      <OrbChart data={data} />
    </div>
  );
}

export async function getServerSideProps() {
  return { props: { data: await getData() } };
}
```

### Next.js checklist

- The chart's parent has a height (`h-[480px]`, `style={{ height: 480 }}`, or a flex or grid cell that is sized).
- Callbacks, refs, and state live in a `"use client"` file.
- `data` is stable between renders (`useMemo` or state).
- Images come from `/public` or a host that sends CORS headers (see [Images inside bubbles](#images-inside-bubbles)).
- `next/image` is not used for bubble images; the canvas needs a plain URL.
- Fonts: pass `nunito.style.fontFamily`, not a CSS variable, and mount after `document.fonts.ready` if labels must be exact on first paint.

---

## Popping bubbles

```tsx
<OrbChart
  data={data}
  popOnClick // click, tap, Enter, or Space pops, after onOrbClick runs
  popStyle="ghost" // leave a dashed outline ("remove" leaves nothing)
  onOrbPop={(orb) => track("bubble_popped", { id: orb.id })}
/>
```

Or from code: `chart.pop("btc")` (vanilla) or `ref.current?.pop("btc")` (React). Both return `true` only when the bubble was live.

What happens:
- The bubble stretches, snaps, sends out a ring and droplets, and is gone in about 0.8 seconds. Neighbors drift gently into the gap.
- It leaves `getData()`, hit testing, and the screen reader list at once. `onOrbPop` runs exactly once.
- Screen readers hear "&lt;label&gt; popped". If the popped bubble had keyboard focus, focus moves to the next bubble.
- On a paused chart, or with "reduce motion" on, the pop is instant: no burst, nothing animates.
- Ghosts are not clickable. The next `setData` clears them.

**Keep popped bubbles gone.** Because your data is the source of truth, a popped `id` that is still in your next update grows back. If a pop should be permanent, remove it from your state:

```tsx
const [items, setItems] = useState(initial);

<OrbChart
  data={items}
  popOnClick
  onOrbPop={(orb) => setItems((prev) => prev.filter((i) => i.id !== orb.id))}
/>;
```

Note that changing `data` also clears ghosts and the list of popped bubbles, so `popStyle: "ghost"` pairs best with data you do not update on every pop.

---

## Bringing bubbles back

`restore()` makes popped bubbles rise back to the place they had. It works the same for both `popStyle` values (a ghost is removed as its bubble returns), and a restored bubble is a normal bubble again.

**A details drawer.** Pop the bubble when the user opens it, restore it when they close it:

```tsx
function Bubbles({ data }: { data: OrbDataInput[] }) {
  const chart = useRef<OrbChartHandle>(null);
  const [open, setOpen] = useState<Orb | null>(null);

  return (
    <>
      <OrbChart
        ref={chart}
        data={data}
        popOnClick // the clicked bubble pops, and the drawer opens
        restoreOnNextPop={false} // the drawer decides when bubbles return
        onOrbClick={(orb) => setOpen(orb)}
      />
      {open && (
        <Drawer
          orb={open}
          onClose={() => {
            setOpen(null);
            chart.current?.restore(); // every popped bubble rises back
          }}
        />
      )}
    </>
  );
}
```

**Without a drawer.** With `popOnClick`, `restoreOnNextPop` (on by default) brings back the bubble the user popped before, each time they click another one. Bubbles popped from code with `chart.pop(id)` are never brought back this way; call `restore(id)` for them.

Things to know:
- `restore(id)` returns `true` only for an id in the popped list that is not live. `restore()` without an id brings back all of them as one batch.
- **Keep `data` stable.** A new array identity on a parent re render calls `setData`, which clears the popped list and brings popped ids back as brand new bubbles. Build `data` with `useMemo` or keep it in state.
- A restored bubble gets its old size back (the size `setData` of the same data would give), and `onOrbRestore(orb)` runs once for each.
- Screen readers hear "&lt;label&gt; restored", "3 bubbles restored" for a batch, or "A restored, B popped" when a click did both.
- A paused or still chart shows the restored bubble in place, with no motion.

---

## Entering bubbles

New bubbles rise from below the bottom edge of the chart, in a loose stagger. The first rise waits until the chart scrolls into view (an `IntersectionObserver` watches the container), so a chart below the fold rises as the user reaches it, once. After that, each `setData` rises only its new bubbles.

- `enterStyle: "grow"` keeps the older grow in from nothing, with no waiting for scroll.
- A paused chart, a chart with "reduce motion" on, and `transitionDuration: 0` show bubbles in place with no rise.
- Without `IntersectionObserver` (very old browsers), the rise starts at once.

---

## Showing details on click

OrbFlow does not open a modal; a modal would cover the chart and break the playful feel. It hands you the clicked bubble, and you show details your way. Put extra fields in `metadata`; they come back on the clicked orb.

- **Floating card near the bubble:** good for quick stats. Use `event.offsetX` and `event.offsetY` from `onOrbClick(orb, event)`.
- **Side drawer:** good for richer details, and the safer choice for keyboard users. When Enter or Space activates a bubble, the event's offsets do not point at the bubble.

`onOrbClick` runs for mouse clicks, touch taps, and Enter or Space on a focused bubble, so one handler serves everyone. Set `enableTooltip={false}` if your card replaces the built in tooltip.

---

## Look and theming

| Situation | What to set |
| --- | --- |
| Dark page, solid background | nothing; the default is `backgroundColor: "#0a0e1a"` with the dark look |
| Light page, solid background | `backgroundColor: "#f5f0ff"` (any light hex or `rgb()`); `theme: "auto"` picks light |
| Chart over your own page background, gradient, or image | `backgroundColor: "transparent"` and an explicit `theme: "light"` or `"dark"` |
| App with a dark mode toggle | pass `theme={isDark ? "dark" : "light"}`; switching redraws once, even when paused |

`theme: "auto"` only understands hex and `rgb()` colors. `"transparent"`, named colors like `"white"`, and `hsl()` count as dark, so set `theme` yourself in those cases.

Bubble colors come from each item's `color`, or from `colorScheme` in order. Use hex or `rgb()`; anything else draws blue.

Size tuning: `maxRadius` (default 80) is the radius of the largest value. `minRadius` (default 8) is the floor. On small screens, lower `maxRadius` so everything fits:

```tsx
const isSmall = useMediaQuery("(max-width: 640px)");
<OrbChart data={data} maxRadius={isSmall ? 50 : 80} />;
```

---

## Images inside bubbles

```ts
{ id: "eth", label: "ETH", value: 30, imageUrl: "/logos/eth.png" }
```

- The image fills the inner circle, cropped to cover (never squashed), with a vignette and the glass drawn on top. The label moves low and the value line is hidden.
- Images load with `crossOrigin = "anonymous"`. Use same origin files (`/public` in Next.js) or a host that sends `Access-Control-Allow-Origin`. An image that fails to load is skipped, and the bubble draws without it.
- Square images look best. Logos with transparent backgrounds work well.
- Each URL is fetched once and cached for the life of the chart.

---

## Accessibility

The canvas is hidden from assistive technology. Instead, the chart keeps a visually hidden list with one real button per bubble ("BTC, value 45, category Layer 1"), so screen readers and keyboards work out of the box.

- **Name and describe the chart:** `ariaLabel` (default "Bubble chart") and `ariaDescription`.
- **Keyboard:** Tab into the chart, move with the arrow keys, Home, and End, press Enter or Space to activate, and Escape to hide the tooltip. A focus ring shows which bubble has focus.
- **Reduce motion:** `reducedMotion: "auto"` (default) follows the system setting. In still mode the bubbles settle once and stay put, and pops happen instantly. Use `"always"` or `"never"` to override.
- **Pops are announced** through a polite live region.

The hidden buttons are not positioned over the bubbles, so tools that click by screen position (some voice control apps) will not find them.

---

## Performance

- Each bubble draws about ten gradients per frame. On a recent laptop, dozens of bubbles stay smooth. On older hardware (a 2015 dual core laptop in our measurements), about 10 to 15 bubbles with images stay smooth, and 50 drop to roughly 22 frames per second. Measure on your target devices with the Chrome performance panel.
- Fewer, larger bubbles are cheaper than many small ones.
- Pause charts that are off screen or in hidden tabs; a paused chart draws nothing until something changes:

```tsx
useEffect(() => {
  const el = containerRef.current;
  const io = new IntersectionObserver(([entry]) =>
    entry.isIntersecting ? chart.current?.start() : chart.current?.pause(),
  );
  if (el) io.observe(el);
  return () => io.disconnect();
}, []);
```

- Keep `data` stable in React, so you do not send a `setData` on every render.
- Bundle size is about 14 kB gzip for the core and about 15 kB for the React entry, with zero runtime dependencies.

---

## Option reference

The React component takes the same options as props, plus `data`, `className`, `style`, and `ref`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `width`, `height` | number | container size | starting size; the chart then follows its container |
| `backgroundColor` | string | `"#0a0e1a"` | canvas background; `"transparent"` shows the page |
| `theme` | `"auto" \| "light" \| "dark"` | `"auto"` | bubble look; auto reads `backgroundColor` |
| `fontFamily` | string | `"Inter, system-ui, sans-serif"` | label font; load it on the page first |
| `minRadius` | number | `8` | smallest radius in pixels (a floor) |
| `maxRadius` | number | `80` | radius of the largest value |
| `colorScheme` | string[] | 8 blues and purples | colors for bubbles without their own `color` |
| `enableTooltip` | boolean | `true` | the built in tooltip |
| `onOrbClick` | `(orb, event) => void` | none | click, tap, Enter, or Space on a bubble |
| `onOrbHover` | `(orb \| null) => void` | none | hovered bubble changed |
| `onDataIssue` | `(issues) => void` | none | `setData` skipped bad entries |
| `popOnClick` | boolean | `false` | activating a bubble pops it |
| `popStyle` | `"remove" \| "ghost"` | `"remove"` | what a pop leaves behind |
| `onOrbPop` | `(orb) => void` | none | a bubble popped |
| `enterStyle` | `"rise" \| "grow"` | `"rise"` | how new bubbles enter |
| `restoreOnNextPop` | boolean | `true` | with `popOnClick`, a click first brings back what the user popped before |
| `onOrbRestore` | `(orb) => void` | none | a bubble came back |
| `transitionDuration` | number | `400` | grow, shrink, and resize animation length in ms (a rise lasts twice as long); `0` snaps |
| `ariaLabel` | string | `"Bubble chart"` | accessible name |
| `ariaDescription` | string | none | longer description for screen readers |
| `reducedMotion` | `"auto" \| "always" \| "never"` | `"auto"` | still mode |
| `floatAmplitude` | number | `2` | idle float distance in pixels |
| `floatSpeed` | number | `0.002` | idle float speed |
| `damping` | number | `0.95` | how quickly bubbles slow down (read once) |
| `minVelocity` | number | `0.01` | below this speed, damping stops (read once) |
| `bounceCoefficient` | number | `0.6` | speed kept after an edge bounce (read once) |

Invalid values for `minRadius`, `transitionDuration`, `fontFamily`, `theme`, `popStyle`, `enterStyle`, `restoreOnNextPop`, and `reducedMotion` fall back to their defaults with a console warning.

---

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Nothing shows | The container has no height. Give it (or its parent) an explicit height. |
| Next.js error "Functions cannot be passed directly to Client Components" | A callback is passed from a Server Component. Move the chart into a `"use client"` file. |
| The chart resets or flickers on every render | `data` is a new array every render. Use `useMemo` or state. |
| A popped bubble comes back | Its `id` is still in your data and `setData` ran again, or `restoreOnNextPop` brought it back. Remove it in `onOrbPop`, or set `restoreOnNextPop: false`. |
| Images do not appear | The host does not send CORS headers, or the URL is wrong. Serve from `/public` or a CORS enabled CDN. |
| Labels are dark on a dark background | `backgroundColor` is a named color, `hsl()`, or `"transparent"`, so `theme: "auto"` guessed wrong. Set `theme` explicitly. |
| Labels use the wrong font | `fontFamily` is a CSS variable, or the font is not loaded. Pass the real family name (`nunito.style.fontFamily`) and wait for `document.fonts.ready`. |
| Some entries are missing | They were skipped as invalid. Log them with `onDataIssue`. |
| Choppy animation with many bubbles | See [Performance](#performance): fewer bubbles, smaller `maxRadius`, pause when off screen. |

---

## Known limitations

- The value drawn on a bubble always ends with `%`. The tooltip and screen reader text show the plain number. A `formatValue` option is planned.
- `theme: "auto"` treats `"transparent"`, named colors, and `hsl()` as dark.
- The chart cannot load fonts; load them yourself and pass `fontFamily`.
- The soap film and crescent are canvas approximations of the design and do not match it pixel for pixel. Browsers without `createConicGradient` skip the film.
- Large charts on older hardware may drop frames; a faster drawing cache is planned.
- Popped bubbles are remembered until the next `setData` or `destroy()`, with no time limit.
- Bubbles collide at their resting place while they rise, so a neighbor can be nudged by a bubble you cannot see yet.
- The chart keeps running while it is off screen. Pausing it there is planned.
- Hover squish, idle wobble, and dragging bubbles are planned for after 1.0.
