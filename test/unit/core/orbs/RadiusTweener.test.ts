import { RadiusTweener } from "@/core/orbs/RadiusTweener";
import type { Orb } from "@/types/types";

const makeOrb = (id: string, radius = 0): Orb => ({
  id,
  label: id,
  value: 1,
  radius,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
});

describe("RadiusTweener", () => {
  it("eases out cubic and ends exactly on the target", () => {
    const tweener = new RadiusTweener();
    const orb = makeOrb("a", 0);
    tweener.start(orb, 100, 1000, 400, "enter");

    tweener.step([orb], 1200);
    expect(orb.radius).toBeCloseTo(100 * (1 - 0.5 ** 3));

    tweener.step([orb], 1400);
    expect(orb.radius).toBe(100);
  });

  it("snaps when the duration is 0", () => {
    const tweener = new RadiusTweener();
    const orb = makeOrb("a", 10);
    tweener.start(orb, 50, 0, 0, "update");

    tweener.step([orb], 0);

    expect(orb.radius).toBe(50);
  });

  it("removes an exited orb and reports it", () => {
    const onExited = jest.fn();
    const tweener = new RadiusTweener(onExited);
    const orb = makeOrb("a", 40);
    tweener.start(orb, 0, 0, 100, "exit");

    expect(tweener.isExiting(orb)).toBe(true);
    expect(tweener.step([orb], 50)).toEqual([orb]);
    expect(tweener.step([orb], 100)).toEqual([]);
    expect(onExited).toHaveBeenCalledWith(orb);
  });

  it("leaves a running tween alone when retargeted to the same radius", () => {
    const tweener = new RadiusTweener();
    const orb = makeOrb("a", 0);
    tweener.start(orb, 100, 0, 400, "enter");
    tweener.step([orb], 200);
    const midway = orb.radius;

    tweener.retarget(orb, 100, 200, 400);
    tweener.step([orb], 200);

    expect(orb.radius).toBe(midway);
    tweener.step([orb], 400);
    expect(orb.radius).toBe(100);
  });

  it("revives an exiting orb from its current radius", () => {
    const tweener = new RadiusTweener();
    const orb = makeOrb("a", 40);
    tweener.start(orb, 0, 0, 100, "exit");
    tweener.step([orb], 50);
    const shrunk = orb.radius;

    tweener.retarget(orb, 40, 50, 100);

    expect(tweener.isExiting(orb)).toBe(false);
    expect(tweener.step([orb], 50)).toEqual([orb]);
    expect(orb.radius).toBe(shrunk);
  });

  it("cancels a tween where it is, without calling onExited", () => {
    const onExited = jest.fn();
    const tweener = new RadiusTweener(onExited);
    const orb = makeOrb("a", 40);
    tweener.start(orb, 0, 0, 100, "exit");
    tweener.step([orb], 50);
    const at = orb.radius;

    tweener.cancel("a");

    expect(tweener.isExiting(orb)).toBe(false);
    expect(tweener.step([orb], 500)).toEqual([orb]);
    expect(orb.radius).toBe(at);
    expect(onExited).not.toHaveBeenCalled();
  });
});
