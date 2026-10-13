/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { OrbChart } from "./OrbChart";
import {
  dispatchMouse,
  installFakeCanvas,
  installFakeResizeObserver,
  installFrameQueue,
  setElementSize,
  type FakeContext,
} from "../test-support/fakeDom";

const data = [
  { id: "a", label: "Alpha", value: 40 },
  { id: "b", label: "Beta", value: 25 },
];

describe("<OrbChart> (React)", () => {
  let contexts: FakeContext[];
  let frames: ReturnType<typeof installFrameQueue>;

  beforeEach(() => {
    contexts = installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    // Every container the component renders gets a real layout size.
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({ width: 400, height: 300, top: 0, left: 0 }) as unknown as DOMRect,
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const drawnText = () =>
    contexts.flatMap((ctx) =>
      ctx.calls.filter((c) => c.method === "fillText").map((c) => c.args[0]),
    );

  it("renders a full size container with the given className and style", () => {
    const { container } = render(
      <OrbChart data={data} className="chart" style={{ height: 320 }} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("chart");
    expect(root).toHaveStyle({ width: "100%", height: "320px" });
  });

  it("mounts exactly one canvas and draws the data", () => {
    const { container } = render(<OrbChart data={data} />);

    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(drawnText()).toEqual(expect.arrayContaining(["Alpha", "Beta"]));
  });

  it("leaves exactly one canvas under StrictMode double mounting", () => {
    const { container } = render(
      <StrictMode>
        <OrbChart data={data} />
      </StrictMode>,
    );

    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("draws the new data when the data prop changes", () => {
    const { rerender } = render(<OrbChart data={data} />);

    rerender(<OrbChart data={[{ id: "c", label: "Gamma", value: 10 }]} />);
    frames.step();

    expect(drawnText()).toContain("Gamma");
  });

  it("calls onOrbClick when an orb is clicked", () => {
    const onOrbClick = jest.fn();
    const { container } = render(
      <OrbChart data={[data[0]]} minRadius={25} onOrbClick={onOrbClick} />,
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    setElementSize(canvas, 400, 300);

    dispatchMouse(canvas, "click", 200, 150);

    expect(onOrbClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a" }),
      expect.any(MouseEvent),
    );
  });

  it("removes the canvas when unmounted", () => {
    const { container, unmount } = render(<OrbChart data={data} />);
    const root = container.firstElementChild as HTMLElement;

    unmount();

    expect(root.querySelector("canvas")).toBeNull();
  });
});
