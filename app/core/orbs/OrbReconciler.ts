import type { Orb, OrbDataInput } from "../../types/types";
import type { ResolvedConfig } from "../config/ConfigResolver";
import type { PopRecord } from "../pop/PopLedger";
import type { RadiusTweener } from "./RadiusTweener";
import { Spawner, type Place } from "./Spawner";

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
  private readonly spawner: Spawner;

  constructor(
    private readonly tweener: RadiusTweener,
    private readonly random: () => number = Math.random,
    private readonly popped: () => { value: number }[] = () => [],
  ) {
    this.spawner = new Spawner(random);
  }

  /** Float wobble phase for an orb, fixed for as long as the orb lives. */
  phaseOf(orb: Orb): number {
    return this.seeds.get(orb.id) ?? 0;
  }

  /** True while the orb waits for a container with a size to be placed. */
  awaiting(id: string): boolean {
    return this.pending.has(id);
  }

  /** Forgets an orb that was popped: its seed, place, and tween. */
  drop(id: string) {
    this.forget(id);
    this.tweener.cancel(id);
  }

  /** Drops what is kept for an orb that has been removed. */
  forget(id: string) {
    this.seeds.delete(id);
    this.pending.delete(id);
  }

  /**
   * Returns accepted entries in input order, then exiting orbs. `duration`
   * overrides the transition length; 0 makes every change snap.
   */
  reconcile(
    current: Orb[],
    accepted: OrbDataInput[],
    config: ResolvedConfig,
    now: number,
    duration = config.transitionDuration,
  ): Orb[] {
    const byId = new Map(current.map((orb) => [orb.id, orb]));
    const radiusOf = this.radiusScale(accepted, config);
    const kept = new Set<string>();
    const placed = current.filter((orb) => !this.tweener.isExiting(orb));

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

      const orb = this.create(item, index, target, config, placed);
      placed.push(orb);
      if (config.enterStyle === "grow") {
        this.tweener.start(orb, target, now, duration, "enter");
      }
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

  /**
   * Points every non exiting orb at a radius from the current config. Popped
   * bubbles still count towards the largest value, so a restore later gives
   * the size a fresh `setData` would.
   */
  retargetAll(
    orbs: Orb[],
    config: ResolvedConfig,
    now: number,
    duration: number,
  ) {
    const live = orbs.filter((orb) => !this.tweener.isExiting(orb));
    const radiusOf = this.radiusScale([...live, ...this.popped()], config);
    for (const orb of live) {
      this.tweener.retarget(orb, radiusOf(orb.value), now, duration);
    }
  }

  /** Gives orbs that were created in a 0 sized container their position. */
  placeAwaiting(width: number, height: number) {
    for (const { orb, radius } of this.pending.values()) {
      Object.assign(orb, this.spawner.anywhere(width, height, radius));
    }
    this.pending.clear();
  }

  // Area follows the value: the largest value gets maxRadius, and minRadius
  // is a floor so tiny values stay visible.
  private radiusScale(
    items: { value: number }[],
    config: ResolvedConfig,
  ): (value: number) => number {
    const largest = items.reduce((max, item) => Math.max(max, item.value), 0);
    const floor = Math.min(config.minRadius, config.maxRadius);
    return (value) =>
      largest > 0
        ? Math.max(floor, config.maxRadius * Math.sqrt(value / largest))
        : floor;
  }

  /**
   * Builds the orb a popped bubble was, at its old resting place moved back
   * inside the chart. Its radius is the one `setData` of the same data would
   * give: `live` and the popped records are every other bubble, the record is itself.
   */
  restoreOrb(record: PopRecord, config: ResolvedConfig, live: Orb[]): Orb {
    const all = [...live, ...this.popped(), record];
    const radiusOf = this.radiusScale(all, config);
    const radius = radiusOf(record.value);
    return this.make(record, radius, radius, config, (width, height) =>
      record.placed
        ? this.spawner.clamp(record, width, height, radius)
        : this.spawner.leastCrowded(width, height, radius, live),
    );
  }

  private create(
    item: OrbDataInput,
    index: number,
    target: number,
    config: ResolvedConfig,
    others: Orb[],
  ): Orb {
    const color =
      item.color ?? config.colorScheme[index % config.colorScheme.length];
    const rise = config.enterStyle === "rise";
    return this.make(
      { ...item, color },
      rise ? target : 0,
      target,
      config,
      (width, height) =>
        rise
          ? this.spawner.leastCrowded(width, height, target, others)
          : this.spawner.anywhere(width, height, target),
    );
  }

  // Builds the orb with a fresh seed and a small random push. In a container
  // with no size yet it waits to be placed.
  private make(
    item: OrbDataInput,
    radius: number,
    target: number,
    config: ResolvedConfig,
    choose: (width: number, height: number) => Place,
  ): Orb {
    this.seeds.set(item.id, this.seedCounter++ * 0.7);
    const sized = config.width > 0 && config.height > 0;
    const place = sized ? choose(config.width, config.height) : { x: 0, y: 0 };
    const orb: Orb = {
      id: item.id,
      label: item.label,
      value: item.value,
      radius,
      x: place.x,
      y: place.y,
      vx: this.random() - 0.5,
      vy: this.random() - 0.5,
      color: item.color,
      imageUrl: item.imageUrl,
      metadata: item.metadata,
    };
    if (!sized) this.pending.set(item.id, { orb, radius: target });
    return orb;
  }
}
