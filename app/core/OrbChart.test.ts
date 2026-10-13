/**
 * @jest-environment jsdom
 */
import { OrbChart } from "./OrbChart";
import {
  FakeResizeObserver,
  dispatchMouse,
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  type FakeContext,
} from "../test-support/fakeDom";

describe("OrbChart (vanilla)", () => {
  let container: HTMLDivElement;
  let contexts: FakeContext[];
  let frames: ReturnType<typeof installFrameQueue>;

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    // 0.5 removes jitter and places every new orb at the centre.
    jest.spyOn(Math, "random").mockReturnValue(0.5);

    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    jest.restoreAllMocks();
  });

  const canvasOf = () => {
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("no canvas mounted");
    return canvas;
  };

  const tooltipOf = () => container.querySelector("div");

  const drawnText = () =>
    contexts.flatMap((ctx) =>
      ctx.calls.filter((c) => c.method === "fillText").map((c) => c.args[0]),
    );

  describe("mounting", () => {
    it("mounts a canvas into a container element", () => {
      new OrbChart(container);

      expect(container.querySelectorAll("canvas")).toHaveLength(1);
    });

    it("accepts a CSS selector for the container", () => {
      container.id = "chart";

      new OrbChart("#chart");

      expect(container.querySelector("canvas")).not.toBeNull();
    });

    it("throws a clear error when the selector matches nothing", () => {
      expect(() => new OrbChart("#missing")).toThrow(
        'Container "#missing" not found',
      );
    });

    it("sizes the canvas to the container", () => {
      new OrbChart(container);

      expect(canvasOf().style.width).toBe("400px");
      expect(canvasOf().style.height).toBe("300px");
    });
  });

  describe("setData", () => {
    it("scales radius linearly from minRadius to maxRadius by value", () => {
      const chart = new OrbChart(container, { minRadius: 20, maxRadius: 80 });

      chart.setData([
        { id: "low", label: "Low", value: 10 },
        { id: "mid", label: "Mid", value: 55 },
        { id: "high", label: "High", value: 100 },
      ]);

      const radii = chart.getData().map((orb) => orb.radius);
      expect(radii).toEqual([20, 50, 80]);
    });

    it("gives every orb minRadius when all values are equal", () => {
      const chart = new OrbChart(container, { minRadius: 30 });

      chart.setData([
        { id: "a", label: "A", value: 5 },
        { id: "b", label: "B", value: 5 },
      ]);

      expect(chart.getData().map((orb) => orb.radius)).toEqual([30, 30]);
    });

    it("clears the chart when given an empty list", () => {
      const chart = new OrbChart(container);
      chart.setData([{ id: "a", label: "A", value: 1 }]);

      chart.setData([]);

      expect(chart.getData()).toEqual([]);
    });

    it("cycles the colour scheme and lets an item colour win", () => {
      const chart = new OrbChart(container, {
        colorScheme: ["#111111", "#222222"],
      });

      chart.setData([
        { id: "a", label: "A", value: 1 },
        { id: "b", label: "B", value: 2 },
        { id: "c", label: "C", value: 3 },
        { id: "d", label: "D", value: 4, color: "#abcdef" },
      ]);

      expect(chart.getData().map((orb) => orb.color)).toEqual([
        "#111111",
        "#222222",
        "#111111",
        "#abcdef",
      ]);
    });

    it("places a new orb fully inside the canvas", () => {
      jest.spyOn(Math, "random").mockReturnValue(0.999);
      const chart = new OrbChart(container, { minRadius: 60 });

      chart.setData([{ id: "a", label: "A", value: 1 }]);

      const [orb] = chart.getData();
      expect(orb.x + orb.radius).toBeLessThanOrEqual(400);
      expect(orb.y + orb.radius).toBeLessThanOrEqual(300);
    });

    it("returns a copy from getData so callers cannot reorder the chart", () => {
      const chart = new OrbChart(container);
      chart.setData([
        { id: "a", label: "A", value: 1 },
        { id: "b", label: "B", value: 2 },
      ]);

      chart.getData().reverse();

      expect(chart.getData().map((orb) => orb.id)).toEqual(["a", "b"]);
    });
  });

  describe("animation loop", () => {
    it("draws every orb's label and value on each frame", () => {
      const chart = new OrbChart(container);

      chart.setData([{ id: "a", label: "Alpha", value: 40 }]);

      expect(drawnText()).toEqual(expect.arrayContaining(["Alpha", "40%"]));
    });

    it("keeps requesting frames while playing", () => {
      const chart = new OrbChart(container);
      chart.setData([{ id: "a", label: "A", value: 1 }]);

      frames.step(3);

      expect(frames.pending()).toBe(1);
    });

    it("stops requesting frames after pause and resumes on start", () => {
      const chart = new OrbChart(container);
      chart.setData([{ id: "a", label: "A", value: 1 }]);

      chart.pause();
      expect(frames.pending()).toBe(0);

      chart.start();
      expect(frames.pending()).toBe(1);
    });
  });

  describe("resizing", () => {
    it("resizes the canvas when the container changes size", () => {
      new OrbChart(container);

      setElementSize(container, 640, 200);
      FakeResizeObserver.instances[0].trigger();

      expect(canvasOf().style.width).toBe("640px");
      expect(canvasOf().style.height).toBe("200px");
    });

    it("keeps orbs inside the new bounds after the container shrinks", () => {
      const chart = new OrbChart(container, { minRadius: 25 });
      chart.setData([{ id: "a", label: "A", value: 1 }]);

      setElementSize(container, 100, 100);
      FakeResizeObserver.instances[0].trigger();
      frames.step();

      const [orb] = chart.getData();
      expect(orb.x).toBeLessThanOrEqual(100 - orb.radius);
      expect(orb.y).toBeLessThanOrEqual(100 - orb.radius);
    });

    it("ignores a resize to zero size (hidden container)", () => {
      new OrbChart(container);

      setElementSize(container, 0, 0);
      FakeResizeObserver.instances[0].trigger();

      expect(canvasOf().style.width).toBe("400px");
    });
  });

  describe("pointer interaction", () => {
    // One orb at the centre (200, 150) with radius 25.
    function chartWithOneOrb(config = {}) {
      const chart = new OrbChart(container, { minRadius: 25, ...config });
      chart.setData([
        {
          id: "a",
          label: "Alpha",
          value: 40,
          metadata: { category: "Fruit" },
        },
      ]);
      return chart;
    }

    it("calls onOrbClick with the clicked orb", () => {
      const onOrbClick = jest.fn();
      chartWithOneOrb({ onOrbClick });

      const event = dispatchMouse(canvasOf(), "click", 205, 150);

      expect(onOrbClick).toHaveBeenCalledTimes(1);
      expect(onOrbClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a", label: "Alpha" }),
        event,
      );
    });

    it("does not call onOrbClick when the click misses every orb", () => {
      const onOrbClick = jest.fn();
      chartWithOneOrb({ onOrbClick });

      dispatchMouse(canvasOf(), "click", 10, 10);

      expect(onOrbClick).not.toHaveBeenCalled();
    });

    // Known bug: applyMouseRepulsion reads an orb list OrbChart never sets.
    // Remove `.failing` once fixed.
    it.failing("pushes nearby orbs away from a click", () => {
      const chart = chartWithOneOrb();

      dispatchMouse(canvasOf(), "click", 220, 150);
      frames.step();

      const [orb] = chart.getData();
      expect(orb.vx).toBeLessThan(0);
    });

    it("reports hover enter once, then null when the pointer leaves", () => {
      const onOrbHover = jest.fn();
      chartWithOneOrb({ onOrbHover });

      dispatchMouse(canvasOf(), "mousemove", 200, 150);
      dispatchMouse(canvasOf(), "mousemove", 202, 151);
      dispatchMouse(canvasOf(), "mouseleave");

      expect(onOrbHover.mock.calls).toEqual([
        [expect.objectContaining({ id: "a" })],
        [null],
      ]);
    });

    it("shows a tooltip with label, value and category on hover", () => {
      chartWithOneOrb();

      dispatchMouse(canvasOf(), "mousemove", 200, 150);

      const tooltip = tooltipOf();
      expect(tooltip?.style.opacity).toBe("1");
      expect(tooltip?.textContent).toContain("Alpha");
      expect(tooltip?.textContent).toContain("Value: 40");
      expect(tooltip?.textContent).toContain("Fruit");
    });

    it("hides the tooltip when the pointer moves off the orb or leaves", () => {
      chartWithOneOrb();
      dispatchMouse(canvasOf(), "mousemove", 200, 150);

      dispatchMouse(canvasOf(), "mousemove", 10, 10);
      expect(tooltipOf()?.style.opacity).toBe("0");

      dispatchMouse(canvasOf(), "mousemove", 200, 150);
      dispatchMouse(canvasOf(), "mouseleave");
      expect(tooltipOf()?.style.opacity).toBe("0");
    });

    it("shows orb labels in the tooltip as text, never as HTML", () => {
      const chart = new OrbChart(container, { minRadius: 25 });
      chart.setData([
        { id: "x", label: '<img src="x" onerror="alert(1)">', value: 1 },
      ]);

      dispatchMouse(canvasOf(), "mousemove", 200, 150);

      expect(tooltipOf()?.querySelector("img")).toBeNull();
      expect(tooltipOf()?.textContent).toContain('<img src="x"');
    });

    it("shows a metadata category in the tooltip as text, never as HTML", () => {
      const chart = new OrbChart(container, { minRadius: 25 });
      chart.setData([
        {
          id: "x",
          label: "Safe",
          value: 1,
          metadata: { category: "<b onmouseover=alert(1)>Bold</b>" },
        },
      ]);

      dispatchMouse(canvasOf(), "mousemove", 200, 150);

      expect(tooltipOf()?.querySelector("b")).toBeNull();
      expect(tooltipOf()?.textContent).toContain("<b onmouseover=alert(1)>");
    });

    it("creates no tooltip when enableTooltip is false", () => {
      chartWithOneOrb({ enableTooltip: false });

      expect(tooltipOf()).toBeNull();
    });

    it("removes the tooltip when updateConfig turns it off", () => {
      const chart = chartWithOneOrb();

      chart.updateConfig({ enableTooltip: false });

      expect(tooltipOf()).toBeNull();
    });
  });

  describe("destroy", () => {
    it("removes the canvas and tooltip and stops the loop", () => {
      const chart = new OrbChart(container);
      chart.setData([{ id: "a", label: "A", value: 1 }]);

      chart.destroy();

      expect(container.children).toHaveLength(0);
      expect(frames.pending()).toBe(0);
      expect(chart.getData()).toEqual([]);
    });
  });
});
