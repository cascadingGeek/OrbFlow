/**
 * Owns the animation frame id and the single clock. The clock is read once per
 * frame, and that one reading drives both the float offset and the tweens.
 */
export class AnimationLoop {
  private frameId: number | null = null;
  private active = false;

  constructor(
    private readonly onFrame: (now: number) => void,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  /** Current time in milliseconds from the injected clock. */
  now(): number {
    return this.clock();
  }

  /** True between `start()` and `stop()`. */
  get playing(): boolean {
    return this.active;
  }

  /** Draws a frame now and keeps going. Does nothing if a frame is queued. */
  start() {
    this.active = true;
    if (this.frameId === null) this.tick();
  }

  /** Cancels the queued frame. */
  stop() {
    this.active = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private tick() {
    this.frameId = null;
    this.onFrame(this.clock());
    if (this.active && this.frameId === null) {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }
}
