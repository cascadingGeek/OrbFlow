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
});
