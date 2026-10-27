import type { Playback } from "@/core/playback/Playback";

/** What the redrawer asks of the chart. All of it runs on the chart's orbs. */
export interface RedrawHost {
  /** Current time from the chart's clock. */
  now(): number;
  /** True when the container has a width and a height. */
  sized(): boolean;
  /** Finishes every tween, drops exited orbs, and syncs input and list. */
  snap(): void;
  /** Lets the live orbs find their resting places. */
  settleOrbs(): void;
  /** Draws one frame, without queuing another. */
  draw(now: number): void;
  /** Turns the view's still look (no float, no fade) on or off. */
  setStill(still: boolean): void;
}

/**
 * Owns the path for a chart whose loop is not running (paused or still): draw
 * once, and in still mode settle the orbs first. A user pause always wins, so
 * a paused chart never moves; it remembers that a settle is owed instead.
 */
export class Redrawer {
  private pendingSettle = false;

  constructor(
    private readonly playback: Playback,
    private readonly host: RedrawHost,
  ) {}

  /**
   * Draws one frame for an idle chart. `settle` says the change may have moved
   * orbs (data, size, radius), so a still chart settles before it draws.
   */
  run(settle = true) {
    if (this.playback.reduced && settle) {
      if (this.playback.paused) this.pendingSettle = true;
      else return this.pass();
    }
    this.host.draw(this.host.now());
  }

  /** Called after `start()`: a still chart draws once and queues nothing. */
  begin() {
    if (!this.playback.reduced) return;
    if (this.pendingSettle) this.pass();
    else this.host.draw(this.host.now());
  }

  /** Applies still mode to the playback and the view, without redrawing. */
  apply(reduced: boolean) {
    this.host.setStill(reduced);
    this.playback.setReduced(reduced);
  }

  /** Called when the setting flips while the chart is running. */
  flipped(reduced: boolean) {
    this.apply(reduced);
    if (reduced) return this.run();
    this.pendingSettle = false;
    // A restarted loop draws by itself.
    if (!this.playback.running) this.host.draw(this.host.now());
  }

  // Snap tweens, settle, then draw once. Waits for a container with a size.
  private pass() {
    if (!this.host.sized()) return;
    this.host.snap();
    this.host.settleOrbs();
    this.pendingSettle = false;
    this.host.draw(this.host.now());
  }
}
