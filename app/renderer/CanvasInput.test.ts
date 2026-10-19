/**
 * @jest-environment jsdom
 */
import { CanvasInput, type InputConfig } from "./CanvasInput";
import { dispatchMouse, tap, trackListeners } from "../test-support/fakeDom";
import type { Orb } from "../types/types";

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
  let onCanvasClick: jest.Mock;
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
      onOrbClick: jest.fn(),
      onOrbHover: jest.fn(),
    };
    onCanvasClick = jest.fn();
  });

  afterEach(() => {
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const make = (orbs: Orb[] = []) => {
    const input = new CanvasInput(
      canvas,
      container,
      () => config,
      onCanvasClick,
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

    expect(config.onOrbClick).toHaveBeenCalledWith(above, expect.anything());
  });

  it("cannot hit an orb that has not grown yet", () => {
    make([makeOrb("new", 100, 100, 0)]);

    dispatchMouse(canvas, "click", 100, 100);

    expect(config.onOrbClick).not.toHaveBeenCalled();
  });

  it("still forwards every click to the repulsion handler", () => {
    make([]);

    dispatchMouse(canvas, "click", 10, 20);

    expect(onCanvasClick).toHaveBeenCalledWith(10, 20);
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
    expect(config.onOrbClick).toHaveBeenCalledTimes(1);
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

    expect(config.onOrbClick).not.toHaveBeenCalled();
    expect(onCanvasClick).not.toHaveBeenCalled();
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
});
