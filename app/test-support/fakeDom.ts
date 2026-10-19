/**
 * Test only helpers for the jsdom environment: a recording 2D context (jsdom
 * has no canvas), a controllable ResizeObserver, a manual animation frame
 * queue, and mouse events with real offsetX / offsetY. Never imported by the
 * public entries, so it is not part of the build.
 */

export interface FakeContext {
  calls: { method: string; args: unknown[] }[];
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  [method: string]: unknown;
}

const recordedMethods = [
  "fillRect",
  "beginPath",
  "arc",
  "ellipse",
  "fill",
  "stroke",
  "save",
  "restore",
  "clip",
  "drawImage",
  "fillText",
  "scale",
];

/** Makes every canvas return a fresh recording context. */
export function installFakeCanvas(): FakeContext[] {
  const contexts: FakeContext[] = [];
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => {
      const ctx: FakeContext = {
        calls: [],
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "start",
        textBaseline: "alphabetic",
        globalAlpha: 1,
      };
      for (const method of recordedMethods) {
        ctx[method] = (...args: unknown[]) => ctx.calls.push({ method, args });
      }
      ctx.createRadialGradient = () => ({ addColorStop: () => undefined });
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    });
  return contexts;
}

/** A ResizeObserver whose callbacks the test fires by hand. */
export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

export function installFakeResizeObserver() {
  FakeResizeObserver.instances = [];
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: FakeResizeObserver,
  });
}

/** Queues animation frames so a test can step the loop one frame at a time. */
export function installFrameQueue() {
  let nextId = 1;
  const queue = new Map<number, FrameRequestCallback>();
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId++;
    queue.set(id, callback);
    return id;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    queue.delete(id);
  });
  return {
    pending: () => queue.size,
    step(frames = 1) {
      for (let i = 0; i < frames; i++) {
        const callbacks = [...queue.values()];
        queue.clear();
        callbacks.forEach((callback) => callback(0));
      }
    },
  };
}

/** Gives an element a fixed layout box (jsdom reports zero by default). */
export function setElementSize(el: HTMLElement, width: number, height: number) {
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** Dispatches a pointer style event with canvas relative offsetX / offsetY. */
export function dispatchMouse(
  target: Element,
  type: "click" | "pointermove" | "pointerleave" | "pointerdown",
  x = 0,
  y = 0,
  pointerType: "mouse" | "touch" | "pen" = "mouse",
) {
  // jsdom has no PointerEvent, so a MouseEvent carries the pointer fields.
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, "offsetX", { value: x });
  Object.defineProperty(event, "offsetY", { value: y });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  target.dispatchEvent(event);
  return event;
}

/** A touch tap: pointerdown, then the click the browser fires after it. */
export function tap(target: Element, x: number, y: number) {
  dispatchMouse(target, "pointerdown", x, y, "touch");
  return dispatchMouse(target, "click", x, y, "touch");
}

/**
 * Counts listeners that are added and not yet removed on any event target.
 * Call `restore()` (or `jest.restoreAllMocks()`) when done.
 */
export function trackListeners() {
  const live = new Map<string, EventTarget>();
  const ids = new WeakMap<object, number>();
  let nextId = 0;
  const keyOf = (target: object, type: string, listener: unknown) => {
    if (!ids.has(target)) ids.set(target, nextId++);
    if (!ids.has(listener as object)) ids.set(listener as object, nextId++);
    return `${ids.get(target)}:${type}:${ids.get(listener as object)}`;
  };
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  jest
    .spyOn(EventTarget.prototype, "addEventListener")
    .mockImplementation(function (this: EventTarget, type, listener, options) {
      if (listener) live.set(keyOf(this, type, listener), this);
      return add.call(this, type, listener, options);
    });
  jest
    .spyOn(EventTarget.prototype, "removeEventListener")
    .mockImplementation(function (this: EventTarget, type, listener, options) {
      if (listener) live.delete(keyOf(this, type, listener));
      return remove.call(this, type, listener, options);
    });
  return {
    /** Live listeners, optionally only on targets the filter accepts. */
    count: (onTarget: (target: EventTarget) => boolean = () => true) =>
      [...live.values()].filter(onTarget).length,
  };
}
