/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { OrbChart } from "@/react/OrbChart";
import { OrbChart as OrbChartCore } from "@/core/OrbChart";
import {
  installFakeCanvas,
  installFakeMatchMedia,
  installFakeResizeObserver,
  installFrameQueue,
} from "@test/support/fakeDom";

const data = [
  { id: "a", label: "Alpha", value: 40 },
  { id: "b", label: "Beta", value: 25 },
];

describe("<OrbChart> accessibility props (AC-12)", () => {
  let frames: ReturnType<typeof installFrameQueue>;
  let media: ReturnType<typeof installFakeMatchMedia>;
  let updateConfig: jest.SpyInstance;

  beforeEach(() => {
    installFakeCanvas();
    installFakeResizeObserver();
    frames = installFrameQueue();
    media = installFakeMatchMedia();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({ width: 400, height: 300, top: 0, left: 0 }) as unknown as DOMRect,
      );
    updateConfig = jest.spyOn(OrbChartCore.prototype, "updateConfig");
  });

  afterEach(() => {
    media.restore();
    jest.restoreAllMocks();
  });

  it("passes the three options to the chart at mount", () => {
    const { container } = render(
      <OrbChart
        data={data}
        ariaLabel="Sales"
        ariaDescription="By region"
        reducedMotion="always"
      />,
    );
    const list = container.querySelector("ul");
    expect(list).toHaveAttribute("aria-label", "Sales");
    expect(container.querySelector("span")).toHaveTextContent("By region");
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(frames.pending()).toBe(0);
  });

  it("sends only a changed option to updateConfig, compared by value", () => {
    const { container, rerender } = render(
      <OrbChart data={data} ariaLabel="Sales" />,
    );
    updateConfig.mockClear();

    rerender(<OrbChart data={data} ariaLabel="Sales" />);
    expect(updateConfig).not.toHaveBeenCalled();

    rerender(<OrbChart data={data} ariaLabel="Costs" ariaDescription="Q3" />);
    expect(updateConfig).toHaveBeenCalledTimes(1);
    expect(updateConfig).toHaveBeenCalledWith({
      ariaLabel: "Costs",
      ariaDescription: "Q3",
    });
    expect(container.querySelector("ul")).toHaveAttribute(
      "aria-label",
      "Costs",
    );
  });

  it("clears a description with an empty string, not by removing the prop", () => {
    const { container, rerender } = render(
      <OrbChart data={data} ariaDescription="About" />,
    );
    rerender(<OrbChart data={data} />);
    expect(container.querySelector("span")).toHaveTextContent("About");
    rerender(<OrbChart data={data} ariaDescription="" />);
    expect(container.querySelector("span")).toBeNull();
  });

  it("switches reduced motion with a prop", () => {
    const { rerender } = render(<OrbChart data={data} reducedMotion="never" />);
    expect(frames.pending()).toBe(1);
    rerender(<OrbChart data={data} reducedMotion="always" />);
    expect(frames.pending()).toBe(0);
  });

  it("leaves one canvas and one list under StrictMode, and cleans up", () => {
    const { container, unmount } = render(
      <StrictMode>
        <OrbChart data={data} />
      </StrictMode>,
    );
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(2);

    unmount();
    expect(media.listenerCount()).toBe(0);
    expect(frames.pending()).toBe(0);
  });
});
