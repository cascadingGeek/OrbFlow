import { Spawner } from "../../../../app/core/orbs/Spawner";
import type { Orb } from "../../../../app/types/types";

const orb = (x: number, y: number, radius: number): Orb => ({
  id: `${x},${y}`,
  label: "",
  value: 1,
  radius,
  x,
  y,
  vx: 0,
  vy: 0,
});

describe("Spawner (spec 0006 AC-4)", () => {
  it("places a bubble inside the chart", () => {
    const spawner = new Spawner(() => 0);
    expect(spawner.anywhere(400, 300, 20)).toEqual({ x: 20, y: 20 });
  });

  it("takes the least overlapping of 8 random places", () => {
    // Candidate 0 sits on the other bubble; candidate 3 is clear of it.
    const places = [0, 0, 0.5, 0.5, 0.5, 0.5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
    const spawner = new Spawner(() => places.shift() ?? 0);
    const other = orb(20, 20, 20);

    const place = spawner.leastCrowded(400, 300, 20, [other]);

    expect(place.x).toBeGreaterThan(100);
  });

  it("uses the first place when there is nothing to overlap", () => {
    const spawner = new Spawner(() => 0.5);
    expect(spawner.leastCrowded(400, 300, 20, [])).toEqual({ x: 200, y: 150 });
  });

  it("moves a place back inside the chart", () => {
    const spawner = new Spawner();
    expect(spawner.clamp({ x: -5, y: 900 }, 400, 300, 30)).toEqual({
      x: 30,
      y: 270,
    });
    expect(spawner.clamp({ x: 10, y: 10 }, 40, 40, 30)).toEqual({
      x: 30,
      y: 30,
    });
  });
});
