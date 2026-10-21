/** Undo steps, run newest first, each at most once. */
export class Teardown {
  private steps: (() => void)[] = [];

  /** Registers an undo step the moment its resource is created. */
  add(step: () => void) {
    this.steps.push(step);
  }

  /** Registers `part.dispose` and hands the part back, for one line setup. */
  own<T extends { dispose(): void }>(part: T): T {
    this.add(() => part.dispose());
    return part;
  }

  /** Runs every registered step in reverse order, then forgets them. */
  run() {
    while (this.steps.length > 0) this.steps.pop()?.();
  }
}
