import { LabelFitter } from "./LabelFitter";
import {
  W,
  circle,
  disc,
  fill,
  film,
  glow,
  lens,
  type Stops,
} from "./bubbleLayers";
import { rgba, toRgb, type ResolvedTheme, type Rgb } from "./color";

/** One bubble to draw: where, how big, and what it shows. */
export interface Bubble {
  x: number;
  y: number;
  r: number;
  color?: string;
  label: string;
  value: number;
  /** The text drawn for the value; `""` hides it. */
  valueText: string;
  /** A loaded image, or `undefined` to draw the bubble without one. */
  image?: HTMLImageElement;
}

/** What every bubble in one frame shares. */
export interface Look {
  theme: ResolvedTheme;
  /** Start angle of the soap film, in radians. */
  filmAngle: number;
  fontFamily: string;
  /** Text smaller than this is not drawn. */
  minTextSize: number;
}

const K = 0.7;
const FALLBACK: Rgb = { r: 59, g: 130, b: 246, a: 1 };
const TILT = -Math.PI / 4;

/**
 * Draws a soap bubble: lift, body, image lens, film, glow, crescent, spot,
 * glint, then the label. Plain canvas gradients, every frame.
 */
export class BubblePainter {
  private readonly tints = new Map<string, Rgb>();

  constructor(private readonly fitter = new LabelFitter()) {}

  /** Draws the whole bubble, label included. */
  paint(ctx: CanvasRenderingContext2D, b: Bubble, look: Look) {
    this.body(ctx, b, look);
    this.label(ctx, b, look);
  }

  /**
   * Draws layers 1 to 9 (no label), stretched by `sx` and `sy` about the
   * center and faded by `alpha`, which the burst uses.
   */
  body(
    ctx: CanvasRenderingContext2D,
    b: Bubble,
    look: Look,
    sx = 1,
    sy = 1,
    alpha = 1,
  ) {
    const { x, y, r } = b;
    if (r <= 0) return;
    const c = this.tint(b.color);
    const dark = look.theme === "dark";
    ctx.save();
    ctx.globalAlpha = alpha;
    if (sx !== 1 || sy !== 1) {
      ctx.translate(x, y);
      ctx.scale(sx, sy);
      ctx.translate(-x, -y);
    }
    if (dark) {
      const lift = ctx.createRadialGradient(x, y, 0.97 * r, x, y, 1.16 * r);
      // prettier-ignore
      disc(ctx, x, y, 1.16 * r, fill(lift, [[0, rgba(c, 0)], [0.23, rgba(c, 0.32 * K)], [1, rgba(c, 0)]]));
    } else {
      const ly = y + 0.3 * r;
      const lift = ctx.createRadialGradient(x, ly, 0.6 * r, x, ly, 1.25 * r);
      // prettier-ignore
      disc(ctx, x, ly, 1.25 * r, fill(lift, [[0, "rgba(72,44,140,0.18)"], [1, "rgba(72,44,140,0)"]]));
    }
    // prettier-ignore
    const bodyStops: Stops = dark
      ? [[0, rgba(c, 0.05 * K)], [0.52, rgba(c, 0.08 * K)], [0.74, rgba(c, 0.2 * K)], [0.92, rgba(c, 0.5 * K)], [0.986, W(0.7)], [1, W(0)]]
      : [[0, W(0.1)], [0.55, W(0.14)], [0.76, rgba(c, 0.16 * K)], [0.92, rgba(c, 0.34 * K)], [0.986, W(0.95)], [1, W(0)]];
    disc(
      ctx,
      x,
      y,
      r,
      fill(ctx.createRadialGradient(x, y, 0, x, y, r), bodyStops),
    );
    if (b.image) lens(ctx, b.image, x, y, r);
    film(ctx, x, y, r, c, look.filmAngle, dark);
    ctx.save();
    circle(ctx, x, y, r);
    ctx.clip();
    // prettier-ignore
    glow(ctx, x, y + 0.94 * r, 1.24 * r, 0.6 * r, 0, [[0, W(0.55)], [0.45, rgba(c, 0.25 * K)], [0.8, rgba(c, 0)]]);
    ctx.restore();
    const shine = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    ctx.beginPath();
    ctx.arc(x, y, 0.97 * r, 0, Math.PI * 2);
    ctx.moveTo(x + 0.998 * r, y + 0.076 * r);
    ctx.arc(x + 0.06 * r, y + 0.076 * r, 0.938 * r, 0, Math.PI * 2);
    ctx.fillStyle = fill(shine, [
      [0.22, W(0.9)],
      [0.42, W(0.45)],
      [0.6, W(0)],
    ]);
    ctx.fill("evenodd");
    // prettier-ignore
    glow(ctx, x + 0.46 * r, y + 0.57 * r, 0.26 * r, 0.11 * r, TILT, [[0, W(0.6)], [1, W(0)]]);
    // prettier-ignore
    glow(ctx, x - 0.51 * r, y - 0.61 * r, 0.09 * r, 0.05 * r, TILT, [[0, W(0.95)], [1, W(0)]]);
    ctx.restore();
  }

  /** Draws the fitted label and value (layer 10), faded by `alpha`. */
  label(ctx: CanvasRenderingContext2D, b: Bubble, look: Look, alpha = 1) {
    const value = b.valueText || null;
    const family = look.fontFamily;
    const { minTextSize } = look;
    const fit = this.fitter.fit(
      ctx,
      family,
      b.r,
      b.label,
      value,
      !!b.image,
      minTextSize,
    );
    if (!fit) return;
    const dark = look.theme === "dark";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (dark) {
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 8;
    }
    const text = (s: string, weight: string, size: number, dy: number) => {
      ctx.font = `${weight} ${size}px ${family}`;
      if (!dark) {
        ctx.fillStyle = W(0.7);
        ctx.fillText(s, b.x, b.y + dy + 1);
      }
      ctx.fillStyle = dark ? "#ffffff" : "#2b1f47";
      ctx.fillText(s, b.x, b.y + dy);
    };
    text(b.label, "bold", fit.labelSize, fit.labelDy);
    if (value !== null && fit.valueSize > 0) {
      text(value, "600", fit.valueSize, fit.valueDy);
    }
    ctx.restore();
  }

  /** Sizes the text measure cache for a frame of `bubbles` bubbles. */
  reserve(bubbles: number) {
    this.fitter.reserve(bubbles);
  }

  /** The bubble color, parsed once; unparsable colors use blue. */
  tint(color: string | undefined): Rgb {
    const key = color ?? "";
    let c = this.tints.get(key);
    if (!c) {
      c = toRgb(color) ?? FALLBACK;
      this.tints.set(key, c);
    }
    return c;
  }
}
