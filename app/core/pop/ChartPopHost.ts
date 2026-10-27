import type { ChartView } from "@/renderer/ChartView";
import type { PopSnapshot } from "@/renderer/canvas/BurstEffects";
import type { Orb } from "@/types/types";
import type { ResolvedConfig } from "@/core/config/ConfigResolver";
import type { OrbReconciler } from "@/core/orbs/OrbReconciler";
import type { PhysicsEngine } from "@/core/physics/PhysicsEngine";
import type { Playback } from "@/core/playback/Playback";
import type { PopHost } from "@/core/pop/PopController";
import type { PopLedger, PopRecord } from "@/core/pop/PopLedger";
import type { RiseTracker } from "@/core/orbs/RiseTracker";

/** The chart's orbs, which the host reads and replaces. */
interface OrbStore {
  /** Every orb, also the ones shrinking out. */
  all(): Orb[];
  /** Replaces the list. */
  set(orbs: Orb[]): void;
  /** The orbs `getData()` returns. */
  live(): Orb[];
}

/** The chart parts the host wires to the pop controller. */
export interface ChartPopParts {
  view: ChartView;
  physics: PhysicsEngine;
  reconciler: OrbReconciler;
  rises: RiseTracker;
  ledger: PopLedger;
  orbs: OrbStore;
  config(): ResolvedConfig;
  now(): number;
  playback: Playback;
  /** Draws once for an idle chart. A still chart settles first when asked. */
  redraw(settle: boolean): void;
}

/** The `PopHost` of a chart: it connects popping and restoring to its parts. */
export class ChartPopHost implements PopHost {
  constructor(private readonly parts: ChartPopParts) {}

  get ledger(): PopLedger {
    return this.parts.ledger;
  }

  live(id: string): Orb | null {
    return this.parts.orbs.live().find((orb) => orb.id === id) ?? null;
  }

  placed(orb: Orb): boolean {
    return !this.parts.reconciler.awaiting(orb.id);
  }

  indexOf(orb: Orb): number {
    return this.parts.orbs.live().indexOf(orb);
  }

  snapshotOf(orb: Orb): PopSnapshot | null {
    return this.parts.view.snapshotOf(orb, this.placed(orb));
  }

  remove(orb: Orb) {
    const { orbs, reconciler, rises, view } = this.parts;
    orbs.set(orbs.all().filter((other) => other !== orb));
    reconciler.drop(orb.id);
    rises.forget(orb.id);
    view.syncInput(orbs.live());
    view.syncList(orbs.live());
  }

  burst(snapshot: PopSnapshot, idle: boolean) {
    this.parts.view.burst(snapshot, this.parts.now(), idle);
  }

  announce(text: string) {
    this.parts.view.announce(text);
  }

  push(x: number, y: number, reach: number, strength: number) {
    const { physics, orbs } = this.parts;
    physics.applyMouseRepulsion(orbs.all(), x, y, reach, strength);
  }

  idle(): boolean {
    return this.parts.playback.idle;
  }

  redraw(settle = false) {
    this.parts.redraw(settle && !this.parts.playback.paused);
  }

  config() {
    return this.parts.config();
  }

  rebuild(record: PopRecord): Orb {
    const { orbs, reconciler, config } = this.parts;
    const orb = reconciler.restoreOrb(record, config(), orbs.live());
    const list = orbs.all();
    list.splice(Math.min(record.index, orbs.live().length), 0, orb);
    orbs.set(list);
    return orb;
  }

  clearGhost(id: string) {
    this.parts.view.removeGhost(id);
  }

  arrive(orbs: Orb[], draw = true) {
    const { view, rises, now } = this.parts;
    const live = this.parts.orbs.live();
    view.syncInput(live);
    view.syncList(live);
    view.preloadImages(orbs);
    rises.start(orbs, now());
    // An idle chart shows the bubble in place with one draw.
    // A still chart settles after it, a paused chart never moves.
    if (draw && this.idle()) this.redraw(true);
  }
}
