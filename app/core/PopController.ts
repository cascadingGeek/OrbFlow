import type { PopSnapshot } from "../renderer/BurstEffects";
import type { Orb } from "../types/types";
import type { ResolvedConfig } from "./ConfigResolver";

/** What popping needs from the chart. */
export interface PopHost {
  /** The live orb with this id, or `null` (unknown, exiting, or destroyed). */
  live(id: string): Orb | null;
  /** The orb as drawn now, or `null` when it has no size or no place yet. */
  snapshotOf(orb: Orb): PopSnapshot | null;
  /** Takes the orb out of the chart, then syncs input and the hidden list. */
  remove(orb: Orb): void;
  /** Adds the burst and any ghost. */
  burst(snapshot: PopSnapshot, idle: boolean): void;
  /** Tells screen reader users. */
  announce(text: string): void;
  /** Pushes neighbors away from a point. */
  push(x: number, y: number, reach: number, strength: number): void;
  /** True while the chart is paused or still. */
  idle(): boolean;
  /** Draws one frame of an idle chart, without settling. */
  redraw(): void;
  /** The options popping reads. */
  config(): Pick<ResolvedConfig, "onOrbClick" | "onOrbPop" | "popOnClick">;
}

/**
 * Pops bubbles. A pop takes the orb out of the chart at once and hands a
 * snapshot to the burst effects, so physics, hit testing, the hidden list,
 * and `getData()` never see a half popped bubble.
 */
export class PopController {
  constructor(private readonly host: PopHost) {}

  /** Pops the live orb `id`. Returns false when there is none. */
  pop(id: string): boolean {
    const { host } = this;
    const orb = host.live(id);
    if (!orb) return false;
    const snapshot = host.snapshotOf(orb);
    host.remove(orb);
    const idle = host.idle();
    if (snapshot) host.burst(snapshot, idle);
    host.announce(`${orb.label || orb.id} popped`);
    try {
      host.config().onOrbPop(orb);
    } catch (error) {
      console.error("OrbFlow: onOrbPop handler threw.", error);
    }
    if (snapshot && !idle) {
      host.push(snapshot.x, snapshot.y, snapshot.r + 150, 1);
    }
    if (idle) host.redraw();
    return true;
  }

  /** A click, tap, Enter, or Space on `orb`: report it, then maybe pop it. */
  activate(orb: Orb, event: MouseEvent) {
    const config = this.host.config();
    config.onOrbClick(orb, event);
    if (config.popOnClick) this.pop(orb.id);
  }
}
