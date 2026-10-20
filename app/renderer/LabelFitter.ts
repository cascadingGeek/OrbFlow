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
 * Picks label and value sizes that fit inside a bubble. Each text is measured
 * once at 100 px per font, then scaled, because width grows linearly with size.
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
    const width = this.measure(ctx, weight, text);
    return width > 0 ? Math.min(max, (PROBE * cap) / width) : max;
  }

  private measure(ctx: CanvasRenderingContext2D, weight: string, text: string) {
    const key = `${weight}|${text}`;
    let width = this.widths.get(key);
    if (width === undefined) {
      ctx.font = `${weight} ${PROBE}px ${this.family}`;
      width = ctx.measureText(text).width;
      this.widths.set(key, width);
    }
    return width;
  }
}
