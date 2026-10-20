import { resolveTheme, rgba, toRgb } from "./color";

describe("toRgb (AC-5)", () => {
  it.each([
    ["#fff", { r: 255, g: 255, b: 255, a: 1 }],
    ["#0a0e1a", { r: 10, g: 14, b: 26, a: 1 }],
    ["#ff000080", { r: 255, g: 0, b: 0, a: 128 / 255 }],
    ["#f008", { r: 255, g: 0, b: 0, a: 136 / 255 }],
    ["rgb(1, 2, 3)", { r: 1, g: 2, b: 3, a: 1 }],
    ["rgba(10,20,30,0.5)", { r: 10, g: 20, b: 30, a: 0.5 }],
    ["  RGB( 300, -4, 5 ) ", { r: 255, g: 0, b: 5, a: 1 }],
  ])("parses %s", (input, expected) => {
    expect(toRgb(input)).toEqual(expected);
  });

  it.each([
    "transparent",
    "red",
    "hsl(0, 100%, 50%)",
    "rgb(1 2 3)",
    "rgb(1,2)",
    "#12",
    "#ggg",
    "",
    undefined,
  ])("returns null for %s", (input) => {
    expect(toRgb(input)).toBeNull();
  });

  it("builds an rgba string", () => {
    expect(rgba({ r: 1, g: 2, b: 3, a: 1 }, 0.5)).toBe("rgba(1,2,3,0.5)");
  });
});

describe("resolveTheme (AC-5)", () => {
  it.each([
    ["#ffffff", "light"],
    ["#f5f0ff", "light"],
    ["#fff", "light"],
    ["rgb(250, 250, 250)", "light"],
    ["#0a0e1a", "dark"],
    ["#777777", "dark"],
    ["rgba(255, 255, 255, 0)", "dark"],
    ["rgba(255, 255, 255, 0.2)", "light"],
    ["transparent", "dark"],
    ["white", "dark"],
    ["garbage", "dark"],
  ] as const)("auto on %s is %s", (background, theme) => {
    expect(resolveTheme("auto", background)).toBe(theme);
  });

  it("lets an explicit theme win over the background", () => {
    expect(resolveTheme("light", "#000")).toBe("light");
    expect(resolveTheme("dark", "#fff")).toBe("dark");
  });
});
