/**
 * The drawing steps the bubble recipe is made of. Plain functions on a
 * canvas context, shared by `BubblePainter`.
 */
import { rgba, type Rgb } from "./color";

/** Gradient stops: position from 0 to 1, and a CSS color. */
export type Stops = [number, string][];

/** White at alpha `a`. */
export const W = (a: number) => `rgba(255,255,255,${a})`;

/** Starts a new path holding one full circle. */
export function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function fill<G extends CanvasGradient>(g: G, stops: Stops): G {
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

export function disc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  style: CanvasGradient | string,
) {
  circle(ctx, x, y, r);
  ctx.fillStyle = style;
  ctx.fill();
}

// A radial fade squashed into an ellipse with radii rx and ry.
export function glow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  stops: Stops,
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(rx, ry);
  disc(ctx, 0, 0, 1, fill(ctx.createRadialGradient(0, 0, 0, 0, 0, 1), stops));
  ctx.restore();
}

// The image, cropped to cover a circle of 0.88r, at 106%, with a vignette.
export function lens(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  r: number,
) {
  const clip = 0.88 * r;
  const size = 2 * clip * 1.06;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  ctx.save();
  circle(ctx, x, y, clip);
  ctx.clip();
  const [dx, dy] = [x - size / 2, y - size / 2];
  if (w > 0 && h > 0) {
    const s = Math.min(w, h);
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, dx, dy, size, size);
  } else {
    ctx.drawImage(img, dx, dy, size, size);
  }
  const shade = ctx.createRadialGradient(x, y, 0.48 * r, x, y, clip);
  // prettier-ignore
  disc(ctx, x, y, clip, fill(shade, [[0, "rgba(20,14,40,0)"], [1, "rgba(20,14,40,0.55)"]]));
  ctx.restore();
}

// The soap film ring. Skipped where conic gradients do not exist.
export function film(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  c: Rgb,
  angle: number,
  dark: boolean,
) {
  if (typeof ctx.createConicGradient !== "function") return;
  const pink = "rgba(255,128,204,0.6)";
  const g = ctx.createConicGradient(angle, x, y);
  // prettier-ignore
  fill(g, [[0, pink], [0.2, "rgba(168,140,255,0.55)"], [0.4, "rgba(110,220,255,0.55)"], [0.6, rgba(c, 0.6)], [0.8, "rgba(255,214,150,0.5)"], [1, pink]]);
  ctx.save();
  ctx.globalAlpha *= dark ? 0.75 : 0.5;
  ctx.globalCompositeOperation = dark ? "screen" : "source-over";
  circle(ctx, x, y, 0.895 * r);
  ctx.lineWidth = 0.19 * r;
  ctx.strokeStyle = g;
  ctx.stroke();
  ctx.restore();
}
