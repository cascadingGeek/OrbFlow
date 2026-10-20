/** A parsed color: channels 0 to 255, alpha 0 to 1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The look a bubble is drawn with. */
export type ResolvedTheme = "light" | "dark";

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^rgba?\(\s*([^)]*)\)$/i;

/**
 * Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, and comma separated `rgb()`
 * and `rgba()`. Returns `null` for anything else.
 */
export function toRgb(color: string | undefined): Rgb | null {
  if (typeof color !== "string") return null;
  const text = color.trim();
  const hex = HEX.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = digits.replace(/./g, (d) => d + d);
    const n = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return {
      r: n(0),
      g: n(1),
      b: n(2),
      a: digits.length === 8 ? n(3) / 255 : 1,
    };
  }
  const func = FUNC.exec(text);
  if (!func) return null;
  const parts = func[1].split(",").map((part) => part.trim());
  if (parts.length < 3 || parts.length > 4) return null;
  const nums = parts.map((part) => (part === "" ? NaN : Number(part)));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const channel = (n: number) => Math.min(255, Math.max(0, n));
  return {
    r: channel(nums[0]),
    g: channel(nums[1]),
    b: channel(nums[2]),
    a: nums.length === 4 ? Math.min(1, Math.max(0, nums[3])) : 1,
  };
}

/** `c` as a CSS `rgba()` string with alpha `a`. */
export function rgba(c: Rgb, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

/**
 * Light when the background's WCAG relative luminance is above 0.5, dark for
 * everything else, including transparent and unparsable colors.
 */
export function resolveTheme(
  theme: "auto" | "light" | "dark" | undefined,
  background: string | undefined,
): ResolvedTheme {
  if (theme === "light" || theme === "dark") return theme;
  const c = toRgb(background);
  if (!c || c.a === 0) return "dark";
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return luminance > 0.5 ? "light" : "dark";
}
