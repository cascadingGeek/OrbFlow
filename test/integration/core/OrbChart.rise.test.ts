/**
 * @jest-environment jsdom
 */
import { OrbChart } from "@/core/OrbChart";
import {
  FakeIntersectionObserver,
  dispatchMouse,
  installFakeCanvas,
  installFakeIntersectionObserver,
  installFakeMatchMedia,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  type FakeContext,
} from "@test/support/fakeDom";
import type { OrbChartConfig, OrbDataInput } from "@/types/types";

const row = (id: string, value = 1): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
});

describe("OrbChart rise (spec 0006)", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let contexts: FakeContext[];
  let charts: OrbChart[];
  let clock: number;
  let removeObserver: (() => void) | null;

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    clock = 0;
    removeObserver = null;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    charts = [];
  });

  afterEach(() => {
    charts.forEach((chart) => chart.destroy());
    removeObserver?.();
    container.remove();
    Reflect.deleteProperty(window, "matchMedia");
    jest.restoreAllMocks();
  });

  const make = (config: OrbChartConfig = {}) => {
    const chart = new OrbChart(container, { maxRadius: 40, ...config });
    charts.push(chart);
    return chart;
  };
  const canvas = () => container.querySelector("canvas") as HTMLCanvasElement;
  const advance = (ms: number) => {
    clock += ms;
    frames.step();
  };
  const withGate = () => {
    removeObserver = installFakeIntersectionObserver();
  };
  // The highest bubble center drawn since `action` began. A bubble body is
  // the only path that starts with an arc of 0.97 of its radius (40).
  const drawnFrom = (action: () => void) => {
    const ctx = contexts[contexts.length - 1];
    const mark = ctx.calls.length;
    action();
    const ys = ctx.calls
      .slice(mark)
      .filter((c) => c.method === "arc" && c.args[2] === 0.97 * 40)
      .map((c) => c.args[1] as number);
    return Math.min(...ys);
  };
  // A bubble at rest is drawn within the float wobble (2 px) of its place.
  const atRest = (drawn: number, y: number) =>
    expect(Math.abs(drawn - y)).toBeLessThanOrEqual(2.01);
  const click = (x: number, y: number) =>
    dispatchMouse(canvas(), "click", x, y);

  describe("the rise (AC-1, AC-2, AC-5)", () => {
    it("starts at the target radius and draws below the edge, keeping its place", () => {
      const chart = make();
      const top = drawnFrom(() => chart.setData([row("a")]));
      const [orb] = chart.getData();

      expect(orb.radius).toBe(40);
      expect(orb.y).toBeLessThan(300);
      expect(top).toBeGreaterThanOrEqual(300);
    });

    it("slides up to its resting place and stays there", () => {
      const chart = make();
      chart.setData([row("a")]);
      const [orb] = chart.getData();

      const halfway = drawnFrom(() => advance(400));
      expect(halfway).toBeGreaterThan(orb.y - 50);
      expect(halfway).toBeLessThan(300);

      atRest(
        drawnFrom(() => advance(500)),
        orb.y,
      );
      atRest(
        drawnFrom(() => advance(100)),
        orb.y,
      );
    });

    it("hits a rising bubble where it is drawn, and not at its resting place", () => {
      const onOrbClick = jest.fn();
      const chart = make({ onOrbClick, transitionDuration: 400 });
      chart.setData([row("a")]);
      const [orb] = chart.getData();
      Object.assign(orb, { x: 200, y: 150, vx: 0, vy: 0 });

      click(200, 150);
      expect(onOrbClick).not.toHaveBeenCalled();

      advance(800);
      click(200, 150);
      expect(onOrbClick).toHaveBeenCalledTimes(1);
    });

    it("grows from nothing with enterStyle grow, with no rise", () => {
      const chart = make({ enterStyle: "grow" });
      const top = drawnFrom(() => chart.setData([row("a")]));
      const [orb] = chart.getData();

      expect(orb.radius).toBe(0);
      expect(top).toBeGreaterThan(0);
      advance(400);
      expect(orb.radius).toBe(40);
    });

    it("warns once for an invalid enterStyle and rises", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const chart = make({ enterStyle: "spin" as never });
      chart.updateConfig({ enterStyle: "spin" as never });
      chart.setData([row("a")]);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(chart.getData()[0].radius).toBe(40);
    });

    it("rises only the new bubbles on a later setData (AC-4)", () => {
      const chart = make();
      chart.setData([row("a")]);
      advance(900);
      const [a] = chart.getData();
      const before = { x: a.x, y: a.y };

      const top = drawnFrom(() => chart.setData([row("a"), row("b")]));
      const [, b] = chart.getData();

      expect(top).toBeGreaterThanOrEqual(a.y - a.radius - 2);
      expect(b.radius).toBe(40);
      expect({ x: a.x, y: a.y }).toEqual(before);
    });

    it("lets a bubble that leaves while rising keep its rise as it shrinks", () => {
      const chart = make();
      chart.setData([row("a"), row("b")]);
      advance(100);

      chart.setData([row("a")]);
      expect(chart.getData().map((o) => o.id)).toEqual(["a"]);
      advance(100);
      expect(() => advance(1000)).not.toThrow();
    });
  });

  describe("the scroll gate (AC-3, AC-15)", () => {
    it("parks bubbles below the canvas until the chart is first seen", () => {
      withGate();
      const chart = make();
      const top = drawnFrom(() => chart.setData([row("a"), row("b")]));
      expect(top).toBeGreaterThanOrEqual(300);
      expect(chart.getData()).toHaveLength(2);
      expect(container.querySelectorAll("button")).toHaveLength(2);

      expect(drawnFrom(() => advance(10_000))).toBeGreaterThanOrEqual(300);
    });

    it("rises them together once seen, and never replays", () => {
      withGate();
      const chart = make();
      chart.setData([row("a"), row("b")]);
      advance(5000);
      const [observer] = FakeIntersectionObserver.instances;

      observer.trigger(true);
      advance(0);
      expect(drawnFrom(() => advance(1))).toBeGreaterThanOrEqual(240);
      advance(3000);
      const [a] = chart.getData();
      atRest(
        drawnFrom(() => advance(16)),
        Math.min(a.y, chart.getData()[1].y),
      );

      observer.trigger(false);
      observer.trigger(true);
      atRest(
        drawnFrom(() => advance(16)),
        Math.min(a.y, chart.getData()[1].y),
      );
    });

    it("rises later setData calls at once after the gate opened", () => {
      withGate();
      const chart = make();
      chart.setData([row("a")]);
      FakeIntersectionObserver.instances[0].trigger(true);
      advance(2000);

      const top = drawnFrom(() => chart.setData([row("a"), row("b")]));
      const [, b] = chart.getData();
      expect(top).toBeGreaterThanOrEqual(b.y - 40 - 2);
      expect(b.radius).toBe(40);
    });

    it("ignores the gate for enterStyle grow and transitionDuration 0", () => {
      withGate();
      const grow = make({ enterStyle: "grow" });
      grow.setData([row("a")]);
      advance(400);
      expect(grow.getData()[0].radius).toBe(40);
      grow.destroy();

      const snap = make({ transitionDuration: 0 });
      const top = drawnFrom(() => snap.setData([row("a")]));
      expect(top).toBeLessThan(300);
    });

    it("rises a restored bubble at once while the gate is still closed", () => {
      withGate();
      const chart = make();
      chart.setData([row("a"), row("b")]);
      chart.pop("a");

      chart.restore("a");
      const a = chart.getData().find((o) => o.id === "a");
      expect(drawnFrom(() => advance(1))).toBeGreaterThanOrEqual(300);
      atRest(
        drawnFrom(() => advance(3000)),
        a?.y ?? 0,
      );
    });

    it("places parked bubbles at once when updateConfig turns the rise off", () => {
      withGate();
      const chart = make();
      chart.setData([row("a")]);
      expect(drawnFrom(() => advance(1))).toBeGreaterThanOrEqual(300);

      chart.updateConfig({ enterStyle: "grow" });

      expect(drawnFrom(() => advance(1))).toBeLessThan(300);
    });

    it("places parked bubbles at once when updateConfig sets transitionDuration 0", () => {
      withGate();
      const chart = make();
      chart.setData([row("a")]);

      chart.updateConfig({ transitionDuration: 0 });

      expect(drawnFrom(() => advance(1))).toBeLessThan(300);
    });

    it("places parked bubbles at once and opens for good when the chart pauses", () => {
      withGate();
      const chart = make();
      chart.setData([row("a")]);

      expect(drawnFrom(() => chart.pause())).toBeLessThan(300);

      chart.start();
      chart.setData([row("a"), row("b")]);
      const [, b] = chart.getData();
      expect(b.radius).toBe(40);
      expect(drawnFrom(() => advance(1))).toBeGreaterThanOrEqual(b.y - 42);
    });

    it("disconnects the observer on destroy, and a late callback does nothing", () => {
      withGate();
      const chart = make();
      chart.setData([row("a")]);
      expect(FakeIntersectionObserver.live).toBe(1);

      chart.destroy();
      chart.destroy();
      expect(FakeIntersectionObserver.live).toBe(0);
      expect(() =>
        FakeIntersectionObserver.instances[0].trigger(true),
      ).not.toThrow();
    });
  });

  describe("idle, still, and no transition (AC-6)", () => {
    it("shows new bubbles in place with no frame queued while paused", () => {
      const chart = make();
      chart.pause();
      const top = drawnFrom(() => chart.setData([row("a")]));

      expect(top).toBeLessThan(300);
      expect(chart.getData()[0].radius).toBe(40);
      expect(frames.pending()).toBe(0);
    });

    it("finishes a rise in flight when paused, drawing once", () => {
      const chart = make();
      chart.setData([row("a")]);
      advance(100);
      const [orb] = chart.getData();

      const top = drawnFrom(() => chart.pause());

      atRest(top, orb.y);
      expect(frames.pending()).toBe(0);
      chart.start();
      atRest(
        drawnFrom(() => advance(16)),
        orb.y,
      );
    });

    it("does not redraw on pause when nothing was rising", () => {
      const chart = make({ transitionDuration: 0 });
      chart.setData([row("a")]);
      const mark = contexts[0].calls.length;
      chart.pause();
      expect(contexts[0].calls.length).toBe(mark);
    });

    it("rises nothing when the chart is still, and finishes a rise that was playing", () => {
      const media = installFakeMatchMedia({ matches: false });
      const chart = make();
      chart.setData([row("a")]);
      advance(100);
      const [orb] = chart.getData();

      media.fire(true);

      const top = drawnFrom(() => chart.setData([row("a"), row("b")]));
      atRest(top, Math.min(orb.y, chart.getData()[1].y));
      expect(frames.pending()).toBe(0);
    });

    it("snaps with transitionDuration 0", () => {
      const chart = make({ transitionDuration: 0 });
      const top = drawnFrom(() => chart.setData([row("a")]));
      expect(top).toBeLessThan(300);
      expect(chart.getData()[0].radius).toBe(40);
    });
  });
});
