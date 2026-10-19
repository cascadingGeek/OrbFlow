import { OrbReconciler } from "./OrbReconciler";
import { RadiusTweener } from "./RadiusTweener";
import { ConfigResolver } from "./ConfigResolver";

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

  it("scales radius linearly across the value range", () => {
    expect(radiiAfterSettling([0, 50, 100])).toEqual([20, 50, 80]);
  });

  it("shrinks every other orb toward minRadius when one huge value arrives", () => {
    const radii = radiiAfterSettling([10, 20, 1_000_000]);

    expect(radii[2]).toBe(80);
    expect(radii[0]).toBe(20);
    expect(radii[1]).toBeCloseTo(20, 2);
  });

  it("gives equal values minRadius instead of dividing by zero", () => {
    expect(radiiAfterSettling([7, 7])).toEqual([20, 20]);
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

    expect(orbs[0].radius).toBe(20);
  });
});
