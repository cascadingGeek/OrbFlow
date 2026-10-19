import type { AnimationLoop } from "./AnimationLoop";

/**
 * Wraps the animation loop and remembers whether the developer paused it.
 * `pause()` sticks until `start()`, so data and config updates can redraw a
 * paused chart without waking it up.
 */
export class Playback {
  private userPaused = false;

  constructor(private readonly loop: AnimationLoop) {}

  /** True after `pause()` and until the next `start()`. */
  get paused(): boolean {
    return this.userPaused;
  }

  /** Clears the pause and runs the loop. */
  start() {
    this.userPaused = false;
    this.loop.start();
  }

  /** Remembers the pause and cancels the queued frame. */
  pause() {
    this.userPaused = true;
    this.loop.stop();
  }

  /** Runs the loop unless the developer paused it. */
  autoStart() {
    if (!this.userPaused) this.loop.start();
  }

  /** Cancels the queued frame without touching the pause flag. */
  stop() {
    this.loop.stop();
  }
}
