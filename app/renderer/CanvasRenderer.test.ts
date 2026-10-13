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

  describe("orb images", () => {
    let images: HTMLImageElement[];

    beforeEach(() => {
      images = [];
      jest.spyOn(window, "Image").mockImplementation(() => {
        const img = document.createElement("img");
        images.push(img);
        return img;
      });
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    const imageOrb = makeOrb({ imageUrl: "https://example.com/logo.png" });

    it("does not draw an orb image before it has finished loading", () => {
      const renderer = new CanvasRenderer(container, {});
      renderer.updateDimensions(300, 200);
      renderer.preloadImages([imageOrb]);

      // In a browser, drawImage on a broken image throws and stops the loop.
      renderer.render([imageOrb]);

      expect(calls("drawImage")).toHaveLength(0);
    });

    it("draws the image once it has loaded", () => {
      const renderer = new CanvasRenderer(container, {});
      renderer.updateDimensions(300, 200);
      renderer.preloadImages([imageOrb]);

      images[0].onload?.(new Event("load"));
      renderer.render([imageOrb]);

      expect(calls("drawImage")).toHaveLength(1);
      expect(calls("drawImage")[0].args[0]).toBe(images[0]);
    });

    it("never draws a broken image and requests it only once", () => {
      const renderer = new CanvasRenderer(container, {});
      renderer.updateDimensions(300, 200);

      renderer.render([imageOrb]);
      images[0].onerror?.(new Event("error"));
      renderer.render([imageOrb]);
      renderer.render([imageOrb]);

      expect(calls("drawImage")).toHaveLength(0);
      expect(images).toHaveLength(1);
    });
  });

  it("removes its canvas and tooltip on destroy", () => {
    const renderer = new CanvasRenderer(container, { enableTooltip: true });

    renderer.destroy();

    expect(container.children).toHaveLength(0);
  });
});
