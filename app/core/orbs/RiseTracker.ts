import type { Orb } from "@/types/types";
import type { ResolvedConfig } from "@/core/config/ConfigResolver";

/** What the tracker reads from the chart, looked up when it is used. */
export interface RiseSettings {
  /**
   * The options a rise reads: a rise lasts twice `transitionDuration`, and
   * `floatAmplitude` keeps a bubble fully below the edge at its start.
   */
  config(): Pick<
    ResolvedConfig,
    "transitionDuration" | "floatAmplitude" | "enterStyle"
  >;
  /** True while the chart is paused or still: nothing rises then. */
  idle(): boolean;
  /** True once the chart has been scrolled into view. */
  gateOpen(): boolean;
  /** Opens the scroll gate for good, without a callback. */
  openGate(): void;
}

/** One bubble's rise. A parked one waits for the scroll gate. */
interface Rise {
  startedAt: number;
  delay: number;
  duration: number;
  parked: boolean;
}

/**
 * Tracks bubbles rising from below the chart and how far down each is drawn.
 * A rising bubble keeps its real place; only the drawing moves.
 */
export class RiseTracker {
  private readonly rises = new Map<string, Rise>();

  constructor(
    private readonly settings: RiseSettings,
    private readonly random: () => number = Math.random,
  ) {}

  /**
   * Starts a rise for each orb at `now`. A batch of two or more gets a random
   * delay each, so the bubbles rise in a loose stagger. Does nothing while the
   * chart is idle or `transitionDuration` is 0.
   */
  start(orbs: Orb[], now: number) {
    if (!this.enabled()) return;
    for (const orb of orbs) this.rises.set(orb.id, this.rise(now, orbs.length));
  }

  /**
   * The orbs of `all` that are not in `known` have just entered. They rise at
   * once when the chart has been seen, and wait below the edge until it is.
   */
  enter(all: Orb[], known: Set<string>, now: number) {
    const fresh = all.filter((orb) => !known.has(orb.id));
    if (fresh.length === 0 || this.settings.config().enterStyle !== "rise")
      return;
    if (this.settings.gateOpen()) this.start(fresh, now);
    else this.park(fresh.map((orb) => orb.id));
  }

  /** Holds bubbles below the edge until `release`, as the scroll gate asks. */
  park(ids: string[]) {
    if (!this.enabled()) return;
    for (const id of ids) {
      this.rises.set(id, { startedAt: 0, delay: 0, duration: 0, parked: true });
    }
  }

  /** True while any bubble waits for the scroll gate. */
  hasParked(): boolean {
    for (const rise of this.rises.values()) if (rise.parked) return true;
    return false;
  }

  /**
   * Lets parked bubbles take their place at once when the options no longer
   * ask for a rise (`transitionDuration` 0 or `enterStyle` "grow").
   */
  settleParked() {
    const { transitionDuration, enterStyle } = this.settings.config();
    if (transitionDuration > 0 && enterStyle === "rise") return;
    for (const [id, rise] of this.rises) if (rise.parked) this.rises.delete(id);
  }

  /** Starts every parked bubble at `now`, as one batch. */
  release(now: number) {
    const ids = [...this.rises].filter(([, rise]) => rise.parked);
    for (const [id] of ids) this.rises.set(id, this.rise(now, ids.length));
  }

  /**
   * How far below its resting place `orb` is drawn, in pixels. Reads only.
   * `height` is the canvas height.
   */
  offsetOf(orb: Orb, now: number, height: number): number {
    const rise = this.rises.get(orb.id);
    if (!rise) return 0;
    const floatAmp = this.settings.config().floatAmplitude ?? 2.0;
    const drop = height - orb.y + orb.radius + floatAmp;
    return drop * (1 - this.eased(rise, now));
  }

  /** Forgets every rise that has reached its end. */
  step(now: number) {
    for (const [id, rise] of this.rises) {
      if (!rise.parked && this.progress(rise, now) >= 1) this.rises.delete(id);
    }
  }

  /**
   * Ends every rise at once, as a pause or still mode does: parked bubbles
   * take their place and the gate opens for good. True if there were any.
   */
  finishAll(): boolean {
    if (this.hasParked()) this.settings.openGate();
    const any = this.rises.size > 0;
    this.rises.clear();
    return any;
  }

  forget(id: string) {
    this.rises.delete(id);
  }

  clear() {
    this.rises.clear();
  }

  private enabled(): boolean {
    return (
      !this.settings.idle() && this.settings.config().transitionDuration > 0
    );
  }

  private rise(now: number, batch: number): Rise {
    const base = this.settings.config().transitionDuration;
    return {
      startedAt: now,
      delay: batch > 1 ? this.random() * 1.5 * base : 0,
      duration: 2 * base,
      parked: false,
    };
  }

  private progress(rise: Rise, now: number): number {
    if (rise.duration <= 0) return 1;
    const t = (now - rise.startedAt - rise.delay) / rise.duration;
    return Math.min(1, Math.max(0, t));
  }

  // Ease out cubic. A parked bubble is at the start of its curve.
  private eased(rise: Rise, now: number): number {
    if (rise.parked) return 0;
    return 1 - (1 - this.progress(rise, now)) ** 3;
  }
}
