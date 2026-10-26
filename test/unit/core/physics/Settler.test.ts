import { Settler, type Steppable } from "./Settler";
import type { Orb } from "../types/types";

const makeOrb = (id: string): Orb => ({
  id,
  label: id,
  value: 1,
  radius: 10,
  x: 0,
  y: 0,
  vx: 3,
  vy: -2,
});

describe("Settler", () => {
  it("zeroes velocities, runs 120 ticks with no drift, then zeroes again", () => {
    const seen: { drift: boolean | undefined; vx: number }[] = [];
    const physics: Steppable = {
      update: (orbs, drift) => {
        seen.push({ drift, vx: orbs[0].vx });
        orbs[0].vx = 5; // the engine leaves some speed behind
        return orbs;
      },
    };
    const orbs = [makeOrb("a"), makeOrb("b")];

    new Settler(physics).settle(orbs);

    expect(seen).toHaveLength(120);
    expect(seen.every((call) => call.drift === false)).toBe(true);
    expect(seen[0].vx).toBe(0);
    expect(orbs.every((o) => o.vx === 0 && o.vy === 0)).toBe(true);
  });

  it("runs the number of ticks it is given", () => {
    const update = jest.fn((orbs: Orb[]) => orbs);
    new Settler({ update }, 3).settle([makeOrb("a")]);
    expect(update).toHaveBeenCalledTimes(3);
  });
});
