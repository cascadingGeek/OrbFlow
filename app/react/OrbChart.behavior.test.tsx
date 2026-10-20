/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import {
  Component,
  createRef,
  StrictMode,
  useLayoutEffect,
  type ReactNode,
  type Ref,
} from "react";
import { render } from "@testing-library/react";
import { OrbChart, type OrbChartHandle, type OrbChartProps } from "./OrbChart";
import { OrbChart as OrbChartCore } from "../core/OrbChart";
import {
  FakeResizeObserver,
  dispatchMouse,
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  trackListeners,
  type FakeContext,
} from "../test-support/fakeDom";

const data = [
  { id: "a", label: "Alpha", value: 40 },
  { id: "b", label: "Beta", value: 25 },
];

describe("<OrbChart> behavior", () => {
  let contexts: FakeContext[];
  let frames: ReturnType<typeof installFrameQueue>;
  let setData: jest.SpyInstance;
  let updateConfig: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({ width: 400, height: 300, top: 0, left: 0 }) as unknown as DOMRect,
      );
    setData = jest.spyOn(OrbChartCore.prototype, "setData");
    updateConfig = jest.spyOn(OrbChartCore.prototype, "updateConfig");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const drawn = () => contexts.reduce((n, ctx) => n + ctx.calls.length, 0);
  const canvasOf = (container: HTMLElement) => {
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    setElementSize(canvas, 400, 300);
    return canvas;
  };
  const props = (extra: Partial<OrbChartProps> = {}): OrbChartProps => ({
    data,
    transitionDuration: 0,
    ...extra,
  });

  describe("latest callbacks (AC-4)", () => {
    it("calls the newest onOrbClick without recreating the chart", () => {
      const first = jest.fn();
      const second = jest.fn();
      const { container, rerender } = render(
        <OrbChart {...props({ data: [data[0]], onOrbClick: first })} />,
      );
      const canvas = canvasOf(container);
      updateConfig.mockClear();

      rerender(
        <OrbChart {...props({ data: [data[0]], onOrbClick: second })} />,
      );
      dispatchMouse(canvas, "click", 200, 150);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      expect(container.querySelector("canvas")).toBe(canvas);
      expect(updateConfig).not.toHaveBeenCalled();
    });

    it("calls the newest onOrbHover and onDataIssue", () => {
      const hoverA = jest.fn();
      const hoverB = jest.fn();
      const issuesA = jest.fn();
      const issuesB = jest.fn();
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const base = { data: [data[0]] };
      const { container, rerender } = render(
        <OrbChart
          {...props({ ...base, onOrbHover: hoverA, onDataIssue: issuesA })}
        />,
      );
      const canvas = canvasOf(container);

      rerender(
        <OrbChart
          {...props({
            data: [data[0], { id: "", label: "x", value: 1 }],
            onOrbHover: hoverB,
            onDataIssue: issuesB,
          })}
        />,
      );
      dispatchMouse(canvas, "pointermove", 200, 150);

      expect(issuesA).not.toHaveBeenCalled();
      expect(issuesB).toHaveBeenCalledTimes(1);
      expect(hoverA).not.toHaveBeenCalled();
      expect(hoverB).toHaveBeenCalled();
    });

    it("does nothing, and does not throw, once a callback is removed", () => {
      const onOrbClick = jest.fn();
      const { container, rerender } = render(
        <OrbChart {...props({ data: [data[0]], onOrbClick })} />,
      );
      const canvas = canvasOf(container);

      rerender(<OrbChart {...props({ data: [data[0]] })} />);

      expect(() => dispatchMouse(canvas, "click", 200, 150)).not.toThrow();
      expect(onOrbClick).not.toHaveBeenCalled();
    });
  });

  describe("config comparison (AC-5, AC-12)", () => {
    it("makes no updateConfig call for equal values over many renders", () => {
      const { rerender } = render(
        <OrbChart {...props({ colorScheme: ["#111", "#222"] })} />,
      );
      for (let i = 0; i < 5; i++) {
        rerender(
          <OrbChart
            {...props({
              colorScheme: ["#111", "#222"],
              onOrbClick: () => undefined,
            })}
          />,
        );
      }
      expect(updateConfig).not.toHaveBeenCalled();
    });

    it("sends one call carrying only the changed key", () => {
      const { rerender } = render(<OrbChart {...props({ minRadius: 20 })} />);

      rerender(<OrbChart {...props({ minRadius: 20, maxRadius: 90 })} />);

      expect(updateConfig).toHaveBeenCalledTimes(1);
      expect(updateConfig).toHaveBeenCalledWith({ maxRadius: 90 });
    });

    it("keeps the last value when a prop is removed", () => {
      const { rerender } = render(<OrbChart {...props({ minRadius: 33 })} />);
      rerender(<OrbChart {...props({ minRadius: undefined })} />);
      rerender(<OrbChart {...props()} />);
      rerender(<OrbChart {...props({ minRadius: 33 })} />);

      expect(updateConfig).not.toHaveBeenCalled();
    });
  });

  describe("data comparison (AC-6)", () => {
    it("calls setData once on mount, and only for a new reference", () => {
      const { rerender } = render(<OrbChart {...props()} />);
      expect(setData).toHaveBeenCalledTimes(1);

      rerender(<OrbChart {...props({ className: "x" })} />);
      expect(setData).toHaveBeenCalledTimes(1);

      rerender(<OrbChart {...props({ data: [...data] })} />);
      expect(setData).toHaveBeenCalledTimes(2);
    });

    it("calls setData once per created chart under StrictMode", () => {
      render(
        <StrictMode>
          <OrbChart {...props()} />
        </StrictMode>,
      );
      expect(setData).toHaveBeenCalledTimes(2);
    });
  });

  describe("ref handle (AC-7, AC-8)", () => {
    it("is null before mount and after unmount, and stable in between", () => {
      const ref = createRef<OrbChartHandle>();
      const seen: (OrbChartHandle | null)[] = [];
      const Probe = ({ r }: { r: Ref<OrbChartHandle> }) => {
        if (seen.length === 0) seen.push(ref.current);
        return <OrbChart {...props()} ref={r} />;
      };
      const { rerender, unmount } = render(<Probe r={ref} />);
      const handle = ref.current;

      rerender(<Probe r={ref} />);

      expect(seen).toEqual([null]);
      expect(handle).not.toBeNull();
      expect(ref.current).toBe(handle);
      unmount();
      expect(ref.current).toBeNull();
    });

    it("returns the live orbs from getData", () => {
      const ref = createRef<OrbChartHandle>();
      render(<OrbChart {...props()} ref={ref} />);

      expect(ref.current?.getData().map((orb) => orb.id)).toEqual(["a", "b"]);
    });

    it("stops and resumes the frames", () => {
      const ref = createRef<OrbChartHandle>();
      render(<OrbChart {...props()} ref={ref} />);
      expect(frames.pending()).toBe(1);

      ref.current?.pause();
      expect(frames.pending()).toBe(0);

      ref.current?.start();
      expect(frames.pending()).toBe(1);
    });

    it("starts paused when pause is called before the chart exists", () => {
      const ref = createRef<OrbChartHandle>();
      const Parent = () => {
        useLayoutEffect(() => ref.current?.pause(), []);
        return <OrbChart {...props()} ref={ref} />;
      };

      render(<Parent />);

      expect(frames.pending()).toBe(0);
    });

    it("stays paused through StrictMode recreation, until start", () => {
      const ref = createRef<OrbChartHandle>();
      const Parent = () => {
        useLayoutEffect(() => ref.current?.pause(), []);
        return <OrbChart {...props()} ref={ref} />;
      };

      render(
        <StrictMode>
          <Parent />
        </StrictMode>,
      );
      expect(frames.pending()).toBe(0);

      ref.current?.start();
      expect(frames.pending()).toBe(1);
    });

    it("start() before the chart exists cancels an early pause", () => {
      const ref = createRef<OrbChartHandle>();
      const Parent = () => {
        useLayoutEffect(() => {
          ref.current?.pause();
          ref.current?.start();
        }, []);
        return <OrbChart {...props()} ref={ref} />;
      };

      render(<Parent />);

      expect(frames.pending()).toBe(1);
    });

    it("does nothing and does not throw after unmount", () => {
      const ref = createRef<OrbChartHandle>();
      const { unmount } = render(<OrbChart {...props()} ref={ref} />);
      const handle = ref.current as OrbChartHandle;
      unmount();

      expect(() => {
        handle.pause();
        handle.start();
      }).not.toThrow();
      expect(handle.getData()).toEqual([]);
      expect(frames.pending()).toBe(0);
    });
  });

  describe("paused chart (AC-9, AC-15)", () => {
    it("shows new data as one still frame and queues nothing", () => {
      const ref = createRef<OrbChartHandle>();
      const { rerender } = render(<OrbChart {...props()} ref={ref} />);
      ref.current?.pause();
      const before = drawn();

      rerender(
        <OrbChart
          {...props({ data: [{ id: "z", label: "Zed", value: 5 }] })}
          ref={ref}
        />,
      );

      expect(frames.pending()).toBe(0);
      expect(drawn()).toBeGreaterThan(before);
      expect(ref.current?.getData().map((orb) => orb.id)).toEqual(["z"]);
    });

    it("redraws once on resize and on a colorScheme change", () => {
      const ref = createRef<OrbChartHandle>();
      const { rerender } = render(<OrbChart {...props()} ref={ref} />);
      ref.current?.pause();

      let before = drawn();
      FakeResizeObserver.instances[0].trigger();
      expect(drawn()).toBeGreaterThan(before);

      before = drawn();
      rerender(<OrbChart {...props({ colorScheme: ["#123456"] })} ref={ref} />);
      expect(drawn()).toBeGreaterThan(before);
      expect(frames.pending()).toBe(0);
    });
  });

  describe("lifecycle (AC-3)", () => {
    it("leaves one canvas and one live observer under StrictMode", () => {
      const { container } = render(
        <StrictMode>
          <OrbChart {...props()} />
        </StrictMode>,
      );

      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      const live = FakeResizeObserver.instances.filter((o) => !o.disconnected);
      expect(live).toHaveLength(1);
      expect(FakeResizeObserver.instances).toHaveLength(2);
    });

    it("releases everything on unmount", () => {
      const listeners = trackListeners();
      const { container, unmount } = render(
        <StrictMode>
          <OrbChart {...props()} />
        </StrictMode>,
      );
      const root = container.firstElementChild as HTMLElement;
      const mine = (target: EventTarget) =>
        target instanceof HTMLCanvasElement || target === root;

      unmount();

      expect(listeners.count(mine)).toBe(0);
      expect(FakeResizeObserver.instances.every((o) => o.disconnected)).toBe(
        true,
      );
      expect(frames.pending()).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe("mount failure (AC-10)", () => {
    it("reaches an error boundary and leaves the container clean", () => {
      class Boundary extends Component<
        { children: ReactNode },
        { failed: boolean }
      > {
        state = { failed: false };
        static getDerivedStateFromError() {
          return { failed: true };
        }
        render() {
          return this.state.failed ? (
            <p>fallback</p>
          ) : (
            <div data-testid="host">{this.props.children}</div>
          );
        }
      }
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      Object.defineProperty(window, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: function ThrowingObserver() {
          throw new Error("no observer");
        },
      });

      const { container } = render(
        <Boundary>
          <OrbChart {...props()} />
        </Boundary>,
      );

      expect(container).toHaveTextContent("fallback");
      expect(container.querySelector("canvas")).toBeNull();
    });
  });

  describe("popping (spec 0005 AC-14)", () => {
    it("pops through the ref, and returns false once unmounted", () => {
      const ref = createRef<OrbChartHandle>();
      const { unmount } = render(<OrbChart {...props()} ref={ref} />);
      const handle = ref.current;

      expect(handle?.pop("a")).toBe(true);
      expect(handle?.pop("a")).toBe(false);
      expect(handle?.getData().map((orb) => orb.id)).toEqual(["b"]);
      unmount();
      expect(handle?.pop("b")).toBe(false);
    });

    it("calls the newest onOrbPop without updating the chart", () => {
      const first = jest.fn();
      const second = jest.fn();
      const ref = createRef<OrbChartHandle>();
      const { rerender } = render(
        <OrbChart {...props({ onOrbPop: first })} ref={ref} />,
      );
      updateConfig.mockClear();

      rerender(<OrbChart {...props({ onOrbPop: second })} ref={ref} />);
      ref.current?.pop("a");

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      expect(updateConfig).not.toHaveBeenCalled();
    });

    it("passes the new options by value, sending only what changed", () => {
      const look = {
        popOnClick: true,
        popStyle: "ghost",
        theme: "light",
        fontFamily: "Nunito, sans-serif",
      } as const;
      const { rerender } = render(<OrbChart {...props(look)} />);
      updateConfig.mockClear();

      rerender(<OrbChart {...props({ ...look })} />);
      expect(updateConfig).not.toHaveBeenCalled();

      rerender(<OrbChart {...props({ ...look, theme: "dark" })} />);
      expect(updateConfig).toHaveBeenCalledWith({ theme: "dark" });
    });

    it("pops on click when popOnClick is set", () => {
      const onOrbPop = jest.fn();
      const { container } = render(
        <OrbChart
          {...props({ data: [data[0]], popOnClick: true, onOrbPop })}
        />,
      );
      dispatchMouse(canvasOf(container), "click", 200, 150);

      expect(onOrbPop).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a" }),
      );
    });
  });
});
