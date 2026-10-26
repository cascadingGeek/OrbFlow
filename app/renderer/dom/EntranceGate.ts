/**
 * Opens once and for good when the container first scrolls into view. Without
 * `IntersectionObserver` it starts open and never calls `onOpen`.
 */
export class EntranceGate {
  private observer: IntersectionObserver | null = null;
  private opened = false;
  private disposed = false;

  constructor(
    container: HTMLElement,
    private readonly onOpen: () => void,
  ) {
    if (typeof IntersectionObserver === "undefined") {
      this.opened = true;
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (this.disposed || this.opened) return;
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.forceOpen();
        this.onOpen();
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );
    this.observer.observe(container);
  }

  /** True once the container has been seen, or when nothing can watch it. */
  get open(): boolean {
    return this.opened;
  }

  /** Opens the gate for good without calling `onOpen`, and stops watching. */
  forceOpen() {
    this.opened = true;
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Stops watching. A callback that fires later does nothing. */
  dispose() {
    this.disposed = true;
    this.observer?.disconnect();
    this.observer = null;
  }
}

/** Calls `onResize` when `el` changes size. Returns a function that stops it. */
export function watchResize(el: Element, onResize: () => void): () => void {
  const observer = new ResizeObserver(() => onResize());
  observer.observe(el);
  return () => observer.disconnect();
}
