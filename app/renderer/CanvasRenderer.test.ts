/**
 * @jest-environment jsdom
 */
import { CanvasRenderer } from "./CanvasRenderer";
import { installFakeCanvas, type FakeContext } from "../test-support/fakeDom";
import type { Orb } from "../types/types";

function makeOrb(overrides: Partial<Orb> = {}): Orb {
  return {
    id: "a",
    label: "Alpha",
    value: 40,
    radius: 30,
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    ...overrides,
  };
}

describe("CanvasRenderer", () => {
  let container: HTMLDivElement;
  let contexts: FakeContext[];

  beforeEach(() => {
    contexts = installFakeCanvas();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    jest.restoreAllMocks();
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
  });

  const canvas = () => container.querySelector("canvas") as HTMLCanvasElement;
  const calls = (method: string) =>
    contexts[0].calls.filter((call) => call.method === method);

  it("renders sharply on high density screens (devicePixelRatio 2)", () => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    const renderer = new CanvasRenderer(container, {});

    renderer.updateDimensions(300, 200);

    expect(canvas().width).toBe(600);
    expect(canvas().height).toBe(400);
    expect(canvas().style.width).toBe("300px");
    const scales = calls("scale");
    expect(scales[scales.length - 1]?.args).toEqual([2, 2]);
  });

  it("clears the whole canvas with the configured background first", () => {
    const renderer = new CanvasRenderer(container, {
      backgroundColor: "#ffffff",
    });
    renderer.updateDimensions(300, 200);

    renderer.render([makeOrb()]);

    expect(
      contexts[0].calls.find((c) => c.method === "fillRect")?.args,
    ).toEqual([0, 0, 300, 200]);
  });

  it("draws one bubble with its label and value for each orb", () => {
    const renderer = new CanvasRenderer(container, {});
    renderer.updateDimensions(300, 200);

    renderer.render([
      makeOrb({ id: "a", label: "Alpha", value: 40 }),
      makeOrb({ id: "b", label: "Beta", value: 25 }),
    ]);

    const text = calls("fillText").map((call) => call.args[0]);
    expect(text).toEqual(["Alpha", "40%", "Beta", "25%"]);
  });

  it("draws nothing but the background when there are no orbs", () => {
    const renderer = new CanvasRenderer(container, {});
    renderer.updateDimensions(300, 200);

    renderer.render([]);

    expect(calls("fillRect")).toHaveLength(1);
    expect(calls("arc")).toHaveLength(0);
  });

  // Known bug: images are cached before they load, and drawImage on a broken
  // image throws and stops the loop. Remove `.failing` once fixed.
  it.failing(
    "does not draw an orb image before it has finished loading",
    () => {
      const renderer = new CanvasRenderer(container, {});
      renderer.updateDimensions(300, 200);
      const orb = makeOrb({ imageUrl: "https://example.com/logo.png" });
      renderer.preloadImages([orb]);

      // jsdom never fetches the image, like a slow or broken URL in a browser,
      // where drawImage on a broken image throws and stops the render loop.
      renderer.render([orb]);

      expect(calls("drawImage")).toHaveLength(0);
    },
  );

  it("removes its canvas and tooltip on destroy", () => {
    const renderer = new CanvasRenderer(container, { enableTooltip: true });

    renderer.destroy();

    expect(container.children).toHaveLength(0);
  });
});
