/** Undo steps, run newest first, each at most once. */
export class Teardown {
  private steps: (() => void)[] = [];

  /** Registers an undo step the moment its resource is created. */
  add(step: () => void) {
    this.steps.push(step);
  }

  /** Runs every registered step in reverse order, then forgets them. */
  run() {
    while (this.steps.length > 0) this.steps.pop()?.();
  }
}
