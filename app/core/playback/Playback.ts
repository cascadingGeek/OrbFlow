import type { AnimationLoop } from "@/core/playback/AnimationLoop";

/**
 * Wraps the animation loop with two idle reasons: a developer pause, which
 * sticks until `start()`, and still mode for reduced motion.
 */
export class Playback {
  private userPaused = false;
  private still = false;
  private wantsToRun = false;

  constructor(private readonly loop: AnimationLoop) {}

  /** True after `pause()` and until the next `start()`. */
  get paused(): boolean {
    return this.userPaused;
  }

  /** True while the chart holds still for reduced motion. */
  get reduced(): boolean {
    return this.still;
  }

  /** True while the frame loop is running. */
  get running(): boolean {
    return this.loop.playing;
  }

  /** True when no frame loop should run: paused or still. */
  get idle(): boolean {
    return this.userPaused || this.still;
  }

  /** Clears the pause and runs the loop, unless the chart holds still. */
  start() {
    this.userPaused = false;
    this.wantsToRun = true;
    if (!this.still) this.loop.start();
  }

  /** Remembers the pause and cancels the queued frame. */
  pause() {
    this.userPaused = true;
    this.loop.stop();
  }

  /** Runs the loop unless the developer paused it or the chart is still. */
  autoStart() {
    this.wantsToRun = true;
    if (!this.idle) this.loop.start();
  }

  /**
   * Enters or leaves still mode. Entering stops the loop. Leaving restarts it
   * only if the chart wanted to run and the developer has not paused it.
   */
  setReduced(reduced: boolean) {
    this.still = reduced;
    if (reduced) this.loop.stop();
    else if (this.wantsToRun && !this.userPaused) this.loop.start();
  }

  /** Cancels the queued frame without touching the pause flag. */
  stop() {
    this.loop.stop();
  }
}
