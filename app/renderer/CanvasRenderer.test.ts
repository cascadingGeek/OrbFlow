/**
 * @jest-environment jsdom
 */
import { CanvasRenderer } from "./CanvasRenderer";
import { ImageCache } from "./ImageCache";
import { installFakeCanvas, type FakeContext } from "../test-support/fakeDom";
import type { Orb } from "../types/types";

const at = (elapsed: number) => ({ now: 0, elapsed, moving: true });

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

  it("clears the canvas, then fills the configured background", () => {
    const renderer = new CanvasRenderer(container, {
      backgroundColor: "#ffffff",
    });
    renderer.updateDimensions(300, 200);

    renderer.render([makeOrb()]);

    // covers: AC-5 (clear first, so a transparent background shows the page)
    const order = contexts[0].calls.map((c) => c.method);
    expect(order.indexOf("clearRect")).toBeLessThan(order.indexOf("fillRect"));
    expect(calls("clearRect")[0].args).toEqual([0, 0, 300, 200]);
    expect(calls("fillRect")[0].args).toEqual([0, 0, 300, 200]);
  });

  describe("theme (AC-5)", () => {
    const labelFills = (config: Record<string, unknown>) => {
      const renderer = new CanvasRenderer(container, config);
      const ctx = contexts[contexts.length - 1];
      const fills: unknown[] = [];
      const fillText = ctx.fillText as (...a: unknown[]) => void;
      ctx.fillText = (...a: unknown[]) => {
        fills.push(ctx.fillStyle);
        fillText(...a);
      };
      renderer.render([makeOrb({ radius: 50 })]);
      return { renderer, fills };
    };

    it("draws white labels on the default dark background", () => {
      expect(new Set(labelFills({}).fills)).toEqual(new Set(["#ffffff"]));
    });

    it("draws violet labels with a light edge on a light background", () => {
      const { fills } = labelFills({ backgroundColor: "#f5f0ff" });
      expect(fills).toContain("#2b1f47");
      expect(fills).toContain("rgba(255,255,255,0.7)");
    });

    it("follows a theme change from updateConfig", () => {
      const { renderer, fills } = labelFills({ backgroundColor: "#000" });
      fills.length = 0;
      renderer.updateConfig({ backgroundColor: "#000", theme: "light" });
      renderer.render([makeOrb({ radius: 50 })]);
      expect(fills).toContain("#2b1f47");
    });
  });

  it("draws one bubble with its label and value for each orb", () => {
    const renderer = new CanvasRenderer(container, {});
    renderer.updateDimensions(300, 200);

    renderer.render([
      makeOrb({ id: "a", label: "Alpha", value: 40, radius: 50 }),
      makeOrb({ id: "b", label: "Beta", value: 25, radius: 50 }),
    ]);

    const text = calls("fillText").map((call) => call.args[0]);
    expect(text).toEqual(["Alpha", "40", "Beta", "25"]);
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
      const cache = new ImageCache();
      const renderer = new CanvasRenderer(container, {}, { images: cache });
      renderer.updateDimensions(300, 200);
      cache.preload([imageOrb]);

      // In a browser, drawImage on a broken image throws and stops the loop.
      renderer.render([imageOrb]);

      expect(calls("drawImage")).toHaveLength(0);
    });

    it("draws the image once it has loaded", () => {
      const cache = new ImageCache();
      const renderer = new CanvasRenderer(container, {}, { images: cache });
      renderer.updateDimensions(300, 200);
      cache.preload([imageOrb]);

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

  describe("float phase", () => {
    const circleYs = (phaseOf?: (orb: Orb) => number) => {
      const renderer = new CanvasRenderer(container, {
        floatAmplitude: 10,
        floatSpeed: 1,
      });
      renderer.updateDimensions(300, 200);
      const ctx = contexts[contexts.length - 1];
      ctx.calls.length = 0;
      renderer.render([makeOrb()], at(1), phaseOf);
      return ctx.calls.find((c) => c.method === "arc")?.args[1];
    };

    it("offsets the float by the orb's own phase, not its index", () => {
      const noPhase = circleYs();
      const shifted = circleYs(() => 1);

      expect(noPhase).toBeCloseTo(100 + 10 * Math.sin(1));
      expect(shifted).toBeCloseTo(100 + 10 * Math.sin(2));
    });

    it("draws the same orb at the same height wherever it sits in the list", () => {
      const renderer = new CanvasRenderer(container, {
        floatAmplitude: 10,
        floatSpeed: 1,
      });
      renderer.updateDimensions(300, 200);
      const phaseOf = (orb: Orb) => (orb.id === "b" ? 0.7 : 0);
      const b = makeOrb({ id: "b" });

      contexts[0].calls.length = 0;
      renderer.render([makeOrb({ id: "a" }), b], at(5), phaseOf);
      // Body and glow clip are the two full size arcs of each bubble.
      const full = () => calls("arc").filter((c) => c.args[2] === 30);
      const secondSlot = full()[2].args[1];
      contexts[0].calls.length = 0;
      renderer.render([b], at(5), phaseOf);
      const firstSlot = full()[0].args[1];

      expect(secondSlot).toBeCloseTo(firstSlot as number);
    });
  });

  describe("construction and teardown", () => {
    it("exposes its canvas for the input layer", () => {
      const renderer = new CanvasRenderer(container, {});

      expect(renderer.element).toBe(canvas());
    });

    it("throws and leaves the container empty when there is no 2D context", () => {
      jest
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue(null);

      expect(() => new CanvasRenderer(container, {})).toThrow("canvas context");
      expect(container.children).toHaveLength(0);
    });
  });

  describe("accessibility and still mode (AC-1, AC-5, AC-8)", () => {
    const arcsAt = (radius: number) =>
      calls("arc").filter((call) => call.args[2] === radius);

    it("hides the canvas from assistive technology", () => {
      new CanvasRenderer(container, {});
      expect(canvas().getAttribute("aria-hidden")).toBe("true");
    });

    it("floats an orb by the amplitude, and not at all in still mode", () => {
      const renderer = new CanvasRenderer(container, {
        floatAmplitude: 10,
        floatSpeed: 1,
      });
      const orb = makeOrb();
      const phase = () => Math.PI / 2;

      renderer.render([orb], at(0), phase);
      expect(arcsAt(30)[0].args[1]).toBeCloseTo(110);

      contexts[0].calls.length = 0;
      renderer.setStill(true);
      renderer.render([orb], at(0), phase);
      expect(arcsAt(30).every((call) => call.args[1] === 100)).toBe(true);
    });

    it("reports where an orb is drawn, with the float offset", () => {
      const renderer = new CanvasRenderer(container, { floatAmplitude: 4 });
      const orb = makeOrb();
      expect(renderer.centerOf(orb, 0, Math.PI / 2).y).toBeCloseTo(104);
      renderer.setStill(true);
      expect(renderer.centerOf(orb, 0, Math.PI / 2)).toEqual({
        x: 100,
        y: 100,
      });
    });

    it("adds the rise offset to where an orb is drawn, at the time given (spec 0006 AC-5)", () => {
      const riseOf = jest.fn((_orb: Orb, now: number) => 200 - now);
      const renderer = new CanvasRenderer(
        container,
        { floatAmplitude: 0 },
        { riseOf },
      );
      const orb = makeOrb();

      expect(renderer.centerOf(orb, 0, 0, 50)).toEqual({ x: 100, y: 250 });
      expect(riseOf).toHaveBeenLastCalledWith(orb, 50);
      expect(renderer.centerOf(orb, 0, 0, 200).y).toBe(100);
      expect(renderer.bubbleOf(orb, 0, () => 0, 50).y).toBe(250);
    });

    it("draws the frame at the frame time, so a rising bubble is drawn lower (spec 0006 AC-2)", () => {
      const renderer = new CanvasRenderer(
        container,
        { floatAmplitude: 0 },
        { riseOf: (_orb, now) => (now === 0 ? 300 : 0) },
      );
      renderer.updateDimensions(400, 300);
      const orb = makeOrb();
      contexts[0].calls.length = 0;
      renderer.render([orb], { now: 0, elapsed: 0, moving: true });
      const parked = contexts[0].calls.filter((c) => c.method === "arc");
      contexts[0].calls.length = 0;
      renderer.render([orb], { now: 800, elapsed: 800, moving: true });
      const risen = contexts[0].calls.filter((c) => c.method === "arc");

      expect(parked[0].args[1]).toBe(400);
      expect(risen[0].args[1]).toBe(100);
    });

    it("draws a two tone ring last, only for the focused orb", () => {
      const renderer = new CanvasRenderer(container, { floatAmplitude: 0 });
      const orbs = [makeOrb({ id: "a" }), makeOrb({ id: "b", x: 200 })];
      renderer.setFocus("b");

      renderer.render(orbs);

      const arcs = calls("arc");
      expect(arcs.slice(-2).map((call) => call.args)).toEqual([
        [200, 100, 33, 0, Math.PI * 2],
        [200, 100, 35, 0, Math.PI * 2],
      ]);
      expect(calls("stroke").length).toBeGreaterThan(2);
    });

    it("draws no ring when nothing has focus or the focused orb is gone", () => {
      const renderer = new CanvasRenderer(container, {});
      renderer.render([makeOrb()]);
      expect(arcsAt(35)).toHaveLength(0);

      renderer.setFocus("missing");
      renderer.render([makeOrb()]);
      expect(arcsAt(35)).toHaveLength(0);
    });
  });
});
