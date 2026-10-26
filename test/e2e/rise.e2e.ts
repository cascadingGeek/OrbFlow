import { expect, test, type Page } from "@playwright/test";
import { SPOTS, THREE, onCanvas, openChart, place } from "./helpers";

// Bubbles rising from below, the scroll gate, and restore, on the loop clock
// in real Chrome (spec 0006). Time moves only with `page.clock.runFor`.

declare global {
  interface Window {
    bodies: { y: number; r: number }[];
  }
}

// Records the center of every bubble body (the arc at 0.97 of its radius)
// drawn in the latest frame.
function recordBodies() {
  window.bodies = [];
  const proto = CanvasRenderingContext2D.prototype;
  const clear = proto.clearRect;
  const arc = proto.arc;
  proto.clearRect = function (...a: Parameters<typeof clear>) {
    window.bodies = [];
    return clear.apply(this, a);
  };
  proto.arc = function (
    x: number,
    y: number,
    r: number,
    ...rest: [number, number, boolean?]
  ) {
    window.bodies.push({ y, r });
    return arc.call(this, x, y, r, ...rest);
  };
}

/** Drawn center minus resting place of each bubble, by id, in the last frame. */
const offsets = (page: Page) =>
  page.evaluate(() => {
    const result: Record<string, number> = {};
    for (const orb of window.chart.getData()) {
      const body = window.bodies.find(
        (b) => Math.abs(b.r - 0.97 * orb.radius) < 1e-6,
      );
      result[orb.id] = body ? body.y - orb.y : Number.NaN;
    }
    return result;
  });

const TIMED = { transitionDuration: 400, maxRadius: 40 } as const;
// A float wobble of 2 px is part of being at rest.
const atRest = (o: Record<string, number>) =>
  Object.values(o).every((v) => Math.abs(v) <= 2.01);
const below = (o: Record<string, number>) =>
  Object.values(o).every((v) => v > 20);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(recordBodies);
});

test.describe("the rise (AC-2, AC-6)", () => {
  test("starts below the chart and settles at the resting place, once", async ({
    page,
  }) => {
    await openChart(page, TIMED, THREE);
    await place(page, SPOTS);

    await page.clock.runFor(32);
    expect(below(await offsets(page))).toBe(true);

    await page.clock.runFor(2500);
    expect(atRest(await offsets(page))).toBe(true);
    await page.clock.runFor(2000);
    expect(atRest(await offsets(page))).toBe(true);
  });

  test("keeps the real place while rising, so getData never moves it", async ({
    page,
  }) => {
    await openChart(page, TIMED, THREE);
    await place(page, SPOTS);

    await page.clock.runFor(32);

    const a = await page.evaluate(() =>
      window.chart.getData().find((o) => o.id === "a"),
    );
    expect(a?.y).toBeLessThan(300);
    expect(a?.radius).toBeGreaterThan(0);
  });

  test("a chart set to grow does not rise", async ({ page }) => {
    await openChart(page, { ...TIMED, enterStyle: "grow" }, THREE);
    await place(page, SPOTS);

    await page.clock.runFor(32);

    expect(atRest(await offsets(page))).toBe(true);
  });

  test("a paused chart shows new bubbles in place and does not replay on start", async ({
    page,
  }) => {
    await openChart(page, TIMED, THREE);
    await page.evaluate(() => window.chart.pause());

    await page.evaluate(() =>
      window.chart.setData([
        { id: "a", label: "A", value: 10 },
        { id: "z", label: "Z", value: 5 },
      ]),
    );
    expect(atRest(await offsets(page))).toBe(true);
    await page.evaluate(() => window.chart.start());
    await page.clock.runFor(32);
    expect(atRest(await offsets(page))).toBe(true);
  });

  test("a system set to reduce motion shows everything in place", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openChart(page, TIMED, THREE);

    expect(atRest(await offsets(page))).toBe(true);
    await page.evaluate(() => {
      window.chart.pop("a");
      window.chart.restore("a");
    });
    expect(atRest(await offsets(page))).toBe(true);
  });
});

test.describe("the scroll gate (AC-3)", () => {
  test.beforeEach(async ({ page }) => {
    // Push the chart far below the 700 px viewport.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const spacer = document.createElement("div");
        spacer.style.height = "2500px";
        document.getElementById("host")?.before(spacer);
      });
    });
  });

  const untilSeen = async (page: Page, seen: () => Promise<boolean>) => {
    for (let i = 0; i < 40 && !(await seen()); i++) {
      await page.waitForTimeout(25);
      await page.clock.runFor(100);
    }
  };

  test("waits below the canvas until the chart scrolls into view, rises once, never replays", async ({
    page,
  }) => {
    await openChart(page, TIMED, THREE);
    await place(page, SPOTS);

    await page.clock.runFor(5000);
    const waiting = await offsets(page);
    expect(below(waiting)).toBe(true);
    expect(await page.evaluate(() => window.chart.getData().length)).toBe(3);

    await page.evaluate(() => window.scrollTo(0, 2300));
    await untilSeen(page, async () => !below(await offsets(page)));
    expect(below(await offsets(page))).toBe(false);
    await page.clock.runFor(3000);
    expect(atRest(await offsets(page))).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.clock.runFor(200);
    await page.evaluate(() => window.scrollTo(0, 2300));
    await page.waitForTimeout(100);
    await page.clock.runFor(200);
    expect(atRest(await offsets(page))).toBe(true);
  });
});

test.describe("restore (AC-7, AC-10)", () => {
  test("clicking a second bubble brings the first back by rising, then pops the second", async ({
    page,
  }) => {
    await openChart(page, { ...TIMED, popOnClick: true }, THREE);
    await page.clock.runFor(2500);
    await place(page, SPOTS);

    await page.mouse.click(...(await onCanvas(page, SPOTS.a.x, SPOTS.a.y)));
    await page.mouse.click(...(await onCanvas(page, SPOTS.b.x, SPOTS.b.y)));

    const ids = await page.evaluate(() =>
      window.chart.getData().map((o) => o.id),
    );
    expect(ids).toEqual(["a", "c"]);
    expect(await page.evaluate(() => window.events)).toEqual([
      "click a",
      "pop a",
      "click b",
      "pop b",
    ]);
    await page.clock.runFor(32);
    const rising = await offsets(page);
    expect(rising.a).toBeGreaterThan(20);
    expect(Math.abs(rising.c)).toBeLessThanOrEqual(2.01);

    await page.clock.runFor(2500);
    expect(atRest(await offsets(page))).toBe(true);
    await expect(page.locator("[aria-live]")).toHaveText(
      "Alpha restored, Beta popped",
    );
  });

  test("restore() from a drawer's close handler brings every popped bubble back, for both popStyle values", async ({
    page,
  }) => {
    for (const popStyle of ["remove", "ghost"] as const) {
      await openChart(page, { ...TIMED, popStyle }, THREE);
      await page.clock.runFor(2500);
      await page.evaluate(() => {
        window.chart.pop("a");
        window.chart.pop("b");
      });
      await page.clock.runFor(1000);

      const restored = await page.evaluate(() => window.chart.restore());

      expect(restored).toBe(true);
      expect(
        await page.evaluate(() => window.chart.getData().map((o) => o.id)),
      ).toEqual(["a", "b", "c"]);
      await expect(page.locator("[aria-live]")).toHaveText(
        "2 bubbles restored",
      );
      await page.clock.runFor(32);
      expect(Object.values(await offsets(page)).some((v) => v > 20)).toBe(true);
      await page.clock.runFor(2500);
      expect(atRest(await offsets(page))).toBe(true);
    }
  });

  test("restore returns false for a live bubble, a bubble never popped, and twice", async ({
    page,
  }) => {
    await openChart(page, TIMED, THREE);

    const results = await page.evaluate(() => {
      window.chart.pop("a");
      return [
        window.chart.restore("c"),
        window.chart.restore("missing"),
        window.chart.restore("a"),
        window.chart.restore("a"),
      ];
    });

    expect(results).toEqual([false, false, true, false]);
  });
});
