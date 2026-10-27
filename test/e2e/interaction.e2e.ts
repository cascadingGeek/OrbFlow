import { expect, test, type Page } from "@playwright/test";
import { SPOTS, THREE, onCanvas, openChart, place } from "@test/e2e/helpers";

// Pointer, keyboard, and screen reader behavior in real Chrome (spec 0005).

const cursor = (page: Page) =>
  page.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).style.cursor);
const velocities = (page: Page) =>
  page.evaluate(() => window.chart.getData().map((o) => [o.vx, o.vy]));

test.beforeEach(async ({ page }) => {
  await openChart(page, {}, THREE);
  await page.evaluate(() => window.chart.pause());
  await place(page, SPOTS);
});

test("the hand cursor shows only over a live bubble (AC-1)", async ({
  page,
}) => {
  const seen = [await cursor(page)];
  for (const [x, y] of [
    [100, 150],
    [20, 280],
    [260, 150],
  ]) {
    await page.mouse.move(...(await onCanvas(page, x, y)));
    seen.push(await cursor(page));
  }
  await page.mouse.move(890, 690);
  seen.push(await cursor(page));

  expect(seen).toEqual(["default", "pointer", "default", "pointer", "default"]);
});

test("a bubble that pops under the pointer drops the hand (AC-1)", async ({
  page,
}) => {
  await page.mouse.move(...(await onCanvas(page, 100, 150)));
  await expect.poll(() => cursor(page)).toBe("pointer");

  await page.evaluate(() => window.chart.pop("a"));

  expect(await cursor(page)).toBe("default");
});

test("clicking a bubble calls onOrbClick and scatters nothing (AC-2)", async ({
  page,
}) => {
  await page.mouse.click(...(await onCanvas(page, 100, 150)));

  expect(await page.evaluate(() => window.events)).toEqual(["click a"]);
  expect((await velocities(page)).flat().every((v) => v === 0)).toBe(true);
});

test("clicking empty space pushes nearby bubbles (AC-2)", async ({ page }) => {
  await page.mouse.click(...(await onCanvas(page, 200, 270)));

  expect(await page.evaluate(() => window.events)).toEqual([]);
  expect((await velocities(page)).flat().some((v) => v !== 0)).toBe(true);
});

test("without popOnClick a click never pops (AC-9)", async ({ page }) => {
  await page.mouse.click(...(await onCanvas(page, 100, 150)));

  expect(await page.evaluate(() => window.chart.getData().length)).toBe(3);
});

test.describe("popOnClick (AC-9, AC-13)", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => window.chart.updateConfig({ popOnClick: true }));
  });

  test("a click reports the bubble, then pops it", async ({ page }) => {
    await page.mouse.click(...(await onCanvas(page, 100, 150)));

    expect(await page.evaluate(() => window.events)).toEqual([
      "click a",
      "pop a",
    ]);
  });

  test("Tab then Enter pops the focused bubble and focus moves on", async ({
    page,
  }) => {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Alpha/ })).toBeFocused();

    await page.keyboard.press("Enter");

    expect(await page.evaluate(() => window.events)).toEqual([
      "click a",
      "pop a",
    ]);
    await expect(page.getByRole("button", { name: /^Beta/ })).toBeFocused();
    await expect(page.getByRole("button", { name: /^Alpha/ })).toHaveCount(0);
  });

  test("Space pops too", async ({ page }) => {
    await page.getByRole("button", { name: /^Gamma/ }).focus();

    await page.keyboard.press("Space");

    expect(await page.evaluate(() => window.events)).toEqual([
      "click c",
      "pop c",
    ]);
  });
});

test("each pop is announced in a polite region beside the list (AC-13)", async ({
  page,
}) => {
  await page.evaluate(() => window.chart.pop("b"));

  const region = page.locator("#chart > [aria-live='polite']");
  await expect(region).toHaveText("Beta popped");
  await expect(page.locator("ul [aria-live]")).toHaveCount(0);
  await expect(page.locator("#chart")).toMatchAriaSnapshot(`
    - list "Bubble chart":
      - listitem:
        - button /Alpha/
      - listitem:
        - button /Gamma/
    - text: Beta popped
  `);
});

test("a second pop with the same label is still a change (AC-13)", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.chart.pop("a");
    window.chart.setData([{ id: "a", label: "Alpha", value: 1 }]);
    window.chart.pop("a");
  });

  await expect(page.locator("[aria-live]")).toHaveText("Alpha popped ");
});
