import type { ResolvedConfig } from "./ConfigResolver";

const DEFAULT_FONT = "Inter, system-ui, sans-serif";
const DEFAULT_MIN_TEXT = 10;

/** Checks the options that shape bubble text: font, value format, min size. */
export class TextOptions {
  /** `warn` logs a bad value once; the resolver owns the "once" part. */
  constructor(
    private readonly warn: (
      name: string,
      value: unknown,
      message: string,
    ) => void,
  ) {}

  /** The font, or the default for a value that is not a non empty string. */
  font(value: unknown): string {
    if (value === undefined) return DEFAULT_FONT;
    if (typeof value === "string" && value.trim() !== "") return value;
    this.warn(
      "fontFamily",
      value,
      `fontFamily must be a non empty string, using "${DEFAULT_FONT}".`,
    );
    return DEFAULT_FONT;
  }

  /** The value formatter, or `String` (the plain number) when unset or bad. */
  format(value: unknown): ResolvedConfig["formatValue"] {
    if (value === undefined) return String;
    if (typeof value === "function") {
      return value as ResolvedConfig["formatValue"];
    }
    this.warn(
      "formatValue",
      value,
      "formatValue must be a function, using the plain number.",
    );
    return String;
  }

  /** The smallest text size, or 10 for anything under 1 or not finite. */
  size(value: unknown): number {
    if (value === undefined) return DEFAULT_MIN_TEXT;
    if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
      return value;
    }
    this.warn(
      "minTextSize",
      value,
      `minTextSize must be a finite number of at least 1, using ${DEFAULT_MIN_TEXT}.`,
    );
    return DEFAULT_MIN_TEXT;
  }
}
