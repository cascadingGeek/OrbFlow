import { expect, test } from "@playwright/test";
import {
  SPOTS,
  THREE,
  openChart,
  place,
  recording,
  resetRecording,
} from "@test/e2e/helpers";

// The burst, ghosts, and idle pops on the loop clock in real Chrome (spec 0005).

test.describe("pop (AC-8)", () => {
  test("pops a live bubble once, and reports it once", async ({ page }) => {
    await openChart(page, {}, THREE);

    const results = await page.evaluate(() => [
      window.chart.pop("a"),
      window.chart.pop("a"),
      window.chart.pop("missing"),
    ]);

    expect(results).toEqual([true, false, false]);
    expect(await page.evaluate(() => window.events)).toEqual(["pop a"]);
    expect(
      await page.evaluate(() => window.chart.getData().map((o) => o.id)),
    ).toEqual(["b", "c"]);
    await expect(page.getByRole("button")).toHaveCount(2);
  });

  test("nudges the neighbors into the gap while moving", async ({ page }) => {
    await openChart(page, {}, THREE);
    await place(page, { ...SPOTS, b: { x: 220, y: 150 } });

    await page.evaluate(() => window.chart.pop("a"));

    const vx = await page.evaluate(
      () => window.chart.getData().find((o) => o.id === "b")?.vx,
    );
    expect(vx).toBeGreaterThan(0);
  });
});

test.describe("burst timeline while moving (AC-10, AC-12)", () => {
  test.beforeEach(async ({ page }) => {
    await openChart(page, { popStyle: "ghost", floatAmplitude: 0 }, THREE);
    await place(page, SPOTS);
    await resetRecording(page);
    await page.evaluate(() => window.chart.pop("a"));
  });

  test("throws droplets mid burst and is over by about 780 ms", async ({
    page,
  }) => {
    await page.clock.runFor(300);
    expect((await recording(page)).drops).toBeGreaterThan(0);

    await page.clock.runFor(500);
    await resetRecording(page);
    await page.clock.runFor(100);

    expect((await recording(page)).drops).toBe(0);
  });

  test("leaves a dashed ghost that stays after the burst", async ({ page }) => {
    // Before 180 ms the ghost has not started to fade in.
    await page.clock.runFor(100);
    await resetRecording(page);
    await page.clock.runFor(50);
    const early = await recording(page);
    expect(early.clears).toBeGreaterThan(0);
    expect(early.dash).toBe(0);

    // Long after the burst, every frame draws the one ghost.
    await page.clock.runFor(1000);
    await resetRecording(page);
    await page.clock.runFor(100);
    const late = await recording(page);
    expect(late.clears).toBeGreaterThan(0);
    expect(late.dash).toBe(late.clears);
  });

  test("the next setData clears ghosts and a popped id grows back with enterStyle grow", async ({
    page,
  }) => {
    await page.clock.runFor(1000);
    await page.evaluate(() => {
      window.chart.updateConfig({
        transitionDuration: 400,
        enterStyle: "grow",
      });
      window.chart.setData([
        { id: "a", label: "Alpha", value: 100 },
        { id: "b", label: "Beta", value: 50 },
      ]);
    });
    await resetRecording(page);

    await page.clock.runFor(100);

    expect((await recording(page)).dash).toBe(0);
    const a = await page.evaluate(
      () => window.chart.getData().find((o) => o.id === "a")?.radius ?? 0,
    );
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(80);
  });
});

test.describe("idle pops (AC-11)", () => {
  test("a paused chart pops in one draw and stays still", async ({ page }) => {
    await openChart(page, {}, THREE);
    await page.evaluate(() => window.chart.pause());
    await resetRecording(page);

    await page.evaluate(() => window.chart.pop("a"));
    await page.clock.runFor(1000);

    expect(await recording(page)).toMatchObject({ clears: 1, drops: 0 });
  });

  test("a popped bubble does not come back on start()", async ({ page }) => {
    await openChart(page, {}, THREE);
    await page.evaluate(() => {
      window.chart.pause();
      window.chart.pop("a");
      window.chart.start();
    });
    await page.clock.runFor(500);

    expect(
      await page.evaluate(() => window.chart.getData().map((o) => o.id)),
    ).toEqual(["b", "c"]);
  });

  test("pause() mid burst ends it in one draw", async ({ page }) => {
    await openChart(page, {}, THREE);
    await page.evaluate(() => window.chart.pop("a"));
    await page.clock.runFor(100);
    await resetRecording(page);

    await page.evaluate(() => window.chart.pause());
    await page.clock.runFor(1000);

    expect(await recording(page)).toMatchObject({ clears: 1, drops: 0 });
  });

  test.describe("with the system set to reduce motion", () => {
    // Only contextOptions reaches the page; a top level reducedMotion is ignored.
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("a pop is instant: one draw, no droplets, no frames", async ({
      page,
    }) => {
      await openChart(page, {}, THREE);
      await resetRecording(page);

      await page.evaluate(() => window.chart.pop("b"));
      await page.clock.runFor(1000);

      expect(await recording(page)).toMatchObject({ clears: 1, drops: 0 });
    });
  });
});

test("destroy() leaves nothing behind, even mid burst (AC-16)", async ({
  page,
}) => {
  await openChart(page, { popStyle: "ghost" }, THREE);
  await page.evaluate(() => window.chart.pop("a"));
  await page.clock.runFor(100);

  await page.evaluate(() => {
    window.chart.destroy();
    window.chart.destroy();
  });
  await resetRecording(page);
  await page.clock.runFor(1000);

  await expect(page.locator("#chart > *")).toHaveCount(0);
  expect((await recording(page)).clears).toBe(0);
});
