import { diffConfig } from "./diffConfig";

describe("diffConfig", () => {
  it("returns nothing for equal values, including equal arrays", () => {
    const { changes } = diffConfig(
      { minRadius: 20, colorScheme: ["#a", "#b"] },
      { minRadius: 20, colorScheme: ["#a", "#b"] },
    );
    expect(changes).toEqual({});
  });

  it("returns only the keys that changed", () => {
    const { changes, applied } = diffConfig(
      { minRadius: 20, maxRadius: 80 },
      { minRadius: 20, maxRadius: 90 },
    );
    expect(changes).toEqual({ maxRadius: 90 });
    expect(applied).toEqual({ minRadius: 20, maxRadius: 90 });
  });

  it("notices a different item or order in an array", () => {
    expect(
      diffConfig({ colorScheme: ["#a", "#b"] }, { colorScheme: ["#b", "#a"] })
        .changes,
    ).toEqual({ colorScheme: ["#b", "#a"] });
    expect(
      diffConfig({ colorScheme: ["#a"] }, { colorScheme: ["#a", "#b"] })
        .changes,
    ).toEqual({ colorScheme: ["#a", "#b"] });
  });

  it("notices a key that is new", () => {
    expect(diffConfig({}, { minRadius: 10 }).changes).toEqual({
      minRadius: 10,
    });
  });

  it("skips a key that became undefined and remembers the old value", () => {
    const first = diffConfig({ minRadius: 20 }, { minRadius: undefined });
    expect(first.changes).toEqual({});
    expect(first.applied).toEqual({ minRadius: 20 });

    // Going back to the remembered value costs nothing.
    expect(diffConfig(first.applied, { minRadius: 20 }).changes).toEqual({});
  });

  it("treats NaN as equal to NaN", () => {
    expect(diffConfig({ minRadius: NaN }, { minRadius: NaN }).changes).toEqual(
      {},
    );
  });
});
