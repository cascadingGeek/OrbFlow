import { ConfigResolver } from "../../../../app/core/config/ConfigResolver";

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

  describe("spec 0005 options", () => {
    const size = { width: 0, height: 0 };
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it("fills the new defaults", () => {
      const config = new ConfigResolver().resolve({}, size);
      expect(config).toMatchObject({
        minRadius: 8,
        maxRadius: 80,
        popOnClick: false,
        popStyle: "remove",
        theme: "auto",
        fontFamily: "Inter, system-ui, sans-serif",
        enterStyle: "rise",
        restoreOnNextPop: true,
      });
      expect(config.onOrbRestore).toEqual(expect.any(Function));
      expect(config.onOrbPop).toEqual(expect.any(Function));
      expect(warn).not.toHaveBeenCalled();
    });

    it("keeps a minRadius of 0 and falls back to 8 for a bad one, warning once per value", () => {
      const resolver = new ConfigResolver();
      expect(resolver.resolve({ minRadius: 0 }, size).minRadius).toBe(0);
      const current = resolver.resolve({ minRadius: -1 }, size);
      expect(current.minRadius).toBe(8);
      resolver.merge(current, { minRadius: -1 });
      expect(warn).toHaveBeenCalledTimes(1);
      resolver.merge(current, { minRadius: Infinity });
      resolver.merge(current, { minRadius: NaN });
      expect(warn).toHaveBeenCalledTimes(3);
    });

    it.each([
      ["fontFamily", "", "Inter, system-ui, sans-serif"],
      ["fontFamily", 12, "Inter, system-ui, sans-serif"],
      ["theme", "sepia", "auto"],
      ["popStyle", "explode", "remove"],
      ["enterStyle", "fade", "rise"],
      ["restoreOnNextPop", "yes", true],
      ["restoreOnNextPop", 0, true],
    ] as const)(
      "falls back for a bad %s (%p) and warns once",
      (key, bad, fallback) => {
        const resolver = new ConfigResolver();
        const current = resolver.resolve({ [key]: bad } as never, size);
        expect(current[key]).toBe(fallback);
        resolver.merge(current, { [key]: bad } as never);
        resolver.merge(current, { [key]: bad } as never);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(key);
      },
    );

    it("accepts every allowed value", () => {
      const resolver = new ConfigResolver();
      const base = resolver.resolve({}, size);
      for (const theme of ["auto", "light", "dark"] as const) {
        expect(resolver.merge(base, { theme }).theme).toBe(theme);
      }
      expect(resolver.merge(base, { popStyle: "ghost" }).popStyle).toBe(
        "ghost",
      );
      expect(resolver.merge(base, { enterStyle: "grow" }).enterStyle).toBe(
        "grow",
      );
      expect(
        resolver.merge(base, { restoreOnNextPop: false }).restoreOnNextPop,
      ).toBe(false);
      expect(resolver.merge(base, { fontFamily: "Nunito" }).fontFamily).toBe(
        "Nunito",
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("spec 0007 options", () => {
    const size = { width: 0, height: 0 };
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it("defaults to the plain number and 10 px", () => {
      const config = new ConfigResolver().resolve({}, size);
      expect(config.formatValue(42, {} as never)).toBe("42");
      expect(config.minTextSize).toBe(10);
      expect(warn).not.toHaveBeenCalled();
    });

    it("keeps a function, and goes back to the plain number with String", () => {
      const resolver = new ConfigResolver();
      const fn = (v: number) => `$${v}`;
      const set = resolver.resolve({ formatValue: fn, minTextSize: 6.5 }, size);
      expect(set.formatValue).toBe(fn);
      expect(set.minTextSize).toBe(6.5);
      const reset = resolver.merge(set, { formatValue: String });
      expect(reset.formatValue(0.1 + 0.2, {} as never)).toBe(
        "0.30000000000000004",
      );
      expect(resolver.merge(set, { formatValue: undefined }).formatValue).toBe(
        fn,
      );
    });

    it("warns once and falls back for a formatValue that is not a function", () => {
      const resolver = new ConfigResolver();
      const current = resolver.resolve({ formatValue: "x" as never }, size);
      resolver.merge(current, { formatValue: "x" as never });
      resolver.merge(current, { formatValue: "x" as never });
      expect(current.formatValue(1, {} as never)).toBe("1");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "OrbFlow: formatValue must be a function, using the plain number.",
      );
    });

    it.each([0, 0.5, NaN, Infinity, "a", null])(
      "warns once and uses 10 for minTextSize %p",
      (bad) => {
        const resolver = new ConfigResolver();
        const current = resolver.resolve({ minTextSize: bad as never }, size);
        resolver.merge(current, { minTextSize: bad as never });
        expect(current.minTextSize).toBe(10);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          "OrbFlow: minTextSize must be a finite number of at least 1, using 10.",
        );
      },
    );

    it("allows 1 and a large minTextSize", () => {
      const resolver = new ConfigResolver();
      expect(resolver.resolve({ minTextSize: 1 }, size).minTextSize).toBe(1);
      expect(resolver.resolve({ minTextSize: 500 }, size).minTextSize).toBe(
        500,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
