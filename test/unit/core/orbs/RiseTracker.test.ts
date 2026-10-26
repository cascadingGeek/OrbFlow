import { RiseTracker, type RiseSettings } from "./RiseTracker";
import type { Orb } from "../types/types";

const orb = (id: string, y = 100, radius = 20): Orb => ({
  id,
  label: id,
  value: 1,
  radius,
  x: 50,
  y,
  vx: 0,
  vy: 0,
});

describe("RiseTracker (spec 0006 AC-2)", () => {
  let idle: boolean;
  let gate: boolean;
  let openGate: jest.Mock;
  let duration: number;
  let settings: RiseSettings;

  const make = (random = () => 0.5) => new RiseTracker(settings, random);

  beforeEach(() => {
    idle = false;
    gate = true;
    duration = 400;
    openGate = jest.fn(() => {
      gate = true;
    });
    settings = {
      config: () => ({
        transitionDuration: duration,
        floatAmplitude: 2,
        enterStyle: "rise",
      }),
      idle: () => idle,
      gateOpen: () => gate,
      openGate,
    };
  });

  it("draws a bubble fully below the edge at t = 0, then eases up to 0", () => {
    const tracker = make();
    const a = orb("a", 100, 20);
    tracker.start([a], 1000);

    // drop = height - y + radius + amplitude = 300 - 100 + 20 + 2
    expect(tracker.offsetOf(a, 1000, 300)).toBe(222);
    // Halfway through 800 ms: e = 1 - 0.5 ** 3 = 0.875.
    expect(tracker.offsetOf(a, 1400, 300)).toBeCloseTo(222 * 0.125);
    expect(tracker.offsetOf(a, 1800, 300)).toBe(0);
    expect(tracker.offsetOf(a, 5000, 300)).toBe(0);
  });

  it("falls back to the default float amplitude when the config leaves it out", () => {
    settings.config = () => ({
      transitionDuration: 400,
      floatAmplitude: undefined,
      enterStyle: "rise",
    });
    const tracker = make();
    const a = orb("a", 100, 20);
    tracker.start([a], 0);
    // drop = 300 - 100 + 20 + the default amplitude of 2
    expect(tracker.offsetOf(a, 0, 300)).toBe(222);
  });

  it("gives one bubble no delay and a batch a random delay each", () => {
    const delays = [0, 1];
    const tracker = make(() => delays.shift() ?? 0);
    const [a, b, c] = [orb("a"), orb("b"), orb("c")];
    tracker.start([a], 0);
    expect(tracker.offsetOf(a, 0, 300)).toBeGreaterThan(0);
    expect(tracker.offsetOf(a, 200, 300)).toBeLessThan(
      tracker.offsetOf(a, 0, 300),
    );

    tracker.start([b, c], 0);
    // b has delay 0, c has the full 1.5 * 400 = 600 ms.
    expect(tracker.offsetOf(b, 100, 300)).toBeLessThan(
      tracker.offsetOf(b, 0, 300),
    );
    expect(tracker.offsetOf(c, 600, 300)).toBe(tracker.offsetOf(c, 0, 300));
    expect(tracker.offsetOf(c, 1400, 300)).toBe(0);
  });

  it("does nothing while idle or when transitionDuration is 0", () => {
    const tracker = make();
    idle = true;
    tracker.start([orb("a")], 0);
    tracker.park(["b"]);
    idle = false;
    expect(tracker.offsetOf(orb("a"), 0, 300)).toBe(0);
    expect(tracker.hasParked()).toBe(false);

    duration = 0;
    tracker.start([orb("a")], 0);
    expect(tracker.offsetOf(orb("a"), 0, 300)).toBe(0);
  });

  it("parks new bubbles until released, then rises them as one batch", () => {
    gate = false;
    const tracker = make(() => 0);
    const [a, b] = [orb("a"), orb("b")];
    tracker.enter([a, b], new Set(), 0);

    expect(tracker.hasParked()).toBe(true);
    // Parked bubbles stay fully below the edge however long they wait.
    expect(tracker.offsetOf(a, 99999, 300)).toBe(222);

    tracker.release(5000);
    expect(tracker.hasParked()).toBe(false);
    expect(tracker.offsetOf(a, 5800, 300)).toBe(0);
  });

  it("only treats ids it was not told about as entering", () => {
    const tracker = make();
    const [a, b] = [orb("a"), orb("b")];
    tracker.enter([a, b], new Set(["a"]), 0);
    expect(tracker.offsetOf(a, 0, 300)).toBe(0);
    expect(tracker.offsetOf(b, 0, 300)).toBeGreaterThan(0);
  });

  it("does not rise `grow` bubbles", () => {
    settings.config = () => ({
      transitionDuration: 400,
      floatAmplitude: 2,
      enterStyle: "grow",
    });
    const tracker = make();
    tracker.enter([orb("a")], new Set(), 0);
    expect(tracker.offsetOf(orb("a"), 0, 300)).toBe(0);
  });

  it("forgets finished rises on step, and keeps parked ones", () => {
    const tracker = make();
    const a = orb("a");
    tracker.start([a], 0);
    tracker.park(["b"]);
    tracker.step(800);
    expect(tracker.hasParked()).toBe(true);
    expect(tracker.finishAll()).toBe(true);
    tracker.start([a], 0);
    tracker.step(800);
    expect(tracker.finishAll()).toBe(false);
  });

  it("finishAll ends everything and opens the gate for good when bubbles were parked", () => {
    gate = false;
    const tracker = make();
    tracker.park(["a"]);
    expect(tracker.finishAll()).toBe(true);
    expect(openGate).toHaveBeenCalledTimes(1);
    expect(tracker.hasParked()).toBe(false);
    expect(tracker.offsetOf(orb("a"), 0, 300)).toBe(0);

    tracker.start([orb("b")], 0);
    tracker.finishAll();
    expect(openGate).toHaveBeenCalledTimes(1);
  });

  it("forgets one bubble, or all of them", () => {
    const tracker = make();
    const [a, b] = [orb("a"), orb("b")];
    tracker.start([a], 0);
    tracker.forget("a");
    expect(tracker.offsetOf(a, 0, 300)).toBe(0);
    tracker.start([b], 0);
    tracker.clear();
    expect(tracker.offsetOf(b, 0, 300)).toBe(0);
  });
});
