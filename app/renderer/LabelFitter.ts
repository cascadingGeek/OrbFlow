/** Font sizes and vertical offsets for one bubble's text. */
export interface LabelFit {
  /** Label font size in pixels. */
  labelSize: number;
  /** Label center, relative to the bubble center. */
  labelDy: number;
  /** Value font size in pixels, or 0 when the value is hidden. */
  valueSize: number;
  /** Value center, relative to the bubble center. */
  valueDy: number;
}

/** Text smaller than this is not drawn. */
const MIN_SIZE = 10;
const PROBE = 100;

/**
 * Picks label and value sizes that fit inside a bubble. A 100 px measure gives
 * the first estimate. Width is not quite linear in size (fonts with optical
 * sizes, like the macOS system font, are wider per em when small), so the
 * estimate is checked with a measure near the chosen size. Every measure is
 * cached per font, so a settled chart measures nothing per frame.
 */
export class LabelFitter {
  private readonly widths = new Map<string, number>();
  private family = "";

  /**
   * Fits `label` (and `value`, when given) in a bubble of radius `r`. Returns
   * `null` when the label would be smaller than 10 px, so nothing is drawn.
   */
  fit(
    ctx: CanvasRenderingContext2D,
    family: string,
    r: number,
    label: string,
    value: string | null,
    hasImage: boolean,
  ): LabelFit | null {
    if (family !== this.family) {
      this.widths.clear();
      this.family = family;
    }
    const cap = (hasImage ? 1.2 : 1.5) * r;
    const labelSize = this.size(ctx, "bold", label, 0.4 * r, cap);
    if (labelSize < MIN_SIZE) return null;
    if (hasImage) {
      return { labelSize, labelDy: 0.45 * r, valueSize: 0, valueDy: 0 };
    }
    const valueSize =
      value === null || r < 30
        ? 0
        : this.size(ctx, "600", value, 0.62 * labelSize, cap);
    if (valueSize < MIN_SIZE) {
      return { labelSize, labelDy: 0, valueSize: 0, valueDy: 0 };
    }
    return {
      labelSize,
      labelDy: -0.5 * valueSize,
      valueSize,
      valueDy: 0.55 * labelSize,
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
    for (let pass = 0; pass < 3; pass++) {
      const width = this.measure(ctx, weight, text, probe);
      if (width <= 0) return size;
      // Where `text` would be `cap` wide, at the probe's width per em.
      const fits = (probe * cap) / width;
      if (pass > 0 && size <= fits) return size;
      size = Math.min(size, fits);
      // Check near the chosen size, rounded down to a half pixel: a smaller
      // probe is wider per em, so the check never lets the text overshoot.
      probe = Math.max(1, Math.floor(size * 2) / 2);
    }
    return size;
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
