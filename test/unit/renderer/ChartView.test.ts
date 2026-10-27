/**
 * @jest-environment jsdom
 */
import {
  ChartView,
  type ViewConfig,
  type ViewHost,
} from "@/renderer/ChartView";
import {
  FakeResizeObserver,
  installFakeCanvas,
  installFakeResizeObserver,
  setElementSize,
  trackListeners,
} from "@test/support/fakeDom";
import type { Orb } from "@/types/types";

describe("ChartView", () => {
  let container: HTMLDivElement;
  let host: jest.Mocked<ViewHost>;
  const config = (): ViewConfig => ({
    enableTooltip: true,
    ariaLabel: "Chart",
    ariaDescription: "",
    width: 400,
    height: 300,
  });

  beforeEach(() => {
    installFakeCanvas();
    installFakeResizeObserver();
    container = document.createElement("div");
    setElementSize(container, 400, 300);
    document.body.appendChild(container);
    host = {
      onCanvasMiss: jest.fn(),
      onActivate: jest.fn(),
      onImageLoaded: jest.fn(),
      now: jest.fn(() => 0),
      elapsed: jest.fn(() => 0),
      phaseOf: jest.fn<number, [Orb]>(() => 0),
      riseOf: jest.fn<number, [Orb, number]>(() => 0),
      onGateOpen: jest.fn(),
      redrawIfStopped: jest.fn(),
      onResize: jest.fn(),
    };
  });

  afterEach(() => {
    container.remove();
    jest.restoreAllMocks();
  });

  it("builds the canvas, tooltip, list, and live region in order", () => {
    new ChartView(container, config, host);
    expect([...container.children].map((el) => el.tagName)).toEqual([
      "CANVAS",
      "DIV",
      "UL",
      "DIV",
    ]);
    expect(container.lastElementChild?.getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("tells the host when the container resizes", () => {
    new ChartView(container, config, host);
    FakeResizeObserver.instances[0].trigger();
    expect(host.onResize).toHaveBeenCalledTimes(1);
  });

  it("removes everything it added, listeners and observer included", () => {
    const listeners = trackListeners();
    const view = new ChartView(container, config, host);

    view.dispose();
    view.dispose();

    expect(container.children).toHaveLength(0);
    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
    expect(listeners.count((t) => t instanceof HTMLElement)).toBe(0);
  });

  it("leaves nothing behind when a part fails to build", () => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(() => new ChartView(container, config, host)).toThrow(
      "canvas context",
    );
    expect(container.children).toHaveLength(0);
  });

  it("cleans up the earlier parts when a later one throws", () => {
    jest.spyOn(globalThis, "ResizeObserver").mockImplementation(() => {
      throw new Error("no observer");
    });
    expect(() => new ChartView(container, config, host)).toThrow("no observer");
    expect(container.children).toHaveLength(0);
    expect(container.style.position).toBe("");
  });

  it("passes still mode on to the tooltip fade", () => {
    const view = new ChartView(container, config, host);
    view.setStill(true);
    expect(
      (container.querySelector(":scope > div[aria-hidden]") as HTMLElement)
        .style.transition,
    ).toBe("none");
    view.setStill(false);
    expect(
      (container.querySelector(":scope > div[aria-hidden]") as HTMLElement)
        .style.transition,
    ).toBe("opacity 0.2s");
  });
});
