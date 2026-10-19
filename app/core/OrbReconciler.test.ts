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
