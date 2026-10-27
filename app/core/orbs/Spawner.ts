import type { Orb } from "@/types/types";

const CANDIDATES = 8;

/** Where a bubble is placed inside the chart. */
export interface Place {
  x: number;
  y: number;
}

/**
 * Picks resting places for new bubbles. `random` is injected, so tests can fix
 * every place.
 */
export class Spawner {
  constructor(private readonly random: () => number = Math.random) {}

  /** A random place that keeps a bubble of `radius` inside `width` by `height`. */
  anywhere(width: number, height: number, radius: number): Place {
    return { x: this.axis(width, radius), y: this.axis(height, radius) };
  }

  /**
   * The least crowded of 8 random places: the one whose bubble of `radius`
   * cuts the least into `others`, so physics has little to push apart while
   * the newcomer is still out of sight.
   */
  leastCrowded(
    width: number,
    height: number,
    radius: number,
    others: Orb[],
  ): Place {
    let best = this.anywhere(width, height, radius);
    if (others.length === 0) return best;
    let bestDepth = this.depth(best, radius, others);
    for (let n = 1; n < CANDIDATES; n++) {
      const place = this.anywhere(width, height, radius);
      const depth = this.depth(place, radius, others);
      if (depth < bestDepth) {
        best = place;
        bestDepth = depth;
      }
    }
    return best;
  }

  /** Moves a place back inside the chart for a bubble of `radius`. */
  clamp(place: Place, width: number, height: number, radius: number): Place {
    return {
      x: Math.min(Math.max(place.x, radius), Math.max(radius, width - radius)),
      y: Math.min(Math.max(place.y, radius), Math.max(radius, height - radius)),
    };
  }

  private axis(size: number, radius: number): number {
    return this.random() * Math.max(0, size - radius * 2) + radius;
  }

  // The summed depth the bubble cuts into each of the others.
  private depth(place: Place, radius: number, others: Orb[]): number {
    let total = 0;
    for (const other of others) {
      const gap = Math.hypot(place.x - other.x, place.y - other.y);
      total += Math.max(0, radius + other.radius - gap);
    }
    return total;
  }
}
