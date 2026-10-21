/** Draws the keyboard focus ring: two tones, so it shows on any background. */
export function drawFocusRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.lineWidth = 2;
  for (const [offset, color] of [
    [3, "#0a0e1a"],
    [5, "#ffffff"],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r + offset, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}
