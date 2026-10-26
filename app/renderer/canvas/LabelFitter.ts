/** Font sizes and vertical offsets for one bubble's text. */
interface LabelFit {
  /** Label font size in pixels. */
  labelSize: number;
  /** Label center, relative to the bubble center. */
  labelDy: number;
  /** Value font size in pixels, or 0 when the value is hidden. */
  valueSize: number;
  /** Value center, relative to the bubble center. */
  valueDy: number;
}

/** The default for text smaller than which nothing is drawn. */
const MIN_SIZE = 10;
const PROBE = 100;
/** Fonts curve gently and settle in 1 or 2 passes; steep ones need more. */
const MAX_PASSES = 12;

/**
 * Picks label and value sizes that fit inside a bubble. A 100 px estimate is
 * rechecked near the chosen size, and measures are cached per font.
 */
export class LabelFitter {
  private readonly widths = new Map<string, number>();
  private family = "";
  private limit = 256;

  /**
   * Sets how many measures to keep, from the bubble count. Past it the cache
   * is cleared, so a formatter whose text changes every frame cannot grow it
   * without limit. Four texts per bubble, about four measures each.
   */
  reserve(bubbles: number) {
    this.limit = Math.max(256, 16 * bubbles);
  }

  /**
   * Fits `label` (and `value`, when given) in a bubble of radius `r`. Returns
   * `null` when the label would be smaller than `minSize`, so nothing is
   * drawn. A value under `minSize` (or under 30 px of radius) is left out.
   */
  fit(
    ctx: CanvasRenderingContext2D,
    family: string,
    r: number,
    label: string,
    value: string | null,
    hasImage: boolean,
    minSize = MIN_SIZE,
  ): LabelFit | null {
    if (family !== this.family || this.widths.size > this.limit) {
      this.widths.clear();
      this.family = family;
    }
    const cap = (hasImage ? 1.2 : 1.5) * r;
    const labelSize = this.size(ctx, "bold", label, 0.4 * r, cap);
    if (labelSize < minSize) return null;
    // Over an image the plain layout moves down by 0.45 r.
    const down = hasImage ? 0.45 * r : 0;
    const valueSize =
      value === null || r < 30
        ? 0
        : this.size(ctx, "600", value, 0.62 * labelSize, cap);
    if (valueSize < minSize) {
      return { labelSize, labelDy: down, valueSize: 0, valueDy: 0 };
    }
    return {
      labelSize,
      labelDy: down - 0.5 * valueSize,
      valueSize,
      valueDy: down + 0.55 * labelSize,
    };
  }

  // The smaller of `max` and the size at which `text` is `cap` wide.
  private size(
    ctx: CanvasRenderingContext2D,
    weight: string,
    text: string,
    max: number,
    cap: number,
  ): number {
    let size = max;
    let probe = PROBE;
    // The largest size measured to fit, for a font that never settles.
    let measuredFit = 0;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const width = this.measure(ctx, weight, text, probe);
      if (width <= 0) return size;
      if (width <= cap && probe <= max)
        measuredFit = Math.max(measuredFit, probe);
      // Where `text` would be `cap` wide, at the probe's width per em.
      const fits = (probe * cap) / width;
      if (pass > 0 && size <= fits) return size;
      size = Math.min(size, fits);
      // Check near the chosen size, rounded down to a half pixel: a smaller
      // probe is wider per em, so the check never lets the text overshoot.
      probe = Math.max(1, Math.floor(size * 2) / 2);
    }
    // Never return a size that failed its own check.
    return measuredFit;
  }

  private measure(
    ctx: CanvasRenderingContext2D,
    weight: string,
    text: string,
    px: number,
  ) {
    const key = `${weight}|${px}|${text}`;
    let width = this.widths.get(key);
    if (width === undefined) {
      ctx.font = `${weight} ${px}px ${this.family}`;
      width = ctx.measureText(text).width;
      this.widths.set(key, width);
    }
    return width;
  }
}
