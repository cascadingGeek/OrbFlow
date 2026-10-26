import { OrbReconciler } from "../../../../app/core/orbs/OrbReconciler";
import { RadiusTweener } from "../../../../app/core/orbs/RadiusTweener";
import { ConfigResolver } from "../../../../app/core/config/ConfigResolver";

describe("OrbReconciler", () => {
  const config = new ConfigResolver().resolve(
    { width: 400, height: 300 },
    { width: 0, height: 0 },
  );
  const item = (id: string) => ({ id, label: id, value: 1 });

  it("gives an orb the same float phase however the list changes", () => {
    const reconciler = new OrbReconciler(new RadiusTweener(), () => 0.5);

    const first = reconciler.reconcile([], [item("a"), item("b")], config, 0);
    const phaseB = reconciler.phaseOf(first[1]);
    const second = reconciler.reconcile(
      first,
      [item("c"), item("b")],
      config,
      0,
    );

    const sameB = second.find((o) => o.id === "b");
    expect(sameB && reconciler.phaseOf(sameB)).toBe(phaseB);
    expect(phaseB).not.toBe(reconciler.phaseOf(first[0]));
  });

  it("lists accepted orbs in input order, then exiting orbs", () => {
    const reconciler = new OrbReconciler(new RadiusTweener(), () => 0.5);
    const first = reconciler.reconcile([], [item("a"), item("b")], config, 0);

    const next = reconciler.reconcile(first, [item("c"), item("b")], config, 0);

    expect(next.map((o) => o.id)).toEqual(["c", "b", "a"]);
  });
});

describe("OrbReconciler target radius and colour", () => {
  const resolver = new ConfigResolver();
  const sized = (extra = {}) =>
    resolver.resolve(
      { width: 400, height: 300, minRadius: 20, maxRadius: 80, ...extra },
      { width: 0, height: 0 },
    );
  const make = () => {
    const tweener = new RadiusTweener();
    return { tweener, reconciler: new OrbReconciler(tweener, () => 0.5) };
  };
  const radiiAfterSettling = (values: number[], config = sized()): number[] => {
    const { tweener, reconciler } = make();
    const orbs = reconciler.reconcile(
      [],
      values.map((value, i) => ({ id: `o${i}`, label: "x", value })),
      { ...config, transitionDuration: 0 },
      0,
    );
    tweener.step(orbs, 0);
    return orbs.map((o) => o.radius);
  };

  it("gives area in proportion to value, the largest at maxRadius (AC-3)", () => {
    const [small, big] = radiiAfterSettling([25, 100]);
    expect(big).toBe(80);
    expect(small).toBe(40);
    expect((big / small) ** 2).toBeCloseTo(4);
  });

  it("sizes the spec's example values with the default floor of 8 (AC-3)", () => {
    const config = resolver.resolve(
      { width: 400, height: 300 },
      { width: 0, height: 0 },
    );
    const [btc, small] = radiiAfterSettling([95.5, 3.2], config);
    expect(btc).toBe(80);
    expect(small).toBeCloseTo(80 * Math.sqrt(3.2 / 95.5));
  });

  it("gives a value of 0, and every value when all are 0, the floor (AC-3)", () => {
    expect(radiiAfterSettling([0, 50])).toEqual([20, 80]);
    expect(radiiAfterSettling([0, 0])).toEqual([20, 20]);
  });

  it("uses maxRadius as the floor when minRadius is larger (AC-3)", () => {
    expect(
      radiiAfterSettling([1, 100], sized({ minRadius: 90, maxRadius: 50 })),
    ).toEqual([50, 50]);
  });

  it("shrinks every other orb toward minRadius when one huge value arrives", () => {
    const radii = radiiAfterSettling([10, 20, 1_000_000]);

    expect(radii[2]).toBe(80);
    expect(radii[0]).toBe(20);
    expect(radii[1]).toBeCloseTo(20, 2);
  });

  it("gives equal values maxRadius", () => {
    expect(radiiAfterSettling([7, 7])).toEqual([80, 80]);
  });

  it("never produces a NaN or negative radius for a value of 0", () => {
    for (const radius of radiiAfterSettling([0])) {
      expect(Number.isNaN(radius)).toBe(false);
      expect(radius).toBeGreaterThanOrEqual(0);
    }
  });

  it("cycles the colour scheme by accepted index and keeps an existing colour", () => {
    const { reconciler } = make();
    const config = sized({ colorScheme: ["#111111", "#222222"] });
    const first = reconciler.reconcile(
      [],
      [
        { id: "a", label: "a", value: 1 },
        { id: "b", label: "b", value: 1 },
        { id: "c", label: "c", value: 1 },
      ],
      config,
      0,
    );
    expect(first.map((o) => o.color)).toEqual([
      "#111111",
      "#222222",
      "#111111",
    ]);

    const next = reconciler.reconcile(
      first,
      [{ id: "b", label: "b", value: 1 }],
      config,
      0,
    );
    expect(next[0].color).toBe("#222222");
  });

  it("spawns a new orb fully inside the bounds using its target radius", () => {
    const spawn = new OrbReconciler(new RadiusTweener(), () => 0.999);

    const [orb] = spawn.reconcile(
      [],
      [{ id: "a", label: "a", value: 1 }],
      sized({ minRadius: 60 }),
      0,
    );

    expect(orb.x + 60).toBeLessThanOrEqual(400);
    expect(orb.y + 60).toBeLessThanOrEqual(300);
  });

  it("gives a retargeted orb no new transition when the radii did not change", () => {
    const { tweener, reconciler } = make();
    const config = { ...sized(), transitionDuration: 0 };
    const orbs = reconciler.reconcile(
      [],
      [{ id: "a", label: "a", value: 1 }],
      config,
      0,
    );
    tweener.step(orbs, 0);

    reconciler.retargetAll(orbs, config, 10, 400);
    tweener.step(orbs, 10);

    expect(orbs[0].radius).toBe(80);
  });
});

describe("OrbReconciler duration override", () => {
  const config = new ConfigResolver().resolve(
    { width: 400, height: 300, transitionDuration: 400 },
    { width: 0, height: 0 },
  );
  const item = (id: string, value = 1) => ({ id, label: id, value });

  it("snaps new, changed, and removed orbs when the duration is 0", () => {
    const tweener = new RadiusTweener();
    const reconciler = new OrbReconciler(tweener, () => 0.5);
    const first = reconciler.reconcile(
      [],
      [item("a"), item("b", 5)],
      config,
      0,
    );
    tweener.step(first, 400);

    const next = reconciler.reconcile(
      first,
      [item("b", 9), item("c")],
      config,
      400,
      0,
    );
    const settled = tweener.step(next, 400);

    expect(settled.map((o) => o.id)).toEqual(["b", "c"]);
    expect(settled.every((o) => o.radius > 0)).toBe(true);
    expect(settled[1].radius).toBeCloseTo(80 / 3);
  });

  it("uses the configured duration when no override is given", () => {
    const tweener = new RadiusTweener();
    const reconciler = new OrbReconciler(tweener, () => 0.5);
    const grow = { ...config, enterStyle: "grow" as const };
    const orbs = reconciler.reconcile([], [item("a")], grow, 0);

    tweener.step(orbs, 200);

    expect(orbs[0].radius).toBeGreaterThan(0);
    expect(orbs[0].radius).toBeLessThan(config.maxRadius);
  });
});

describe("OrbReconciler drop (spec 0005 AC-8)", () => {
  it("forgets a popped orb's seed, place, and tween", () => {
    const tweener = new RadiusTweener();
    const reconciler = new OrbReconciler(tweener, () => 0.5);
    const config = new ConfigResolver().resolve(
      { enterStyle: "grow" },
      { width: 0, height: 0 },
    );
    const [orb] = reconciler.reconcile(
      [],
      [{ id: "a", label: "a", value: 1 }],
      config,
      0,
    );
    expect(reconciler.awaiting("a")).toBe(true);

    reconciler.drop("a");

    expect(reconciler.awaiting("a")).toBe(false);
    expect(reconciler.phaseOf(orb)).toBe(0);
    tweener.step([orb], 1000);
    expect(orb.radius).toBe(0);
  });
});

describe("OrbReconciler rise and restore (spec 0006)", () => {
  const resolve = (over = {}) =>
    new ConfigResolver().resolve(
      { width: 400, height: 300, maxRadius: 80, minRadius: 8, ...over },
      { width: 0, height: 0 },
    );
  const item = (id: string, value = 1) => ({ id, label: id, value });
  const record = (id: string, value: number, x = 50, y = 60) => ({
    id,
    label: id,
    value,
    x,
    y,
    index: 0,
    byUser: true,
    placed: true,
  });

  it("creates a rising orb at its target radius, and a growing one at 0 (AC-1)", () => {
    const rise = new OrbReconciler(new RadiusTweener(), () => 0.5);
    const grow = new OrbReconciler(new RadiusTweener(), () => 0.5);

    const [r] = rise.reconcile([], [item("a")], resolve(), 0);
    const [g] = grow.reconcile(
      [],
      [item("a")],
      resolve({ enterStyle: "grow" }),
      0,
    );

    expect(r.radius).toBe(80);
    expect(g.radius).toBe(0);
  });

  it("places a rising orb in the least crowded of 8 random places (AC-4)", () => {
    const first = [0.5, 0.5, 0, 0, 0, 0];
    let n = 0;
    const random = () => (n++ < first.length ? first[n - 1] : 0.95);
    const reconciler = new OrbReconciler(new RadiusTweener(), random);
    const [a] = reconciler.reconcile([], [item("a", 4)], resolve(), 0);
    a.x = 200;
    a.y = 150;
    n = 0;

    const [, b] = reconciler.reconcile(
      [a],
      [item("a", 4), item("b", 1)],
      resolve(),
      0,
    );

    // The first candidate sits on A; a later one is far enough to touch nothing.
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(
      a.radius + b.radius,
    );
  });

  it("counts a batch of new orbs against each other when placing them (AC-4)", () => {
    const reconciler = new OrbReconciler(new RadiusTweener(), () => 0.5);

    const orbs = reconciler.reconcile([], [item("a"), item("b")], resolve(), 0);

    expect(orbs).toHaveLength(2);
  });

  it("restores an orb at its old place moved inside the chart, with a fresh seed (AC-7)", () => {
    const reconciler = new OrbReconciler(new RadiusTweener(), () => 0.5);
    const config = resolve();

    const orb = reconciler.restoreOrb(record("a", 1, 1000, -50), config, []);

    expect(orb.id).toBe("a");
    expect({ x: orb.x, y: orb.y }).toEqual({ x: 320, y: 80 });
    expect(orb.radius).toBe(80);
    expect(orb.vx).toBe(0);
    expect(reconciler.phaseOf(orb)).toBe(0);
  });

  it("picks a fresh place for a record that was never placed (AC-7)", () => {
    const reconciler = new OrbReconciler(new RadiusTweener(), () => 0.5);

    const orb = reconciler.restoreOrb(
      { ...record("a", 1, 0, 0), placed: false },
      resolve(),
      [],
    );

    expect(orb.x).toBeGreaterThan(orb.radius);
    expect(orb.y).toBeGreaterThan(orb.radius);
  });

  it("gives a restored orb the radius of live plus popped values (AC-8)", () => {
    const popped = [record("p", 4)];
    const reconciler = new OrbReconciler(
      new RadiusTweener(),
      () => 0.5,
      () => popped,
    );
    const live = reconciler.reconcile([], [item("a", 1)], resolve(), 0);

    // Largest value is the popped 4: value 1 gets half the radius of maxRadius.
    expect(reconciler.restoreOrb(record("b", 1), resolve(), live).radius).toBe(
      40,
    );
    expect(reconciler.restoreOrb(record("p", 4), resolve(), live).radius).toBe(
      80,
    );
  });

  it("counts popped values when radii are retargeted, and moves only live orbs (AC-8)", () => {
    const tweener = new RadiusTweener();
    const popped = [{ value: 4 }];
    const reconciler = new OrbReconciler(
      tweener,
      () => 0.5,
      () => popped,
    );
    const live = reconciler.reconcile([], [item("a", 1)], resolve(), 0);
    tweener.step(live, 0);

    reconciler.retargetAll(live, resolve({ maxRadius: 40 }), 0, 0);
    tweener.step(live, 1);

    expect(live[0].radius).toBe(20);
  });

  it("holds a restored orb until a container with a size appears (AC-7)", () => {
    const reconciler = new OrbReconciler(new RadiusTweener(), () => 0.5);
    const unsized = new ConfigResolver().resolve({}, { width: 0, height: 0 });

    const orb = reconciler.restoreOrb(record("a", 1), unsized, []);
    expect(reconciler.awaiting("a")).toBe(true);
    reconciler.placeAwaiting(400, 300);

    expect(reconciler.awaiting("a")).toBe(false);
    expect(orb.x).toBeGreaterThan(0);
    expect(orb.y).toBeGreaterThan(0);
  });
});
