import { PhysicsEngine } from "./physics";
import type { Orb } from "../types/types";

function makeOrb(overrides: Partial<Orb> = {}): Orb {
  return {
    id: "orb",
    label: "Orb",
    value: 1,
    radius: 20,
    x: 200,
    y: 200,
    vx: 0,
    vy: 0,
    ...overrides,
  };
}

function distance(a: Orb, b: Orb) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe("PhysicsEngine", () => {
  beforeEach(() => {
    // 0.5 cancels the brownian jitter, so every step is deterministic.
    jest.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("movement", () => {
    it("moves an orb by its velocity and damps it", () => {
      const engine = new PhysicsEngine(400, 400, { damping: 0.5 });
      const orb = makeOrb({ vx: 1, vy: -1 });

      engine.update([orb]);

      expect(orb.x).toBeCloseTo(201);
      expect(orb.y).toBeCloseTo(199);
      expect(orb.vx).toBeCloseTo(0.5);
      expect(orb.vy).toBeCloseTo(-0.5);
    });

    it("caps speed at 2 so orbs never fly off chaotically", () => {
      const engine = new PhysicsEngine(1000, 1000, { damping: 1 });
      const orb = makeOrb({ x: 500, y: 500, vx: 30, vy: 40 });

      engine.update([orb]);

      expect(Math.hypot(orb.vx, orb.vy)).toBeCloseTo(2);
    });

    it("stops damping once velocity is below minVelocity", () => {
      const engine = new PhysicsEngine(400, 400, {
        damping: 0.5,
        minVelocity: 0.1,
      });
      const orb = makeOrb({ vx: 0.05, vy: 0 });

      engine.update([orb]);

      expect(orb.vx).toBeCloseTo(0.05);
    });
  });

  describe("boundaries", () => {
    it.each([
      ["left", { x: 5 }, "x", 20, "vx", 1],
      ["right", { x: 395 }, "x", 380, "vx", -1],
      ["top", { y: 5 }, "y", 20, "vy", 1],
      ["bottom", { y: 395 }, "y", 380, "vy", -1],
    ] as const)(
      "keeps an orb inside the %s wall and pushes it back inward",
      (_wall, start, axis, clamped, velocityAxis, direction) => {
        const engine = new PhysicsEngine(400, 400);
        const orb = makeOrb(start);

        engine.update([orb]);

        expect(orb[axis]).toBeCloseTo(clamped);
        expect(Math.sign(orb[velocityAxis])).toBe(direction);
      },
    );

    it("uses the new size after updateDimensions (resize)", () => {
      const engine = new PhysicsEngine(400, 400);
      const orb = makeOrb({ x: 350 });

      engine.updateDimensions(300, 400);
      engine.update([orb]);

      expect(orb.x).toBeCloseTo(280);
    });
  });

  describe("collisions", () => {
    it("separates two overlapping orbs until they just touch", () => {
      const engine = new PhysicsEngine(400, 400);
      const a = makeOrb({ id: "a", x: 190 });
      const b = makeOrb({ id: "b", x: 210 });

      engine.update([a, b]);

      expect(distance(a, b)).toBeGreaterThanOrEqual(40 - 1e-9);
    });

    it("pushes overlapping orbs apart along the line between them", () => {
      const engine = new PhysicsEngine(400, 400);
      const a = makeOrb({ id: "a", x: 190 });
      const b = makeOrb({ id: "b", x: 210 });

      engine.update([a, b]);

      expect(a.vx).toBeLessThan(0);
      expect(b.vx).toBeGreaterThan(0);
    });

    it("leaves orbs that do not touch alone", () => {
      const engine = new PhysicsEngine(400, 400);
      const a = makeOrb({ id: "a", x: 100 });
      const b = makeOrb({ id: "b", x: 300 });

      engine.update([a, b]);

      expect(a.x).toBe(100);
      expect(b.x).toBe(300);
      expect(a.vx).toBe(0);
    });

    it("detects overlap across a spatial grid cell boundary", () => {
      const engine = new PhysicsEngine(400, 400);
      const a = makeOrb({ id: "a", x: 90 });
      const b = makeOrb({ id: "b", x: 110 });

      engine.update([a, b]);

      expect(distance(a, b)).toBeGreaterThanOrEqual(40 - 1e-9);
    });

    // Known bug: the spatial grid only checks neighbours one cell away.
    // Remove `.failing` once fixed.
    it.failing(
      "separates two max size orbs whose centres are two grid cells apart",
      () => {
        // Default maxRadius is 80, so two big orbs overlap at any distance
        // under 160, but the grid only checks neighbours one 100px cell away.
        const engine = new PhysicsEngine(1000, 400);
        const a = makeOrb({ id: "a", radius: 80, x: 195, y: 200 });
        const b = makeOrb({ id: "b", radius: 80, x: 305, y: 200 });

        engine.update([a, b]);

        expect(distance(a, b)).toBeGreaterThanOrEqual(160 - 1e-9);
      },
    );

    it("does not produce NaN when two orbs sit at the exact same point", () => {
      const engine = new PhysicsEngine(400, 400);
      const a = makeOrb({ id: "a" });
      const b = makeOrb({ id: "b" });

      engine.update([a, b]);

      for (const value of [a.x, a.y, a.vx, a.vy, b.x, b.y, b.vx, b.vy]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  });

  describe("mouse repulsion", () => {
    it("pushes orbs inside the radius away from the pointer", () => {
      const engine = new PhysicsEngine(400, 400);
      const near = makeOrb({ id: "near", x: 220, y: 200 });
      engine.orbsArray = [near];

      engine.applyMouseRepulsion(200, 200, 150);

      expect(near.vx).toBeGreaterThan(0);
      expect(near.vy).toBeCloseTo(0);
    });

    it("ignores orbs outside the radius", () => {
      const engine = new PhysicsEngine(400, 400);
      const far = makeOrb({ id: "far", x: 390, y: 390 });
      engine.orbsArray = [far];

      engine.applyMouseRepulsion(0, 0, 150);

      expect(far.vx).toBe(0);
      expect(far.vy).toBe(0);
    });
  });

  describe("large datasets", () => {
    beforeEach(() => {
      // The Math.random spy costs more than the physics itself at this
      // scale; real jitter is fine because these tests assert invariants.
      jest.restoreAllMocks();
    });

    function seededOrbs(count: number, width: number, height: number) {
      let seed = 42;
      const next = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      return Array.from({ length: count }, (_, i) =>
        makeOrb({
          id: `orb-${i}`,
          radius: 4 + next() * 10,
          x: 20 + next() * (width - 40),
          y: 20 + next() * (height - 40),
          vx: next() - 0.5,
          vy: next() - 0.5,
        }),
      );
    }

    it("keeps 1000 orbs finite and near the canvas over 60 frames", () => {
      const width = 1600;
      const height = 1000;
      const engine = new PhysicsEngine(width, height);
      const orbs = seededOrbs(1000, width, height);

      for (let frame = 0; frame < 60; frame++) engine.update(orbs);

      for (const orb of orbs) {
        expect(Number.isFinite(orb.x) && Number.isFinite(orb.y)).toBe(true);
        expect(orb.x).toBeGreaterThanOrEqual(-orb.radius);
        expect(orb.x).toBeLessThanOrEqual(width + orb.radius);
        expect(orb.y).toBeGreaterThanOrEqual(-orb.radius);
        expect(orb.y).toBeLessThanOrEqual(height + orb.radius);
      }
    });
  });
});
