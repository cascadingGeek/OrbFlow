/**
 * @jest-environment jsdom
 */
import { CanvasInput, type InputConfig } from "@/renderer/dom/CanvasInput";
import { TooltipView } from "@/renderer/dom/TooltipView";
import { dispatchMouse, tap, trackListeners } from "@test/support/fakeDom";
import type { Orb } from "@/types/types";

const makeOrb = (id: string, x: number, y: number, radius = 30): Orb => ({
  id,
  label: id,
  value: 1,
  radius,
  x,
  y,
  vx: 0,
  vy: 0,
});

describe("CanvasInput", () => {
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let config: InputConfig;
  let onCanvasMiss: jest.Mock;
  let onActivate: jest.Mock;
  let listeners: ReturnType<typeof trackListeners>;

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = trackListeners();
    container = document.createElement("div");
    canvas = document.createElement("canvas");
    container.appendChild(canvas);
    document.body.appendChild(container);
    config = {
      enableTooltip: true,
      width: 400,
      height: 300,
      onOrbHover: jest.fn(),
    };
    onCanvasMiss = jest.fn();
    onActivate = jest.fn();
  });

  afterEach(() => {
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const make = (
    orbs: Orb[] = [],
    centerOf: (orb: Orb) => { x: number; y: number } = (orb) => ({
      x: orb.x,
      y: orb.y,
    }),
  ) => {
    const input = new CanvasInput(
      canvas,
      new TooltipView(container, () => config),
      () => config,
      { onActivate, onCanvasMiss, centerOf },
    );
    input.sync(orbs);
    return input;
  };
  const tooltip = () => container.querySelector("div") as HTMLDivElement | null;

  it("picks the orb drawn last when two overlap", () => {
    const below = makeOrb("below", 100, 100);
    const above = makeOrb("above", 110, 100);
    make([below, above]);

    dispatchMouse(canvas, "click", 105, 100);

    expect(onActivate).toHaveBeenCalledWith(above, expect.anything());
  });

  it("cannot hit an orb that has not grown yet", () => {
    make([makeOrb("new", 100, 100, 0)]);

    dispatchMouse(canvas, "click", 100, 100);

    expect(onActivate).not.toHaveBeenCalled();
  });

  it("still forwards every click to the repulsion handler", () => {
    make([]);

    dispatchMouse(canvas, "click", 10, 20);

    expect(onCanvasMiss).toHaveBeenCalledWith(10, 20);
  });

  it("reads touch from pointerdown when the click carries no pointer type", () => {
    make([makeOrb("a", 100, 100)]);
    dispatchMouse(canvas, "pointerdown", 100, 100, "touch");
    const click = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(click, "offsetX", { value: 100 });
    Object.defineProperty(click, "offsetY", { value: 100 });

    canvas.dispatchEvent(click);

    expect(jest.getTimerCount()).toBe(1);
  });

  it("treats pen hover like mouse hover", () => {
    make([makeOrb("a", 100, 100)]);

    dispatchMouse(canvas, "pointermove", 100, 100, "pen");

    expect(tooltip()?.style.opacity).toBe("1");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("restarts the 2500 ms timer on a repeat tap of the same orb", () => {
    make([makeOrb("a", 100, 100)]);
    tap(canvas, 100, 100);
    jest.advanceTimersByTime(2000);

    tap(canvas, 100, 100);
    jest.advanceTimersByTime(2000);

    expect(tooltip()?.style.opacity).toBe("1");
    jest.advanceTimersByTime(500);
    expect(tooltip()?.style.opacity).toBe("0");
  });

  it("creates and removes the tooltip as enableTooltip changes", () => {
    const input = make([]);
    expect(tooltip()).not.toBeNull();

    config.enableTooltip = false;
    input.refresh();
    expect(tooltip()).toBeNull();

    config.enableTooltip = true;
    input.refresh();
    expect(tooltip()).not.toBeNull();
  });

  it("does not throw on a tap when the tooltip is off", () => {
    config.enableTooltip = false;
    make([makeOrb("a", 100, 100)]);

    expect(() => tap(canvas, 100, 100)).not.toThrow();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("removes every listener, the timer, and the tooltip on dispose", () => {
    const input = make([makeOrb("a", 100, 100)]);
    tap(canvas, 100, 100);

    input.dispose();
    input.dispose();

    expect(listeners.count((t) => t === canvas)).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(tooltip()).toBeNull();
  });

  it("ignores events after dispose", () => {
    const input = make([makeOrb("a", 100, 100)]);
    input.dispose();

    dispatchMouse(canvas, "click", 100, 100);

    expect(onActivate).not.toHaveBeenCalled();
    expect(onCanvasMiss).not.toHaveBeenCalled();
  });

  it("clears the hover without a second null when the orb is already gone", () => {
    const orb = makeOrb("a", 100, 100);
    const input = make([orb]);
    dispatchMouse(canvas, "pointermove", 100, 100);

    input.sync([]);
    input.sync([]);

    expect(config.onOrbHover).toHaveBeenCalledTimes(2);
    expect(config.onOrbHover).toHaveBeenLastCalledWith(null);
  });

  describe("the drawn center (spec 0006 AC-5)", () => {
    it("hits an orb where it is drawn, not at its resting place", () => {
      const orb = makeOrb("a", 100, 100, 20);
      make([orb], (o) => ({ x: o.x, y: o.y + 200 }));

      dispatchMouse(canvas, "click", 100, 100);
      expect(onActivate).not.toHaveBeenCalled();
      expect(onCanvasMiss).toHaveBeenCalledWith(100, 100);

      dispatchMouse(canvas, "click", 100, 300);
      expect(onActivate).toHaveBeenCalledWith(orb, expect.any(MouseEvent));
    });

    it("shows the hand cursor over the drawn center only", () => {
      make([makeOrb("a", 100, 100, 20)], (o) => ({ x: o.x, y: o.y + 200 }));

      dispatchMouse(canvas, "pointermove", 100, 100);
      expect(canvas.style.cursor).toBe("default");
      dispatchMouse(canvas, "pointermove", 100, 300);
      expect(canvas.style.cursor).toBe("pointer");
    });

    it("cannot reach an orb parked below the canvas with a pointer inside it", () => {
      make([makeOrb("a", 100, 100, 20)], (o) => ({ x: o.x, y: o.y + 500 }));

      for (const y of [0, 100, 299]) dispatchMouse(canvas, "click", 100, y);

      expect(onActivate).not.toHaveBeenCalled();
    });
  });
});
