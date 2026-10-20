import { expect, test } from "@playwright/test";

// The React component from dist/react.mjs in real Chrome (spec 0005 AC-14).

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(new URL("./fixtures/react.html", import.meta.url).href);
  await expect(page.locator("canvas")).toHaveCount(1);
});

// No React warning or page error in any test.
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test("ref.pop pops once, then returns false", async ({ page }) => {
  const results = await page.evaluate(() => [
    window.handle.current?.pop("a"),
    window.handle.current?.pop("a"),
  ]);

  expect(results).toEqual([true, false]);
  expect(
    await page.evaluate(() =>
      window.handle.current?.getData().map((o) => o.id),
    ),
  ).toEqual(["b"]);
  await expect(page.locator("[aria-live]")).toHaveText("Alpha popped");
});

test("the newest inline onOrbPop runs, and a rerender never remounts", async ({
  page,
}) => {
  const canvas = await page.locator("canvas").elementHandle();
  await page.evaluate(() => {
    window.rerender();
    window.rerender();
  });
  await page.waitForFunction(() => document.querySelector("canvas") !== null);

  await page.evaluate(() => window.handle.current?.pop("b"));

  expect(await page.evaluate(() => window.popLog)).toEqual(["b@2"]);
  expect(
    await page.evaluate((c) => c === document.querySelector("canvas"), canvas),
  ).toBe(true);
});

test("popOnClick from props pops on click", async ({ page }) => {
  const [a] = await page.evaluate(() =>
    (window.handle.current?.getData() ?? []).map((o) => ({ x: o.x, y: o.y })),
  );
  const box = await page.locator("canvas").boundingBox();
  if (!box || !a) throw new Error("no chart");

  await page.evaluate(() => window.handle.current?.pop("b"));
  await page.mouse.click(box.x + a.x, box.y + a.y);

  await expect.poll(() => page.evaluate(() => window.popLog.length)).toBe(2);
});
