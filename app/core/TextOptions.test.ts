import { TextOptions } from "./TextOptions";

describe("TextOptions (spec 0007 AC-8, AC-9)", () => {
  let warn: jest.Mock;
  let options: TextOptions;

  beforeEach(() => {
    warn = jest.fn();
    options = new TextOptions(warn);
  });

  describe("size", () => {
    it("defaults to 10 without a warning when unset", () => {
      expect(options.size(undefined)).toBe(10);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([1, 6, 6.5, 40])("keeps a valid size of %p", (size) => {
      expect(options.size(size)).toBe(size);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([0, 0.5, -3, NaN, Infinity, "a", null, {}])(
      "uses 10 and warns for %p",
      (bad) => {
        expect(options.size(bad)).toBe(10);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          "minTextSize",
          bad,
          expect.stringContaining("using 10"),
        );
      },
    );
  });

  describe("format", () => {
    it("gives the plain number formatter when unset", () => {
      expect(options.format(undefined)).toBe(String);
      expect(warn).not.toHaveBeenCalled();
    });

    it("returns the function it was given", () => {
      const fn = (v: number) => `$${v}`;
      expect(options.format(fn)).toBe(fn);
    });

    it.each(["x", 5, null, {}])(
      "falls back to String and warns for %p",
      (bad) => {
        expect(options.format(bad)).toBe(String);
        expect(warn).toHaveBeenCalledWith(
          "formatValue",
          bad,
          expect.stringContaining("must be a function"),
        );
      },
    );
  });

  describe("font", () => {
    it("keeps a non empty string and defaults when unset", () => {
      expect(options.font("Nunito")).toBe("Nunito");
      expect(options.font(undefined)).toBe("Inter, system-ui, sans-serif");
      expect(warn).not.toHaveBeenCalled();
    });

    it.each(["", "   ", 3, null])(
      "uses the default and warns for %p",
      (bad) => {
        expect(options.font(bad)).toBe("Inter, system-ui, sans-serif");
        expect(warn).toHaveBeenCalledWith(
          "fontFamily",
          bad,
          expect.any(String),
        );
      },
    );
  });
});
