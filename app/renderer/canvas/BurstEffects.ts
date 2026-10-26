import type { Bubble, BubblePainter, Look } from "./BubblePainter";
import { W, circle, disc, fill } from "./bubbleLayers";
import { rgba } from "./color";

/** A popped bubble as it was drawn at the moment it popped. */
export interface PopSnapshot extends Bubble {
  id: string;
}

interface Running {
  snap: PopSnapshot;
  start: number;
}

/** How long a burst runs: the last speck ends at 80 + 700 ms. */
export const BURST_MS = 780;
const GHOST_IN = 180;
const GHOST_FULL = 600;

/**
 * Holds the bursts that are playing and the ghosts popped bubbles leave
 * behind. It never touches orbs, physics, or input: it only draws snapshots
 * on the loop clock it is given.
 */
export class BurstEffects {
  private bursts: Running[] = [];
  private ghosts: Running[] = [];

  constructor(private readonly painter: BubblePainter) {}

  /**
   * Adds a pop at time `now`. An idle chart plays no burst, and its ghost is
   * already faded in.
   */
  add(snap: PopSnapshot, now: number, ghost: boolean, idle: boolean) {
    if (!idle) this.bursts.push({ snap, start: now });
    if (ghost) {
      const still = { ...snap, image: undefined };
      this.ghosts.push({ snap: still, start: idle ? now - GHOST_FULL : now });
    }
  }

  /** Jumps every burst and ghost to its end. Returns true if any changed. */
  finishAll(now: number): boolean {
    let changed = this.bursts.length > 0;
    this.bursts = [];
    for (const ghost of this.ghosts) {
      if (now - ghost.start < GHOST_FULL) {
        ghost.start = now - GHOST_FULL;
        changed = true;
      }
    }
    return changed;
  }

  clearGhosts() {
    this.ghosts = [];
  }

  /** Removes the ghost of one popped bubble, as a restore does. */
  removeGhost(id: string) {
    this.ghosts = this.ghosts.filter((ghost) => ghost.snap.id !== id);
  }

  clear() {
    this.bursts = [];
    this.ghosts = [];
  }

  /** Draws the ghosts, under the live bubbles. */
  drawGhosts(ctx: CanvasRenderingContext2D, now: number, look: Look) {
    for (const { snap, start } of this.ghosts) {
      const t = Math.max(0, now - start);
      const a = clamp((t - GHOST_IN) / (GHOST_FULL - GHOST_IN));
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = look.theme === "dark" ? W(0.38) : "rgba(43,31,71,0.35)";
      circle(ctx, snap.x, snap.y, snap.r);
      ctx.stroke();
      ctx.restore();
      this.painter.label(ctx, snap, look, 0.45 * a);
    }
  }

  /** Draws the bursts, over the live bubbles, and drops finished ones. */
  drawBursts(ctx: CanvasRenderingContext2D, now: number, look: Look) {
    this.bursts = this.bursts.filter((b) => now - b.start < BURST_MS);
    for (const { snap, start } of this.bursts) {
      this.drawBurst(ctx, snap, Math.max(0, now - start), look);
    }
  }

  private drawBurst(
    ctx: CanvasRenderingContext2D,
    s: PopSnapshot,
    t: number,
    look: Look,
  ) {
    const { x, y, r } = s;
    // Stretch, then snap and fade.
    if (t < 81) {
      const p = t / 81;
      this.painter.body(ctx, s, look, 1 + 0.09 * p, 1 + 0.05 * p);
    } else if (t < 180) {
      const q = (t - 81) / 99;
      this.painter.body(ctx, s, look, 1.09 + 0.11 * q, 1.05 + 0.15 * q, 1 - q);
    }
    // The shock ring.
    if (t >= 90 && t < 470) {
      const u = (t - 90) / 380;
      ctx.save();
      ctx.globalAlpha =
        t < 166 ? (0.9 * (t - 90)) / 76 : 0.9 * (1 - (t - 166) / 304);
      circle(ctx, x, y, r * (0.98 + 0.57 * u));
      ctx.lineWidth = r * (0.048 - 0.044 * u);
      ctx.strokeStyle = W(0.75);
      ctx.stroke();
      ctx.restore();
    }
    const c = this.painter.tint(s.color);
    for (let n = 0; n < 10; n++) {
      const part = particle(n, r);
      const p = (t - part.delay) / part.duration;
      if (p < 0 || p >= 1) continue;
      const d = part.from + (part.to - part.from) * (1 - (1 - p) ** 4);
      const grow = p < 0.15;
      const k = grow ? p / 0.15 : (p - 0.15) / 0.85;
      ctx.save();
      ctx.globalAlpha = grow ? k : 1 - k;
      ctx.translate(x + Math.cos(part.angle) * d, y + Math.sin(part.angle) * d);
      const scale = grow ? 0.6 + 0.4 * k : 1 - 0.65 * k;
      ctx.scale(scale, scale);
      const z = part.size;
      const o = [-0.15 * z, -0.2 * z] as const;
      // prettier-ignore
      disc(ctx, 0, 0, z / 2, part.drop
        ? fill(ctx.createRadialGradient(...o, 0, ...o, 0.6 * z), [[0, W(0.95)], [0.12, W(0.95)], [0.32, W(0.25)], [0.7, rgba(c, 0.35)], [0.95, W(0.8)], [1, W(0)]])
        : look.theme === "dark" ? W(0.9) : rgba(c, 0.9));
      ctx.restore();
    }
  }
}

/**
 * Particle `n` of a burst of radius `r`: droplets are 0 to 5, specks 6 to 9.
 * Everything comes from the index, so a burst is the same every time.
 */
export function particle(n: number, r: number) {
  const drop = n < 6;
  const jitter = ((n * 37) % 25) - 12;
  const degrees = drop ? n * 60 + jitter : (n - 6) * 90 + 35 + jitter;
  return {
    drop,
    angle: (degrees * Math.PI) / 180,
    size: drop ? r * (0.16 + ((n * 7) % 4) * 0.03) : 3,
    from: 0.8 * r,
    to: drop ? r * (1.35 + ((n * 5) % 3) * 0.15) + 18 : 1.9 * r + 24,
    delay: 40 + (n % 3) * 20,
    duration: drop ? 560 : 700,
  };
}

function clamp(v: number) {
  return Math.min(1, Math.max(0, v));
}
