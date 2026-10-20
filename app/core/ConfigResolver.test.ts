import { ConfigResolver } from "./ConfigResolver";

describe("ConfigResolver", () => {
  const resolver = new ConfigResolver();
  const size = { width: 400, height: 300 };

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("defaults transitionDuration to 400", () => {
    expect(resolver.resolve({}, size).transitionDuration).toBe(400);
  });

  it("allows 0 and falls back to 400 with a warning for bad values", () => {
    expect(
      resolver.resolve({ transitionDuration: 0 }, size).transitionDuration,
    ).toBe(0);

    for (const bad of [-1, NaN, Infinity]) {
      expect(
        resolver.resolve({ transitionDuration: bad }, size).transitionDuration,
      ).toBe(400);
    }
    expect(console.warn).toHaveBeenCalledTimes(3);
  });

  it("ignores undefined keys when merging", () => {
    const current = resolver.resolve({ minRadius: 30 }, size);

    const merged = resolver.merge(current, {
      minRadius: undefined,
      maxRadius: 120,
    });

    expect(merged.minRadius).toBe(30);
    expect(merged.maxRadius).toBe(120);
    expect(merged.transitionDuration).toBe(400);
  });

  describe("accessibility options", () => {
    it("fills the defaults", () => {
      const config = resolver.resolve({}, size);
      expect(config.ariaLabel).toBe("Bubble chart");
      expect(config.ariaDescription).toBe("");
      expect(config.reducedMotion).toBe("auto");
    });

    it("treats an empty or blank ariaLabel as unset", () => {
      for (const blank of ["", "   "]) {
        expect(resolver.resolve({ ariaLabel: blank }, size).ariaLabel).toBe(
          "Bubble chart",
        );
      }
      const current = resolver.resolve({ ariaLabel: "Sales" }, size);
      expect(resolver.merge(current, { ariaLabel: " " }).ariaLabel).toBe(
        "Bubble chart",
      );
    });

    it("clears ariaDescription with an empty string but not with undefined", () => {
      const current = resolver.resolve({ ariaDescription: "About" }, size);
      expect(
        resolver.merge(current, { ariaDescription: undefined }).ariaDescription,
      ).toBe("About");
      expect(
        resolver.merge(current, { ariaDescription: "" }).ariaDescription,
      ).toBe("");
    });

    it("warns once for a bad reducedMotion and stores auto", () => {
      const current = resolver.resolve(
        { reducedMotion: "sometimes" as "auto" },
        size,
      );
      expect(current.reducedMotion).toBe("auto");
      expect(console.warn).toHaveBeenCalledTimes(1);
      resolver.merge(current, { minRadius: 30 });
      expect(console.warn).toHaveBeenCalledTimes(1);
      for (const ok of ["always", "never", "auto"] as const) {
        expect(
          resolver.merge(current, { reducedMotion: ok }).reducedMotion,
        ).toBe(ok);
      }
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });
});
