/**
 * @jest-environment jsdom
 */
import { OrbChart } from "../../../app/core/OrbChart";
import {
  dispatchMouse,
  installFakeCanvas,
  FakeResizeObserver,
  installFakeMatchMedia,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  tap,
  trackListeners,
  type FakeContext,
} from "../../support/fakeDom";
import type { OrbChartConfig, OrbDataInput } from "../../../app/types/types";

const row = (id: string, value: number): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
});

describe("OrbChart popping (spec 0005)", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let listeners: ReturnType<typeof trackListeners>;
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
    listeners = trackListeners();
    charts = [];
  });

  afterEach(() => {
    charts.forEach((chart) => chart.destroy());
    container.remove();
    jest.restoreAllMocks();
  });

  /** Two orbs, A at (100, 150) and B at (300, 150), both radius 40. */
  const make = (config: OrbChartConfig = {}) => {
    const chart = new OrbChart(container, {
      transitionDuration: 0,
      maxRadius: 40,
      ...config,
    });
    charts.push(chart);
    chart.setData([row("a", 1), row("b", 1)]);
    const [a, b] = chart.getData();
    Object.assign(a, { x: 100, y: 150, vx: 0, vy: 0 });
    Object.assign(b, { x: 300, y: 150, vx: 0, vy: 0 });
    return chart;
  };
  const canvas = () => container.querySelector("canvas") as HTMLCanvasElement;
  const buttons = () => [...container.querySelectorAll("button")];
  const region = () =>
    container.querySelector("[aria-live]") as HTMLElement | null;
  const draws = () =>
    contexts.flatMap((c) => c.calls).filter((c) => c.method === "fillRect")
      .length;
  const since = (method: string, mark: number) =>
    contexts[0].calls.slice(mark).filter((c) => c.method === method);
  const ids = (chart: OrbChart) => chart.getData().map((o) => o.id);
  // A droplet's gradient is focused up and left of its own center.
  const droplets = (mark: number) =>
    contexts[0].gradients
      .slice(mark)
      .filter((g) => g.kind === "radial" && g.args[0] < 0).length;
  const gradientMark = () => contexts[0].gradients.length;

  describe("pop (AC-8)", () => {
    it("pops a live bubble once and reports it once", () => {
      const onOrbPop = jest.fn();
      const chart = make({ onOrbPop });
      const a = chart.getData()[0];

      expect(chart.pop("a")).toBe(true);
      expect(chart.pop("a")).toBe(false);
      expect(onOrbPop).toHaveBeenCalledTimes(1);
      expect(onOrbPop).toHaveBeenCalledWith(a);
      expect(ids(chart)).toEqual(["b"]);
      expect(buttons()).toHaveLength(1);
    });

    it("returns false for an unknown id, a shrinking bubble, and after destroy", () => {
      const chart = make({ transitionDuration: 400 });
      expect(chart.pop("zzz")).toBe(false);
      chart.setData([row("a", 1)]);
      expect(chart.pop("b")).toBe(false);
      chart.destroy();
      expect(chart.pop("a")).toBe(false);
    });

    it("can pop a bubble mid grow, using its current radius", () => {
      const chart = new OrbChart(container, { transitionDuration: 400 });
      charts.push(chart);
      chart.setData([row("a", 1)]);
      clock = 100;
      frames.step();
      const r = chart.getData()[0].radius;
      expect(r).toBeGreaterThan(0);
      const mark = contexts[0].calls.length;
      expect(chart.pop("a")).toBe(true);
      clock = 110;
      frames.step();
      expect(since("arc", mark).some((c) => c.args[2] === r)).toBe(true);
    });

    it("can no longer be hit after it popped", () => {
      const onOrbClick = jest.fn();
      const chart = make({ onOrbClick });
      chart.pop("a");
      dispatchMouse(canvas(), "click", 100, 150);
      expect(onOrbClick).not.toHaveBeenCalled();
    });

    it("pushes neighbors gently while moving, and not at all while paused", () => {
      const chart = make({ maxRadius: 40 });
      const b = chart.getData()[1];
      chart.getData()[0].x = 200;
      chart.pop("a");
      expect(b.vx).toBeCloseTo(1 - 100 / 190);

      const paused = make();
      paused.pause();
      const d = paused.getData()[1];
      paused.pop("a");
      expect(d.vx).toBe(0);
    });

    it("pops silently when the bubble has no place yet", () => {
      setElementSize(container, 0, 0);
      const onOrbPop = jest.fn();
      const chart = new OrbChart(container, { onOrbPop });
      charts.push(chart);
      chart.setData([row("a", 1)]);
      const mark = gradientMark();

      expect(chart.pop("a")).toBe(true);
      expect(onOrbPop).toHaveBeenCalledTimes(1);
      frames.step();
      expect(droplets(mark)).toBe(0);
    });

    it("logs a throwing onOrbPop and still finishes the pop", () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      const chart = make({
        onOrbPop: () => {
          throw new Error("boom");
        },
      });
      expect(chart.pop("a")).toBe(true);
      expect(error).toHaveBeenCalled();
      expect(ids(chart)).toEqual(["b"]);
    });
  });

  describe("activate and popOnClick (AC-2, AC-9)", () => {
    it("clicking a bubble calls onOrbClick and never scatters its neighbors", () => {
      const onOrbClick = jest.fn();
      const chart = make({ onOrbClick });
      const b = chart.getData()[1];
      chart.getData()[0].x = 200;
      dispatchMouse(canvas(), "click", 200, 150);
      expect(onOrbClick).toHaveBeenCalledTimes(1);
      expect(b.vx).toBe(0);
      expect(ids(chart)).toEqual(["a", "b"]);
    });

    it("pops after onOrbClick when popOnClick is on, for click, tap, and keys", () => {
      const order: string[] = [];
      const chart = make({
        popOnClick: true,
        restoreOnNextPop: false,
        onOrbClick: (orb) => order.push(`click ${orb.id}`),
        onOrbPop: (orb) => order.push(`pop ${orb.id}`),
      });
      dispatchMouse(canvas(), "click", 100, 150);
      expect(order).toEqual(["click a", "pop a"]);

      tap(canvas(), 300, 150);
      expect(order).toEqual(["click a", "pop a", "click b", "pop b"]);
      const tip = container.querySelector<HTMLElement>(
        ":scope > div[aria-hidden]",
      );
      expect(tip?.style.opacity ?? "0").toBe("0");
      expect(ids(chart)).toEqual([]);
    });

    it("pops from the hidden button (Enter and Space click it)", () => {
      const onOrbPop = jest.fn();
      make({ popOnClick: true, onOrbPop });
      buttons()[1].click();
      expect(onOrbPop).toHaveBeenCalledWith(
        expect.objectContaining({ id: "b" }),
      );
    });

    it("still shows the touch tooltip when a tap does not pop", () => {
      make();
      tap(canvas(), 100, 150);
      expect(
        container.querySelector(":scope > div[aria-hidden]"),
      ).not.toBeNull();
    });
  });

  describe("cursor (AC-1)", () => {
    it("shows the hand only over a live bubble", () => {
      const chart = make();
      expect(canvas().style.cursor).toBe("default");
      dispatchMouse(canvas(), "pointermove", 100, 150);
      expect(canvas().style.cursor).toBe("pointer");
      dispatchMouse(canvas(), "pointermove", 200, 20);
      expect(canvas().style.cursor).toBe("default");
      dispatchMouse(canvas(), "pointermove", 300, 150);
      dispatchMouse(canvas(), "pointerleave");
      expect(canvas().style.cursor).toBe("default");

      dispatchMouse(canvas(), "pointermove", 100, 150);
      chart.pop("a");
      expect(canvas().style.cursor).toBe("default");
    });

    it("ignores touch, and resets on destroy", () => {
      const chart = make();
      tap(canvas(), 100, 150);
      dispatchMouse(canvas(), "pointermove", 100, 150, "touch");
      expect(canvas().style.cursor).toBe("default");
      dispatchMouse(canvas(), "pointermove", 100, 150);
      const el = canvas();
      chart.destroy();
      expect(el.style.cursor).toBe("default");
    });
  });

  it("resets the cursor when setData removes the hovered bubble (AC-1)", () => {
    const chart = make();
    dispatchMouse(canvas(), "pointermove", 100, 150);
    expect(canvas().style.cursor).toBe("pointer");

    chart.setData([row("b", 1)]);

    expect(canvas().style.cursor).toBe("default");
  });

  describe("idle pops (AC-11)", () => {
    it("pops a paused chart in one draw and queues no frame", () => {
      const chart = make();
      chart.pause();
      const before = draws();
      const mark = gradientMark();
      chart.pop("a");
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
      expect(droplets(mark)).toBe(0);

      chart.start();
      expect(ids(chart)).toEqual(["b"]);
    });

    it("pops a still chart in one draw without moving its neighbors", () => {
      const media = installFakeMatchMedia({ matches: true });
      const chart = make();
      const b = chart.getData()[1];
      const at = { x: b.x, y: b.y };
      const before = draws();
      chart.pop("a");
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
      expect({ x: b.x, y: b.y }).toEqual(at);
      media.restore();
    });

    it("pause finishes a burst in flight and draws once, only if something changed", () => {
      const chart = make();
      chart.pop("a");
      const before = draws();
      chart.pause();
      expect(draws()).toBe(before + 1);
      chart.pause();
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
    });

    it("finishes bursts when the chart turns still", () => {
      const chart = make();
      chart.pop("a");
      chart.updateConfig({ reducedMotion: "always" });
      const mark = gradientMark();
      chart.updateConfig({ ariaLabel: "x" });
      expect(droplets(mark)).toBe(0);
    });

    it("keeps drawing a burst while moving, even with no orbs left", () => {
      const chart = make();
      chart.pop("a");
      chart.pop("b");
      clock = 300;
      const mark = gradientMark();
      frames.step();
      expect(droplets(mark)).toBeGreaterThan(0);
      clock = 2000;
      const end = gradientMark();
      frames.step();
      expect(droplets(end)).toBe(0);
      expect(frames.pending()).toBe(1);
    });

    it("turns the film once every 14 s while moving (AC-6)", () => {
      make();
      clock = 3500;
      const mark = contexts[0].gradients.length;
      frames.step();
      const film = contexts[0].gradients
        .slice(mark)
        .find((g) => g.kind === "conic");
      expect(film?.args[0]).toBeCloseTo((200 * Math.PI) / 180 + Math.PI / 2);
    });

    it("does nothing on pause after destroy", () => {
      const chart = make();
      chart.pop("a");
      chart.destroy();
      const before = draws();
      chart.pause();
      expect(draws()).toBe(before);
    });

    it("redraws an idle chart once for each look change (AC-5)", () => {
      const chart = make();
      chart.pause();
      for (const change of [
        { theme: "light" },
        { backgroundColor: "#ffffff" },
        { fontFamily: "Nunito" },
      ] as const) {
        const before = draws();
        chart.updateConfig(change);
        expect(draws()).toBe(before + 1);
      }
      expect(frames.pending()).toBe(0);
    });

    it("warns once for a bad theme and draws the dark look (AC-5)", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const chart = make({ theme: "sepia" as never });
      chart.updateConfig({ theme: "sepia" as never });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("theme");
    });

    it("holds the film at its start angle while paused", () => {
      const chart = make();
      chart.pause();
      clock = 5000;
      const mark = contexts[0].gradients.length;
      chart.updateConfig({ backgroundColor: "#000" });
      const film = contexts[0].gradients
        .slice(mark)
        .find((g) => g.kind === "conic");
      expect(film?.args[0]).toBeCloseTo((200 * Math.PI) / 180);
    });
  });

  describe("ghosts (AC-12)", () => {
    const dashes = (mark: number) => since("setLineDash", mark).length;

    it("leaves a ghost, cleared by setData, and a popped id grows back", () => {
      const chart = make({ popStyle: "ghost" });
      chart.pause();
      let mark = contexts[0].calls.length;
      chart.pop("a");
      expect(dashes(mark)).toBe(1);

      mark = contexts[0].calls.length;
      chart.setData([row("a", 1), row("b", 1)]);
      expect(dashes(mark)).toBe(0);
      expect(ids(chart)).toEqual(["a", "b"]);
    });

    it("switching popStyle to remove clears ghosts", () => {
      const chart = make({ popStyle: "ghost" });
      chart.pause();
      chart.pop("a");
      const mark = contexts[0].calls.length;
      chart.updateConfig({ popStyle: "remove" });
      expect(dashes(mark)).toBe(0);
    });

    it("grows a popped id back in from nothing (AC-12)", () => {
      const chart = make({ popStyle: "ghost", enterStyle: "grow" });
      chart.pop("a");
      chart.updateConfig({ transitionDuration: 400 });

      chart.setData([row("a", 1), row("b", 1)]);

      expect(chart.getData().find((o) => o.id === "a")?.radius).toBe(0);
    });

    it("keeps a ghost at its pixel position when the container resizes (AC-12)", () => {
      const chart = make({ popStyle: "ghost" });
      chart.pause();
      chart.pop("b");
      setElementSize(container, 200, 100);
      const mark = contexts[0].calls.length;

      FakeResizeObserver.instances[0].trigger();

      // Outside the new 200 px canvas, yet not clamped into it.
      const ghost = since("arc", mark).find(
        (c) => c.args[0] === 300 && c.args[2] === 40,
      );
      expect(ghost).toBeDefined();
    });

    it("leaves no ghost by default", () => {
      const chart = make();
      chart.pause();
      const mark = contexts[0].calls.length;
      chart.pop("a");
      expect(dashes(mark)).toBe(0);
    });
  });

  describe("accessibility (AC-13)", () => {
    it("announces each pop in a polite region beside the list", () => {
      const chart = make();
      expect(region()?.parentElement).toBe(container);
      chart.pop("a");
      expect(region()?.textContent).toBe("A popped");
      chart.setData([{ id: "x", label: "", value: 1 }]);
      chart.pop("x");
      expect(region()?.textContent).toBe("x popped");
    });

    it("moves focus to the next bubble when the focused one pops", () => {
      const chart = make();
      buttons()[0].focus();
      chart.pop("a");
      expect(document.activeElement?.textContent).toMatch(/^B/);
    });
  });

  it("moves focus to the list when the last bubble pops (AC-13)", () => {
    const chart = make();
    chart.pop("b");
    buttons()[0].focus();

    chart.pop("a");

    expect(document.activeElement).toBe(container.querySelector("ul"));
  });

  describe("teardown (AC-16)", () => {
    it("drops bursts, ghosts, and the live region, leaving nothing behind", () => {
      const chart = make({ popStyle: "ghost" });
      chart.pop("a");
      chart.destroy();
      chart.destroy();
      expect(container.children).toHaveLength(0);
      expect(listeners.count()).toBe(0);
      expect(frames.pending()).toBe(0);
    });
  });
});
