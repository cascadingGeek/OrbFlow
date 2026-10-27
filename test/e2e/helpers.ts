import type { Page } from "@playwright/test";
import type { OrbChart, OrbChartConfig, OrbDataInput } from "@/index";

/** What the recorder saw the canvas draw since the last reset. */
export interface Recording {
  text: { t: string; y: number; font: string; fill: string; w: number }[];
  img: number[][];
  conic: number[];
  drops: number;
  dash: number;
  clears: number;
}

declare global {
  interface Window {
    OrbFlow: { OrbChart: typeof OrbChart };
    chart: OrbChart;
    events: string[];
    rec: Recording;
  }
}

/**
 * Wraps the canvas methods the bubble look uses, so a test can read what was
 * drawn. Runs in the page before any script.
 */
export function recordCanvas() {
  const fresh = (): Recording => ({
    text: [],
    img: [],
    conic: [],
    drops: 0,
    dash: 0,
    clears: 0,
  });
  window.rec = fresh();
  const proto = CanvasRenderingContext2D.prototype as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  const wrap = (
    name: string,
    see: (ctx: CanvasRenderingContext2D, args: unknown[]) => void,
  ) => {
    const original = proto[name];
    proto[name] = function (this: CanvasRenderingContext2D, ...args) {
      see(this, args);
      return original.apply(this, args);
    };
  };
  wrap("fillText", (ctx, a) =>
    window.rec.text.push({
      t: String(a[0]),
      y: Number(a[2]),
      font: ctx.font,
      fill: String(ctx.fillStyle),
      w: ctx.measureText(String(a[0])).width,
    }),
  );
  wrap("drawImage", (_, a) => window.rec.img.push(a.slice(1) as number[]));
  wrap("createConicGradient", (_, a) => window.rec.conic.push(Number(a[0])));
  // A droplet's gradient is focused up and left of its own center.
  wrap("createRadialGradient", (_, a) => {
    if (Number(a[0]) < 0 && Number(a[1]) < 0) window.rec.drops++;
  });
  wrap("setLineDash", (_, a) => {
    if ((a[0] as number[]).length) window.rec.dash++;
  });
  wrap("clearRect", () => window.rec.clears++);
}

/** Forgets what was drawn so far. */
export const resetRecording = (page: Page) =>
  page.evaluate(() => {
    window.rec.text = [];
    window.rec.img = [];
    window.rec.conic = [];
    window.rec.drops = 0;
    window.rec.dash = 0;
    window.rec.clears = 0;
  });

/** Reads what was drawn since the last reset. */
export const recording = (page: Page) => page.evaluate(() => window.rec);

/**
 * Opens the vanilla fixture with a paused clock, creates a 400×300 chart that
 * records clicks and pops in `window.events`, and waits for its first draw.
 */
export async function openChart(
  page: Page,
  config: OrbChartConfig = {},
  data: OrbDataInput[] = [],
) {
  await page.addInitScript(recordCanvas);
  // Pause ahead of now: a pause in the past throws if any real time slipped by.
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(10_000);
  await page.goto(new URL("./fixtures/vanilla.html", import.meta.url).href);
  await page.evaluate(
    ([cfg, rows]) => {
      const el = document.createElement("div");
      el.id = "chart";
      el.style.cssText = "width:400px;height:300px;position:relative";
      document.getElementById("host")?.appendChild(el);
      window.events = [];
      window.chart = new window.OrbFlow.OrbChart(el, {
        transitionDuration: 0,
        onOrbClick: (orb) => window.events.push(`click ${orb.id}`),
        onOrbPop: (orb) => window.events.push(`pop ${orb.id}`),
        ...cfg,
      });
      window.chart.setData(rows);
    },
    [config, data] as const,
  );
  // Observers run in creation order, so this one fires right after the chart's.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const watcher = new ResizeObserver(() => {
          watcher.disconnect();
          resolve(null);
        });
        const el = document.getElementById("chart");
        if (el) watcher.observe(el);
      }),
  );
}

/** Puts orbs at fixed spots and stops them, so pointer tests can aim. */
export const place = (
  page: Page,
  spots: Record<string, { x: number; y: number }>,
) =>
  page.evaluate((s) => {
    for (const orb of window.chart.getData()) {
      if (s[orb.id]) Object.assign(orb, s[orb.id], { vx: 0, vy: 0 });
    }
  }, spots);

/** A page point for a canvas point. */
export async function onCanvas(page: Page, x: number, y: number) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("no canvas on the page");
  return [box.x + x, box.y + y] as const;
}

/** Three orbs whose radii are 80, about 56.6, and 40 with the defaults. */
export const THREE: OrbDataInput[] = [
  { id: "a", label: "Alpha", value: 100, color: "#627eea" },
  { id: "b", label: "Beta", value: 50, color: "#f7931a" },
  { id: "c", label: "Gamma", value: 25, color: "#14b8a6" },
];

/** Spots for THREE that do not overlap inside the 400×300 chart. */
export const SPOTS = {
  a: { x: 100, y: 150 },
  b: { x: 260, y: 150 },
  c: { x: 345, y: 55 },
};
