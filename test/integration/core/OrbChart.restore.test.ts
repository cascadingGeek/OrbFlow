/**
 * @jest-environment jsdom
 */
import { OrbChart } from "./OrbChart";
import {
  FakeResizeObserver,
  dispatchMouse,
  installFakeCanvas,
  installFakeMatchMedia,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  tap,
  type FakeContext,
} from "../test-support/fakeDom";
import type { OrbChartConfig, OrbDataInput } from "../types/types";

const row = (id: string, value = 1): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
});

describe("OrbChart restore (spec 0006)", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let contexts: FakeContext[];
  let charts: OrbChart[];
  let clock: number;

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    clock = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    charts = [];
  });

  afterEach(() => {
    charts.forEach((chart) => chart.destroy());
    container.remove();
    Reflect.deleteProperty(window, "matchMedia");
    jest.restoreAllMocks();
  });

  /** Three bubbles A, B, C at x 80, 200, 320, all at y 150. */
  const make = (config: OrbChartConfig = {}, ids = ["a", "b", "c"]) => {
    const chart = new OrbChart(container, {
      transitionDuration: 0,
      maxRadius: 40,
      ...config,
    });
    charts.push(chart);
    chart.setData(ids.map((id) => row(id)));
    chart.getData().forEach((orb, i) => {
      Object.assign(orb, { x: 80 + i * 120, y: 150, vx: 0, vy: 0 });
    });
    return chart;
  };
  const canvas = () => container.querySelector("canvas") as HTMLCanvasElement;
  const ids = (chart: OrbChart) => chart.getData().map((o) => o.id);
  const buttons = () =>
    [...container.querySelectorAll("button")].map((b) => b.textContent);
  const region = () =>
    container.querySelector("[aria-live]")?.textContent ?? "";
  const advance = (ms: number) => {
    clock += ms;
    frames.step();
  };
  const dashes = (mark: number) =>
    contexts[0].calls.slice(mark).filter((c) => c.method === "setLineDash")
      .length;

  describe("restore(id) (AC-7)", () => {
    it("returns false for an unknown id, a live id, twice, and after destroy", () => {
      const chart = make();
      expect(chart.restore("zzz")).toBe(false);
      expect(chart.restore("a")).toBe(false);
      expect(chart.restore()).toBe(false);

      chart.pop("a");
      expect(chart.restore("a")).toBe(true);
      expect(chart.restore("a")).toBe(false);

      chart.pop("b");
      chart.destroy();
      expect(chart.restore("b")).toBe(false);
      expect(chart.restore()).toBe(false);
    });

    it("brings the bubble back as a live bubble at its old place and list position", () => {
      const onOrbRestore = jest.fn();
      const chart = make({ onOrbRestore });
      chart.pop("b");
      expect(ids(chart)).toEqual(["a", "c"]);

      expect(chart.restore("b")).toBe(true);

      expect(ids(chart)).toEqual(["a", "b", "c"]);
      expect(buttons().map((t) => t?.[0])).toEqual(["A", "B", "C"]);
      const b = chart.getData()[1];
      expect({ x: b.x, y: b.y, radius: b.radius }).toEqual({
        x: 200,
        y: 150,
        radius: 40,
      });
      expect(onOrbRestore).toHaveBeenCalledTimes(1);
      expect(onOrbRestore).toHaveBeenCalledWith(b);
      expect(region()).toBe("B restored");
    });

    it("keeps a restored bubble normal: it can pop again", () => {
      const chart = make();
      chart.pop("a");
      chart.restore("a");

      expect(chart.pop("a")).toBe(true);
      expect(chart.restore("a")).toBe(true);
    });

    it("moves the old place back inside a canvas that shrank", () => {
      const chart = make();
      chart.pop("c");
      setElementSize(container, 200, 100);
      chart.updateConfig({ width: 200, height: 100 });

      chart.restore("c");

      const c = chart.getData().find((o) => o.id === "c");
      expect(c).toBeDefined();
      expect(c?.x).toBeLessThanOrEqual(200 - (c?.radius ?? 0));
      expect(c?.y).toBeLessThanOrEqual(100 - (c?.radius ?? 0));
    });

    it("inserts at the old index, capped at the live count", () => {
      const chart = make();
      chart.pop("c");
      chart.pop("b");
      chart.pop("a");
      chart.setData([row("z")]);
      chart.pop("z");
      expect(chart.restore("c")).toBe(false);

      const other = make({}, ["a", "b", "c", "d"]);
      other.pop("d");
      other.pop("a");
      other.restore("d");
      expect(ids(other)).toEqual(["b", "c", "d"]);
      other.restore("a");
      expect(ids(other)).toEqual(["a", "b", "c", "d"]);
    });

    it("keeps a rise going for the restored bubble, not for the others", () => {
      const chart = make({ transitionDuration: 400 });
      advance(2000);
      chart.pop("b");
      const onClick = jest.fn();
      chart.updateConfig({ onOrbClick: onClick });

      chart.restore("b");
      dispatchMouse(canvas(), "click", 200, 150);
      expect(onClick).not.toHaveBeenCalled();
      dispatchMouse(canvas(), "click", 80, 150);
      expect(onClick).toHaveBeenCalledTimes(1);

      advance(2000);
      dispatchMouse(canvas(), "click", 200, 150);
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it("removes the ghost of that bubble, for both popStyle values", () => {
      const chart = make({ popStyle: "ghost" });
      chart.pause();
      chart.pop("a");
      let mark = contexts[0].calls.length;
      chart.updateConfig({ popOnClick: false });
      expect(dashes(mark)).toBe(1);

      chart.restore("a");
      mark = contexts[0].calls.length;
      chart.updateConfig({ popOnClick: true });
      expect(dashes(mark)).toBe(0);
    });

    it("restores while the pop burst is still playing", () => {
      const chart = make({ transitionDuration: 400 });
      advance(2000);
      chart.pop("a");
      advance(100);

      expect(chart.restore("a")).toBe(true);
      expect(() => advance(1000)).not.toThrow();
      expect(ids(chart)).toEqual(["a", "b", "c"]);
    });

    it("announces and calls back in a safe order, and survives a throwing handler", () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      const chart = make({
        onOrbRestore: () => {
          throw new Error("boom");
        },
      });
      chart.pop("a");

      expect(chart.restore("a")).toBe(true);
      expect(error).toHaveBeenCalledTimes(1);
      expect(ids(chart)).toContain("a");
    });
  });

  describe("restore() of everything (AC-7, AC-11)", () => {
    it("brings all back in their old list order, with one announcement", () => {
      const onOrbRestore = jest.fn();
      const chart = make({ onOrbRestore });
      chart.pop("a");
      chart.pop("c");
      chart.pop("b");

      expect(chart.restore()).toBe(true);

      expect(ids(chart)).toEqual(["a", "b", "c"]);
      expect(onOrbRestore).toHaveBeenCalledTimes(3);
      expect(region()).toBe("3 bubbles restored");
    });

    it("gives every restored bubble the radius a setData of the same data gives (AC-8)", () => {
      const data = [row("a", 4), row("b", 1), row("c", 2)];
      const reference = make({}, []);
      reference.setData(data);
      const expected = reference.getData().map((o) => o.radius);

      const chart = make({}, []);
      chart.setData(data);
      chart.pop("a");
      chart.pop("c");
      chart.updateConfig({ maxRadius: 30, minRadius: 4 });
      reference.updateConfig({ maxRadius: 30, minRadius: 4 });
      chart.restore();

      expect(chart.getData().map((o) => o.radius)).toEqual(
        reference.getData().map((o) => o.radius),
      );
      expect(expected).toHaveLength(3);
    });

    it("does not resize the bubbles that stayed when one comes back", () => {
      const chart = make({}, []);
      chart.setData([row("a", 4), row("b", 1)]);
      const b = chart.getData()[1];
      chart.pop("a");
      const before = b.radius;

      chart.restore("a");

      expect(b.radius).toBe(before);
    });
  });

  describe("the popped list (AC-9)", () => {
    it("is cleared by setData, so a popped id enters as new", () => {
      const chart = make();
      chart.pop("a");
      chart.setData([row("a"), row("b")]);

      expect(chart.restore("a")).toBe(false);
      expect(ids(chart)).toEqual(["a", "b"]);
    });

    it("is cleared by destroy, safe to call twice", () => {
      const chart = make();
      chart.pop("a");
      chart.destroy();
      expect(() => chart.destroy()).not.toThrow();
      expect(chart.restore()).toBe(false);
    });

    it("records pops from code and from users alike", () => {
      const chart = make({ popOnClick: true, restoreOnNextPop: false });
      chart.pop("a");
      dispatchMouse(canvas(), "click", 200, 150);

      expect(chart.restore()).toBe(true);
      expect(ids(chart)).toEqual(["a", "b", "c"]);
    });
  });

  describe("restoreOnNextPop (AC-10, AC-11)", () => {
    const setup = (config: OrbChartConfig = {}) => {
      const order: string[] = [];
      const chart = make({
        popOnClick: true,
        onOrbClick: (o) => order.push(`click ${o.id}`),
        onOrbPop: (o) => order.push(`pop ${o.id}`),
        onOrbRestore: (o) => order.push(`restore ${o.id}`),
        ...config,
      });
      return { chart, order };
    };

    it("brings back the last user pop, then pops the clicked bubble", () => {
      const { chart, order } = setup();
      dispatchMouse(canvas(), "click", 80, 150);
      order.length = 0;

      dispatchMouse(canvas(), "click", 200, 150);

      expect(order).toEqual(["click b", "restore a", "pop b"]);
      expect(ids(chart)).toEqual(["a", "c"]);
      expect(region()).toBe("A restored, B popped");
    });

    it("works for a click, a tap, and the hidden button", () => {
      const { chart } = setup();
      dispatchMouse(canvas(), "click", 80, 150);

      tap(canvas(), 200, 150);
      expect(ids(chart)).toEqual(["a", "c"]);

      const first = container.querySelector("button") as HTMLButtonElement;
      // Enter and Space click a button, which jsdom does not do by itself.
      first.click();
      expect(ids(chart)).toEqual(["b", "c"]);
      expect(region()).toBe("B restored, A popped");
    });

    it("leaves popped bubbles alone when restoreOnNextPop is false", () => {
      const { chart } = setup({ restoreOnNextPop: false });
      dispatchMouse(canvas(), "click", 80, 150);
      dispatchMouse(canvas(), "click", 200, 150);

      expect(ids(chart)).toEqual(["c"]);
    });

    it("never restores bubbles that code popped", () => {
      const { chart } = setup();
      chart.pop("a");

      dispatchMouse(canvas(), "click", 200, 150);

      expect(ids(chart)).toEqual(["c"]);
      expect(chart.restore("a")).toBe(true);
    });

    it("restores nothing when popOnClick is off, and a code pop never triggers it", () => {
      const { chart, order } = setup({ popOnClick: false });
      chart.pop("a");
      dispatchMouse(canvas(), "click", 200, 150);

      expect(order).toEqual(["pop a", "click b"]);
      expect(ids(chart)).toEqual(["b", "c"]);
    });

    it("announces one message for a single pop with nothing to restore", () => {
      setup();
      dispatchMouse(canvas(), "click", 80, 150);
      expect(region()).toBe("A popped");
    });
  });

  describe("containers with no size yet (AC-7)", () => {
    const unsized = () => {
      setElementSize(container, 0, 0);
      const chart = new OrbChart(container, {
        transitionDuration: 0,
        maxRadius: 40,
      });
      charts.push(chart);
      chart.setData([row("a"), row("b")]);
      return chart;
    };
    const resize = () => {
      setElementSize(container, 400, 300);
      FakeResizeObserver.instances[0].trigger();
    };

    it("holds a bubble restored before any size, then places it on the first resize", () => {
      const chart = unsized();
      chart.pop("a");

      expect(chart.restore("a")).toBe(true);
      resize();

      const a = chart.getData().find((o) => o.id === "a");
      expect(a).toMatchObject({ x: 200, y: 150 });
    });

    it("gives a bubble popped before any size a fresh place, not the corner, when restored after the resize", () => {
      const chart = unsized();
      chart.pop("a");
      resize();

      chart.restore("a");

      const a = chart.getData().find((o) => o.id === "a");
      expect(a).toMatchObject({ x: 200, y: 150 });
      expect(a?.x).not.toBe(a?.radius);
    });

    it("still brings a bubble popped after the resize back to its old place", () => {
      const chart = unsized();
      resize();
      Object.assign(chart.getData()[0], { x: 90, y: 100 });
      chart.pop("a");

      chart.restore("a");

      expect(chart.getData().find((o) => o.id === "a")).toMatchObject({
        x: 90,
        y: 100,
      });
    });
  });

  describe("idle charts (AC-6)", () => {
    it("restores a paused chart with one draw, no frame, and no settling", () => {
      const chart = make({ transitionDuration: 400 });
      chart.pause();
      chart.pop("a");
      const mark = contexts[0].calls.length;

      chart.restore("a");

      const fills = contexts[0].calls
        .slice(mark)
        .filter((c) => c.method === "fillRect").length;
      expect(fills).toBe(1);
      expect(frames.pending()).toBe(0);
      expect(chart.getData()[0].x).toBe(80);
    });

    it("restores a still chart in place and queues no frame", () => {
      const media = installFakeMatchMedia({ matches: false });
      const chart = make({ transitionDuration: 400 });
      media.fire(true);
      chart.pop("a");

      chart.restore("a");

      expect(frames.pending()).toBe(0);
      expect(ids(chart)).toEqual(["a", "b", "c"]);
    });
  });
});
