/**
 * @jest-environment jsdom
 */
import { OrbChart } from "./OrbChart";
import {
  FakeResizeObserver,
  dispatchMouse,
  installFakeCanvas,
  type FakeContext,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  tap,
  trackListeners,
} from "../test-support/fakeDom";
import type { OrbDataInput } from "../types/types";

const row = (id: string, value: number, extra = {}): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
  ...extra,
});

describe("OrbChart lifecycle", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let listeners: ReturnType<typeof trackListeners>;
  let clock: number;
  let contexts: FakeContext[];

  beforeEach(() => {
    jest.useFakeTimers();
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    clock = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    listeners = trackListeners();
  });

  afterEach(() => {
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Only the elements the chart created; the DOM itself may add its own.
  const onChartParts = (target: EventTarget) =>
    target instanceof HTMLCanvasElement || target === container;
  const canvas = () => container.querySelector("canvas") as HTMLCanvasElement;
  const tooltip = () =>
    container.querySelector(":scope > div[aria-hidden]") as HTMLDivElement;
  const drawn = () => contexts.reduce((n, ctx) => n + ctx.calls.length, 0);
  const advance = (ms: number) => {
    clock += ms;
    frames.step();
  };

  describe("teardown (AC-1, AC-2, AC-14)", () => {
    it("leaves no listener, observer, frame, timer, or element behind", () => {
      const chart = new OrbChart(container, { transitionDuration: 0 });
      chart.setData([row("a", 1)]);
      tap(canvas(), 200, 150);
      expect(jest.getTimerCount()).toBe(1);

      chart.destroy();

      expect(container.children).toHaveLength(0);
      expect(listeners.count(onChartParts)).toBe(0);
      expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
      expect(frames.pending()).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("can be destroyed twice and ignores every call afterwards", () => {
      const chart = new OrbChart(container);
      chart.destroy();
      chart.destroy();

      expect(() => {
        chart.setData([row("a", 1)]);
        chart.start();
        chart.pause();
        chart.updateConfig({ maxRadius: 90 });
      }).not.toThrow();
      expect(chart.getData()).toEqual([]);
      expect(frames.pending()).toBe(0);
      expect(container.children).toHaveLength(0);
    });

    it("silences an image that finishes loading after destroy", () => {
      const images: HTMLImageElement[] = [];
      jest.spyOn(window, "Image").mockImplementation(() => {
        const img = document.createElement("img");
        images.push(img);
        return img;
      });
      const chart = new OrbChart(container);
      chart.setData([row("a", 1, { imageUrl: "https://x.test/a.png" })]);

      chart.destroy();

      expect(images[0].onload).toBeNull();
      expect(images[0].onerror).toBeNull();
    });

    it("leaves the container clean when there is no canvas context", () => {
      jest
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue(null);

      expect(() => new OrbChart(container)).toThrow("canvas context");
      expect(container.children).toHaveLength(0);
      expect(listeners.count(onChartParts)).toBe(0);
    });

    it("tears down what it built when ResizeObserver is missing", () => {
      Object.defineProperty(window, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: undefined,
      });

      expect(() => new OrbChart(container)).toThrow();
      expect(container.children).toHaveLength(0);
      expect(listeners.count(onChartParts)).toBe(0);
    });
  });

  describe("validation (AC-6, AC-7)", () => {
    it("skips bad rows, warns once, and calls onDataIssue once", () => {
      const onDataIssue = jest.fn();
      const chart = new OrbChart(container, { onDataIssue });

      chart.setData([
        row("a", NaN),
        row("a", 1),
        row("a", 2),
        null as unknown as OrbDataInput,
      ]);

      expect(chart.getData().map((o) => o.value)).toEqual([1]);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(onDataIssue).toHaveBeenCalledTimes(1);
      expect(
        onDataIssue.mock.calls[0][0].map((i: { reason: string }) => i.reason),
      ).toEqual(["invalid-value", "duplicate-id", "invalid-id"]);
    });

    it("keeps the update when onDataIssue throws", () => {
      const chart = new OrbChart(container, {
        onDataIssue: () => {
          throw new Error("boom");
        },
      });

      expect(() => chart.setData([row("a", 1), row("b", -1)])).not.toThrow();
      expect(chart.getData()).toHaveLength(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("treats a non array as empty and warns", () => {
      const chart = new OrbChart(container);
      chart.setData([row("a", 1)]);

      chart.setData(undefined as unknown as OrbDataInput[]);
      advance(1000);

      expect(chart.getData()).toEqual([]);
      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("does not warn when every row is fine", () => {
      new OrbChart(container).setData([row("a", 0)]);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("in place updates (AC-3, AC-4, AC-5, AC-12)", () => {
    it("keeps an orb's position and animates its size", () => {
      const chart = new OrbChart(container, { minRadius: 20, maxRadius: 80 });
      chart.setData([row("a", 1), row("b", 100)]);
      advance(400);
      const [a] = chart.getData();
      const spot = { x: a.x, y: a.y, vx: a.vx, vy: a.vy };

      chart.setData([row("a", 100), row("b", 1)]);

      expect(chart.getData()[0]).toBe(a);
      expect(a).toMatchObject({ radius: 20, ...spot });
      advance(200);
      expect(a.radius).toBeGreaterThan(20);
      expect(a.radius).toBeLessThan(80);
      advance(200);
      expect(a.radius).toBe(80);
    });

    it("does not restart a tween when the same data is set again", () => {
      const chart = new OrbChart(container, { minRadius: 20, maxRadius: 80 });
      chart.setData([row("a", 10), row("b", 100)]);
      advance(200);
      const before = chart.getData().map((o) => o.radius);

      chart.setData([row("a", 10), row("b", 100)]);

      expect(chart.getData().map((o) => o.radius)).toEqual(before);
    });

    it("grows a new orb from 0 and cannot hit it until it has grown", () => {
      const onOrbClick = jest.fn();
      const chart = new OrbChart(container, { minRadius: 30, onOrbClick });
      chart.setData([row("a", 1)]);
      const [orb] = chart.getData();
      expect(orb.radius).toBe(0);

      dispatchMouse(canvas(), "click", orb.x, orb.y);
      expect(onOrbClick).not.toHaveBeenCalled();

      advance(400);
      dispatchMouse(canvas(), "click", orb.x, orb.y);
      expect(onOrbClick).toHaveBeenCalledTimes(1);
    });

    it("shrinks a removed orb out of the list, then removes it", () => {
      const chart = new OrbChart(container, { minRadius: 30 });
      chart.setData([row("a", 1), row("b", 1)]);
      advance(400);

      chart.setData([row("a", 1)]);

      expect(chart.getData().map((o) => o.id)).toEqual(["a"]);
      advance(200);
      expect(chart.getData()).toHaveLength(1);
      advance(200);
      advance(16);
      // Gone from the chart entirely: nothing draws it any more.
      chart.setData([row("a", 1), row("b", 1)]);
      expect(chart.getData().find((o) => o.id === "b")?.radius).toBe(0);
    });

    it("revives an orb whose id returns while it shrinks", () => {
      const chart = new OrbChart(container, { maxRadius: 30 });
      chart.setData([row("a", 1), row("b", 1)]);
      advance(400);
      const b = chart.getData()[1];
      chart.setData([row("a", 1)]);
      advance(200);
      const shrunk = b.radius;

      chart.setData([row("a", 1), row("b", 1)]);

      expect(chart.getData()[1]).toBe(b);
      expect(b.radius).toBe(shrunk);
      advance(400);
      expect(b.radius).toBe(30);
    });

    it("removes exiting orbs inside setData when transitionDuration is 0", () => {
      const chart = new OrbChart(container, { transitionDuration: 0 });
      chart.setData([row("a", 1), row("b", 1)]);

      chart.setData([row("a", 1)]);
      chart.setData([row("a", 1), row("b", 1)]);

      expect(chart.getData()[1].radius).toBe(80);
    });

    it("updates label, value, and metadata in place, and keeps a missing color", () => {
      const chart = new OrbChart(container, { transitionDuration: 0 });
      chart.setData([row("a", 1, { color: "#123456" })]);
      const [orb] = chart.getData();

      chart.setData([row("a", 7, { label: "New", metadata: { n: 1 } })]);

      expect(chart.getData()[0]).toBe(orb);
      expect(orb).toMatchObject({
        label: "New",
        value: 7,
        color: "#123456",
        metadata: { n: 1 },
      });
    });
  });

  describe("0 sized containers", () => {
    it("places new orbs on the first resize with a size", () => {
      setElementSize(container, 0, 0);
      const chart = new OrbChart(container, {
        minRadius: 30,
        transitionDuration: 0,
      });
      chart.setData([row("a", 1)]);

      setElementSize(container, 400, 300);
      FakeResizeObserver.instances[0].trigger();

      expect(chart.getData()[0]).toMatchObject({ x: 200, y: 150 });
    });
  });

  describe("playback (0003 AC-9, AC-15)", () => {
    it("starts a chart that was never paused on setData", () => {
      const chart = new OrbChart(container);

      chart.setData([row("a", 1)]);

      expect(frames.pending()).toBe(1);
    });

    it("keeps a paused chart paused, draws once, and snaps to the data", () => {
      const chart = new OrbChart(container, { minRadius: 20, maxRadius: 80 });
      chart.setData([row("a", 1), row("b", 5)]);
      advance(400);
      chart.pause();
      const before = drawn();

      chart.setData([row("b", 9), row("c", 0)]);

      expect(frames.pending()).toBe(0);
      expect(drawn()).toBeGreaterThan(before);
      expect(chart.getData().map((o) => [o.id, o.radius])).toEqual([
        ["b", 80],
        ["c", 20],
      ]);
      expect(frames.pending()).toBe(0);
    });

    it("starts again after start() following a paused setData", () => {
      const chart = new OrbChart(container);
      chart.setData([row("a", 1)]);
      chart.pause();
      chart.setData([row("a", 2)]);

      chart.start();

      expect(frames.pending()).toBe(1);
    });

    it("redraws once, queueing nothing, when a paused chart resizes", () => {
      const chart = new OrbChart(container);
      chart.setData([row("a", 1)]);
      chart.pause();
      const before = drawn();

      setElementSize(container, 500, 400);
      FakeResizeObserver.instances[0].trigger();

      expect(drawn()).toBeGreaterThan(before);
      expect(frames.pending()).toBe(0);
    });

    it("redraws once when a paused chart changes how it looks", () => {
      const chart = new OrbChart(container);
      chart.setData([row("a", 1)]);
      chart.pause();

      for (const change of [
        { colorScheme: ["#111111"] },
        { backgroundColor: "#222222" },
        { minRadius: 33 },
      ]) {
        const before = drawn();
        chart.updateConfig(change);
        expect(drawn()).toBeGreaterThan(before);
        expect(frames.pending()).toBe(0);
      }
    });
  });

  describe("updateConfig (AC-8, AC-11)", () => {
    it("keeps defaults when a key is undefined", () => {
      const chart = new OrbChart(container, { minRadius: 30 });
      chart.setData([row("a", 1), row("z", 100)]);

      chart.updateConfig({
        minRadius: undefined,
        transitionDuration: undefined,
      });
      advance(400);

      expect(chart.getData()[0].radius).toBe(30);
    });

    it("tweens every orb to a new maxRadius and ignores a repeat", () => {
      const chart = new OrbChart(container, { minRadius: 20, maxRadius: 80 });
      chart.setData([row("a", 10), row("b", 100)]);
      advance(400);

      chart.updateConfig({ maxRadius: 120 });
      advance(200);
      const midway = chart.getData()[1].radius;
      expect(midway).toBeGreaterThan(80);
      expect(midway).toBeLessThan(120);

      chart.updateConfig({ maxRadius: 120 });
      expect(chart.getData()[1].radius).toBe(midway);
      advance(200);
      expect(chart.getData()[1].radius).toBe(120);
    });

    it("applies a retarget at once while paused", () => {
      const chart = new OrbChart(container, { minRadius: 20, maxRadius: 80 });
      chart.setData([row("a", 10), row("b", 100)]);
      advance(400);
      chart.pause();

      chart.updateConfig({ maxRadius: 120 });

      expect(chart.getData()[1].radius).toBe(120);
    });
  });

  describe("touch (AC-10, AC-15)", () => {
    const setup = (onOrbHover = jest.fn(), onOrbClick = jest.fn()) => {
      const chart = new OrbChart(container, {
        minRadius: 30,
        transitionDuration: 0,
        onOrbHover,
        onOrbClick,
      });
      chart.setData([row("a", 1), row("b", 1)]);
      const [a, b] = chart.getData();
      a.x = 100;
      a.y = 100;
      b.x = 300;
      b.y = 200;
      return { chart, a, b, onOrbHover, onOrbClick };
    };

    it("shows the tooltip on tap, then hides it after 2500 ms", () => {
      const { a, onOrbHover, onOrbClick } = setup();

      tap(canvas(), 100, 100);

      expect(tooltip().style.opacity).toBe("1");
      expect(onOrbHover).toHaveBeenCalledWith(a);
      expect(onOrbClick).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(2500);
      expect(tooltip().style.opacity).toBe("0");
      expect(onOrbHover).toHaveBeenLastCalledWith(null);
    });

    it("hides the tooltip when empty canvas is tapped", () => {
      const { onOrbHover } = setup();
      tap(canvas(), 100, 100);

      tap(canvas(), 10, 10);

      expect(tooltip().style.opacity).toBe("0");
      expect(onOrbHover).toHaveBeenLastCalledWith(null);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("switches orbs without a null between, and a same orb tap only restarts the timer", () => {
      const { a, b, onOrbHover, onOrbClick } = setup();

      tap(canvas(), 100, 100);
      jest.advanceTimersByTime(2000);
      tap(canvas(), 100, 100);
      jest.advanceTimersByTime(2000);
      expect(tooltip().style.opacity).toBe("1");
      tap(canvas(), 300, 200);

      expect(onOrbHover.mock.calls).toEqual([[a], [b]]);
      expect(onOrbClick).toHaveBeenCalledTimes(3);
    });

    it("ignores touch pointermove and pointerleave", () => {
      const { onOrbHover } = setup();

      dispatchMouse(canvas(), "pointermove", 100, 100, "touch");
      dispatchMouse(canvas(), "pointerleave", 0, 0, "touch");

      expect(onOrbHover).not.toHaveBeenCalled();
    });

    it("does not treat a mouse click as a touch tap", () => {
      setup();

      dispatchMouse(canvas(), "click", 100, 100, "mouse");

      expect(jest.getTimerCount()).toBe(0);
    });

    it("clears a tapped tooltip when its orb is removed", () => {
      const { chart, onOrbHover } = setup();
      tap(canvas(), 100, 100);

      chart.setData([row("b", 1)]);

      expect(tooltip().style.opacity).toBe("0");
      expect(onOrbHover).toHaveBeenLastCalledWith(null);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("refreshes the tooltip text when the hovered orb changes", () => {
      const { chart } = setup();
      dispatchMouse(canvas(), "pointermove", 100, 100);

      chart.setData([row("a", 9, { label: "Renamed" }), row("b", 1)]);

      expect(tooltip().textContent).toContain("Renamed");
      expect(tooltip().textContent).toContain("Value: 9");
    });
  });
});
