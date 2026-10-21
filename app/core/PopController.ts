import type { PopSnapshot } from "../renderer/BurstEffects";
import type { Orb } from "../types/types";
import type { ResolvedConfig } from "./ConfigResolver";
import type { PopLedger, PopRecord } from "./PopLedger";

/** What popping and restoring need from the chart. */
export interface PopHost {
  /** The live orb with this id, or `null` (unknown, exiting, or destroyed). */
  live(id: string): Orb | null;
  /** The orb's position in the `getData()` list. */
  indexOf(orb: Orb): number;
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
  /**
   * Draws one frame of an idle chart. `settle` lets a still chart settle
   * first; a paused chart never settles.
   */
  redraw(settle?: boolean): void;
  /** The options popping and restoring read. */
  config(): Pick<
    ResolvedConfig,
    | "onOrbClick"
    | "onOrbPop"
    | "popOnClick"
    | "restoreOnNextPop"
    | "onOrbRestore"
  >;
  /** The popped bubbles. */
  readonly ledger: PopLedger;
  /** Builds the orb a record describes and adds it to the list. */
  rebuild(record: PopRecord): Orb;
  /** Removes the ghost a popped bubble left, if any. */
  clearGhost(id: string): void;
  /**
   * Syncs input and the hidden list, then starts the orbs' rise. An idle chart
   * is drawn once unless `draw` is false (the caller draws afterwards).
   */
  arrive(orbs: Orb[], draw?: boolean): void;
}

const name = (orb: Orb) => orb.label || orb.id;

/**
 * Pops and restores bubbles. A pop takes the orb out of the chart at once,
 * remembers it in the ledger, and hands a snapshot to the burst effects, so
 * physics, hit testing, the hidden list, and `getData()` never see a half
 * popped bubble. A restore builds the bubble again from its record.
 */
export class PopController {
  constructor(private readonly host: PopHost) {}

  /** Pops the live orb `id`, as code does. Returns false when there is none. */
  pop(id: string): boolean {
    const orb = this.popOne(id, false);
    if (orb) this.host.announce(`${name(orb)} popped`);
    return orb !== null;
  }

  /**
   * Brings back the popped bubble `id`, or every popped bubble without an
   * `id`, as one batch. Returns false when nothing came back.
   */
  restore(id?: string): boolean {
    const { ledger } = this.host;
    const found = id === undefined ? ledger.all() : [ledger.get(id)];
    const orbs = this.bring(found, true);
    if (orbs.length === 0) return false;
    this.host.announce(this.restoredText(orbs));
    this.notify(orbs);
    return true;
  }

  /**
   * A click, tap, Enter, or Space on `orb`: report it, then maybe bring back
   * what the user popped before, then pop it. One message is announced.
   */
  activate(orb: Orb, event: MouseEvent) {
    const { host } = this;
    const config = host.config();
    config.onOrbClick(orb, event);
    if (!config.popOnClick) return;
    const back = config.restoreOnNextPop
      ? this.bring(host.ledger.byUser(), false)
      : [];
    this.notify(back);
    const popped = this.popOne(orb.id, true, back.length > 0);
    // An idle chart gets one draw per activation: the pop drew it, or this does.
    if (!popped && back.length > 0 && host.idle()) host.redraw(true);
    const parts = [];
    if (back.length > 0) parts.push(this.restoredText(back));
    if (popped) parts.push(`${name(popped)} popped`);
    if (parts.length > 0) host.announce(parts.join(", "));
  }

  // Pops without announcing, so a caller can compose one message.
  // `settle` lets an idle still chart settle in the draw, after a restore.
  private popOne(id: string, byUser: boolean, settle = false): Orb | null {
    const { host } = this;
    const orb = host.live(id);
    if (!orb) return null;
    const snapshot = host.snapshotOf(orb);
    host.ledger.remember({
      id: orb.id,
      label: orb.label,
      value: orb.value,
      color: orb.color,
      imageUrl: orb.imageUrl,
      metadata: orb.metadata,
      x: orb.x,
      y: orb.y,
      index: host.indexOf(orb),
      byUser,
    });
    host.remove(orb);
    const idle = host.idle();
    if (snapshot) host.burst(snapshot, idle);
    try {
      host.config().onOrbPop(orb);
    } catch (error) {
      console.error("OrbFlow: onOrbPop handler threw.", error);
    }
    if (snapshot && !idle) {
      host.push(snapshot.x, snapshot.y, snapshot.r + 150, 1);
    }
    if (idle) host.redraw(settle);
    return orb;
  }

  // Rebuilds the bubbles last popped first, so records that shared a list
  // position end up in their old order. Skips ids that are live again.
  // `draw` is false when the caller draws an idle chart itself afterwards.
  private bring(records: (PopRecord | undefined)[], draw: boolean): Orb[] {
    const { host } = this;
    const orbs: Orb[] = [];
    for (const record of [...records].reverse()) {
      if (!record || host.live(record.id)) continue;
      host.ledger.take(record.id);
      host.clearGhost(record.id);
      orbs.push(host.rebuild(record));
    }
    if (orbs.length > 0) host.arrive(orbs, draw);
    return orbs;
  }

  private restoredText(orbs: Orb[]): string {
    return orbs.length === 1
      ? `${name(orbs[0])} restored`
      : `${orbs.length} bubbles restored`;
  }

  private notify(orbs: Orb[]) {
    for (const orb of [...orbs].reverse()) {
      try {
        this.host.config().onOrbRestore(orb);
      } catch (error) {
        console.error("OrbFlow: onOrbRestore handler threw.", error);
      }
    }
  }
}
