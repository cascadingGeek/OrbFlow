/**
 * @jest-environment jsdom
 */
import { OrbChart } from "../../../app/core/OrbChart";
import {
  FakeResizeObserver,
  defined,
  dispatchMouse,
  installFakeCanvas,
  installFakeMatchMedia,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  tap,
  trackListeners,
  type FakeContext,
} from "../../support/fakeDom";
import type {
  Orb,
  OrbChartConfig,
  OrbDataInput,
} from "../../../app/types/types";

const row = (id: string, value: number, extra = {}): OrbDataInput => ({
  id,
  label: id.toUpperCase(),
  value,
  ...extra,
});
const DATA = [row("a", 10), row("b", 40), row("c", 25), row("d", 60)];

describe("OrbChart reduced motion", () => {
  let container: HTMLDivElement;
  let frames: ReturnType<typeof installFrameQueue>;
  let media: ReturnType<typeof installFakeMatchMedia>;
  let contexts: FakeContext[];
  let clock: number;
  let charts: OrbChart[];

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    media = installFakeMatchMedia();
    clock = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    // A fixed sequence, so orbs start at different places.
    let seed = 7;
    jest.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    charts = [];
  });

  afterEach(() => {
    charts.forEach((chart) => chart.destroy());
    container.remove();
    media.restore();
    jest.restoreAllMocks();
  });

  const make = (config: OrbChartConfig = {}, data: OrbDataInput[] = DATA) => {
    const chart = new OrbChart(container, {
      maxRadius: 50,
      floatAmplitude: 10,
      ...config,
    });
    charts.push(chart);
    if (data.length) chart.setData(data);
    return chart;
  };
  const draws = () =>
    contexts.flatMap((c) => c.calls).filter((c) => c.method === "fillRect")
      .length;
  const tooltip = () =>
    container.querySelector(":scope > div[aria-hidden]") as HTMLDivElement;
  const snapshot = (chart: OrbChart) =>
    chart.getData().map((o) => [o.id, o.x, o.y, o.radius]);
  const overlap = (orbs: Orb[]) => {
    let worst = 0;
    for (const a of orbs) {
      for (const b of orbs) {
        if (a === b) continue;
        const gap = a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y);
        worst = Math.max(worst, gap);
      }
    }
    return worst;
  };

  describe("the setting (AC-7)", () => {
    it.each([
      ["always", false, true],
      ["never", true, false],
      ["auto", true, true],
      ["auto", false, false],
      [undefined, true, true],
    ] as const)(
      "%s with system %s is reduced: %s",
      (setting, system, reduced) => {
        media.fire(system);
        const chart = make({ reducedMotion: setting });
        chart.start();
        expect(frames.pending()).toBe(reduced ? 0 : 1);
      },
    );

    it("counts as not reduced when matchMedia does not exist", () => {
      media.restore();
      const chart = make({ reducedMotion: "auto" });
      chart.start();
      expect(frames.pending()).toBe(1);
    });

    it("warns once for a bad value and falls back to auto", () => {
      const chart = make({ reducedMotion: "sometimes" as "auto" });
      expect(console.warn).toHaveBeenCalledTimes(1);
      chart.updateConfig({ ariaLabel: "x" });
      chart.updateConfig({ maxRadius: 45 });
      expect(console.warn).toHaveBeenCalledTimes(1);
      chart.start();
      expect(frames.pending()).toBe(1);
    });

    it("follows a change of the system setting", () => {
      const chart = make();
      chart.start();
      expect(frames.pending()).toBe(1);
      media.fire(true);
      expect(frames.pending()).toBe(0);
      media.fire(false);
      expect(frames.pending()).toBe(1);
      expect(chart.getData()).toHaveLength(4);
    });

    it("listens even for always and never, so a later switch to auto works", () => {
      expect(media.listenerCount()).toBe(0);
      const chart = make({ reducedMotion: "never" });
      expect(media.listenerCount()).toBe(1);
      chart.start();
      media.fire(true);
      expect(frames.pending()).toBe(1);
      chart.updateConfig({ reducedMotion: "auto" });
      expect(frames.pending()).toBe(0);
    });

    it("works with the old addListener API and removes it on destroy", () => {
      media.restore();
      media = installFakeMatchMedia({ legacy: true });
      const chart = make();
      expect(media.listenerCount()).toBe(1);
      chart.start();
      media.fire(true);
      expect(frames.pending()).toBe(0);
      chart.destroy();
      expect(media.listenerCount()).toBe(0);
    });

    it("removes the media listener on destroy", () => {
      const chart = make();
      chart.destroy();
      expect(media.listenerCount()).toBe(0);
    });
  });

  describe("still mode (AC-8)", () => {
    it("draws once on start and queues no frame", () => {
      const chart = make({ reducedMotion: "always" });
      const before = draws();
      chart.start();
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
      clock += 5000;
      expect(frames.pending()).toBe(0);
    });

    it("draws every orb at its resting place with no float", () => {
      const chart = make({ reducedMotion: "always" });
      chart.start();
      const arcs = contexts
        .flatMap((c) => c.calls)
        .filter(
          (c) => c.method === "arc" && c.args[2] === chart.getData()[0].radius,
        );
      const orb = chart.getData()[0];
      expect(arcs.length).toBeGreaterThan(0);
      expect(
        arcs.every((c) => c.args[0] === orb.x && c.args[1] === orb.y),
      ).toBe(true);
    });

    it("floats in normal mode, so the check above has teeth", () => {
      const chart = make({ reducedMotion: "never", transitionDuration: 0 });
      clock = 700;
      chart.start();
      frames.step();
      const orb = chart.getData()[0];
      expect(orb.radius).toBeGreaterThan(0);
      const centers = contexts
        .flatMap((c) => c.calls)
        .filter((c) => c.method === "arc" && c.args[2] === orb.radius);
      expect(centers.some((c) => c.args[1] !== orb.y)).toBe(true);
    });

    it("snaps every size change", () => {
      const chart = make({ reducedMotion: "always", transitionDuration: 400 });
      const radii = chart.getData().map((o) => o.radius);
      expect(radii.every((r) => r > 0)).toBe(true);
      chart.setData([row("a", 60), row("b", 5)]);
      const [a, b] = chart.getData();
      expect(a.radius).toBe(50);
      expect(b.radius).toBeCloseTo(50 * Math.sqrt(5 / 60));
      expect(chart.getData()).toHaveLength(2);
    });

    it("skips repulsion, so no hidden velocity builds up", () => {
      const chart = make({ reducedMotion: "always" });
      chart.start();
      const [orb] = chart.getData();
      tap(defined(container.querySelector("canvas")), orb.x + 3, orb.y + 3);
      expect(chart.getData().every((o) => o.vx === 0 && o.vy === 0)).toBe(true);
    });

    it("keeps hover and tap tooltips working", () => {
      const onOrbHover = jest.fn();
      const onOrbClick = jest.fn();
      const chart = make({ reducedMotion: "always", onOrbHover, onOrbClick });
      const [orb] = chart.getData();
      const canvas = defined(container.querySelector("canvas"));
      dispatchMouse(canvas, "pointermove", orb.x, orb.y);
      expect(tooltip().style.opacity).toBe("1");
      expect(onOrbHover).toHaveBeenCalledWith(orb);
      dispatchMouse(canvas, "click", orb.x, orb.y);
      expect(onOrbClick).toHaveBeenCalledTimes(1);
    });

    it("turns the tooltip fade off, and back on with the setting", () => {
      const chart = make({ reducedMotion: "always" });
      expect(tooltip().style.transition).toBe("none");
      chart.updateConfig({ reducedMotion: "never" });
      expect(tooltip().style.transition).toBe("opacity 0.2s");
      chart.updateConfig({ reducedMotion: "always", enableTooltip: false });
      chart.updateConfig({ enableTooltip: true });
      expect(tooltip().style.transition).toBe("none");
    });

    it("draws once when an image arrives while idle", () => {
      const images: HTMLImageElement[] = [];
      jest.spyOn(window, "Image").mockImplementation(() => {
        const img = document.createElement("img");
        images.push(img);
        return img;
      });
      const chart = make({ reducedMotion: "always" }, [
        row("a", 1, { imageUrl: "https://x.test/a.png" }),
      ]);
      const before = draws();
      images[0].onload?.(new Event("load"));
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
      chart.destroy();
    });
  });

  describe("settle once (AC-9)", () => {
    it("separates overlapping orbs and leaves them still", () => {
      const chart = make({ reducedMotion: "always" });
      const orbs = chart.getData();
      expect(overlap(orbs)).toBeLessThan(1);
      expect(orbs.every((o) => o.vx === 0 && o.vy === 0)).toBe(true);
      const where = snapshot(chart);
      clock += 10000;
      expect(snapshot(chart)).toEqual(where);
      expect(
        orbs.every(
          (o) =>
            o.x >= o.radius - 1 &&
            o.x <= 400 - o.radius + 1 &&
            o.y >= o.radius - 1 &&
            o.y <= 300 - o.radius + 1,
        ),
      ).toBe(true);
    });

    it("draws once per setData and queues nothing", () => {
      const chart = make({ reducedMotion: "always" });
      const before = draws();
      chart.setData([...DATA, row("e", 33)]);
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
    });

    it("keeps orbs that already have a place near where they were", () => {
      const chart = make({ reducedMotion: "always" });
      const before = chart.getData().map((o) => ({ id: o.id, x: o.x, y: o.y }));
      chart.setData(DATA.map((d) => ({ ...d, label: d.label + "!" })));
      for (const o of chart.getData()) {
        const was = defined(before.find((b) => b.id === o.id));
        expect(Math.hypot(o.x - was.x, o.y - was.y)).toBeLessThan(1);
      }
    });

    it("runs again on a resize and on a radius change", () => {
      const chart = make({ reducedMotion: "always" });
      let before = draws();
      setElementSize(container, 300, 250);
      FakeResizeObserver.instances[0].trigger();
      expect(draws()).toBe(before + 1);
      const inside = chart
        .getData()
        .every((o) => o.x <= 300 - o.radius + 1 && o.y <= 250 - o.radius + 1);
      expect(inside).toBe(true);

      before = draws();
      chart.updateConfig({ maxRadius: 40 });
      expect(draws()).toBe(before + 1);
      expect(Math.max(...chart.getData().map((o) => o.radius))).toBe(40);
      expect(frames.pending()).toBe(0);
    });

    it("draws once for a look change and does not move orbs", () => {
      const chart = make({ reducedMotion: "always" });
      const where = snapshot(chart);
      const before = draws();
      chart.updateConfig({ backgroundColor: "#111111" });
      expect(draws()).toBe(before + 1);
      expect(snapshot(chart)).toEqual(where);
    });

    it("waits for a container with a size, then settles on the first resize", () => {
      setElementSize(container, 0, 0);
      const chart = make({ reducedMotion: "always" });
      const hidden = draws();
      expect(chart.getData().every((o) => o.x === 0 && o.y === 0)).toBe(true);
      setElementSize(container, 400, 300);
      FakeResizeObserver.instances[0].trigger();
      expect(draws()).toBeGreaterThan(hidden);
      expect(overlap(chart.getData())).toBeLessThan(1);
      expect(chart.getData().some((o) => o.x > 0)).toBe(true);
    });

    it("drops an exiting orb at once when the chart goes still mid shrink", () => {
      const chart = make({ transitionDuration: 400, reducedMotion: "never" });
      chart.start();
      chart.setData([row("a", 10)]);
      expect(container.querySelectorAll("li")).toHaveLength(1);
      clock += 100;
      frames.step();
      chart.updateConfig({ reducedMotion: "always" });
      expect(frames.pending()).toBe(0);
      const radii = chart.getData().map((o) => o.radius);
      expect(radii).toEqual([50]);
    });
  });

  describe("live switch and pause (AC-10)", () => {
    it("into still stops the loop, settles, and draws once", () => {
      const chart = make();
      chart.start();
      const before = draws();
      media.fire(true);
      expect(frames.pending()).toBe(0);
      expect(draws()).toBe(before + 1);
      expect(chart.getData().every((o) => o.vx === 0 && o.vy === 0)).toBe(true);
      expect(overlap(chart.getData())).toBeLessThan(1);
    });

    it("out of still restarts the loop", () => {
      const chart = make({ reducedMotion: "always" });
      chart.start();
      chart.updateConfig({ reducedMotion: "never" });
      expect(frames.pending()).toBe(1);
      frames.step(2);
      expect(frames.pending()).toBe(1);
    });

    it("keeps a user pause through every flip, and never moves a paused chart", () => {
      const chart = make();
      chart.start();
      chart.pause();
      const where = snapshot(chart);
      const velocities = chart.getData().map((o) => [o.vx, o.vy]);

      media.fire(true);
      expect(snapshot(chart)).toEqual(where);
      expect(chart.getData().map((o) => [o.vx, o.vy])).toEqual(velocities);
      expect(frames.pending()).toBe(0);

      media.fire(false);
      expect(frames.pending()).toBe(0);
    });

    it("runs the owed settle before the one draw of start()", () => {
      const chart = make();
      chart.start();
      chart.pause();
      media.fire(true);
      const before = draws();
      chart.start();
      expect(draws()).toBe(before + 1);
      expect(frames.pending()).toBe(0);
      expect(chart.getData().every((o) => o.vx === 0 && o.vy === 0)).toBe(true);
      expect(overlap(chart.getData())).toBeLessThan(1);
    });

    it("restarts only a chart that wanted to run", () => {
      const chart = make({}, []);
      media.fire(true);
      media.fire(false);
      expect(frames.pending()).toBe(0);
      chart.setData(DATA); // autoStart records the wish
      expect(frames.pending()).toBe(1);
      media.fire(true);
      media.fire(false);
      expect(frames.pending()).toBe(1);
    });

    it("lets setData start a chart that was never started", () => {
      media.fire(true);
      const chart = make();
      expect(frames.pending()).toBe(0);
      media.fire(false);
      expect(frames.pending()).toBe(1);
      expect(chart.getData()).toHaveLength(4);
    });
  });

  describe("teardown (AC-11)", () => {
    it("leaves no listener, frame, or element behind in still mode", () => {
      const listeners = trackListeners();
      const chart = make({ reducedMotion: "always" });
      chart.start();
      chart.destroy();
      expect(container.children).toHaveLength(0);
      expect(media.listenerCount()).toBe(0);
      expect(frames.pending()).toBe(0);
      expect(
        listeners.count((t) => t === container || t instanceof HTMLElement),
      ).toBe(0);
    });
  });
});
