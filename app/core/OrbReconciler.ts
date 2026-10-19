import type { Orb, OrbDataInput } from "../types/types";
import type { ResolvedConfig } from "./ConfigResolver";
import type { RadiusTweener } from "./RadiusTweener";

/** Where a new orb waits for a container that has no size yet. */
interface PendingSpawn {
  orb: Orb;
  radius: number;
}

/**
 * Matches accepted entries to live orbs by `id`. It creates, updates, revives,
 * or marks orbs as exiting, and keeps each orb's stable float seed.
 */
export class OrbReconciler {
  private seeds = new Map<string, number>();
  private seedCounter = 0;
  private pending = new Map<string, PendingSpawn>();

  constructor(
    private readonly tweener: RadiusTweener,
    private readonly random: () => number = Math.random,
  ) {}

  /** Float wobble phase for an orb, fixed for as long as the orb lives. */
  phaseOf(orb: Orb): number {
    return this.seeds.get(orb.id) ?? 0;
  }

  /** Drops what is kept for an orb that has been removed. */
  forget(id: string) {
    this.seeds.delete(id);
    this.pending.delete(id);
  }

  /**
   * Applies the accepted entries to `current` and returns the new list:
   * accepted entries in input order, then orbs that are exiting.
   */
  reconcile(
    current: Orb[],
    accepted: OrbDataInput[],
    config: ResolvedConfig,
    now: number,
  ): Orb[] {
    const byId = new Map(current.map((orb) => [orb.id, orb]));
    const radiusOf = this.radiusScale(accepted, config);
    const duration = config.transitionDuration;
    const kept = new Set<string>();

    const live = accepted.map((item, index) => {
      kept.add(item.id);
      const target = radiusOf(item.value);
      const existing = byId.get(item.id);

      if (existing) {
        existing.label = item.label;
        existing.value = item.value;
        existing.color = item.color ?? existing.color;
        existing.imageUrl = item.imageUrl;
        existing.metadata = item.metadata;
        this.tweener.retarget(existing, target, now, duration);
        return existing;
      }

      const orb = this.create(item, index, target, config);
      this.tweener.start(orb, target, now, duration, "enter");
      return orb;
    });

    const leaving = current.filter((orb) => !kept.has(orb.id));
    for (const orb of leaving) {
      if (!this.tweener.isExiting(orb)) {
        this.tweener.start(orb, 0, now, duration, "exit");
      }
    }
    return [...live, ...leaving];
  }

  /** Points every non exiting orb at a radius from the current config. */
  retargetAll(
    orbs: Orb[],
    config: ResolvedConfig,
    now: number,
    duration: number,
  ) {
    const live = orbs.filter((orb) => !this.tweener.isExiting(orb));
    const radiusOf = this.radiusScale(live, config);
    for (const orb of live) {
      this.tweener.retarget(orb, radiusOf(orb.value), now, duration);
    }
  }

  /** Gives orbs that were created in a 0 sized container their position. */
  placeAwaiting(width: number, height: number) {
    for (const { orb, radius } of this.pending.values()) {
      orb.x = this.spawnAxis(width, radius);
      orb.y = this.spawnAxis(height, radius);
    }
    this.pending.clear();
  }

  private radiusScale(
    items: { value: number }[],
    config: ResolvedConfig,
  ): (value: number) => number {
    const values = items.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return (value) =>
      config.minRadius +
      ((value - min) / (max - min || 1)) *
        (config.maxRadius - config.minRadius);
  }

  private create(
    item: OrbDataInput,
    index: number,
    target: number,
    config: ResolvedConfig,
  ): Orb {
    this.seeds.set(item.id, this.seedCounter++ * 0.7);
    const sized = config.width > 0 && config.height > 0;
    const orb: Orb = {
      id: item.id,
      label: item.label,
      value: item.value,
      radius: 0,
      x: sized ? this.spawnAxis(config.width, target) : 0,
      y: sized ? this.spawnAxis(config.height, target) : 0,
      vx: this.random() - 0.5,
      vy: this.random() - 0.5,
      color:
        item.color ?? config.colorScheme[index % config.colorScheme.length],
      imageUrl: item.imageUrl,
      metadata: item.metadata,
    };
    if (!sized) this.pending.set(item.id, { orb, radius: target });
    return orb;
  }

  private spawnAxis(size: number, radius: number): number {
    return this.random() * Math.max(0, size - radius * 2) + radius;
  }
}
